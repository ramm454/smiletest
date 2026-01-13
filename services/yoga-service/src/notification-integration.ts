import { Injectable } from '@nestjs/common';
import { ClientProxy, ClientProxyFactory, Transport } from '@nestjs/microservices';

@Injectable()
export class YogaNotificationService {
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

  async sendClassCancellation(yogaClass: any, bookedUsers: any[], reason?: string) {
    for (const user of bookedUsers) {
      const notification = {
        type: 'class_cancellation',
        userId: user.id,
        channel: ['email', 'sms', 'push'],
        template: 'class_cancellation',
        data: {
          className: yogaClass.title,
          date: new Date(yogaClass.startTime).toLocaleDateString(),
          time: new Date(yogaClass.startTime).toLocaleTimeString(),
          reason: reason || 'Unforeseen circumstances',
          alternatives: await this.findAlternativeClasses(yogaClass),
          refundStatus: 'automatic',
        },
        email: user.email,
        phone: user.phone,
        metadata: {
          service: 'yoga-service',
          event: 'class_cancelled',
          timestamp: new Date().toISOString(),
        }
      };

      await this.notificationClient.emit('notification.created', notification).toPromise();
    }
  }

  async sendWaitlistPromotion(yogaClass: any, user: any) {
    const notification = {
      type: 'waitlist_promoted',
      userId: user.id,
      channel: ['sms', 'push'], // Urgent notification
      template: 'waitlist_promoted',
      data: {
        className: yogaClass.title,
        date: new Date(yogaClass.startTime).toLocaleDateString(),
        time: new Date(yogaClass.startTime).toLocaleTimeString(),
        spotAvailable: true,
        bookingDeadline: '1 hour',
        directBookingLink: `${process.env.FRONTEND_URL}/booking/${yogaClass.id}`,
      },
      email: user.email,
      phone: user.phone,
      metadata: {
        service: 'yoga-service',
        event: 'waitlist_promoted',
        urgency: 'high',
        timestamp: new Date().toISOString(),
      }
    };

    await this.notificationClient.emit('notification.created', notification).toPromise();
  }

  async sendInstructorChange(yogaClass: any, oldInstructor: any, newInstructor: any, bookedUsers: any[]) {
    for (const user of bookedUsers) {
      const notification = {
        type: 'instructor_change',
        userId: user.id,
        channel: 'email',
        template: 'instructor_change',
        data: {
          className: yogaClass.title,
          date: new Date(yogaClass.startTime).toLocaleDateString(),
          time: new Date(yogaClass.startTime).toLocaleTimeString(),
          oldInstructor: `${oldInstructor.firstName} ${oldInstructor.lastName}`,
          newInstructor: `${newInstructor.firstName} ${newInstructor.lastName}`,
          newInstructorBio: newInstructor.bio,
          cancellationOption: true,
          cancellationDeadline: '24 hours before class',
        },
        email: user.email,
        metadata: {
          service: 'yoga-service',
          event: 'instructor_changed',
          timestamp: new Date().toISOString(),
        }
      };

      await this.notificationClient.emit('notification.created', notification).toPromise();
    }
  }

  async sendClassReviewRequest(yogaClass: any, user: any) {
    const notification = {
      type: 'review_request',
      userId: user.id,
      channel: 'email',
      template: 'review_request',
      data: {
        className: yogaClass.title,
        instructor: `${yogaClass.instructor.firstName} ${yogaClass.instructor.lastName}`,
        reviewLink: `${process.env.FRONTEND_URL}/review/${yogaClass.id}`,
        expiresIn: '7 days',
        incentive: '10% off next booking',
      },
      email: user.email,
      metadata: {
        service: 'yoga-service',
        event: 'review_requested',
        timestamp: new Date().toISOString(),
      }
    };

    await this.notificationClient.emit('notification.created', notification).toPromise();
  }

  private async findAlternativeClasses(yogaClass: any) {
    // Logic to find similar classes
    return [
      {
        id: 'alt-1',
        title: 'Similar Vinyasa Flow',
        time: 'Same time tomorrow',
        instructor: 'Another instructor',
        link: `${process.env.FRONTEND_URL}/classes/alt-1`,
      }
    ];
  }
}