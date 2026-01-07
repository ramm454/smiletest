import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { 
  CreateYogaClassDto, 
  UpdateYogaClassDto,
  CreateInstructorDto,
  UpdateInstructorDto,
  ClassFilterDto 
} from './dto/yoga.dto';

const prisma = new PrismaClient();

@Injectable()
export class YogaService {
  // Class Management
  async createClass(createYogaClassDto: CreateYogaClassDto, instructorId: string) {
    // Validate schedule
    await this.validateClassSchedule(createYogaClassDto);

    const yogaClass = await prisma.yogaClass.create({
      data: {
        ...createYogaClassDto,
        instructorId,
        status: 'SCHEDULED',
        booked: 0,
      },
      include: {
        instructor: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            avatar: true,
            bio: true,
          },
        },
      },
    });

    // Create recurring classes if specified
    if (createYogaClassDto.recurrenceRule) {
      await this.createRecurringClasses(yogaClass, createYogaClassDto.recurrenceRule);
    }

    return yogaClass;
  }

  async getClass(classId: string) {
    const yogaClass = await prisma.yogaClass.findUnique({
      where: { id: classId },
      include: {
        instructor: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            avatar: true,
            bio: true,
            specialties: true,
            rating: true,
          },
        },
        bookings: {
          take: 10,
          orderBy: { createdAt: 'desc' },
          select: {
            id: true,
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                avatar: true,
              },
            },
            status: true,
            createdAt: true,
          },
        },
        _count: {
          select: {
            bookings: true,
            waitlist: true,
          },
        },
      },
    });

    if (!yogaClass) {
      throw new NotFoundException('Class not found');
    }

    return yogaClass;
  }

  async listClasses(filters: ClassFilterDto) {
    const {
      type,
      difficulty,
      instructorId,
      date,
      status,
      search,
      page = 1,
      limit = 20,
      location,
      minPrice,
      maxPrice,
      sortBy = 'startTime',
      sortOrder = 'asc',
    } = filters;

    const skip = (page - 1) * limit;
    const where: any = {};

    if (type) where.type = type;
    if (difficulty) where.difficulty = difficulty;
    if (instructorId) where.instructorId = instructorId;
    if (status) where.status = status;
    if (location) where.location = location;
    if (minPrice !== undefined || maxPrice !== undefined) {
      where.price = {};
      if (minPrice !== undefined) where.price.gte = minPrice;
      if (maxPrice !== undefined) where.price.lte = maxPrice;
    }
    if (date) {
      const startDate = new Date(date);
      startDate.setHours(0, 0, 0, 0);
      const endDate = new Date(date);
      endDate.setHours(23, 59, 59, 999);
      where.startTime = {
        gte: startDate,
        lte: endDate,
      };
    }
    if (search) {
      where.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
        { instructor: { 
          OR: [
            { firstName: { contains: search, mode: 'insensitive' } },
            { lastName: { contains: search, mode: 'insensitive' } },
          ],
        }},
      ];
    }

    const [classes, total] = await Promise.all([
      prisma.yogaClass.findMany({
        where,
        include: {
          instructor: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              avatar: true,
              rating: true,
            },
          },
          _count: {
            select: {
              bookings: true,
            },
          },
        },
        orderBy: { [sortBy]: sortOrder },
        skip,
        take: limit,
      }),
      prisma.yogaClass.count({ where }),
    ]);

    return {
      classes,
      pagination: {
        total,
        page: parseInt(page.toString()),
        limit: parseInt(limit.toString()),
        pages: Math.ceil(total / limit),
      },
    };
  }

  async updateClass(classId: string, instructorId: string, updateDto: UpdateYogaClassDto) {
    const yogaClass = await prisma.yogaClass.findFirst({
      where: {
        id: classId,
        instructorId,
      },
    });

    if (!yogaClass) {
      throw new NotFoundException('Class not found or unauthorized');
    }

    // Don't allow updates if class has started
    if (yogaClass.status !== 'SCHEDULED') {
      throw new BadRequestException('Cannot update class that has already started');
    }

    const updatedClass = await prisma.yogaClass.update({
      where: { id: classId },
      data: updateDto,
      include: {
        instructor: true,
      },
    });

    // Notify booked users of changes
    await this.notifyClassUpdates(classId, updateDto);

    return updatedClass;
  }

  async cancelClass(classId: string, instructorId: string, reason?: string) {
    const yogaClass = await prisma.yogaClass.findFirst({
      where: {
        id: classId,
        instructorId,
      },
      include: {
        bookings: {
          where: { status: 'CONFIRMED' },
          include: {
            user: true,
          },
        },
      },
    });

    if (!yogaClass) {
      throw new NotFoundException('Class not found or unauthorized');
    }

    const cancelledClass = await prisma.yogaClass.update({
      where: { id: classId },
      data: {
        status: 'CANCELLED',
        cancelledAt: new Date(),
        cancellationReason: reason,
      },
    });

    // Cancel all bookings and notify users
    for (const booking of yogaClass.bookings) {
      await prisma.booking.update({
        where: { id: booking.id },
        data: {
          status: 'CANCELLED',
          cancelledAt: new Date(),
          cancellationReason: `Class cancelled: ${reason || 'No reason provided'}`,
          refundAmount: booking.totalAmount,
        },
      });

      // Notify user
      await this.notifyUser(booking.userId, 'class_cancelled', {
        classId,
        className: yogaClass.title,
        reason,
        refundAmount: booking.totalAmount,
      });
    }

    // Notify waitlist
    await this.notifyWaitlist(classId, 'class_cancelled', {
      classId,
      className: yogaClass.title,
      reason,
    });

    return cancelledClass;
  }

  // Instructor Management
  async createInstructor(createInstructorDto: CreateInstructorDto, userId: string) {
    const instructor = await prisma.instructor.create({
      data: {
        userId,
        ...createInstructorDto,
        status: 'ACTIVE',
      },
    });

    return instructor;
  }

  async getInstructor(instructorId: string) {
    const instructor = await prisma.instructor.findUnique({
      where: { id: instructorId },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            avatar: true,
            email: true,
            phone: true,
          },
        },
        classes: {
          take: 10,
          orderBy: { startTime: 'desc' },
          where: { status: { not: 'CANCELLED' } },
        },
        _count: {
          select: {
            classes: true,
            reviews: true,
          },
        },
      },
    });

    if (!instructor) {
      throw new NotFoundException('Instructor not found');
    }

    // Calculate average rating
    const reviews = await prisma.review.findMany({
      where: { instructorId },
      select: { rating: true },
    });

    const averageRating = reviews.length > 0
      ? reviews.reduce((sum, review) => sum + review.rating, 0) / reviews.length
      : 0;

    return {
      ...instructor,
      averageRating,
      totalReviews: reviews.length,
    };
  }

  async listInstructors(filters: any) {
    const {
      specialty,
      rating,
      status,
      search,
      page = 1,
      limit = 20,
    } = filters;

    const skip = (page - 1) * limit;
    const where: any = {};

    if (specialty) where.specialties = { has: specialty };
    if (rating !== undefined) where.rating = { gte: rating };
    if (status) where.status = status;
    if (search) {
      where.OR = [
        { bio: { contains: search, mode: 'insensitive' } },
        { user: {
          OR: [
            { firstName: { contains: search, mode: 'insensitive' } },
            { lastName: { contains: search, mode: 'insensitive' } },
          ],
        }},
      ];
    }

    const [instructors, total] = await Promise.all([
      prisma.instructor.findMany({
        where,
        include: {
          user: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              avatar: true,
            },
          },
          _count: {
            select: {
              classes: true,
              reviews: true,
            },
          },
        },
        orderBy: { rating: 'desc' },
        skip,
        take: limit,
      }),
      prisma.instructor.count({ where }),
    ]);

    // Calculate ratings for each instructor
    const instructorsWithRatings = await Promise.all(
      instructors.map(async (instructor) => {
        const reviews = await prisma.review.findMany({
          where: { instructorId: instructor.id },
          select: { rating: true },
        });

        const averageRating = reviews.length > 0
          ? reviews.reduce((sum, review) => sum + review.rating, 0) / reviews.length
          : 0;

        return {
          ...instructor,
          averageRating,
          totalReviews: reviews.length,
        };
      })
    );

    return {
      instructors: instructorsWithRatings,
      pagination: {
        total,
        page: parseInt(page.toString()),
        limit: parseInt(limit.toString()),
        pages: Math.ceil(total / limit),
      },
    };
  }

  async updateInstructor(instructorId: string, updateDto: UpdateInstructorDto) {
    const instructor = await prisma.instructor.findUnique({
      where: { id: instructorId },
    });

    if (!instructor) {
      throw new NotFoundException('Instructor not found');
    }

    const updatedInstructor = await prisma.instructor.update({
      where: { id: instructorId },
      data: updateDto,
      include: {
        user: true,
      },
    });

    return updatedInstructor;
  }

  // Pose Library Management
  async createPose(createPoseDto: any) {
    const pose = await prisma.yogaPose.create({
      data: createPoseDto,
    });

    return pose;
  }

  async getPose(poseId: string) {
    const pose = await prisma.yogaPose.findUnique({
      where: { id: poseId },
    });

    if (!pose) {
      throw new NotFoundException('Pose not found');
    }

    return pose;
  }

  async listPoses(filters: any) {
    const {
      category,
      difficulty,
      search,
      page = 1,
      limit = 50,
    } = filters;

    const skip = (page - 1) * limit;
    const where: any = {};

    if (category) where.category = category;
    if (difficulty) where.difficulty = difficulty;
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { sanskritName: { contains: search, mode: 'insensitive' } },
        { benefits: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [poses, total] = await Promise.all([
      prisma.yogaPose.findMany({
        where,
        orderBy: { name: 'asc' },
        skip,
        take: limit,
      }),
      prisma.yogaPose.count({ where }),
    ]);

    return {
      poses,
      pagination: {
        total,
        page: parseInt(page.toString()),
        limit: parseInt(limit.toString()),
        pages: Math.ceil(total / limit),
      },
    };
  }

  // Waitlist Management
  async addToWaitlist(classId: string, userId: string) {
    const yogaClass = await prisma.yogaClass.findUnique({
      where: { id: classId },
      include: {
        waitlist: {
          where: { userId },
        },
      },
    });

    if (!yogaClass) {
      throw new NotFoundException('Class not found');
    }

    if (yogaClass.status !== 'SCHEDULED') {
      throw new BadRequestException('Cannot join waitlist for this class');
    }

    if (yogaClass.waitlist.length > 0) {
      throw new BadRequestException('You are already on the waitlist');
    }

    // Get current waitlist position
    const waitlistCount = await prisma.waitlistEntry.count({
      where: { classId, status: 'WAITING' },
    });

    const waitlistEntry = await prisma.waitlistEntry.create({
      data: {
        classId,
        userId,
        position: waitlistCount + 1,
        status: 'WAITING',
      },
    });

    // Notify user
    await this.notifyUser(userId, 'waitlist_added', {
      classId,
      className: yogaClass.title,
      position: waitlistEntry.position,
    });

    return waitlistEntry;
  }

  async promoteFromWaitlist(classId: string, count: number = 1) {
    const yogaClass = await prisma.yogaClass.findUnique({
      where: { id: classId },
    });

    if (!yogaClass) {
      throw new NotFoundException('Class not found');
    }

    const availableSpots = yogaClass.capacity - yogaClass.booked;
    const spotsToPromote = Math.min(count, availableSpots);

    if (spotsToPromote <= 0) {
      return [];
    }

    const waitlistEntries = await prisma.waitlistEntry.findMany({
      where: {
        classId,
        status: 'WAITING',
      },
      orderBy: { position: 'asc' },
      take: spotsToPromote,
      include: {
        user: true,
      },
    });

    for (const entry of waitlistEntries) {
      // Create booking for promoted user
      await prisma.booking.create({
        data: {
          userId: entry.userId,
          classId,
          startTime: yogaClass.startTime,
          endTime: yogaClass.endTime,
          participants: 1,
          status: 'CONFIRMED',
          paymentStatus: 'COMPLETED',
          totalAmount: yogaClass.price || 0,
          currency: 'USD',
        },
      });

      // Update waitlist entry
      await prisma.waitlistEntry.update({
        where: { id: entry.id },
        data: {
          status: 'PROMOTED',
          notified: true,
          notifiedAt: new Date(),
        },
      });

      // Update class booked count
      await prisma.yogaClass.update({
        where: { id: classId },
        data: {
          booked: { increment: 1 },
        },
      });

      // Notify user
      await this.notifyUser(entry.userId, 'waitlist_promoted', {
        classId,
        className: yogaClass.title,
      });
    }

    return waitlistEntries;
  }

  // Analytics
  async getClassAnalytics(classId: string, instructorId: string) {
    const yogaClass = await prisma.yogaClass.findFirst({
      where: {
        id: classId,
        instructorId,
      },
      include: {
        bookings: {
          include: {
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
              },
            },
          },
        },
        waitlist: true,
      },
    });

    if (!yogaClass) {
      throw new NotFoundException('Class not found or unauthorized');
    }

    const totalRevenue = yogaClass.bookings
      .filter(b => b.status === 'COMPLETED')
      .reduce((sum, booking) => sum + booking.totalAmount, 0);

    const attendanceRate = yogaClass.bookings.length > 0
      ? (yogaClass.bookings.filter(b => b.checkinStatus === 'CHECKED_IN').length / yogaClass.bookings.length) * 100
      : 0;

    return {
      classId,
      title: yogaClass.title,
      capacity: yogaClass.capacity,
      booked: yogaClass.booked,
      waitlist: yogaClass.waitlist.length,
      revenue: {
        total: totalRevenue,
        averagePerBooking: yogaClass.bookings.length > 0 ? totalRevenue / yogaClass.bookings.length : 0,
      },
      attendance: {
        rate: attendanceRate,
        checkedIn: yogaClass.bookings.filter(b => b.checkinStatus === 'CHECKED_IN').length,
        totalBookings: yogaClass.bookings.length,
      },
      demographics: this.calculateDemographics(yogaClass.bookings),
    };
  }

  async getInstructorAnalytics(instructorId: string, timeframe: string = 'month') {
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
      case 'year':
        startDate = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
        break;
      default:
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    }

    const [classes, bookings, reviews] = await Promise.all([
      prisma.yogaClass.findMany({
        where: {
          instructorId,
          startTime: { gte: startDate },
        },
        include: {
          bookings: true,
        },
      }),
      prisma.booking.findMany({
        where: {
          class: { instructorId },
          createdAt: { gte: startDate },
        },
      }),
      prisma.review.findMany({
        where: {
          instructorId,
          createdAt: { gte: startDate },
        },
      }),
    ]);

    const totalRevenue = bookings
      .filter(b => b.status === 'COMPLETED')
      .reduce((sum, booking) => sum + booking.totalAmount, 0);

    const averageRating = reviews.length > 0
      ? reviews.reduce((sum, review) => sum + review.rating, 0) / reviews.length
      : 0;

    return {
      instructorId,
      timeframe,
      summary: {
        totalClasses: classes.length,
        totalBookings: bookings.length,
        totalRevenue,
        averageRating,
        totalReviews: reviews.length,
      },
      classTypes: this.groupBy(classes, 'type'),
      bookingTrends: this.calculateBookingTrends(bookings, timeframe),
      revenueTrends: this.calculateRevenueTrends(bookings, timeframe),
      reviews: {
        total: reviews.length,
        average: averageRating,
        distribution: this.calculateRatingDistribution(reviews),
      },
    };
  }

  // Helper Methods
  private async validateClassSchedule(classData: CreateYogaClassDto) {
    const { startTime, endTime, instructorId, room, location } = classData;

    // Check for overlapping classes for the same instructor
    const overlappingClasses = await prisma.yogaClass.findMany({
      where: {
        instructorId,
        status: { in: ['SCHEDULED', 'LIVE'] },
        OR: [
          {
            startTime: { lt: new Date(endTime) },
            endTime: { gt: new Date(startTime) },
          },
        ],
      },
    });

    if (overlappingClasses.length > 0) {
      throw new BadRequestException('Instructor has overlapping classes');
    }

    // Check for room availability if specified
    if (room && location) {
      const roomConflict = await prisma.yogaClass.findFirst({
        where: {
          room,
          location,
          status: { in: ['SCHEDULED', 'LIVE'] },
          OR: [
            {
              startTime: { lt: new Date(endTime) },
              endTime: { gt: new Date(startTime) },
            },
          ],
        },
      });

      if (roomConflict) {
        throw new BadRequestException('Room is already booked for this time');
      }
    }

    // Validate class duration (minimum 30 minutes, maximum 3 hours)
    const duration = (new Date(endTime).getTime() - new Date(startTime).getTime()) / (1000 * 60);
    if (duration < 30) {
      throw new BadRequestException('Class duration must be at least 30 minutes');
    }
    if (duration > 180) {
      throw new BadRequestException('Class duration cannot exceed 3 hours');
    }
  }

  private async createRecurringClasses(originalClass: any, recurrenceRule: string) {
    // Parse RRULE and create recurring classes
    // This is a simplified implementation
    const rrule = RRule.fromString(recurrenceRule);
    const dates = rrule.all();

    // Skip the first date (original class)
    const recurringDates = dates.slice(1);

    for (const date of recurringDates) {
      await prisma.yogaClass.create({
        data: {
          ...originalClass,
          id: undefined,
          startTime: date,
          endTime: new Date(date.getTime() + 
            (new Date(originalClass.endTime).getTime() - new Date(originalClass.startTime).getTime())),
          parentClassId: originalClass.id,
        },
      });
    }
  }

  private async notifyClassUpdates(classId: string, changes: any) {
    const bookings = await prisma.booking.findMany({
      where: {
        classId,
        status: 'CONFIRMED',
      },
      include: {
        user: true,
      },
    });

    for (const booking of bookings) {
      await this.notifyUser(booking.userId, 'class_updated', {
        classId,
        changes: Object.keys(changes),
      });
    }
  }

  private async notifyUser(userId: string, type: string, data: any) {
    // Implementation depends on notification service
    console.log(`Notifying user ${userId} about ${type}`, data);
  }

  private async notifyWaitlist(classId: string, type: string, data: any) {
    const waitlistEntries = await prisma.waitlistEntry.findMany({
      where: { classId, status: 'WAITING' },
      include: { user: true },
    });

    for (const entry of waitlistEntries) {
      await this.notifyUser(entry.userId, type, data);
    }
  }

  private calculateDemographics(bookings: any[]) {
    // Simplified demographics calculation
    const ageGroups = { '18-24': 0, '25-34': 0, '35-44': 0, '45+': 0 };
    const genders = { male: 0, female: 0, other: 0 };
    const experienceLevels = { beginner: 0, intermediate: 0, advanced: 0 };

    // This would require additional user data
    // For now, return placeholder data
    return {
      ageGroups,
      genders,
      experienceLevels,
    };
  }

  private groupBy(array: any[], key: string) {
    return array.reduce((result, item) => {
      const value = item[key];
      result[value] = (result[value] || 0) + 1;
      return result;
    }, {});
  }

  private calculateBookingTrends(bookings: any[], timeframe: string) {
    // Calculate booking trends over time
    const trends = {};
    // Implementation would group bookings by time period
    return trends;
  }

  private calculateRevenueTrends(bookings: any[], timeframe: string) {
    // Calculate revenue trends over time
    const trends = {};
    // Implementation would group revenue by time period
    return trends;
  }

  private calculateRatingDistribution(reviews: any[]) {
    const distribution = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    reviews.forEach(review => {
      distribution[review.rating]++;
    });
    return distribution;
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