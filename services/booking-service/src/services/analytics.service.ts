import { Injectable } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import * as moment from 'moment';

@Injectable()
export class AnalyticsService {
  private prisma = new PrismaClient();

  async getBookingAnalytics(filters: any) {
    const {
      startDate,
      endDate,
      groupBy = 'day',
      serviceType,
      instructorId,
      location,
    } = filters;

    const start = startDate ? new Date(startDate) : moment().subtract(30, 'days').toDate();
    const end = endDate ? new Date(endDate) : new Date();

    // Get basic counts
    const [totalBookings, confirmedBookings, cancelledBookings, revenue] = await Promise.all([
      this.getTotalBookings(start, end, filters),
      this.getConfirmedBookings(start, end, filters),
      this.getCancelledBookings(start, end, filters),
      this.getRevenue(start, end, filters),
    ]);

    // Get trend data
    const trendData = await this.getBookingTrends(start, end, groupBy, filters);

    // Get popular classes
    const popularClasses = await this.getPopularClasses(start, end, filters);

    // Get cancellation reasons
    const cancellationReasons = await this.getCancellationReasons(start, end);

    // Get peak hours
    const peakHours = await this.getPeakHours(start, end, filters);

    return {
      summary: {
        totalBookings,
        confirmedBookings,
        cancelledBookings,
        cancellationRate: totalBookings > 0 ? (cancelledBookings / totalBookings) * 100 : 0,
        revenue,
        averageBookingValue: confirmedBookings > 0 ? revenue / confirmedBookings : 0,
      },
      trends: trendData,
      popularClasses,
      cancellationReasons,
      peakHours,
      timeRange: {
        startDate: start,
        endDate: end,
      },
    };
  }

  async getRevenueAnalytics(filters: any) {
    const {
      startDate,
      endDate,
      groupBy = 'day',
      paymentMethod,
      serviceType,
    } = filters;

    const start = startDate ? new Date(startDate) : moment().subtract(30, 'days').toDate();
    const end = endDate ? new Date(endDate) : new Date();

    const revenueTrends = await this.getRevenueTrends(start, end, groupBy, filters);
    const paymentMethodBreakdown = await this.getPaymentMethodBreakdown(start, end);
    const serviceTypeRevenue = await this.getServiceTypeRevenue(start, end);
    const dailyAverages = await this.getDailyAverages(start, end);

    return {
      revenueTrends,
      paymentMethodBreakdown,
      serviceTypeRevenue,
      dailyAverages,
      totalRevenue: revenueTrends.reduce((sum, item) => sum + item.revenue, 0),
    };
  }

  async getCapacityAnalytics(filters: any) {
    const { startDate, endDate, classId, instructorId } = filters;

    const start = startDate ? new Date(startDate) : moment().subtract(30, 'days').toDate();
    const end = endDate ? new Date(endDate) : new Date();

    const capacityUtilization = await this.getCapacityUtilization(start, end, filters);
    const waitlistAnalysis = await this.getWaitlistAnalysis(start, end);
    const popularTimeSlots = await this.getPopularTimeSlots(start, end);
    const noShowRate = await this.getNoShowRate(start, end);

    return {
      capacityUtilization,
      waitlistAnalysis,
      popularTimeSlots,
      noShowRate,
      averageUtilization: capacityUtilization.reduce((sum, item) => sum + item.utilization, 0) / capacityUtilization.length,
    };
  }

  async getUserAnalytics(filters: any) {
    const { startDate, endDate } = filters;

    const start = startDate ? new Date(startDate) : moment().subtract(90, 'days').toDate();
    const end = endDate ? new Date(endDate) : new Date();

    const userRetention = await this.getUserRetention(start, end);
    const userLifetimeValue = await this.getUserLifetimeValue(start, end);
    const bookingFrequency = await this.getBookingFrequency(start, end);
    const userSegments = await this.getUserSegments(start, end);

    return {
      userRetention,
      userLifetimeValue,
      bookingFrequency,
      userSegments,
      totalActiveUsers: userRetention.totalUsers,
      averageBookingsPerUser: bookingFrequency.averageBookings,
    };
  }

