import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { PrismaService } from '../prisma.service';

@Injectable()
export class LiveIntegrationService {
  private readonly logger = new Logger(LiveIntegrationService.name);
  private readonly liveServiceUrl = process.env.LIVE_SERVICE_URL || 'http://live-service:3004';

  constructor(
    private readonly httpService: HttpService,
    private readonly prisma: PrismaService,
  ) {}

  async assignStaffToLiveSession(sessionId: string, staffId: string, role: string = 'INSTRUCTOR'): Promise<any> {
    try {
      // Get staff details
      const staff = await this.prisma.staff.findUnique({
        where: { id: staffId, isActive: true },
        include: { user: true },
      });

      if (!staff) {
        throw new Error(`Staff ${staffId} not found or inactive`);
      }

      // Assign staff to live session
      const response = await firstValueFrom(
        this.httpService.post(
          `${this.liveServiceUrl}/sessions/${sessionId}/instructors`,
          {
            instructorId: staff.userId,
            instructorName: `${staff.user.firstName} ${staff.user.lastName}`,
            role,
            bio: staff.user.bio || `Professional ${staff.department} instructor`,
            avatar: staff.user.avatar,
            qualifications: staff.certifications,
          },
          {
            headers: {
              'x-service-token': process.env.SERVICE_TOKEN,
            },
            timeout: 5000,
          },
        ),
      );

      // Create schedule for live session
      await this.createLiveSessionSchedule(sessionId, staffId, response.data.session);

      this.logger.log(`Assigned staff ${staffId} to live session ${sessionId}`);
      return response.data;
    } catch (error) {
      this.logger.error(`Error assigning staff to live session ${sessionId}:`, error);
      throw error;
    }
  }

  async createLiveSessionSchedule(sessionId: string, staffId: string, sessionData: any): Promise<void> {
    try {
      await this.prisma.schedule.create({
        data: {
          staffId,
          type: 'live_session',
          startTime: new Date(sessionData.startTime),
          endTime: new Date(sessionData.endTime),
          status: 'scheduled',
          location: 'virtual',
          notes: `Live session: ${sessionData.title}`,
          createdBy: 'system-live-service',
          metadata: {
            sessionId,
            sessionTitle: sessionData.title,
            streamUrl: sessionData.streamUrl,
            participantCount: sessionData.currentParticipants || 0,
            maxParticipants: sessionData.maxParticipants,
          },
        },
      });

      this.logger.log(`Created schedule for live session ${sessionId}`);
    } catch (error) {
      this.logger.error(`Error creating schedule for live session ${sessionId}:`, error);
    }
  }

  async getStaffLiveSessions(staffId: string, filters: any = {}): Promise<any> {
    try {
      const staff = await this.prisma.staff.findUnique({
        where: { id: staffId },
        select: { userId: true },
      });

      if (!staff) {
        throw new Error(`Staff ${staffId} not found`);
      }

      const response = await firstValueFrom(
        this.httpService.get(`${this.liveServiceUrl}/sessions`, {
          params: {
            ...filters,
            instructorId: staff.userId,
          },
          headers: {
            'x-service-token': process.env.SERVICE_TOKEN,
          },
          timeout: 10000,
        }),
      );

      return response.data;
    } catch (error) {
      this.logger.error(`Error fetching live sessions for staff ${staffId}:`, error);
      return { sessions: [], total: 0 };
    }
  }

