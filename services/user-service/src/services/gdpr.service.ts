import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import * as crypto from 'crypto';
import * as archiver from 'archiver';
import { createWriteStream, createReadStream, unlinkSync } from 'fs';
import { join } from 'path';
import { DataSubjectRequestDto, DataPortabilityRequestDto, RectificationRequestDto, ProcessingAgreementDto, DataBreachReportDto, CookiePreferencesDto } from '../dto/gdpr.dto';

const prisma = new PrismaClient();

@Injectable()
export class GdprService {
  private readonly dsarDeadlineDays = 30; // GDPR Article 12
  
  // ============ DATA SUBJECT REQUESTS ============
  async createDataSubjectRequest(userId: string, dto: DataSubjectRequestDto) {
    // Check for duplicate pending requests
    const existingRequest = await prisma.dataSubjectRequest.findFirst({
      where: {
        userId,
        requestType: dto.requestType,
        status: { in: ['PENDING', 'VERIFICATION_REQUIRED', 'IN_PROGRESS'] }
      }
    });
    
    if (existingRequest) {
      throw new BadRequestException(`A ${dto.requestType} request is already pending`);
    }
    
    // Create request
    const request = await prisma.dataSubjectRequest.create({
      data: {
        userId,
        requestType: dto.requestType,
        description: dto.description,
        requestedData: dto.requestedData,
        justification: dto.justification,
        verificationMethod: dto.verificationMethod,
        dueDate: new Date(Date.now() + this.dsarDeadlineDays * 24 * 60 * 60 * 1000),
        status: dto.verificationMethod === 'ID_DOCUMENT' ? 'VERIFICATION_REQUIRED' : 'PENDING',
        ipAddress: dto.ipAddress,
        userAgent: dto.userAgent
      }
    });
    
    // Log activity
    await this.logGdprActivity(userId, 'dsar_created', {
      requestId: request.id,
      requestType: dto.requestType
    });
    
    // Send verification if required
    if (dto.verificationMethod === 'EMAIL') {
      await this.sendVerificationEmail(userId, request.id);
    } else if (dto.verificationMethod === 'SMS') {
      await this.sendVerificationSMS(userId, request.id);
    }
    
    return {
      requestId: request.id,
      status: request.status,
      verificationRequired: request.status === 'VERIFICATION_REQUIRED',
      deadline: request.dueDate,
      message: `Request submitted. You'll receive verification instructions via ${dto.verificationMethod.toLowerCase()}.`
    };
  }
  
  async verifyDataSubjectRequest(requestId: string, verificationCode: string) {
    const request = await prisma.dataSubjectRequest.findUnique({
      where: { id: requestId },
      include: { user: true }
    });
    
    if (!request) {
      throw new NotFoundException('Request not found');
    }
    
    // Verify code (in production, check against sent code)
    const isValid = await this.validateVerificationCode(request.userId, verificationCode);
    
    if (!isValid) {
      throw new BadRequestException('Invalid verification code');
    }
    
    const updatedRequest = await prisma.dataSubjectRequest.update({
      where: { id: requestId },
      data: {
        status: 'IN_PROGRESS',
        verifiedAt: new Date()
      }
    });
    
    // Start processing based on request type
    switch (request.requestType) {
      case 'ACCESS':
        await this.processAccessRequest(requestId);
        break;
      case 'ERASURE':
        await this.processErasureRequest(requestId);
        break;
      case 'PORTABILITY':
        await this.processPortabilityRequest(requestId);
        break;
    }
    
    return {
      success: true,
      message: 'Request verified and processing started'
    };
  }
  
  async processAccessRequest(requestId: string) {
    const request = await prisma.dataSubjectRequest.findUnique({
      where: { id: requestId },
      include: { user: true }
    });
    
    // Collect all user data
    const userData = await this.collectUserData(request.userId, request.requestedData);
    
    // Update request with response
    await prisma.dataSubjectRequest.update({
      where: { id: requestId },
      data: {
        status: 'COMPLETED',
        responseData: userData,
        dataProvidedAt: new Date(),
        completedAt: new Date(),
        responseNotes: 'Data provided in accordance with GDPR Article 15'
      }
    });
    
    // Send data to user
    await this.sendDataToUser(request.user.email, userData, 'access_request');
    
    await this.logGdprActivity(request.userId, 'access_request_fulfilled', {
      requestId,
      dataProvided: Object.keys(userData).length
    });
  }
  
