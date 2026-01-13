import { Injectable } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { WebRTCGateway } from '../websocket/webrtc.gateway';

const prisma = new PrismaClient();

@Injectable()
export class QualityMonitorService {
  constructor(private readonly webRTCGateway: WebRTCGateway) {}

  async logQualityMetrics(sessionId: string, userId: string, metrics: any) {
    const qualityRecord = await prisma.qualityMetrics.create({
      data: {
        sessionId,
        userId,
        bitrate: metrics.bitrate,
        latency: metrics.latency,
        packetLoss: metrics.packetLoss,
        jitter: metrics.jitter,
        resolution: metrics.resolution,
        frameRate: metrics.frameRate,
        cpuUsage: metrics.cpuUsage,
        memoryUsage: metrics.memoryUsage,
      },
    });

    // Check if quality is poor and notify
    if (this.isPoorQuality(metrics)) {
      await this.notifyPoorQuality(sessionId, userId, metrics);
    }

    return qualityRecord;
  }

  async getSessionQualityReport(sessionId: string) {
    const metrics = await prisma.qualityMetrics.findMany({
      where: { sessionId },
      orderBy: { timestamp: 'asc' },
    });

    if (metrics.length === 0) {
      return null;
    }

    // Calculate averages
    const averages = {
      bitrate: this.calculateAverage(metrics, 'bitrate'),
      latency: this.calculateAverage(metrics, 'latency'),
      packetLoss: this.calculateAverage(metrics, 'packetLoss'),
      jitter: this.calculateAverage(metrics, 'jitter'),
    };

    // Identify issues
    const issues = this.identifyQualityIssues(metrics);

    // Get participant-specific quality
    const participantQuality = await this.getParticipantQuality(sessionId);

    return {
      sessionId,
      averages,
      issues,
      participantQuality,
      timeline: metrics.map(m => ({
        timestamp: m.timestamp,
        bitrate: m.bitrate,
        latency: m.latency,
        packetLoss: m.packetLoss,
      })),
    };
  }

  async getParticipantQuality(sessionId: string) {
    const participants = await prisma.liveSessionParticipant.findMany({
      where: { sessionId },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });

    const qualityData = await Promise.all(
      participants.map(async (participant) => {
        const latestMetrics = await prisma.qualityMetrics.findFirst({
          where: {
            sessionId,
            userId: participant.userId,
          },
          orderBy: {
            timestamp: 'desc',
          },
        });

        return {
          userId: participant.userId,
          name: `${participant.user.firstName} ${participant.user.lastName}`,
          qualityScore: this.calculateQualityScore(latestMetrics),
          metrics: latestMetrics,
        };
      })
    );

    return qualityData;
  }

  async triggerQualityAdaptation(sessionId: string, userId: string, issueType: string) {
    const adaptation = this.getAdaptationStrategy(issueType);
    
    // Notify client to adjust settings
    this.webRTCGateway.server.to(sessionId).emit('quality-adaptation', {
      userId,
      adaptation,
      timestamp: new Date().toISOString(),
    });

    return adaptation;
  }

  private isPoorQuality(metrics: any): boolean {
    return (
      metrics.packetLoss > 5 || // > 5% packet loss
      metrics.latency > 300 || // > 300ms latency
      metrics.bitrate < 500 || // < 500 kbps
      metrics.jitter > 50 // > 50ms jitter
    );
  }

  private async notifyPoorQuality(sessionId: string, userId: string, metrics: any) {
    console.log(`Poor quality detected for user ${userId} in session ${sessionId}:`, metrics);
    
    // Notify the user
    this.webRTCGateway.server.to(sessionId).emit('quality-alert', {
      userId,
      metrics,
      suggestions: this.getQualitySuggestions(metrics),
    });
  }

  private calculateAverage(metrics: any[], field: string): number {
    const sum = metrics.reduce((acc, m) => acc + (m[field] || 0), 0);
    return sum / metrics.length;
  }

  private identifyQualityIssues(metrics: any[]): string[] {
    const issues = [];
    
    if (metrics.some(m => m.packetLoss > 10)) {
      issues.push('High packet loss detected');
    }
    
    if (metrics.some(m => m.latency > 500)) {
      issues.push('High latency detected');
    }
    
    if (metrics.some(m => m.bitrate < 300)) {
      issues.push('Low bitrate detected');
    }
    
    return issues;
  }

  private calculateQualityScore(metrics: any): number {
    if (!metrics) return 0;
    
    let score = 100;
    
    // Deduct points for issues
    if (metrics.packetLoss > 5) score -= 20;
    if (metrics.latency > 200) score -= 15;
    if (metrics.bitrate < 500) score -= 25;
    if (metrics.jitter > 30) score -= 10;
    
    return Math.max(0, Math.min(100, score));
  }

  private getAdaptationStrategy(issueType: string): any {
    const strategies = {
      'high-latency': {
        action: 'reduce-resolution',
        targetResolution: '480p',
        bitrate: 800000,
      },
      'high-packet-loss': {
        action: 'enable-fec',
        fecPercentage: 20,
        priority: 'audio',
      },
      'low-bandwidth': {
        action: 'reduce-framerate',
        targetFramerate: 15,
        bitrate: 400000,
      },
      'high-cpu': {
        action: 'disable-video',
        enableAudioOnly: true,
      },
    };

    return strategies[issueType] || { action: 'maintain-current' };
  }

  private getQualitySuggestions(metrics: any): string[] {
    const suggestions = [];
    
    if (metrics.packetLoss > 5) {
      suggestions.push('Check your internet connection');
      suggestions.push('Try switching to a wired connection');
    }
    
    if (metrics.latency > 200) {
      suggestions.push('Close bandwidth-intensive applications');
      suggestions.push('Connect to a closer server if available');
    }
    
    if (metrics.bitrate < 500) {
      suggestions.push('Reduce video resolution');
      suggestions.push('Disable HD video');
    }
    
    return suggestions;
  }
}