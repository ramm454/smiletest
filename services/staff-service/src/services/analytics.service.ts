import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import * as moment from 'moment';

@Injectable()
export class AnalyticsService {
  private readonly logger = new Logger(AnalyticsService.name);
  private readonly analyticsServiceUrl = process.env.ANALYTICS_SERVICE_URL || 'http://analytics-service:3007';

  constructor(
    private readonly prisma: PrismaService,
    private readonly httpService: HttpService,
  ) {}

  // Staff Performance Analytics
  async trackStaffPerformance(staffId: string, event: string, data: any) {
    try {
      const performanceEvent = {
        staffId,
        event,
        data,
        timestamp: new Date().toISOString(),
        service: 'staff-service',
      };

      // Send to analytics service
      await firstValueFrom(
        this.httpService.post(
          `${this.analyticsServiceUrl}/api/analytics/staff/performance`,
          performanceEvent,
        ),
      );

      this.logger.log(`Tracked performance event: ${event} for staff ${staffId}`);
    } catch (error) {
      this.logger.error(`Failed to track performance event: ${error.message}`);
      // Fallback: store locally if analytics service is down
      await this.storeLocalAnalytics(staffId, event, data);
    }
  }

  async getStaffPerformanceAnalytics(staffId: string, timeframe: string = 'month') {
    try {
      const response = await firstValueFrom(
        this.httpService.get(
          `${this.analyticsServiceUrl}/api/analytics/staff/${staffId}/performance`,
          { params: { timeframe } },
        ),
      );

      return response.data;
    } catch (error) {
      this.logger.error(`Failed to get performance analytics: ${error.message}`);
      return this.generateLocalPerformanceAnalytics(staffId, timeframe);
    }
  }

  async getDepartmentAnalytics(department: string, timeframe: string = 'month') {
    try {
      const response = await firstValueFrom(
        this.httpService.get(
          `${this.analyticsServiceUrl}/api/analytics/department/${department}`,
          { params: { timeframe } },
        ),
      );

      return response.data;
    } catch (error) {
      this.logger.error(`Failed to get department analytics: ${error.message}`);
      return this.generateLocalDepartmentAnalytics(department, timeframe);
    }
  }

  async getStaffEngagementMetrics(staffId: string) {
    try {
      const response = await firstValueFrom(
        this.httpService.get(
          `${this.analyticsServiceUrl}/api/analytics/staff/${staffId}/engagement`,
        ),
      );

      return response.data;
    } catch (error) {
      this.logger.error(`Failed to get engagement metrics: ${error.message}`);
      return this.calculateLocalEngagementMetrics(staffId);
    }
  }

  async getPredictiveAnalytics(staffId: string) {
    try {
      const response = await firstValueFrom(
        this.httpService.get(
          `${this.analyticsServiceUrl}/api/analytics/staff/${staffId}/predictive`,
        ),
      );

      return response.data;
    } catch (error) {
      this.logger.error(`Failed to get predictive analytics: ${error.message}`);
      return this.generatePredictiveAnalytics(staffId);
    }
  }

  // KPI Tracking
  async trackKPI(staffId: string, kpiName: string, value: number, target: number) {
    const kpiEvent = {
      staffId,
      kpi: kpiName,
      value,
      target,
      achievement: (value / target) * 100,
      timestamp: new Date().toISOString(),
    };

    try {
      await firstValueFrom(
        this.httpService.post(
          `${this.analyticsServiceUrl}/api/analytics/kpi`,
          kpiEvent,
        ),
      );
    } catch (error) {
      this.logger.error(`Failed to track KPI: ${error.message}`);
      await this.storeLocalKPI(kpiEvent);
    }
  }

  async getStaffKPIs(staffId: string, kpiName?: string) {
    try {
      const params = kpiName ? { kpi: kpiName } : {};
      const response = await firstValueFrom(
        this.httpService.get(
          `${this.analyticsServiceUrl}/api/analytics/staff/${staffId}/kpis`,
          { params },
        ),
      );

      return response.data;
    } catch (error) {
      this.logger.error(`Failed to get KPIs: ${error.message}`);
      return this.getLocalKPIs(staffId, kpiName);
    }
  }

  // Analytics Dashboards
  async getStaffDashboard(staffId: string) {
    const [
      performance,
      engagement,
      predictive,
      kpis,
      scheduleAnalytics,
      taskAnalytics,
    ] = await Promise.all([
      this.getStaffPerformanceAnalytics(staffId),
      this.getStaffEngagementMetrics(staffId),
      this.getPredictiveAnalytics(staffId),
      this.getStaffKPIs(staffId),
      this.getScheduleAnalytics(staffId),
      this.getTaskAnalytics(staffId),
    ]);

    return {
      staffId,
      timestamp: new Date().toISOString(),
      performance,
      engagement,
      predictive,
      kpis,
      scheduleAnalytics,
      taskAnalytics,
      overallScore: this.calculateOverallScore(performance, engagement, kpis),
    };
  }

  async getManagerDashboard(managerId: string, department?: string) {
    const staff = await this.prisma.staff.findMany({
      where: {
        ...(department && { department }),
        isActive: true,
      },
      select: { id: true, userId: true, department: true },
    });

    const staffAnalytics = await Promise.all(
      staff.map(async (s) => ({
        staffId: s.id,
        analytics: await this.getStaffPerformanceAnalytics(s.id),
      })),
    );

    const departmentAnalytics = department
      ? await this.getDepartmentAnalytics(department)
      : null;

    return {
      managerId,
      department,
      timestamp: new Date().toISOString(),
      teamSize: staff.length,
      staffAnalytics,
      departmentAnalytics,
      teamMetrics: this.calculateTeamMetrics(staffAnalytics),
      alerts: await this.getTeamAlerts(staff.map(s => s.id)),
    };
  }

  // Machine Learning Integration
  async predictStaffTurnoverRisk(staffId: string): Promise<number> {
    try {
      const response = await firstValueFrom(
        this.httpService.post(
          `${this.analyticsServiceUrl}/api/analytics/predict/turnover`,
          { staffId },
        ),
      );

      return response.data.riskScore;
    } catch (error) {
      this.logger.error(`Failed to predict turnover risk: ${error.message}`);
      return this.calculateLocalTurnoverRisk(staffId);
    }
  }