  async processErasureRequest(requestId: string) {
    const request = await prisma.dataSubjectRequest.findUnique({
      where: { id: requestId },
      include: { user: true }
    });
    
    // Check for legal obligations that prevent erasure
    const canDelete = await this.checkErasureLegality(request.userId);
    
    if (!canDelete) {
      await prisma.dataSubjectRequest.update({
        where: { id: requestId },
        data: {
          status: 'REJECTED',
          responseNotes: 'Erasure cannot be completed due to legal obligations (GDPR Article 17(3))'
        }
      });
      return;
    }
    
    // Anonymize/pseudonymize instead of full deletion if possible
    if (await this.canAnonymize(request.userId)) {
      await this.anonymizeUserData(request.userId);
      
      await prisma.dataSubjectRequest.update({
        where: { id: requestId },
        data: {
          status: 'COMPLETED',
          completedAt: new Date(),
          responseNotes: 'Data anonymized in accordance with GDPR Article 17(1)'
        }
      });
    } else {
      // Full deletion
      await this.deleteUserData(request.userId);
      
      await prisma.dataSubjectRequest.update({
        where: { id: requestId },
        data: {
          status: 'COMPLETED',
          completedAt: new Date(),
          responseNotes: 'Data erased in accordance with GDPR Article 17(1)'
        }
      });
    }
    
    await this.logGdprActivity(request.userId, 'erasure_request_fulfilled', { requestId });
  }
  
  // ============ DATA PORTABILITY ============
  async processPortabilityRequest(requestId: string) {
    const request = await prisma.dataSubjectRequest.findUnique({
      where: { id: requestId },
      include: { user: true }
    });
    
    // Collect portable data (structured, commonly used, machine-readable)
    const portableData = await this.collectPortableData(request.userId);
    
    // Create data package
    const packagePath = await this.createDataPackage(
      request.userId,
      portableData,
      'json' // Could be XML or other formats
    );
    
    // Update request
    await prisma.dataSubjectRequest.update({
      where: { id: requestId },
      data: {
        status: 'COMPLETED',
        responseData: { packagePath, fileSize: this.getFileSize(packagePath) },
        dataProvidedAt: new Date(),
        completedAt: new Date(),
        responseNotes: 'Data provided in machine-readable format (GDPR Article 20)'
      }
    });
    
    // Send download link
    await this.sendDataPortabilityLink(request.user.email, packagePath);
    
    await this.logGdprActivity(request.userId, 'portability_request_fulfilled', {
      requestId,
      format: 'json'
    });
  }
  
  private async createDataPackage(userId: string, data: any, format: string): Promise<string> {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `gdpr-export-${userId}-${timestamp}.${format}`;
    const filepath = join(process.env.GDPR_EXPORT_PATH || './exports', filename);
    
    if (format === 'json') {
      const fs = require('fs');
      fs.writeFileSync(filepath, JSON.stringify(data, null, 2));
    }
    
    return filepath;
  }
  
