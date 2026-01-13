import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
  Headers,
} from '@nestjs/common';
import { AnalyticsService } from '../services/analytics.service';
import { AuthGuard } from '../guards/auth.guard';
import { RolesGuard } from '../guards/roles.guard';
import { Roles } from '../decorators/roles.decorator';

@Controller('analytics')
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @Get('health')
  async healthCheck() {
    return {
      status: 'healthy',
      service: 'staff-analytics',
      timestamp: new Date().toISOString(),
      database: await this.analyticsService.checkDatabase(),
    };
  }

  @Post('track/performance')
  @UseGuards(AuthGuard)
  async trackPerformance(
    @Body() body: { staffId: string; event: string; data: any },
    @Headers('x-user-id') trackedBy: string,
  ) {
    await this.analyticsService.trackStaffPerformance(
      body.staffId,
      body.event,
      { ...body.data, trackedBy },
    );
    return { success: true };
  }

  @Post('track/kpi')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles('ADMIN', 'HR', 'MANAGER')
  async trackKPI(
    @Body() body: { staffId: string; kpi: string; value: number; target: number },
  ) {
    await this.analyticsService.trackKPI(
      body.staffId,
      body.kpi,
      body.value,
      body.target,
    );
    return { success: true };
  }

  @Get('staff/:staffId/dashboard')
  @UseGuards(AuthGuard)
  async getStaffDashboard(
    @Param('staffId') staffId: string,
    @Headers('x-user-id') userId: string,
  ) {
    // Check if user has access to this staff's data
    if (userId !== staffId) {
      // In production, check if user is manager/HR/admin
      const isAuthorized = await this.checkAuthorization(userId, staffId);
      if (!isAuthorized) {
        throw new Error('Unauthorized access to staff analytics');
      }
    }

    return this.analyticsService.getStaffDashboard(staffId);
  }

  @Get('staff/:staffId/performance')
  @UseGuards(AuthGuard)
  async getStaffPerformance(
    @Param('staffId') staffId: string,
    @Query('timeframe') timeframe: string = 'month',
  ) {
    return this.analyticsService.getStaffPerformanceAnalytics(staffId, timeframe);
  }

  @Get('staff/:staffId/engagement')
  @UseGuards(AuthGuard)
  async getStaffEngagement(@Param('staffId') staffId: string) {
    return this.analyticsService.getStaffEngagementMetrics(staffId);
  }

  @Get('staff/:staffId/predictive')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles('ADMIN', 'HR', 'MANAGER')
  async getPredictiveAnalytics(@Param('staffId') staffId: string) {
    return this.analyticsService.getPredictiveAnalytics(staffId);
  }

  @Get('staff/:staffId/turnover-risk')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles('ADMIN', 'HR', 'MANAGER')
  async getTurnoverRisk(@Param('staffId') staffId: string) {
    const riskScore = await this.analyticsService.predictStaffTurnoverRisk(staffId);
    return {
      staffId,
      turnoverRisk: riskScore,
      level: riskScore > 70 ? 'High' : riskScore > 50 ? 'Medium' : 'Low',
      timestamp: new Date().toISOString(),
    };
  }

  @Get('staff/:staffId/training-recommendations')
  @UseGuards(AuthGuard)
  async getTrainingRecommendations(@Param('staffId') staffId: string) {
    return this.analyticsService.recommendTraining(staffId);
  }

  @Get('staff/:staffId/kpis')
  @UseGuards(AuthGuard)
  async getStaffKPIs(
    @Param('staffId') staffId: string,
    @Query('kpi') kpiName?: string,
  ) {
    return this.analyticsService.getStaffKPIs(staffId, kpiName);
  }

  @Get('manager/dashboard')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles('ADMIN', 'HR', 'MANAGER')
  async getManagerDashboard(
    @Headers('x-user-id') managerId: string,
    @Query('department') department?: string,
  ) {
    return this.analyticsService.getManagerDashboard(managerId, department);
  }

  @Get('department/:department/analytics')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles('ADMIN', 'HR', 'MANAGER')
  async getDepartmentAnalytics(
    @Param('department') department: string,
    @Query('timeframe') timeframe: string = 'month',
  ) {
    return this.analyticsService.getDepartmentAnalytics(department, timeframe);
  }

  @Post('optimize/workload')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles('ADMIN', 'HR', 'MANAGER')
  async optimizeWorkload(@Body() body: { staffIds: string[] }) {
    return this.analyticsService.optimizeWorkload(body.staffIds);
  }

  @Get('trends/performance')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles('ADMIN', 'HR')
  async getPerformanceTrends(
    @Query('department') department?: string,
    @Query('timeframe') timeframe: string = 'quarter',
  ) {
    const staff = await this.getStaffByDepartment(department);
    const trends = await Promise.all(
      staff.map(async (s) => ({
        staffId: s.id,
        name: `${s.user.firstName} ${s.user.lastName}`,
        trend: await this.analyticsService.analyzePerformanceTrend(s.id),
      }))
    );

    return {
      department,
      timeframe,
      trends,
      summary: this.summarizeTrends(trends),
    };
  }

  @Get('alerts')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles('ADMIN', 'HR', 'MANAGER')
  async getAlerts(
    @Query('department') department?: string,
    @Query('severity') severity?: string,
  ) {
    const staff = await this.getStaffByDepartment(department);
    const alerts = [];

    for (const s of staff) {
      const turnoverRisk = await this.analyticsService.predictStaffTurnoverRisk(s.id);
      if (turnoverRisk > 70 && (!severity || severity === 'high')) {
        alerts.push({
          type: 'HIGH_TURNOVER_RISK',
          staffId: s.id,
          staffName: `${s.user.firstName} ${s.user.lastName}`,
          department: s.department,
          riskScore: turnoverRisk,
          timestamp: new Date().toISOString(),
        });
      }

      const performance = await this.analyticsService.getStaffPerformanceAnalytics(s.id);
      if (performance?.overallPerformance < 60 && (!severity || severity !== 'low')) {
        alerts.push({
          type: 'LOW_PERFORMANCE',
          staffId: s.id,
          staffName: `${s.user.firstName} ${s.user.lastName}`,
          department: s.department,
          performance: performance.overallPerformance,
          timestamp: new Date().toISOString(),
        });
      }
    }

    return {
      totalAlerts: alerts.length,
      byType: this.groupBy(alerts, 'type'),
      alerts: alerts.sort((a, b) => {
        if (a.type === 'HIGH_TURNOVER_RISK' && b.type !== 'HIGH_TURNOVER_RISK') return -1;
        if (a.type !== 'HIGH_TURNOVER_RISK' && b.type === 'HIGH_TURNOVER_RISK') return 1;
        return 0;
      }),
    };
  }

  @Get('benchmarks')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles('ADMIN', 'HR')
  async getBenchmarks(
    @Query('department') department?: string,
    @Query('position') position?: string,
  ) {
    const staff = await this.getStaffByDepartment(department);
    const benchmarks = [];

    for (const s of staff) {
      if (position && s.position !== position) continue;

      const performance = await this.analyticsService.getStaffPerformanceAnalytics(s.id);
      const engagement = await this.analyticsService.getStaffEngagementMetrics(s.id);
      const turnoverRisk = await this.analyticsService.predictStaffTurnoverRisk(s.id);

      benchmarks.push({
        staffId: s.id,
        name: `${s.user.firstName} ${s.user.lastName}`,
        position: s.position,
        department: s.department,
        performance: performance?.overallPerformance || 0,
        engagement: engagement?.engagementScore || 0,
        turnoverRisk,
        overallScore: (performance?.overallPerformance || 0) * 0.4 +
                     (engagement?.engagementScore || 0) * 0.3 +
                     (100 - turnoverRisk) * 0.3,
      });
    }

    // Calculate benchmarks
    const sorted = benchmarks.sort((a, b) => b.overallScore - a.overallScore);
    const average = sorted.reduce((sum, b) => sum + b.overallScore, 0) / sorted.length;

    return {
      department,
      position,
      totalStaff: sorted.length,
      averageScore: average,
      topPerformers: sorted.slice(0, 3),
      bottomPerformers: sorted.slice(-3).reverse(),
      distribution: {
        excellent: sorted.filter(b => b.overallScore >= 90).length,
        good: sorted.filter(b => b.overallScore >= 75 && b.overallScore < 90).length,
        average: sorted.filter(b => b.overallScore >= 60 && b.overallScore < 75).length,
        needsImprovement: sorted.filter(b => b.overallScore < 60).length,
      },
      benchmarks: sorted,
    };
  }

  @Post('predict/turnover-batch')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles('ADMIN', 'HR')
  async predictTurnoverBatch(@Body() body: { staffIds: string[] }) {
    const predictions = await Promise.all(
      body.staffIds.map(async (staffId) => ({
        staffId,
        turnoverRisk: await this.analyticsService.predictStaffTurnoverRisk(staffId),
        level: await this.getTurnoverLevel(staffId),
      }))
    );

    const highRisk = predictions.filter(p => p.turnoverRisk > 70);
    const mediumRisk = predictions.filter(p => p.turnoverRisk > 50 && p.turnoverRisk <= 70);

    return {
      total: predictions.length,
      highRisk: highRisk.length,
      mediumRisk: mediumRisk.length,
      lowRisk: predictions.length - highRisk.length - mediumRisk.length,
      predictions,
      recommendations: {
        immediateAction: highRisk.map(p => p.staffId),
        monitor: mediumRisk.map(p => p.staffId),
      },
    };
  }

  // Helper methods
  private async checkAuthorization(userId: string, staffId: string): Promise<boolean> {
    // Check if user is manager/HR/admin
    const user = await this.getUser(userId);
    if (!user) return false;

    // In production, check roles and permissions
    const staff = await this.getStaff(staffId);
    if (!staff) return false;

    // Check if user is manager of the same department
    if (user.role === 'MANAGER' && user.department === staff.department) {
      return true;
    }

    // Check if user is HR or Admin
    return ['ADMIN', 'HR'].includes(user.role);
  }

  private async getUser(userId: string) {
    // In production, fetch from user service
    return { id: userId, role: 'MANAGER', department: 'Yoga' };
  }

  private async getStaff(staffId: string) {
    // In production, fetch from staff service
    return { id: staffId, department: 'Yoga' };
  }

  private async getStaffByDepartment(department?: string) {
    const where: any = { isActive: true };
    if (department) where.department = department;

    const staff = await this.prisma.staff.findMany({
      where,
      include: {
        user: {
          select: {
            firstName: true,
            lastName: true,
          },
        },
      },
      take: 50, // Limit for performance
    });

    return staff;
  }

  private summarizeTrends(trends: any[]) {
    const improving = trends.filter(t => t.trend.trend === 'improving').length;
    const declining = trends.filter(t => t.trend.trend === 'declining').length;
    const stable = trends.filter(t => t.trend.trend === 'stable').length;

    return {
      total: trends.length,
      improving,
      declining,
      stable,
      improvementRate: (improving / trends.length) * 100,
      concernRate: (declining / trends.length) * 100,
    };
  }

  private groupBy(array: any[], key: string) {
    return array.reduce((result, item) => {
      const value = item[key];
      result[value] = (result[value] || 0) + 1;
      return result;
    }, {});
  }

  private async getTurnoverLevel(staffId: string): Promise<string> {
    const riskScore = await this.analyticsService.predictStaffTurnoverRisk(staffId);
    return riskScore > 70 ? 'High' : riskScore > 50 ? 'Medium' : 'Low';
  }
}