  async recommendTraining(staffId: string) {
    try {
      const response = await firstValueFrom(
        this.httpService.post(
          `${this.analyticsServiceUrl}/api/analytics/recommend/training`,
          { staffId },
        ),
      );

      return response.data.recommendations;
    } catch (error) {
      this.logger.error(`Failed to get training recommendations: ${error.message}`);
      return this.generateLocalTrainingRecommendations(staffId);
    }
  }

  async optimizeWorkload(staffIds: string[]) {
    try {
      const response = await firstValueFrom(
        this.httpService.post(
          `${this.analyticsServiceUrl}/api/analytics/optimize/workload`,
          { staffIds },
        ),
      );

      return response.data.optimization;
    } catch (error) {
      this.logger.error(`Failed to optimize workload: ${error.message}`);
      return this.optimizeWorkloadLocally(staffIds);
    }
  }

  // Helper Methods
  private async storeLocalAnalytics(staffId: string, event: string, data: any) {
    await this.prisma.staffAnalytics.create({
      data: {
        staffId,
        event,
        data,
        timestamp: new Date(),
      },
    });
  }

  private async generateLocalPerformanceAnalytics(staffId: string, timeframe: string) {
    const now = new Date();
    let startDate: Date;

    switch (timeframe) {
      case 'week':
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case 'month':
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
      case 'quarter':
        startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
        break;
      default:
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    }

    const [
      tasks,
      schedules,
      timeOff,
      reviews,
    ] = await Promise.all([
      this.prisma.task.findMany({
        where: {
          assignedToId: staffId,
          createdAt: { gte: startDate },
        },
        select: {
          status: true,
          priority: true,
          progress: true,
          completedAt: true,
          dueDate: true,
        },
      }),
      this.prisma.schedule.findMany({
        where: {
          staffId,
          startTime: { gte: startDate },
        },
        select: {
          status: true,
          startTime: true,
          endTime: true,
        },
      }),
      this.prisma.timeOffRequest.findMany({
        where: {
          staffId,
          startDate: { gte: startDate },
        },
        select: {
          type: true,
          workingDays: true,
          status: true,
        },
      }),
      this.prisma.performanceReview.findMany({
        where: {
          staffId,
          createdAt: { gte: startDate },
        },
        select: {
          rating: true,
          createdAt: true,
        },
      }),
    ]);

    // Calculate metrics
    const taskMetrics = this.calculateTaskMetrics(tasks);
    const scheduleMetrics = this.calculateScheduleMetrics(schedules);
    const attendanceMetrics = this.calculateAttendanceMetrics(timeOff);
    const reviewMetrics = this.calculateReviewMetrics(reviews);

    return {
      staffId,
      timeframe,
      period: { start: startDate, end: now },
      taskMetrics,
      scheduleMetrics,
      attendanceMetrics,
      reviewMetrics,
      overallPerformance: this.calculateOverallPerformance(
        taskMetrics,
        scheduleMetrics,
        attendanceMetrics,
        reviewMetrics,
      ),
    };
  }

  private calculateTaskMetrics(tasks: any[]) {
    const totalTasks = tasks.length;
    const completedTasks = tasks.filter(t => t.status === 'completed').length;
    const overdueTasks = tasks.filter(t => 
      t.status !== 'completed' && 
      t.dueDate && 
      new Date(t.dueDate) < new Date()
    ).length;

    const averageProgress = tasks.length > 0
      ? tasks.reduce((sum, t) => sum + (t.progress || 0), 0) / tasks.length
      : 0;

    const completionRate = totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0;
    const onTimeRate = completedTasks > 0
      ? (completedTasks - overdueTasks) / completedTasks * 100
      : 0;

    return {
      totalTasks,
      completedTasks,
      overdueTasks,
      completionRate,
      onTimeRate,
      averageProgress,
      priorityDistribution: this.groupBy(tasks, 'priority'),
    };
  }

  private calculateScheduleMetrics(schedules: any[]) {
    const totalShifts = schedules.length;
    const completedShifts = schedules.filter(s => s.status === 'completed').length;
    
    let totalHours = 0;
    let onTimeShifts = 0;

    schedules.forEach(schedule => {
      if (schedule.startTime && schedule.endTime) {
        const duration = (new Date(schedule.endTime).getTime() - 
                         new Date(schedule.startTime).getTime()) / (1000 * 60 * 60);
        totalHours += duration;
      }
    });

    const attendanceRate = totalShifts > 0 ? (completedShifts / totalShifts) * 100 : 0;
    const averageHours = completedShifts > 0 ? totalHours / completedShifts : 0;

    return {
      totalShifts,
      completedShifts,
      attendanceRate,
      totalHours,
      averageHours,
      onTimeRate: onTimeShifts / completedShifts * 100 || 0,
    };
  }

  private calculateAttendanceMetrics(timeOff: any[]) {
    const totalDays = timeOff.reduce((sum, to) => sum + to.workingDays, 0);
    const approvedDays = timeOff
      .filter(to => to.status === 'approved')
      .reduce((sum, to) => sum + to.workingDays, 0);

    const byType = this.groupBy(timeOff, 'type');

    return {
      totalRequests: timeOff.length,
      approvedRequests: timeOff.filter(to => to.status === 'approved').length,
      totalDays,
      approvedDays,
      byType,
      attendanceRate: 100 - (approvedDays / 20) * 100, // Assuming 20 working days/month
    };
  }

  private calculateReviewMetrics(reviews: any[]) {
    if (reviews.length === 0) {
      return {
        averageRating: 0,
        totalReviews: 0,
        ratingTrend: [],
        lastReview: null,
      };
    }

    const averageRating = reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length;
    
    // Group by month for trend
    const ratingTrend = reviews.reduce((acc, review) => {
      const month = moment(review.createdAt).format('YYYY-MM');
      if (!acc[month]) {
        acc[month] = { total: 0, count: 0 };
      }
      acc[month].total += review.rating;
      acc[month].count++;
      return acc;
    }, {});

    const trendArray = Object.entries(ratingTrend).map(([month, data]: any) => ({
      month,
      averageRating: data.total / data.count,
    })).sort((a, b) => a.month.localeCompare(b.month));

    return {
      averageRating,
      totalReviews: reviews.length,
      ratingTrend: trendArray,
      lastReview: reviews[reviews.length - 1],
    };
  }

