import { Injectable, Logger } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import * as crypto from 'crypto';
import * as bcrypt from 'bcrypt';
import * as jwt from 'jsonwebtoken';

const prisma = new PrismaClient();

@Injectable()
export class SecurityService {
  private readonly logger = new Logger(SecurityService.name);
  private readonly encryptionKey = process.env.ENCRYPTION_KEY || 'default-encryption-key';

  async encryptSessionData(sessionId: string, data: any): Promise<string> {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv(
      'aes-256-gcm',
      Buffer.from(this.encryptionKey, 'hex'),
      iv
    );

    const encrypted = Buffer.concat([
      cipher.update(JSON.stringify(data), 'utf8'),
      cipher.final(),
    ]);

    const authTag = cipher.getAuthTag();

    const encryptedData = {
      iv: iv.toString('hex'),
      encrypted: encrypted.toString('hex'),
      authTag: authTag.toString('hex'),
      timestamp: new Date().toISOString(),
    };

    // Store encryption metadata
    await prisma.encryptionLog.create({
      data: {
        sessionId,
        algorithm: 'aes-256-gcm',
        keyVersion: '1.0',
        metadata: encryptedData,
      },
    });

    return Buffer.from(JSON.stringify(encryptedData)).toString('base64');
  }

  async decryptSessionData(encryptedBase64: string): Promise<any> {
    const encryptedData = JSON.parse(
      Buffer.from(encryptedBase64, 'base64').toString('utf8')
    );

    const decipher = crypto.createDecipheriv(
      'aes-256-gcm',
      Buffer.from(this.encryptionKey, 'hex'),
      Buffer.from(encryptedData.iv, 'hex')
    );

    decipher.setAuthTag(Buffer.from(encryptedData.authTag, 'hex'));

    const decrypted = Buffer.concat([
      decipher.update(Buffer.from(encryptedData.encrypted, 'hex')),
      decipher.final(),
    ]);

    return JSON.parse(decrypted.toString('utf8'));
  }

  async implementEndToEndEncryption(sessionId: string, participants: string[]) {
    // Generate session-specific encryption keys
    const sessionKey = crypto.randomBytes(32);
    const sessionIv = crypto.randomBytes(16);

    // Generate key pairs for each participant
    const participantKeys = await Promise.all(
      participants.map(async (userId) => {
        const keyPair = crypto.generateKeyPairSync('rsa', {
          modulusLength: 2048,
          publicKeyEncoding: {
            type: 'spki',
            format: 'pem',
          },
          privateKeyEncoding: {
            type: 'pkcs8',
            format: 'pem',
          },
        });

        // Encrypt session key with participant's public key
        const encryptedSessionKey = crypto.publicEncrypt(
          keyPair.publicKey,
          sessionKey
        );

        return {
          userId,
          publicKey: keyPair.publicKey,
          encryptedSessionKey: encryptedSessionKey.toString('base64'),
        };
      })
    );

    // Store encryption configuration
    await prisma.encryptionConfiguration.create({
      data: {
        sessionId,
        algorithm: 'aes-256-gcm+rsa-2048',
        sessionKey: sessionKey.toString('hex'),
        sessionIv: sessionIv.toString('hex'),
        participantKeys: participantKeys,
        enabled: true,
      },
    });

    return {
      algorithm: 'aes-256-gcm+rsa-2048',
      sessionKeyEncrypted: true,
      participantCount: participants.length,
    };
  }

  async auditDataAccess(sessionId: string, userId: string, action: string, dataType: string) {
    await prisma.dataAccessAudit.create({
      data: {
        sessionId,
        userId,
        action,
        dataType,
        ipAddress: this.getClientIp(), // Would come from request context
        userAgent: this.getUserAgent(), // Would come from request context
        timestamp: new Date(),
        metadata: {},
      },
    });

    // Check for suspicious activity
    await this.detectSuspiciousActivity(sessionId, userId, action);
  }

