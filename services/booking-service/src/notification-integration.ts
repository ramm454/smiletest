import { Injectable } from '@nestjs/common';
import { ClientProxy, ClientProxyFactory, Transport } from '@nestjs/microservices';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class BookingNotificationService {
  private notificationClient: ClientProxy;

  constructor(private configService: ConfigService) {
    this.notificationClient = ClientProxyFactory.create({
      transport: Transport.RMQ,
      options: {
        urls: [this.configService.get('RABBITMQ_URL')],
        queue: 'notifications',
        queueOptions: {
          durable: true,
        },
      },
    });
  }

  async sendBookingConfirmation(booking: any) {
    const notification = {
      type: 'booking_confirmation',
      userId: booking.userId,
      channel: 'email',
      template: 'booking_confirmation',
      data: {
        bookingId: booking.id,
        className: booking.yogaClass?.title || booking.liveSession?.title,
        date: new Date(booking.startTime).toLocaleDateString(),
        time: new Date(booking.startTime).toLocaleTimeString(),
        instructor: booking.yogaClass?.instructor?.firstName + ' ' + 
                   booking.yogaClass?.instructor?.lastName,
        location: booking.yogaClass?.location || 'Online',
        participants: booking.participants,
        totalAmount: booking.totalAmount,
        paymentStatus: booking.paymentStatus,
      },
      email: booking.user?.email,
      phone: booking.user?.phone,
      metadata: {
        service: 'booking-service',
        event: 'booking_created',
        timestamp: new Date().toISOString(),
      },
      gdpr: {
        consentRequired: true,
        category: 'transactional',
        retentionPeriod: '3 years',
      }
    };

    await this.notificationClient.emit('notification.created', notification).toPromise();
    
    // Also send calendar invitation
    if (booking.user?.email) {
      await this.sendCalendarInvitation(booking);
    }
  }

  async sendCancellationNotification(booking: any, refundAmount: number) {
    const notification = {
      type: 'booking_cancellation',
      userId: booking.userId,
      channel: 'email',
      template: 'booking_cancellation',
      data: {
        bookingId: booking.id,
        className: booking.yogaClass?.title || booking.liveSession?.title,
        date: new Date(booking.startTime).toLocaleDateString(),
        time: new Date(booking.startTime).toLocaleTimeString(),
        refundAmount: refundAmount,
        cancellationReason: booking.cancellationReason,
        cancellationPolicy: 'Full refund if cancelled 24+ hours before',
      },
      email: booking.user?.email,
      phone: booking.user?.phone,
      metadata: {
        service: 'booking-service',
        event: 'booking_cancelled',
        timestamp: new Date().toISOString(),
      }
    };

    await this.notificationClient.emit('notification.created', notification).toPromise();
  }

  async sendReminderNotification(booking: any, hoursBefore: number) {
    const notification = {
      type: 'booking_reminder',
      userId: booking.userId,
      channel: ['email', 'push'], // Multiple channels
      template: 'booking_reminder',
      data: {
        bookingId: booking.id,
        className: booking.yogaClass?.title || booking.liveSession?.title,
        date: new Date(booking.startTime).toLocaleDateString(),
        time: new Date(booking.startTime).toLocaleTimeString(),
        hoursBefore: hoursBefore,
        location: booking.yogaClass?.location || 'Online',
        instructor: booking.yogaClass?.instructor?.firstName + ' ' + 
                   booking.yogaClass?.instructor?.lastName,
        preparationTips: ['Arrive 15 minutes early', 'Bring water bottle', 'Wear comfortable clothes'],
      },
      email: booking.user?.email,
      metadata: {
        service: 'booking-service',
        event: 'booking_reminder',
        reminderType: `${hoursBefore}h_before`,
        timestamp: new Date().toISOString(),
      }
    };

    await this.notificationClient.emit('notification.created', notification).toPromise();
  }

  async sendCheckInConfirmation(booking: any) {
    const notification = {
      type: 'checkin_confirmation',
      userId: booking.userId,
      channel: 'in_app',
      template: 'checkin_confirmation',
      data: {
        bookingId: booking.id,
        className: booking.yogaClass?.title || booking.liveSession?.title,
        checkinTime: new Date().toLocaleTimeString(),
        nextSteps: ['Find your spot in the studio', 'Prepare your mat', 'Connect with instructor'],
      },
      metadata: {
        service: 'booking-service',
        event: 'checked_in',
        timestamp: new Date().toISOString(),
      }
    };

    await this.notificationClient.emit('notification.created', notification).toPromise();
  }

  private async sendCalendarInvitation(booking: any) {
    const icalEvent = `
BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//YogaSpa//Booking System//EN
BEGIN:VEVENT
UID:${booking.id}@yogaspa.com
DTSTAMP:${new Date().toISOString().replace(/[-:]/g, '').split('.')[0]}Z
DTSTART:${new Date(booking.startTime).toISOString().replace(/[-:]/g, '').split('.')[0]}Z
DTEND:${new Date(booking.endTime).toISOString().replace(/[-:]/g, '').split('.')[0]}Z
SUMMARY:${booking.yogaClass?.title || 'Yoga Class'}
DESCRIPTION:${booking.yogaClass?.description || ''}
LOCATION:${booking.yogaClass?.location || 'Online'}
END:VEVENT
END:VCALENDAR
    `.trim();

    const notification = {
      type: 'calendar_invite',
      userId: booking.userId,
      channel: 'email',
      template: 'calendar_invite',
      data: {
        bookingId: booking.id,
        className: booking.yogaClass?.title || booking.liveSession?.title,
        calendarContent: icalEvent,
      },
      email: booking.user?.email,
      metadata: {
        service: 'booking-service',
        event: 'calendar_invite_sent',
        timestamp: new Date().toISOString(),
      }
    };

    await this.notificationClient.emit('notification.created', notification).toPromise();
  }
}