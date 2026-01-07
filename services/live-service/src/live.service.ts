import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { 
  CreateLiveSessionDto, 
  UpdateLiveSessionDto, 
  JoinSessionDto,
  CreatePollDto,
  SendMessageDto,
  UpdateParticipantDto 
} from './dto/live.dto';
import * as crypto from 'crypto';
import * as jwt from 'jsonwebtoken';
import { RRule, RRuleSet } from 'rrule';

const prisma = new PrismaClient();

@Injectable()
export class LiveService {
  private readonly jwtSecret = process.env.JWT_SECRET || 'live-service-secret';
  private readonly streamSecret = process.env.STREAM_SECRET || 'stream-secret';

  // Session Management
  async createSession(createLiveSessionDto: CreateLiveSessionDto, instructorId: string) {
    // Generate stream key
    const streamKey = this.generateStreamKey();
    const streamUrl = this.generateStreamUrl(streamKey);
    
    // Calculate end time if not provided
    const endTime = createLiveSessionDto.endTime || 
      new Date(new Date(createLiveSessionDto.startTime).getTime() + 
              (createLiveSessionDto.duration || 60) * 60000);

    const session = await prisma.liveSession.create({
      data: {
        ...createLiveSessionDto,
        instructorId,
        streamKey,
        streamUrl,
        endTime,
        status: createLiveSessionDto.status || 'SCHEDULED',
        isFree: createLiveSessionDto.price === 0 || !createLiveSessionDto.price,
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
      },
    });

    // Generate invitation link
    const invitationLink = this.generateInvitationLink(session);

    // Schedule notifications
    await this.scheduleSessionNotifications(session);

    return {
      ...session,
      invitationLink,
      streamKey: session.accessType === 'PUBLIC' ? streamKey : undefined,
    };
  }