  async enforceDataRetentionPolicy() {
    const retentionDays = parseInt(process.env.DATA_RETENTION_DAYS || '730'); // Default 2 years
    
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

    // Delete old sessions and related data
    const oldSessions = await prisma.liveSession.findMany({
      where: {
        endTime: { lt: cutoffDate },
        status: 'ENDED',
      },
      select: { id: true },
    });

    for (const session of oldSessions) {
      await this.deleteSessionData(session.id);
    }

    return {
      deletedSessions: oldSessions.length,
      cutoffDate,
    };
  }

  async deleteSessionData(sessionId: string) {
    // Log deletion
    await prisma.dataDeletionLog.create({
      data: {
        sessionId,
        deletionType: 'RETENTION_POLICY',
        deletedAt: new Date(),
        metadata: {
          reason: 'Data retention policy enforcement',
        },
      },
    });

    // Delete related data (in production, this would be done carefully)
    const deletions = await Promise.all([
      prisma.chatMessage.deleteMany({ where: { sessionId } }),
      prisma.liveSessionParticipant.deleteMany({ where: { sessionId } }),
      prisma.poll.deleteMany({ where: { sessionId } }),
      prisma.recording.deleteMany({ where: { sessionId } }),
      prisma.streamAnalytics.deleteMany({ where: { sessionId } }),
    ]);

    // Finally delete the session
    await prisma.liveSession.delete({
      where: { id: sessionId },
    });

    return {
      sessionId,
      deletions: deletions.reduce((sum, d) => sum + d.count, 0),
    };
  }

  async getComplianceReport(sessionId: string) {
    const session = await prisma.liveSession.findUnique({
      where: { id: sessionId },
    });

    if (!session) {
      throw new Error('Session not found');
    }

    // GDPR compliance checks
    const gdprChecks = {
      dataMinimization: await this.checkDataMinimization(sessionId),
      consentManagement: await this.checkConsentManagement(sessionId),
      rightToAccess: await this.checkRightToAccess(sessionId),
      rightToErasure: await this.checkRightToErasure(sessionId),
      dataPortability: await this.checkDataPortability(sessionId),
    };

    // Security compliance checks
    const securityChecks = {
      encryptionEnabled: await this.checkEncryptionEnabled(sessionId),
      accessControls: await this.checkAccessControls(sessionId),
      auditLogging: await this.checkAuditLogging(sessionId),
      dataRetention: await this.checkDataRetention(sessionId),
    };

    // Generate compliance score
    const complianceScore = this.calculateComplianceScore(gdprChecks, securityChecks);

    return {
      sessionId,
      gdprCompliance: gdprChecks,
      securityCompliance: securityChecks,
      overallScore: complianceScore,
      recommendations: this.generateComplianceRecommendations(gdprChecks, securityChecks),
    };
  }

  async exportUserData(userId: string, format: 'json' | 'csv' = 'json') {
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new Error('User not found');
    }