  private async getTotalBookings(start: Date, end: Date, filters: any): Promise<number> {
    const where = this.buildWhereClause(start, end, filters);
    return this.prisma.booking.count({ where });
  }

  private async getConfirmedBookings(start: Date, end: Date, filters: any): Promise<number> {
    const where = this.buildWhereClause(start, end, {
      ...filters,
      status: 'CONFIRMED',
    });
    return this.prisma.booking.count({ where });
  }

  private async getCancelledBookings(start: Date, end: Date, filters: any): Promise<number> {
    const where = this.buildWhereClause(start, end, {
      ...filters,
      status: 'CANCELLED',
    });
    return this.prisma.booking.count({ where });
  }

  private async getRevenue(start: Date, end: Date, filters: any): Promise<number> {
    const where = this.buildWhereClause(start, end, {
      ...filters,
      status: { in: ['CONFIRMED', 'COMPLETED'] },
    });

    const result = await this.prisma.booking.aggregate({
      where,
      _sum: {
        totalAmount: true,
      },
    });

    return result._sum.totalAmount || 0;
  }

  private async getBookingTrends(start: Date, end: Date, groupBy: string, filters: any) {
    const formatString = this.getGroupByFormat(groupBy);
    const where = this.buildWhereClause(start, end, filters);

    const bookings = await this.prisma.booking.findMany({
      where,
      select: {
        startTime: true,
        status: true,
        totalAmount: true,
      },
      orderBy: {
        startTime: 'asc',
      },
    });

    const trends = {};
    bookings.forEach(booking => {
      const dateKey = moment(booking.startTime).format(formatString);
      if (!trends[dateKey]) {
        trends[dateKey] = {
          date: dateKey,
          total: 0,
          confirmed: 0,
          cancelled: 0,
          revenue: 0,
        };
      }

      trends[dateKey].total++;
      if (booking.status === 'CONFIRMED' || booking.status === 'COMPLETED') {
        trends[dateKey].confirmed++;
        trends[dateKey].revenue += booking.totalAmount;
      } else if (booking.status === 'CANCELLED') {
        trends[dateKey].cancelled++;
      }
    });

    return Object.values(trends);
  }

  private async getPopularClasses(start: Date, end: Date, filters: any) {
    const where = this.buildWhereClause(start, end, {
      ...filters,
      classId: { not: null },
      status: { in: ['CONFIRMED', 'COMPLETED'] },
    });

    const popularClasses = await this.prisma.booking.groupBy({
      by: ['classId'],
      where,
      _count: {
        id: true,
      },
      _sum: {
        totalAmount: true,
      },
      orderBy: {
        _count: {
          id: 'desc',
        },
      },
      take: 10,
    });

    // Get class details
    const classIds = popularClasses.map(item => item.classId);
    const classes = await this.prisma.yogaClass.findMany({
      where: { id: { in: classIds } },
      select: {
        id: true,
        title: true,
        type: true,
        instructor: {
          select: {
            firstName: true,
            lastName: true,
          },
        },
      },
    });

    return popularClasses.map(item => {
      const classInfo = classes.find(c => c.id === item.classId);
      return {
        classId: item.classId,
        className: classInfo?.title || 'Unknown Class',
        classType: classInfo?.type,
        instructor: classInfo?.instructor
          ? `${classInfo.instructor.firstName} ${classInfo.instructor.lastName}`
          : 'Unknown',
        bookingCount: item._count.id,
        totalRevenue: item._sum.totalAmount,
        averageRevenue: item._count.id > 0 ? item._sum.totalAmount / item._count.id : 0,
      };
    });
  }

  private async getCancellationReasons(start: Date, end: Date) {
    const cancellations = await this.prisma.booking.groupBy({
      by: ['cancellationReason'],
      where: {
        startTime: { gte: start, lte: end },
        status: 'CANCELLED',
        cancellationReason: { not: null },
      },
      _count: {
        id: true,
      },
      orderBy: {
        _count: {
          id: 'desc',
        },
      },
      take: 10,
    });

    return cancellations.map(item => ({
      reason: item.cancellationReason || 'No reason provided',
      count: item._count.id,
      percentage: 0, // Will be calculated client-side
    }));
  }

