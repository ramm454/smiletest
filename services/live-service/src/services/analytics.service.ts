import { Injectable } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import * as moment from 'moment';

const prisma = new PrismaClient();

@Injectable()
export class AnalyticsService {
  async getSessionAnalytics(sessionId: string) {
    const session = await prisma.liveSession.findUnique({
      where: { id: sessionId },
      include: {
        participants: true,
        chatMessages: true,
        polls: {
          include: {
            votes: true,
          },
        },
        recordings: true,
        streamAnalytics: true,
      },
    });

    if (!session) {
      throw new Error('Session not found');
    }

    // Engagement metrics
    const engagement = {
      totalMessages: session.chatMessages.length,
      totalPolls: session.polls.length,
      totalPollVotes: session.polls.reduce((sum, poll) => sum + poll.votes.length, 0),
      averagePollParticipation: session.participants.length > 0 
        ? (session.polls.reduce((sum, poll) => sum + poll.votes.length, 0) / session.participants.length) * 100 
        : 0,
    };

    // Participant metrics
    const participantMetrics = {
      total: session.participants.length,
      byRole: this.groupBy(session.participants, 'role'),
      byStatus: this.groupBy(session.participants, 'status'),
      averageDuration: session.participants.reduce((sum, p) => sum + (p.duration || 0), 0) / session.participants.length || 0,
      retentionRate: this.calculateRetentionRate(session.participants),
    };

    // Quality metrics
    const qualityMetrics = session.streamAnalytics.length > 0 
      ? this.calculateQualityMetrics(session.streamAnalytics)
      : null;

    // Revenue metrics (if paid session)
    const revenueMetrics = session.price > 0
      ? this.calculateRevenueMetrics(session)
      : null;

    // Timeline data
    const timeline = this.generateTimelineData(session);

    return {
      session: {
        id: session.id,
        title: session.title,
        startTime: session.startTime,
        endTime: session.endedAt,
        duration: session.duration,
      },
      engagement,
      participantMetrics,
      qualityMetrics,
      revenueMetrics,
      timeline,
      recordings: session.recordings,
    };
  }

  async getInstructorAnalytics(instructorId: string, startDate: string, endDate: string) {
    const sessions = await prisma.liveSession.findMany({
      where: {
        instructorId,
        startTime: {
          gte: new Date(startDate),
          lte: new Date(endDate),
        },
      },
      include: {
        participants: true,
        chatMessages: true,
        polls: true,
        recordings: true,
        _count: {
          select: {
            participants: true,
            chatMessages: true,
            polls: true,
          },
        },
      },
      orderBy: {
        startTime: 'desc',
      },
    });

    const totalSessions = sessions.length;
    const totalParticipants = sessions.reduce((sum, s) => sum + s._count.participants, 0);
    const totalMessages = sessions.reduce((sum, s) => sum + s._count.chatMessages, 0);
    const totalRevenue = sessions.reduce((sum, s) => sum + (s.price * s._count.participants), 0);

    // Session type distribution
    const typeDistribution = this.groupBy(sessions, 'type');

    // Engagement over time
    const engagementOverTime = this.calculateEngagementOverTime(sessions);

    // Popular time slots
    const timeSlots = this.calculatePopularTimeSlots(sessions);

    // Participant retention
    const retention = this.calculateParticipantRetention(sessions);

    return {
      overview: {
        totalSessions,
        totalParticipants,
        totalMessages,
        totalRevenue,
        averageParticipants: totalSessions > 0 ? totalParticipants / totalSessions : 0,
        averageRating: await this.getAverageRating(instructorId),
      },
      distribution: {
        byType: typeDistribution,
        byTime: timeSlots,
      },
      engagement: engagementOverTime,
      retention,
      sessions: sessions.map(s => ({
        id: s.id,
        title: s.title,
        date: s.startTime,
        participants: s._count.participants,
        messages: s._count.chatMessages,
        revenue: s.price * s._count.participants,
      })),
    };
  }

