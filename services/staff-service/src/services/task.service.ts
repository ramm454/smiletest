import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import {
  CreateTaskDto,
  UpdateTaskDto,
  TaskFilterDto,
  AssignTaskDto,
  TaskProgressDto,
  TaskDependencyDto,
} from '../dto/task.dto';

@Injectable()
export class TaskService {
  constructor(private readonly prisma: PrismaService) {}

  async createTask(createTaskDto: CreateTaskDto, createdBy: string) {
    const {
      title,
      description,
      assignedToId,
      dueDate,
      priority,
      category,
      estimatedHours,
      dependencies,
      recurringRule,
    } = createTaskDto;

    // Validate assigned staff exists and is active
    if (assignedToId) {
      const staff = await this.prisma.staff.findUnique({
        where: { id: assignedToId, isActive: true },
      });

      if (!staff) {
        throw new NotFoundException('Assigned staff not found or inactive');
      }
    }

    // Validate dependencies exist
    if (dependencies && dependencies.length > 0) {
      for (const depId of dependencies) {
        const dependency = await this.prisma.task.findUnique({
          where: { id: depId },
        });
        if (!dependency) {
          throw new NotFoundException(`Dependency task ${depId} not found`);
        }
      }
    }

    // Create task
    const task = await this.prisma.task.create({
      data: {
        title,
        description,
        assignedToId,
        assignedById: createdBy,
        dueDate: new Date(dueDate),
        priority,
        category,
        estimatedHours,
        status: 'pending',
        createdBy,
        metadata: {
          dependencies: dependencies || [],
          recurringRule,
          tags: createTaskDto.tags || [],
          attachments: createTaskDto.attachments || [],
        },
      },
      include: {
        assignedTo: {
          include: {
            user: true,
          },
        },
        assignedBy: {
          select: {
            firstName: true,
            lastName: true,
          },
        },
      },
    });

    // Create dependency relationships
    if (dependencies && dependencies.length > 0) {
      for (const depId of dependencies) {
        await this.prisma.taskDependency.create({
          data: {
            taskId: task.id,
            dependsOnId: depId,
          },
        });
      }
    }

    // Create recurring tasks if specified
    if (recurringRule) {
      await this.createRecurringTasks(task);
    }

    // Send notification to assigned staff
    if (assignedToId) {
      await this.notifyStaff(assignedToId, 'task_assigned', {
        taskId: task.id,
        taskTitle: task.title,
        dueDate: task.dueDate,
        priority: task.priority,
        assignedBy: createdBy,
      });
    }

    return task;
  }

  async createRecurringTasks(parentTask: any) {
    // Parse recurrence rule and create recurring tasks
    // Similar to schedule service implementation
    console.log('Creating recurring tasks for:', parentTask.id);
  }

  async updateTaskProgress(
    taskId: string,
    progressDto: TaskProgressDto,
    updatedBy: string,
  ) {
    const { progress, notes, attachments, status } = progressDto;

    const task = await this.prisma.task.findUnique({
      where: { id: taskId },
      include: {
        dependencies: true,
      },
    });

    if (!task) {
      throw new NotFoundException('Task not found');
    }

    // Check if user is assigned to the task
    if (task.assignedToId !== updatedBy) {
      throw new ForbiddenException('You are not assigned to this task');
    }

    // Check if dependencies are completed
    if (status === 'completed' || status === 'in_progress') {
      const incompleteDependencies = task.dependencies.filter(
        dep => dep.status !== 'completed',
      );
      if (incompleteDependencies.length > 0) {
        throw new BadRequestException(
          `Cannot start/complete task. ${incompleteDependencies.length} dependencies are incomplete.`,
        );
      }
    }

    const updatedTask = await this.prisma.task.update({
      where: { id: taskId },
      data: {
        progress: progress !== undefined ? progress : task.progress,
        status: status || task.status,
        completedAt: status === 'completed' ? new Date() : task.completedAt,
        completionNotes: notes,
        metadata: {
          ...task.metadata,
          attachments: [
            ...(task.metadata?.attachments || []),
            ...(attachments || []),
          ],
          progressHistory: [
            ...(task.metadata?.progressHistory || []),
            {
              date: new Date(),
              progress: progress !== undefined ? progress : task.progress,
              status: status || task.status,
              updatedBy,
              notes,
            },
          ],
        },
        updatedBy,
      },
      include: {
        assignedTo: {
          include: {
            user: true,
          },
        },
      },
    });

    // Notify task creator about progress
    await this.notifyStaff(task.assignedById, 'task_progress_updated', {
      taskId: task.id,
      taskTitle: task.title,
      progress: updatedTask.progress,
      status: updatedTask.status,
      updatedBy,
    });

    return updatedTask;
  }