    // Collect all user data
    const userData = {
      profile: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
      },
      sessions: await prisma.liveSessionParticipant.findMany({
        where: { userId },
        include: {
          session: {
            select: {
              id: true,
              title: true,
              startTime: true,
              endTime: true,
              type: true,
            },
          },
        },
      }),
      messages: await prisma.chatMessage.findMany({
        where: { userId },
        select: {
          id: true,
          sessionId: true,
          message: true,
          createdAt: true,
        },
      }),
      purchases: await prisma.ticketPurchase.findMany({
        where: { userId },
        include: {
          ticket: {
            include: {
              session: {
                select: {
                  title: true,
                  startTime: true,
                },
              },
            },
          },
        },
      }),
      subscriptions: await prisma.userSubscription.findMany({
        where: { userId },
        include: {
          plan: {
            select: {
              name: true,
              price: true,
            },
          },
        },
      }),
    };

    // Log data export
    await prisma.dataExportLog.create({
      data: {
        userId,
        exportType: 'USER_DATA',
        format,
        requestedAt: new Date(),
        metadata: {
          dataPoints: Object.keys(userData).length,
          sessionCount: userData.sessions.length,
          messageCount: userData.messages.length,
        },
      },
    });

    if (format === 'csv') {
      return this.convertToCSV(userData);
    }

    return userData;
  }

  async anonymizeUserData(userId: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new Error('User not found');
    }

    // Generate anonymous identifier
    const anonymousId = crypto.randomBytes(16).toString('hex');

    // Anonymize user data
    await prisma.user.update({
      where: { id: userId },
      data: {
        email: `anonymous_${anonymousId}@example.com`,
        firstName: 'Anonymous',
        lastName: 'User',
        avatar: null,
        phone: null,
        // Keep other fields but remove identifying information
      },
    });

    // Anonymize related data
    await Promise.all([
      prisma.chatMessage.updateMany({
        where: { userId },
        data: {
          userId: anonymousId,
          metadata: {
            ...(await this.getChatMessageMetadata(userId)),
            anonymized: true,
            originalUserId: userId,
          },
        },
      }),
      prisma.liveSessionParticipant.updateMany({
        where: { userId },
        data: {
          userId: anonymousId,
          metadata: {
            anonymized: true,
            originalUserId: userId,
          },
        },
      }),
    ]);

    // Log anonymization
    await prisma.dataAnonymizationLog.create({
      data: {
        userId,
        anonymousId,
        anonymizedAt: new Date(),
        metadata: {
          originalEmail: user.email,
          originalName: `${user.firstName} ${user.lastName}`,
        },
      },
    });

    return {
      success: true,
      anonymousId,
      message: 'User data has been anonymized',
    };
  }

  private async checkDataMinimization(sessionId: string): Promise<boolean> {
    // Check if only necessary data is collected
    const session = await prisma.liveSession.findUnique({
      where: { id: sessionId },
      select: { metadata: true },
    });

    if (!session) return false;

    // Check for unnecessary data collection
    const metadata = session.metadata as any;
    const unnecessaryFields = ['deviceId', 'browserFingerprint', 'exactLocation'];

    return !unnecessaryFields.some(field => metadata && metadata[field]);
  }

  private async checkConsentManagement(sessionId: string): Promise<boolean> {
    // Check if consent is properly managed
    const consentRecords = await prisma.consentLog.count({
      where: {
        sessionId,
        consentType: 'DATA_COLLECTION',
        granted: true,
      },
    });

    return consentRecords > 0;
  }

  private async checkRightToAccess(sessionId: string): Promise<boolean> {
    // Check if right to access is implemented
    const accessLogs = await prisma.dataAccessAudit.count({
      where: { sessionId, action: 'EXPORT' },
    });

    return accessLogs > 0;
  }

  private async checkRightToErasure(sessionId: string): Promise<boolean> {
    // Check if right to erasure is implemented
    const deletionLogs = await prisma.dataDeletionLog.count({
      where: { sessionId },
    });

    return deletionLogs > 0;
  }

  private async checkDataPortability(sessionId: string): Promise<boolean> {
    // Check if data portability is supported
    const exportLogs = await prisma.dataExportLog.count({
      where: {
        metadata: {
          path: ['sessionId'],
          equals: sessionId,
        },
      },
    });

    return exportLogs > 0;
  }

  private async checkEncryptionEnabled(sessionId: string): Promise<boolean> {
    const encryptionConfig = await prisma.encryptionConfiguration.findFirst({
      where: { sessionId, enabled: true },
    });

    return !!encryptionConfig;
  }

  private async checkAccessControls(sessionId: string): Promise<boolean> {
    const session = await prisma.liveSession.findUnique({
      where: { id: sessionId },
      select: { accessType: true, requiresApproval: true },
    });

    if (!session) return false;

    return session.accessType !== 'PUBLIC' || session.requiresApproval;
  }

  private async checkAuditLogging(sessionId: string): Promise<boolean> {
    const auditLogs = await prisma.dataAccessAudit.count({
      where: { sessionId },
    });

    return auditLogs > 0;
  }

  private async checkDataRetention(sessionId: string): Promise<boolean> {
    const session = await prisma.liveSession.findUnique({
      where: { id: sessionId },
      select: { endTime: true },
    });

    if (!session || !session.endTime) return false;

    const retentionDays = parseInt(process.env.DATA_RETENTION_DAYS || '730');
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

    return session.endTime > cutoffDate;
  }

  private calculateComplianceScore(gdprChecks: any, securityChecks: any): number {
    const totalChecks = Object.keys(gdprChecks).length + Object.keys(securityChecks).length;
    const passedChecks = 
      Object.values(gdprChecks).filter(Boolean).length +
      Object.values(securityChecks).filter(Boolean).length;

    return Math.round((passedChecks / totalChecks) * 100);
  }

  private generateComplianceRecommendations(gdprChecks: any, securityChecks: any): string[] {
    const recommendations = [];

    if (!gdprChecks.dataMinimization) {
      recommendations.push('Implement data minimization principles');
    }
    if (!gdprChecks.consentManagement) {
      recommendations.push('Improve consent management system');
    }
    if (!securityChecks.encryptionEnabled) {
      recommendations.push('Enable end-to-end encryption for sensitive sessions');
    }
    if (!securityChecks.auditLogging) {
      recommendations.push('Implement comprehensive audit logging');
    }

    return recommendations;
  }

  private async detectSuspiciousActivity(sessionId: string, userId: string, action: string) {
    // Check for unusual patterns
    const recentActions = await prisma.dataAccessAudit.count({
      where: {
        userId,
        sessionId,
        timestamp: {
          gte: new Date(Date.now() - 5 * 60000), // Last 5 minutes
        },
      },
    });

    if (recentActions > 10) {
      // Trigger security alert
      await this.triggerSecurityAlert(sessionId, userId, 'HIGH_ACCESS_RATE', {
        actions: recentActions,
        timeWindow: '5 minutes',
      });
    }

    // Check for unauthorized data export
    if (action === 'EXPORT') {
      const exportCount = await prisma.dataExportLog.count({
        where: {
          userId,
          requestedAt: {
            gte: new Date(Date.now() - 24 * 60 * 60000), // Last 24 hours
          },
        },
      });

      if (exportCount > 3) {
        await this.triggerSecurityAlert(sessionId, userId, 'EXCESSIVE_EXPORTS', {
          exportCount,
          timeWindow: '24 hours',
        });
      }
    }
  }

  private async triggerSecurityAlert(sessionId: string, userId: string, alertType: string, data: any) {
    await prisma.securityAlert.create({
      data: {
        sessionId,
        userId,
        alertType,
        severity: this.getAlertSeverity(alertType),
        data,
        triggeredAt: new Date(),
        status: 'PENDING',
      },
    });

    // Notify security team
    await this.notifySecurityTeam(alertType, sessionId, userId, data);
  }

  private getAlertSeverity(alertType: string): string {
    const severityMap = {
      'HIGH_ACCESS_RATE': 'MEDIUM',
      'EXCESSIVE_EXPORTS': 'HIGH',
      'UNAUTHORIZED_ACCESS': 'CRITICAL',
      'DATA_BREACH': 'CRITICAL',
    };

    return severityMap[alertType] || 'LOW';
  }

  private async notifySecurityTeam(alertType: string, sessionId: string, userId: string, data: any) {
    // Implementation would use your notification service
    this.logger.warn(`Security alert: ${alertType} for session ${sessionId}, user ${userId}`, data);
  }

  private getClientIp(): string {
    // Would come from request context
    return '127.0.0.1';
  }

  private getUserAgent(): string {
    // Would come from request context
    return 'Test Client';
  }

  private async getChatMessageMetadata(userId: string) {
    const messages = await prisma.chatMessage.findMany({
      where: { userId },
      select: { metadata: true },
      take: 1,
    });

    return messages[0]?.metadata || {};
  }

  private convertToCSV(data: any): string {
    // Convert user data to CSV format
    let csv = 'Data Type,Count,Details\n';
    
    Object.entries(data).forEach(([key, value]) => {
      if (Array.isArray(value)) {
        csv += `${key},${value.length},\n`;
      } else {
        csv += `${key},1,${JSON.stringify(value)}\n`;
      }
    });
    
    return csv;
  }
}