  async getPlatformAnalytics(startDate: string, endDate: string) {
    const sessions = await prisma.liveSession.findMany({
      where: {
        startTime: {
          gte: new Date(startDate),
          lte: new Date(endDate),
        },
        status: { in: ['LIVE', 'ENDED'] },
      },
      include: {
        _count: {
          select: {
            participants: true,
            chatMessages: true,
          },
        },
      },
    });

    const totalSessions = sessions.length;
    const totalParticipants = sessions.reduce((sum, s) => sum + s._count.participants, 0);
    const totalMessages = sessions.reduce((sum, s) => sum + s._count.chatMessages, 0);
    const totalRevenue = sessions.reduce((sum, s) => sum + (s.price * s._count.participants), 0);
    const averageSessionDuration = sessions.reduce((sum, s) => sum + s.duration, 0) / totalSessions || 0;

    // Growth metrics
    const growth = await this.calculateGrowthMetrics(startDate, endDate);

    // Geographic distribution
    const geographicDistribution = await this.getGeographicDistribution(startDate, endDate);

    // Device distribution
    const deviceDistribution = await this.getDeviceDistribution(startDate, endDate);

    // Revenue trends
    const revenueTrends = await this.calculateRevenueTrends(startDate, endDate);

    return {
      overview: {
        totalSessions,
        totalParticipants,
        totalMessages,
        totalRevenue,
        averageSessionDuration,
        averageParticipants: totalSessions > 0 ? totalParticipants / totalSessions : 0,
      },
      growth,
      geographic: geographicDistribution,
      devices: deviceDistribution,
      revenue: revenueTrends,
      topInstructors: await this.getTopInstructors(startDate, endDate),
      popularSessions: await this.getPopularSessions(startDate, endDate),
    };
  }

  async exportAnalytics(sessionId: string, format: 'csv' | 'json' | 'pdf') {
    const analytics = await this.getSessionAnalytics(sessionId);

    switch (format) {
      case 'csv':
        return this.convertToCSV(analytics);
      case 'json':
        return analytics;
      case 'pdf':
        return this.generatePDF(analytics);
    }
  }

  private calculateRetentionRate(participants: any[]): number {
    const joined = participants.filter(p => p.joinedAt).length;
    const completed = participants.filter(p => p.duration && p.duration > (p.session?.duration || 60) * 0.8).length;
    
    return joined > 0 ? (completed / joined) * 100 : 0;
  }

  private calculateQualityMetrics(streamAnalytics: any[]) {
    const latest = streamAnalytics[streamAnalytics.length - 1];
    
    return {
      peakViewers: Math.max(...streamAnalytics.map(a => a.peakViewers)),
      averageViewers: streamAnalytics.reduce((sum, a) => sum + a.averageViewers, 0) / streamAnalytics.length,
      averageBitrate: streamAnalytics.reduce((sum, a) => sum + (a.averageBitrate || 0), 0) / streamAnalytics.length,
      averageLatency: streamAnalytics.reduce((sum, a) => sum + (a.avgLatency || 0), 0) / streamAnalytics.length,
      bufferRate: latest?.bufferRate || 0,
      retentionRate: latest?.retentionRate || 0,
    };
  }

  private calculateRevenueMetrics(session: any) {
    const revenue = session.price * session.participants.length;
    const estimatedRevenue = session.price * session.maxParticipants;
    
    return {
      actualRevenue: revenue,
      estimatedRevenue,
      conversionRate: (session.participants.length / session.maxParticipants) * 100,
      averageRevenuePerUser: session.participants.length > 0 ? revenue / session.participants.length : 0,
    };
  }

  private generateTimelineData(session: any) {
    const timeline = [];
    const startTime = new Date(session.startTime);
    const duration = session.duration || 60;
    
    for (let i = 0; i <= duration; i += 5) {
      const time = new Date(startTime.getTime() + i * 60000);
      
      timeline.push({
        time: time.toISOString(),
        participants: this.getParticipantsAtTime(session.participants, i),
        messages: this.getMessagesAtTime(session.chatMessages, time, 5),
      });
    }
    
    return timeline;
  }

