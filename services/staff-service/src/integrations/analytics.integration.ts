import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { PrismaService } from '../prisma.service';

export interface AnalyticsEvent {
  event: string;
  userId: string;
  staffId?: string;
  department?: string;
  data: any;
  timestamp: Date;
  metadata?: any;
}

export interface PerformanceMetrics {
  staffId: string;
  period: string;
  metrics: {
    productivity: number;
    efficiency: number;
    quality: number;
    attendance: number;
    engagement: number;
  };
  comparisons: {
    departmentAverage: number;
    companyAverage: number;
    previousPeriod: number;
  };
  trends: {
    direction: 'improving' | 'declining' | 'stable';
    rate: number;
    confidence: number;
  };
}

@Injectable()
export class AnalyticsIntegrationService {
  private readonly logger = new Logger(AnalyticsIntegrationService.name);
  private readonly analyticsServiceUrl = process.env.ANALYTICS_SERVICE_URL || 'http://analytics-service:3007';

  constructor(
    private readonly httpService: HttpService,
    private readonly prisma: PrismaService,
  ) {}

  async trackStaffEvent(event: AnalyticsEvent): Promise<void> {
    try {
      await firstValueFrom(
        this.httpService.post(`${this.analyticsServiceUrl}/events/staff`, event, {
          headers: {
            'x-service-token': process.env.SERVICE_TOKEN,
          },
          timeout: 3000,
        }),
      );

      this.logger.debug(`Tracked staff event: ${event.event} for staff ${event.staffId}`);
    } catch (error) {
      this.logger.error(`Error tracking staff event ${event.event}:`, error);
      // Store locally for later sync
      await this.storePendingEvent(event);
    }
  }

  async getStaffPerformanceAnalytics(staffId: string, period: string = 'month'): Promise<PerformanceMetrics> {
    try {
      const response = await firstValueFrom(
        this.httpService.get(`${this.analyticsServiceUrl}/analytics/staff/${staffId}/performance`, {
          params: { period },
          headers: {
            'x-service-token': process.env.SERVICE_TOKEN,
          },
          timeout: 10000,
        }),
      );

      return response.data;
    } catch (error) {
      this.logger.error(`Error fetching performance analytics for staff ${staffId}:`, error);
      return this.generateLocalPerformanceMetrics(staffId, period);
    }
  }

  async getDepartmentAnalytics(department: string, period: string = 'month'): Promise<any> {
    try {
      const response = await firstValueFrom(
        this.httpService.get(`${this.analyticsServiceUrl}/analytics/department/${department}`, {
          params: { period },
          headers: {
            'x-service-token': process.env.SERVICE_TOKEN,
          },
          timeout: 10000,
        }),
      );

      return response.data;
    } catch (error) {
      this.logger.error(`Error fetching department analytics for ${department}:`, error);
      return this.generateLocalDepartmentAnalytics(department, period);
    }
  }

  async getStaffPredictions(staffId: string): Promise<any> {
    try {
      const response = await firstValueFrom(
        this.httpService.get(`${this.analyticsServiceUrl}/predictions/staff/${staffId}`, {
          headers: {
            'x-service-token': process.env.SERVICE_TOKEN,
          },
          timeout: 15000, // Longer timeout for predictions
        }),
      );

      return response.data;
    } catch (error) {
      this.logger.error(`Error fetching predictions for staff ${staffId}:`, error);
      return {
        staffId,
        predictions: {
          retentionRisk: 'low',
          promotionPotential: 'medium',
          performanceTrend: 'stable',
          nextBestActions: [],
        },
        confidence: 0.5,
        generatedAt: new Date(),
      };
    }
  }

  async getOptimalStaffAllocation(
    requirements: any[],
    constraints: any,
  ): Promise<any> {
    try {
      const response = await firstValueFrom(
        this.httpService.post(`${this.analyticsServiceUrl}/optimization/staff-allocation`, {
          requirements,
          constraints,
        }, {
          headers: {
            'x-service-token': process.env.SERVICE_TOKEN,
          },
          timeout: 30000, // Longer timeout for optimization
        }),
      );

      return response.data;
    } catch (error) {
      this.logger.error('Error getting optimal staff allocation:', error);
      return this.generateLocalAllocation(requirements, constraints);
    }
  }

