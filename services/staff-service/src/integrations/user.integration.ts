import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { PrismaService } from '../prisma.service';

@Injectable()
export class UserIntegrationService {
  private readonly logger = new Logger(UserIntegrationService.name);
  private readonly userServiceUrl = process.env.USER_SERVICE_URL || 'http://user-service:3001';

  constructor(
    private readonly httpService: HttpService,
    private readonly prisma: PrismaService,
  ) {}

  async syncUserToStaff(userId: string): Promise<any> {
    try {
      // Get user details from user service
      const user = await this.getUserDetails(userId);
      
      if (!user) {
        throw new Error(`User ${userId} not found in user service`);
      }

      // Check if staff profile already exists
      const existingStaff = await this.prisma.staff.findUnique({
        where: { userId },
      });

      if (existingStaff) {
        // Update existing staff profile
        const updatedStaff = await this.prisma.staff.update({
          where: { id: existingStaff.id },
          data: {
            firstName: user.firstName,
            lastName: user.lastName,
            email: user.email,
            phone: user.phone,
            avatar: user.avatar,
            updatedBy: 'system-sync',
          },
        });

        this.logger.log(`Updated staff profile for user ${userId}`);
        return updatedStaff;
      } else {
        // Create new staff profile
        const newStaff = await this.prisma.staff.create({
          data: {
            userId,
            department: 'Unassigned',
            position: 'New Staff',
            hireDate: new Date(),
            employmentType: 'full_time',
            isActive: true,
            createdBy: 'system-sync',
            user: {
              connect: { id: userId },
            },
          },
        });

        this.logger.log(`Created staff profile for user ${userId}`);
        return newStaff;
      }
    } catch (error) {
      this.logger.error(`Error syncing user ${userId}:`, error);
      throw error;
    }
  }

  async getUserDetails(userId: string): Promise<any> {
    try {
      const response = await firstValueFrom(
        this.httpService.get(`${this.userServiceUrl}/users/${userId}`, {
          headers: {
            'x-service-token': process.env.SERVICE_TOKEN,
          },
          timeout: 5000,
        }),
      );

      return response.data;
    } catch (error) {
      this.logger.error(`Error fetching user ${userId}:`, error);
      return null;
    }
  }

  async getMultipleUsers(userIds: string[]): Promise<Map<string, any>> {
    try {
      const response = await firstValueFrom(
        this.httpService.post(`${this.userServiceUrl}/users/batch`, {
          userIds,
        }, {
          headers: {
            'x-service-token': process.env.SERVICE_TOKEN,
          },
          timeout: 10000,
        }),
      );

      const usersMap = new Map();
      response.data.users.forEach(user => {
        usersMap.set(user.id, user);
      });

      return usersMap;
    } catch (error) {
      this.logger.error('Error fetching multiple users:', error);
      return new Map();
    }
  }

  async validateUserRole(userId: string, requiredRoles: string[]): Promise<boolean> {
    try {
      const response = await firstValueFrom(
        this.httpService.post(`${this.userServiceUrl}/users/validate-role`, {
          userId,
          requiredRoles,
        }, {
          headers: {
            'x-service-token': process.env.SERVICE_TOKEN,
          },
          timeout: 3000,
        }),
      );

      return response.data.isValid;
    } catch (error) {
      this.logger.error(`Error validating role for user ${userId}:`, error);
      return false;
    }
  }

  async updateUserProfile(userId: string, profileData: any): Promise<void> {
    try {
      await firstValueFrom(
        this.httpService.put(`${this.userServiceUrl}/users/${userId}/profile`, profileData, {
          headers: {
            'x-service-token': process.env.SERVICE_TOKEN,
          },
          timeout: 5000,
        }),
      );

      this.logger.log(`Updated user profile for ${userId}`);
    } catch (error) {
      this.logger.error(`Error updating user profile ${userId}:`, error);
    }
  }

  async syncStaffUserFields(): Promise<void> {
    // Batch sync all staff with user service
    const staff = await this.prisma.staff.findMany({
      where: { isActive: true },
      include: { user: true },
    });

    const userIds = staff.map(s => s.userId);
    const usersMap = await this.getMultipleUsers(userIds);

    for (const staffMember of staff) {
      const user = usersMap.get(staffMember.userId);
      if (user) {
        await this.prisma.staff.update({
          where: { id: staffMember.id },
          data: {
            firstName: user.firstName,
            lastName: user.lastName,
            email: user.email,
            updatedBy: 'system-sync-batch',
          },
        });
      }
    }

    this.logger.log(`Synced ${staff.length} staff members with user service`);
  }

  async handleUserCreated(event: any): Promise<void> {
    // Handle user.created event from user service
    const { userId, email, firstName, lastName, role } = event.data;

    if (role === 'INSTRUCTOR' || role === 'STAFF') {
      // Automatically create staff profile for instructors/staff
      await this.syncUserToStaff(userId);
      this.logger.log(`Auto-created staff profile for new ${role}: ${userId}`);
    }
  }

  async handleUserUpdated(event: any): Promise<void> {
    // Handle user.updated event
    const { userId, updates } = event.data;

    const staff = await this.prisma.staff.findUnique({
      where: { userId },
    });

    if (staff) {
      // Update staff profile with user changes
      const staffUpdates: any = {};
      if (updates.firstName) staffUpdates.firstName = updates.firstName;
      if (updates.lastName) staffUpdates.lastName = updates.lastName;
      if (updates.email) staffUpdates.email = updates.email;
      if (updates.phone) staffUpdates.phone = updates.phone;
      if (updates.avatar) staffUpdates.avatar = updates.avatar;

      if (Object.keys(staffUpdates).length > 0) {
        await this.prisma.staff.update({
          where: { id: staff.id },
          data: {
            ...staffUpdates,
            updatedBy: 'system-user-update',
          },
        });

        this.logger.log(`Updated staff profile from user update: ${userId}`);
      }
    }
  }

  async handleUserDeleted(event: any): Promise<void> {
    // Handle user.deleted event
    const { userId } = event.data;

    const staff = await this.prisma.staff.findUnique({
      where: { userId },
    });

    if (staff) {
      // Soft delete staff profile
      await this.prisma.staff.update({
        where: { id: staff.id },
        data: {
          isActive: false,
          updatedBy: 'system-user-delete',
        },
      });

      this.logger.log(`Deactivated staff profile due to user deletion: ${userId}`);
    }
  }
}