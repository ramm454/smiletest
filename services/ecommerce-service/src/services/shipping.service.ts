import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import axios from 'axios';

const prisma = new PrismaClient();

@Injectable()
export class ShippingService {
  private readonly SHIPPO_API_KEY = process.env.SHIPPO_API_KEY;
  private readonly SHIPPO_API_URL = 'https://api.goshippo.com';

  async calculateShipping(address: any, items: any[]) {
    try {
      // Calculate package dimensions and weight
      const packageInfo = this.calculatePackageInfo(items);

      // In production, you would integrate with Shippo or similar service
      // For now, return mock shipping rates
      const mockRates = [
        {
          provider: 'USPS',
          service: 'Priority Mail',
          amount: 9.99,
          deliveryDays: 2,
          estimatedDelivery: this.getEstimatedDeliveryDate(2),
        },
        {
          provider: 'UPS',
          service: 'Ground',
          amount: 12.99,
          deliveryDays: 3,
          estimatedDelivery: this.getEstimatedDeliveryDate(3),
        },
        {
          provider: 'FedEx',
          service: '2Day',
          amount: 19.99,
          deliveryDays: 2,
          estimatedDelivery: this.getEstimatedDeliveryDate(2),
        },
      ];

      return mockRates;
    } catch (error) {
      throw new BadRequestException(`Shipping calculation failed: ${error.message}`);
    }
  }

  private calculatePackageInfo(items: any[]) {
    let totalWeight = 0;
    let maxDimensions = { length: 0, width: 0, height: 0 };

    items.forEach(item => {
      if (item.product) {
        totalWeight += (item.product.weight || 0.5) * item.quantity;
        const dimensions = item.product.dimensions || { length: 10, width: 10, height: 10 };
        maxDimensions.length = Math.max(maxDimensions.length, dimensions.length);
        maxDimensions.width = Math.max(maxDimensions.width, dimensions.width);
        maxDimensions.height = Math.max(maxDimensions.height, dimensions.height);
      }
    });

    return {
      weight: Math.max(totalWeight, 0.1), // Minimum 0.1 kg
      dimensions: maxDimensions,
      parcelType: totalWeight > 5 ? 'large' : 'small',
    };
  }

  private getEstimatedDeliveryDate(days: number): string {
    const date = new Date();
    date.setDate(date.getDate() + days);
    return date.toISOString().split('T')[0];
  }

  async createShipment(orderId: string, shippingMethod: any) {
    try {
      const order = await prisma.order.findUnique({
        where: { id: orderId },
        include: { items: { include: { product: true } } },
      });

      if (!order) {
        throw new BadRequestException('Order not found');
      }

      // In production, create actual shipment with shipping provider
      const trackingNumber = `TRK${Date.now()}${Math.random().toString(36).substr(2, 6).toUpperCase()}`;

      // Update order with shipping info
      const updatedOrder = await prisma.order.update({
        where: { id: orderId },
        data: {
          shippingMethod: shippingMethod.provider,
          trackingNumber,
          fulfillmentStatus: 'FULFILLED',
          shippedAt: new Date(),
        },
      });

      // Create shipment record
      const shipment = await prisma.shipment.create({
        data: {
          orderId,
          trackingNumber,
          carrier: shippingMethod.provider,
          service: shippingMethod.service,
          shippingCost: shippingMethod.amount,
          estimatedDelivery: shippingMethod.estimatedDelivery,
          status: 'IN_TRANSIT',
        },
      });

      // Send shipment notification
      await this.sendShipmentNotification(order, trackingNumber);

      return {
        shipmentId: shipment.id,
        trackingNumber,
        estimatedDelivery: shippingMethod.estimatedDelivery,
        labelUrl: `https://shipping.example.com/labels/${trackingNumber}`, // Mock URL
      };
    } catch (error) {
      throw new BadRequestException(`Shipment creation failed: ${error.message}`);
    }
  }

  async trackShipment(trackingNumber: string) {
    // Mock tracking info - integrate with real tracking API
    const trackingEvents = [
      {
        status: 'IN_TRANSIT',
        location: 'Distribution Center',
        timestamp: new Date(Date.now() - 86400000).toISOString(), // 1 day ago
        description: 'Package departed from distribution center',
      },
      {
        status: 'PROCESSED',
        location: 'Local Facility',
        timestamp: new Date(Date.now() - 43200000).toISOString(), // 12 hours ago
        description: 'Package arrived at local facility',
      },
      {
        status: 'OUT_FOR_DELIVERY',
        location: 'Local Facility',
        timestamp: new Date().toISOString(),
        description: 'Package out for delivery',
      },
    ];

    return {
      trackingNumber,
      status: 'IN_TRANSIT',
      estimatedDelivery: this.getEstimatedDeliveryDate(1),
      events: trackingEvents,
      carrier: 'USPS',
    };
  }

  private async sendShipmentNotification(order: any, trackingNumber: string) {
    // Implement email notification
    console.log(`Shipping notification sent for order ${order.orderNumber}`);
    console.log(`Tracking number: ${trackingNumber}`);
  }
}