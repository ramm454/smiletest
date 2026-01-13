import { Injectable } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import * as crypto from 'crypto';

const prisma = new PrismaClient();

@Injectable()
export class ConsentService {
  private readonly CONSENT_VERSION = '1.0';

  async obtainConsent(userId: string, sessionId: string, consentTypes: string[]) {
    // Check for existing valid consent
    const existingConsent = await this.getValidConsent(userId, sessionId, consentTypes);
    
    if (existingConsent.valid) {
      return existingConsent;
    }

    // Generate consent request
    const consentRequest = await this.createConsentRequest(userId, sessionId, consentTypes);
    
    // Store consent request
    await prisma.consentRequest.create({
      data: {
        id: consentRequest.requestId,
        userId,
        sessionId,
        consentTypes,
        requestedAt: new Date(),
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
        metadata: consentRequest.details,
      },
    });

    return consentRequest;
  }

  async grantConsent(
    requestId: string,
    userId: string,
    ipAddress: string,
    userAgent: string,
    grantAll: boolean = false
  ) {
    const request = await prisma.consentRequest.findUnique({
      where: { id: requestId },
    });

    if (!request || request.userId !== userId) {
      throw new Error('Invalid consent request');
    }

    if (new Date() > request.expiresAt) {
      throw new Error('Consent request expired');
    }

    // Record consent grant for each type
    const consentRecords = await Promise.all(
      request.consentTypes.map(async (type: string) => {
        if (!grantAll && !await this.isRequired(type)) {
          // User must explicitly grant non-required consents
          return null;
        }

        return prisma.consentGrant.create({
          data: {
            userId: request.userId,
            sessionId: request.sessionId,
            consentType: type,
            granted: true,
            grantedAt: new Date(),
            grantedVia: 'WEB',
            ipAddress,
            userAgent,
            version: this.CONSENT_VERSION,
            metadata: {
              requestId,
              granularChoices: await this.getGranularChoices(type),
            },
          },
        });
      })
    );

    // Delete the request
    await prisma.consentRequest.delete({
      where: { id: requestId },
    });

    // Log consent action
    await this.logConsentAction(userId, 'GRANT', consentRecords.filter(r => r));

    return {
      success: true,
      granted: consentRecords.filter(r => r).map(r => r.consentType),
    };
  }

  async withdrawConsent(userId: string, consentType: string, sessionId?: string) {
    const query: any = {
      userId,
      consentType,
      granted: true,
    };

    if (sessionId) {
      query.sessionId = sessionId;
    }

    // Find active consent grants
    const activeGrants = await prisma.consentGrant.findMany({
      where: query,
      orderBy: { grantedAt: 'desc' },
      take: 1,
    });

    if (activeGrants.length === 0) {
      return { success: false, message: 'No active consent found' };
    }

    // Create withdrawal record
    const withdrawal = await prisma.consentWithdrawal.create({
      data: {
        userId,
        sessionId,
        consentType,
        withdrawnAt: new Date(),
        previousGrantId: activeGrants[0].id,
        reason: 'User request',
        metadata: {},
      },
    });

    // Mark grant as withdrawn
    await prisma.consentGrant.update({
      where: { id: activeGrants[0].id },
      data: {
        withdrawnAt: new Date(),
        withdrawalId: withdrawal.id,
      },
    });

    // Trigger data deletion if required
    await this.handlePostWithdrawal(userId, consentType, sessionId);

    // Log consent action
    await this.logConsentAction(userId, 'WITHDRAW', { consentType, sessionId });

    return {
      success: true,
      withdrawalId: withdrawal.id,
      message: 'Consent withdrawn successfully',
    };
  }