  private groupBy(array: any[], key: string) {
    return array.reduce((result, item) => {
      const value = item[key];
      result[value] = (result[value] || 0) + 1;
      return result;
    }, {});
  }

  private async calculateGrowthMetrics(startDate: string, endDate: string) {
    const previousPeriod = {
      start: moment(startDate).subtract(1, 'month').toISOString(),
      end: moment(endDate).subtract(1, 'month').toISOString(),
    };

    const currentSessions = await prisma.liveSession.count({
      where: {
        startTime: {
          gte: new Date(startDate),
          lte: new Date(endDate),
        },
      },
    });

    const previousSessions = await prisma.liveSession.count({
      where: {
        startTime: {
          gte: new Date(previousPeriod.start),
          lte: new Date(previousPeriod.end),
        },
      },
    });

    const growthRate = previousSessions > 0 
      ? ((currentSessions - previousSessions) / previousSessions) * 100 
      : 100;

    return {
      currentSessions,
      previousSessions,
      growthRate,
    };
  }

  private async getGeographicDistribution(startDate: string, endDate: string) {
    const analytics = await prisma.streamAnalytics.findMany({
      where: {
        timestamp: {
          gte: new Date(startDate),
          lte: new Date(endDate),
        },
        countries: {
          not: null,
        },
      },
      select: {
        countries: true,
      },
    });

    const distribution = {};
    analytics.forEach(a => {
      const countries = a.countries as any[];
      countries?.forEach(country => {
        distribution[country.country] = (distribution[country.country] || 0) + country.viewers;
      });
    });

    return distribution;
  }

  private async getDeviceDistribution(startDate: string, endDate: string) {
    const participants = await prisma.liveSessionParticipant.findMany({
      where: {
        joinedAt: {
          gte: new Date(startDate),
          lte: new Date(endDate),
        },
        deviceType: {
          not: null,
        },
      },
      select: {
        deviceType: true,
      },
    });

    return this.groupBy(participants, 'deviceType');
  }

  private async calculateRevenueTrends(startDate: string, endDate: string) {
    const sessions = await prisma.liveSession.findMany({
      where: {
        startTime: {
          gte: new Date(startDate),
          lte: new Date(endDate),
        },
        price: {
          gt: 0,
        },
      },
      include: {
        _count: {
          select: {
            participants: true,
          },
        },
      },
      orderBy: {
        startTime: 'asc',
      },
    });

    // Group by day
    const dailyRevenue = {};
    sessions.forEach(session => {
      const date = moment(session.startTime).format('YYYY-MM-DD');
      const revenue = session.price * session._count.participants;
      dailyRevenue[date] = (dailyRevenue[date] || 0) + revenue;
    });

    return dailyRevenue;
  }

  private async getTopInstructors(startDate: string, endDate: string, limit: number = 10) {
    const sessions = await prisma.liveSession.groupBy({
      by: ['instructorId'],
      where: {
        startTime: {
          gte: new Date(startDate),
          lte: new Date(endDate),
        },
      },
      _count: {
        id: true,
      },
      _sum: {
        price: true,
      },
      orderBy: {
        _count: {
          id: 'desc',
        },
      },
      take: limit,
    });

    return await Promise.all(
      sessions.map(async (session) => {
        const instructor = await prisma.user.findUnique({
          where: { id: session.instructorId },
          select: {
            id: true,
            firstName: true,
            lastName: true,
            avatar: true,
          },
        });

        return {
          instructor,
          sessionCount: session._count.id,
          totalRevenue: session._sum.price || 0,
        };
      })
    );
  }

  private async getPopularSessions(startDate: string, endDate: string, limit: number = 10) {
    const sessions = await prisma.liveSession.findMany({
      where: {
        startTime: {
          gte: new Date(startDate),
          lte: new Date(endDate),
        },
      },
      include: {
        _count: {
          select: {
            participants: true,
          },
        },
        instructor: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
      },
      orderBy: {
        participants: {
          _count: 'desc',
        },
      },
      take: limit,
    });

    return sessions.map(session => ({
      id: session.id,
      title: session.title,
      instructor: session.instructor,
      participants: session._count.participants,
      date: session.startTime,
      type: session.type,
    }));
  }

