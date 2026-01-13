import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { PrismaService } from '../prisma.service';

export interface NotificationPayload {
  userId: string;
  type: string;
  title: string;
  message: string;
  data?: any;
  priority?: 'low' | 'medium' | 'high';
  channel?: 'email' | 'push' | 'sms' | 'all';
  scheduleAt?: Date;
}

export interface BulkNotificationPayload {
  userIds: string[];
  type: string;
  title: string;
  message: string;
  data?: any;
  priority?: 'low' | 'medium' | 'high';
}

@Injectable()
export class NotificationIntegrationService {
  private readonly logger = new Logger(NotificationIntegrationService.name);
  private readonly notificationServiceUrl = process.env.NOTIFICATION_SERVICE_URL || 'http://notification-service:3006';

  constructor(
    private readonly httpService: HttpService,
    private readonly prisma: PrismaService,
  ) {}

  async sendStaffNotification(payload: NotificationPayload): Promise<any> {
    try {
      const response = await firstValueFrom(
        this.httpService.post(`${this.notificationServiceUrl}/notifications`, payload, {
          headers: {
            'x-service-token': process.env.SERVICE_TOKEN,
          },
          timeout: 5000,
        }),
      );

      this.logger.log(`Sent ${payload.type} notification to user ${payload.userId}`);
      return response.data;
    } catch (error) {
      this.logger.error(`Error sending notification to user ${payload.userId}:`, error);
      // Fallback: Log notification for manual sending
      await this.logFailedNotification(payload);
      return null;
    }
  }

  async sendBulkStaffNotification(payload: BulkNotificationPayload): Promise<any> {
    try {
      const response = await firstValueFrom(
        this.httpService.post(`${this.notificationServiceUrl}/notifications/bulk`, payload, {
          headers: {
            'x-service-token': process.env.SERVICE_TOKEN,
          },
          timeout: 10000,
        }),
      );

      this.logger.log(`Sent bulk ${payload.type} notification to ${payload.userIds.length} users`);
      return response.data;
    } catch (error) {
      this.logger.error('Error sending bulk notification:', error);
      
      // Fallback: Send individually
      const results = [];
      for (const userId of payload.userIds) {
        try {
          const result = await this.sendStaffNotification({
            userId,
            type: payload.type,
            title: payload.title,
            message: payload.message,
            data: payload.data,
            priority: payload.priority,
          });
          results.push({ userId, success: true, data: result });
        } catch (err) {
          results.push({ userId, success: false, error: err.message });
        }
      }
      
      return { results, bulkFailed: true };
    }
  }

  async sendScheduleNotification(staffId: string, schedule: any, notificationType: string): Promise<void> {
    const staff = await this.prisma.staff.findUnique({
      where: { id: staffId },
      include: { user: true },
    });

    if (!staff || !staff.user) return;

    let title = '';
    let message = '';
    let data = { scheduleId: schedule.id, type: schedule.type };

    switch (notificationType) {
      case 'schedule_created':
        title = 'New Schedule Assignment';
        message = `You have been scheduled for ${schedule.type} on ${new Date(schedule.startTime).toLocaleDateString()} at ${new Date(schedule.startTime).toLocaleTimeString()}`;
        data = { ...data, startTime: schedule.startTime, location: schedule.location };
        break;

      case 'schedule_updated':
        title = 'Schedule Updated';
        message = `Your schedule for ${schedule.type} has been updated`;
        data = { ...data, changes: schedule.metadata?.changes || [] };
        break;

      case 'schedule_cancelled':
        title = 'Schedule Cancelled';
        message = `Your schedule for ${schedule.type} on ${new Date(schedule.startTime).toLocaleDateString()} has been cancelled`;
        break;

      case 'shift_swap_requested':
        title = 'Shift Swap Request';
        message = 'You have received a shift swap request';
        data = { ...data, requestId: schedule.metadata?.requestId };
        break;

      case 'shift_swap_approved':
        title = 'Shift Swap Approved';
        message = 'Your shift swap request has been approved';
        break;

      case 'shift_swap_rejected':
        title = 'Shift Swap Rejected';
        message = 'Your shift swap request has been rejected';
        data = { ...data, reason: schedule.metadata?.reason };
        break;
    }

    await this.sendStaffNotification({
      userId: staff.userId,
      type: notificationType,
      title,
      message,
      data,
      priority: 'medium',
      channel: 'all',
    });
  }

