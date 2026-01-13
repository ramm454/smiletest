import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EcommercePaymentClient } from './ecommerce-payment.client';
import { NotificationService } from '../notification/notification.service';

@Injectable()
export class EcommercePaymentService {
    private paymentClient: EcommercePaymentClient;

    constructor(
        private prisma: PrismaService,
        private notificationService: NotificationService,
    ) {
        this.paymentClient = new EcommercePaymentClient();
    }

    async processOrderPayment(orderId: string): Promise<any> {
        const order = await this.prisma.order.findUnique({
            where: { id: orderId },
            include: {
                user: true,
                items: true,
                shippingAddress: true,
                billingAddress: true,
            },
        });

        if (!order) {
            throw new Error('Order not found');
        }

        // Prepare payment request
        const paymentRequest = {
            orderId: order.id,
            amount: order.totalAmount,
            currency: order.currency,
            customerEmail: order.user.email,
            customerName: `${order.user.firstName} ${order.user.lastName}`,
            items: order.items.map(item => ({
                productId: item.productId,
                name: item.productName,
                quantity: item.quantity,
                price: item.unitPrice,
                type: this.getProductType(item.productId),
            })),
            shippingAddress: order.shippingAddress,
            billingAddress: order.billingAddress,
            metadata: {
                order_number: order.orderNumber,
                user_id: order.userId,
            },
        };

        // Call payment service
        const payment = await this.paymentClient.createOrderPayment(paymentRequest);

        // Update order with payment info
        await this.prisma.order.update({
            where: { id: orderId },
            data: {
                paymentId: payment.paymentId,
                paymentStatus: 'pending',
                paymentGateway: payment.gateway,
            },
        });

        return payment;
    }

    async handlePaymentSuccess(paymentId: string, transactionId: string): Promise<void> {
        // Find order by payment ID
        const order = await this.prisma.order.findFirst({
            where: { paymentId },
            include: {
                user: true,
                items: {
                    include: {
                        product: true,
                    },
                },
            },
        });

        if (!order) {
            throw new Error('Order not found for payment');
        }

        // Update order status
        await this.prisma.order.update({
            where: { id: order.id },
            data: {
                paymentStatus: 'paid',
                status: 'processing',
                paidAt: new Date(),
                transactionId: transactionId,
            },
        });

        // Fulfill order based on product types
        await this.fulfillOrder(order);

        // Send confirmation
        await this.notificationService.sendOrderConfirmation(order);
    }

    private async fulfillOrder(order: any): Promise<void> {
        // Separate digital and physical items
        const digitalItems = order.items.filter(item => 
            item.product.type === 'digital' || 
            item.product.type === 'ebook' ||
            item.product.type === 'video'
        );

        const physicalItems = order.items.filter(item => 
            item.product.type === 'physical'
        );

        // Process digital items immediately
        if (digitalItems.length > 0) {
            await this.processDigitalItems(order, digitalItems);
        }

        // Process physical items (trigger shipping)
        if (physicalItems.length > 0) {
            await this.processPhysicalItems(order, physicalItems);
        }
    }

    private async processDigitalItems(order: any, items: any[]): Promise<void> {
        // Generate download links or access codes
        for (const item of items) {
            // Create digital access record
            await this.prisma.digitalAccess.create({
                data: {
                    userId: order.userId,
                    orderId: order.id,
                    productId: item.productId,
                    accessToken: this.generateAccessToken(),
                    expiresAt: this.getExpiryDate(item.product.type),
                    downloadUrl: this.generateDownloadUrl(item.productId),
                },
            });
        }

        // Send digital access email
        await this.notificationService.sendDigitalAccessEmail(order, items);
    }

    private async processPhysicalItems(order: any, items: any[]): Promise<void> {
        // Create shipment record
        const shipment = await this.prisma.shipment.create({
            data: {
                orderId: order.id,
                status: 'pending',
                shippingMethod: order.shippingMethod,
                estimatedDelivery: this.calculateDeliveryDate(),
            },
        });

        // Update inventory
        for (const item of items) {
            await this.prisma.product.update({
                where: { id: item.productId },
                data: {
                    stock: {
                        decrement: item.quantity,
                    },
                },
            });
        }

        // Trigger warehouse notification
        await this.notificationService.notifyWarehouse(order, shipment);
    }

    private getProductType(productId: string): string {
        // Determine product type based on product ID or category
        return 'physical'; // Default
    }

    private generateAccessToken(): string {
        return Math.random().toString(36).substring(2) + Date.now().toString(36);
    }

    private getExpiryDate(productType: string): Date {
        const now = new Date();
        if (productType === 'subscription') {
            return new Date(now.setMonth(now.getMonth() + 1)); // 1 month
        }
        return new Date(now.setFullYear(now.getFullYear() + 1)); // 1 year
    }

    private generateDownloadUrl(productId: string): string {
        return `/download/${productId}/${this.generateAccessToken()}`;
    }

    private calculateDeliveryDate(): Date {
        const delivery = new Date();
        delivery.setDate(delivery.getDate() + 3); // 3 days
        return delivery;
    }
}