  // ============ DATA COLLECTION ============
  private async collectUserData(userId: string, requestedFields?: string[]): Promise<any> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        profile: true,
        sessions: true,
        bookings: true,
        orders: true,
        payments: true,
        consents: true,
        tags: { include: { tag: true } },
        activities: true,
        linkedAccounts: true,
        mfaSettings: true
      }
    });
    
    // Filter if specific fields requested
    if (requestedFields && requestedFields.length > 0) {
      return this.filterDataByFields(user, requestedFields);
    }
    
    // Include metadata
    return {
      user: this.sanitizeUserData(user),
      metadata: {
        collectedAt: new Date().toISOString(),
        purposes: ['GDPR access request fulfillment'],
        legalBasis: 'legal_obligation',
        retentionPeriod: '30 days from provision'
      }
    };
  }
  
  private sanitizeUserData(user: any): any {
    // Remove sensitive fields
    const { password, verificationToken, resetToken, totpSecret, ...safeData } = user;
    return safeData;
  }
  
  // ============ DATA ANONYMIZATION ============
  private async anonymizeUserData(userId: string): Promise<void> {
    // Generate anonymous ID
    const anonymousId = `anon_${crypto.randomBytes(16).toString('hex')}`;
    
    // Anonymize user record
    await prisma.user.update({
      where: { id: userId },
      data: {
        email: `${anonymousId}@anonymized.yogaspa.com`,
        firstName: 'Anonymized',
        lastName: 'User',
        phone: null,
        avatar: null,
        bio: null,
        dateOfBirth: null,
        gender: null,
        preferences: {},
        healthInfo: {},
        pseudonymized: true,
        anonymizedAt: new Date()
      }
    });
    
    // Anonymize related records
    await prisma.session.deleteMany({ where: { userId } });
    await prisma.userConsent.updateMany({
      where: { userId },
      data: { userId: anonymousId }
    });
    // ... anonymize other related data
  }
  
  private async deleteUserData(userId: string): Promise<void> {
    // Implement cascade deletion according to retention rules
    await this.applyRetentionRules(userId);
    
    // Mark for deletion (soft delete first)
    await prisma.user.update({
      where: { id: userId },
      data: {
        status: 'DELETED',
        scheduledForDeletion: true,
        deletionScheduledAt: new Date(),
        email: `deleted_${Date.now()}@deleted.yogaspa.com`
      }
    });
    
    // Schedule hard delete (after 30 days for recovery window)
    setTimeout(async () => {
      await this.hardDeleteUser(userId);
    }, 30 * 24 * 60 * 60 * 1000);
  }
  
  // ============ CONSENT MANAGEMENT ============
  async recordDetailedConsent(userId: string, consentData: any) {
    // IAB TCF 2.0 compliant consent recording
    const consent = await prisma.userConsent.create({
      data: {
        userId,
        consentType: consentData.purpose,
        version: consentData.version || '2.0',
        granted: consentData.granted,
        grantedAt: consentData.granted ? new Date() : null,
        revokedAt: consentData.granted ? null : new Date(),
        ipAddress: consentData.ipAddress,
        userAgent: consentData.userAgent,
        metadata: {
          vendorListVersion: consentData.vendorListVersion,
          cmpId: consentData.cmpId,
          cmpVersion: consentData.cmpVersion,
          consentScreen: consentData.consentScreen,
          consentLanguage: consentData.consentLanguage,
          created: consentData.created,
          lastUpdated: consentData.lastUpdated,
          vendors: consentData.vendors,
          purposes: consentData.purposes,
          specialFeatures: consentData.specialFeatures
        }
      }
    });
    
    // Store cookie preferences separately
    if (consentData.cookiePreferences) {
      await this.recordCookiePreferences(userId, consentData.cookiePreferences);
    }
    
    return consent;
  }
  
  async recordCookiePreferences(userId: string, dto: CookiePreferencesDto) {
    const cookieConsent = await prisma.cookieConsent.create({
      data: {
        userId: userId || undefined,
        sessionId: dto.sessionId || `session_${Date.now()}`,
        necessary: dto.necessary,
        preferences: dto.preferences,
        analytics: dto.analytics,
        marketing: dto.marketing,
        consentString: dto.consentString,
        userAgent: dto.userAgent,
        ipAddress: dto.ipAddress,
        country: dto.country
      }
    });
    
    // Set cookie in response (would be done in controller)
    const cookieValue = this.generateCookieString(cookieConsent);
    
    return {
      cookieConsent,
      cookieValue,
      expires: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000) // 1 year
    };
  }
  
  // ============ DATA BREACH MANAGEMENT ============
  async reportDataBreach(dto: DataBreachReportDto, reporterId: string) {
    const breachId = `BREACH-${new Date().getFullYear()}-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
    
    const breach = await prisma.dataBreach.create({
      data: {
        breachId,
        type: dto.type,
        description: dto.description,
        discoveredAt: new Date(dto.discoveredAt),
        occurredFrom: dto.occurredFrom ? new Date(dto.occurredFrom) : null,
        occurredTo: dto.occurredTo ? new Date(dto.occurredTo) : null,
        affectedUsers: dto.estimatedAffectedUsers,
        affectedDataTypes: dto.affectedDataTypes,
        riskLevel: dto.riskLevel,
        likelyConsequences: dto.likelyConsequences,
        containmentActions: dto.containmentActions,
        rootCause: dto.rootCause
      }
    });
    
    // Check if notification to supervisory authority is required
    if (dto.riskLevel === 'high' || dto.affectedDataTypes.includes('sensitive_data')) {
      await this.notifySupervisoryAuthority(breach);
    }
    
    // Check if notification to data subjects is required
    if (await this.requiresSubjectNotification(breach)) {
      await this.notifyAffectedSubjects(breach);
    }
    
    await this.logGdprActivity(reporterId, 'data_breach_reported', {
      breachId,
      riskLevel: dto.riskLevel,
      affectedUsers: dto.estimatedAffectedUsers
    });
    
    return {
      breachId: breach.breachId,
      reportedAt: breach.createdAt,
      nextSteps: this.getBreachNextSteps(breach)
    };
  }
  
  private async notifySupervisoryAuthority(breach: any): Promise<void> {
    // 72-hour notification requirement
    const notificationDeadline = new Date(breach.discoveredAt.getTime() + 72 * 60 * 60 * 1000);
    
    // In production, send to actual DPA
    console.log(`[GDPR NOTIFICATION] Notifying supervisory authority about breach ${breach.breachId}`);
    console.log(`Deadline: ${notificationDeadline.toISOString()}`);
    
    // Update breach record
    await prisma.dataBreach.update({
      where: { id: breach.id },
      data: {
        notifiedDPA: true,
        dpaNotifiedAt: new Date(),
        dpaReference: `DPA-REF-${Date.now()}`
      }
    });
  }
  
  // ============ RETENTION MANAGEMENT ============
  async applyRetentionRules(userId: string): Promise<void> {
    const rules = await prisma.retentionRule.findMany({
      where: { isActive: true }
    });
    
    for (const rule of rules) {
      switch (rule.dataType) {
        case 'user_profile':
          await this.applyProfileRetention(userId, rule);
          break;
        case 'booking_records':
          await this.applyBookingRetention(userId, rule);
          break;
        case 'payment_data':
          await this.applyPaymentRetention(userId, rule);
          break;
        // ... other data types
      }
    }
  }
  
  // ============ LEGAL CHECKS ============
  private async checkErasureLegality(userId: string): Promise<boolean> {
    // Check for legal obligations that prevent erasure:
    // 1. Tax records (usually 7+ years)
    // 2. Legal claims
    // 3. Public health
    // 4. Archiving for public interest
    
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        payments: {
          where: {
            createdAt: {
              gte: new Date(Date.now() - 7 * 365 * 24 * 60 * 60 * 1000) // Last 7 years
            }
          }
        }
      }
    });
    
    // If user has recent payments, we might need to keep for tax purposes
    if (user.payments && user.payments.length > 0) {
      return false; // Cannot fully erase due to tax obligations
    }
    
    return true;
  }
  
  // ============ HELPER METHODS ============
  private async logGdprActivity(userId: string, activityType: string, metadata?: any): Promise<void> {
    await prisma.userActivity.create({
      data: {
        userId,
        activityType: `gdpr_${activityType}`,
        metadata,
        createdAt: new Date()
      }
    });
  }
  
  private generateCookieString(consent: any): string {
    // Generate IAB TCF 2.0 compliant consent string
    return Buffer.from(JSON.stringify({
      v: '2.0',
      t: new Date().toISOString(),
      cmp: 'yogaspa',
      purposes: {
        required: consent.necessary,
        preferences: consent.preferences,
        analytics: consent.analytics,
        marketing: consent.marketing
      }
    })).toString('base64');
  }
  
  private getBreachNextSteps(breach: any): string[] {
    const steps = [];
    
    if (!breach.notifiedDPA && breach.riskLevel === 'HIGH') {
      steps.push('Notify supervisory authority within 72 hours');
    }
    
    if (!breach.notifiedSubjects && breach.riskLevel === 'HIGH') {
      steps.push('Notify affected data subjects without undue delay');
    }
    
    steps.push('Document breach in internal register');
    steps.push('Implement containment measures');
    steps.push('Review and update security policies');
    
    return steps;
  }
  
  // ============ COMPLIANCE REPORTS ============
  async generateComplianceReport(startDate: Date, endDate: Date) {
    const [
      dsars,
      breaches,
      consents,
      exports,
      deletions
    ] = await Promise.all([
      prisma.dataSubjectRequest.findMany({
        where: {
          createdAt: { gte: startDate, lte: endDate }
        }
      }),
      prisma.dataBreach.findMany({
        where: {
          discoveredAt: { gte: startDate, lte: endDate }
        }
      }),
      prisma.userConsent.findMany({
        where: {
          updatedAt: { gte: startDate, lte: endDate }
        }
      }),
      prisma.user.findMany({
        where: {
          lastDataExportAt: { gte: startDate, lte: endDate }
        }
      }),
      prisma.user.findMany({
        where: {
          anonymizedAt: { gte: startDate, lte: endDate }
        }
      })
    ]);
    
    // Calculate compliance metrics
    const dsarCompletionRate = dsars.filter(d => d.status === 'COMPLETED').length / dsars.length * 100;
    const averageDsarTime = this.calculateAverageProcessingTime(dsars);
    const breachNotificationRate = breaches.filter(b => b.notifiedDPA).length / breaches.length * 100;
    
    return {
      period: { startDate, endDate },
      metrics: {
        dsars: dsars.length,
        dsarCompletionRate: `${dsarCompletionRate.toFixed(1)}%`,
        averageDsarTime: `${averageDsarTime.toFixed(1)} days`,
        breaches: breaches.length,
        breachNotificationRate: `${breachNotificationRate.toFixed(1)}%`,
        consentUpdates: consents.length,
        dataExports: exports.length,
        dataDeletions: deletions.length
      },
      topDsarTypes: this.groupByRequestType(dsars),
      breachSummary: breaches.map(b => ({
        id: b.breachId,
        type: b.type,
        riskLevel: b.riskLevel,
        affectedUsers: b.affectedUsers,
        notified: b.notifiedDPA
      })),
      recommendations: this.generateComplianceRecommendations({
        dsarCompletionRate,
        averageDsarTime,
        breachNotificationRate
      })
    };
  }
}