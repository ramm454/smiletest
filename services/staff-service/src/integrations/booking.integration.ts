import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { PrismaService } from '../prisma.service';

@Injectable()
export class BookingIntegrationService {
  private readonly logger = new Logger(BookingIntegrationService.name);
  private readonly bookingServiceUrl = process.env.BOOKING_SERVICE_URL || 'http://booking-service:3002';

  constructor(
    private readonly httpService: HttpService,
    private readonly prisma: PrismaService,
  ) {}

  async assignStaffToBooking(bookingId: string, staffId: string): Promise<any> {
    try {
      // Get staff details
      const staff = await this.prisma.staff.findUnique({
        where: { id: staffId, isActive: true },
        include: { user: true },
      });

      if (!staff) {
        throw new Error(`Staff ${staffId} not found or inactive`);
      }

      // Update booking with assigned staff
      const response = await firstValueFrom(
        this.httpService.put(
          `${this.bookingServiceUrl}/bookings/${bookingId}/assign-staff`,
          {
            staffId,
            staffName: `${staff.user.firstName} ${staff.user.lastName}`,
            staffEmail: staff.user.email,
            assignedAt: new Date().toISOString(),
          },
          {
            headers: {
              'x-service-token': process.env.SERVICE_TOKEN,
            },
            timeout: 5000,
          },
        ),
      );

      // Update staff's booking count
      await this.updateStaffBookingStats(staffId);

      this.logger.log(`Assigned staff ${staffId} to booking ${bookingId}`);
      return response.data;
    } catch (error) {
      this.logger.error(`Error assigning staff to booking ${bookingId}:`, error);
      throw error;
    }
  }

  async getStaffBookings(staffId: string, filters: any = {}): Promise<any> {
    try {
      const response = await firstValueFrom(
        this.httpService.get(`${this.bookingServiceUrl}/bookings`, {
          params: {
            ...filters,
            staffId,
          },
          headers: {
            'x-service-token': process.env.SERVICE_TOKEN,
          },
          timeout: 10000,
        }),
      );

      return response.data;
    } catch (error) {
      this.logger.error(`Error fetching bookings for staff ${staffId}:`, error);
      return { bookings: [], total: 0 };
    }
  }

  async getStaffAvailability(staffId: string, date: string, duration: number): Promise<any> {
    try {
      const staff = await this.prisma.staff.findUnique({
        where: { id: staffId },
        include: {
          availabilities: true,
          schedules: {
            where: {
              startTime: {
                gte: new Date(date),
                lt: new Date(new Date(date).setDate(new Date(date).getDate() + 1)),
              },
            },
          },
        },
      });

      if (!staff) {
        throw new Error(`Staff ${staffId} not found`);
      }

      // Get existing bookings for the day
      const bookings = await this.getStaffBookings(staffId, {
        date,
        status: 'CONFIRMED',
      });

      // Calculate available slots
      const availableSlots = this.calculateAvailableSlots(
        staff.availabilities,
        staff.schedules,
        bookings.bookings,
        date,
        duration,
      );

      return {
        staffId,
        date,
        availableSlots,
        totalSlots: availableSlots.length,
        hasAvailability: availableSlots.length > 0,
      };
    } catch (error) {
      this.logger.error(`Error checking availability for staff ${staffId}:`, error);
      throw error;
    }
  }