  async sendStaffEngagementMetrics(): Promise<void> {
    // Collect and send daily engagement metrics
    const staff = await this.prisma.staff.findMany({
      where: { isActive: true },
      include: {
        tasks: {
          where: {
            updatedAt: {
              gte: new Date(Date.now() - 24 * 60 * 60 * 1000),
            },
          },
        },
        schedules: {
          where: {
            updatedAt: {
              gte: new Date(Date.now() - 24 * 60 * 60 * 1000),
            },
          },
        },
        timeOffRequests: {
          where: {
            updatedAt: {
              gte: new Date(Date.now() - 24 * 60 * 60 * 1000),
            },
          },
        },
      },
    });

    for (const staffMember of staff) {
      const engagementMetrics = {
        staffId: staffMember.id,
        department: staffMember.department,
        date: new Date().toISOString().split('T')[0],
        metrics: {
          taskCompletionRate: this.calculateTaskCompletionRate(staffMember.tasks),
          scheduleAdherence: this.calculateScheduleAdherence(staffMember.schedules),
          timeOffRate: staffMember.timeOffRequests.length,
          communicationResponsiveness: await this.calculateResponsiveness(staffMember.id),
          overallEngagement: 0, // Will be calculated by analytics service
        },
      };

      await this.trackStaffEvent({
        event: 'staff_engagement_daily',
        userId: staffMember.userId,
        staffId: staffMember.id,
        department: staffMember.department,
        data: engagementMetrics,
        timestamp: new Date(),
      });
    }

    this.logger.log(`Sent engagement metrics for ${staff.length} staff members`);
  }

  async sendProductivityMetrics(): Promise<void> {
    // Collect and send weekly productivity metrics
    const staff = await this.prisma.staff.findMany({
      where: { isActive: true },
      include: {
        tasks: {
          where: {
            status: 'completed',
            completedAt: {
              gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
            },
          },
        },
        performanceReviews: {
          where: {
            createdAt: {
              gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
            },
          },
        },
      },
    });

    for (const staffMember of staff) {
      const productivityMetrics = {
        staffId: staffMember.id,
        department: staffMember.department,
        period: 'week',
        metrics: {
          tasksCompleted: staffMember.tasks.length,
          averageCompletionTime: this.calculateAverageCompletionTime(staffMember.tasks),
          qualityScore: this.calculateQualityScore(staffMember.performanceReviews),
          efficiencyRatio: await this.calculateEfficiencyRatio(staffMember.id),
          valueAdded: await this.calculateValueAdded(staffMember.id),
        },
      };

      await this.trackStaffEvent({
        event: 'staff_productivity_weekly',
        userId: staffMember.userId,
        staffId: staffMember.id,
        department: staffMember.department,
        data: productivityMetrics,
        timestamp: new Date(),
      });
    }

    this.logger.log(`Sent productivity metrics for ${staff.length} staff members`);
  }

  async generateStaffInsightsReport(staffId: string, period: string = 'quarter'): Promise<any> {
    try {
      const response = await firstValueFrom(
        this.httpService.post(`${this.analyticsServiceUrl}/reports/staff-insights`, {
          staffId,
          period,
        }, {
          headers: {
            'x-service-token': process.env.SERVICE_TOKEN,
          },
          timeout: 20000,
        }),
      );

      return response.data;
    } catch (error) {
      this.logger.error(`Error generating insights report for staff ${staffId}:`, error);
      return this.generateLocalInsightsReport(staffId, period);
    }
  }

  async getWorkforcePlanningForecast(periods: number = 4): Promise<any> {
    try {
      const response = await firstValueFrom(
        this.httpService.get(`${this.analyticsServiceUrl}/forecasts/workforce`, {
          params: { periods },
          headers: {
            'x-service-token': process.env.SERVICE_TOKEN,
          },
          timeout: 30000,
        }),
      );

      return response.data;
    } catch (error) {
      this.logger.error('Error getting workforce forecast:', error);
      return this.generateLocalWorkforceForecast(periods);
    }
  }

  async identifyHighPerformers(department?: string): Promise<any[]> {
    try {
      const params: any = {};
      if (department) params.department = department;

      const response = await firstValueFrom(
        this.httpService.get(`${this.analyticsServiceUrl}/analytics/high-performers`, {
          params,
          headers: {
            'x-service-token': process.env.SERVICE_TOKEN,
          },
          timeout: 15000,
        }),
      );

      return response.data.highPerformers;
    } catch (error) {
      this.logger.error('Error identifying high performers:', error);
      return this.identifyLocalHighPerformers(department);
    }
  }