  private calculateOverallPerformance(...metrics: any[]): number {
    // Weighted average of different metrics
    const weights = {
      taskCompletion: 0.3,
      attendance: 0.25,
      scheduleAdherence: 0.2,
      reviewScore: 0.25,
    };

    let totalScore = 0;
    let totalWeight = 0;

    if (metrics[0]) {
      totalScore += metrics[0].completionRate * weights.taskCompletion;
      totalWeight += weights.taskCompletion;
    }

    if (metrics[2]) {
      totalScore += metrics[2].attendanceRate * weights.attendance;
      totalWeight += weights.attendance;
    }

    if (metrics[1]) {
      totalScore += metrics[1].attendanceRate * weights.scheduleAdherence;
      totalWeight += weights.scheduleAdherence;
    }

    if (metrics[3]) {
      totalScore += (metrics[3].averageRating / 5) * 100 * weights.reviewScore;
      totalWeight += weights.reviewScore;
    }

    return totalWeight > 0 ? totalScore / totalWeight : 0;
  }

  private async getScheduleAnalytics(staffId: string) {
    const schedules = await this.prisma.schedule.findMany({
      where: {
        staffId,
        startTime: {
          gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
        },
      },
      select: {
        type: true,
        startTime: true,
        endTime: true,
        status: true,
      },
    });

    return {
      totalSchedules: schedules.length,
      upcomingSchedules: schedules.filter(s => 
        new Date(s.startTime) > new Date()
      ).length,
      byType: this.groupBy(schedules, 'type'),
      byStatus: this.groupBy(schedules, 'status'),
      busiestDay: this.findBusiestDay(schedules),
    };
  }

  private async getTaskAnalytics(staffId: string) {
    const tasks = await this.prisma.task.findMany({
      where: {
        assignedToId: staffId,
        createdAt: {
          gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
        },
      },
      select: {
        status: true,
        priority: true,
        progress: true,
        dueDate: true,
        completedAt: true,
        category: true,
      },
    });

    return {
      totalTasks: tasks.length,
      completedTasks: tasks.filter(t => t.status === 'completed').length,
      overdueTasks: tasks.filter(t => 
        t.status !== 'completed' && 
        t.dueDate && 
        new Date(t.dueDate) < new Date()
      ).length,
      byPriority: this.groupBy(tasks, 'priority'),
      byCategory: this.groupBy(tasks, 'category'),
      averageCompletionTime: this.calculateAverageCompletionTime(tasks),
    };
  }

  private calculateAverageCompletionTime(tasks: any[]): number {
    const completedTasks = tasks.filter(t => 
      t.status === 'completed' && 
      t.completedAt && 
      t.createdAt
    );

    if (completedTasks.length === 0) return 0;

    const totalTime = completedTasks.reduce((sum, task) => {
      const created = new Date(task.createdAt).getTime();
      const completed = new Date(task.completedAt).getTime();
      return sum + (completed - created);
    }, 0);

    return totalTime / completedTasks.length / (1000 * 60 * 60 * 24); // Return in days
  }

  private findBusiestDay(schedules: any[]): string {
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const dayCounts = Array(7).fill(0);

    schedules.forEach(schedule => {
      const day = new Date(schedule.startTime).getDay();
      dayCounts[day]++;
    });

    const maxIndex = dayCounts.indexOf(Math.max(...dayCounts));
    return days[maxIndex];
  }

  private calculateOverallScore(performance: any, engagement: any, kpis: any): number {
    const weights = {
      performance: 0.4,
      engagement: 0.3,
      kpis: 0.3,
    };

    const performanceScore = performance?.overallPerformance || 0;
    const engagementScore = engagement?.overallEngagement || 0;
    const kpiScore = kpis?.averageAchievement || 0;

    return (
      performanceScore * weights.performance +
      engagementScore * weights.engagement +
      kpiScore * weights.kpis
    );
  }

  private calculateTeamMetrics(staffAnalytics: any[]) {
    const totalStaff = staffAnalytics.length;
    if (totalStaff === 0) return null;

    const totalPerformance = staffAnalytics.reduce(
      (sum, sa) => sum + (sa.analytics?.overallPerformance || 0), 0
    );
    const averagePerformance = totalPerformance / totalStaff;

    const performanceDistribution = {
      excellent: staffAnalytics.filter(sa => (sa.analytics?.overallPerformance || 0) >= 90).length,
      good: staffAnalytics.filter(sa => (sa.analytics?.overallPerformance || 0) >= 70 && 
                                       (sa.analytics?.overallPerformance || 0) < 90).length,
      needsImprovement: staffAnalytics.filter(sa => (sa.analytics?.overallPerformance || 0) < 70).length,
    };

    return {
      totalStaff,
      averagePerformance,
      performanceDistribution,
      topPerformers: staffAnalytics
        .sort((a, b) => (b.analytics?.overallPerformance || 0) - (a.analytics?.overallPerformance || 0))
        .slice(0, 3)
        .map(sa => ({
          staffId: sa.staffId,
          performance: sa.analytics?.overallPerformance || 0,
        })),
    };
  }

  private async getTeamAlerts(staffIds: string[]) {
    const alerts = [];

    for (const staffId of staffIds) {
      const turnoverRisk = await this.predictStaffTurnoverRisk(staffId);
      if (turnoverRisk > 70) {
        alerts.push({
          type: 'HIGH_TURNOVER_RISK',
          staffId,
          riskScore: turnoverRisk,
          message: 'High risk of staff turnover',
        });
      }

      const performance = await this.getStaffPerformanceAnalytics(staffId);
      if (performance?.overallPerformance < 60) {
        alerts.push({
          type: 'LOW_PERFORMANCE',
          staffId,
          performance: performance.overallPerformance,
          message: 'Performance below acceptable level',
        });
      }
    }

    return alerts;
  }