  async sendPayrollNotification(staffId: string, payroll: any, notificationType: string): Promise<void> {
    const staff = await this.prisma.staff.findUnique({
      where: { id: staffId },
      include: { user: true },
    });

    if (!staff || !staff.user) return;

    let title = '';
    let message = '';
    let data = { payrollId: payroll.id, period: `${payroll.periodStart} - ${payroll.periodEnd}` };

    switch (notificationType) {
      case 'payroll_generated':
        title = 'Payroll Generated';
        message = `Your payroll for period ${new Date(payroll.periodStart).toLocaleDateString()} has been generated. Net pay: €${payroll.netPay}`;
        data = { ...data, netPay: payroll.netPay, status: payroll.status };
        break;

      case 'payroll_paid':
        title = 'Payment Processed';
        message = `Your salary of €${payroll.netPay} has been processed via ${payroll.paymentMethod}`;
        data = { ...data, netPay: payroll.netPay, paymentMethod: payroll.paymentMethod, paymentDate: payroll.paymentDate };
        break;

      case 'payroll_failed':
        title = 'Payment Failed';
        message = `There was an issue processing your payroll payment. Please contact HR.`;
        data = { ...data, error: payroll.metadata?.error };
        break;

      case 'lohnzettel_available':
        title = 'Payslip Available';
        message = `Your payslip for ${new Date(payroll.periodStart).toLocaleDateString()} is now available`;
        data = { ...data, downloadUrl: payroll.metadata?.lohnzettelUrl };
        break;
    }

    await this.sendStaffNotification({
      userId: staff.userId,
      type: notificationType,
      title,
      message,
      data,
      priority: 'high',
      channel: 'email', // Payroll notifications always go to email
    });
  }

  async sendTimeOffNotification(staffId: string, timeOff: any, notificationType: string): Promise<void> {
    const staff = await this.prisma.staff.findUnique({
      where: { id: staffId },
      include: { user: true },
    });

    if (!staff || !staff.user) return;

    let title = '';
    let message = '';
    let data = { requestId: timeOff.id, type: timeOff.type, period: `${timeOff.startDate} - ${timeOff.endDate}` };

    switch (notificationType) {
      case 'timeoff_requested':
        title = 'Time Off Request Submitted';
        message = `Your ${timeOff.type} request for ${timeOff.workingDays} days has been submitted for approval`;
        data = { ...data, status: 'pending', workingDays: timeOff.workingDays };
        break;

      case 'timeoff_approved':
        title = 'Time Off Approved ✓';
        message = `Your ${timeOff.type} request has been approved`;
        data = { ...data, status: 'approved', approvedBy: timeOff.processedBy };
        break;

      case 'timeoff_rejected':
        title = 'Time Off Request Denied';
        message = `Your ${timeOff.type} request has been rejected`;
        data = { ...data, status: 'rejected', reason: timeOff.notes };
        break;

      case 'timeoff_reminder':
        title = 'Upcoming Time Off';
        message = `Reminder: Your ${timeOff.type} starts in 3 days`;
        data = { ...data, startDate: timeOff.startDate };
        break;
    }

    await this.sendStaffNotification({
      userId: staff.userId,
      type: notificationType,
      title,
      message,
      data,
      priority: 'medium',
      channel: 'all',
    });
  }

  async sendPerformanceReviewNotification(staffId: string, review: any, notificationType: string): Promise<void> {
    const staff = await this.prisma.staff.findUnique({
      where: { id: staffId },
      include: { user: true },
    });

    if (!staff || !staff.user) return;

    let title = '';
    let message = '';
    let data = { reviewId: review.id, rating: review.rating, reviewer: review.reviewerName };

    switch (notificationType) {
      case 'performance_review_assigned':
        title = 'Performance Review Assigned';
        message = `You have been assigned a performance review by ${review.reviewerName}`;
        data = { ...data, dueDate: review.dueDate };
        break;

      case 'performance_review_completed':
        title = 'Performance Review Completed';
        message = `Your performance review has been completed. Rating: ${review.rating}/5`;
        data = { ...data, feedback: review.comment };
        break;

      case 'performance_goal_assigned':
        title = 'New Performance Goals';
        message = 'New performance goals have been assigned to you';
        data = { ...data, goals: review.goals };
        break;

      case 'performance_improvement_plan':
        title = 'Performance Improvement Plan';
        message = 'A performance improvement plan has been created for you';
        data = { ...data, areasForImprovement: review.areasForImprovement };
        break;
    }

    await this.sendStaffNotification({
      userId: staff.userId,
      type: notificationType,
      title,
      message,
      data,
      priority: 'high',
      channel: 'email',
    });
  }

  async sendTaskNotification(staffId: string, task: any, notificationType: string): Promise<void> {
    const staff = await this.prisma.staff.findUnique({
      where: { id: staffId },
      include: { user: true },
    });

    if (!staff || !staff.user) return;

    let title = '';
    let message = '';
    let data = { taskId: task.id, title: task.title, priority: task.priority, dueDate: task.dueDate };

    switch (notificationType) {
      case 'task_assigned':
        title = 'New Task Assigned';
        message = `You have been assigned: "${task.title}"`;
        data = { ...data, assignedBy: task.assignedByName };
        break;

      case 'task_due_soon':
        title = 'Task Due Soon';
        message = `"${task.title}" is due in 24 hours`;
        break;

      case 'task_overdue':
        title = 'Task Overdue ⚠️';
        message = `"${task.title}" is now overdue`;
        break;

      case 'task_completed':
        title = 'Task Completed ✓';
        message = `"${task.title}" has been marked as completed`;
        break;

      case 'task_progress_update':
        title = 'Task Progress Updated';
        message = `Progress updated on "${task.title}": ${task.progress}% complete`;
        data = { ...data, progress: task.progress };
        break;
    }

    await this.sendStaffNotification({
      userId: staff.userId,
      type: notificationType,
      title,
      message,
      data,
      priority: task.priority === 'critical' ? 'high' : 'medium',
      channel: 'all',
    });
  }

  async sendAnnouncementToDepartment(department: string, announcement: any): Promise<any> {
    const staff = await this.prisma.staff.findMany({
      where: {
        department,
        isActive: true,
      },
      select: { userId: true },
    });

    if (staff.length === 0) {
      this.logger.warn(`No active staff found in department ${department}`);
      return { sent: 0 };
    }

    const userIds = staff.map(s => s.userId);
    
    return this.sendBulkStaffNotification({
      userIds,
      type: 'department_announcement',
      title: announcement.title,
      message: announcement.message,
      data: announcement.data,
      priority: announcement.priority || 'medium',
    });
  }

  async sendUrgentAlert(staffIds: string[], alert: any): Promise<any> {
    return this.sendBulkStaffNotification({
      userIds: staffIds,
      type: 'urgent_alert',
      title: alert.title,
      message: alert.message,
      data: alert.data,
      priority: 'high',
    });
  }

  async sendShiftReminders(): Promise<void> {
    // Send reminders for upcoming shifts (24 hours before)
    const twentyFourHoursFromNow = new Date(Date.now() + 24 * 60 * 60 * 1000);
    const oneHourAfter = new Date(twentyFourHoursFromNow.getTime() + 60 * 60 * 1000);

    const upcomingShifts = await this.prisma.schedule.findMany({
      where: {
        startTime: {
          gte: twentyFourHoursFromNow,
          lt: oneHourAfter,
        },
        status: 'scheduled',
      },
      include: {
        staff: {
          include: {
            user: true,
          },
        },
      },
    });

    for (const shift of upcomingShifts) {
      if (shift.staff?.user) {
        await this.sendStaffNotification({
          userId: shift.staff.userId,
          type: 'shift_reminder',
          title: 'Shift Reminder',
          message: `You have a ${shift.type} shift tomorrow at ${new Date(shift.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`,
          data: {
            scheduleId: shift.id,
            type: shift.type,
            startTime: shift.startTime,
            location: shift.location,
          },
          priority: 'medium',
          channel: 'push',
          scheduleAt: new Date(Date.now() + 23 * 60 * 60 * 1000), // Schedule for 23 hours before
        });
      }
    }

    this.logger.log(`Scheduled ${upcomingShifts.length} shift reminders`);
  }

  async sendPayrollReminders(): Promise<void> {
    // Send reminders for payroll submission (5th of each month)
    const today = new Date();
    if (today.getDate() === 5) {
      const hrStaff = await this.prisma.staff.findMany({
        where: {
          department: 'HR',
          isActive: true,
        },
        select: { userId: true },
      });

      if (hrStaff.length > 0) {
        const userIds = hrStaff.map(s => s.userId);
        
        await this.sendBulkStaffNotification({
          userIds,
          type: 'payroll_reminder',
          title: 'Monthly Payroll Reminder',
          message: 'Payroll submission is due by the 10th of this month',
          data: {
            dueDate: `${today.getFullYear()}-${today.getMonth() + 1}-10`,
            action: 'submit_payroll',
          },
          priority: 'high',
        });
      }
    }
  }

  async logFailedNotification(payload: NotificationPayload): Promise<void> {
    // Store failed notifications for manual retry
    await this.prisma.failedNotification.create({
      data: {
        userId: payload.userId,
        type: payload.type,
        title: payload.title,
        message: payload.message,
        data: payload.data,
        priority: payload.priority || 'medium',
        channel: payload.channel || 'all',
        error: 'Notification service unavailable',
        retryCount: 0,
      },
    });

    this.logger.warn(`Logged failed notification for user ${payload.userId}`);
  }

  async retryFailedNotifications(): Promise<void> {
    const failed = await this.prisma.failedNotification.findMany({
      where: {
        retryCount: { lt: 3 },
        createdAt: {
          gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // Last 7 days
        },
      },
      take: 100,
    });

    for (const notification of failed) {
      try {
        await this.sendStaffNotification({
          userId: notification.userId,
          type: notification.type,
          title: notification.title,
          message: notification.message,
          data: notification.data,
          priority: notification.priority as any,
          channel: notification.channel as any,
        });

        // Delete on success
        await this.prisma.failedNotification.delete({
          where: { id: notification.id },
        });

        this.logger.log(`Retried and succeeded notification ${notification.id}`);
      } catch (error) {
        // Increment retry count
        await this.prisma.failedNotification.update({
          where: { id: notification.id },
          data: {
            retryCount: { increment: 1 },
            lastRetryAt: new Date(),
            error: error.message,
          },
        });

        this.logger.error(`Failed to retry notification ${notification.id}:`, error);
      }
    }
  }

  async getNotificationPreferences(userId: string): Promise<any> {
    try {
      const response = await firstValueFrom(
        this.httpService.get(`${this.notificationServiceUrl}/preferences/${userId}`, {
          headers: {
            'x-service-token': process.env.SERVICE_TOKEN,
          },
          timeout: 3000,
        }),
      );

      return response.data;
    } catch (error) {
      this.logger.error(`Error fetching preferences for user ${userId}:`, error);
      return {
        email: true,
        push: true,
        sms: false,
        categories: {
          schedule: true,
          payroll: true,
          tasks: true,
          announcements: true,
          urgent: true,
        },
      };
    }
  }

  async updateNotificationPreferences(userId: string, preferences: any): Promise<void> {
    try {
      await firstValueFrom(
        this.httpService.put(`${this.notificationServiceUrl}/preferences/${userId}`, preferences, {
          headers: {
            'x-service-token': process.env.SERVICE_TOKEN,
          },
          timeout: 5000,
        }),
      );

      this.logger.log(`Updated notification preferences for user ${userId}`);
    } catch (error) {
      this.logger.error(`Error updating preferences for user ${userId}:`, error);
    }
  }
}