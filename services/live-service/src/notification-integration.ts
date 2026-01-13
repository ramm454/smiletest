import { Injectable } from '@nestjs/common';
import { ClientProxy, ClientProxyFactory, Transport } from '@nestjs/microservices';

@Injectable()
export class LiveNotificationService {
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

  async sendLiveSessionReminder(session: any, participants: any[], minutesBefore: number) {
    for (const participant of participants) {
      const notification = {
        type: 'live_session_reminder',
        userId: participant.userId,
        channel: ['push', 'email'],
        template: 'live_session_reminder',
        data: {
          sessionTitle: session.title,
          startTime: new Date(session.startTime).toLocaleTimeString(),
          minutesUntilStart: minutesBefore,
          joinLink: `${process.env.FRONTEND_URL}/live/${session.id}`,
          streamKey: session.accessType === 'PRIVATE' ? session.streamKey : null,
          requirements: ['Stable internet connection', 'Webcam (optional)', 'Headphones'],
          instructor: session.instructor?.firstName + ' ' + session.instructor?.lastName,
        },
        email: participant.user?.email,
        metadata: {
          service: 'live-service',
          event: 'live_session_reminder',
          minutesBefore: minutesBefore,
          timestamp: new Date().toISOString(),
        }
      };

      await this.notificationClient.emit('notification.created', notification).toPromise();
    }
  }

  async sendRecordingAvailable(session: any, recording: any, participants: any[]) {
    for (const participant of participants) {
      const notification = {
        type: 'recording_available',
        userId: participant.userId,
        channel: 'email',
        template: 'recording_available',
        data: {
          sessionTitle: session.title,
          recordingDate: new Date(session.startTime).toLocaleDateString(),
          recordingDuration: `${Math.floor(recording.duration / 60)} minutes`,
          watchLink: `${process.env.FRONTEND_URL}/recordings/${recording.id}`,
          downloadAvailable: recording.downloadEnabled,
          expiresIn: '30 days',
          instructor: session.instructor?.firstName + ' ' + session.instructor?.lastName,
        },
        email: participant.user?.email,
        metadata: {
          service: 'live-service',
          event: 'recording_available',
          timestamp: new Date().toISOString(),
        }
      };

      await this.notificationClient.emit('notification.created', notification).toPromise();
    }
  }

  async sendLiveNowNotification(session: any, followers: any[]) {
    for (const follower of followers) {
      const notification = {
        type: 'live_now',
        userId: follower.id,
        channel: ['push', 'sms'], // Urgent notification
        template: 'live_now',
        data: {
          sessionTitle: session.title,
          instructor: session.instructor?.firstName + ' ' + session.instructor?.lastName,
          currentViewers: session.currentParticipants,
          joinLink: `${process.env.FRONTEND_URL}/live/${session.id}`,
          duration: `${session.duration} minutes`,
          topic: session.description?.substring(0, 100) + '...',
        },
        email: follower.email,
        phone: follower.phone,
        metadata: {
          service: 'live-service',
          event: 'live_session_started',
          urgency: 'high',
          timestamp: new Date().toISOString(),
        }
      };

      await this.notificationClient.emit('notification.created', notification).toPromise();
    }
  }

  async sendQnANotification(session: any, question: any, instructor: any) {
    const notification = {
      type: 'qna_answer',
      userId: question.userId,
      channel: 'in_app',
      template: 'qna_answer',
      data: {
        sessionTitle: session.title,
        question: question.text.substring(0, 100) + '...',
        answer: question.answer,
        answeredBy: instructor.firstName + ' ' + instructor.lastName,
        answerTime: new Date().toLocaleTimeString(),
        viewDiscussionLink: `${process.env.FRONTEND_URL}/live/${session.id}/qna`,
      },
      metadata: {
        service: 'live-service',
        event: 'qna_answered',
        timestamp: new Date().toISOString(),
      }
    };

    await this.notificationClient.emit('notification.created', notification).toPromise();
  }
}