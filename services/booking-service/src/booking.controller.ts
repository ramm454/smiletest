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
  Headers,
  UseGuards,
} from '@nestjs/common';
import { BookingService } from './booking.service';
import { BookingPaymentService } from './payment/booking-payment.service';
import { CreateBookingDto } from './dto/create-booking.dto';
import { UpdateBookingDto } from './dto/update-booking.dto';
import { AuthGuard } from '../auth/auth.guard';

@Controller('bookings')
export class BookingController {
  constructor(
    private readonly bookingService: BookingService,
    private readonly bookingPaymentService: BookingPaymentService,
  ) {}

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
  @UseGuards(AuthGuard)
  async create(
    @Body() createBookingDto: CreateBookingDto,
    @Headers('x-user-id') userId: string,
  ) {
    // Create booking first
    const booking = await this.bookingService.create(createBookingDto, userId);
    
    // Return booking with payment initiation option
    return {
      ...booking,
      payment: {
        required: true,
        amount: booking.totalAmount,
        currency: booking.currency,
        paymentInitUrl: `/bookings/${booking.id}/initiate-payment`,
      },
    };
  }

  @Post(':id/initiate-payment')
  @UseGuards(AuthGuard)
  async initiatePayment(
    @Param('id') bookingId: string,
    @Headers('x-user-id') userId: string,
    @Body() paymentOptions?: any,
  ) {
    // Initiate payment for booking
    const payment = await this.bookingPaymentService.initiateBookingPayment(
      bookingId,
      userId,
      paymentOptions,
    );
    
    return {
      bookingId,
      payment,
      instructions: this.getPaymentInstructions(payment),
    };
  }

  @Get(':id/payment-status')
  @UseGuards(AuthGuard)
  async getPaymentStatus(
    @Param('id') bookingId: string,
    @Headers('x-user-id') userId: string,
  ) {
    const booking = await this.bookingService.findOne(bookingId);
    
    // Verify user access
    if (booking.userId !== userId && !this.bookingService.hasAdminAccess(userId)) {
      throw new Error('Unauthorized access to booking');
    }

    if (!booking.paymentId) {
      return { status: 'no_payment' };
    }

    const paymentStatus = await this.bookingPaymentService.getPaymentStatus(
      booking.paymentId,
    );
    
    return {
      bookingStatus: booking.status,
      paymentStatus: paymentStatus.status,
      lastUpdated: paymentStatus.paidAt || booking.updatedAt,
    };
  }

  @Get()
  @UseGuards(AuthGuard)
  async findAll(
    @Query() query: any,
    @Headers('x-user-id') userId?: string,
  ) {
    // If user is not admin, only return their bookings
    if (userId && !this.bookingService.hasAdminAccess(userId)) {
      query.userId = userId;
    }
    return this.bookingService.findAll(query);
  }

  @Get(':id')
  @UseGuards(AuthGuard)
  async findOne(
    @Param('id') id: string,
    @Headers('x-user-id') userId: string,
  ) {
    const booking = await this.bookingService.findOne(id);
    
    // Verify user access
    if (booking.userId !== userId && !this.bookingService.hasAdminAccess(userId)) {
      throw new Error('Unauthorized access to booking');
    }
    
    return booking;
  }

  @Put(':id')
  @UseGuards(AuthGuard)
  async update(
    @Param('id') id: string,
    @Body() updateBookingDto: UpdateBookingDto,
    @Headers('x-user-id') userId: string,
  ) {
    // Verify user access
    const booking = await this.bookingService.findOne(id);
    if (booking.userId !== userId && !this.bookingService.hasAdminAccess(userId)) {
      throw new Error('Unauthorized access to update booking');
    }
    
    return this.bookingService.update(id, updateBookingDto);
  }

  @Delete(':id')
  @UseGuards(AuthGuard)
  async remove(
    @Param('id') id: string,
    @Headers('x-user-id') userId: string,
  ) {
    // Verify user access
    const booking = await this.bookingService.findOne(id);
    if (booking.userId !== userId && !this.bookingService.hasAdminAccess(userId)) {
      throw new Error('Unauthorized access to delete booking');
    }
    
    return this.bookingService.remove(id);
  }

  @Post(':id/cancel')
  @UseGuards(AuthGuard)
  async cancel(
    @Param('id') id: string,
    @Body() body: { reason?: string },
    @Headers('x-user-id') userId: string,
  ) {
    // Verify user access
    const booking = await this.bookingService.findOne(id);
    if (booking.userId !== userId && !this.bookingService.hasAdminAccess(userId)) {
      throw new Error('Unauthorized access to cancel booking');
    }
    
    return this.bookingService.cancel(id, body.reason);
  }

  @Post(':id/cancel-with-refund')
  @UseGuards(AuthGuard)
  async cancelWithRefund(
    @Param('id') bookingId: string,
    @Headers('x-user-id') userId: string,
    @Body() body: { reason: string },
  ) {
    // Verify user owns booking
    const booking = await this.bookingService.findOne(bookingId);
    if (booking.userId !== userId && !this.bookingService.hasAdminAccess(userId)) {
      throw new Error('Unauthorized access to cancel booking');
    }
    
    // Cancel and refund
    const refund = await this.bookingPaymentService.cancelBookingWithRefund(
      bookingId,
      body.reason,
    );
    
    return {
      success: true,
      message: 'Booking cancelled and refund initiated',
      refund,
    };
  }

