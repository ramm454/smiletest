// In booking-service/src/app.module.ts
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ClientsModule, Transport } from '@nestjs/microservices';

import { BookingController } from './booking.controller';
import { BookingService } from './booking.service';
import { RecurringBookingController } from './controllers/recurring-booking.controller';
import { RecurringBookingService } from './services/recurring-booking.service';
import { GroupBookingController } from './controllers/group-booking.controller';
import { GroupBookingService } from './services/group-booking.service';
import { AnalyticsController } from './controllers/analytics.controller';
import { AnalyticsService } from './services/analytics.service';
import { CalendarIntegrationController } from './controllers/calendar-integration.controller';
import { CalendarIntegrationService } from './services/calendar-integration.service';
import { BookingNotificationService } from './notification-integration/booking-notification.service';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    ClientsModule.register([
      {
        name: 'NOTIFICATION_SERVICE',
        transport: Transport.RMQ,
        options: {
          urls: [process.env.RABBITMQ_URL || 'amqp://localhost:5672'],
          queue: 'notifications',
          queueOptions: {
            durable: true,
          },
        },
      },
    ]),
  ],
  controllers: [
    BookingController,
    RecurringBookingController,
    GroupBookingController,
    AnalyticsController,
    CalendarIntegrationController,
  ],
  providers: [
    BookingService,
    RecurringBookingService,
    GroupBookingService,
    AnalyticsService,
    CalendarIntegrationService,
    BookingNotificationService,
  ],
})
export class AppModule {}