  private async calculateLocalTurnoverRisk(staffId: string): Promise<number> {
    const staff = await this.prisma.staff.findUnique({
      where: { id: staffId },
      include: {
        timeOffRequests: {
          where: { status: 'approved' },
          orderBy: { startDate: 'desc' },
          take: 6,
        },
        performanceReviews: {
          orderBy: { createdAt: 'desc' },
          take: 3,
        },
        tasks: {
          where: { status: { in: ['pending', 'in_progress'] } },
        },
      },
    });

    if (!staff) return 0;

    let riskScore = 0;

    // Recent time off requests (especially personal/sick)
    const recentTimeOff = staff.timeOffRequests.filter(to =>
      new Date(to.startDate) > new Date(Date.now() - 90 * 24 * 60 * 60 * 1000)
    );
    riskScore += Math.min(recentTimeOff.length * 10, 30);

    // Performance trend
    if (staff.performanceReviews.length >= 2) {
      const trend = staff.performanceReviews[0].rating - staff.performanceReviews[2].rating;
      if (trend < -0.5) riskScore += 20;
    }

    // Workload
    const currentWorkload = staff.tasks.length;
    if (currentWorkload > 10) riskScore += 15;
    if (currentWorkload > 15) riskScore += 10;

    // Tenure (new employees more likely to leave)
    const hireDate = new Date(staff.hireDate);
    const monthsEmployed = (new Date().getTime() - hireDate.getTime()) / (1000 * 60 * 60 * 24 * 30);
    if (monthsEmployed < 6) riskScore += 20;
    if (monthsEmployed < 12) riskScore += 10;

    return Math.min(riskScore, 100);
  }