  @Post(':id/checkin')
  @UseGuards(AuthGuard)
  async checkin(
    @Param('id') id: string,
    @Headers('x-user-id') userId: string,
  ) {
    // Only admin or staff can checkin
    if (!this.bookingService.hasStaffAccess(userId)) {
      throw new Error('Unauthorized access to checkin');
    }
    
    return this.bookingService.checkin(id);
  }

  @Post(':id/checkout')
  @UseGuards(AuthGuard)
  async checkout(
    @Param('id') id: string,
    @Headers('x-user-id') userId: string,
  ) {
    // Only admin or staff can checkout
    if (!this.bookingService.hasStaffAccess(userId)) {
      throw new Error('Unauthorized access to checkout');
    }
    
    return this.bookingService.checkout(id);
  }

  @Get('user/:userId')
  @UseGuards(AuthGuard)
  async findByUser(
    @Param('userId') userId: string,
    @Query() query: any,
    @Headers('x-user-id') requestingUserId: string,
  ) {
    // Users can only view their own bookings unless they're admin
    if (userId !== requestingUserId && !this.bookingService.hasAdminAccess(requestingUserId)) {
      throw new Error('Unauthorized access to user bookings');
    }
    
    return this.bookingService.findByUser(userId, query);
  }

  @Get('availability/check')
  async checkAvailability(@Query() query: any) {
    return this.bookingService.checkAvailability(query);
  }

  @Get('calendar/events')
  @UseGuards(AuthGuard)
  async getCalendarEvents(
    @Query('userId') userId: string,
    @Headers('x-user-id') requestingUserId: string,
  ) {
    // Users can only view their own calendar unless they're admin
    if (userId !== requestingUserId && !this.bookingService.hasAdminAccess(requestingUserId)) {
      throw new Error('Unauthorized access to calendar');
    }
    
    // Implementation for calendar events
    return this.bookingService.getCalendarEvents(userId);
  }

  @Post(':id/reschedule')
  @UseGuards(AuthGuard)
  async reschedule(
    @Param('id') id: string,
    @Body() body: { newStartTime: string; newEndTime: string },
    @Headers('x-user-id') userId: string,
  ) {
    // Verify user access
    const booking = await this.bookingService.findOne(id);
    if (booking.userId !== userId && !this.bookingService.hasAdminAccess(userId)) {
      throw new Error('Unauthorized access to reschedule booking');
    }
    
    // Implementation for rescheduling
    return this.bookingService.reschedule(id, body.newStartTime, body.newEndTime);
  }

  @Get('upcoming/:userId')
  @UseGuards(AuthGuard)
  async getUpcomingBookings(
    @Param('userId') userId: string,
    @Headers('x-user-id') requestingUserId: string,
  ) {
    // Users can only view their own upcoming bookings unless they're admin
    if (userId !== requestingUserId && !this.bookingService.hasAdminAccess(requestingUserId)) {
      throw new Error('Unauthorized access to upcoming bookings');
    }
    
    return this.bookingService.findByUser(userId, { upcoming: true });
  }

  @Get('past/:userId')
  @UseGuards(AuthGuard)
  async getPastBookings(
    @Param('userId') userId: string,
    @Headers('x-user-id') requestingUserId: string,
  ) {
    // Users can only view their own past bookings unless they're admin
    if (userId !== requestingUserId && !this.bookingService.hasAdminAccess(requestingUserId)) {
      throw new Error('Unauthorized access to past bookings');
    }
    
    return this.bookingService.findByUser(userId, { past: true });
  }

  @Get('stats/summary')
  @UseGuards(AuthGuard)
  async getBookingStats(
    @Query() query: any,
    @Headers('x-user-id') userId: string,
  ) {
    // Only admin can view stats
    if (!this.bookingService.hasAdminAccess(userId)) {
      throw new Error('Unauthorized access to booking statistics');
    }
    
    const { startDate, endDate, userId: filterUserId } = query;
    return this.bookingService.getBookingStats(startDate, endDate, filterUserId);
  }

  // Webhook endpoint for payment service to call
  @Post('payment-webhook')
  async handlePaymentWebhook(
    @Body() webhookData: any,
    @Headers('x-webhook-secret') secret: string,
  ) {
    // Verify webhook secret
    if (secret !== process.env.PAYMENT_WEBHOOK_SECRET) {
      throw new Error('Invalid webhook secret');
    }

    const { paymentId, status, transactionId } = webhookData;
    
    await this.bookingPaymentService.handlePaymentWebhook(
      paymentId,
      status,
      transactionId,
    );
    
    return { success: true };
  }

  private getPaymentInstructions(payment: any): any {
    if (payment.nextAction) {
      return {
        type: payment.nextAction.type,
        instructions: 'Complete payment using the provided method',
        ...payment.nextAction,
      };
    }

    if (payment.clientSecret) {
      return {
        type: 'stripe_elements',
        instructions: 'Use the client secret with Stripe Elements',
        clientSecret: payment.clientSecret,
      };
    }

    return {
      type: 'redirect',
      instructions: 'You will be redirected to complete payment',
    };
  }
}