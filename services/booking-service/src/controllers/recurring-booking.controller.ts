import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Put,
  Delete,
  Query,
  Headers,
  UseGuards,
} from '@nestjs/common';
import { RecurringBookingService } from '../services/recurring-booking.service';
import { CreateRecurringBookingDto, UpdateRecurringBookingDto } from '../dto/recurring-booking.dto';
import { AuthGuard } from '../guards/auth.guard';

@Controller('recurring-bookings')
export class RecurringBookingController {
  constructor(private readonly recurringBookingService: RecurringBookingService) {}

  @Post()
  @UseGuards(AuthGuard)
  async create(
    @Body() createRecurringBookingDto: CreateRecurringBookingDto,
    @Headers('x-user-id') userId: string,
  ) {
    createRecurringBookingDto.userId = userId;
    return this.recurringBookingService.createRecurringBooking(createRecurringBookingDto);
  }

  @Get()
  @UseGuards(AuthGuard)
  async findAll(
    @Query() query: any,
    @Headers('x-user-id') userId: string,
  ) {
    return this.recurringBookingService.listRecurringBookings(userId, query);
  }

  @Get(':id')
  @UseGuards(AuthGuard)
  async findOne(@Param('id') id: string) {
    return this.recurringBookingService.getRecurringBooking(id);
  }

  @Put(':id')
  @UseGuards(AuthGuard)
  async update(
    @Param('id') id: string,
    @Body() updateRecurringBookingDto: UpdateRecurringBookingDto,
  ) {
    return this.recurringBookingService.updateRecurringBooking(id, updateRecurringBookingDto);
  }

  @Delete(':id')
  @UseGuards(AuthGuard)
  async remove(@Param('id') id: string) {
    return this.recurringBookingService.updateRecurringBooking(id, {
      status: 'CANCELLED',
      cancellationReason: 'User cancelled',
    });
  }

  @Post(':id/generate')
  @UseGuards(AuthGuard)
  async generateBookings(
    @Param('id') id: string,
    @Body() body: { upToDate?: string },
  ) {
    const upToDate = body.upToDate ? new Date(body.upToDate) : undefined;
    return this.recurringBookingService.generateBookings(id, upToDate);
  }

  @Get(':id/bookings')
  @UseGuards(AuthGuard)
  async getBookings(@Param('id') id: string) {
    const recurring = await this.recurringBookingService.getRecurringBooking(id);
    return recurring.bookings;
  }

  @Post(':id/pause')
  @UseGuards(AuthGuard)
  async pause(
    @Param('id') id: string,
    @Body() body: { until: string; reason?: string },
  ) {
    return this.recurringBookingService.updateRecurringBooking(id, {
      status: 'PAUSED',
      pauseUntil: new Date(body.until),
    });
  }

  @Post(':id/resume')
  @UseGuards(AuthGuard)
  async resume(@Param('id') id: string) {
    return this.recurringBookingService.updateRecurringBooking(id, {
      status: 'ACTIVE',
      pauseUntil: null,
    });
  }

  @Get('user/:userId/summary')
  @UseGuards(AuthGuard)
  async getUserSummary(@Param('userId') userId: string) {
    const [active, paused, cancelled, total] = await Promise.all([
      this.recurringBookingService.listRecurringBookings(userId, { status: 'ACTIVE' }),
      this.recurringBookingService.listRecurringBookings(userId, { status: 'PAUSED' }),
      this.recurringBookingService.listRecurringBookings(userId, { status: 'CANCELLED' }),
      this.recurringBookingService.listRecurringBookings(userId, {}),
    ]);

    return {
      active: active.bookings.length,
      paused: paused.bookings.length,
      cancelled: cancelled.bookings.length,
      total: total.bookings.length,
      upcomingBookings: active.bookings.flatMap(rb => rb.bookings || []).length,
    };
  }
}