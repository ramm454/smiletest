import { Injectable } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();

@Injectable()
export class DataMappingService {
  async generateDataInventory() {
    const inventory = {
      generatedAt: new Date().toISOString(),
      dataFlows: await this.mapDataFlows(),
      dataCategories: await this.categorizeData(),
      processingPurposes: await this.identifyPurposes(),
      retentionPeriods: await this.getRetentionPeriods(),
      thirdPartyTransfers: await this.mapThirdParties(),
      legalBasis: await this.mapLegalBasis(),
      dpiasRequired: await this.identifyDPIAs(),
    };

    // Generate reports
    await this.generateRecordsOfProcessing(inventory);
    await this.generateDataFlowDiagrams(inventory);
    
    return inventory;
  }

  private async mapDataFlows() {
    return {
      userRegistration: {
        source: 'User input',
        data: ['email', 'name', 'password', 'profile_picture'],
        storage: 'PostgreSQL users table',
        processors: ['Auth0', 'SendGrid'],
        transfers: ['EU to US (if using US-based services)'],
        legalBasis: 'Contract',
      },
      liveSession: {
        source: 'User participation',
        data: ['video_stream', 'audio_stream', 'chat_messages', 'poll_responses'],
        storage: 'PostgreSQL sessions, Redis cache, S3 recordings',
        processors: ['AWS Transcribe', 'OpenAI', 'Stripe'],
        transfers: ['EU to US (AWS)'],
        legalBasis: 'Consent + Explicit Consent for biometric',
      },
      analytics: {
        source: 'System collection',
        data: ['engagement_metrics', 'quality_data', 'device_info'],
        storage: 'ClickHouse analytics DB',
        processors: ['Google Analytics', 'Mixpanel'],
        legalBasis: 'Legitimate Interest',
      },
    };
  }

  async generateRecordsOfProcessing(inventory: any) {
    const ropa = {
      controller: process.env.COMPANY_NAME || 'Your Company',
      dpo: process.env.DPO_EMAIL,
      purposes: Object.values(inventory.processingPurposes),
      categories: Object.values(inventory.dataCategories),
      recipients: inventory.thirdPartyTransfers,
      transfers: inventory.thirdPartyTransfers.filter((t: any) => t.outsideEEA),
      retention: inventory.retentionPeriods,
      security: this.getSecurityMeasures(),
    };

    const ropaPath = path.join(process.cwd(), 'gdpr', 'ropa.json');
    fs.writeFileSync(ropaPath, JSON.stringify(ropa, null, 2));

    // Also store in database for audit
    await prisma.gdprRecord.create({
      data: {
        type: 'ROPA',
        content: ropa,
        generatedAt: new Date(),
      },
    });

    return ropa;
  }

  async conductDPIA(sessionType: string, dataCategories: string[]) {
    const requiresDPIA = this.requiresDPIA(sessionType, dataCategories);
    
    if (!requiresDPIA) {
      return { requiresDPIA: false };
    }

    const dpia = {
      id: `DPIA-${Date.now()}`,
      date: new Date().toISOString(),
      description: `DPIA for ${sessionType} with ${dataCategories.join(', ')}`,
      necessity: await this.assessNecessity(),
      risks: await this.assessRisks(),
      measures: this.getRiskMitigation(),
      consultation: await this.getConsultationRequirements(),
      approval: {
        required: true,
        approver: 'DPO',
        status: 'PENDING',
      },
    };

    await prisma.dpia.create({
      data: dpia,
    });

    return dpia;
  }

  private requiresDPIA(sessionType: string, dataCategories: string[]): boolean {
    // DPIA required for:
    // 1. Systematic monitoring of public areas (Article 35(3)(c))
    // 2. Processing of special categories (Article 35(3)(b))
    // 3. Large scale processing (Article 35(3)(a))
    
    const specialCategories = ['biometric_data', 'health_data', 'political_opinions'];
    const hasSpecialData = dataCategories.some(cat => specialCategories.includes(cat));
    const isSystematicMonitoring = sessionType.includes('surveillance') || sessionType.includes('monitoring');
    
    return hasSpecialData || isSystematicMonitoring;
  }

  private async assessNecessity() {
    return {
      purpose: 'Live streaming service provision',
      legalBasis: 'Consent for participation, Contract for service',
      proportionality: 'Data minimized to necessary for service',
      alternatives: ['Audio-only mode', 'Pseudonymized participation'],
    };
  }