  private async generateLocalTrainingRecommendations(staffId: string) {
    const staff = await this.prisma.staff.findUnique({
      where: { id: staffId },
      include: {
        performanceReviews: {
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
        tasks: {
          where: { status: 'completed' },
          orderBy: { completedAt: 'desc' },
          take: 10,
        },
      },
    });

    if (!staff) return [];

    const recommendations = [];
    const skills = staff.skills || [];
    const certifications = staff.certifications || [];

    // Check for skill gaps based on completed tasks
    const taskCategories = staff.tasks.map(t => t.category).filter(Boolean);
    const uniqueCategories = [...new Set(taskCategories)];

    // Recommend training for frequently used categories
    uniqueCategories.forEach(category => {
      if (!skills.includes(category)) {
        recommendations.push({
          type: 'SKILL_GAP',
          category,
          recommendation: `Complete ${category} training`,
          priority: 'medium',
        });
      }
    });

    // Check performance reviews for improvement areas
    if (staff.performanceReviews.length > 0) {
      const latestReview = staff.performanceReviews[0];
      if (latestReview.areasForImprovement && latestReview.areasForImprovement.length > 0) {
        latestReview.areasForImprovement.forEach(area => {
          recommendations.push({
            type: 'PERFORMANCE_IMPROVEMENT',
            area,
            recommendation: `Training to improve ${area}`,
            priority: 'high',
          });
        });
      }
    }

    // Certification recommendations based on position
    if (staff.position.toLowerCase().includes('yoga')) {
      if (!certifications.includes('RYT-200')) {
        recommendations.push({
          type: 'CERTIFICATION',
          certification: 'RYT-200',
          recommendation: 'Complete RYT-200 certification',
          priority: 'high',
        });
      }
    }

    return recommendations.slice(0, 5); // Return top 5 recommendations
  }

  private async optimizeWorkloadLocally(staffIds: string[]) {
    const staffWorkloads = await Promise.all(
      staffIds.map(async (id) => ({
        staffId: id,
        workload: await this.getStaffWorkload(id),
        skills: await this.getStaffSkills(id),
        availability: await this.getStaffAvailability(id),
      }))
    );

    // Simple load balancing algorithm
    const averageWorkload = staffWorkloads.reduce((sum, s) => sum + s.workload.currentTasks, 0) / staffWorkloads.length;
    
    const optimization = {
      timestamp: new Date().toISOString(),
      averageWorkload,
      recommendations: staffWorkloads.map(staff => ({
        staffId: staff.staffId,
        currentWorkload: staff.workload.currentTasks,
        targetWorkload: averageWorkload,
        adjustment: averageWorkload - staff.workload.currentTasks,
        suggestedActions: this.generateWorkloadActions(
          staff.workload.currentTasks,
          averageWorkload,
          staff.skills,
        ),
      })),
      overallEfficiency: this.calculateEfficiency(staffWorkloads),
    };

    return optimization;
  }

  private async getStaffWorkload(staffId: string) {
    const tasks = await this.prisma.task.count({
      where: {
        assignedToId: staffId,
        status: { in: ['pending', 'in_progress'] },
      },
    });

    return {
      currentTasks: tasks,
      maxTasks: 15, // Default max
      utilization: (tasks / 15) * 100,
    };
  }

  private async getStaffSkills(staffId: string) {
    const staff = await this.prisma.staff.findUnique({
      where: { id: staffId },
      select: { skills: true },
    });

    return staff?.skills || [];
  }

  private async getStaffAvailability(staffId: string) {
    const schedules = await this.prisma.schedule.findMany({
      where: {
        staffId,
        startTime: { gte: new Date() },
        status: 'scheduled',
      },
      select: {
        startTime: true,
        endTime: true,
      },
    });

    const totalHours = schedules.reduce((sum, s) => {
      if (s.startTime && s.endTime) {
        const duration = (new Date(s.endTime).getTime() - new Date(s.startTime).getTime()) / (1000 * 60 * 60);
        return sum + duration;
      }
      return sum;
    }, 0);

    return {
      scheduledHours: totalHours,
      availableHours: 40 - totalHours, // Assuming 40-hour week
    };
  }

  private generateWorkloadActions(current: number, target: number, skills: string[]) {
    const actions = [];

    if (current > target * 1.2) {
      actions.push({
        action: 'REDUCE_WORKLOAD',
        priority: 'high',
        message: 'Workload significantly above target',
        suggestions: [
          'Delegate tasks to other team members',
          'Extend deadlines for non-critical tasks',
          'Consider temporary support',
        ],
      });
    } else if (current < target * 0.8) {
      actions.push({
        action: 'INCREASE_WORKLOAD',
        priority: 'medium',
        message: 'Workload below optimal level',
        suggestions: [
          'Assign additional tasks matching skills: ' + skills.join(', '),
          'Take on cross-training opportunities',
          'Support overloaded team members',
        ],
      });
    }

    return actions;
  }

  private calculateEfficiency(staffWorkloads: any[]) {
    const totalUtilization = staffWorkloads.reduce((sum, s) => sum + s.workload.utilization, 0);
    const averageUtilization = totalUtilization / staffWorkloads.length;

    const variance = staffWorkloads.reduce((sum, s) => {
      return sum + Math.pow(s.workload.utilization - averageUtilization, 2);
    }, 0) / staffWorkloads.length;

    const stdDeviation = Math.sqrt(variance);

    return {
      averageUtilization,
      stdDeviation,
      balanceScore: 100 - stdDeviation, // Lower deviation = better balance
      recommendations: stdDeviation > 20 ? 'Consider rebalancing workloads' : 'Well balanced',
    };
  }

  private groupBy(array: any[], key: string) {
    return array.reduce((result, item) => {
      const value = item[key];
      result[value] = (result[value] || 0) + 1;
      return result;
    }, {});
  }

  private async storeLocalKPI(kpiEvent: any) {
    await this.prisma.kpiTracking.create({
      data: {
        staffId: kpiEvent.staffId,
        kpi: kpiEvent.kpi,
        value: kpiEvent.value,
        target: kpiEvent.target,
        achievement: kpiEvent.achievement,
        timestamp: new Date(kpiEvent.timestamp),
      },
    });
  }

  private async getLocalKPIs(staffId: string, kpiName?: string) {
    const where: any = { staffId };
    if (kpiName) where.kpi = kpiName;

    const kpis = await this.prisma.kpiTracking.findMany({
      where,
      orderBy: { timestamp: 'desc' },
      take: 100,
    });

    if (kpis.length === 0) return null;

    const kpiSummary = kpis.reduce((acc, kpi) => {
      if (!acc[kpi.kpi]) {
        acc[kpi.kpi] = {
          values: [],
          targets: [],
          achievements: [],
        };
      }
      acc[kpi.kpi].values.push(kpi.value);
      acc[kpi.kpi].targets.push(kpi.target);
      acc[kpi.kpi].achievements.push(kpi.achievement);
      return acc;
    }, {});

    const averageAchievements = Object.entries(kpiSummary).map(([kpi, data]: any) => ({
      kpi,
      averageValue: data.values.reduce((a, b) => a + b, 0) / data.values.length,
      averageTarget: data.targets.reduce((a, b) => a + b, 0) / data.targets.length,
      averageAchievement: data.achievements.reduce((a, b) => a + b, 0) / data.achievements.length,
      trend: this.calculateTrend(data.achievements),
    }));

    return {
      kpis: averageAchievements,
      recent: kpis.slice(0, 10),
      overallAchievement: averageAchievements.reduce((sum, k) => sum + k.averageAchievement, 0) / averageAchievements.length,
    };
  }

  private calculateTrend(values: number[]): string {
    if (values.length < 2) return 'stable';
    
    const recentValues = values.slice(-5);
    const firstHalf = recentValues.slice(0, Math.floor(recentValues.length / 2));
    const secondHalf = recentValues.slice(Math.floor(recentValues.length / 2));
    
    const avgFirst = firstHalf.reduce((a, b) => a + b, 0) / firstHalf.length;
    const avgSecond = secondHalf.reduce((a, b) => a + b, 0) / secondHalf.length;
    
    if (avgSecond > avgFirst * 1.1) return 'improving';
    if (avgSecond < avgFirst * 0.9) return 'declining';
    return 'stable';
  }

  private async generateLocalDepartmentAnalytics(department: string, timeframe: string) {
    const staff = await this.prisma.staff.findMany({
      where: { department, isActive: true },
      select: { id: true },
    });

    const staffAnalytics = await Promise.all(
      staff.map(async (s) => await this.generateLocalPerformanceAnalytics(s.id, timeframe))
    );

    return {
      department,
      timeframe,
      totalStaff: staff.length,
      averagePerformance: staffAnalytics.reduce((sum, sa) => sum + (sa.overallPerformance || 0), 0) / staff.length,
      byPerformance: this.categorizePerformance(staffAnalytics),
      topPerformers: staffAnalytics
        .sort((a, b) => (b.overallPerformance || 0) - (a.overallPerformance || 0))
        .slice(0, 3)
        .map(sa => ({
          staffId: sa.staffId,
          performance: sa.overallPerformance || 0,
        })),
      metrics: {
        taskCompletion: staffAnalytics.reduce((sum, sa) => sum + (sa.taskMetrics?.completionRate || 0), 0) / staff.length,
        attendance: staffAnalytics.reduce((sum, sa) => sum + (sa.attendanceMetrics?.attendanceRate || 0), 0) / staff.length,
        scheduleAdherence: staffAnalytics.reduce((sum, sa) => sum + (sa.scheduleMetrics?.attendanceRate || 0), 0) / staff.length,
      },
    };
  }

  private categorizePerformance(analytics: any[]) {
    return {
      excellent: analytics.filter(a => (a.overallPerformance || 0) >= 90).length,
      good: analytics.filter(a => (a.overallPerformance || 0) >= 70 && (a.overallPerformance || 0) < 90).length,
      average: analytics.filter(a => (a.overallPerformance || 0) >= 50 && (a.overallPerformance || 0) < 70).length,
      needsImprovement: analytics.filter(a => (a.overallPerformance || 0) < 50).length,
    };
  }

  private async calculateLocalEngagementMetrics(staffId: string) {
    const [
      tasks,
      schedules,
      timeOff,
      reviews,
    ] = await Promise.all([
      this.prisma.task.findMany({
        where: {
          assignedToId: staffId,
          createdAt: { gte: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000) },
        },
      }),
      this.prisma.schedule.findMany({
        where: {
          staffId,
          startTime: { gte: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000) },
        },
      }),
      this.prisma.timeOffRequest.findMany({
        where: {
          staffId,
          startDate: { gte: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000) },
        },
      }),
      this.prisma.performanceReview.findMany({
        where: {
          staffId,
          createdAt: { gte: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000) },
        },
      }),
    ]);

    // Engagement score calculation
    let engagementScore = 0;

    // Task completion rate (30%)
    const taskCompletionRate = tasks.length > 0
      ? tasks.filter(t => t.status === 'completed').length / tasks.length * 100
      : 0;
    engagementScore += taskCompletionRate * 0.3;

    // Schedule adherence (25%)
    const scheduleAdherence = schedules.length > 0
      ? schedules.filter(s => s.status === 'completed').length / schedules.length * 100
      : 0;
    engagementScore += scheduleAdherence * 0.25;

    // Low absenteeism (20%)
    const totalWorkingDays = 60; // Approx 3 months
    const absentDays = timeOff
      .filter(to => to.status === 'approved')
      .reduce((sum, to) => sum + to.workingDays, 0);
    const attendanceRate = ((totalWorkingDays - absentDays) / totalWorkingDays) * 100;
    engagementScore += attendanceRate * 0.2;

    // Positive reviews (15%)
    const averageRating = reviews.length > 0
      ? reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length
      : 3; // Neutral if no reviews
    const reviewScore = (averageRating / 5) * 100;
    engagementScore += reviewScore * 0.15;

    // Active participation (10%) - based on recent activity
    const recentActivity = this.calculateRecentActivity(tasks, schedules);
    engagementScore += recentActivity * 0.1;

    return {
      engagementScore,
      breakdown: {
        taskCompletionRate,
        scheduleAdherence,
        attendanceRate,
        reviewScore,
        recentActivity,
      },
      overallEngagement: engagementScore,
      level: this.getEngagementLevel(engagementScore),
      recommendations: this.getEngagementRecommendations(
        taskCompletionRate,
        scheduleAdherence,
        attendanceRate,
        reviewScore,
        recentActivity,
      ),
    };
  }

  private calculateRecentActivity(tasks: any[], schedules: any[]): number {
    const now = new Date();
    const last30Days = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const last7Days = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    const recentTasks30 = tasks.filter(t => new Date(t.createdAt) > last30Days).length;
    const recentTasks7 = tasks.filter(t => new Date(t.createdAt) > last7Days).length;
    const recentSchedules30 = schedules.filter(s => new Date(s.startTime) > last30Days).length;
    const recentSchedules7 = schedules.filter(s => new Date(s.startTime) > last7Days).length;

    // Weight recent activity higher
    const activityScore = 
      (recentTasks7 * 2 + recentTasks30 + recentSchedules7 * 2 + recentSchedules30) / 6 * 10;

    return Math.min(activityScore, 100);
  }

  private getEngagementLevel(score: number): string {
    if (score >= 90) return 'Highly Engaged';
    if (score >= 75) return 'Engaged';
    if (score >= 60) return 'Moderately Engaged';
    if (score >= 50) return 'Somewhat Disengaged';
    return 'Disengaged';
  }

  private getEngagementRecommendations(...scores: number[]): string[] {
    const recommendations = [];
    
    if (scores[0] < 70) {
      recommendations.push('Focus on task completion and meeting deadlines');
    }
    
    if (scores[1] < 80) {
      recommendations.push('Improve schedule adherence and punctuality');
    }
    
    if (scores[2] < 85) {
      recommendations.push('Reduce absenteeism and improve attendance');
    }
    
    if (scores[3] < 70) {
      recommendations.push('Seek feedback and work on performance improvement');
    }
    
    if (scores[4] < 60) {
      recommendations.push('Increase participation in team activities');
    }

    return recommendations.length > 0 ? recommendations : ['Maintain current engagement level'];
  }

  private async generatePredictiveAnalytics(staffId: string) {
    const [
      turnoverRisk,
      performanceTrend,
      engagementTrend,
      skillGaps,
    ] = await Promise.all([
      this.predictStaffTurnoverRisk(staffId),
      this.analyzePerformanceTrend(staffId),
      this.analyzeEngagementTrend(staffId),
      this.identifySkillGaps(staffId),
    ]);

    return {
      turnoverRisk: {
        score: turnoverRisk,
        level: turnoverRisk > 70 ? 'High' : turnoverRisk > 50 ? 'Medium' : 'Low',
        factors: await this.getTurnoverRiskFactors(staffId),
      },
      performanceForecast: {
        nextMonth: this.forecastPerformance(performanceTrend),
        nextQuarter: this.forecastPerformance(performanceTrend, 3),
        confidence: this.calculateForecastConfidence(performanceTrend),
      },
      engagementForecast: {
        nextMonth: this.forecastEngagement(engagementTrend),
        risk: engagementTrend.trend === 'declining' ? 'Increasing disengagement risk' : 'Stable',
      },
      skillDevelopment: {
        gaps: skillGaps,
        timeline: this.calculateSkillDevelopmentTimeline(skillGaps),
        priority: this.prioritizeSkillDevelopment(skillGaps),
      },
      recommendations: this.generatePredictiveRecommendations(
        turnoverRisk,
        performanceTrend,
        engagementTrend,
        skillGaps,
      ),
    };
  }

  private async analyzePerformanceTrend(staffId: string) {
    const reviews = await this.prisma.performanceReview.findMany({
      where: { staffId },
      orderBy: { createdAt: 'asc' },
    });

    if (reviews.length < 2) {
      return {
        trend: 'insufficient_data',
        average: reviews[0]?.rating || 3,
        volatility: 0,
      };
    }

    const ratings = reviews.map(r => r.rating);
    const average = ratings.reduce((a, b) => a + b, 0) / ratings.length;
    
    // Calculate trend (simple linear regression)
    const x = reviews.map((_, i) => i);
    const y = ratings;
    const n = x.length;
    
    const sumX = x.reduce((a, b) => a + b, 0);
    const sumY = y.reduce((a, b) => a + b, 0);
    const sumXY = x.reduce((sum, xi, i) => sum + xi * y[i], 0);
    const sumX2 = x.reduce((sum, xi) => sum + xi * xi, 0);
    
    const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
    
    // Calculate volatility (standard deviation)
    const mean = average;
    const variance = ratings.reduce((sum, rating) => sum + Math.pow(rating - mean, 2), 0) / ratings.length;
    const volatility = Math.sqrt(variance);

    return {
      trend: slope > 0.1 ? 'improving' : slope < -0.1 ? 'declining' : 'stable',
      average,
      volatility,
      slope,
      lastRating: ratings[ratings.length - 1],
      dataPoints: reviews.map((r, i) => ({
        date: r.createdAt,
        rating: r.rating,
      })),
    };
  }

  private async analyzeEngagementTrend(staffId: string) {
    // Analyze engagement over time using various metrics
    const tasks = await this.prisma.task.findMany({
      where: { assignedToId: staffId },
      orderBy: { createdAt: 'asc' },
    });

    const schedules = await this.prisma.schedule.findMany({
      where: { staffId },
      orderBy: { startTime: 'asc' },
    });

    if (tasks.length < 4 || schedules.length < 4) {
      return {
        trend: 'insufficient_data',
        recentEngagement: await this.calculateLocalEngagementMetrics(staffId),
      };
    }

    // Group by month and calculate engagement metrics
    const monthlyEngagement = tasks.reduce((acc, task) => {
      const month = moment(task.createdAt).format('YYYY-MM');
      if (!acc[month]) {
        acc[month] = {
          tasks: 0,
          completedTasks: 0,
          schedules: 0,
          completedSchedules: 0,
        };
      }
      acc[month].tasks++;
      if (task.status === 'completed') acc[month].completedTasks++;
      return acc;
    }, {});

    schedules.forEach(schedule => {
      const month = moment(schedule.startTime).format('YYYY-MM');
      if (!monthlyEngagement[month]) {
        monthlyEngagement[month] = {
          tasks: 0,
          completedTasks: 0,
          schedules: 0,
          completedSchedules: 0,
        };
      }
      monthlyEngagement[month].schedules++;
      if (schedule.status === 'completed') monthlyEngagement[month].completedSchedules++;
    });

    // Convert to array and sort
    const engagementArray = Object.entries(monthlyEngagement)
      .map(([month, data]: any) => ({
        month,
        taskCompletionRate: data.tasks > 0 ? (data.completedTasks / data.tasks) * 100 : 0,
        scheduleAdherence: data.schedules > 0 ? (data.completedSchedules / data.schedules) * 100 : 0,
        engagementScore: (
          (data.tasks > 0 ? (data.completedTasks / data.tasks) * 100 * 0.6 : 0) +
          (data.schedules > 0 ? (data.completedSchedules / data.schedules) * 100 * 0.4 : 0)
        ),
      }))
      .sort((a, b) => a.month.localeCompare(b.month));

    // Calculate trend from last 3 months
    const recentMonths = engagementArray.slice(-3);
    if (recentMonths.length < 2) {
      return {
        trend: 'stable',
        monthlyData: engagementArray,
        recentEngagement: await this.calculateLocalEngagementMetrics(staffId),
      };
    }

    const trend = recentMonths[recentMonths.length - 1].engagementScore > 
                  recentMonths[0].engagementScore * 1.1 ? 'improving' :
                  recentMonths[recentMonths.length - 1].engagementScore < 
                  recentMonths[0].engagementScore * 0.9 ? 'declining' : 'stable';

    return {
      trend,
      monthlyData: engagementArray,
      recentEngagement: await this.calculateLocalEngagementMetrics(staffId),
      trendStrength: Math.abs(
        (recentMonths[recentMonths.length - 1].engagementScore - recentMonths[0].engagementScore) / 
        recentMonths[0].engagementScore
      ) * 100,
    };
  }

  private async identifySkillGaps(staffId: string) {
    const staff = await this.prisma.staff.findUnique({
      where: { id: staffId },
      include: {
        tasks: {
          where: { status: 'completed' },
          take: 20,
        },
        performanceReviews: {
          take: 3,
        },
      },
    });

    if (!staff) return [];

    const requiredSkills = this.getRequiredSkillsForPosition(staff.position, staff.department);
    const currentSkills = staff.skills || [];

    const gaps = requiredSkills
      .filter(skill => !currentSkills.includes(skill))
      .map(skill => ({
        skill,
        priority: this.getSkillPriority(skill, staff.position),
        evidence: this.getSkillGapEvidence(skill, staff.tasks, staff.performanceReviews),
      }));

    return gaps.sort((a, b) => b.priority - a.priority);
  }

  private getRequiredSkillsForPosition(position: string, department: string): string[] {
    const skillMatrix = {
      'Yoga Instructor': ['Vinyasa', 'Hatha', 'Yin', 'Anatomy', 'Pranayama', 'Meditation'],
      'Spa Therapist': ['Swedish Massage', 'Deep Tissue', 'Aromatherapy', 'Reflexology', 'Customer Service'],
      'Receptionist': ['Customer Service', 'Administration', 'Booking Systems', 'Communication', 'Multitasking'],
      'Manager': ['Leadership', 'Scheduling', 'Performance Management', 'Budgeting', 'Communication'],
    };

    return skillMatrix[position] || ['Communication', 'Teamwork', 'Problem Solving'];
  }

  private getSkillPriority(skill: string, position: string): number {
    const priorityMatrix = {
      'Yoga Instructor': {
        'Vinyasa': 10,
        'Hatha': 9,
        'Anatomy': 8,
        'Meditation': 7,
      },
      'Spa Therapist': {
        'Swedish Massage': 10,
        'Deep Tissue': 9,
        'Customer Service': 8,
      },
      default: 5,
    };

    return priorityMatrix[position]?.[skill] || priorityMatrix.default;
  }

  private getSkillGapEvidence(skill: string, tasks: any[], reviews: any[]): string[] {
    const evidence = [];

    // Check tasks related to this skill
    const skillRelatedTasks = tasks.filter(t => 
      t.description?.toLowerCase().includes(skill.toLowerCase()) ||
      t.category?.toLowerCase().includes(skill.toLowerCase())
    );

    if (skillRelatedTasks.length === 0) {
      evidence.push(`No completed tasks requiring ${skill}`);
    } else {
      const completionRate = skillRelatedTasks.filter(t => t.status === 'completed').length / skillRelatedTasks.length;
      if (completionRate < 0.7) {
        evidence.push(`Low completion rate (${Math.round(completionRate * 100)}%) for ${skill}-related tasks`);
      }
    }

    // Check performance reviews
    reviews.forEach(review => {
      if (review.areasForImprovement?.includes(skill)) {
        evidence.push(`Identified as area for improvement in performance review`);
      }
    });

    return evidence.length > 0 ? evidence : ['Inferred from position requirements'];
  }

  private forecastPerformance(trend: any, months: number = 1): number {
    if (trend.trend === 'insufficient_data') return 3;

    const current = trend.lastRating || trend.average;
    const slope = trend.slope || 0;

    // Simple linear forecast
    let forecast = current + (slope * months);

    // Add some randomness for realism
    const volatility = trend.volatility || 0.5;
    const randomFactor = (Math.random() * 2 - 1) * volatility * 0.3;

    forecast += randomFactor;

    // Constrain between 1 and 5
    return Math.max(1, Math.min(5, forecast));
  }

  private forecastEngagement(engagement: any): number {
    if (!engagement.recentEngagement) return 70;

    const current = engagement.recentEngagement.engagementScore;
    const trend = engagement.trend;

    let forecast = current;
    if (trend === 'improving') {
      forecast *= 1.05; // 5% improvement
    } else if (trend === 'declining') {
      forecast *= 0.95; // 5% decline
    }

    return Math.min(100, forecast);
  }

  private calculateForecastConfidence(trend: any): number {
    if (trend.trend === 'insufficient_data') return 30;

    let confidence = 70; // Base confidence

    // Adjust based on data points
    if (trend.dataPoints?.length >= 6) confidence += 10;
    if (trend.dataPoints?.length >= 12) confidence += 10;

    // Adjust based on volatility
    if (trend.volatility < 0.5) confidence += 10;
    if (trend.volatility > 1.5) confidence -= 10;

    // Adjust based on trend strength
    const trendStrength = Math.abs(trend.slope || 0);
    if (trendStrength > 0.2) confidence -= 10; // Strong trends are harder to predict

    return Math.max(30, Math.min(95, confidence));
  }

  private calculateSkillDevelopmentTimeline(skillGaps: any[]): any[] {
    return skillGaps.map(gap => ({
      skill: gap.skill,
      priority: gap.priority,
      estimatedHours: this.estimateTrainingHours(gap.skill, gap.priority),
      timeline: this.calculateTimeline(gap.priority),
      resources: this.getTrainingResources(gap.skill),
    }));
  }

  private estimateTrainingHours(skill: string, priority: number): number {
    const hourEstimates = {
      high: {
        'Vinyasa': 40,
        'Swedish Massage': 50,
        'Leadership': 30,
        'Anatomy': 35,
      },
      medium: {
        'Hatha': 25,
        'Deep Tissue': 30,
        'Scheduling': 20,
        'Customer Service': 15,
      },
      low: {
        'Meditation': 10,
        'Aromatherapy': 15,
        'Communication': 10,
      },
    };

    if (priority >= 8) return hourEstimates.high[skill] || 30;
    if (priority >= 5) return hourEstimates.medium[skill] || 20;
    return hourEstimates.low[skill] || 10;
  }

  private calculateTimeline(priority: number): string {
    if (priority >= 8) return '1-2 months (high priority)';
    if (priority >= 5) return '2-3 months (medium priority)';
    return '3-6 months (low priority)';
  }

  private getTrainingResources(skill: string): string[] {
    const resources = {
      'Vinyasa': ['RYT-200 Certification', 'Online Vinyasa Flow Course', 'Workshops'],
      'Swedish Massage': ['Licensed Massage Therapist Program', 'Workshops', 'Online Tutorials'],
      'Leadership': ['Management Training', 'Leadership Books', 'Mentorship Program'],
      'Customer Service': ['Customer Service Training', 'Communication Workshops', 'Role-playing'],
    };

    return resources[skill] || ['Online Courses', 'Workshops', 'On-the-job Training'];
  }

  private prioritizeSkillDevelopment(skillGaps: any[]): any[] {
    return skillGaps
      .sort((a, b) => b.priority - a.priority)
      .slice(0, 3) // Top 3 priorities
      .map((gap, index) => ({
        ...gap,
        sequence: index + 1,
        quarter: Math.ceil((index + 1) / 3), // Spread over quarters
      }));
  }

  private async getTurnoverRiskFactors(staffId: string): Promise<string[]> {
    const factors = [];

    const recentTimeOff = await this.prisma.timeOffRequest.count({
      where: {
        staffId,
        status: 'approved',
        startDate: { gte: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000) },
      },
    });

    if (recentTimeOff > 3) {
      factors.push('High recent time-off frequency');
    }

    const overdueTasks = await this.prisma.task.count({
      where: {
        assignedToId: staffId,
        status: { in: ['pending', 'in_progress'] },
        dueDate: { lt: new Date() },
      },
    });

    if (overdueTasks > 5) {
      factors.push('Multiple overdue tasks');
    }

    const recentReviews = await this.prisma.performanceReview.findMany({
      where: {
        staffId,
        createdAt: { gte: new Date(Date.now() - 180 * 24 * 60 * 60 * 1000) },
      },
      orderBy: { createdAt: 'desc' },
      take: 2,
    });

    if (recentReviews.length >= 2) {
      const trend = recentReviews[0].rating - recentReviews[1].rating;
      if (trend < -0.5) {
        factors.push('Declining performance trend');
      }
    }

    // Check for anniversary approaching
    const staff = await this.prisma.staff.findUnique({
      where: { id: staffId },
      select: { hireDate: true },
    });

    if (staff) {
      const hireDate = new Date(staff.hireDate);
      const monthsEmployed = (new Date().getTime() - hireDate.getTime()) / (1000 * 60 * 60 * 24 * 30);
      if (monthsEmployed >= 11 && monthsEmployed <= 13) {
        factors.push('Approaching 1-year anniversary (common turnover point)');
      }
    }

    return factors.length > 0 ? factors : ['No significant risk factors identified'];
  }

  private generatePredictiveRecommendations(
    turnoverRisk: number,
    performanceTrend: any,
    engagementTrend: any,
    skillGaps: any[],
  ): string[] {
    const recommendations = [];

    if (turnoverRisk > 70) {
      recommendations.push('Conduct retention interview and address concerns immediately');
    } else if (turnoverRisk > 50) {
      recommendations.push('Schedule check-in meeting to discuss career progression');
    }

    if (performanceTrend.trend === 'declining') {
      recommendations.push('Implement performance improvement plan with regular check-ins');
    }

    if (engagementTrend.trend === 'declining') {
      recommendations.push('Increase recognition and feedback frequency');
    }

    if (skillGaps.length > 0) {
      const topSkill = skillGaps[0]?.skill;
      if (topSkill) {
        recommendations.push(`Prioritize training for ${topSkill} skill development`);
      }
    }

    if (recommendations.length === 0) {
      recommendations.push('Continue current management approach, monitor metrics monthly');
    }

    return recommendations;
  }

  async checkDatabase() {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return 'connected';
    } catch (error) {
      return 'disconnected';
    }
  }
}