import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { BookingPaymentClient, PaymentRequest, PaymentResponse } from './booking-payment.client';
import { NotificationService } from '../notification/notification.service';

@Injectable()
export class BookingPaymentService {
    private readonly logger = new Logger(BookingPaymentService.name);
    private paymentClient: BookingPaymentClient;

    constructor(
        private prisma: PrismaService,
        private notificationService: NotificationService,
    ) {
        this.paymentClient = new BookingPaymentClient();
    }

    async initiateBookingPayment(bookingId: string, userId: string): Promise<PaymentResponse> {
        // Get booking details
        const booking = await this.prisma.booking.findUnique({
            where: { id: bookingId },
            include: {
                user: true,
                class: true,
            },
        });

        if (!booking) {
            throw new Error('Booking not found');
        }

        // Get user details
        const user = await this.prisma.user.findUnique({
            where: { id: userId },
        });

        // Prepare payment request
        const paymentRequest: PaymentRequest = {
            bookingId: booking.id,
            amount: booking.totalAmount,
            currency: booking.currency || 'USD',
            customerEmail: user.email,
            customerName: `${user.firstName} ${user.lastName}`,
            metadata: {
                booking_type: booking.type,
                class_id: booking.classId,
                class_name: booking.class?.title,
                start_time: booking.startTime,
                end_time: booking.endTime,
                participants: booking.participants,
                user_id: user.id,
            },
            gateway: this.determineGateway(user.country, booking.currency),
        };

        // Call payment service
        let paymentResponse: PaymentResponse;
        
        if (process.env.NODE_ENV === 'development' && process.env.USE_MOCK_PAYMENTS === 'true') {
            paymentResponse = await this.paymentClient.createMockPayment(paymentRequest);
        } else {
            paymentResponse = await this.paymentClient.createPayment(paymentRequest);
        }

        // Update booking with payment ID
        await this.prisma.booking.update({
            where: { id: bookingId },
            data: {
                paymentId: paymentResponse.paymentId,
                paymentStatus: 'pending',
                updatedAt: new Date(),
            },
        });

        // Log payment initiation
        await this.prisma.paymentLog.create({
            data: {
                bookingId: booking.id,
                paymentId: paymentResponse.paymentId,
                amount: booking.totalAmount,
                currency: booking.currency,
                status: 'initiated',
                gateway: paymentRequest.gateway,
                metadata: paymentRequest.metadata,
            },
        });

        this.logger.log(`Payment initiated for booking ${bookingId}: ${paymentResponse.paymentId}`);

        return paymentResponse;
    }

    async handlePaymentWebhook(paymentId: string, status: string, transactionId?: string): Promise<void> {
        // Find booking by payment ID
        const booking = await this.prisma.booking.findFirst({
            where: { paymentId },
            include: { user: true, class: true },
        });

        if (!booking) {
            this.logger.warn(`No booking found for payment ${paymentId}`);
            return;
        }

        // Update booking payment status
        await this.prisma.booking.update({
            where: { id: booking.id },
            data: {
                paymentStatus: status,
                status: status === 'succeeded' ? 'confirmed' : booking.status,
                updatedAt: new Date(),
            },
        });

        // Update payment log
        await this.prisma.paymentLog.updateMany({
            where: { paymentId },
            data: {
                status: status,
                transactionId: transactionId,
                processedAt: new Date(),
            },
        });

        // Send notifications based on status
        await this.sendPaymentNotifications(booking, status);

        this.logger.log(`Booking ${booking.id} payment updated to ${status}`);
    }

    private async sendPaymentNotifications(booking: any, status: string): Promise<void> {
        const user = booking.user;
        const yogaClass = booking.class;

        switch (status) {
            case 'succeeded':
                // Send booking confirmation
                await this.notificationService.sendEmail({
                    to: user.email,
                    subject: '🎉 Your Yoga Booking is Confirmed!',
                    template: 'booking-confirmation',
                    data: {
                        userName: `${user.firstName} ${user.lastName}`,
                        className: yogaClass?.title || 'Yoga Class',
                        dateTime: booking.startTime,
                        duration: booking.duration,
                        instructor: yogaClass?.instructorName,
                        location: yogaClass?.location,
                        bookingId: booking.id,
                        amount: booking.totalAmount,
                        currency: booking.currency,
                    },
                });

                // Send to instructor if applicable
                if (yogaClass?.instructorEmail) {
                    await this.notificationService.sendEmail({
                        to: yogaClass.instructorEmail,
                        subject: 'New Booking Received',
                        template: 'instructor-booking-notification',
                        data: {
                            studentName: `${user.firstName} ${user.lastName}`,
                            className: yogaClass.title,
                            dateTime: booking.startTime,
                            participants: booking.participants,
                            studentEmail: user.email,
                            studentPhone: user.phone,
                        },
                    });
                }
                break;

            case 'failed':
                await this.notificationService.sendEmail({
                    to: user.email,
                    subject: 'Payment Failed - Yoga Booking',
                    template: 'payment-failed',
                    data: {
                        userName: `${user.firstName} ${user.lastName}`,
                        className: yogaClass?.title || 'Yoga Class',
                        bookingId: booking.id,
                        amount: booking.totalAmount,
                        currency: booking.currency,
                    },
                });
                break;

            case 'refunded':
                await this.notificationService.sendEmail({
                    to: user.email,
                    subject: 'Booking Refund Processed',
                    template: 'booking-refund',
                    data: {
                        userName: `${user.firstName} ${user.lastName}`,
                        className: yogaClass?.title || 'Yoga Class',
                        bookingId: booking.id,
                        refundAmount: booking.totalAmount,
                        currency: booking.currency,
                    },
                });
                break;
        }
    }

    private determineGateway(country?: string, currency?: string): string {
        // Logic to determine best payment gateway
        if (currency === 'INR' || country === 'IN') {
            return 'razorpay';
        } else if (currency === 'USD' || currency === 'EUR') {
            return 'stripe';
        } else {
            return process.env.DEFAULT_PAYMENT_GATEWAY || 'stripe';
        }
    }

    async cancelBookingWithRefund(bookingId: string, reason: string): Promise<any> {
        const booking = await this.prisma.booking.findUnique({
            where: { id: bookingId },
        });

        if (!booking || !booking.paymentId) {
            throw new Error('Booking or payment not found');
        }

        // Initiate refund via payment service
        const refundResult = await this.paymentClient.refundPayment(booking.paymentId, reason);

        // Update booking status
        await this.prisma.booking.update({
            where: { id: bookingId },
            data: {
                status: 'cancelled',
                paymentStatus: 'refunded',
                cancellationReason: reason,
                cancelledAt: new Date(),
            },
        });

        return refundResult;
    }
}