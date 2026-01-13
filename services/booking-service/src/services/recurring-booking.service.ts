import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { CreateRecurringBookingDto, UpdateRecurringBookingDto } from '../dto/recurring-booking.dto';
import { RRule, RRuleSet, rrulestr } from 'rrule';
import * as moment from 'moment';

@Injectable()
export class RecurringBookingService {
  private prisma = new PrismaClient();

  async createRecurringBooking(createDto: CreateRecurringBookingDto) {
    // Validate parent resource
    await this.validateParentResource(createDto);

    // Calculate price
    const priceDetails = await this.calculateRecurringPrice(createDto);

    // Generate RRULE
    const rrule = this.generateRRule(createDto);

    const recurringBooking = await this.prisma.recurringBooking.create({
      data: {
        userId: createDto.userId,
        classId: createDto.classId,
        sessionId: createDto.sessionId,
        productId: createDto.productId,
        firstOccurrence: new Date(createDto.firstOccurrence),
        duration: createDto.duration,
        recurrenceType: createDto.recurrenceType,
        repeatEvery: createDto.repeatEvery,
        daysOfWeek: createDto.daysOfWeek,
        customRule: createDto.customRule || rrule.toString(),
        endDate: createDto.endDate ? new Date(createDto.endDate) : null,
        occurrenceCount: createDto.occurrenceCount,
        excludeDates: createDto.excludeDates,
        participants: createDto.participants || 1,
        participantNames: createDto.participantNames || [],
        guestEmails: createDto.guestEmails || [],
        notes: createDto.notes,
        specialRequests: createDto.specialRequests,
        source: createDto.source || 'WEB',
        basePrice: priceDetails.basePrice,
        discount: priceDetails.discount,
        totalAmount: priceDetails.totalAmount,
        currency: priceDetails.currency || 'USD',
        status: 'ACTIVE',
      },
    });

    // Generate initial bookings
    await this.generateBookings(recurringBooking.id);

    // Create payment plan if needed
    if (!createDto.skipFirstPayment) {
      await this.createPaymentPlan(recurringBooking);
    }

    return recurringBooking;
  }

  async updateRecurringBooking(id: string, updateDto: UpdateRecurringBookingDto) {
    const recurringBooking = await this.prisma.recurringBooking.findUnique({
      where: { id },
    });

    if (!recurringBooking) {
      throw new NotFoundException('Recurring booking not found');
    }

    const updated = await this.prisma.recurringBooking.update({
      where: { id },
      data: updateDto,
    });

    // If status changed to CANCELLED, cancel future bookings
    if (updateDto.status === 'CANCELLED') {
      await this.cancelFutureBookings(id, updateDto.cancellationReason);
    }

    // If paused, update future bookings
    if (updateDto.status === 'PAUSED' && updateDto.pauseUntil) {
      await this.pauseFutureBookings(id, new Date(updateDto.pauseUntil));
    }

    return updated;
  }

  async generateBookings(recurringBookingId: string, upToDate?: Date) {
    const recurringBooking = await this.prisma.recurringBooking.findUnique({
      where: { id: recurringBookingId },
      include: { bookings: true },
    });

    if (!recurringBooking) {
      throw new NotFoundException('Recurring booking not found');
    }

    const rrule = rrulestr(recurringBooking.customRule);
    const endDate = upToDate || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days ahead
    const dates = rrule.between(recurringBooking.firstOccurrence, endDate);

    const existingDates = recurringBooking.bookings.map(b =>
      moment(b.startTime).startOf('day').toISOString()
    );

    const newBookings = [];
    for (const date of dates) {
      const dateStr = moment(date).startOf('day').toISOString();
      if (!existingDates.includes(dateStr)) {
        const booking = await this.createBookingFromRecurring(recurringBooking, date);
        newBookings.push(booking);
      }
    }

    await this.prisma.recurringBooking.update({
      where: { id: recurringBookingId },
      data: {
        generatedCount: { increment: newBookings.length },
      },
    });

    return newBookings;
  }

  async getRecurringBooking(id: string) {
    const recurringBooking = await this.prisma.recurringBooking.findUnique({
      where: { id },
      include: {
        bookings: {
          include: {
            yogaClass: {
              include: {
                instructor: {
                  select: {
                    firstName: true,
                    lastName: true,
                    avatar: true,
                  },
                },
              },
            },
          },
          orderBy: { startTime: 'asc' },
          take: 20,
        },
      },
    });

    if (!recurringBooking) {
      throw new NotFoundException('Recurring booking not found');
    }

    // Calculate upcoming occurrences
    const rrule = rrulestr(recurringBooking.customRule);
    const upcomingDates = rrule.between(new Date(), new Date(Date.now() + 90 * 24 * 60 * 60 * 1000));
    
    return {
      ...recurringBooking,
      upcomingOccurrences: upcomingDates,
      totalGenerated: recurringBooking.generatedCount,
      totalCancelled: recurringBooking.cancelledCount,
    };
  }

