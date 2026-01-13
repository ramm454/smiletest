import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import Stripe from 'stripe';

const prisma = new PrismaClient();

@Injectable()
export class PaymentService {
  private stripe: Stripe;

  constructor() {
    this.stripe = new Stripe(process.env.STRIPE_SECRET_KEY || 'your-stripe-secret-key', {
      apiVersion: '2023-10-16',
    });
  }

  async createPaymentIntent(orderId: string, amount: number, currency: string = 'usd') {
    try {
      // Get order details
      const order = await prisma.order.findUnique({
        where: { id: orderId },
        include: { items: true }
      });

      if (!order) {
        throw new BadRequestException('Order not found');
      }

      // Create payment intent with Stripe
      const paymentIntent = await this.stripe.paymentIntents.create({
        amount: Math.round(amount * 100), // Convert to cents
        currency,
        metadata: {
          orderId,
          userId: order.userId || 'guest',
        },
        description: `Payment for order ${order.orderNumber}`,
      });

      // Create payment record in database
      const payment = await prisma.payment.create({
        data: {
          orderId,
          amount,
          currency,
          paymentMethod: 'card',
          paymentGateway: 'stripe',
          paymentIntentId: paymentIntent.id,
          clientSecret: paymentIntent.client_secret,
          status: 'PENDING',
        },
      });

      return {
        paymentId: payment.id,
        clientSecret: paymentIntent.client_secret,
        amount,
        currency,
      };
    } catch (error) {
      throw new BadRequestException(`Payment creation failed: ${error.message}`);
    }
  }

  async confirmPayment(paymentIntentId: string) {
    try {
      // Retrieve payment intent
      const paymentIntent = await this.stripe.paymentIntents.retrieve(paymentIntentId);

      if (paymentIntent.status === 'succeeded') {
        // Update payment status
        await prisma.payment.update({
          where: { paymentIntentId },
          data: {
            status: 'COMPLETED',
            transactionId: paymentIntent.charges.data[0]?.id,
            paidAt: new Date(),
          },
        });

        // Update order status
        const payment = await prisma.payment.findUnique({
          where: { paymentIntentId },
        });

        if (payment) {
          await prisma.order.update({
            where: { id: payment.orderId },
            data: {
              paymentStatus: 'COMPLETED',
              status: 'CONFIRMED',
              paidAt: new Date(),
            },
          });
        }

        return { success: true, message: 'Payment confirmed successfully' };
      }

      return { success: false, message: 'Payment not yet completed' };
    } catch (error) {
      throw new BadRequestException(`Payment confirmation failed: ${error.message}`);
    }
  }

  async createRefund(paymentIntentId: string, amount?: number) {
    try {
      const payment = await prisma.payment.findUnique({
        where: { paymentIntentId },
        include: { order: true },
      });

      if (!payment) {
        throw new BadRequestException('Payment not found');
      }

      // Create refund in Stripe
      const refundAmount = amount ? Math.round(amount * 100) : undefined;
      const refund = await this.stripe.refunds.create({
        payment_intent: paymentIntentId,
        amount: refundAmount,
      });

      // Create refund record
      await prisma.refund.create({
        data: {
          orderId: payment.orderId,
          paymentId: payment.id,
          amount: refundAmount ? refundAmount / 100 : payment.amount,
          currency: payment.currency,
          refundId: refund.id,
          reason: 'Customer request',
          status: 'PROCESSED',
        },
      });

      // Update order status
      await prisma.order.update({
        where: { id: payment.orderId },
        data: {
          paymentStatus: amount === payment.amount ? 'REFUNDED' : 'PARTIALLY_REFUNDED',
        },
      });

      return { success: true, refundId: refund.id };
    } catch (error) {
      throw new BadRequestException(`Refund failed: ${error.message}`);
    }
  }

  async getPaymentMethods(customerId?: string) {
    if (!customerId) {
      return [];
    }

    try {
      const paymentMethods = await this.stripe.paymentMethods.list({
        customer: customerId,
        type: 'card',
      });

      return paymentMethods.data.map(method => ({
        id: method.id,
        type: method.type,
        card: {
          brand: method.card?.brand,
          last4: method.card?.last4,
          expMonth: method.card?.exp_month,
          expYear: method.card?.exp_year,
        },
      }));
    } catch (error) {
      return [];
    }
  }
}