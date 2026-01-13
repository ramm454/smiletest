import { Injectable } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import * as admin from 'firebase-admin';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();

@Injectable()
export class MobileService {
  private firebaseAdmin: admin.app.App;

  constructor() {
    // Initialize Firebase Admin for push notifications
    if (!admin.apps.length) {
      this.firebaseAdmin = admin.initializeApp({
        credential: admin.credential.cert({
          projectId: process.env.FIREBASE_PROJECT_ID,
          clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
          privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
        }),
      });
    } else {
      this.firebaseAdmin = admin.app();
    }
  }

  async getUpcomingSessions(page: number = 1, limit: number = 20, userId?: string) {
    const skip = (page - 1) * limit;
    const now = new Date();

    const where: any = {
      startTime: { gt: now },
      status: { in: ['SCHEDULED', 'LIVE'] },
    };

    // If user is logged in, prioritize their subscribed instructors
    if (userId) {
      const userSubscriptions = await prisma.userSubscription.findMany({
        where: {
          userId,
          status: 'ACTIVE',
        },
        select: { plan: { select: { instructorId: true } } },
      });

      const instructorIds = userSubscriptions.map(sub => sub.plan.instructorId);
      if (instructorIds.length > 0) {
        where.OR = [
          { instructorId: { in: instructorIds } },
          { accessType: 'PUBLIC' },
        ];
      }
    }

    const [sessions, total] = await Promise.all([
      prisma.liveSession.findMany({
        where,
        include: {
          instructor: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              avatar: true,
            },
          },
          _count: {
            select: {
              participants: true,
            },
          },
        },
        orderBy: { startTime: 'asc' },
        skip,
        take: limit,
      }),
      prisma.liveSession.count({ where }),
    ]);

    // Format for mobile
    const formattedSessions = sessions.map(session => ({
      id: session.id,
      title: session.title,
      description: session.description,
      instructor: session.instructor,
      startTime: session.startTime,
      duration: session.duration,
      type: session.type,
      category: session.category,
      price: session.price,
      isFree: session.isFree,
      thumbnail: session.thumbnail,
      participants: session._count.participants,
      maxParticipants: session.maxParticipants,
      isFull: session._count.participants >= session.maxParticipants,
      accessType: session.accessType,
      canJoin: this.canUserJoin(session, userId),
    }));

    return {
      sessions: formattedSessions,
      pagination: {
        total,
        page,
        limit,
        pages: Math.ceil(total / limit),
      },
    };
  }

  async getLiveSessions(page: number = 1, limit: number = 20) {
    const skip = (page - 1) * limit;
    const now = new Date();

    const [sessions, total] = await Promise.all([
      prisma.liveSession.findMany({
        where: {
          status: 'LIVE',
          startTime: { lte: now },
          OR: [
            { endTime: null },
            { endTime: { gt: now } },
          ],
        },
        include: {
          instructor: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              avatar: true,
            },
          },
          _count: {
            select: {
              participants: true,
            },
          },
        },
        orderBy: { startTime: 'desc' },
        skip,
        take: limit,
      }),
      prisma.liveSession.count({
        where: {
          status: 'LIVE',
          startTime: { lte: now },
        },
      }),
    ]);

    return {
      sessions: sessions.map(session => ({
        id: session.id,
        title: session.title,
        instructor: session.instructor,
        thumbnail: session.thumbnail,
        participants: session._count.participants,
        streamUrl: session.streamUrl,
        startedAt: session.startedAt,
        isRecording: session.isRecording,
      })),
      pagination: {
        total,
        page,
        limit,
        pages: Math.ceil(total / limit),
      },
    };
  }

  async getSessionForMobile(sessionId: string, userId?: string) {
    const session = await prisma.liveSession.findUnique({
      where: { id: sessionId },
      include: {
        instructor: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            avatar: true,
            bio: true,
          },
        },
        participants: {
          where: userId ? { userId } : undefined,
          take: 1,
        },
        recordings: {
          where: {
            status: 'COMPLETED',
            isPublic: true,
          },
          take: 5,
        },
        _count: {
          select: {
            participants: true,
          },
        },
      },
    });

    if (!session) {
      throw new Error('Session not found');
    }

    // Check if user has access
    const hasAccess = await this.checkMobileAccess(session, userId);

    return {
      session: {
        id: session.id,
        title: session.title,
        description: session.description,
        instructor: session.instructor,
        startTime: session.startTime,
        endTime: session.endTime,
        duration: session.duration,
        type: session.type,
        category: session.category,
        price: session.price,
        isFree: session.isFree,
        thumbnail: session.thumbnail,
        streamUrl: hasAccess ? session.streamUrl : null,
        streamKey: null, // Never expose stream key to mobile
        accessType: session.accessType,
        status: session.status,
        participants: session._count.participants,
        maxParticipants: session.maxParticipants,
        chatEnabled: session.chatEnabled,
        recordingEnabled: session.recordingEnabled,
        requiresApproval: session.requiresApproval,
        isJoined: session.participants.length > 0,
        hasAccess,
      },
      recordings: session.recordings.map(recording => ({
        id: recording.id,
        fileName: recording.fileName,
        duration: recording.duration,
        thumbnailUrl: recording.thumbnailUrl,
        downloadEnabled: recording.downloadEnabled,
        isPublic: recording.isPublic,
      })),
    };
  }

  async joinSessionMobile(sessionId: string, userId: string, joinData: any) {
    const session = await prisma.liveSession.findUnique({
      where: { id: sessionId },
    });

    if (!session) {
      throw new Error('Session not found');
    }

    // Check access
    const hasAccess = await this.checkMobileAccess(session, userId);
    if (!hasAccess) {
      throw new Error('Access denied');
    }

    // Check if already joined
    const existingParticipant = await prisma.liveSessionParticipant.findFirst({
      where: {
        sessionId,
        userId,
      },
    });

    if (existingParticipant) {
      // Update device info
      const updatedParticipant = await prisma.liveSessionParticipant.update({
        where: { id: existingParticipant.id },
        data: {
          deviceType: 'mobile',
          browser: joinData.browser || 'mobile-app',
          platform: joinData.platform || 'unknown',
          appVersion: joinData.appVersion,
        },
      });

      return {
        participant: updatedParticipant,
        session: {
          id: session.id,
          title: session.title,
          streamUrl: session.streamUrl,
          chatEnabled: session.chatEnabled,
        },
        viewerToken: this.generateMobileViewerToken(sessionId, userId),
      };
    }

    // Create new participant
    const participant = await prisma.liveSessionParticipant.create({
      data: {
        sessionId,
        userId,
        status: 'JOINED',
        role: 'ATTENDEE',
        deviceType: 'mobile',
        browser: joinData.browser || 'mobile-app',
        platform: joinData.platform,
        appVersion: joinData.appVersion,
        joinedAt: new Date(),
      },
    });

    // Update session participant count
    await prisma.liveSession.update({
      where: { id: sessionId },
      data: {
        currentParticipants: { increment: 1 },
      },
    });

    return {
      participant,
      session: {
        id: session.id,
        title: session.title,
        streamUrl: session.streamUrl,
        chatEnabled: session.chatEnabled,
      },
      viewerToken: this.generateMobileViewerToken(sessionId, userId),
    };
  }

  async registerPushToken(userId: string, tokenData: { token: string; platform: 'ios' | 'android' }) {
    // Save or update push token
    const pushToken = await prisma.pushNotificationToken.upsert({
      where: {
        userId_token: {
          userId,
          token: tokenData.token,
        },
      },
      update: {
        platform: tokenData.platform,
        lastActive: new Date(),
      },
      create: {
        userId,
        token: tokenData.token,
        platform: tokenData.platform,
        lastActive: new Date(),
      },
    });

    return pushToken;
  }

  async sendPushNotification(userId: string, notification: any) {
    const tokens = await prisma.pushNotificationToken.findMany({
      where: { userId },
      select: { token: true, platform: true },
    });

    if (tokens.length === 0) {
      return;
    }

    const messages = tokens.map(token => ({
      token: token.token,
      notification: {
        title: notification.title,
        body: notification.body,
      },
      data: notification.data || {},
      android: {
        priority: 'high',
        notification: {
          sound: 'default',
          channelId: 'live_sessions',
        },
      },
      apns: {
        payload: {
          aps: {
            sound: 'default',
            badge: 1,
          },
        },
      },
    }));

    try {
      const responses = await Promise.all(
        messages.map(message => this.firebaseAdmin.messaging().send(message))
      );

      // Log notification delivery
      await prisma.notificationDelivery.create({
        data: {
          userId,
          type: 'PUSH',
          title: notification.title,
          body: notification.body,
          data: notification.data,
          tokensSent: tokens.length,
          successfulDeliveries: responses.filter(r => r !== null).length,
        },
      });
    } catch (error) {
      console.error('Error sending push notification:', error);
    }
  }

  async scheduleSessionNotifications(sessionId: string) {
    const session = await prisma.liveSession.findUnique({
      where: { id: sessionId },
      include: {
        participants: {
          include: {
            user: true,
          },
        },
      },
    });

    if (!session) {
      return;
    }

    // Schedule notifications for participants
    const notificationTimes = [
      { hours: 24, type: 'reminder_24h' },
      { hours: 1, type: 'reminder_1h' },
      { minutes: 15, type: 'reminder_15m' },
      { minutes: 0, type: 'session_starting' },
    ];

    for (const time of notificationTimes) {
      const notifyAt = new Date(session.startTime);
      
      if (time.hours) {
        notifyAt.setHours(notifyAt.getHours() - time.hours);
      } else if (time.minutes) {
        notifyAt.setMinutes(notifyAt.getMinutes() - time.minutes);
      }

      // Schedule job for each participant
      for (const participant of session.participants) {
        await this.scheduleNotificationJob(
          participant.userId,
          session,
          notifyAt,
          time.type
        );
      }
    }
  }

  async getOfflineContent(userId: string) {
    const offlineContent = await prisma.offlineContent.findMany({
      where: {
        userId,
        OR: [
          { expiresAt: null },
          { expiresAt: { gt: new Date() } },
        ],
      },
      include: {
        session: {
          include: {
            instructor: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                avatar: true,
              },
            },
          },
        },
      },
      orderBy: { downloadedAt: 'desc' },
    });

    return offlineContent.map(content => ({
      id: content.id,
      session: {
        id: content.session.id,
        title: content.session.title,
        instructor: content.session.instructor,
        thumbnail: content.session.thumbnail,
        duration: content.session.duration,
      },
      filePath: content.filePath,
      fileSize: content.fileSize,
      downloadedAt: content.downloadedAt,
      expiresAt: content.expiresAt,
      downloadStatus: content.downloadStatus,
    }));
  }

  async downloadForOffline(sessionId: string, userId: string) {
    const session = await prisma.liveSession.findUnique({
      where: { id: sessionId },
      include: {
        recordings: {
          where: {
            status: 'COMPLETED',
            downloadEnabled: true,
          },
          take: 1,
        },
      },
    });

    if (!session) {
      throw new Error('Session not found');
    }

    if (session.recordings.length === 0) {
      throw new Error('No recording available for download');
    }

    const recording = session.recordings[0];

    // Check if already downloaded
    const existingDownload = await prisma.offlineContent.findFirst({
      where: {
        userId,
        recordingId: recording.id,
      },
    });

    if (existingDownload) {
      return {
        id: existingDownload.id,
        message: 'Already downloaded',
      };
    }

    // Create offline content record
    const offlineContent = await prisma.offlineContent.create({
      data: {
        userId,
        sessionId,
        recordingId: recording.id,
        downloadStatus: 'PENDING',
        filePath: null, // Will be set after download
        fileSize: recording.fileSize,
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
      },
    });

    // Start download in background
    this.startBackgroundDownload(offlineContent.id, recording.fileUrl);

    return {
      id: offlineContent.id,
      message: 'Download started',
    };
  }

  private async startBackgroundDownload(contentId: string, fileUrl: string) {
    try {
      // Simulate download - in production, use proper download logic
      await new Promise(resolve => setTimeout(resolve, 5000));

      const filePath = `/offline-content/${contentId}.mp4`;
      
      await prisma.offlineContent.update({
        where: { id: contentId },
        data: {
          downloadStatus: 'COMPLETED',
          filePath,
          downloadedAt: new Date(),
        },
      });

      // Notify user
      await this.sendPushNotification(
        await this.getUserIdFromContent(contentId),
        {
          title: 'Download Complete',
          body: 'Your offline content is ready to view',
          data: { contentId, type: 'download_complete' },
        }
      );
    } catch (error) {
      await prisma.offlineContent.update({
        where: { id: contentId },
        data: {
          downloadStatus: 'FAILED',
        },
      });

      console.error('Download failed:', error);
    }
  }

  private async checkMobileAccess(session: any, userId?: string): Promise<boolean> {
    if (session.accessType === 'PUBLIC') {
      return true;
    }

    if (!userId) {
      return false;
    }

    if (session.accessType === 'PRIVATE') {
      const participant = await prisma.liveSessionParticipant.findFirst({
        where: {
          sessionId: session.id,
          userId,
        },
      });
      return !!participant;
    }

    if (session.accessType === 'INVITE_ONLY') {
      const participant = await prisma.liveSessionParticipant.findFirst({
        where: {
          sessionId: session.id,
          userId,
        },
      });
      return !!participant;
    }

    if (session.accessType === 'PASSWORD_PROTECTED') {
      // Password would be provided when joining
      return false;
    }

    return false;
  }

  private canUserJoin(session: any, userId?: string): boolean {
    if (!userId) {
      return false;
    }

    if (session.currentParticipants >= session.maxParticipants) {
      return false;
    }

    if (session.status !== 'SCHEDULED' && session.status !== 'LIVE') {
      return false;
    }

    return true;
  }

  private generateMobileViewerToken(sessionId: string, userId: string): string {
    // Generate JWT token for mobile viewer
    const payload = {
      sessionId,
      userId,
      role: 'ATTENDEE',
      platform: 'mobile',
      exp: Math.floor(Date.now() / 1000) + (60 * 60 * 4), // 4 hours
    };

    // In production, use JWT signing
    return Buffer.from(JSON.stringify(payload)).toString('base64');
  }

  private async scheduleNotificationJob(
    userId: string,
    session: any,
    notifyAt: Date,
    type: string
  ) {
    // This would integrate with a job queue like Bull or Agenda
    // For now, log the scheduled notification
    console.log(`Scheduled ${type} notification for user ${userId} at ${notifyAt}`);
  }

  private async getUserIdFromContent(contentId: string): Promise<string> {
    const content = await prisma.offlineContent.findUnique({
      where: { id: contentId },
      select: { userId: true },
    });
    
    return content?.userId || '';
  }
}