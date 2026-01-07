import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { CreateBookingDto } from './dto/create-booking.dto';
import { UpdateBookingDto } from './dto/update-booking.dto';

const prisma = new PrismaClient();

@Injectable()
export class BookingService {
  async create(createBookingDto: CreateBookingDto) {
    // Check availability
    await this.checkAvailability(createBookingDto);
    
    // Calculate price
    const priceDetails = await this.calculatePrice(createBookingDto);
    
    // Create booking
    const booking = await prisma.booking.create({
      data: {
        userId: createBookingDto.userId,
        classId: createBookingDto.classId,
        sessionId: createBookingDto.sessionId,
        productId: createBookingDto.productId,
        startTime: createBookingDto.startTime,
        endTime: createBookingDto.endTime,
        timezone: createBookingDto.timezone || 'UTC',
        participants: createBookingDto.participants || 1,
        participantNames: createBookingDto.participantNames || [],
        guestEmails: createBookingDto.guestEmails || [],
        basePrice: priceDetails.basePrice,
        tax: priceDetails.tax,
        discount: priceDetails.discount,
        totalAmount: priceDetails.totalAmount,
        currency: priceDetails.currency || 'USD',
        notes: createBookingDto.notes,
        specialRequests: createBookingDto.specialRequests,
        source: createBookingDto.source || 'WEB',
        status: 'CONFIRMED',
        paymentStatus: 'PENDING',
        checkinStatus: 'NOT_CHECKED_IN',
      },
      include: {
        yogaClass: true,
        liveSession: true,
        product: true,
      },
    });

    // Update availability counts
    await this.updateAvailability(booking);

    // Create calendar event
    await this.createCalendarEvent(booking);

    // Send notifications
    await this.sendBookingConfirmation(booking);

    return booking;
  }