  async identifyAtRiskStaff(department?: string): Promise<any[]> {
    try {
      const params: any = {};
      if (department) params.department = department;

      const response = await firstValueFrom(
        this.httpService.get(`${this.analyticsServiceUrl}/analytics/at-risk-staff`, {
          params,
          headers: {
            'x-service-token': process.env.SERVICE_TOKEN,
          },
          timeout: 15000,
        }),
      );

      return response.data.atRiskStaff;
    } catch (error) {
      this.logger.error('Error identifying at-risk staff:', error);
      return this.identifyLocalAtRiskStaff(department);
    }
  }

  async optimizeRostering(department: string, period: any): Promise<any> {
    try {
      const response = await firstValueFrom(
        this.httpService.post(`${this.analyticsServiceUrl}/optimization/rostering`, {
          department,
          period,
          constraints: {
            maxHoursPerWeek: 38.5,
            minRestBetweenShifts: 11,
            requiredStaffPerShift: 2,
          },
        }, {
          headers: {
            'x-service-token': process.env.SERVICE_TOKEN,
          },
          timeout: 45000, // Long timeout for complex optimization
        }),
      );

      return response.data;
    } catch (error) {
      this.logger.error('Error optimizing rostering:', error);
      return this.generateLocalRostering(department, period);
    }
  }

  // Helper methods for local calculations when analytics service is unavailable
  private async generateLocalPerformanceMetrics(staffId: string, period: string): Promise<PerformanceMetrics> {
    const staff = await this.prisma.staff.findUnique({
      where: { id: staffId },
      include: {
        tasks: {
          where: {
            updatedAt: {
              gte: this.getPeriodStart(period),
            },
          },
        },
        performanceReviews: {
          where: {
            createdAt: {
              gte: this.getPeriodStart(period),
            },
          },
        },
        schedules: {
          where: {
            startTime: {
              gte: this.getPeriodStart(period),
            },
          },
        },
      },
    });

    if (!staff) {
      throw new Error(`Staff ${staffId} not found`);
    }

    return {
      staffId,
      period,
      metrics: {
        productivity: this.calculateProductivity(staff.tasks),
        efficiency: this.calculateEfficiency(staff.tasks),
        quality: this.calculateQuality(staff.performanceReviews),
        attendance: this.calculateAttendance(staff.schedules),
        engagement: 75, // Default
      },
      comparisons: {
        departmentAverage: 65,
        companyAverage: 70,
        previousPeriod: 68,
      },
      trends: {
        direction: 'improving',
        rate: 2.5,
        confidence: 0.7,
      },
    };
  }

  private async generateLocalDepartmentAnalytics(department: string, period: string): Promise<any> {
    const staff = await this.prisma.staff.findMany({
      where: { department, isActive: true },
      include: {
        tasks: {
          where: {
            updatedAt: {
              gte: this.getPeriodStart(period),
            },
          },
        },
        performanceReviews: {
          where: {
            createdAt: {
              gte: this.getPeriodStart(period),
            },
          },
        },
      },
    });

    return {
      department,
      period,
      summary: {
        totalStaff: staff.length,
        activeStaff: staff.filter(s => s.isActive).length,
        averageProductivity: this.calculateAverageProductivity(staff),
        averageEngagement: 72,
        turnoverRate: 8.5,
      },
      metrics: {
        productivityByRole: this.calculateProductivityByRole(staff),
        engagementTrend: this.calculateEngagementTrend(staff),
        skillGaps: this.identifySkillGaps(staff),
      },
      recommendations: [
        'Increase cross-training opportunities',
        'Implement mentorship program',
        'Review workload distribution',
      ],
    };
  }

  private async generateLocalAllocation(requirements: any[], constraints: any): Promise<any> {
    // Simple round-robin allocation
    const staff = await this.prisma.staff.findMany({
      where: {
        department: constraints.department,
        isActive: true,
      },
      include: {
        availabilities: true,
      },
    });

    const allocations = [];
    let staffIndex = 0;

    for (const requirement of requirements) {
      if (staff.length === 0) break;

      const assignedStaff = staff[staffIndex % staff.length];
      allocations.push({
        requirementId: requirement.id,
        staffId: assignedStaff.id,
        staffName: `${assignedStaff.firstName} ${assignedStaff.lastName}`,
        score: 0.7 + Math.random() * 0.3, // Random score
      });

      staffIndex++;
    }

    return {
      allocations,
      coverage: (allocations.length / requirements.length) * 100,
      efficiency: 65,
      recommendations: ['Consider hiring additional staff', 'Review shift patterns'],
    };
  }

