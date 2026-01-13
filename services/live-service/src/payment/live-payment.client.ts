import axios, { AxiosInstance } from 'axios';

export interface LiveSessionPaymentRequest {
    sessionId: string;
    amount: number;
    currency: string;
    gateway?: string;
    customerEmail: string;
    customerName: string;
    metadata?: Record<string, any>;
}

export class LivePaymentClient {
    private client: AxiosInstance;
    private baseURL: string;

    constructor() {
        this.baseURL = process.env.PAYMENT_SERVICE_URL || 'http://payment-service:3006';
        this.client = axios.create({
            baseURL: this.baseURL,
            timeout: 10000,
        });
    }

    async purchaseSessionAccess(request: LiveSessionPaymentRequest): Promise<any> {
        try {
            const response = await this.client.post('/payments', {
                type: 'live_session',
                session_id: request.sessionId,
                amount: request.amount,
                currency: request.currency,
                gateway: request.gateway,
                customer_email: request.customerEmail,
                customer_name: request.customerName,
                metadata: {
                    service: 'live',
                    source: 'live-service',
                    session_type: 'live_yoga',
                    ...request.metadata,
                },
            });

            return response.data;
        } catch (error) {
            console.error('Live session payment failed:', error);
            throw error;
        }
    }

    async grantAccessAfterPayment(paymentId: string, userId: string, sessionId: string): Promise<any> {
        try {
            const response = await this.client.post('/integrations/live/grant-access', {
                payment_id: paymentId,
                user_id: userId,
                session_id: sessionId,
            });

            return response.data;
        } catch (error) {
            console.error('Access grant failed:', error);
            throw error;
        }
    }
}