  private async assessRisks() {
    return {
      highRisks: [
        {
          risk: 'Unauthorized access to biometric data',
          likelihood: 'Medium',
          impact: 'High',
          score: 'High Risk',
        },
        {
          risk: 'Data breach exposing personal conversations',
          likelihood: 'Low',
          impact: 'High',
          score: 'Medium Risk',
        },
      ],
      mitigation: this.getRiskMitigation(),
    };
  }

  private getRiskMitigation() {
    return {
      technical: [
        'End-to-end encryption for sensitive sessions',
        'Access controls with role-based permissions',
        'Regular security audits and penetration testing',
        'Data minimization and pseudonymization',
      ],
      organizational: [
        'Staff GDPR training',
        'Data Protection by Design processes',
        'Incident response plan',
        'Regular DPIA reviews',
      ],
    };
  }

  private async getConsultationRequirements() {
    return {
      required: true,
      stakeholders: ['DPO', 'Legal Team', 'Security Team', 'Product Team'],
      timeline: 'Before implementation',
      documentation: 'DPIA report, risk assessment, mitigation plan',
    };
  }

  private async categorizeData() {
    const categories = {
      personalData: [
        'name', 'email', 'phone', 'ip_address', 'device_id',
        'browser_fingerprint', 'location_data', 'payment_info',
      ],
      specialCategories: [
        'biometric_data', // video/audio recordings
        'health_data', // yoga/wellness sessions may imply health status
        'political_opinions', // if discussing political topics
        'religious_beliefs', // if discussing religious topics
      ],
      sensitiveData: [
        'chat_messages', 'private_conversations', 'session_recordings',
        'engagement_metrics', 'behavioral_data',
      ],
    };

    return categories;
  }

  private async identifyPurposes() {
    return [
      {
        purpose: 'Service Provision',
        description: 'Delivering live streaming services',
        lawfulBasis: 'Contract (Article 6(1)(b))',
        retention: 'Duration of service + 30 days',
      },
      {
        purpose: 'Quality Improvement',
        description: 'Analyzing service performance',
        lawfulBasis: 'Legitimate Interest (Article 6(1)(f))',
        retention: '24 months anonymized',
      },
      {
        purpose: 'Marketing',
        description: 'Promoting related services',
        lawfulBasis: 'Consent (Article 6(1)(a))',
        retention: 'Until withdrawal',
      },
      {
        purpose: 'Compliance',
        description: 'Meeting legal obligations',
        lawfulBasis: 'Legal Obligation (Article 6(1)(c))',
        retention: 'As required by law',
      },
    ];
  }

  private async getRetentionPeriods() {
    return {
      userAccount: 'Until deletion request',
      sessionData: '30 days after session end',
      recordings: 'As specified in consent (default: 90 days)',
      chatMessages: '30 days',
      analytics: '24 months anonymized',
      paymentRecords: '7 years (tax law)',
      auditLogs: '13 months (security requirement)',
    };
  }

  private async mapThirdParties() {
    return [
      {
        name: 'Amazon Web Services',
        service: 'Cloud hosting, S3 storage',
        location: 'USA',
        transferMechanism: 'EU-US Data Privacy Framework',
        dpasigned: true,
      },
      {
        name: 'Stripe',
        service: 'Payment processing',
        location: 'USA',
        transferMechanism: 'Standard Contractual Clauses',
        dpasigned: true,
      },
      {
        name: 'SendGrid/Twilio',
        service: 'Email/SMS notifications',
        location: 'USA',
        transferMechanism: 'EU-US Data Privacy Framework',
        dpasigned: true,
      },
      {
        name: 'OpenAI',
        service: 'AI transcription/analysis',
        location: 'USA',
        transferMechanism: 'Standard Contractual Clauses',
        dpasigned: true,
      },
    ];
  }

  private async mapLegalBasis() {
    return {
      accountManagement: 'Contract (Article 6(1)(b))',
      liveStreaming: 'Consent (Article 6(1)(a))',
      recordings: 'Explicit Consent (Article 9(2)(a))',
      analytics: 'Legitimate Interest (Article 6(1)(f))',
      marketing: 'Consent (Article 6(1)(a))',
      compliance: 'Legal Obligation (Article 6(1)(c))',
    };
  }

  private async identifyDPIAs() {
    return [
      {
        scenario: 'Large-scale video processing',
        required: true,
        reason: 'Systematic monitoring + biometric data',
      },
      {
        scenario: 'AI-based sentiment analysis',
        required: true,
        reason: 'Automated decision-making + special categories',
      },
      {
        scenario: 'Cross-border health sessions',
        required: true,
        reason: 'Health data + international transfer',
      },
    ];
  }