  private async storePendingEvent(event: AnalyticsEvent): Promise<void> {
    await this.prisma.pendingAnalyticsEvent.create({
      data: {
        event: event.event,
        userId: event.userId,
        staffId: event.staffId,
        department: event.department,
        data: event.data,
        timestamp: event.timestamp,
        metadata: event.metadata,
        retryCount: 0,
      },
    });
  }

  private async syncPendingEvents(): Promise<void> {
    const pendingEvents = await this.prisma.pendingAnalyticsEvent.findMany({
      where: {
        retryCount: { lt: 3 },
        createdAt: {
          gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // Last 30 days
        },
      },
      take: 1000,
    });

    for (const event of pendingEvents) {
      try {
        await this.trackStaffEvent({
          event: event.event,
          userId: event.userId,
          staffId: event.staffId,
          department: event.department,
          data: event.data,
          timestamp: event.timestamp,
          metadata: event.metadata,
        });

        await this.prisma.pendingAnalyticsEvent.delete({
          where: { id: event.id },
        });
      } catch (error) {
        await this.prisma.pendingAnalyticsEvent.update({
          where: { id: event.id },
          data: {
            retryCount: { increment: 1 },
            lastRetryAt: new Date(),
          },
        });
      }
    }
  }

  // Calculation helpers
  private calculateTaskCompletionRate(tasks: any[]): number {
    if (tasks.length === 0) return 0;
    const completed = tasks.filter(t => t.status === 'completed').length;
    return (completed / tasks.length) * 100;
  }

  private calculateScheduleAdherence(schedules: any[]): number {
    if (schedules.length === 0) return 100;
    const onTime = schedules.filter(s => {
      if (!s.clockInTime) return true;
      const diff = new Date(s.clockInTime).getTime() - new Date(s.startTime).getTime();
      return diff >= -300000 && diff <= 300000; // Within 5 minutes
    }).length;
    return (onTime / schedules.length) * 100;
  }

  private async calculateResponsiveness(staffId: string): Promise<number> {
    // Calculate average response time to notifications/tasks
    const tasks = await this.prisma.task.findMany({
      where: {
        assignedToId: staffId,
        status: 'completed',
      },
      select: {
        createdAt: true,
        updatedAt: true,
      },
    });

    if (tasks.length === 0) return 100;

    const totalResponseTime = tasks.reduce((sum, task) => {
      const assigned = new Date(task.createdAt).getTime();
      const firstUpdate = new Date(task.updatedAt).getTime();
      return sum + (firstUpdate - assigned);
    }, 0);

    const avgResponseHours = totalResponseTime / tasks.length / (1000 * 60 * 60);
    
    // Convert to score (0-100), lower response time = higher score
    if (avgResponseHours < 1) return 100;
    if (avgResponseHours < 4) return 80;
    if (avgResponseHours < 8) return 60;
    if (avgResponseHours < 24) return 40;
    return 20;
  }

  private calculateAverageCompletionTime(tasks: any[]): number {
    const completedTasks = tasks.filter(t => t.completedAt);
    if (completedTasks.length === 0) return 0;

    const totalTime = completedTasks.reduce((sum, task) => {
      const created = new Date(task.createdAt).getTime();
      const completed = new Date(task.completedAt).getTime();
      return sum + (completed - created);
    }, 0);

    return totalTime / completedTasks.length / (1000 * 60 * 60); // Return in hours
  }

  private calculateQualityScore(reviews: any[]): number {
    if (reviews.length === 0) return 75; // Default
    const sum = reviews.reduce((total, review) => total + review.rating, 0);
    return (sum / reviews.length) * 20; // Convert 1-5 scale to 0-100
  }

  private getPeriodStart(period: string): Date {
    const now = new Date();
    switch (period) {
      case 'day':
        return new Date(now.setDate(now.getDate() - 1));
      case 'week':
        return new Date(now.setDate(now.getDate() - 7));
      case 'month':
        return new Date(now.setMonth(now.getMonth() - 1));
      case 'quarter':
        return new Date(now.setMonth(now.getMonth() - 3));
      case 'year':
        return new Date(now.setFullYear(now.getFullYear() - 1));
      default:
        return new Date(now.setMonth(now.getMonth() - 1));
    }
  }

  // Run background sync
  async startBackgroundSync(): Promise<void> {
    // Sync every hour
    setInterval(async ()