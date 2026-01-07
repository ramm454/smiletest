import { Injectable, HttpException } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';

@Injectable()
export class GatewayService {
  private serviceUrls = {
    'users': process.env.USER_SERVICE_URL || 'http://user-service:3001',
    'bookings': process.env.BOOKING_SERVICE_URL || 'http://booking-service:3002',
    'yoga': process.env.YOGA_SERVICE_URL || 'http://yoga-service:3003',
    'live': process.env.LIVE_SERVICE_URL || 'http://live-service:3004',
    'ecommerce': process.env.ECOMMERCE_SERVICE_URL || 'http://ecommerce-service:3005',
    'notifications': process.env.NOTIFICATION_SERVICE_URL || 'http://notification-service:3006',
    'analytics': process.env.ANALYTICS_SERVICE_URL || 'http://analytics-service:3007',
    'ai': process.env.AI_GATEWAY_URL || 'http://ai-gateway:8001',
    'payment': process.env.PAYMENT_SERVICE_URL || 'http://payment-service:3008',
  };

  constructor(private readonly httpService: HttpService) {}

  async proxyRequest(service: string, path: string, data: any, authHeader?: string) {
    const url = `${this.serviceUrls[service]}${path}`;

    const headers = {
      'Content-Type': 'application/json',
      ...(authHeader && { 'Authorization': authHeader }),
    };

    try {
      // Validate token for protected routes
      if (authHeader && !path.includes('/health') && !path.includes('/public')) {
        const token = authHeader.replace('Bearer ', '');
        const isValid = await this.validateToken(token);
        
        if (!isValid) {
          throw new HttpException('Unauthorized', 401);
        }
      }

      const response = await firstValueFrom(
        this.httpService.request({
          method: 'POST',
          url,
          data,
          headers,
          timeout: 10000,
        })
      );

      return response.data;
    } catch (error) {
      throw new HttpException(
        error.response?.data || 'Service unavailable',
        error.response?.status || 500
      );
    }
  }

  async proxyGet(service: string, path: string, query: any, authHeader?: string) {
    const url = `${this.serviceUrls[service]}${path}`;
    
    const headers = {
      'Content-Type': 'application/json',
      ...(authHeader && { 'Authorization': authHeader }),
    };

    try {
      // Validate token for protected routes
      if (authHeader && !path.includes('/health') && !path.includes('/public')) {
        const token = authHeader.replace('Bearer ', '');
        const isValid = await this.validateToken(token);
        
        if (!isValid) {
          throw new HttpException('Unauthorized', 401);
        }
      }

      const response = await firstValueFrom(
        this.httpService.request({
          method: 'GET',
          url,
          params: query,
          headers,
          timeout: 10000,
        })
      );

      return response.data;
    } catch (error) {
      throw new HttpException(
        error.response?.data || 'Service unavailable',
        error.response?.status || 500
      );
    }
  }

  async proxyPut(service: string, path: string, data: any, authHeader?: string) {
    const url = `${this.serviceUrls[service]}${path}`;

    const headers = {
      'Content-Type': 'application/json',
      ...(authHeader && { 'Authorization': authHeader }),
    };

    try {
      // Validate token for protected routes
      if (authHeader && !path.includes('/health')) {
        const token = authHeader.replace('Bearer ', '');
        const isValid = await this.validateToken(token);
        
        if (!isValid) {
          throw new HttpException('Unauthorized', 401);
        }
      }

      const response = await firstValueFrom(
        this.httpService.request({
          method: 'PUT',
          url,
          data,
          headers,
          timeout: 10000,
        })
      );

      return response.data;
    } catch (error) {
      throw new HttpException(
        error.response?.data || 'Service unavailable',
        error.response?.status || 500
      );
    }
  }