  private getSecurityMeasures() {
    return {
      technical: [
        'Encryption at rest (AES-256)',
        'Encryption in transit (TLS 1.3)',
        'Access controls (RBAC, MFA)',
        'Regular vulnerability scanning',
        'Intrusion detection systems',
        'Data loss prevention',
      ],
      organizational: [
        'Data Protection Officer',
        'Staff training programs',
        'Incident response plan',
        'Regular audits',
        'Privacy by Design processes',
        'Data minimization principles',
      ],
      physical: [
        'Secure data centers',
        'Access logs',
        'Environmental controls',
        'Redundant systems',
      ],
    };
  }

  private async generateDataFlowDiagrams(inventory: any) {
    // Generate Mermaid.js diagrams for documentation
    const mermaidDiagram = `
graph TD
    A[User Registration] --> B[PostgreSQL DB]
    B --> C[Auth Service]
    C --> D[Live Session]
    D --> E[Video/Audio Stream]
    E --> F[WebRTC Server]
    F --> G[Recording Storage]
    G --> H[Transcription Service]
    H --> I[Analytics DB]
    D --> J[Chat Messages]
    J --> K[Redis Cache]
    K --> L[PostgreSQL Archive]
    
    subgraph "EU Region"
        B
        C
        D
        J
        K
        L
    end
    
    subgraph "USA Region"
        G
        H
        I
    end
    
    EU -->|SCCs/DPF| USA
    `;

    const diagramPath = path.join(process.cwd(), 'gdpr', 'data-flow.md');
    fs.writeFileSync(diagramPath, mermaidDiagram);

    return { diagramPath };
  }

  async getDataSubjectDetails(userId: string) {
    const userData = await this.getAllUserData(userId);
    const processingActivities = await this.getProcessingActivities(userId);
    const thirdParties = await this.getThirdPartyRecipients(userId);
    
    return {
      userId,
      dataCollected: userData,
      processingActivities,
      thirdParties,
      rights: this.getDataSubjectRights(),
    };
  }

  private async getAllUserData(userId: string) {
    const [
      profile,
      sessions,
      messages,
      recordings,
      payments,
      analytics,
    ] = await Promise.all([
      prisma.user.findUnique({ where: { id: userId } }),
      prisma.liveSessionParticipant.findMany({ where: { userId } }),
      prisma.chatMessage.findMany({ where: { userId } }),
      prisma.recording.findMany({
        where: {
          session: {
            participants: { some: { userId } },
          },
        },
      }),
      prisma.ticketPurchase.findMany({ where: { userId } }),
      prisma.qualityMetrics.findMany({ where: { userId } }),
    ]);

    return {
      profile,
      sessions: sessions.length,
      messages: messages.length,
      recordings: recordings.length,
      payments: payments.length,
      analytics: analytics.length,
    };
  }

  private async getProcessingActivities(userId: string) {
    return [
      {
        activity: 'Account Management',
        purpose: 'Service provision',
        legalBasis: 'Contract',
        data: ['email', 'name', 'profile'],
      },
      {
        activity: 'Live Participation',
        purpose: 'Streaming service',
        legalBasis: 'Consent',
        data: ['video', 'audio', 'chat', 'engagement'],
      },
      {
        activity: 'Recording Storage',
        purpose: 'On-demand viewing',
        legalBasis: 'Explicit Consent',
        data: ['biometric_data'],
      },
      {
        activity: 'Analytics',
        purpose: 'Service improvement',
        legalBasis: 'Legitimate Interest',
        data: ['usage_patterns', 'quality_metrics'],
      },
    ];
  }

  private async getThirdPartyRecipients(userId: string) {
    // Check which third parties have received this user's data
    return [
      {
        name: 'Stripe',
        dataShared: ['payment_info', 'email'],
        purpose: 'Payment processing',
        legalBasis: 'Contract',
      },
      {
        name: 'AWS Transcribe',
        dataShared: ['audio_recordings'],
        purpose: 'Transcription services',
        legalBasis: 'Consent',
      },
      {
        name: 'SendGrid',
        dataShared: ['email'],
        purpose: 'Notification delivery',
        legalBasis: 'Contract',
      },
    ];
  }

  private getDataSubjectRights() {
    return {
      access: true,
      rectification: true,
      erasure: true,
      restriction: true,
      portability: true,
      objection: true,
      automatedDecisions: false, // We don't do fully automated decision-making
      consentWithdrawal: true,
    };
  }
}