  async getSession(sessionId: string, userId?: string) {
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
        _count: {
          select: {
            participants: true,
            waitlist: true,
          },
        },
      },
    });

    if (!session) {
      throw new NotFoundException('Session not found');
    }

    // Check access
    await this.checkSessionAccess(session, userId);

    return session;
  }

  async listSessions(filters: any) {
    const {
      instructorId,
      status,
      type,
      category,
      startDate,
      endDate,
      accessType,
      isFree,
      page = 1,
      limit = 20,
      search,
    } = filters;

    const skip = (page - 1) * limit;
    const where: any = {};

    if (instructorId) where.instructorId = instructorId;
    if (status) where.status = status;
    if (type) where.type = type;
    if (category) where.category = category;
    if (accessType) where.accessType = accessType;
    if (isFree !== undefined) where.isFree = isFree;
    if (startDate || endDate) {
      where.startTime = {};
      if (startDate) where.startTime.gte = new Date(startDate);
      if (endDate) where.startTime.lte = new Date(endDate);
    }
    if (search) {
      where.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
      ];
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

    return {
      sessions,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(total / limit),
      },
    };
  }

  async updateSession(sessionId: string, instructorId: string, updateDto: UpdateLiveSessionDto) {
    const session = await prisma.liveSession.findFirst({
      where: {
        id: sessionId,
        instructorId,
      },
    });

    if (!session) {
      throw new NotFoundException('Session not found or unauthorized');
    }

    // Don't allow updates if session has started
    if (session.status === 'LIVE' || session.status === 'ENDED') {
      throw new BadRequestException('Cannot update live or ended session');
    }

    const updatedSession = await prisma.liveSession.update({
      where: { id: sessionId },
      data: updateDto,
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
    });

    // Notify participants of changes
    await this.notifyParticipants(sessionId, 'session_updated', {
      changes: Object.keys(updateDto),
    });

    return updatedSession;
  }

  async deleteSession(sessionId: string, instructorId: string) {
    const session = await prisma.liveSession.findFirst({
      where: {
        id: sessionId,
        instructorId,
      },
    });

    if (!session) {
      throw new NotFoundException('Session not found or unauthorized');
    }

    // Don't allow deletion if session has started
    if (session.status === 'LIVE') {
      throw new BadRequestException('Cannot delete live session');
    }

    // Notify participants
    await this.notifyParticipants(sessionId, 'session_cancelled', null);

    await prisma.liveSession.delete({
      where: { id: sessionId },
    });

    return { success: true, message: 'Session deleted' };
  }

  // Participant Management
  async joinSession(joinSessionDto: JoinSessionDto, userId: string) {
    const session = await prisma.liveSession.findUnique({
      where: { id: joinSessionDto.sessionId },
      include: {
        participants: {
          where: { userId },
        },
      },
    });

    if (!session) {
      throw new NotFoundException('Session not found');
    }

    // Check access
    await this.checkSessionAccess(session, userId, joinSessionDto.accessCode);

    // Check if session has started
    const now = new Date();
    const startTime = new Date(session.startTime);
    const canJoinEarly = now >= new Date(startTime.getTime() - 15 * 60000); // 15 minutes early

    if (!canJoinEarly && session.status !== 'LIVE') {
      throw new BadRequestException('Session has not started yet');
    }

    // Check capacity
    if (session.currentParticipants >= session.maxParticipants) {
      if (session.waitlistEnabled) {
        return this.addToWaitlist(session.id, userId);
      }
      throw new BadRequestException('Session is full');
    }

    let participant;
    if (session.participants.length > 0) {
      // Update existing participant
      participant = await prisma.liveSessionParticipant.update({
        where: { id: session.participants[0].id },
        data: {
          status: 'JOINED',
          joinedAt: new Date(),
          deviceType: joinSessionDto.deviceType,
          browser: joinSessionDto.browser,
        },
      });
    } else {
      // Create new participant
      participant = await prisma.liveSessionParticipant.create({
        data: {
          sessionId: session.id,
          userId,
          status: 'JOINED',
          joinedAt: new Date(),
          role: 'ATTENDEE',
          deviceType: joinSessionDto.deviceType,
          browser: joinSessionDto.browser,
        },
      });
    }

    // Update session participant count
    await prisma.liveSession.update({
      where: { id: session.id },
      data: {
        currentParticipants: { increment: 1 },
        status: session.status === 'SCHEDULED' ? 'LIVE' : session.status,
      },
    });

    // Generate viewer token
    const viewerToken = this.generateViewerToken(session.id, userId, participant.role);

    // Send welcome message
    await this.sendSystemMessage(session.id, `User joined the session`, userId);

    return {
      session: {
        id: session.id,
        title: session.title,
        streamUrl: session.streamUrl,
        streamKey: this.getStreamKeyForParticipant(session, participant.role),
        chatEnabled: session.chatEnabled,
        qaEnabled: session.qaEnabled,
        pollsEnabled: session.pollsEnabled,
      },
      participant,
      viewerToken,
    };
  }

  async leaveSession(sessionId: string, userId: string) {
    const participant = await prisma.liveSessionParticipant.findFirst({
      where: {
        sessionId,
        userId,
        status: { in: ['JOINED', 'REGISTERED'] },
      },
    });

    if (!participant) {
      throw new NotFoundException('Participant not found');
    }

    // Calculate duration
    const duration = participant.joinedAt ? 
      Math.floor((new Date().getTime() - participant.joinedAt.getTime()) / 60000) : 0;

    const updatedParticipant = await prisma.liveSessionParticipant.update({
      where: { id: participant.id },
      data: {
        status: 'LEFT',
        leftAt: new Date(),
        duration,
      },
    });

    // Update session participant count
    await prisma.liveSession.update({
      where: { id: sessionId },
      data: {
        currentParticipants: { decrement: 1 },
      },
    });

    // Send leave message
    await this.sendSystemMessage(sessionId, `User left the session`, userId);

    return updatedParticipant;
  }

  async updateParticipant(sessionId: string, participantId: string, updateDto: UpdateParticipantDto, updaterId: string) {
    // Check if updater has permission
    const updater = await prisma.liveSessionParticipant.findFirst({
      where: {
        sessionId,
        userId: updaterId,
        role: { in: ['HOST', 'CO_HOST', 'MODERATOR'] },
      },
    });

    if (!updater) {
      throw new ForbiddenException('Insufficient permissions');
    }

    const participant = await prisma.liveSessionParticipant.findFirst({
      where: {
        id: participantId,
        sessionId,
      },
    });

    if (!participant) {
      throw new NotFoundException('Participant not found');
    }

    const updatedParticipant = await prisma.liveSessionParticipant.update({
      where: { id: participantId },
      data: updateDto,
    });

    // Log moderation action
    await this.logModerationAction(sessionId, updaterId, 'update_participant', {
      participantId,
      changes: Object.keys(updateDto),
    });

    return updatedParticipant;
  }

  async getParticipants(sessionId: string, filters: any) {
    const { status, role, page = 1, limit = 50 } = filters;
    const skip = (page - 1) * limit;

    const where: any = { sessionId };
    if (status) where.status = status;
    if (role) where.role = role;

    const [participants, total] = await Promise.all([
      prisma.liveSessionParticipant.findMany({
        where,
        include: {
          user: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              avatar: true,
            },
          },
        },
        orderBy: { joinedAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.liveSessionParticipant.count({ where }),
    ]);

    return {
      participants,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(total / limit),
      },
    };
  }

  // Chat Management
  async sendMessage(sessionId: string, userId: string, messageDto: SendMessageDto) {
    const participant = await prisma.liveSessionParticipant.findFirst({
      where: {
        sessionId,
        userId,
        status: { in: ['JOINED', 'REGISTERED'] },
      },
    });

    if (!participant) {
      throw new ForbiddenException('You must be a participant to send messages');
    }

    const session = await prisma.liveSession.findUnique({
      where: { id: sessionId },
    });

    if (!session.chatEnabled) {
      throw new BadRequestException('Chat is disabled for this session');
    }

    const message = await prisma.chatMessage.create({
      data: {
        sessionId,
        userId,
        message: messageDto.message,
        messageType: messageDto.messageType || 'TEXT',
        metadata: messageDto.metadata,
        parentId: messageDto.parentId,
      },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            avatar: true,
          },
        },
      },
    });

    // Broadcast message to other participants
    await this.broadcastMessage(sessionId, 'new_message', message);

    return message;
  }

  async getMessages(sessionId: string, filters: any) {
    const { before, after, limit = 100, includeReplies = false } = filters;

    const where: any = { sessionId, isDeleted: false };
    
    if (before) {
      where.createdAt = { lt: new Date(before) };
    } else if (after) {
      where.createdAt = { gt: new Date(after) };
    }

    const messages = await prisma.chatMessage.findMany({
      where,
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            avatar: true,
          },
        },
        ...(includeReplies && {
          replies: {
            include: {
              user: {
                select: {
                  id: true,
                  firstName: true,
                  lastName: true,
                  avatar: true,
                },
              },
            },
            orderBy: { createdAt: 'asc' },
          },
        }),
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });

    return messages.reverse(); // Return in chronological order
  }

  // Poll Management
  async createPoll(sessionId: string, userId: string, pollDto: CreatePollDto) {
    const participant = await prisma.liveSessionParticipant.findFirst({
      where: {
        sessionId,
        userId,
        role: { in: ['HOST', 'CO_HOST', 'MODERATOR'] },
      },
    });

    if (!participant) {
      throw new ForbiddenException('Only hosts and moderators can create polls');
    }

    const session = await prisma.liveSession.findUnique({
      where: { id: sessionId },
    });

    if (!session.pollsEnabled) {
      throw new BadRequestException('Polls are disabled for this session');
    }

    const poll = await prisma.poll.create({
      data: {
        sessionId,
        createdById: userId,
        question: pollDto.question,
        options: pollDto.options,
        isMultipleChoice: pollDto.isMultipleChoice || false,
        isAnonymous: pollDto.isAnonymous || true,
      },
    });

    // Broadcast new poll to participants
    await this.broadcastMessage(sessionId, 'new_poll', poll);

    return poll;
  }

  async voteOnPoll(pollId: string, userId: string, selectedOptions: string[]) {
    const poll = await prisma.poll.findUnique({
      where: { id: pollId },
    });

    if (!poll) {
      throw new NotFoundException('Poll not found');
    }

    if (!poll.isActive) {
      throw new BadRequestException('Poll is not active');
    }

    // Check if user has already voted
    const existingVote = await prisma.pollVote.findFirst({
      where: {
        pollId,
        userId,
      },
    });

    if (existingVote && !poll.isMultipleChoice) {
      throw new BadRequestException('You have already voted on this poll');
    }

    const vote = await prisma.pollVote.create({
      data: {
        pollId,
        userId: poll.isAnonymous ? undefined : userId,
        selectedOptions,
      },
    });

    // Update poll results
    const results = await this.getPollResults(pollId);
    await this.broadcastMessage(poll.sessionId, 'poll_update', {
      pollId,
      results,
    });

    return vote;
  }

  async getPollResults(pollId: string) {
    const poll = await prisma.poll.findUnique({
      where: { id: pollId },
    });

    if (!poll) {
      throw new NotFoundException('Poll not found');
    }

    const votes = await prisma.pollVote.findMany({
      where: { pollId },
    });

    const results = {};
    const options = poll.options as any[];

    // Initialize results
    options.forEach(option => {
      results[option.id] = 0;
    });

    // Count votes
    votes.forEach(vote => {
      const selected = vote.selectedOptions as string[];
      selected.forEach(optionId => {
        if (results[optionId] !== undefined) {
          results[optionId]++;
        }
      });
    });

    return {
      pollId,
      question: poll.question,
      options: options.map(option => ({
        ...option,
        votes: results[option.id],
        percentage: votes.length > 0 ? (results[option.id] / votes.length) * 100 : 0,
      })),
      totalVotes: votes.length,
      isMultipleChoice: poll.isMultipleChoice,
      isAnonymous: poll.isAnonymous,
    };
  }

  // Recording Management
  async startRecording(sessionId: string, instructorId: string) {
    const session = await prisma.liveSession.findFirst({
      where: {
        id: sessionId,
        instructorId,
      },
    });

    if (!session) {
      throw new NotFoundException('Session not found or unauthorized');
    }

    if (session.status !== 'LIVE') {
      throw new BadRequestException('Only live sessions can be recorded');
    }

    const updatedSession = await prisma.liveSession.update({
      where: { id: sessionId },
      data: {
        isRecording: true,
      },
    });

    // Start recording on streaming platform
    await this.startPlatformRecording(sessionId, session.streamKey);

    return updatedSession;
  }

  async stopRecording(sessionId: string, instructorId: string) {
    const session = await prisma.liveSession.findFirst({
      where: {
        id: sessionId,
        instructorId,
      },
    });

    if (!session) {
      throw new NotFoundException('Session not found or unauthorized');
    }

    const updatedSession = await prisma.liveSession.update({
      where: { id: sessionId },
      data: {
        isRecording: false,
      },
    });

    // Stop recording and process file
    const recordingData = await this.stopPlatformRecording(sessionId, session.streamKey);

    // Create recording record
    const recording = await prisma.recording.create({
      data: {
        sessionId,
        fileName: recordingData.fileName,
        fileUrl: recordingData.fileUrl,
        fileSize: recordingData.fileSize,
        duration: recordingData.duration,
        format: recordingData.format,
        resolution: recordingData.resolution,
        status: 'PROCESSING',
      },
    });

    // Process recording (transcode, generate thumbnails, etc.)
    this.processRecording(recording.id);

    return {
      session: updatedSession,
      recording,
    };
  }

  async getRecordings(sessionId: string) {
    const recordings = await prisma.recording.findMany({
      where: {
        sessionId,
        status: 'COMPLETED',
      },
      orderBy: { createdAt: 'desc' },
    });

    return recordings;
  }

  // Waitlist Management
  async addToWaitlist(sessionId: string, userId: string) {
    const session = await prisma.liveSession.findUnique({
      where: { id: sessionId },
      include: {
        waitlist: {
          where: { userId },
        },
      },
    });

    if (!session) {
      throw new NotFoundException('Session not found');
    }

    if (!session.waitlistEnabled) {
      throw new BadRequestException('Waitlist is not enabled for this session');
    }

    if (session.waitlist.length > 0) {
      throw new BadRequestException('You are already on the waitlist');
    }

    // Get current waitlist position
    const waitlistCount = await prisma.waitlistEntry.count({
      where: { sessionId, status: 'WAITING' },
    });

    if (waitlistCount >= session.maxWaitlist) {
      throw new BadRequestException('Waitlist is full');
    }

    const waitlistEntry = await prisma.waitlistEntry.create({
      data: {
        sessionId,
        userId,
        position: waitlistCount + 1,
        status: 'WAITING',
      },
    });

    // Notify user
    await this.notifyUser(userId, 'waitlist_added', {
      sessionId,
      position: waitlistEntry.position,
    });

    return waitlistEntry;
  }

  async promoteFromWaitlist(sessionId: string, count: number = 1) {
    const waitlistEntries = await prisma.waitlistEntry.findMany({
      where: {
        sessionId,
        status: 'WAITING',
      },
      orderBy: { position: 'asc' },
      take: count,
      include: {
        user: true,
      },
    });

    for (const entry of waitlistEntries) {
      // Update waitlist entry
      await prisma.waitlistEntry.update({
        where: { id: entry.id },
        data: {
          status: 'PROMOTED',
          notified: true,
          notifiedAt: new Date(),
        },
      });

      // Create participant
      await prisma.liveSessionParticipant.create({
        data: {
          sessionId,
          userId: entry.userId,
          status: 'REGISTERED',
          role: 'ATTENDEE',
        },
      });

      // Notify user
      await this.notifyUser(entry.userId, 'waitlist_promoted', {
        sessionId,
      });
    }

    return waitlistEntries;
  }

  // Analytics
  async getSessionAnalytics(sessionId: string, instructorId: string) {
    const session = await prisma.liveSession.findFirst({
      where: {
        id: sessionId,
        instructorId,
      },
    });

    if (!session) {
      throw new NotFoundException('Session not found or unauthorized');
    }

    const [
      participants,
      messages,
      polls,
      recordings,
      analyticsData,
    ] = await Promise.all([
      prisma.liveSessionParticipant.findMany({
        where: { sessionId },
      }),
      prisma.chatMessage.count({ where: { sessionId } }),
      prisma.poll.count({ where: { sessionId } }),
      prisma.recording.findMany({ where: { sessionId } }),
      prisma.streamAnalytics.findMany({
        where: { sessionId },
        orderBy: { timestamp: 'desc' },
        take: 10,
      }),
    ]);

    // Calculate metrics
    const totalDuration = participants.reduce((sum, p) => sum + (p.duration || 0), 0);
    const avgDuration = participants.length > 0 ? totalDuration / participants.length : 0;
    const peakParticipants = Math.max(...analyticsData.map(a => a.peakViewers), participants.length);
    const avgParticipants = analyticsData.length > 0 ? 
      analyticsData.reduce((sum, a) => sum + a.averageViewers, 0) / analyticsData.length : 
      participants.length;

    return {
      sessionId,
      participants: {
        total: participants.length,
        byStatus: this.groupBy(participants, 'status'),
        byRole: this.groupBy(participants, 'role'),
        averageDuration: avgDuration,
      },
      engagement: {
        totalMessages: messages,
        totalPolls: polls,
        participationRate: participants.length > 0 ? 
          (participants.filter(p => p.duration && p.duration > 0).length / participants.length) * 100 : 0,
      },
      quality: {
        peakParticipants,
        averageParticipants: avgParticipants,
        retentionRate: analyticsData.length > 0 ? 
          analyticsData[analyticsData.length - 1].retentionRate : 0,
      },
      recordings: recordings.map(r => ({
        id: r.id,
        duration: r.duration,
        views: r.views,
        status: r.status,
      })),
    };
  }

  // Helper Methods
  private generateStreamKey(): string {
    return crypto.randomBytes(16).toString('hex');
  }

  private generateStreamUrl(streamKey: string): string {
    return `rtmp://live.yogaspa.com/live/${streamKey}`;
  }

  private generateInvitationLink(session: any): string {
    const baseUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    return `${baseUrl}/live/join/${session.id}`;
  }

  private generateViewerToken(sessionId: string, userId: string, role: string): string {
    const payload = {
      sessionId,
      userId,
      role,
      exp: Math.floor(Date.now() / 1000) + (60 * 60 * 24), // 24 hours
    };

    return jwt.sign(payload, this.jwtSecret);
  }

  private getStreamKeyForParticipant(session: any, role: string): string | null {
    // Only return stream key for hosts, co-hosts, and panelists
    if (['HOST', 'CO_HOST', 'PANELIST'].includes(role)) {
      return session.streamKey;
    }
    return null;
  }

  private async checkSessionAccess(session: any, userId?: string, accessCode?: string) {
    if (session.accessType === 'PUBLIC') {
      return true;
    }

    if (session.accessType === 'PRIVATE' && !userId) {
      throw new ForbiddenException('This is a private session');
    }

    if (session.accessType === 'INVITE_ONLY') {
      const participant = await prisma.liveSessionParticipant.findFirst({
        where: {
          sessionId: session.id,
          userId,
        },
      });

      if (!participant) {
        throw new ForbiddenException('You are not invited to this session');
      }
    }

    if (session.accessType === 'PASSWORD_PROTECTED') {
      if (accessCode !== session.password) {
        throw new ForbiddenException('Invalid access code');
      }
    }

    if (session.requiresApproval && userId) {
      const participant = await prisma.liveSessionParticipant.findFirst({
        where: {
          sessionId: session.id,
          userId,
          status: 'REGISTERED',
        },
      });

      if (!participant) {
        throw new ForbiddenException('Your participation requires approval');
      }
    }

    return true;
  }

  private async scheduleSessionNotifications(session: any) {
    // Schedule notifications at different times before session
    const notifications = [
      { hours: 24, type: 'reminder_24h' },
      { hours: 1, type: 'reminder_1h' },
      { minutes: 15, type: 'reminder_15m' },
    ];

    for (const notif of notifications) {
      const notifyAt = new Date(session.startTime);
      if (notif.hours) {
        notifyAt.setHours(notifyAt.getHours() - notif.hours);
      } else if (notif.minutes) {
        notifyAt.setMinutes(notifyAt.getMinutes() - notif.minutes);
      }

      // Schedule notification (implementation depends on job queue)
      console.log(`Scheduled ${notif.type} notification for session ${session.id} at ${notifyAt}`);
    }
  }

  private async notifyParticipants(sessionId: string, event: string, data: any) {
    // Implementation depends on WebSocket/real-time service
    console.log(`Notifying participants of ${event} for session ${sessionId}`, data);
  }

  private async broadcastMessage(sessionId: string, event: string, data: any) {
    // Implementation for real-time broadcasting
    console.log(`Broadcasting ${event} for session ${sessionId}`, data);
  }

  private async sendSystemMessage(sessionId: string, message: string, userId?: string) {
    await prisma.chatMessage.create({
      data: {
        sessionId,
        userId: userId || 'system',
        message,
        messageType: 'SYSTEM',
      },
    });
  }

  private async logModerationAction(sessionId: string, moderatorId: string, action: string, data: any) {
    // Log moderation actions for audit
    console.log(`Moderation action: ${action} by ${moderatorId} in session ${sessionId}`, data);
  }

  private async startPlatformRecording(sessionId: string, streamKey: string) {
    // Implementation depends on streaming platform API
    console.log(`Starting recording for session ${sessionId} with stream key ${streamKey}`);
    return { success: true };
  }

  private async stopPlatformRecording(sessionId: string, streamKey: string) {
    // Implementation depends on streaming platform API
    console.log(`Stopping recording for session ${sessionId} with stream key ${streamKey}`);
    return {
      fileName: `recording-${sessionId}-${Date.now()}.mp4`,
      fileUrl: `https://recordings.yogaspa.com/${sessionId}/recording.mp4`,
      fileSize: 1024 * 1024 * 100, // 100MB
      duration: 3600, // 1 hour in seconds
      format: 'mp4',
      resolution: '1080p',
    };
  }

  private async processRecording(recordingId: string) {
    // Process recording asynchronously
    setTimeout(async () => {
      await prisma.recording.update({
        where: { id: recordingId },
        data: {
          status: 'COMPLETED',
          processingProgress: 100,
          thumbnailUrl: `https://recordings.yogaspa.com/thumbnails/${recordingId}.jpg`,
        },
      });
    }, 5000); // Simulate processing time
  }

  private async notifyUser(userId: string, type: string, data: any) {
    // Implementation depends on notification service
    console.log(`Notifying user ${userId} about ${type}`, data);
  }

  private groupBy(array: any[], key: string) {
    return array.reduce((result, item) => {
      const value = item[key];
      result[value] = (result[value] || 0) + 1;
      return result;
    }, {});
  }

  async checkDatabase() {
    try {
      await prisma.$queryRaw`SELECT 1`;
      return 'connected';
    } catch (error) {
      return 'disconnected';
    }
  }
}