  async assignTask(taskId: string, assignDto: AssignTaskDto, assignedBy: string) {
    const { assignedToId, reason } = assignDto;

    const task = await this.prisma.task.findUnique({
      where: { id: taskId },
    });

    if (!task) {
      throw new NotFoundException('Task not found');
    }

    // Validate new assignee
    const newAssignee = await this.prisma.staff.findUnique({
      where: { id: assignedToId, isActive: true },
    });

    if (!newAssignee) {
      throw new NotFoundException('New assignee not found or inactive');
    }

    // Check workload balance
    const workload = await this.getStaffWorkload(assignedToId);
    if (workload.currentTasks >= workload.maxTasks) {
      throw new BadRequestException(
        `Assignee has reached maximum workload (${workload.currentTasks}/${workload.maxTasks} tasks)`,
      );
    }

    const updatedTask = await this.prisma.task.update({
      where: { id: taskId },
      data: {
        assignedToId,
        assignedById: assignedBy,
        status: 'pending', // Reset status when reassigned
        metadata: {
          ...task.metadata,
          assignmentHistory: [
            ...(task.metadata?.assignmentHistory || []),
            {
              date: new Date(),
              from: task.assignedToId,
              to: assignedToId,
              by: assignedBy,
              reason,
            },
          ],
        },
        updatedBy: assignedBy,
      },
      include: {
        assignedTo: {
          include: {
            user: true,
          },
        },
      },
    });

    // Notify previous assignee
    if (task.assignedToId) {
      await this.notifyStaff(task.assignedToId, 'task_unassigned', {
        taskId: task.id,
        taskTitle: task.title,
        newAssignee: assignedToId,
        reason,
      });
    }

    // Notify new assignee
    await this.notifyStaff(assignedToId, 'task_assigned', {
      taskId: task.id,
      taskTitle: task.title,
      dueDate: task.dueDate,
      priority: task.priority,
      assignedBy,
      reason,
    });

    return updatedTask;
  }

  async getStaffWorkload(staffId: string) {
    const currentTasks = await this.prisma.task.count({
      where: {
        assignedToId: staffId,
        status: { in: ['pending', 'in_progress'] },
      },
    });

    const completedTasks = await this.prisma.task.count({
      where: {
        assignedToId: staffId,
        status: 'completed',
        completedAt: {
          gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // Last 30 days
        },
      },
    });

    const overdueTasks = await this.prisma.task.count({
      where: {
        assignedToId: staffId,
        status: { in: ['pending', 'in_progress'] },
        dueDate: { lt: new Date() },
      },
    });

    // Get staff's max tasks from profile or use default
    const staff = await this.prisma.staff.findUnique({
      where: { id: staffId },
      select: { maxHoursPerWeek: true },
    });

    const maxTasks = staff?.maxHoursPerWeek
      ? Math.floor(staff.maxHoursPerWeek / 10) // Assume 10 hours per task
      : 5; // Default max tasks

    return {
      currentTasks,
      completedTasks,
      overdueTasks,
      maxTasks,
      workloadPercentage: (currentTasks / maxTasks) * 100,
      performanceScore: this.calculatePerformanceScore(staffId),
    };
  }

  async calculatePerformanceScore(staffId: string): Promise<number> {
    const tasks = await this.prisma.task.findMany({
      where: {
        assignedToId: staffId,
        status: 'completed',
        completedAt: {
          gte: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000), // Last 90 days
        },
      },
      select: {
        dueDate: true,
        completedAt: true,
        estimatedHours: true,
        priority: true,
      },
    });

    if (tasks.length === 0) return 0;

    let totalScore = 0;
    let weightSum = 0;

    for (const task of tasks) {
      // Timeliness score (0-100)
      const timeliness = this.calculateTimelinessScore(task.dueDate, task.completedAt);
      
      // Efficiency score (0-100) - based on estimated vs actual (if we had actual hours)
      const efficiency = 75; // Default for now
      
      // Priority weight
      const priorityWeight = this.getPriorityWeight(task.priority);
      
      const taskScore = (timeliness * 0.6 + efficiency * 0.4);
      totalScore += taskScore * priorityWeight;
      weightSum += priorityWeight;
    }

