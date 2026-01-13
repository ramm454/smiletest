import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import {
  CreateStaffDto,
  UpdateStaffDto,
  StaffFilterDto,
} from '../dto/staff.dto';

@Injectable()
export class StaffService {
  constructor(private readonly prisma: PrismaService) {}

  async createStaff(createStaffDto: CreateStaffDto, createdById: string) {
    // Check if user already has staff profile
    const existingStaff = await this.prisma.staff.findUnique({
      where: { userId: createStaffDto.userId },
    });

    if (existingStaff) {
      throw new ConflictException('Staff profile already exists for this user');
    }

    // Check if employee ID is unique
    if (createStaffDto.employeeId) {
      const existingEmployeeId = await this.prisma.staff.findUnique({
        where: { employeeId: createStaffDto.employeeId },
      });
      if (existingEmployeeId) {
        throw new ConflictException('Employee ID already exists');
      }
    }

    const staff = await this.prisma.staff.create({
      data: {
        ...createStaffDto,
        createdBy: createdById,
      },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            phone: true,
            avatar: true,
          },
        },
      },
    });

    return staff;
  }

  async getAllStaff(filters: StaffFilterDto) {
    const {
      department,
      position,
      employmentType,
      isActive,
      search,
      page = 1,
      limit = 20,
    } = filters;

    const skip = (page - 1) * limit;
    const where: any = {};

    if (department) where.department = department;
    if (position) where.position = position;
    if (employmentType) where.employmentType = employmentType;
    if (isActive !== undefined) where.isActive = isActive;

    if (search) {
      where.OR = [
        { employeeId: { contains: search, mode: 'insensitive' } },
        { user: {
          OR: [
            { firstName: { contains: search, mode: 'insensitive' } },
            { lastName: { contains: search, mode: 'insensitive' } },
            { email: { contains: search, mode: 'insensitive' } },
          ],
        }},
      ];
    }

    const [staff, total] = await Promise.all([
      this.prisma.staff.findMany({
        where,
        include: {
          user: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
              phone: true,
              avatar: true,
            },
          },
          _count: {
            select: {
              shifts: true,
              payrolls: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.staff.count({ where }),
    ]);

    return {
      staff,
      pagination: {
        total,
        page: parseInt(page.toString()),
        limit: parseInt(limit.toString()),
        pages: Math.ceil(total / limit),
      },
    };
  }

  async getStaffById(id: string) {
    const staff = await this.prisma.staff.findUnique({
      where: { id },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            phone: true,
            avatar: true,
            dateOfBirth: true,
            gender: true,
          },
        },
        availabilities: {
          orderBy: { dayOfWeek: 'asc' },
        },
        shifts: {
          take: 10,
          orderBy: { startTime: 'desc' },
        },
        payrolls: {
          take: 5,
          orderBy: { periodEnd: 'desc' },
        },
        tasks: {
          take: 10,
          orderBy: { createdAt: 'desc' },
        },
        performanceReviews: {
          take: 5,
          orderBy: { createdAt: 'desc' },
          include: {
            reviewer: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                avatar: true,
              },
            },
          },
        },
      },
    });

    if (!staff) {
      throw new NotFoundException('Staff not found');
    }

    // Calculate total hours worked this month
    const now = new Date();
    const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastDayOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);

    const shiftsThisMonth = await this.prisma.shift.findMany({
      where: {
        staffId: id,
        startTime: {
          gte: firstDayOfMonth,
          lte: lastDayOfMonth,
        },
        status: 'COMPLETED',
      },
    });

    const totalHoursThisMonth = shiftsThisMonth.reduce((total, shift) => {
      return total + ((shift.actualDuration || 0) / 60); // Convert minutes to hours
    }, 0);

    // Calculate average rating
    const reviews = await this.prisma.performanceReview.findMany({
      where: { staffId: id },
      select: { rating: true },
    });

    const averageRating = reviews.length > 0
      ? reviews.reduce((sum, review) => sum + review.rating, 0) / reviews.length
      : 0;

    return {
      ...staff,
      stats: {
        totalHoursThisMonth,
        averageRating,
        totalReviews: reviews.length,
        totalShifts: shiftsThisMonth.length,
        upcomingShifts: await this.prisma.shift.count({
          where: {
            staffId: id,
            status: 'SCHEDULED',
            startTime: { gt: new Date() },
          },
        }),
      },
    };
  }

  async getStaffByUserId(userId: string) {
    const staff = await this.prisma.staff.findUnique({
      where: { userId },
      include: {
        user: true,
        availabilities: true,
      },
    });

    if (!staff) {
      throw new NotFoundException('Staff not found');
    }

    return staff;
  }

  async updateStaff(id: string, updateStaffDto: UpdateStaffDto, updatedById: string) {
    const staff = await this.prisma.staff.findUnique({
      where: { id },
    });

    if (!staff) {
      throw new NotFoundException('Staff not found');
    }

    // Check if employee ID is being changed and if it's unique
    if (updateStaffDto.employeeId && updateStaffDto.employeeId !== staff.employeeId) {
      const existingEmployeeId = await this.prisma.staff.findUnique({
        where: { employeeId: updateStaffDto.employeeId },
      });
      if (existingEmployeeId) {
        throw new ConflictException('Employee ID already exists');
      }
    }

    const updatedStaff = await this.prisma.staff.update({
      where: { id },
      data: {
        ...updateStaffDto,
        updatedBy: updatedById,
      },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            phone: true,
            avatar: true,
          },
        },
      },
    });

    return updatedStaff;
  }

  async deleteStaff(id: string, deletedById: string) {
    const staff = await this.prisma.staff.findUnique({
      where: { id },
    });

    if (!staff) {
      throw new NotFoundException('Staff not found');
    }

    // Soft delete by setting isActive to false
    const deletedStaff = await this.prisma.staff.update({
      where: { id },
      data: {
        isActive: false,
        updatedBy: deletedById,
      },
    });

    return { success: true, message: 'Staff deactivated successfully' };
  }

  async updateStaffStatus(id: string, status: boolean, updatedById: string) {
    const staff = await this.prisma.staff.findUnique({
      where: { id },
    });

    if (!staff) {
      throw new NotFoundException('Staff not found');
    }

    const updatedStaff = await this.prisma.staff.update({
      where: { id },
      data: {
        isActive: status,
        updatedBy: updatedById,
      },
    });

    return updatedStaff;
  }

  async getStaffPerformance(id: string) {
    const staff = await this.prisma.staff.findUnique({
      where: { id },
    });

    if (!staff) {
      throw new NotFoundException('Staff not found');
    }

    const [reviews, tasks, shifts] = await Promise.all([
      this.prisma.performanceReview.findMany({
        where: { staffId: id },
        orderBy: { createdAt: 'desc' },
        include: {
          reviewer: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              avatar: true,
            },
          },
        },
      }),
      this.prisma.task.findMany({
        where: { assignedToId: id },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.shift.findMany({
        where: {
          staffId: id,
          status: 'COMPLETED',
          startTime: {
            gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // Last 30 days
          },
        },
      }),
    ]);

    const averageRating = reviews.length > 0
      ? reviews.reduce((sum, review) => sum + review.rating, 0) / reviews.length
      : 0;

    const completedTasks = tasks.filter(task => task.status === 'COMPLETED').length;
    const totalTasks = tasks.length;
    const completionRate = totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0;

    const totalHours = shifts.reduce((sum, shift) => {
      return sum + ((shift.actualDuration || 0) / 60); // Convert minutes to hours
    }, 0);

    const onTimeShifts = shifts.filter(shift => {
      if (!shift.clockInTime || !shift.startTime) return false;
      const clockInTime = new Date(shift.clockInTime);
      const startTime = new Date(shift.startTime);
      const diffMinutes = (clockInTime.getTime() - startTime.getTime()) / (1000 * 60);
      return diffMinutes >= -5 && diffMinutes <= 5; // Within 5 minutes
    }).length;

    const punctualityRate = shifts.length > 0 ? (onTimeShifts / shifts.length) * 100 : 0;

    return {
      staffId: id,
      period: 'last_30_days',
      metrics: {
        averageRating,
        taskCompletionRate: completionRate,
        totalHoursWorked: totalHours,
        punctualityRate,
        totalShifts: shifts.length,
        totalTasks: totalTasks,
        completedTasks,
        averageTaskCompletionTime: this.calculateAverageCompletionTime(tasks),
      },
      recentReviews: reviews.slice(0, 5),
      performanceTrend: this.calculatePerformanceTrend(reviews),
    };
  }

  async addPerformanceReview(id: string, reviewData: any, reviewerId: string) {
    const staff = await this.prisma.staff.findUnique({
      where: { id },
    });

    if (!staff) {
      throw new NotFoundException('Staff not found');
    }

    const review = await this.prisma.performanceReview.create({
      data: {
        staffId: id,
        reviewerId,
        rating: reviewData.rating,
        comment: reviewData.comment,
        strengths: reviewData.strengths || [],
        areasForImprovement: reviewData.areasForImprovement || [],
        goals: reviewData.goals || [],
      },
      include: {
        reviewer: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            avatar: true,
          },
        },
      },
    });

    return review;
  }

  async getStaffByDepartment(department: string) {
    const staff = await this.prisma.staff.findMany({
      where: {
        department,
        isActive: true,
      },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            phone: true,
            avatar: true,
          },
        },
        availabilities: {
          where: {
            isRecurring: true,
            validTo: { gt: new Date() },
          },
        },
      },
    });

    return staff;
  }

  async getStaffStats() {
    const [
      totalStaff,
      activeStaff,
      byDepartment,
      byEmploymentType,
      newThisMonth,
      turnoverRate,
    ] = await Promise.all([
      this.prisma.staff.count(),
      this.prisma.staff.count({ where: { isActive: true } }),
      this.prisma.staff.groupBy({
        by: ['department'],
        _count: true,
        where: { isActive: true },
      }),
      this.prisma.staff.groupBy({
        by: ['employmentType'],
        _count: true,
        where: { isActive: true },
      }),
      this.prisma.staff.count({
        where: {
          createdAt: {
            gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
          },
        },
      }),
      this.calculateTurnoverRate(),
    ]);

    const averageSalary = await this.prisma.staff.aggregate({
      _avg: {
        salary: true,
      },
      where: { isActive: true },
    });

    return {
      totalStaff,
      activeStaff,
      inactiveStaff: totalStaff - activeStaff,
      byDepartment: byDepartment.reduce((acc, item) => {
        acc[item.department] = item._count;
        return acc;
      }, {}),
      byEmploymentType: byEmploymentType.reduce((acc, item) => {
        acc[item.employmentType] = item._count;
        return acc;
      }, {}),
      averageSalary: averageSalary._avg.salary || 0,
      newThisMonth,
      turnoverRate,
    };
  }

  async checkDatabase() {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return 'connected';
    } catch (error) {
      return 'disconnected';
    }
  }

  private calculateAverageCompletionTime(tasks: any[]): number {
    const completedTasks = tasks.filter(task =>
      task.status === 'COMPLETED' && task.createdAt && task.completedAt
    );

    if (completedTasks.length === 0) return 0;

    const totalTime = completedTasks.reduce((sum, task) => {
      const created = new Date(task.createdAt).getTime();
      const completed = new Date(task.completedAt).getTime();
      return sum + (completed - created);
    }, 0);

    return totalTime / completedTasks.length / (1000 * 60 * 60); // Return in hours
  }

  private calculatePerformanceTrend(reviews: any[]): any[] {
    // Group reviews by month and calculate average rating per month
    const monthlyAverages = reviews.reduce((acc, review) => {
      const month = new Date(review.createdAt).toISOString().slice(0, 7); // YYYY-MM
      if (!acc[month]) {
        acc[month] = { total: 0, count: 0 };
      }
      acc[month].total += review.rating;
      acc[month].count++;
      return acc;
    }, {});

    return Object.entries(monthlyAverages)
      .map(([month, data]: any) => ({
        month,
        averageRating: data.total / data.count,
      }))
      .sort((a, b) => a.month.localeCompare(b.month));
  }

  private async calculateTurnoverRate(): Promise<number> {
    const now = new Date();
    const startOfYear = new Date(now.getFullYear(), 0, 1);

    const [departedThisYear, averageStaffCount] = await Promise.all([
      this.prisma.staff.count({
        where: {
          isActive: false,
          updatedAt: { gte: startOfYear },
        },
      }),
      this.prisma.staff.aggregate({
        _avg: {
          // Calculate average active staff per month (simplified)
        },
      }),
    ]);

    // Simplified turnover rate calculation
    const averageActiveStaff = await this.prisma.staff.count({
      where: { isActive: true },
    });

    return averageActiveStaff > 0 ? (departedThisYear / averageActiveStaff) * 100 : 0;
  }
}