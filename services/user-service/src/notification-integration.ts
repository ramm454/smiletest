import { Injectable } from '@nestjs/common';
import { ClientProxy, ClientProxyFactory, Transport } from '@nestjs/microservices';

@Injectable()
export class UserNotificationService {
  private notificationClient: ClientProxy;

  constructor() {
    this.notificationClient = ClientProxyFactory.create({
      transport: Transport.RMQ,
      options: {
        urls: [process.env.RABBITMQ_URL || 'amqp://localhost:5672'],
        queue: 'notifications',
        queueOptions: {
          durable: true,
        },
      },
    });
  }

  async sendWelcomeEmail(user: any, verificationToken?: string) {
    const notification = {
      type: 'welcome_email',
      userId: user.id,
      channel: 'email',
      template: 'welcome_email',
      data: {
        firstName: user.firstName,
        email: user.email,
        verificationLink: verificationToken ? 
          `${process.env.FRONTEND_URL}/verify-email?token=${verificationToken}` : null,
        getStartedLink: `${process.env.FRONTEND_URL}/onboarding`,
        features: [
          'Book yoga classes',
          'Join live sessions',
          'Shop yoga equipment',
          'Track your progress',
        ],
        supportEmail: 'support@yogaspa.com',
      },
      email: user.email,
      metadata: {
        service: 'user-service',
        event: 'user_registered',
        timestamp: new Date().toISOString(),
      }
    };

    await this.notificationClient.emit('notification.created', notification).toPromise();
  }

  async sendPasswordReset(user: any, resetToken: string) {
    const notification = {
      type: 'password_reset',
      userId: user.id,
      channel: 'email',
      template: 'password_reset',
      data: {
        firstName: user.firstName,
        resetLink: `${process.env.FRONTEND_URL}/reset-password?token=${resetToken}`,
        expiresIn: '1 hour',
        ipAddress: this.getClientIp(),
        ifNotYouLink: `${process.env.FRONTEND_URL}/security`,
      },
      email: user.email,
      metadata: {
        service: 'user-service',
        event: 'password_reset_requested',
        timestamp: new Date().toISOString(),
      }
    };

    await this.notificationClient.emit('notification.created', notification).toPromise();
  }

  async sendSecurityAlert(user: any, event: string, metadata: any) {
    const notification = {
      type: 'security_alert',
      userId: user.id,
      channel: ['email', 'sms'], // Important security alerts
      template: 'security_alert',
      data: {
        event: event,
        time: new Date().toLocaleString(),
        device: metadata.device || 'Unknown device',
        location: metadata.location || 'Unknown location',
        ipAddress: metadata.ipAddress,
        reviewActivityLink: `${process.env.FRONTEND_URL}/security`,
        contactSupport: 'immediately if suspicious',
        alertLevel: 'high',
      },
      email: user.email,
      phone: user.phone,
      metadata: {
        service: 'user-service',
        event: 'security_alert',
        alertType: event,
        timestamp: new Date().toISOString(),
      }
    };

    await this.notificationClient.emit('notification.created', notification).toPromise();
  }

  async sendSubscriptionUpdate(user: any, subscription: any, changeType: string) {
    const notification = {
      type: 'subscription_update',
      userId: user.id,
      channel: 'email',
      template: 'subscription_update',
      data: {
        changeType: changeType,
        planName: subscription.planName,
        oldPlan: changeType === 'upgraded' ? subscription.oldPlan : null,
        newPlan: subscription.newPlan || subscription.planName,
        priceChange: subscription.priceChange,
        effectiveDate: new Date(subscription.effectiveDate).toLocaleDateString(),
        nextBillingDate: subscription.nextBillingDate,
        features: subscription.features,
        manageSubscriptionLink: `${process.env.FRONTEND_URL}/subscription`,
      },
      email: user.email,
      metadata: {
        service: 'user-service',
        event: 'subscription_updated',
        changeType: changeType,
        timestamp: new Date().toISOString(),
      }
    };

    await this.notificationClient.emit('notification.created', notification).toPromise();
  }

  private getClientIp(): string {
    // Implementation depends on your framework
    return '127.0.0.1';
  }
}