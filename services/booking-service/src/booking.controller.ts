import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Delete,
  Put,
  Query,
  Patch,
} from '@nestjs/common';
import { BookingService } from './booking.service';
import { CreateBookingDto } from './dto/create-booking.dto';
import { UpdateBookingDto } from './dto/update-booking.dto';

@Controller('bookings')
export class BookingController {
  constructor(private readonly bookingService: BookingService) {}

  @Get('health')
  healthCheck() {
    return {
      status: 'healthy',
      service: 'booking-service',
      timestamp: new Date().toISOString(),
      database: this.bookingService.checkDatabase(),
    };
  }

  @Post()
  async create(@Body() createBookingDto: CreateBookingDto) {
    return this.bookingService.create(createBookingDto);
  }

  @Get()
  async findAll(@Query() query: any) {
    return this.bookingService.findAll(query);
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    return this.bookingService.findOne(id);
  }

  @Put(':id')
  async update(
    @Param('id') id: string,
    @Body() updateBookingDto: UpdateBookingDto,
  ) {
    return this.bookingService.update(id, updateBookingDto);
  }

  @Delete(':id')
  async remove(@Param('id') id: string) {
    return this.bookingService.remove(id);
  }

  @Post(':id/cancel')
  async cancel(@Param('id') id: string, @Body() body: { reason?: string }) {
    return this.bookingService.cancel(id, body.reason);
  }

  @Post(':id/checkin')
  async checkin(@Param('id') id: string) {
    return this.bookingService.checkin(id);
  }

  @Post(':id/checkout')
  async checkout(@Param('id') id: string) {
    return this.bookingService.checkout(id);
  }

  @Get('user/:userId')
  async findByUser(@Param('userId') userId: string, @Query() query: any) {
    return this.bookingService.findByUser(userId, query);
  }

  @Get('availability/check')
  async checkAvailability(@Query() query: any) {
    return this.bookingService.checkAvailability(query);
  }

  @Get('calendar/events')
  async getCalendarEvents(@Query('userId') userId: string) {
    // Implementation for calendar events
    return [];
  }

  @Post(':id/reschedule')
  async reschedule(
    @Param('id') id: string,
    @Body() body: { newStartTime: string; newEndTime: string },
  ) {
    // Implementation for rescheduling
    return { id, ...body, rescheduled: true };
  }

  @Get('upcoming/:userId')
  async getUpcomingBookings(@Param('userId') userId: string) {
    return this.bookingService.findByUser(userId, { upcoming: true });
  }

  @Get('past/:userId')
  async getPastBookings(@Param('userId') userId: string) {
    return this.bookingService.findByUser(userId, { past: true });
  }

  @Get('stats/summary')
  async getBookingStats(@Query() query: any) {
    const { startDate, endDate, userId } = query;
    // Implementation for booking statistics
    return {
      totalBookings: 0,
      confirmed: 0,
      cancelled: 0,
      revenue: 0,
      averageBookingValue: 0,
    };
  }
}