  async updateLiveSessionPerformance(staffId: string, sessionId: string, metrics: any): Promise<void> {
    try {
      const response = await firstValueFrom(
        this.httpService.post(
          `${this.liveServiceUrl}/sessions/${sessionId}/analytics/instructor`,
          {
            instructorId: staffId,
            metrics: {
              engagement: metrics.engagement || 0,
              attendance: metrics.attendance || 0,
              rating: metrics.rating || 0,
              technicalIssues: metrics.technicalIssues || 0,
              sessionDuration: metrics.sessionDuration || 0,
            },
            recordedAt: new Date().toISOString(),
          },
          {
            headers: {
              'x-service-token': process.env.SERVICE_TOKEN,
            },
            timeout: 5000,
          },
        ),
      );

      // Update staff performance metrics
      await this.updateStaffLivePerformance(staffId, response.data.analytics);

      this.logger.log(`Updated live performance for staff ${staffId} in session ${sessionId}`);
    } catch (error) {
      this.logger.error(`Error updating live performance for staff ${staffId}:`, error);
    }
  }

  async updateStaffLivePerformance(staffId: string, analytics: any): Promise<void> {
    const stats = {
      totalLiveSessions: analytics.totalSessions || 0,
      averageAttendance: analytics.averageAttendance || 0,
      averageEngagement: analytics.averageEngagement || 0,
      averageRating: analytics.averageRating || 0,
      totalParticipants: analytics.totalParticipants || 0,
      lastLiveSession: analytics.lastSessionDate,
      performanceTrend: analytics.performanceTrend || 'stable',
    };

    await this.prisma.staff.update({
      where: { id: staffId },
      data: {
        metadata: {
          livePerformance: stats,
        },
        updatedBy: 'system-live-analytics',
      },
    });
  }

  async findLiveInstructors(
    category: string,
    date: string,
    time: string,
    duration: number,
  ): Promise<any[]> {
    try {
      // Find staff qualified for live sessions
      const staff = await this.prisma.staff.findMany({
        where: {
          isActive: true,
          OR: [
            { department: category },
            { skills: { has: category } },
            { certifications: { hasSome: this.getRelevantCertifications(category) } },
          ],
        },
        include: {
          user: true,
          availabilities: true,
        },
      });

      const availableInstructors = [];
      const targetDateTime = new Date(`${date}T${time}`);

      for (const instructor of staff) {
        const isAvailable = await this.checkInstructorAvailability(
          instructor.id,
          targetDateTime,
          duration,
        );

        if (isAvailable) {
          const liveStats = instructor.metadata?.livePerformance || {};
          
          availableInstructors.push({
            id: instructor.id,
            userId: instructor.userId,
            name: `${instructor.user.firstName} ${instructor.user.lastName}`,
            department: instructor.department,
            bio: instructor.user.bio,
            avatar: instructor.user.avatar,
            qualifications: instructor.certifications,
            liveExperience: liveStats.totalLiveSessions || 0,
            averageRating: liveStats.averageRating || 4.0,
            equipment: this.getRequiredEquipment(category),
            hourlyRate: instructor.hourlyRate || 50,
            isCertified: this.isInstructorCertified(instructor, category),
          });
        }
      }

      // Sort by live experience and rating
      availableInstructors.sort((a, b) => {
        if (b.liveExperience !== a.liveExperience) return b.liveExperience - a.liveExperience;
        return b.averageRating - a.averageRating;
      });

      return availableInstructors;
    } catch (error) {
      this.logger.error('Error finding live instructors:', error);
      return [];
    }
  }

  async checkInstructorAvailability(
    staffId: string,
    startTime: Date,
    duration: number,
  ): Promise<boolean> {
    const endTime = new Date(startTime.getTime() + duration * 60000);

    // Check schedules
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

    // Check if instructor has necessary equipment and setup
    const staff = await this.prisma.staff.findUnique({
      where: { id: staffId },
      select: { metadata: true },
    });

    const hasEquipment = staff?.metadata?.equipment?.liveStreaming || false;
    if (!hasEquipment) {
      this.logger.warn(`Staff ${staffId} lacks live streaming equipment`);
      return false; // Or could return true but with warning
    }

    return true;
  }

  async handleLiveSessionCreated(event: any): Promise<void> {
    // Handle live_session.created event
    const { sessionId, instructorId, startTime, endTime, title } = event.data;

    if (instructorId) {
      // Find staff by user ID
      const staff = await this.prisma.staff.findFirst({
        where: { userId: instructorId },
      });

      if (staff) {
        await this.createLiveSessionSchedule(sessionId, staff.id, {
          startTime,
          endTime,
          title,
        });

        this.logger.log(`Created schedule for new live session ${sessionId}`);
      }
    }
  }

  async handleLiveSessionEnded(event: any): Promise<void> {
    // Handle live_session.ended event
    const { sessionId, instructorId, analytics } = event.data;

    if (instructorId) {
      const staff = await this.prisma.staff.findFirst({
        where: { userId: instructorId },
      });

      if (staff) {
        // Update schedule status
        await this.prisma.schedule.updateMany({
          where: {
            staffId: staff.id,
            metadata: {
              path: ['sessionId'],
              equals: sessionId,
            },
          },
          data: {
            status: 'completed',
            updatedBy: 'system-live-ended',
          },
        });

        // Update performance metrics
        await this.updateLiveSessionPerformance(staff.id, sessionId, analytics);

        this.logger.log(`Updated schedule and performance for ended session ${sessionId}`);
      }
    }
  }

  async handleLiveSessionCancelled(event: any): Promise<void> {
    // Handle live_session.cancelled event
    const { sessionId, instructorId } = event.data;

    if (instructorId) {
      const staff = await this.prisma.staff.findFirst({
        where: { userId: instructorId },
      });

      if (staff) {
        await this.prisma.schedule.updateMany({
          where: {
            staffId: staff.id,
            metadata: {
              path: ['sessionId'],
              equals: sessionId,
            },
          },
          data: {
            status: 'cancelled',
            updatedBy: 'system-live-cancelled',
          },
        });

        this.logger.log(`Cancelled schedule for live session ${sessionId}`);
      }
    }
  }

  private getRelevantCertifications(category: string): string[] {
    const certifications = {
      yoga: ['RYT-200', 'RYT-500', 'E-RYT'],
      meditation: ['Meditation Teacher', 'Mindfulness Coach'],
      fitness: ['Personal Trainer', 'Fitness Instructor'],
      wellness: ['Wellness Coach', 'Holistic Health'],
    };

    return certifications[category] || [];
  }

  private getRequiredEquipment(category: string): string[] {
    const equipment = {
      yoga: ['Yoga mat', 'Camera', 'Microphone', 'Good lighting'],
      meditation: ['Quiet space', 'Microphone', 'Calm background'],
      fitness: ['Exercise mat', 'Weights', 'Camera setup', 'Good lighting'],
      wellness: ['Professional background', 'Microphone', 'Good lighting'],
    };

    return equipment[category] || ['Camera', 'Microphone', 'Good internet'];
  }

  private isInstructorCertified(staff: any, category: string): boolean {
    const requiredCerts = this.getRelevantCertifications(category);
    if (requiredCerts.length === 0) return true;

    return staff.certifications?.some((cert: string) =>
      requiredCerts.some(required => cert.includes(required))
    ) || false;
  }

  async syncLiveSessionRecords(): Promise<void> {
    // Sync all live session records for staff
    const staff = await this.prisma.staff.findMany({
      where: { isActive: true },
      select: { id: true, userId: true },
    });

    for (const staffMember of staff) {
      try {
        const sessions = await this.getStaffLiveSessions(staffMember.id, {
          status: 'completed',
          limit: 100,
        });

        if (sessions.sessions.length > 0) {
          await this.updateStaffLivePerformance(staffMember.id, {
            totalSessions: sessions.total,
            lastSessionDate: sessions.sessions[0]?.endTime,
          });
        }
      } catch (error) {
        this.logger.error(`Error syncing live sessions for staff ${staffMember.id}:`, error);
      }
    }

    this.logger.log(`Synced live session records for ${staff.length} staff members`);
  }
}