  async findAll(query: any) {
    const {
      userId,
      status,
      startDate,
      endDate,
      page = 1,
      limit = 20,
      type,
    } = query;

    const skip = (page - 1) * limit;
    const where: any = {};

    if (userId) where.userId = userId;
    if (status) where.status = status;
    if (type) where.type = type;
    if (startDate || endDate) {
      where.startTime = {};
      if (startDate) where.startTime.gte = new Date(startDate);
      if (endDate) where.startTime.lte = new Date(endDate);
    }

    const [bookings, total] = await Promise.all([
      prisma.booking.findMany({
        where,
        include: {
          yogaClass: true,
          liveSession: true,
          product: true,
          payments: {
            take: 1,
            orderBy: { createdAt: 'desc' },
          },
        },
        orderBy: { startTime: 'desc' },
        skip,
        take: limit,
      }),
      prisma.booking.count({ where }),
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

  async findOne(id: string) {
    const booking = await prisma.booking.findUnique({
      where: { id },
      include: {
        yogaClass: {
          include: {
            instructor: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                avatar: true,
              },
            },
          },
        },
        liveSession: {
          include: {
            instructor: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                avatar: true,
              },
            },
          },
        },
        product: true,
        payments: true,
        reviews: true,
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            phone: true,
          },
        },
      },
    });

    if (!booking) {
      throw new NotFoundException('Booking not found');
    }

    return booking;
  }

  async update(id: string, updateBookingDto: UpdateBookingDto) {
    const booking = await prisma.booking.findUnique({
      where: { id },
    });

    if (!booking) {
      throw new NotFoundException('Booking not found');
    }

    // Check if update is allowed based on status
    this.validateUpdate(booking, updateBookingDto);

    const updatedBooking = await prisma.booking.update({
      where: { id },
      data: updateBookingDto,
      include: {
        yogaClass: true,
        liveSession: true,
        product: true,
      },
    });

    // Send update notification
    await this.sendBookingUpdateNotification(updatedBooking);

    return updatedBooking;
  }

  async cancel(id: string, reason?: string) {
    const booking = await prisma.booking.findUnique({
      where: { id },
    });

    if (!booking) {
      throw new NotFoundException('Booking not found');
    }

    // Check cancellation policy
    const cancellationAllowed = await this.checkCancellationPolicy(booking);
    if (!cancellationAllowed) {
      throw new BadRequestException('Cancellation not allowed at this time');
    }

    // Calculate refund if applicable
    const refundAmount = await this.calculateRefund(booking);

    const cancelledBooking = await prisma.booking.update({
      where: { id },
      data: {
        status: 'CANCELLED',
        cancelledAt: new Date(),
        cancellationReason: reason,
        refundAmount,
      },
      include: {
        yogaClass: true,
        liveSession: true,
        product: true,
      },
    });

    // Update availability
    await this.updateAvailabilityAfterCancellation(cancelledBooking);

    // Send cancellation notifications
    await this.sendCancellationNotification(cancelledBooking, refundAmount);

    // Process refund if needed
    if (refundAmount > 0) {
      await this.processRefund(booking, refundAmount);
    }

    return cancelledBooking;
  }

  async checkAvailability(dto: CreateBookingDto) {
    const { classId, sessionId, startTime, endTime, participants = 1 } = dto;

    if (classId) {
      const yogaClass = await prisma.yogaClass.findUnique({
        where: { id: classId },
      });

      if (!yogaClass) {
        throw new NotFoundException('Class not found');
      }

      if (yogaClass.status !== 'SCHEDULED') {
        throw new BadRequestException('Class is not available for booking');
      }

      if (yogaClass.booked + participants > yogaClass.capacity) {
        throw new BadRequestException('Class is full');
      }

      // Check for overlapping bookings for the same user
      const existingBooking = await prisma.booking.findFirst({
        where: {
          userId: dto.userId,
          classId,
          status: { in: ['CONFIRMED', 'PENDING'] },
          OR: [
            {
              startTime: { lt: endTime },
              endTime: { gt: startTime },
            },
          ],
        },
      });

      if (existingBooking) {
        throw new BadRequestException('You already have a booking for this time');
      }
    }

    if (sessionId) {
      const session = await prisma.liveSession.findUnique({
        where: { id: sessionId },
      });

      if (!session) {
        throw new NotFoundException('Session not found');
      }

      if (session.status !== 'SCHEDULED' && session.status !== 'LIVE') {
        throw new BadRequestException('Session is not available for booking');
      }

      if (session.currentParticipants + participants > session.maxParticipants) {
        throw new BadRequestException('Session is full');
      }
    }

    return { available: true };
  }

  async checkin(bookingId: string) {
    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
    });

    if (!booking) {
      throw new NotFoundException('Booking not found');
    }

    // Validate checkin time (allow 15 minutes before and after)
    const now = new Date();
    const startTime = new Date(booking.startTime);
    const fifteenMinutesBefore = new Date(startTime.getTime() - 15 * 60000);
    const fifteenMinutesAfter = new Date(startTime.getTime() + 15 * 60000);

    if (now < fifteenMinutesBefore) {
      throw new BadRequestException('Check-in is too early');
    }

    if (now > fifteenMinutesAfter) {
      throw new BadRequestException('Check-in is too late');
    }

    const updatedBooking = await prisma.booking.update({
      where: { id: bookingId },
      data: {
        checkinStatus: 'CHECKED_IN',
        checkedInAt: new Date(),
      },
    });

    // Send check-in confirmation
    await this.sendCheckinConfirmation(updatedBooking);

    return updatedBooking;
  }

  async checkout(bookingId: string) {
    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
    });

    if (!booking) {
      throw new NotFoundException('Booking not found');
    }

    if (booking.checkinStatus !== 'CHECKED_IN') {
      throw new BadRequestException('Booking is not checked in');
    }

    const updatedBooking = await prisma.booking.update({
      where: { id: bookingId },
      data: {
        checkinStatus: 'CHECKED_OUT',
        checkedOutAt: new Date(),
        status: 'COMPLETED',
      },
    });

    // Request review
    await this.requestReview(updatedBooking);

    return updatedBooking;
  }

  async findByUser(userId: string, query: any) {
    const { status, upcoming, past, page = 1, limit = 20 } = query;
    const skip = (page - 1) * limit;

    const where: any = { userId };

    if (status) where.status = status;

    if (upcoming) {
      where.startTime = { gte: new Date() };
    }

    if (past) {
      where.startTime = { lt: new Date() };
    }

    const [bookings, total] = await Promise.all([
      prisma.booking.findMany({
        where,
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
          liveSession: {
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
          product: true,
        },
        orderBy: { startTime: 'desc' },
        skip,
        take: limit,
      }),
      prisma.booking.count({ where }),
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

  // Helper methods
  private async calculatePrice(dto: CreateBookingDto) {
    let basePrice = 0;
    
    if (dto.classId) {
      const yogaClass = await prisma.yogaClass.findUnique({
        where: { id: dto.classId },
      });
      basePrice = yogaClass?.price || 0;
    } else if (dto.sessionId) {
      const session = await prisma.liveSession.findUnique({
        where: { id: dto.sessionId },
      });
      basePrice = session?.price || 0;
    } else if (dto.productId) {
      const product = await prisma.product.findUnique({
        where: { id: dto.productId },
      });
      basePrice = product?.price || 0;
    }

    const participants = dto.participants || 1;
    const subtotal = basePrice * participants;
    const tax = subtotal * 0.1; // 10% tax
    const discount = 0; // Calculate based on promotions
    const totalAmount = subtotal + tax - discount;

    return {
      basePrice,
      subtotal,
      tax,
      discount,
      totalAmount,
      currency: 'USD',
    };
  }

  private async updateAvailability(booking: any) {
    if (booking.classId) {
      await prisma.yogaClass.update({
        where: { id: booking.classId },
        data: {
          booked: { increment: booking.participants },
          status: booking.participants >= booking.yogaClass?.capacity ? 'FULL' : 'SCHEDULED',
        },
      });
    }

    if (booking.sessionId) {
      await prisma.liveSession.update({
        where: { id: booking.sessionId },
        data: {
          currentParticipants: { increment: booking.participants },
          status: booking.participants >= booking.liveSession?.maxParticipants ? 'FULL' : 'LIVE',
        },
      });
    }

    if (booking.productId) {
      await prisma.product.update({
        where: { id: booking.productId },
        data: {
          stock: { decrement: booking.participants },
          status: booking.participants >= booking.product?.stock ? 'OUT_OF_STOCK' : 'ACTIVE',
        },
      });
    }
  }

  private async createCalendarEvent(booking: any) {
    await prisma.calendarEvent.create({
      data: {
        userId: booking.userId,
        bookingId: booking.id,
        title: this.getEventTitle(booking),
        description: this.getEventDescription(booking),
        startTime: booking.startTime,
        endTime: booking.endTime,
        timezone: booking.timezone || 'UTC',
        status: 'confirmed',
        visibility: 'private',
      },
    });
  }

  private getEventTitle(booking: any): string {
    if (booking.yogaClass) return `${booking.yogaClass.title} - Yoga Class`;
    if (booking.liveSession) return `${booking.liveSession.title} - Live Session`;
    if (booking.product) return `${booking.product.name} - Product Purchase`;
    return 'Booking';
  }

  private getEventDescription(booking: any): string {
    let description = `Booking ID: ${booking.id}\n`;
    if (booking.yogaClass) description += `Instructor: ${booking.yogaClass.instructor?.firstName} ${booking.yogaClass.instructor?.lastName}\n`;
    if (booking.notes) description += `Notes: ${booking.notes}\n`;
    return description;
  }

  private validateUpdate(booking: any, updateDto: UpdateBookingDto) {
    const now = new Date();
    const bookingStart = new Date(booking.startTime);
    const hoursUntilBooking = (bookingStart.getTime() - now.getTime()) / (1000 * 60 * 60);

    // Don't allow updates within 2 hours of booking
    if (hoursUntilBooking < 2 && booking.status === 'CONFIRMED') {
      throw new BadRequestException('Cannot update booking within 2 hours of start time');
    }

    // Don't allow updates to cancelled or completed bookings
    if (['CANCELLED', 'COMPLETED', 'NO_SHOW'].includes(booking.status)) {
      throw new BadRequestException(`Cannot update ${booking.status.toLowerCase()} booking`);
    }
  }

  private async checkCancellationPolicy(booking: any) {
    const now = new Date();
    const bookingStart = new Date(booking.startTime);
    const hoursUntilBooking = (bookingStart.getTime() - now.getTime()) / (1000 * 60 * 60);

    // Allow cancellation up to 12 hours before
    return hoursUntilBooking >= 12;
  }

  private async calculateRefund(booking: any) {
    const now = new Date();
    const bookingStart = new Date(booking.startTime);
    const hoursUntilBooking = (bookingStart.getTime() - now.getTime()) / (1000 * 60 * 60);

    if (hoursUntilBooking >= 24) {
      return booking.totalAmount; // Full refund if 24+ hours
    } else if (hoursUntilBooking >= 12) {
      return booking.totalAmount * 0.5; // 50% refund if 12-24 hours
    } else {
      return 0; // No refund within 12 hours
    }
  }

  private async sendBookingConfirmation(booking: any) {
    // Implementation depends on notification service
    console.log(`Sending booking confirmation for booking ${booking.id}`);
  }

  private async sendBookingUpdateNotification(booking: any) {
    console.log(`Sending booking update notification for booking ${booking.id}`);
  }

  private async sendCancellationNotification(booking: any, refundAmount: number) {
    console.log(`Sending cancellation notification for booking ${booking.id}, refund: ${refundAmount}`);
  }

  private async sendCheckinConfirmation(booking: any) {
    console.log(`Sending check-in confirmation for booking ${booking.id}`);
  }

  private async requestReview(booking: any) {
    console.log(`Requesting review for booking ${booking.id}`);
  }

  private async processRefund(booking: any, amount: number) {
    console.log(`Processing refund of ${amount} for booking ${booking.id}`);
  }

  private async updateAvailabilityAfterCancellation(booking: any) {
    if (booking.classId) {
      await prisma.yogaClass.update({
        where: { id: booking.classId },
        data: {
          booked: { decrement: booking.participants },
          status: 'SCHEDULED',
        },
      });
    }

    if (booking.sessionId) {
      await prisma.liveSession.update({
        where: { id: booking.sessionId },
        data: {
          currentParticipants: { decrement: booking.participants },
          status: 'LIVE',
        },
      });
    }

    if (booking.productId) {
      await prisma.product.update({
        where: { id: booking.productId },
        data: {
          stock: { increment: booking.participants },
          status: 'ACTIVE',
        },
      });
    }
  }

  async checkDatabase() {
    try {
      await prisma.$queryRaw`SELECT 1`;
      return 'connected';
    } catch (error) {
      return 'disconnected';
    }
  }
}