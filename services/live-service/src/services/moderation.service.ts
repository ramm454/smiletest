import { Injectable, Logger } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import * as toxicity from '@tensorflow-models/toxicity';
import { WebRTCGateway } from '../websocket/webrtc.gateway';

const prisma = new PrismaClient();

@Injectable()
export class ModerationService {
  private readonly logger = new Logger(ModerationService.name);
  private toxicityModel: any;

  constructor(private readonly webRTCGateway: WebRTCGateway) {
    this.loadToxicityModel();
  }

  private async loadToxicityModel() {
    try {
      this.toxicityModel = await toxicity.load(0.9, ['toxicity', 'insult', 'threat']);
      this.logger.log('Toxicity model loaded successfully');
    } catch (error) {
      this.logger.error('Failed to load toxicity model:', error);
    }
  }

  async moderateUser(moderationDto: any, moderatorId: string) {
    const session = await prisma.liveSession.findUnique({
      where: { id: moderationDto.sessionId },
    });

    if (!session) {
      throw new Error('Session not found');
    }

    // Check if moderator has permission
    const moderator = await prisma.liveSessionParticipant.findFirst({
      where: {
        sessionId: moderationDto.sessionId,
        userId: moderatorId,
        role: { in: ['HOST', 'CO_HOST', 'MODERATOR'] },
      },
    });

    if (!moderator) {
      throw new Error('Insufficient permissions');
    }

    const targetParticipant = await prisma.liveSessionParticipant.findFirst({
      where: {
        sessionId: moderationDto.sessionId,
        userId: moderationDto.targetUserId,
      },
    });

    if (!targetParticipant) {
      throw new Error('Target user not found in session');
    }

    // Apply moderation action
    switch (moderationDto.action) {
      case 'mute':
        await this.muteUser(moderationDto.sessionId, moderationDto.targetUserId, moderationDto.duration);
        break;
      case 'unmute':
        await this.unmuteUser(moderationDto.sessionId, moderationDto.targetUserId);
        break;
      case 'kick':
        await this.kickUser(moderationDto.sessionId, moderationDto.targetUserId);
        break;
      case 'ban':
        await this.banUser(moderationDto.sessionId, moderationDto.targetUserId, moderationDto.duration);
        break;
      case 'warn':
        await this.warnUser(moderationDto.sessionId, moderationDto.targetUserId, moderationDto.reason);
        break;
      case 'promote':
        await this.promoteToModerator(moderationDto.sessionId, moderationDto.targetUserId);
        break;
    }

    // Log moderation action
    await this.logModerationAction({
      sessionId: moderationDto.sessionId,
      moderatorId,
      targetUserId: moderationDto.targetUserId,
      action: moderationDto.action,
      reason: moderationDto.reason,
      duration: moderationDto.duration,
    });

    return { success: true, action: moderationDto.action };
  }

  private async muteUser(sessionId: string, userId: string, duration?: number) {
    // Update participant permissions
    await prisma.liveSessionParticipant.update({
      where: {
        sessionId_userId: {
          sessionId,
          userId,
        },
      },
      data: {
        permissions: {
          ...(await this.getUserPermissions(sessionId, userId)),
          canSpeak: false,
          mutedUntil: duration ? new Date(Date.now() + duration * 60000) : null,
        },
      },
    });

    // Notify via WebSocket
    this.webRTCGateway.server.to(sessionId).emit('user-muted', {
      userId,
      duration,
      timestamp: new Date().toISOString(),
    });
  }

  private async unmuteUser(sessionId: string, userId: string) {
    await prisma.liveSessionParticipant.update({
      where: {
        sessionId_userId: {
          sessionId,
          userId,
        },
      },
      data: {
        permissions: {
          ...(await this.getUserPermissions(sessionId, userId)),
          canSpeak: true,
          mutedUntil: null,
        },
      },
    });

    this.webRTCGateway.server.to(sessionId).emit('user-unmuted', {
      userId,
      timestamp: new Date().toISOString(),
    });
  }

  private async kickUser(sessionId: string, userId: string) {
    // Remove from session
    await prisma.liveSessionParticipant.delete({
      where: {
        sessionId_userId: {
          sessionId,
          userId,
        },
      },
    });

    // Update session count
    await prisma.liveSession.update({
      where: { id: sessionId },
      data: {
        currentParticipants: { decrement: 1 },
      },
    });

    // Notify via WebSocket
    this.webRTCGateway.server.to(sessionId).emit('user-kicked', {
      userId,
      timestamp: new Date().toISOString(),
    });
  }