  private async getPeakHours(start: Date, end: Date, filters: any) {
    const where = this.buildWhereClause(start, end, {
      ...filters,
      status: { in: ['CONFIRMED', 'COMPLETED'] },
    });

    const bookings = await this.prisma.booking.findMany({
      where,
      select: {
        startTime: true,
      },
    });

    const hourCounts = {};
    bookings.forEach(booking => {
      const hour = moment(booking.startTime).hour();
      hourCounts[hour] = (hourCounts[hour] || 0) + 1;
    });

    return Object.entries(hourCounts)
      .map(([hour, count]) => ({
        hour: parseInt(hour),
        hourFormatted: `${hour}:00`,
        bookingCount: count,
      }))
      .sort((a, b) => b.bookingCount - a.bookingCount)
      .slice(0, 8);
  }

  private async getRevenueTrends(start: Date, end: Date, groupBy: string, filters: any) {
    const formatString = this.getGroupByFormat(groupBy);
    const where = this.buildWhereClause(start, end, {
      ...filters,
      status: { in: ['CONFIRMED', 'COMPLETED'] },
    });

    const bookings = await this.prisma.booking.findMany({
      where,
      select: {
        startTime: true,
        totalAmount: true,
        paymentMethod: true,
      },
    });

    const trends = {};
    bookings.forEach(booking => {
      const dateKey = moment(booking.startTime).format(formatString);
      if (!trends[dateKey]) {
        trends[dateKey] = {
          date: dateKey,
          revenue: 0,
          bookingCount: 0,
        };
      }

      trends[dateKey].revenue += booking.totalAmount;
      trends[dateKey].bookingCount++;
    });

    return Object.values(trends);
  }

  private async getPaymentMethodBreakdown(start: Date, end: Date) {
    const breakdown = await this.prisma.booking.groupBy({
      by: ['paymentMethod'],
      where: {
        startTime: { gte: start, lte: end },
        status: { in: ['CONFIRMED', 'COMPLETED'] },
        paymentMethod: { not: null },
      },
      _sum: {
        totalAmount: true,
      },
      _count: {
        id: true,
      },
    });

    const totalRevenue = breakdown.reduce((sum, item) => sum + item._sum.totalAmount, 0);

    return breakdown.map(item => ({
      method: item.paymentMethod || 'Unknown',
      revenue: item._sum.totalAmount,
      bookingCount: item._count.id,
      percentage: totalRevenue > 0 ? (item._sum.totalAmount / totalRevenue) * 100 : 0,
    }));
  }

  private async getServiceTypeRevenue(start: Date, end: Date) {
    const serviceRevenue = await this.prisma.booking.groupBy({
      by: ['type'],
      where: {
        startTime: { gte: start, lte: end },
        status: { in: ['CONFIRMED', 'COMPLETED'] },
      },
      _sum: {
        totalAmount: true,
      },
      _count: {
        id: true,
      },
    });

    return serviceRevenue.map(item => ({
      serviceType: item.type || 'Unknown',
      revenue: item._sum.totalAmount,
      bookingCount: item._count.id,
    }));
  }

  private async getDailyAverages(start: Date, end: Date) {
    const daysDiff = moment(end).diff(moment(start), 'days') || 1;

    const [totalRevenue, totalBookings] = await Promise.all([
      this.getRevenue(start, end, {}),
      this.getTotalBookings(start, end, {}),
    ]);

    return {
      averageDailyRevenue: totalRevenue / daysDiff,
      averageDailyBookings: totalBookings / daysDiff,
      averageBookingValue: totalBookings > 0 ? totalRevenue / totalBookings : 0,
    };
  }

