import {
  Controller,
  Get,
  Query,
  UseGuards,
  Headers,
} from '@nestjs/common';
import { AnalyticsService } from '../services/analytics.service';
import { AuthGuard } from '../guards/auth.guard';
import { RolesGuard } from '../guards/roles.guard';
import { Roles } from '../decorators/roles.decorator';

@Controller('analytics')
@UseGuards(AuthGuard, RolesGuard)
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @Get('bookings')
  @Roles('ADMIN', 'INSTRUCTOR')
  async getBookingAnalytics(@Query() query: any) {
    return this.analyticsService.getBookingAnalytics(query);
  }

  @Get('revenue')
  @Roles('ADMIN', 'INSTRUCTOR')
  async getRevenueAnalytics(@Query() query: any) {
    return this.analyticsService.getRevenueAnalytics(query);
  }

  @Get('capacity')
  @Roles('ADMIN', 'INSTRUCTOR')
  async getCapacityAnalytics(@Query() query: any) {
    return this.analyticsService.getCapacityAnalytics(query);
  }

  @Get('users')
  @Roles('ADMIN')
  async getUserAnalytics(@Query() query: any) {
    return this.analyticsService.getUserAnalytics(query);
  }

  @Get('dashboard')
  @Roles('ADMIN', 'INSTRUCTOR')
  async getDashboard(@Query() query: any) {
    const [bookingAnalytics, revenueAnalytics, capacityAnalytics] = await Promise.all([
      this.analyticsService.getBookingAnalytics(query),
      this.analyticsService.getRevenueAnalytics(query),
      this.analyticsService.getCapacityAnalytics(query),
    ]);

    return {
      bookingAnalytics,
      revenueAnalytics,
      capacityAnalytics,
      timestamp: new Date(),
    };
  }

  @Get('export')
  @Roles('ADMIN')
  async exportAnalytics(@Query() query: any) {
    const data = await this.analyticsService.getBookingAnalytics(query);
    
    // Format data for export
    const exportData = {
      metadata: {
        exportedAt: new Date().toISOString(),
        timeRange: data.timeRange,
        filters: query,
      },
      summary: data.summary,
      trends: data.trends,
      popularClasses: data.popularClasses,
    };

    return exportData;
  }

  @Get('real-time')
  @Roles('ADMIN', 'INSTRUCTOR')
  async getRealTimeAnalytics() {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const todayEnd = new Date(todayStart.getTime() + 24 * 60 * 60 * 1000);

    const [todayBookings, todayRevenue, upcomingBookings, liveSessions] = await Promise.all([
      this.analyticsService.getTotalBookings(todayStart, todayEnd, {}),
      this.analyticsService.getRevenue(todayStart, todayEnd, {}),
      this.getUpcomingBookingsCount(),
      this.getLiveSessionsCount(),
    ]);

    return {
      todayBookings,
      todayRevenue,
      upcomingBookings,
      liveSessions,
      timestamp: now,
    };
  }

  private async getUpcomingBookingsCount(): Promise<number> {
    const now = new Date();
    const next24Hours = new Date(now.getTime() + 24 * 60 * 60 * 1000);

    return this.analyticsService.getTotalBookings(now, next24Hours, {
      status: 'CONFIRMED',
    });
  }

  private async getLiveSessionsCount(): Promise<number> {
    // This would integrate with live service
    // For now, return mock data
    return 3;
  }
}