    return weightSum > 0 ? totalScore / weightSum : 0;
  }

  private calculateTimelinessScore(dueDate: Date, completedAt: Date): number {
    if (!completedAt) return 0;
    
    const due = new Date(dueDate).getTime();
    const completed = new Date(completedAt).getTime();
    const diffDays = (completed - due) / (1000 * 60 * 60 * 24);
    
    if (diffDays <= 0) return 100; // Completed on or before due date
    if (diffDays <= 1) return 80; // 1 day late
    if (diffDays <= 3) return 60; // 3 days late
    if (diffDays <= 7) return 40; // 1 week late
    return 20; // More than 1 week late
  }

  private getPriorityWeight(priority: string): number {
    const weights = {
      critical: 1.5,
      high: 1.2,
      medium: 1.0,
      low: 0.8,
    };
    return weights[priority] || 1.0;
  }

  async getAllTasks(filters: TaskFilterDto) {
    const {
      assignedToId,
      assignedById,
      status,
      priority,
      category,
      search,
      dueDateFrom,
      dueDateTo,
      page = 1,
      limit = 20,
    } = filters;

    const skip = (page - 1) * limit;
    const where: any = {};

    if (assignedToId) where.assignedToId = assignedToId;
    if (assignedById) where.assignedById = assignedById;
    if (status) where.status = status;
    if (priority) where.priority = priority;
    if (category) where.category = category;

    if (dueDateFrom || dueDateTo) {
      where.dueDate = {};
      if (dueDateFrom) where.dueDate.gte = new Date(dueDateFrom);
      if (dueDateTo) where.dueDate.lte = new Date(dueDateTo);
    }

    if (search) {
      where.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
        { assignedTo: {
          user: {
            OR: [
              { firstName: { contains: search, mode: 'insensitive' } },
              { lastName: { contains: search, mode: 'insensitive' } },
            ],
          },
        }},
      ];
    }

    const [tasks, total] = await Promise.all([
      this.prisma.task.findMany({
        where,
        include: {
          assignedTo: {
            include: {
              user: {
                select: {
                  id: true,
                  firstName: true,
                  lastName: true,
                  email: true,
                  avatar: true,
                },
              },
            },
          },
          assignedBy: {
            select: {
              firstName: true,
              lastName: true,
            },
          },
          dependencies: {
            include: {
              dependsOn: true,
            },
          },
          dependentTasks: {
            include: {
              task: true,
            },
          },
        },
        orderBy: [
          { priority: 'desc' },
          { dueDate: 'asc' },
          { createdAt: 'desc' },
        ],
        skip,
        take: limit,
      }),
      this.prisma.task.count({ where }),
    ]);

    // Calculate additional metrics for each task
    const tasksWithMetrics = await Promise.all(
      tasks.map(async (task) => ({
        ...task,
        metrics: await this.getTaskMetrics(task.id),
      })),
    );

    return {
      tasks: tasksWithMetrics,
      pagination: {
        total,
        page: parseInt(page.toString()),
        limit: parseInt(limit.toString()),
        pages: Math.ceil(total / limit),
      },
    };
  }

  async getTaskMetrics(taskId: string) {
    const task = await this.prisma.task.findUnique({
      where: { id: taskId },
      include: {
        dependencies: true,
        dependentTasks: true,
      },
    });

    if (!task) return null;

    // Calculate days until due
    const now = new Date();
    const dueDate = new Date(task.dueDate);
    const daysUntilDue = Math.ceil((dueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

    // Check if dependencies are completed
    const incompleteDependencies = task.dependencies.filter(
      dep => dep.dependsOn.status !== 'completed',
    ).length;

    // Calculate risk level
    let riskLevel = 'low';
    if (daysUntilDue <= 0) riskLevel = 'critical';
    else if (daysUntilDue <= 2) riskLevel = 'high';
    else if (daysUntilDue <= 5) riskLevel = 'medium';

    // Calculate completion trend
    const progressHistory = task.metadata?.progressHistory || [];
    const completionTrend = this.calculateCompletionTrend(progressHistory);

    return {
      daysUntilDue,
      isOverdue: daysUntilDue < 0,
      incompleteDependencies,
      riskLevel,
      completionTrend,
      priorityWeight: this.getPriorityWeight(task.priority),
      estimatedCompletionTime: task.estimatedHours,
      actualTimeSpent: this.calculateActualTimeSpent(task),
    };
  }

  private calculateCompletionTrend(progressHistory: any[]): string {
    if (progressHistory.length < 2) return 'stable';
    
    const recentProgress = progressHistory.slice(-2);
    const progressDiff = recentProgress[1].progress - recentProgress[0].progress;
    const timeDiff = (new Date(recentProgress[1].date).getTime() - 
                     new Date(recentProgress[0].date).getTime()) / (1000 * 60 * 60); // Hours
    
    if (timeDiff === 0) return 'stable';
    
    const progressPerHour = progressDiff / timeDiff;
    
    if (progressPerHour > 5) return 'accelerating';
    if (progressPerHour > 2) return 'improving';
    if (progressPerHour > 0) return 'steady';
    if (progressPerHour === 0) return 'stalled';
    return 'declining';
  }

  private calculateActualTimeSpent(task: any): number {
    // Calculate actual time spent based on progress updates
    // This is simplified - in production, track time entries
    const progressHistory = task.metadata?.progressHistory || [];
    if (progressHistory.length === 0) return 0;
    
    // Estimate based on progress and estimated hours
    return task.estimatedHours * (task.progress / 100) || 0;
  }

  async getTaskAnalytics(timeframe: string = 'month') {
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

    const [
      totalTasks,
      completedTasks,
      overdueTasks,
      tasksByStatus,
      tasksByPriority,
      tasksByCategory,
      completionRateByStaff,
      averageCompletionTime,
    ] = await Promise.all([
      this.prisma.task.count({
        where: { createdAt: { gte: startDate } },
      }),
      this.prisma.task.count({
        where: {
          createdAt: { gte: startDate },
          status: 'completed',
        },
      }),
      this.prisma.task.count({
        where: {
          createdAt: { gte: startDate },
          status: { in: ['pending', 'in_progress'] },
          dueDate: { lt: new Date() },
        },
      }),
      this.prisma.task.groupBy({
        by: ['status'],
        _count: true,
        where: { createdAt: { gte: startDate } },
      }),
      this.prisma.task.groupBy({
        by: ['priority'],
        _count: true,
        where: { createdAt: { gte: startDate } },
      }),
      this.prisma.task.groupBy({
        by: ['category'],
        _count: true,
        where: { createdAt: { gte: startDate } },
      }),
      this.getCompletionRateByStaff(startDate),
      this.getAverageCompletionTime(startDate),
    ]);

    // Calculate efficiency metrics
    const efficiencyMetrics = await this.calculateEfficiencyMetrics(startDate);

    return {
      timeframe,
      summary: {
        totalTasks,
        completedTasks,
        overdueTasks,
        completionRate: totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0,
        overdueRate: totalTasks > 0 ? (overdueTasks / totalTasks) * 100 : 0,
      },
      distribution: {
        byStatus: tasksByStatus.reduce((acc, item) => {
          acc[item.status] = item._count;
          return acc;
        }, {}),
        byPriority: tasksByPriority.reduce((acc, item) => {
          acc[item.priority] = item._count;
          return acc;
        }, {}),
        byCategory: tasksByCategory.reduce((acc, item) => {
          acc[item.category] = item._count;
          return acc;
        }, {}),
      },
      performance: {
        completionRateByStaff,
        averageCompletionTime,
        efficiencyMetrics,
      },
      trends: await this.getTaskTrends(startDate, timeframe),
    };
  }

  async getCompletionRateByStaff(startDate: Date) {
    const staffTasks = await this.prisma.staff.findMany({
      where: { isActive: true },
      include: {
        tasks: {
          where: { createdAt: { gte: startDate } },
          select: { status: true },
        },
        user: {
          select: {
            firstName: true,
            lastName: true,
          },
        },
      },
    });

    return staffTasks.map(staff => {
      const totalTasks = staff.tasks.length;
      const completedTasks = staff.tasks.filter(t => t.status === 'completed').length;
      return {
        staffId: staff.id,
        staffName: `${staff.user.firstName} ${staff.user.lastName}`,
        department: staff.department,
        totalTasks,
        completedTasks,
        completionRate: totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0,
      };
    }).sort((a, b) => b.completionRate - a.completionRate);
  }

  async getAverageCompletionTime(startDate: Date) {
    const completedTasks = await this.prisma.task.findMany({
      where: {
        createdAt: { gte: startDate },
        status: 'completed',
        completedAt: { not: null },
      },
      select: {
        createdAt: true,
        completedAt: true,
        estimatedHours: true,
      },
    });

    if (completedTasks.length === 0) return 0;

    const totalTime = completedTasks.reduce((sum, task) => {
      const created = new Date(task.createdAt).getTime();
      const completed = new Date(task.completedAt).getTime();
      return sum + (completed - created);
    }, 0);

    return totalTime / completedTasks.length / (1000 * 60 * 60); // Return in hours
  }

  async calculateEfficiencyMetrics(startDate: Date) {
    const tasks = await this.prisma.task.findMany({
      where: {
        createdAt: { gte: startDate },
        status: 'completed',
        estimatedHours: { not: null },
      },
      select: {
        estimatedHours: true,
        // In production, we would have actualHours field
      },
    });

    if (tasks.length === 0) {
      return {
        averageEfficiency: 0,
        onTimeCompletion: 0,
        estimationAccuracy: 0,
      };
    }

    // Simplified efficiency calculation
    // In production, compare estimated vs actual hours
    const averageEfficiency = 85; // Placeholder
    const onTimeCompletion = 78; // Placeholder
    const estimationAccuracy = 72; // Placeholder

    return {
      averageEfficiency,
      onTimeCompletion,
      estimationAccuracy,
      totalTasksAnalyzed: tasks.length,
    };
  }

  async getTaskTrends(startDate: Date, timeframe: string) {
    const tasks = await this.prisma.task.findMany({
      where: {
        createdAt: { gte: startDate },
      },
      select: {
        createdAt: true,
        status: true,
        priority: true,
      },
    });

    // Group by time period
    const trends = {};
    tasks.forEach(task => {
      let period;
      if (timeframe === 'week') {
        period = new Date(task.createdAt).toISOString().slice(0, 10); // Daily
      } else if (timeframe === 'month') {
        period = new Date(task.createdAt).toISOString().slice(0, 7); // Monthly
      } else {
        const date = new Date(task.createdAt);
        period = `${date.getFullYear()}-W${Math.ceil((date.getDate() + date.getDay()) / 7)}`; // Weekly
      }

      if (!trends[period]) {
        trends[period] = {
          total: 0,
          completed: 0,
          pending: 0,
          in_progress: 0,
          overdue: 0,
        };
      }

      trends[period].total++;
      trends[period][task.status]++;
      
      // Check if overdue
      if (task.status !== 'completed') {
        const dueDate = new Date(task.createdAt);
        dueDate.setDate(dueDate.getDate() + 7); // Assume 7-day deadline
        if (new Date() > dueDate) {
          trends[period].overdue++;
        }
      }
    });

    // Convert to array and sort
    return Object.entries(trends)
      .map(([period, data]) => ({ period, ...data }))
      .sort((a, b) => a.period.localeCompare(b.period));
  }

  async createTaskTemplate(templateData: any, createdBy: string) {
    const template = await this.prisma.taskTemplate.create({
      data: {
        name: templateData.name,
        description: templateData.description,
        category: templateData.category,
        priority: templateData.priority,
        estimatedHours: templateData.estimatedHours,
        checklist: templateData.checklist || [],
        dependencies: templateData.dependencies || [],
        metadata: {
          createdBy,
          tags: templateData.tags || [],
          department: templateData.department,
        },
      },
    });

    return template;
  }

  async applyTaskTemplate(templateId: string, assignToId: string, appliedBy: string) {
    const template = await this.prisma.taskTemplate.findUnique({
      where: { id: templateId },
    });

    if (!template) {
      throw new NotFoundException('Task template not found');
    }

    const taskData = {
      title: template.name,
      description: template.description,
      category: template.category,
      priority: template.priority,
      estimatedHours: template.estimatedHours,
      assignedToId: assignToId,
      assignedById: appliedBy,
      dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days from now
      status: 'pending',
      createdBy: appliedBy,
      metadata: {
        fromTemplate: templateId,
        checklist: template.checklist,
        dependencies: template.dependencies,
        tags: template.metadata?.tags || [],
      },
    };

    const task = await this.prisma.task.create({
      data: taskData,
      include: {
        assignedTo: {
          include: {
            user: true,
          },
        },
      },
    });

    return task;
  }

  async notifyStaff(staffId: string, event: string, data: any): Promise<void> {
    // Send notification to staff
    console.log(`Task notification for staff ${staffId}: ${event}`, data);
    
    // In production, integrate with notification service
    // await this.notificationService.sendStaffNotification(staffId, event, data);
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