  private async getCapacityUtilization(start: Date, end: Date, filters: any) {
    const where = this.buildWhereClause(start, end, {
      ...filters,
      classId: { not: null },
    });

    const classUtilization = await this.prisma.booking.groupBy({
      by: ['classId'],
      where,
      _sum: {
        participants: true,
      },
    });

    // Get class capacities
    const classIds = classUtilization.map(item => item.classId);
    const classes = await this.prisma.yogaClass.findMany({
      where: { id: { in: classIds } },
      select: {
        id: true,
        title: true,
        capacity: true,
        booked: true,
      },
    });

    return classUtilization.map(item => {
      const classInfo = classes.find(c => c.id === item.classId);
      const capacity = classInfo?.capacity || 1;
      const participants = item._sum.participants || 0;
      
      return {
        classId: item.classId,
        className: classInfo?.title || 'Unknown Class',
        capacity,
        participants,
        utilization: capacity > 0 ? (participants / capacity) * 100 : 0,
      };
    }).sort((a, b) => b.utilization - a.utilization);
  }

  private async getWaitlistAnalysis(start: Date, end: Date) {
    const waitlistData = await this.prisma.waitlistEntry.groupBy({
      by: ['status'],
      where: {
        createdAt: { gte: start, lte: end },
      },
      _count: {
        id: true,
      },
    });

    const total = waitlistData.reduce((sum, item) => sum + item._count.id, 0);

    return waitlistData.map(item => ({
      status: item.status,
      count: item._count.id,
      percentage: total > 0 ? (item._count.id / total) * 100 : 0,
    }));
  }

  private async getPopularTimeSlots(start: Date, end: Date) {
    const timeSlots = await this.prisma.booking.groupBy({
      by: ['startTime'],
      where: {
        startTime: { gte: start, lte: end },
        status: { in: ['CONFIRMED', 'COMPLETED'] },
      },
      _count: {
        id: true,
      },
      orderBy: {
        _count: {
          id: 'desc',
        },
      },
      take: 10,
    });

    return timeSlots.map(slot => ({
      time: moment(slot.startTime).format('YYYY-MM-DD HH:mm'),
      hour: moment(slot.startTime).format('HH:00'),
      dayOfWeek: moment(slot.startTime).format('dddd'),
      bookingCount: slot._count.id,
    }));
  }

  private async getNoShowRate(start: Date, end: Date) {
    const [totalConfirmed, noShows] = await Promise.all([
      this.prisma.booking.count({
        where: {
          startTime: { gte: start, lte: end },
          status: 'CONFIRMED',
        },
      }),
      this.prisma.booking.count({
        where: {
          startTime: { gte: start, lte: end },
          status: 'NO_SHOW',
        },
      }),
    ]);

    return {
      totalConfirmed,
      noShows,
      noShowRate: totalConfirmed > 0 ? (noShows / totalConfirmed) * 100 : 0,
    };
  }

  private async getUserRetention(start: Date, end: Date) {
    const retentionData = await this.prisma.$queryRaw`
      WITH user_first_booking AS (
        SELECT 
          userId,
          MIN(startTime) as first_booking_date
        FROM bookings
        WHERE startTime >= ${start} AND startTime <= ${end}
        GROUP BY userId
      ),
      user_subsequent_bookings AS (
        SELECT 
          b.userId,
          COUNT(*) as subsequent_count
        FROM bookings b
        JOIN user_first_booking ufb ON b.userId = ufb.userId
        WHERE b.startTime > ufb.first_booking_date
        GROUP BY b.userId
      )
      SELECT 
        COUNT(DISTINCT ufb.userId) as total_users,
        COUNT(DISTINCT usb.userId) as returning_users,
        CASE 
          WHEN COUNT(DISTINCT ufb.userId) > 0 
          THEN (COUNT(DISTINCT usb.userId) * 100.0 / COUNT(DISTINCT ufb.userId))
          ELSE 0 
        END as retention_rate
      FROM user_first_booking ufb
      LEFT JOIN user_subsequent_bookings usb ON ufb.userId = usb.userId
    `;

    return retentionData[0];
  }