  async findAvailableStaff(
    serviceType: string,
    date: string,
    time: string,
    duration: number,
  ): Promise<any[]> {
    try {
      // Get all active staff in relevant department
      let department = 'Yoga';
      if (serviceType.includes('spa')) department = 'Spa';
      if (serviceType.includes('meditation')) department = 'Wellness';

      const staff = await this.prisma.staff.findMany({
        where: {
          department,
          isActive: true,
        },
        include: {
          availabilities: true,
          user: true,
        },
      });

      const availableStaff = [];
      const targetDateTime = new Date(`${date}T${time}`);

      for (const staffMember of staff) {
        const isAvailable = await this.checkStaffAvailability(
          staffMember.id,
          targetDateTime,
          duration,
        );

        if (isAvailable) {
          availableStaff.push({
            id: staffMember.id,
            name: `${staffMember.user.firstName} ${staffMember.user.lastName}`,
            department: staffMember.department,
            rating: await this.getStaffRating(staffMember.id),
            experience: await this.getStaffExperience(staffMember.id),
            specialization: staffMember.skills || [],
          });
        }
      }

      // Sort by rating and experience
      availableStaff.sort((a, b) => {
        if (a.rating !== b.rating) return b.rating - a.rating;
        return b.experience - a.experience;
      });

      return availableStaff;
    } catch (error) {
      this.logger.error('Error finding available staff:', error);
      return [];
    }
  }

  async checkStaffAvailability(
    staffId: string,
    startTime: Date,
    duration: number,
  ): Promise<boolean> {
    const endTime = new Date(startTime.getTime() + duration * 60000);

    // Check staff schedules
    const conflictingSchedules = await this.prisma.schedule.count({
      where: {
        staffId,
        status: { in: ['scheduled', 'in_progress'] },
        OR: [
          {
            startTime: { lt: endTime },
            endTime: { gt: startTime },
          },
        ],
      },
    });

    if (conflictingSchedules > 0) {
      return false;
    }

    // Check time off
    const timeOff = await this.prisma.timeOffRequest.count({
      where: {
        staffId,
        status: 'approved',
        OR: [
          {
            startDate: { lte: endTime },
            endDate: { gte: startTime },
          },
        ],
      },
    });

    if (timeOff > 0) {
      return false;
    }

    // Check existing bookings via booking service
    try {
      const response = await firstValueFrom(
        this.httpService.get(`${this.bookingServiceUrl}/bookings/staff/${staffId}/conflicts`, {
          params: {
            startTime: startTime.toISOString(),
            endTime: endTime.toISOString(),
          },
          headers: {
            'x-service-token': process.env.SERVICE_TOKEN,
          },
          timeout: 3000,
        }),
      );

      return response.data.hasConflicts === false;
    } catch (error) {
      this.logger.error(`Error checking booking conflicts for staff ${staffId}:`, error);
      return true; // Assume available if can't check
    }
  }

  async updateStaffBookingStats(staffId: string): Promise<void> {
    const bookings = await this.getStaffBookings(staffId, {
      status: 'COMPLETED',
      period: 'month',
    });

    const stats = {
      totalBookings: bookings.total,
      completedThisMonth: bookings.bookings.length,
      revenueGenerated: bookings.bookings.reduce((sum, b) => sum + (b.totalAmount || 0), 0),
      averageRating: await this.calculateAverageBookingRating(bookings.bookings),
      lastUpdated: new Date(),
    };

    await this.prisma.staff.update({
      where: { id: staffId },
      data: {
        metadata: {
          bookingStats: stats,
        },
        updatedBy: 'system-booking-sync',
      },
    });
  }

  async handleBookingCreated(event: any): Promise<void> {
    // Handle booking.created event
    const { bookingId, staffId, serviceType, startTime, duration } = event.data;

    if (staffId) {
      // Update staff schedule
      const endTime = new Date(new Date(startTime).getTime() + duration * 60000);
      
      await this.prisma.schedule.create({
        data: {
          staffId,
          type: `booking_${serviceType}`,
          startTime: new Date(startTime),
          endTime,
          status: 'scheduled',
          location: 'Studio',
          createdBy: 'system-booking',
          metadata: {
            bookingId,
            serviceType,
            autoCreated: true,
          },
        },
      });

      this.logger.log(`Created schedule from booking ${bookingId} for staff ${staffId}`);
    }
  }

