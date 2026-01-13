import { Injectable } from '@nestjs/common';
import { ClientProxy, ClientProxyFactory, Transport } from '@nestjs/microservices';

@Injectable()
export class EcommerceNotificationService {
  private notificationClient: ClientProxy;

  constructor() {
    this.notificationClient = ClientProxyFactory.create({
      transport: Transport.RMQ,
      options: {
        urls: [process.env.RABBITMQ_URL || 'amqp://localhost:5672'],
        queue: 'notifications',
        queueOptions: {
          durable: true,
        },
      },
    });
  }

  async sendOrderConfirmation(order: any, user: any) {
    const notification = {
      type: 'order_confirmation',
      userId: user.id,
      channel: 'email',
      template: 'order_confirmation',
      data: {
        orderId: order.id,
        orderDate: new Date(order.createdAt).toLocaleDateString(),
        items: order.items.map(item => ({
          name: item.product.name,
          quantity: item.quantity,
          price: item.price,
        })),
        subtotal: order.subtotal,
        tax: order.tax,
        shipping: order.shippingCost,
        total: order.totalAmount,
        estimatedDelivery: this.calculateDeliveryDate(),
        trackingLink: order.trackingNumber ? 
          `${process.env.COURIER_URL}/track/${order.trackingNumber}` : null,
      },
      email: user.email,
      phone: user.phone,
      metadata: {
        service: 'ecommerce-service',
        event: 'order_created',
        timestamp: new Date().toISOString(),
      }
    };

    await this.notificationClient.emit('notification.created', notification).toPromise();
  }

  async sendShippingUpdate(order: any, user: any, status: string) {
    const notification = {
      type: 'shipping_update',
      userId: user.id,
      channel: ['email', 'sms'],
      template: 'shipping_update',
      data: {
        orderId: order.id,
        status: status,
        trackingNumber: order.trackingNumber,
        trackingLink: `${process.env.COURIER_URL}/track/${order.trackingNumber}`,
        estimatedDelivery: this.calculateDeliveryDate(),
        currentLocation: 'Distribution Center',
        nextUpdate: 'When out for delivery',
      },
      email: user.email,
      phone: user.phone,
      metadata: {
        service: 'ecommerce-service',
        event: 'shipping_updated',
        status: status,
        timestamp: new Date().toISOString(),
      }
    };

    await this.notificationClient.emit('notification.created', notification).toPromise();
  }

  async sendBackInStockNotification(product: any, subscribedUsers: any[]) {
    for (const user of subscribedUsers) {
      const notification = {
        type: 'back_in_stock',
        userId: user.id,
        channel: 'email',
        template: 'back_in_stock',
        data: {
          productName: product.name,
          productImage: product.images[0],
          price: product.price,
          stockQuantity: product.stock,
          productLink: `${process.env.FRONTEND_URL}/shop/${product.id}`,
          specialOffer: 'While stock lasts',
        },
        email: user.email,
        metadata: {
          service: 'ecommerce-service',
          event: 'product_back_in_stock',
          timestamp: new Date().toISOString(),
        },
        gdpr: {
          consentRequired: true,
          category: 'marketing',
          unsubscribeAllowed: true,
        }
      };

      await this.notificationClient.emit('notification.created', notification).toPromise();
    }
  }

  async sendAbandonedCartReminder(user: any, cartItems: any[]) {
    const notification = {
      type: 'abandoned_cart',
      userId: user.id,
      channel: 'email',
      template: 'abandoned_cart',
      data: {
        items: cartItems.map(item => ({
          name: item.product.name,
          quantity: item.quantity,
          price: item.price,
          image: item.product.images[0],
        })),
        cartTotal: cartItems.reduce((sum, item) => sum + (item.price * item.quantity), 0),
        cartLink: `${process.env.FRONTEND_URL}/cart`,
        discountCode: 'CART10',
        discountExpiry: '24 hours',
      },
      email: user.email,
      metadata: {
        service: 'ecommerce-service',
        event: 'abandoned_cart_reminder',
        timestamp: new Date().toISOString(),
      },
      gdpr: {
        consentRequired: true,
        category: 'marketing',
        unsubscribeAllowed: true,
      }
    };

    await this.notificationClient.emit('notification.created', notification).toPromise();
  }

  private calculateDeliveryDate(): string {
    const date = new Date();
    date.setDate(date.getDate() + 3); // 3 days from now
    return date.toLocaleDateString();
  }
}