  async listRecurringBookings(userId: string, filters: any) {
    const { status, type, page = 1, limit = 20 } = filters;
    const skip = (page - 1) * limit;

    const where: any = { userId };
    if (status) where.status = status;
    if (type) where.recurrenceType = type;

    const [bookings, total] = await Promise.all([
      this.prisma.recurringBooking.findMany({
        where,
        include: {
          _count: {
            select: { bookings: true },
          },
          bookings: {
            take: 1,
            orderBy: { startTime: 'desc' },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.recurringBooking.count({ where }),
    ]);

    return {
      bookings,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(total / limit),
      },
    };
  }

  private async validateParentResource(dto: CreateRecurringBookingDto) {
    if (dto.classId) {
      const yogaClass = await this.prisma.yogaClass.findUnique({
        where: { id: dto.classId },
      });
      if (!yogaClass) {
        throw new NotFoundException('Class not found');
      }
      if (!yogaClass.recurringEnabled) {
        throw new BadRequestException('This class does not support recurring bookings');
      }
    }

    if (dto.sessionId) {
      const session = await this.prisma.liveSession.findUnique({
        where: { id: dto.sessionId },
      });
      if (!session) {
        throw new NotFoundException('Session not found');
      }
      if (!session.recurrenceRule) {
        throw new BadRequestException('This session does not support recurring bookings');
      }
    }
  }

  private generateRRule(dto: CreateRecurringBookingDto): RRule {
    const startDate = new Date(dto.firstOccurrence);
    const options: any = {
      freq: this.getFrequency(dto.recurrenceType),
      dtstart: startDate,
      interval: dto.repeatEvery || 1,
    };

    if (dto.daysOfWeek && dto.daysOfWeek.length > 0) {
      options.byweekday = dto.daysOfWeek.map(day => this.getWeekday(day));
    }

    if (dto.endDate) {
      options.until = new Date(dto.endDate);
    } else if (dto.occurrenceCount) {
      options.count = dto.occurrenceCount;
    }

    if (dto.customRule) {
      return rrulestr(dto.customRule);
    }

    return new RRule(options);
  }

  private getFrequency(type: string): number {
    const frequencies = {
      DAILY: RRule.DAILY,
      WEEKLY: RRule.WEEKLY,
      BIWEEKLY: RRule.WEEKLY,
      MONTHLY: RRule.MONTHLY,
    };
    return frequencies[type] || RRule.WEEKLY;
  }

  private getWeekday(day: number): number {
    const weekdays = [RRule.SU, RRule.MO, RRule.TU, RRule.WE, RRule.TH, RRule.FR, RRule.SA];
    return weekdays[day] || RRule.MO;
  }

  private async calculateRecurringPrice(dto: CreateRecurringBookingDto) {
    let basePrice = 0;
    const participants = dto.participants || 1;

    if (dto.classId) {
      const yogaClass = await this.prisma.yogaClass.findUnique({
        where: { id: dto.classId },
      });
      basePrice = yogaClass?.price || 0;
    } else if (dto.sessionId) {
      const session = await this.prisma.liveSession.findUnique({
        where: { id: dto.sessionId },
      });
      basePrice = session?.price || 0;
    }

    // Apply recurring discount
    const discount = basePrice * participants * 0.1; // 10% discount for recurring
    const subtotal = basePrice * participants;
    const totalAmount = subtotal - discount;

    return {
      basePrice: basePrice * participants,
      subtotal,
      discount,
      totalAmount,
      currency: 'USD',
    };
  }

  private async createBookingFromRecurring(recurringBooking: any, date: Date) {
    const endTime = new Date(date.getTime() + recurringBooking.duration * 60000);

    return this.prisma.booking.create({
      data: {
        userId: recurringBooking.userId,
        classId: recurringBooking.classId,
        sessionId: recurringBooking.sessionId,
        productId: recurringBooking.productId,
        startTime: date,
        endTime: endTime,
        participants: recurringBooking.participants,
        participantNames: recurringBooking.participantNames,
        guestEmails: recurringBooking.guestEmails,
        basePrice: recurringBooking.basePrice,
        discount: recurringBooking.discount,
        totalAmount: recurringBooking.totalAmount,
        currency: recurringBooking.currency,
        notes: recurringBooking.notes,
        specialRequests: recurringBooking.specialRequests,
        source: recurringBooking.source,
        status: 'CONFIRMED',
        paymentStatus: recurringBooking.paymentPlanId ? 'SCHEDULED' : 'PENDING',
        recurringBookingId: recurringBooking.id,
      },
    });
  }

  private async createPaymentPlan(recurringBooking: any) {
    // Implementation for payment plan creation
    // This would integrate with payment service
    console.log('Creating payment plan for recurring booking:', recurringBooking.id);
    return { success: true };
  }

  private async cancelFutureBookings(recurringBookingId: string, reason?: string) {
    const futureBookings = await this.prisma.booking.findMany({
      where: {
        recurringBookingId,
        startTime: { gt: new Date() },
        status: { in: ['CONFIRMED', 'PENDING'] },
      },
    });

    for (const booking of futureBookings) {
      await this.prisma.booking.update({
        where: { id: booking.id },
        data: {
          status: 'CANCELLED',
          cancelledAt: new Date(),
          cancellationReason: `Recurring booking cancelled: ${reason}`,
        },
      });
    }

    await this.prisma.recurringBooking.update({
      where: { id: recurringBookingId },
      data: {
        cancelledCount: { increment: futureBookings.length },
      },
    });
  }

  private async pauseFutureBookings(recurringBookingId: string, pauseUntil: Date) {
    const futureBookings = await this.prisma.booking.findMany({
      where: {
        recurringBookingId,
        startTime: { gt: new Date(), lt: pauseUntil },
        status: { in: ['CONFIRMED', 'PENDING'] },
      },
    });

    for (const booking of futureBookings) {
      await this.prisma.booking.update({
        where: { id: booking.id },
        data: {
          status: 'CANCELLED',
          cancelledAt: new Date(),
          cancellationReason: 'Booking paused',
        },
      });
    }
  }
}