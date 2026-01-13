import axios, { AxiosInstance } from 'axios';

export interface PaymentRequest {
    bookingId: string;
    amount: number;
    currency: string;
    gateway?: string; // stripe, paypal, razorpay
    customerEmail: string;
    customerName: string;
    metadata?: Record<string, any>;
}

export interface PaymentResponse {
    paymentId: string;
    clientSecret?: string;
    gatewayOrderId?: string;
    status: string;
    nextAction?: {
        type: string;
        url?: string;
        data?: any;
    };
}

export interface PaymentStatus {
    paymentId: string;
    status: 'pending' | 'processing' | 'succeeded' | 'failed' | 'refunded';
    gateway: string;
    transactionId?: string;
    paidAt?: Date;
}

export class BookingPaymentClient {
    private client: AxiosInstance;
    private baseURL: string;

    constructor() {
        this.baseURL = process.env.PAYMENT_SERVICE_URL || 'http://payment-service:3006';
        this.client = axios.create({
            baseURL: this.baseURL,
            timeout: 10000,
            headers: {
                'Content-Type': 'application/json',
            },
        });
    }

    async createPayment(request: PaymentRequest): Promise<PaymentResponse> {
        try {
            const response = await this.client.post('/payments', {
                type: 'booking',
                booking_id: request.bookingId,
                amount: request.amount,
                currency: request.currency,
                gateway: request.gateway || 'stripe',
                customer_email: request.customerEmail,
                customer_name: request.customerName,
                metadata: {
                    ...request.metadata,
                    service: 'booking',
                    source: 'booking-service',
                },
            });

            return response.data;
        } catch (error) {
            console.error('Payment creation failed:', error);
            throw new Error(`Payment service error: ${error.message}`);
        }
    }

    async getPaymentStatus(paymentId: string): Promise<PaymentStatus> {
        try {
            const response = await this.client.get(`/payments/${paymentId}`);
            return response.data;
        } catch (error) {
            console.error('Payment status fetch failed:', error);
            throw new Error(`Payment service error: ${error.message}`);
        }
    }

    async refundPayment(paymentId: string, reason: string): Promise<any> {
        try {
            const response = await this.client.post('/payments/refund', {
                payment_id: paymentId,
                reason: reason,
            });
            return response.data;
        } catch (error) {
            console.error('Refund failed:', error);
            throw new Error(`Refund service error: ${error.message}`);
        }
    }

    async validateBookingPayment(bookingId: string, amount: number, currency: string): Promise<boolean> {
        try {
            const response = await this.client.post('/integrations/booking/validate', {
                booking_id: bookingId,
                amount: amount,
                currency: currency,
            });
            return response.data.valid;
        } catch (error) {
            console.error('Payment validation failed:', error);
            return false;
        }
    }

    // For development/testing - mock payment
    async createMockPayment(request: PaymentRequest): Promise<PaymentResponse> {
        return {
            paymentId: `mock_pay_${Date.now()}`,
            clientSecret: 'mock_secret_123',
            status: 'pending',
            nextAction: {
                type: 'test',
                url: '/booking/payment/test-success',
            },
        };
    }
}