import { Controller, Post, Body, Param, Get, Headers } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';

@Controller('booking-payments')
@ApiTags('Booking Payments')
export class BookingPaymentController {
    constructor(private readonly bookingPaymentService: BookingPaymentService) {}

    @Post('initiate/:bookingId')
    @ApiOperation({ summary: 'Initiate payment for a booking' })
    async initiatePayment(
        @Param('bookingId') bookingId: string,
        @Headers('x-user-id') userId: string,
        @Body() paymentOptions: any,
    ) {
        return this.bookingPaymentService.initiateBookingPayment(bookingId, userId);
    }

    @Get('status/:paymentId')
    @ApiOperation({ summary: 'Check payment status' })
    async getStatus(@Param('paymentId') paymentId: string) {
        // This would call the payment service
        return { paymentId, status: 'checking' };
    }

    @Post('webhook')
    @ApiOperation({ summary: 'Handle payment webhooks' })
    async handleWebhook(@Body() webhookData: any, @Headers('x-signature') signature: string) {
        // Handle webhook from payment service
        return this.bookingPaymentService.handlePaymentWebhook(
            webhookData.paymentId,
            webhookData.status,
            webhookData.transactionId,
        );
    }
}