  async handleBookingCancelled(event: any): Promise<void> {
    // Handle booking.cancelled event
    const { bookingId, staffId } = event.data;

    if (staffId) {
      // Remove or update corresponding schedule
      await this.prisma.schedule.updateMany({
        where: {
          staffId,
          metadata: {
            path: ['bookingId'],
            equals: bookingId,
          },
        },
        data: {
          status: 'cancelled',
          updatedBy: 'system-booking-cancellation',
        },
      });

      this.logger.log(`Updated schedules for cancelled booking ${bookingId}`);
    }
  }

  async handleBookingRescheduled(event: any): Promise<void> {
    // Handle booking.rescheduled event
    const { bookingId, staffId, newStartTime, newEndTime } = event.data;

    if (staffId) {
      // Update corresponding schedule
      await this.prisma.schedule.updateMany({
        where: {
          staffId,
          metadata: {
            path: ['bookingId'],
            equals: bookingId,
          },
        },
        data: {
          startTime: new Date(newStartTime),
          endTime: new Date(newEndTime),
          updatedBy: 'system-booking-reschedule',
        },
      });

      this.logger.log(`Rescheduled booking ${bookingId} for staff ${staffId}`);
    }
  }

  private calculateAvailableSlots(
    availabilities: any[],
    schedules: any[],
    bookings: any[],
    date: string,
    duration: number,
  ): string[] {
    const slots: string[] = [];
    const dayOfWeek = new Date(date).getDay();

    // Get availability for this day
    const dayAvailability = availabilities.find(a => a.dayOfWeek === dayOfWeek);
    if (!dayAvailability) return [];

    // Generate slots based on availability and existing commitments
    const startHour = parseInt(dayAvailability.startTime.split(':')[0]);
    const endHour = parseInt(dayAvailability.endTime.split(':')[0]);

    for (let hour = startHour; hour < endHour; hour++) {
      for (let minute = 0; minute < 60; minute += 15) { // 15-minute intervals
        const slotStart = new Date(date);
        slotStart.setHours(hour, minute, 0, 0);
        const slotEnd = new Date(slotStart.getTime() + duration * 60000);

        // Check if slot conflicts with schedules
        const hasScheduleConflict = schedules.some(schedule => {
          return slotStart < schedule.endTime && slotEnd > schedule.startTime;
        });

        // Check if slot conflicts with bookings
        const hasBookingConflict = bookings.some(booking => {
          return slotStart < new Date(booking.endTime) && slotEnd > new Date(booking.startTime);
        });

        if (!hasScheduleConflict && !hasBookingConflict) {
          slots.push(`${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`);
        }
      }
    }

    return slots;
  }

  private async getStaffRating(staffId: string): Promise<number> {
    // Get average rating from reviews
    const reviews = await this.prisma.performanceReview.findMany({
      where: { staffId },
      select: { rating: true },
    });

    if (reviews.length === 0) return 4.0; // Default rating

    const sum = reviews.reduce((total, review) => total + review.rating, 0);
    return sum / reviews.length;
  }

  private async getStaffExperience(staffId: string): Promise<number> {
    // Calculate experience in months
    const staff = await this.prisma.staff.findUnique({
      where: { id: staffId },
      select: { hireDate: true },
    });

    if (!staff || !staff.hireDate) return 0;

    const hireDate = new Date(staff.hireDate);
    const now = new Date();
    const months = (now.getFullYear() - hireDate.getFullYear()) * 12 +
                  (now.getMonth() - hireDate.getMonth());

    return Math.max(0, months);
  }

  private async calculateAverageBookingRating(bookings: any[]): Promise<number> {
    // Calculate average rating from booking reviews
    let totalRating = 0;
    let ratedBookings = 0;

    for (const booking of bookings) {
      if (booking.review && booking.review.rating) {
        totalRating += booking.review.rating;
        ratedBookings++;
      }
    }

    return ratedBookings > 0 ? totalRating / ratedBookings : 0;
  }
}