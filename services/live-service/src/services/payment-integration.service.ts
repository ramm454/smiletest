import { Injectable, Logger } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import Stripe from 'stripe';
import * as crypto from 'crypto';

const prisma = new PrismaClient();

@Injectable()
export class PaymentIntegrationService {
  private readonly stripe: Stripe;
  private readonly logger = new Logger(PaymentIntegrationService.name);

  constructor() {
    this.stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
      apiVersion: '2023-10-16',
    });
  }

  async createTicketSession(sessionId: string, ticketOptions: any) {
    const session = await prisma.liveSession.findUnique({
      where: { id: sessionId },
    });

    if (!session) {
      throw new Error('Session not found');
    }

    // Create Stripe product for the session
    const product = await this.stripe.products.create({
      name: session.title,
      description: session.description || '',
      metadata: {
        sessionId,
        type: 'live_session',
      },
    });

    // Create price for the ticket
    const price = await this.stripe.prices.create({
      product: product.id,
      unit_amount: Math.round(ticketOptions.price * 100), // Convert to cents
      currency: ticketOptions.currency || 'usd',
      metadata: {
        sessionId,
        ticketType: ticketOptions.type || 'general',
      },
    });

    // Save ticket configuration
    const ticket = await prisma.sessionTicket.create({
      data: {
        sessionId,
        stripeProductId: product.id,
        stripePriceId: price.id,
        ticketType: ticketOptions.type || 'general',
        price: ticketOptions.price,
        currency: ticketOptions.currency || 'usd',
        quantityAvailable: ticketOptions.quantity || session.maxParticipants,
        quantitySold: 0,
        isActive: true,
        metadata: {
          ...ticketOptions,
          createdAt: new Date().toISOString(),
        },
      },
    });

    return {
      ticketId: ticket.id,
      stripeProductId: product.id,
      stripePriceId: price.id,
      checkoutUrl: await this.generateCheckoutUrl(session, ticket, ticketOptions),
    };
  }

  async createSubscriptionPlan(planData: any, instructorId: string) {
    // Create subscription product
    const product = await this.stripe.products.create({
      name: planData.name,
      description: planData.description,
      metadata: {
        type: 'subscription',
        instructorId,
        features: JSON.stringify(planData.features),
      },
    });

    // Create recurring price
    const price = await this.stripe.prices.create({
      product: product.id,
      unit_amount: Math.round(planData.price * 100),
      currency: planData.currency || 'usd',
      recurring: {
        interval: planData.interval || 'month',
        interval_count: planData.intervalCount || 1,
      },
      metadata: {
        planType: planData.type || 'premium',
        maxSessions: planData.maxSessions || 10,
      },
    });

    // Save subscription plan
    const subscriptionPlan = await prisma.subscriptionPlan.create({
      data: {
        instructorId,
        stripeProductId: product.id,
        stripePriceId: price.id,
        name: planData.name,
        description: planData.description,
        price: planData.price,
        currency: planData.currency || 'usd',
        interval: planData.interval || 'month',
        intervalCount: planData.intervalCount || 1,
        features: planData.features || [],
        maxSessions: planData.maxSessions || 10,
        isActive: true,
      },
    });

    return subscriptionPlan;
  }

  async purchaseTicket(sessionId: string, userId: string, ticketType: string = 'general') {
    const ticket = await prisma.sessionTicket.findFirst({
      where: {
        sessionId,
        ticketType,
        isActive: true,
      },
    });

    if (!ticket) {
      throw new Error('Ticket not available');
    }

    if (ticket.quantitySold >= ticket.quantityAvailable) {
      throw new Error('Ticket sold out');
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new Error('User not found');
    }

    // Create Stripe checkout session
    const checkoutSession = await this.stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [
        {
          price: ticket.stripePriceId,
          quantity: 1,
        },
      ],
      mode: 'payment',
      success_url: `${process.env.FRONTEND_URL}/booking/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.FRONTEND_URL}/booking/cancel`,
      client_reference_id: userId,
      metadata: {
        sessionId,
        ticketId: ticket.id,
        ticketType,
        userId,
      },
      customer_email: user.email,
    });

    // Create pending purchase record
    const purchase = await prisma.ticketPurchase.create({
      data: {
        ticketId: ticket.id,
        userId,
        stripeSessionId: checkoutSession.id,
        status: 'PENDING',
        amount: ticket.price,
        currency: ticket.currency,
        metadata: {
          checkoutUrl: checkoutSession.url,
          expiresAt: new Date(checkoutSession.expires_at * 1000),
        },
      },
    });

    return {
      purchaseId: purchase.id,
      checkoutUrl: checkoutSession.url,
      expiresAt: new Date(checkoutSession.expires_at * 1000),
    };
  }

  async subscribeToPlan(planId: string, userId: string) {
    const plan = await prisma.subscriptionPlan.findUnique({
      where: { id: planId },
    });

    if (!plan || !plan.isActive) {
      throw new Error('Subscription plan not available');
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new Error('User not found');
    }

    // Check for existing subscription
    const existingSubscription = await prisma.userSubscription.findFirst({
      where: {
        userId,
        status: { in: ['ACTIVE', 'TRIALING'] },
      },
    });

    if (existingSubscription) {
      throw new Error('User already has an active subscription');
    }

    // Create Stripe checkout for subscription
    const checkoutSession = await this.stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [
        {
          price: plan.stripePriceId,
          quantity: 1,
        },
      ],
      mode: 'subscription',
      success_url: `${process.env.FRONTEND_URL}/subscription/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.FRONTEND_URL}/subscription/cancel`,
      client_reference_id: userId,
      metadata: {
        planId,
        userId,
        instructorId: plan.instructorId,
      },
      customer_email: user.email,
      subscription_data: {
        metadata: {
          userId,
          planId,
        },
      },
    });

    // Create pending subscription
    const subscription = await prisma.userSubscription.create({
      data: {
        userId,
        planId,
        stripeSessionId: checkoutSession.id,
        status: 'PENDING',
        amount: plan.price,
        currency: plan.currency,
        interval: plan.interval,
        features: plan.features,
        metadata: {
          checkoutUrl: checkoutSession.url,
          expiresAt: new Date(checkoutSession.expires_at * 1000),
        },
      },
    });

    return {
      subscriptionId: subscription.id,
      checkoutUrl: checkoutSession.url,
      expiresAt: new Date(checkoutSession.expires_at * 1000),
    };
  }

  async handleWebhook(payload: any, signature: string) {
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

    try {
      const event = this.stripe.webhooks.constructEvent(
        payload,
        signature,
        webhookSecret
      );

      switch (event.type) {
        case 'checkout.session.completed':
          await this.handleCheckoutSessionCompleted(event.data.object);
          break;
        
        case 'checkout.session.expired':
          await this.handleCheckoutSessionExpired(event.data.object);
          break;
        
        case 'customer.subscription.created':
          await this.handleSubscriptionCreated(event.data.object);
          break;
        
        case 'customer.subscription.updated':
          await this.handleSubscriptionUpdated(event.data.object);
          break;
        
        case 'customer.subscription.deleted':
          await this.handleSubscriptionDeleted(event.data.object);
          break;
        
        case 'invoice.payment_succeeded':
          await this.handleInvoicePaymentSucceeded(event.data.object);
          break;
        
        case 'invoice.payment_failed':
          await this.handleInvoicePaymentFailed(event.data.object);
          break;
      }

      return { success: true };
    } catch (error) {
      this.logger.error('Webhook error:', error);
      throw error;
    }
  }

  private async handleCheckoutSessionCompleted(session: any) {
    const metadata = session.metadata;

    if (metadata.ticketId) {
      // Ticket purchase completed
      await this.completeTicketPurchase(session.id, metadata);
    } else if (metadata.planId) {
      // Subscription checkout completed
      await this.completeSubscriptionCheckout(session.id, metadata);
    }
  }

  private async completeTicketPurchase(sessionId: string, metadata: any) {
    const purchase = await prisma.ticketPurchase.findFirst({
      where: {
        stripeSessionId: sessionId,
        status: 'PENDING',
      },
      include: {
        ticket: true,
      },
    });

    if (!purchase) {
      throw new Error('Purchase not found');
    }

    // Update purchase status
    await prisma.ticketPurchase.update({
      where: { id: purchase.id },
      data: {
        status: 'COMPLETED',
        completedAt: new Date(),
        stripePaymentIntentId: metadata.payment_intent,
      },
    });

    // Update ticket sold count
    await prisma.sessionTicket.update({
      where: { id: purchase.ticketId },
      data: {
        quantitySold: { increment: 1 },
      },
    });

    // Create session access for user
    await prisma.liveSessionParticipant.create({
      data: {
        sessionId: purchase.ticket.sessionId,
        userId: purchase.userId,
        status: 'REGISTERED',
        role: 'ATTENDEE',
        permissions: {
          accessGranted: true,
          accessType: 'PAID',
          purchaseId: purchase.id,
        },
      },
    });

    // Send confirmation email
    await this.sendTicketConfirmation(purchase.userId, purchase.ticket.sessionId, purchase.id);
  }

  private async completeSubscriptionCheckout(sessionId: string, metadata: any) {
    const subscription = await prisma.userSubscription.findFirst({
      where: {
        stripeSessionId: sessionId,
        status: 'PENDING',
      },
      include: {
        plan: true,
      },
    });

    if (!subscription) {
      throw new Error('Subscription not found');
    }

    // Get Stripe subscription
    const stripeSubscription = await this.stripe.subscriptions.retrieve(
      metadata.subscription
    );

    // Update subscription record
    await prisma.userSubscription.update({
      where: { id: subscription.id },
      data: {
        status: 'ACTIVE',
        stripeSubscriptionId: stripeSubscription.id,
        currentPeriodStart: new Date(stripeSubscription.current_period_start * 1000),
        currentPeriodEnd: new Date(stripeSubscription.current_period_end * 1000),
        activatedAt: new Date(),
      },
    });

    // Send welcome email
    await this.sendSubscriptionWelcome(subscription.userId, subscription.planId);
  }

  async generateCheckoutUrl(session: any, ticket: any, options: any): Promise<string> {
    const baseUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    const token = crypto.randomBytes(16).toString('hex');
    
    // Store temporary checkout token
    await prisma.checkoutToken.create({
      data: {
        token,
        sessionId: session.id,
        ticketId: ticket.id,
        expiresAt: new Date(Date.now() + 30 * 60000), // 30 minutes
        metadata: options,
      },
    });

    return `${baseUrl}/checkout/${token}`;
  }

  async validateAccess(sessionId: string, userId: string): Promise<boolean> {
    const session = await prisma.liveSession.findUnique({
      where: { id: sessionId },
    });

    if (!session) {
      return false;
    }

    // Check if session is free
    if (session.isFree || session.price === 0) {
      return true;
    }

    // Check if user has paid access
    const participant = await prisma.liveSessionParticipant.findFirst({
      where: {
        sessionId,
        userId,
        status: { in: ['REGISTERED', 'JOINED'] },
      },
    });

    if (participant) {
      return true;
    }

    // Check if user has subscription access
    const subscription = await prisma.userSubscription.findFirst({
      where: {
        userId,
        status: 'ACTIVE',
        plan: {
          instructorId: session.instructorId,
        },
      },
    });

    if (subscription) {
      return true;
    }

    return false;
  }

  async getRevenueReport(instructorId: string, startDate: string, endDate: string) {
    const sessions = await prisma.liveSession.findMany({
      where: {
        instructorId,
        startTime: {
          gte: new Date(startDate),
          lte: new Date(endDate),
        },
        price: { gt: 0 },
      },
      include: {
        participants: true,
        tickets: {
          include: {
            purchases: {
              where: {
                status: 'COMPLETED',
                completedAt: {
                  gte: new Date(startDate),
                  lte: new Date(endDate),
                },
              },
            },
          },
        },
      },
    });

    const ticketRevenue = sessions.reduce((total, session) => {
      return total + session.tickets.reduce((ticketTotal, ticket) => {
        return ticketTotal + ticket.purchases.reduce((purchaseTotal, purchase) => {
          return purchaseTotal + purchase.amount;
        }, 0);
      }, 0);
    }, 0);

    const subscriptionRevenue = await this.getSubscriptionRevenue(instructorId, startDate, endDate);

    return {
      totalRevenue: ticketRevenue + subscriptionRevenue,
      ticketRevenue,
      subscriptionRevenue,
      sessions: sessions.map(session => ({
        id: session.id,
        title: session.title,
        date: session.startTime,
        participants: session.participants.length,
        ticketSales: session.tickets.reduce((total, ticket) => total + ticket.purchases.length, 0),
        revenue: session.tickets.reduce((total, ticket) => {
          return total + ticket.purchases.reduce((sum, purchase) => sum + purchase.amount, 0);
        }, 0),
      })),
    };
  }

  private async getSubscriptionRevenue(instructorId: string, startDate: string, endDate: string) {
    const subscriptions = await prisma.userSubscription.findMany({
      where: {
        plan: {
          instructorId,
        },
        status: 'ACTIVE',
        activatedAt: {
          gte: new Date(startDate),
          lte: new Date(endDate),
        },
      },
      include: {
        plan: true,
      },
    });

    return subscriptions.reduce((total, subscription) => {
      return total + subscription.amount;
    }, 0);
  }

  private async sendTicketConfirmation(userId: string, sessionId: string, purchaseId: string) {
    // Implementation would use your notification service
    console.log(`Sending ticket confirmation to user ${userId} for session ${sessionId}`);
  }

  private async sendSubscriptionWelcome(userId: string, planId: string) {
    // Implementation would use your notification service
    console.log(`Sending subscription welcome to user ${userId} for plan ${planId}`);
  }

  // Other webhook handlers
  private async handleCheckoutSessionExpired(session: any) {
    const metadata = session.metadata;
    
    if (metadata.ticketId) {
      await prisma.ticketPurchase.updateMany({
        where: {
          stripeSessionId: session.id,
          status: 'PENDING',
        },
        data: {
          status: 'EXPIRED',
        },
      });
    } else if (metadata.planId) {
      await prisma.userSubscription.updateMany({
        where: {
          stripeSessionId: session.id,
          status: 'PENDING',
        },
        data: {
          status: 'EXPIRED',
        },
      });
    }
  }

  private async handleSubscriptionCreated(subscription: any) {
    // Handle subscription creation
  }

  private async handleSubscriptionUpdated(subscription: any) {
    // Handle subscription updates
  }

  private async handleSubscriptionDeleted(subscription: any) {
    // Handle subscription cancellation
  }

  private async handleInvoicePaymentSucceeded(invoice: any) {
    // Handle successful invoice payment
  }

  private async handleInvoicePaymentFailed(invoice: any) {
    // Handle failed invoice payment
  }
}