  private async getUserLifetimeValue(start: Date, end: Date) {
    const userLTV = await this.prisma.$queryRaw`
      SELECT 
        b.userId,
        COUNT(DISTINCT b.id) as total_bookings,
        SUM(b.totalAmount) as total_revenue,
        AVG(b.totalAmount) as avg_booking_value,
        MIN(b.startTime) as first_booking,
        MAX(b.startTime) as last_booking
      FROM bookings b
      WHERE b.startTime >= ${start} AND b.startTime <= ${end}
        AND b.status IN ('CONFIRMED', 'COMPLETED')
      GROUP BY b.userId
      ORDER BY total_revenue DESC
      LIMIT 100
    `;

    return userLTV;
  }

  private async getBookingFrequency(start: Date, end: Date) {
    const frequency = await this.prisma.$queryRaw`
      SELECT 
        booking_count_range,
        COUNT(*) as user_count
      FROM (
        SELECT 
          userId,
          CASE 
            WHEN COUNT(*) = 1 THEN '1 booking'
            WHEN COUNT(*) BETWEEN 2 AND 5 THEN '2-5 bookings'
            WHEN COUNT(*) BETWEEN 6 AND 10 THEN '6-10 bookings'
            WHEN COUNT(*) BETWEEN 11 AND 20 THEN '11-20 bookings'
            ELSE '20+ bookings'
          END as booking_count_range
        FROM bookings
        WHERE startTime >= ${start} AND startTime <= ${end}
          AND status IN ('CONFIRMED', 'COMPLETED')
        GROUP BY userId
      ) user_bookings
      GROUP BY booking_count_range
      ORDER BY user_count DESC
    `;

    return frequency;
  }

  private async getUserSegments(start: Date, end: Date) {
    const segments = await this.prisma.$queryRaw`
      SELECT 
        segment,
        COUNT(*) as user_count,
        SUM(total_revenue) as segment_revenue
      FROM (
        SELECT 
          userId,
          CASE 
            WHEN total_revenue < 100 THEN 'Low-value (< $100)'
            WHEN total_revenue BETWEEN 100 AND 500 THEN 'Medium-value ($100-$500)'
            WHEN total_revenue BETWEEN 501 AND 1000 THEN 'High-value ($501-$1000)'
            ELSE 'Premium (> $1000)'
          END as segment,
          total_revenue
        FROM (
          SELECT 
            userId,
            SUM(totalAmount) as total_revenue
          FROM bookings
          WHERE startTime >= ${start} AND startTime <= ${end}
            AND status IN ('CONFIRMED', 'COMPLETED')
          GROUP BY userId
        ) user_revenue
      ) user_segments
      GROUP BY segment
      ORDER BY segment_revenue DESC
    `;

    return segments;
  }

  private buildWhereClause(start: Date, end: Date, filters: any) {
    const where: any = {
      startTime: { gte: start, lte: end },
    };

    if (filters.status) {
      if (Array.isArray(filters.status)) {
        where.status = { in: filters.status };
      } else {
        where.status = filters.status;
      }
    }

    if (filters.classId) {
      where.classId = filters.classId;
    }

    if (filters.sessionId) {
      where.sessionId = filters.sessionId;
    }

    if (filters.instructorId) {
      where.OR = [
        { class: { instructorId: filters.instructorId } },
        { liveSession: { instructorId: filters.instructorId } },
      ];
    }

    if (filters.serviceType) {
      where.type = filters.serviceType;
    }

    if (filters.location) {
      where.OR = [
        { yogaClass: { location: filters.location } },
        { liveSession: { location: filters.location } },
      ];
    }

    if (filters.paymentMethod) {
      where.paymentMethod = filters.paymentMethod;
    }

    return where;
  }

  private getGroupByFormat(groupBy: string): string {
    switch (groupBy) {
      case 'hour':
        return 'YYYY-MM-DD HH:00';
      case 'day':
        return 'YYYY-MM-DD';
      case 'week':
        return 'YYYY-WW';
      case 'month':
        return 'YYYY-MM';
      case 'year':
        return 'YYYY';
      default:
        return 'YYYY-MM-DD';
    }
  }
}