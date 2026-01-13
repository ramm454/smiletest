import axios, { AxiosInstance } from 'axios';

export interface EcommercePaymentRequest {
    orderId?: string;
    cartId?: string;
    amount: number;
    currency: string;
    gateway?: string;
    customerEmail: string;
    customerName: string;
    items: Array<{
        productId: string;
        name: string;
        quantity: number;
        price: number;
        type: 'physical' | 'digital' | 'subscription';
    }>;
    shippingAddress?: any;
    billingAddress?: any;
    metadata?: Record<string, any>;
}

export class EcommercePaymentClient {
    private client: AxiosInstance;
    private baseURL: string;

    constructor() {
        this.baseURL = process.env.PAYMENT_SERVICE_URL || 'http://payment-service:3006';
        this.client = axios.create({
            baseURL: this.baseURL,
            timeout: 10000,
        });
    }

    async createOrderPayment(request: EcommercePaymentRequest): Promise<any> {
        try {
            const response = await this.client.post('/payments', {
                type: 'ecommerce',
                order_id: request.orderId,
                amount: request.amount,
                currency: request.currency,
                gateway: request.gateway,
                customer_email: request.customerEmail,
                customer_name: request.customerName,
                metadata: {
                    items: request.items,
                    shipping_address: request.shippingAddress,
                    billing_address: request.billingAddress,
                    product_types: request.items.map(item => item.type),
                    service: 'ecommerce',
                    source: 'ecommerce-service',
                    ...request.metadata,
                },
            });

            return response.data;
        } catch (error) {
            console.error('Ecommerce payment creation failed:', error);
            throw error;
        }
    }

    async createCartPayment(cartId: string, customerInfo: any): Promise<any> {
        // Get cart details first
        const cart = await this.getCartDetails(cartId);
        
        const paymentRequest: EcommercePaymentRequest = {
            cartId: cartId,
            amount: cart.totalAmount,
            currency: cart.currency,
            customerEmail: customerInfo.email,
            customerName: customerInfo.name,
            items: cart.items.map(item => ({
                productId: item.productId,
                name: item.name,
                quantity: item.quantity,
                price: item.price,
                type: item.type,
            })),
            shippingAddress: cart.shippingAddress,
            billingAddress: cart.billingAddress,
            metadata: {
                cart_id: cartId,
                item_count: cart.items.length,
            },
        };

        return this.createOrderPayment(paymentRequest);
    }

    private async getCartDetails(cartId: string): Promise<any> {
        // Implement cart retrieval logic
        return {
            id: cartId,
            totalAmount: 5999,
            currency: 'USD',
            items: [
                {
                    productId: 'prod_123',
                    name: 'Yoga Mat',
                    quantity: 1,
                    price: 4999,
                    type: 'physical',
                },
            ],
            shippingAddress: {},
            billingAddress: {},
        };
    }
}