import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import * as amqp from 'amqplib';

export interface EventMessage {
  eventType: string;
  data: any;
  timestamp: Date;
  source: string;
}

@Injectable()
export class EventBusService implements OnModuleInit {
  private connection: amqp.Connection;
  private channel: amqp.Channel;
  private readonly logger = new Logger(EventBusService.name);
  
  async onModuleInit() {
    await this.connect();
  }

  private async connect() {
    try {
      this.connection = await amqp.connect(
        process.env.RABBITMQ_URL || 'amqp://localhost:5672'
      );
      this.channel = await this.connection.createChannel();
      
      // Declare exchange for user events
      await this.channel.assertExchange('user_events', 'topic', { durable: true });
      
      // Declare exchange for booking events
      await this.channel.assertExchange('booking_events', 'topic', { durable: true });
      
      // Declare exchange for payment events
      await this.channel.assertExchange('payment_events', 'topic', { durable: true });
      
      this.logger.log('Event bus connected successfully');
    } catch (error) {
      this.logger.error('Failed to connect to event bus:', error);
      throw error;
    }
  }

  async publishUserEvent(eventType: string, data: any) {
    await this.publish('user_events', eventType, data, 'user-service');
  }

  async publishBookingEvent(eventType: string, data: any) {
    await this.publish('booking_events', eventType, data, 'booking-service');
  }

  async publishPaymentEvent(eventType: string, data: any) {
    await this.publish('payment_events', eventType, data, 'payment-service');
  }

  private async publish(exchange: string, routingKey: string, data: any, source: string) {
    if (!this.channel) {
      throw new Error('Event bus not connected');
    }

    const message: EventMessage = {
      eventType: routingKey,
      data,
      timestamp: new Date(),
      source
    };

    this.channel.publish(
      exchange,
      routingKey,
      Buffer.from(JSON.stringify(message)),
      { persistent: true }
    );

    this.logger.debug(`Event published: ${exchange}.${routingKey}`);
  }

  async subscribe(exchange: string, routingKey: string, callback: (message: EventMessage) => void) {
    if (!this.channel) {
      throw new Error('Event bus not connected');
    }

    // Create queue for this service
    const queueName = `${process.env.SERVICE_NAME}_${routingKey.replace(/\./g, '_')}`;
    const { queue } = await this.channel.assertQueue(queueName, { durable: true });
    
    // Bind queue to exchange with routing key
    await this.channel.bindQueue(queue, exchange, routingKey);
    
    // Consume messages
    await this.channel.consume(queue, (msg) => {
      if (msg) {
        try {
          const message: EventMessage = JSON.parse(msg.content.toString());
          callback(message);
          this.channel.ack(msg);
        } catch (error) {
          this.logger.error('Error processing message:', error);
          this.channel.nack(msg, false, false);
        }
      }
    });

    this.logger.log(`Subscribed to ${exchange}.${routingKey} on queue ${queueName}`);
  }

  async onModuleDestroy() {
    if (this.channel) {
      await this.channel.close();
    }
    if (this.connection) {
      await this.connection.close();
    }
  }
}