  async proxyDelete(service: string, path: string, authHeader?: string) {
    const url = `${this.serviceUrls[service]}${path}`;

    const headers = {
      'Content-Type': 'application/json',
      ...(authHeader && { 'Authorization': authHeader }),
    };

    try {
      // Validate token for protected routes
      if (authHeader && !path.includes('/health')) {
        const token = authHeader.replace('Bearer ', '');
        const isValid = await this.validateToken(token);
        
        if (!isValid) {
          throw new HttpException('Unauthorized', 401);
        }
      }

      const response = await firstValueFrom(
        this.httpService.request({
          method: 'DELETE',
          url,
          headers,
          timeout: 10000,
        })
      );

      return response.data;
    } catch (error) {
      throw new HttpException(
        error.response?.data || 'Service unavailable',
        error.response?.status || 500
      );
    }
  }

  async healthCheck() {
    const services = Object.keys(this.serviceUrls);
    const healthStatus = {};

    for (const service of services) {
      try {
        const response = await firstValueFrom(
          this.httpService.get(`${this.serviceUrls[service]}/health`, { timeout: 5000 })
        );
        
        healthStatus[service] = {
          status: 'healthy',
          responseTime: response.headers['x-response-time'],
          timestamp: new Date().toISOString(),
        };
      } catch (error) {
        healthStatus[service] = {
          status: 'unhealthy',
          error: error.message,
          timestamp: new Date().toISOString(),
        };
      }
    }

    return {
      gateway: 'healthy',
      timestamp: new Date().toISOString(),
      services: healthStatus,
    };
  }

  async validateToken(token: string): Promise<boolean> {
    try {
      const response = await firstValueFrom(
        this.httpService.post(
          `${this.serviceUrls['users']}/users/validate-token`,
          { token },
          { timeout: 5000 }
        )
      );

      return response.data.valid;
    } catch (error) {
      return false;
    }
  }

  async getUserFromToken(token: string): Promise<any> {
    try {
      const response = await firstValueFrom(
        this.httpService.post(
          `${this.serviceUrls['users']}/users/validate-token`,
          { token },
          { timeout: 5000 }
        )
      );

      return response.data.user;
    } catch (error) {
      return null;
    }
  }

  // Composite endpoints
  async getUserDashboard(userId: string) {
    const [user, bookings, orders, subscriptions] = await Promise.all([
      this.proxyGet('users', `/users/profile`, {}, `Bearer ${this.generateSystemToken()}`),
      this.proxyGet('bookings', `/bookings/user/${userId}`, { upcoming: true, limit: 5 }, `Bearer ${this.generateSystemToken()}`),
      this.proxyGet('ecommerce', `/ecommerce/orders`, { limit: 5 }, `Bearer ${this.generateSystemToken()}`),
      this.proxyGet('ecommerce', `/ecommerce/subscriptions`, {}, `Bearer ${this.generateSystemToken()}`),
    ]);

    return {
      user,
      recentBookings: bookings.bookings || [],
      recentOrders: orders.orders || [],
      activeSubscription: subscriptions[0] || null,
    };
  }

  async getAdminDashboard() {
    const [userStats, bookingStats, salesStats, liveStats] = await Promise.all([
      this.proxyGet('users', `/users/admin/stats`, {}, `Bearer ${this.generateSystemToken()}`),
      this.proxyGet('bookings', `/bookings/stats/summary`, {}, `Bearer ${this.generateSystemToken()}`),
      this.proxyGet('ecommerce', `/ecommerce/analytics/sales`, { groupBy: 'day' }, `Bearer ${this.generateSystemToken()}`),
      this.proxyGet('live', `/live/sessions`, { status: 'LIVE' }, `Bearer ${this.generateSystemToken()}`),
    ]);

    return {
      userStats,
      bookingStats,
      salesStats,
      liveSessions: liveStats.sessions || [],
    };
  }

  private generateSystemToken(): string {
    // Generate a system token for internal service communication
    // This should be stored securely in environment variables
    const systemToken = process.env.SYSTEM_TOKEN || 'system-token-secret';
    return systemToken;
  }
}