  private async banUser(sessionId: string, userId: string, duration?: number) {
    await prisma.liveSessionParticipant.update({
      where: {
        sessionId_userId: {
          sessionId,
          userId,
        },
      },
      data: {
        status: 'BANNED',
        permissions: {
          canJoin: false,
          bannedUntil: duration ? new Date(Date.now() + duration * 60000) : null,
        },
      },
    });

    this.webRTCGateway.server.to(sessionId).emit('user-banned', {
      userId,
      duration,
      timestamp: new Date().toISOString(),
    });
  }

  private async warnUser(sessionId: string, userId: string, reason?: string) {
    const warning = await prisma.moderationWarning.create({
      data: {
        sessionId,
        userId,
        reason,
        warningCount: await this.getWarningCount(sessionId, userId) + 1,
      },
    });

    this.webRTCGateway.server.to(sessionId).emit('user-warned', {
      userId,
      reason,
      warningCount: warning.warningCount,
      timestamp: new Date().toISOString(),
    });

    // Auto-ban after 3 warnings
    if (warning.warningCount >= 3) {
      await this.banUser(sessionId, userId, 60); // 1 hour ban
    }
  }

  private async promoteToModerator(sessionId: string, userId: string) {
    await prisma.liveSessionParticipant.update({
      where: {
        sessionId_userId: {
          sessionId,
          userId,
        },
      },
      data: {
        role: 'MODERATOR',
        permissions: {
          ...(await this.getUserPermissions(sessionId, userId)),
          canModerate: true,
          canRemoveUsers: true,
          canMuteUsers: true,
        },
      },
    });

    this.webRTCGateway.server.to(sessionId).emit('user-promoted', {
      userId,
      newRole: 'MODERATOR',
      timestamp: new Date().toISOString(),
    });
  }

  async autoModerateMessage(sessionId: string, userId: string, message: string) {
    if (!this.toxicityModel) {
      return { action: 'none', score: 0 };
    }

    const predictions = await this.toxicityModel.classify([message]);
    
    const toxicityScore = predictions[0].results[0].probabilities[1];
    const insultScore = predictions[1].results[0].probabilities[1];
    const threatScore = predictions[2].results[0].probabilities[1];

    const maxScore = Math.max(toxicityScore, insultScore, threatScore);

    let action = 'none';
    if (maxScore > 0.9) {
      action = 'ban';
      await this.banUser(sessionId, userId, 60);
    } else if (maxScore > 0.7) {
      action = 'mute';
      await this.muteUser(sessionId, userId, 10);
    } else if (maxScore > 0.5) {
      action = 'warn';
      await this.warnUser(sessionId, userId, 'Inappropriate language detected');
    }

    return {
      action,
      scores: {
        toxicity: toxicityScore,
        insult: insultScore,
        threat: threatScore,
      },
    };
  }

  async getModerationLogs(sessionId: string, page: number = 1, limit: number = 50) {
    const skip = (page - 1) * limit;

    const [logs, total] = await Promise.all([
      prisma.moderationLog.findMany({
        where: { sessionId },
        include: {
          moderator: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
            },
          },
          targetUser: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.moderationLog.count({ where: { sessionId } }),
    ]);

    return {
      logs,
      pagination: {
        total,
        page,
        limit,
        pages: Math.ceil(total / limit),
      },
    };
  }

  private async getUserPermissions(sessionId: string, userId: string) {
    const participant = await prisma.liveSessionParticipant.findUnique({
      where: {
        sessionId_userId: {
          sessionId,
          userId,
        },
      },
    });

    return participant?.permissions || {};
  }

  private async getWarningCount(sessionId: string, userId: string) {
    const count = await prisma.moderationWarning.count({
      where: {
        sessionId,
        userId,
      },
    });
    return count;
  }

  private async logModerationAction(data: any) {
    await prisma.moderationLog.create({
      data: {
        sessionId: data.sessionId,
        moderatorId: data.moderatorId,
        targetUserId: data.targetUserId,
        action: data.action,
        reason: data.reason,
        duration: data.duration,
        metadata: {},
      },
    });
  }
}