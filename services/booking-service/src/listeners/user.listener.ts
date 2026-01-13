import { Injectable, OnModuleInit } from '@nestjs/common';
import { EventBusService } from '@yogaspa/event-bus';

@Injectable()
export class UserEventListener implements OnModuleInit {
  constructor(
    private readonly eventBus: EventBusService,
    private readonly bookingService: BookingService,
    private readonly prisma: PrismaClient
  ) {}

  async onModuleInit() {
    // Subscribe to user events
    await this.eventBus.subscribe('user_events', 'user.deleted', this.handleUserDeleted.bind(this));
    await this.eventBus.subscribe('user_events', 'profile.updated', this.handleProfileUpdated.bind(this));
    await this.eventBus.subscribe('user_events', 'cascade.delete', this.handleCascadeDelete.bind(this));
  }

  async handleUserDeleted(message: any) {
    const { userId } = message.data;
    
    // Cancel all upcoming bookings for this user
    await this.bookingService.cancelUserBookings(userId, 'Account deleted');
    
    this.logger.log(`Cancelled bookings for deleted user ${userId}`);
  }

  async handleProfileUpdated(message: any) {
    const { userId, updates } = message.data;
    
    // Update user info in booking records if needed
    if (updates.firstName || updates.lastName || updates.email) {
      await this.prisma.booking.updateMany({
        where: { userId },
        data: {
          userName: `${updates.firstName || ''} ${updates.lastName || ''}`.trim(),
          userEmail: updates.email
        }
      });
    }
  }

  async handleCascadeDelete(message: any) {
    const { userId, services } = message.data;
    
    if (services.includes('bookings')) {
      // Delete all user bookings
      await this.prisma.booking.deleteMany({
        where: { userId }
      });
      
      this.logger.log(`Deleted all bookings for user ${userId}`);
    }
  }
}