  private async getAverageRating(instructorId: string) {
    const ratings = await prisma.$queryRaw`
      SELECT AVG(rating) as averageRating
      FROM session_reviews
      WHERE instructor_id = ${instructorId}
    `;
    
    return ratings[0]?.averageRating || 0;
  }

  private getParticipantsAtTime(participants: any[], minutes: number) {
    return participants.filter(p => {
      const joinedAt = p.joinedAt ? new Date(p.joinedAt).getTime() : 0;
      const leftAt = p.leftAt ? new Date(p.leftAt).getTime() : Date.now();
      const time = minutes * 60000;
      
      return joinedAt <= time && (!p.leftAt || leftAt >= time);
    }).length;
  }

  private getMessagesAtTime(messages: any[], time: Date, windowMinutes: number) {
    const startTime = new Date(time.getTime() - windowMinutes * 60000);
    const endTime = new Date(time.getTime() + windowMinutes * 60000);
    
    return messages.filter(m => {
      const messageTime = new Date(m.createdAt);
      return messageTime >= startTime && messageTime <= endTime;
    }).length;
  }

  private calculateEngagementOverTime(sessions: any[]) {
    const engagement = {};
    
    sessions.forEach(session => {
      const date = moment(session.startTime).format('YYYY-MM-DD');
      const messagesPerParticipant = session._count.participants > 0 
        ? session._count.chatMessages / session._count.participants 
        : 0;
      
      if (!engagement[date]) {
        engagement[date] = {
          sessions: 0,
          totalMessages: 0,
          totalParticipants: 0,
          messagesPerParticipant: 0,
        };
      }
      
      engagement[date].sessions += 1;
      engagement[date].totalMessages += session._count.chatMessages;
      engagement[date].totalParticipants += session._count.participants;
      engagement[date].messagesPerParticipant = engagement[date].totalParticipants > 0 
        ? engagement[date].totalMessages / engagement[date].totalParticipants 
        : 0;
    });
    
    return engagement;
  }

  private calculatePopularTimeSlots(sessions: any[]) {
    const timeSlots = {
      'Morning (6am-12pm)': 0,
      'Afternoon (12pm-5pm)': 0,
      'Evening (5pm-9pm)': 0,
      'Night (9pm-6am)': 0,
    };
    
    sessions.forEach(session => {
      const hour = new Date(session.startTime).getHours();
      
      if (hour >= 6 && hour < 12) {
        timeSlots['Morning (6am-12pm)'] += 1;
      } else if (hour >= 12 && hour < 17) {
        timeSlots['Afternoon (12pm-5pm)'] += 1;
      } else if (hour >= 17 && hour < 21) {
        timeSlots['Evening (5pm-9pm)'] += 1;
      } else {
        timeSlots['Night (9pm-6am)'] += 1;
      }
    });
    
    return timeSlots;
  }

  private calculateParticipantRetention(sessions: any[]) {
    const returningParticipants = new Set();
    const allParticipants = new Set();
    
    sessions.forEach(session => {
      // This would require tracking participant attendance across sessions
      // For now, return mock data
    });
    
    return {
      totalParticipants: allParticipants.size,
      returningParticipants: returningParticipants.size,
      retentionRate: allParticipants.size > 0 
        ? (returningParticipants.size / allParticipants.size) * 100 
        : 0,
    };
  }

  private convertToCSV(data: any): string {
    // Convert analytics data to CSV format
    let csv = 'Metric,Value\n';
    
    Object.entries(data.overview || {}).forEach(([key, value]) => {
      csv += `${key},${value}\n`;
    });
    
    return csv;
  }

  private generatePDF(data: any): any {
    // This would use a PDF generation library like pdfkit
    // For now, return the data with PDF metadata
    return {
      ...data,
      format: 'pdf',
      generatedAt: new Date().toISOString(),
      pages: 1,
    };
  }
}