import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { StaffController } from './controllers/staff.controller';
import { ScheduleController } from './controllers/schedule.controller';
import { PayrollController } from './controllers/payroll.controller';
import { TaskController } from './controllers/task.controller';
import { StaffService } from './services/staff.service';
import { ScheduleService } from './services/schedule.service';
import { PayrollService } from './services/payroll.service';
import { TaskService } from './services/task.service';
import { PrismaService } from './prisma.service';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
  ],
  controllers: [
    StaffController,
    ScheduleController,
    PayrollController,
    TaskController,
  ],
  providers: [
    StaffService,
    ScheduleService,
    PayrollService,
    TaskService,
    PrismaService,
  ],
})
export class AppModule {}