  async getConsentHistory(userId: string, page: number = 1, limit: number = 50) {
    const skip = (page - 1) * limit;

    const [grants, withdrawals, total] = await Promise.all([
      prisma.consentGrant.findMany({
        where: { userId },
        include: {
          withdrawals: true,
        },
        orderBy: { grantedAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.consentWithdrawal.findMany({
        where: { userId },
        orderBy: { withdrawnAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.consentGrant.count({ where: { userId } }),
    ]);

    return {
      grants,
      withdrawals,
      pagination: {
        total,
        page,
        limit,
        pages: Math.ceil(total / limit),
      },
    };
  }

  async verifyConsent(userId: string, sessionId: string, consentType: string): Promise<boolean> {
    const validConsent = await prisma.consentGrant.findFirst({
      where: {
        userId,
        sessionId,
        consentType,
        granted: true,
        withdrawnAt: null,
        OR: [
          { expiresAt: null },
          { expiresAt: { gt: new Date() } },
        ],
      },
      orderBy: { grantedAt: 'desc' },
    });

    return !!validConsent;
  }

  async getGranularConsentOptions(consentType: string) {
    const options = {
      VIDEO_RECORDING: [
        {
          id: 'record_main',
          label: 'Record main session',
          required: true,
          description: 'Recording of the primary video stream',
        },
        {
          id: 'record_breakout',
          label: 'Record breakout rooms',
          required: false,
          description: 'Recording of breakout room sessions',
        },
        {
          id: 'record_chat',
          label: 'Include chat in recording',
          required: false,
          description: 'Save chat messages with recording',
        },
        {
          id: 'allow_download',
          label: 'Allow downloading',
          required: false,
          description: 'Allow others to download recording',
        },
        {
          id: 'retention_period',
          label: 'Retention period',
          required: true,
          options: ['30 days', '90 days', '1 year', 'Indefinite'],
          default: '90 days',
        },
      ],
      DATA_PROCESSING: [
        {
          id: 'transcription',
          label: 'Audio transcription',
          required: false,
          description: 'Convert audio to text for accessibility',
        },
        {
          id: 'sentiment_analysis',
          label: 'Sentiment analysis',
          required: false,
          description: 'Analyze engagement and feedback',
        },
        {
          id: 'quality_analytics',
          label: 'Quality analytics',
          required: true,
          description: 'Basic connection quality monitoring',
        },
        {
          id: 'behavioral_analytics',
          label: 'Behavioral analytics',
          required: false,
          description: 'Analyze interaction patterns',
        },
      ],
      THIRD_PARTY_SHARING: [
        {
          id: 'payment_processor',
          label: 'Payment processing',
          required: true,
          description: 'Share with Stripe for payment processing',
        },
        {
          id: 'transcription_service',
          label: 'Transcription services',
          required: false,
          description: 'Share with AWS Transcribe',
        },
        {
          id: 'analytics_platform',
          label: 'Analytics platforms',
          required: false,
          description: 'Share with Google Analytics/Mixpanel',
        },
        {
          id: 'marketing_partners',
          label: 'Marketing partners',
          required: false,
          description: 'Share with advertising partners',
        },
      ],
    };

    return options[consentType] || [];
  }

  async updateConsentPreferences(userId: string, preferences: any) {
    // Store user's consent preferences
    await prisma.userConsentPreference.upsert({
      where: { userId },
      update: {
        preferences,
        updatedAt: new Date(),
      },
      create: {
        userId,
        preferences,
      },
    });

    // Apply preferences to future sessions
    await this.applyDefaultPreferences(userId, preferences);

    return { success: true };
  }

  async getCookieConsent(userId: string) {
    const categories = {
      necessary: {
        name: 'Necessary',
        description: 'Essential for website functionality',
        alwaysActive: true,
        cookies: ['session_id', 'csrf_token'],
      },
      analytics: {
        name: 'Analytics',
        description: 'Help us improve our service',
        active: await this.verifyConsent(userId, 'global', 'ANALYTICS_COOKIES'),
        cookies: ['_ga', '_gid', '_gat'],
      },
      marketing: {
        name: 'Marketing',
        description: 'Personalized advertising',
        active: await this.verifyConsent(userId, 'global', 'MARKETING_COOKIES'),
        cookies: ['_fbp', 'fr'],
      },
      preferences: {
        name: 'Preferences',
        description: 'Remember your settings',
        active: true, // Always active as it's for user preferences
        cookies: ['consent_preferences', 'language'],
      },
    };

    return categories;
  }

  async recordConsentProof(
    userId: string,
    consentType: string,
    proof: {
      method: 'WEB' | 'API' | 'MOBILE';
      ipAddress: string;
      userAgent: string;
      timestamp: string;
      sessionId?: string;
    }
  ) {
    // Store cryptographic proof of consent
    const proofHash = crypto
      .createHash('sha256')
      .update(JSON.stringify({ userId, consentType, ...proof }))
      .digest('hex');

    await prisma.consentProof.create({
      data: {
        userId,
        consentType,
        proofHash,
        method: proof.method,
        ipAddress: proof.ipAddress,
        userAgent: proof.userAgent,
        timestamp: new Date(proof.timestamp),
        sessionId: proof.sessionId,
        metadata: proof,
      },
    });

    return { proofHash };
  }

  async sendConsentReminder(userId: string, consentType: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { email: true, firstName: true },
    });

    if (!user) {
      throw new Error('User not found');
    }

    // Check last reminder
    const lastReminder = await prisma.consentReminder.findFirst({
      where: { userId, consentType },
      orderBy: { sentAt: 'desc' },
    });

    // Don't send more than one reminder per week
    if (lastReminder && Date.now() - lastReminder.sentAt.getTime() < 7 * 24 * 60 * 60 * 1000) {
      return { sent: false, reason: 'Too soon since last reminder' };
    }

    // Store reminder record
    await prisma.consentReminder.create({
      data: {
        userId,
        consentType,
        sentAt: new Date(),
        method: 'EMAIL',
      },
    });

    // Send email (in production, integrate with email service)
    const emailContent = this.generateConsentReminderEmail(user, consentType);
    
    return {
      sent: true,
      to: user.email,
      content: emailContent,
    };
  }

  private async createConsentRequest(userId: string, sessionId: string, consentTypes: string[]) {
    const requestId = `consent-${Date.now()}-${crypto.randomBytes(8).toString('hex')}`;
    
    const details = await Promise.all(
      consentTypes.map(async (type) => ({
        type,
        required: await this.isRequired(type),
        description: this.getConsentDescription(type),
        granularOptions: await this.getGranularConsentOptions(type),
        legalBasis: this.getLegalBasis(type),
        consequences: this.getConsequences(type),
      }))
    );

    return {
      requestId,
      userId,
      sessionId,
      consentTypes,
      details,
      expiresIn: '24 hours',
      required: details.filter(d => d.required).map(d => d.type),
      optional: details.filter(d => !d.required).map(d => d.type),
    };
  }

  private async getValidConsent(userId: string, sessionId: string, consentTypes: string[]) {
    const validations = await Promise.all(
      consentTypes.map(type => this.verifyConsent(userId, sessionId, type))
    );

    const allValid = validations.every(v => v);
    const missing = consentTypes.filter((_, i) => !validations[i]);

    return {
      valid: allValid,
      missing,
      needsRenewal: await this.needsRenewal(userId, consentTypes),
    };
  }

  private async needsRenewal(userId: string, consentTypes: string[]) {
    // Check if any consent is older than 1 year (GDPR recommends annual renewal)
    const oneYearAgo = new Date();
    oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);

    const oldConsents = await prisma.consentGrant.count({
      where: {
        userId,
        consentType: { in: consentTypes },
        grantedAt: { lt: oneYearAgo },
        withdrawnAt: null,
      },
    });

    return oldConsents > 0;
  }

  private async isRequired(consentType: string): Promise<boolean> {
    const requiredTypes = [
      'NECESSARY_COOKIES',
      'SESSION_PARTICIPATION', // Required to use the service
      'BASIC_ANALYTICS', // Legitimate interest, not strictly required
    ];

    return requiredTypes.includes(consentType);
  }

  private getConsentDescription(consentType: string): string {
    const descriptions = {
      VIDEO_RECORDING: 'Recording of video and audio for on-demand viewing',
      AUDIO_RECORDING: 'Recording of audio only',
      CHAT_STORAGE: 'Storage of chat messages',
      DATA_ANALYTICS: 'Analysis of usage patterns for service improvement',
      MARKETING: 'Receiving marketing communications',
      THIRD_PARTY_SHARING: 'Sharing data with trusted partners',
      COOKIES: 'Use of cookies for functionality and analytics',
    };

    return descriptions[consentType] || 'General data processing consent';
  }

  private getLegalBasis(consentType: string): string {
    const basis = {
      VIDEO_RECORDING: 'Explicit Consent (GDPR Article 9) - biometric data',
      AUDIO_RECORDING: 'Consent (GDPR Article 6)',
      CHAT_STORAGE: 'Consent (GDPR Article 6)',
      DATA_ANALYTICS: 'Legitimate Interest (GDPR Article 6)',
      MARKETING: 'Consent (GDPR Article 6)',
      THIRD_PARTY_SHARING: 'Consent (GDPR Article 6)',
      COOKIES: 'Consent (ePrivacy Directive)',
    };

    return basis[consentType] || 'Consent (GDPR Article 6)';
  }

  private getConsequences(consentType: string): string {
    const consequences = {
      VIDEO_RECORDING: 'Without consent, you cannot participate in recorded sessions',
      AUDIO_RECORDING: 'Without consent, audio will not be saved',
      CHAT_STORAGE: 'Without consent, chat messages will be deleted after session',
      DATA_ANALYTICS: 'Without consent, basic analytics still collected under legitimate interest',
      MARKETING: 'Without consent, no marketing communications will be sent',
      THIRD_PARTY_SHARING: 'Without consent, data not shared with third parties (except necessary processors)',
    };

    return consequences[consentType] || 'Service limitations may apply';
  }

  private async getGranularChoices(consentType: string) {
    // In a real implementation, this would capture user's specific choices
    // For now, return default selections
    const options = await this.getGranularConsentOptions(consentType);
    
    return options.map(opt => ({
      id: opt.id,
      selected: opt.required || opt.default !== undefined,
      value: opt.default || true,
    }));
  }

  private async logConsentAction(userId: string, action: string, data: any) {
    await prisma.consentAuditLog.create({
      data: {
        userId,
        action,
        data,
        timestamp: new Date(),
        ipAddress: 'system', // Would come from request context
        userAgent: 'system',
      },
    });
  }

  private async handlePostWithdrawal(userId: string, consentType: string, sessionId?: string) {
    // Implement data deletion based on consent withdrawal
    switch (consentType) {
      case 'VIDEO_RECORDING':
        await this.deleteRecordings(userId, sessionId);
        break;
      case 'MARKETING':
        await this.unsubscribeFromMarketing(userId);
        break;
      case 'DATA_ANALYTICS':
        await this.anonymizeAnalytics(userId);
        break;
      case 'THIRD_PARTY_SHARING':
        await this.notifyThirdParties(userId, 'WITHDRAWAL');
        break;
    }

    // Log deletion action
    await this.logConsentAction(userId, 'POST_WITHDRAWAL_DELETION', {
      consentType,
      sessionId,
      actions: ['data_deletion', 'third_party_notification'],
    });
  }

  private async deleteRecordings(userId: string, sessionId?: string) {
    const where: any = {
      session: {
        participants: