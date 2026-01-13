import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import {
  CreateScheduleDto,
  UpdateScheduleDto,
  ShiftSwapRequestDto,
  TimeOffRequestDto,
  ScheduleOptimizationDto,
} from '../dto/schedule.dto';
import * as moment from 'moment';
import RRule, { RRuleSet } from 'rrule';

@Injectable()
export class ScheduleService {
  constructor(private readonly prisma: PrismaService) {}

  // Cal.com-like scheduling features
  async createSchedule(createScheduleDto: CreateScheduleDto, createdBy: string) {
    const { staffId, type, startTime, endTime, recurrenceRule } = createScheduleDto;

    // Validate staff exists and is active
    const staff = await this.prisma.staff.findUnique({
      where: { id: staffId, isActive: true },
    });

    if (!staff) {
      throw new NotFoundException('Staff not found or inactive');
    }

    // Check for scheduling conflicts
    await this.checkSchedulingConflict(staffId, startTime, endTime, null);

    // Create schedule
    const schedule = await this.prisma.schedule.create({
      data: {
        staffId,
        type,
        startTime: new Date(startTime),
        endTime: new Date(endTime),
        recurrenceRule,
        timezone: createScheduleDto.timezone || 'Europe/Vienna',
        location: createScheduleDto.location,
        notes: createScheduleDto.notes,
        status: 'scheduled',
        createdBy,
      },
      include: {
        staff: {
          include: {
            user: true,
          },
        },
      },
    });

    // Generate recurring instances if recurrence rule exists
    if (recurrenceRule) {
      await this.generateRecurringSchedules(schedule);
    }

    // Sync with external calendars (Google, Outlook)
    await this.syncWithExternalCalendars(schedule);

    return schedule;
  }

  async checkSchedulingConflict(
    staffId: string,
    startTime: Date,
    endTime: Date,
    excludeScheduleId?: string,
  ): Promise<boolean> {
    const where: any = {
      staffId,
      status: { in: ['scheduled', 'in_progress'] },
      OR: [
        {
          startTime: { lt: endTime },
          endTime: { gt: startTime },
        },
      ],
    };

    if (excludeScheduleId) {
      where.NOT = { id: excludeScheduleId };
    }

    const conflicts = await this.prisma.schedule.findMany({
      where,
    });

    if (conflicts.length > 0) {
      throw new ConflictException(
        `Scheduling conflict with existing schedules: ${conflicts.map(c => c.id).join(', ')}`,
      );
    }

    return false;
  }

  async generateRecurringSchedules(parentSchedule: any) {
    try {
      const rule = RRule.fromString(parentSchedule.recurrenceRule);
      const dates = rule.all();

      // Skip the first date (it's the parent schedule)
      const recurringDates = dates.slice(1).slice(0, 100); // Limit to 100 instances

      for (const date of recurringDates) {
        const duration = parentSchedule.endTime.getTime() - parentSchedule.startTime.getTime();
        const endTime = new Date(date.getTime() + duration);

        await this.prisma.schedule.create({
          data: {
            staffId: parentSchedule.staffId,
            type: parentSchedule.type,
            startTime: date,
            endTime,
            recurrenceRule: parentSchedule.recurrenceRule,
            parentScheduleId: parentSchedule.id,
            timezone: parentSchedule.timezone,
            location: parentSchedule.location,
            notes: parentSchedule.notes,
            status: 'scheduled',
            createdBy: parentSchedule.createdBy,
          },
        });
      }
    } catch (error) {
      console.error('Error generating recurring schedules:', error);
    }
  }

  async syncWithExternalCalendars(schedule: any) {
    // Integrate with Google Calendar API
    if (schedule.metadata?.googleCalendar?.enabled) {
      await this.syncWithGoogleCalendar(schedule);
    }

    // Integrate with Outlook Calendar API
    if (schedule.metadata?.outlookCalendar?.enabled) {
      await this.syncWithOutlookCalendar(schedule);
    }

    // Integrate with Apple Calendar
    if (schedule.metadata?.appleCalendar?.enabled) {
      await this.syncWithAppleCalendar(schedule);
    }
  }

  async syncWithGoogleCalendar(schedule: any) {
    // Implementation for Google Calendar API
    console.log(`Syncing schedule ${schedule.id} with Google Calendar`);
    // Actual implementation would use googleapis library
  }

  async syncWithOutlookCalendar(schedule: any) {
    // Implementation for Outlook Calendar API
    console.log(`Syncing schedule ${schedule.id} with Outlook Calendar`);
    // Actual implementation would use microsoft-graph-client
  }

  async syncWithAppleCalendar(schedule: any) {
    // Implementation for Apple Calendar
    console.log(`Syncing schedule ${schedule.id} with Apple Calendar`);
  }

  async requestShiftSwap(shiftSwapRequestDto: ShiftSwapRequestDto, requestedBy: string) {
    const { fromScheduleId, toStaffId, reason } = shiftSwapRequestDto;

    // Validate schedules exist
    const fromSchedule = await this.prisma.schedule.findUnique({
      where: { id: fromScheduleId },
      include: { staff: true },
    });

    if (!fromSchedule) {
      throw new NotFoundException('Schedule not found');
    }

    const toStaff = await this.prisma.staff.findUnique({
      where: { id: toStaffId, isActive: true },
    });

    if (!toStaff) {
      throw new NotFoundException('Target staff not found or inactive');
    }

    // Check if target staff is available
    await this.checkSchedulingConflict(
      toStaffId,
      fromSchedule.startTime,
      fromSchedule.endTime,
    );

    // Create shift swap request
    const swapRequest = await this.prisma.shiftSwapRequest.create({
      data: {
        fromScheduleId,
        fromStaffId: fromSchedule.staffId,
        toStaffId,
        requestedById: requestedBy,
        reason,
        status: 'pending',
      },
      include: {
        fromSchedule: true,
        fromStaff: { include: { user: true } },
        toStaff: { include: { user: true } },
        requestedBy: { select: { firstName: true, lastName: true } },
      },
    });

    // Notify target staff
    await this.notifyStaff(toStaffId, 'shift_swap_requested', {
      swapRequestId: swapRequest.id,
      fromStaff: fromSchedule.staff.user,
      schedule: fromSchedule,
      reason,
    });

    return swapRequest;
  }

  async processShiftSwap(swapRequestId: string, action: 'approve' | 'reject', processedBy: string) {
    const swapRequest = await this.prisma.shiftSwapRequest.findUnique({
      where: { id: swapRequestId },
      include: { fromSchedule: true },
    });

    if (!swapRequest) {
      throw new NotFoundException('Shift swap request not found');
    }

    if (swapRequest.status !== 'pending') {
      throw new BadRequestException('Shift swap request already processed');
    }

    if (action === 'approve') {
      // Update schedule to new staff
      await this.prisma.schedule.update({
        where: { id: swapRequest.fromScheduleId },
        data: {
          staffId: swapRequest.toStaffId,
          updatedBy: processedBy,
        },
      });

      // Update swap request status
      await this.prisma.shiftSwapRequest.update({
        where: { id: swapRequestId },
        data: {
          status: 'approved',
          processedAt: new Date(),
          processedById: processedBy,
        },
      });

      // Notify both staff members
      await this.notifyStaff(swapRequest.fromStaffId, 'shift_swap_approved', {
        swapRequestId,
        toStaffId: swapRequest.toStaffId,
      });

      await this.notifyStaff(swapRequest.toStaffId, 'shift_assigned', {
        scheduleId: swapRequest.fromScheduleId,
        fromStaffId: swapRequest.fromStaffId,
      });
    } else {
      // Reject swap request
      await this.prisma.shiftSwapRequest.update({
        where: { id: swapRequestId },
        data: {
          status: 'rejected',
          processedAt: new Date(),
          processedById: processedBy,
        },
      });

      // Notify requester
      await this.notifyStaff(swapRequest.fromStaffId, 'shift_swap_rejected', {
        swapRequestId,
      });
    }

    return { success: true, action };
  }

  async requestTimeOff(timeOffRequestDto: TimeOffRequestDto, requestedBy: string) {
    const { staffId, startDate, endDate, type, reason } = timeOffRequestDto;

    // Validate staff
    const staff = await this.prisma.staff.findUnique({
      where: { id: staffId, isActive: true },
    });

    if (!staff) {
      throw new NotFoundException('Staff not found or inactive');
    }

    // Check for existing time off during this period
    const existingTimeOff = await this.prisma.timeOffRequest.findFirst({
      where: {
        staffId,
        status: { in: ['pending', 'approved'] },
        OR: [
          {
            startDate: { lte: new Date(endDate) },
            endDate: { gte: new Date(startDate) },
          },
        ],
      },
    });

    if (existingTimeOff) {
      throw new ConflictException('Time off request already exists for this period');
    }

    // Calculate working days affected
    const workingDays = this.calculateWorkingDays(startDate, endDate);

    // Check available vacation days
    const availableVacationDays = await this.getAvailableVacationDays(staffId);
    if (type === 'vacation' && workingDays > availableVacationDays) {
      throw new BadRequestException(
        `Not enough vacation days available. Requested: ${workingDays}, Available: ${availableVacationDays}`,
      );
    }

    // Create time off request
    const timeOffRequest = await this.prisma.timeOffRequest.create({
      data: {
        staffId,
        startDate: new Date(startDate),
        endDate: new Date(endDate),
        type,
        reason,
        workingDays,
        status: 'pending',
        requestedById: requestedBy,
      },
      include: {
        staff: {
          include: {
            user: true,
          },
        },
        requestedBy: {
          select: {
            firstName: true,
            lastName: true,
          },
        },
      },
    });

    // Notify managers/HR for approval
    await this.notifyManagers('time_off_requested', {
      timeOffRequestId: timeOffRequest.id,
      staff: timeOffRequest.staff.user,
      period: `${startDate} to ${endDate}`,
      type,
      reason,
    });

    return timeOffRequest;
  }

  async processTimeOffRequest(
    requestId: string,
    action: 'approve' | 'reject' | 'cancel',
    processedBy: string,
    notes?: string,
  ) {
    const timeOffRequest = await this.prisma.timeOffRequest.findUnique({
      where: { id: requestId },
    });

    if (!timeOffRequest) {
      throw new NotFoundException('Time off request not found');
    }

    if (timeOffRequest.status !== 'pending') {
      throw new BadRequestException('Time off request already processed');
    }

    const updatedRequest = await this.prisma.timeOffRequest.update({
      where: { id: requestId },
      data: {
        status: action === 'approve' ? 'approved' : 'rejected',
        processedAt: new Date(),
        processedById: processedBy,
        notes,
      },
      include: {
        staff: {
          include: {
            user: true,
          },
        },
      },
    });

    // Update vacation days if approved
    if (action === 'approve' && timeOffRequest.type === 'vacation') {
      await this.updateVacationDays(
        timeOffRequest.staffId,
        timeOffRequest.workingDays,
        'used',
      );
    }

    // Notify staff
    await this.notifyStaff(timeOffRequest.staffId, `time_off_${action}`, {
      requestId,
      period: `${timeOffRequest.startDate.toISOString().split('T')[0]} to ${timeOffRequest.endDate.toISOString().split('T')[0]}`,
      type: timeOffRequest.type,
      notes,
    });

    return updatedRequest;
  }

  async optimizeSchedule(optimizationDto: ScheduleOptimizationDto) {
    const { startDate, endDate, department, constraints } = optimizationDto;

    // Get all staff in department
    const staff = await this.prisma.staff.findMany({
      where: {
        department,
        isActive: true,
      },
      include: {
        user: true,
        availabilities: true,
        timeOffRequests: {
          where: {
            status: 'approved',
            OR: [
              {
                startDate: { lte: new Date(endDate) },
                endDate: { gte: new Date(startDate) },
              },
            ],
          },
        },
        schedules: {
          where: {
            startTime: { gte: new Date(startDate) },
            endTime: { lte: new Date(endDate) },
          },
        },
      },
    });

    // Get business requirements (shifts needed)
    const businessRequirements = await this.getBusinessRequirements(
      startDate,
      endDate,
      department,
    );

    // AI-powered schedule optimization
    const optimizedSchedule = await this.aiOptimizeSchedule(
      staff,
      businessRequirements,
      constraints,
    );

    // Apply optimized schedule
    const results = [];
    for (const assignment of optimizedSchedule.assignments) {
      try {
        const schedule = await this.prisma.schedule.create({
          data: {
            staffId: assignment.staffId,
            type: assignment.type,
            startTime: new Date(assignment.startTime),
            endTime: new Date(assignment.endTime),
            location: assignment.location,
            status: 'scheduled',
            createdBy: 'system-optimization',
            metadata: {
              optimized: true,
              optimizationRunId: optimizedSchedule.runId,
              score: assignment.score,
            },
          },
        });
        results.push({ success: true, schedule });
      } catch (error) {
        results.push({ success: false, error: error.message });
      }
    }

    return {
      optimizationId: optimizedSchedule.runId,
      stats: optimizedSchedule.stats,
      assignments: results,
    };
  }

  async aiOptimizeSchedule(
    staff: any[],
    requirements: any[],
    constraints: any,
  ): Promise<any> {
    // AI optimization algorithm
    // This is a simplified version - in production, use ML algorithms

    const runId = `opt-${Date.now()}`;
    const assignments = [];
    let totalScore = 0;

    // Simple round-robin assignment for demo
    let staffIndex = 0;
    for (const requirement of requirements) {
      const availableStaff = staff.filter(s => {
        // Check if staff is available
        const hasTimeOff = s.timeOffRequests.some(to =>
          this.isDateInRange(requirement.startTime, to.startDate, to.endDate),
        );
        
        const hasExistingSchedule = s.schedules.some(sched =>
          this.hasOverlap(requirement.startTime, requirement.endTime, sched.startTime, sched.endTime),
        );

        const isAvailable = s.availabilities.some(avail =>
          this.isAvailableAtTime(avail, requirement.startTime, requirement.endTime),
        );

        return !hasTimeOff && !hasExistingSchedule && isAvailable;
      });

      if (availableStaff.length > 0) {
        // Assign to next available staff
        const assignedStaff = availableStaff[staffIndex % availableStaff.length];
        
        assignments.push({
          staffId: assignedStaff.id,
          staffName: `${assignedStaff.user.firstName} ${assignedStaff.user.lastName}`,
          type: requirement.type,
          startTime: requirement.startTime,
          endTime: requirement.endTime,
          location: requirement.location,
          score: 0.8 + Math.random() * 0.2, // Random score for demo
        });

        staffIndex++;
        totalScore += 0.8 + Math.random() * 0.2;
      }
    }

    return {
      runId,
      assignments,
      stats: {
        totalAssignments: assignments.length,
        totalRequirements: requirements.length,
        coverage: (assignments.length / requirements.length) * 100,
        averageScore: totalScore / assignments.length || 0,
        unassignedRequirements: requirements.length - assignments.length,
      },
    };
  }

  async getBusinessRequirements(startDate: string, endDate: string, department: string) {
    // Get business requirements for scheduling
    // This would typically come from business rules, historical data, or forecasts
    
    const requirements = [];
    const start = new Date(startDate);
    const end = new Date(endDate);
    
    // Generate sample requirements (in production, this would be real data)
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      // Skip weekends
      if (d.getDay() === 0 || d.getDay() === 6) continue;
      
      // Morning shift
      requirements.push({
        date: new Date(d),
        type: 'morning_shift',
        startTime: new Date(d.setHours(9, 0, 0, 0)),
        endTime: new Date(d.setHours(13, 0, 0, 0)),
        location: 'Main Studio',
        requiredStaff: 2,
      });
      
      // Afternoon shift
      requirements.push({
        date: new Date(d),
        type: 'afternoon_shift',
        startTime: new Date(d.setHours(14, 0, 0, 0)),
        endTime: new Date(d.setHours(18, 0, 0, 0)),
        location: 'Main Studio',
        requiredStaff: 2,
      });
    }
    
    return requirements;
  }

  async getAvailableVacationDays(staffId: string): Promise<number> {
    // Calculate available vacation days (Austrian minimum: 25 days/year)
    const currentYear = new Date().getFullYear();
    const hireDate = await this.prisma.staff.findUnique({
      where: { id: staffId },
      select: { hireDate: true },
    });

    if (!hireDate) return 0;

    // Calculate pro-rated vacation days based on hire date
    const monthsWorked = this.monthsBetween(hireDate.hireDate, new Date());
    const annualVacationDays = 25; // Austrian minimum
    const proRatedDays = (monthsWorked / 12) * annualVacationDays;

    // Get used vacation days this year
    const usedDays = await this.prisma.timeOffRequest.aggregate({
      where: {
        staffId,
        type: 'vacation',
        status: 'approved',
        startDate: {
          gte: new Date(currentYear, 0, 1),
          lte: new Date(currentYear, 11, 31),
        },
      },
      _sum: {
        workingDays: true,
      },
    });

    const usedVacationDays = usedDays._sum.workingDays || 0;
    
    return Math.max(0, proRatedDays - usedVacationDays);
  }

  async updateVacationDays(staffId: string, days: number, action: 'used' | 'added') {
    // Update vacation days tracking
    const currentYear = new Date().getFullYear();
    
    await this.prisma.vacationBalance.upsert({
      where: {
        staffId_year: {
          staffId,
          year: currentYear,
        },
      },
      update: {
        usedDays: action === 'used' ? { increment: days } : { decrement: days },
        updatedAt: new Date(),
      },
      create: {
        staffId,
        year: currentYear,
        totalDays: 25, // Austrian minimum
        usedDays: action === 'used' ? days : 0,
        carriedOver: 0,
      },
    });
  }

  async createScheduleTemplate(templateData: any, createdBy: string) {
    // Create schedule template for reuse
    const template = await this.prisma.scheduleTemplate.create({
      data: {
        name: templateData.name,
        description: templateData.description,
        department: templateData.department,
        shifts: templateData.shifts,
        metadata: {
          createdBy,
          tags: templateData.tags || [],
          constraints: templateData.constraints || {},
        },
      },
    });

    return template;
  }

  async applyScheduleTemplate(templateId: string, startDate: string, appliedBy: string) {
    const template = await this.prisma.scheduleTemplate.findUnique({
      where: { id: templateId },
    });

    if (!template) {
      throw new NotFoundException('Schedule template not found');
    }

    const shifts = template.shifts as any[];
    const results = [];

    for (const shift of shifts) {
      // Calculate actual dates based on template and start date
      const shiftDate = this.calculateShiftDate(startDate, shift.dayOfWeek, shift.weekOffset || 0);
      
      const scheduleData = {
        staffId: shift.staffId,
        type: shift.type,
        startTime: new Date(`${shiftDate}T${shift.startTime}`),
        endTime: new Date(`${shiftDate}T${shift.endTime}`),
        location: shift.location,
        notes: `Applied from template: ${template.name}`,
        status: 'scheduled',
        createdBy: appliedBy,
        metadata: {
          fromTemplate: templateId,
        },
      };

      try {
        const schedule = await this.prisma.schedule.create({
          data: scheduleData,
        });
        results.push({ success: true, schedule });
      } catch (error) {
        results.push({ success: false, error: error.message });
      }
    }

    return {
      templateId,
      templateName: template.name,
      appliedDate: startDate,
      results,
    };
  }

  async exportSchedule(
    startDate: string,
    endDate: string,
    format: 'ical' | 'google' | 'outlook' | 'csv' | 'pdf',
    department?: string,
  ) {
    const where: any = {
      startTime: { gte: new Date(startDate) },
      endTime: { lte: new Date(endDate) },
      status: { in: ['scheduled', 'in_progress'] },
    };

    if (department) {
      where.staff = { department };
    }

    const schedules = await this.prisma.schedule.findMany({
      where,
      include: {
        staff: {
          include: {
            user: true,
          },
        },
      },
      orderBy: { startTime: 'asc' },
    });

    switch (format) {
      case 'ical':
        return this.generateICalFile(schedules);
      case 'google':
        return this.generateGoogleCalendarFile(schedules);
      case 'outlook':
        return this.generateOutlookCalendarFile(schedules);
      case 'csv':
        return this.generateCSVFile(schedules);
      case 'pdf':
        return this.generatePDFFile(schedules);
      default:
        return schedules;
    }
  }

  async generateICalFile(schedules: any[]): Promise<string> {
    // Generate iCal file content
    let icalContent = `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//Yoga Spa//Staff Schedule//EN
CALSCALE:GREGORIAN
METHOD:PUBLISH
`;

    for (const schedule of schedules) {
      const dtStart = this.formatICalDate(schedule.startTime);
      const dtEnd = this.formatICalDate(schedule.endTime);
      const summary = `${schedule.type} - ${schedule.staff.user.firstName} ${schedule.staff.user.lastName}`;
      const location = schedule.location || '';
      const description = schedule.notes || '';

      icalContent += `BEGIN:VEVENT
UID:${schedule.id}@yogaspa.com
DTSTAMP:${this.formatICalDate(new Date())}
DTSTART:${dtStart}
DTEND:${dtEnd}
SUMMARY:${summary}
LOCATION:${location}
DESCRIPTION:${description}
STATUS:CONFIRMED
END:VEVENT
`;
    }

    icalContent += 'END:VCALENDAR';
    return icalContent;
  }

  async generateCSVFile(schedules: any[]): Promise<string> {
    // Generate CSV file content
    let csvContent = 'Date,Start Time,End Time,Staff,Department,Type,Location,Notes\n';
    
    for (const schedule of schedules) {
      const date = schedule.startTime.toISOString().split('T')[0];
      const startTime = schedule.startTime.toISOString().split('T')[1].slice(0, 5);
      const endTime = schedule.endTime.toISOString().split('T')[1].slice(0, 5);
      const staffName = `${schedule.staff.user.firstName} ${schedule.staff.user.lastName}`;
      const department = schedule.staff.department;
      const type = schedule.type;
      const location = schedule.location || '';
      const notes = schedule.notes || '';
      
      csvContent += `"${date}","${startTime}","${endTime}","${staffName}","${department}","${type}","${location}","${notes}"\n`;
    }
    
    return csvContent;
  }

  async generatePDFFile(schedules: any[]): Promise<any> {
    // Generate PDF file (simplified - in production use a PDF library)
    const pdfData = {
      title: 'Staff Schedule',
      generated: new Date().toISOString(),
      schedules: schedules.map(s => ({
        date: s.startTime.toISOString().split('T')[0],
        time: `${s.startTime.toISOString().split('T')[1].slice(0, 5)} - ${s.endTime.toISOString().split('T')[1].slice(0, 5)}`,
        staff: `${s.staff.user.firstName} ${s.staff.user.lastName}`,
        department: s.staff.department,
        type: s.type,
        location: s.location,
      })),
    };
    
    return pdfData;
  }

  async notifyStaff(staffId: string, event: string, data: any): Promise<void> {
    // Send notification to staff
    console.log(`Notification for staff ${staffId}: ${event}`, data);
    
    // In production, integrate with notification service
    // await this.notificationService.sendStaffNotification(staffId, event, data);
  }

  async notifyManagers(event: string, data: any): Promise<void> {
    // Send notification to managers/HR
    console.log(`Notification for managers: ${event}`, data);
    
    // In production, get managers and send notifications
    // const managers = await this.getManagers();
    // for (const manager of managers) {
    //   await this.notificationService.sendNotification(manager.userId, event, data);
    // }
  }

  // Helper methods
  private calculateWorkingDays(startDate: string, endDate: string): number {
    let workingDays = 0;
    const start = new Date(startDate);
    const end = new Date(endDate);
    
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      // Monday to Friday are working days
      if (d.getDay() >= 1 && d.getDay() <= 5) {
        workingDays++;
      }
    }
    
    return workingDays;
  }

  private monthsBetween(date1: Date, date2: Date): number {
    return (date2.getFullYear() - date1.getFullYear()) * 12 + 
           (date2.getMonth() - date1.getMonth());
  }

  private isDateInRange(date: Date, start: Date, end: Date): boolean {
    return date >= start && date <= end;
  }

  private hasOverlap(start1: Date, end1: Date, start2: Date, end2: Date): boolean {
    return start1 < end2 && end1 > start2;
  }

  private isAvailableAtTime(availability: any, startTime: Date, endTime: Date): boolean {
    // Check if staff is available at given time based on their availability schedule
    const dayOfWeek = startTime.getDay();
    const startHour = startTime.getHours();
    const endHour = endTime.getHours();
    
    return availability.dayOfWeek === dayOfWeek &&
           availability.startTime <= startHour &&
           availability.endTime >= endHour;
  }

  private calculateShiftDate(baseDate: string, dayOfWeek: number, weekOffset: number): string {
    const base = new Date(baseDate);
    const targetDay = new Date(base);
    
    // Set to the correct day of week
    const currentDay = base.getDay();
    const diff = dayOfWeek - currentDay;
    targetDay.setDate(base.getDate() + diff + (weekOffset * 7));
    
    return targetDay.toISOString().split('T')[0];
  }

  private formatICalDate(date: Date): string {
    return date.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
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