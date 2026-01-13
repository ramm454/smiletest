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
    'staff': process.env.STAFF_SERVICE_URL || 'http://staff-service:3010',
    'i18n': process.env.I18N_SERVICE_URL || 'http://i18n-service:3000', // Added i18n service
  };

  constructor(private readonly httpService: HttpService) {}

  async proxyRequest(service: string, path: string, data: any, authHeader?: string, language?: string) {
    const url = `${this.serviceUrls[service]}${path}`;

    const headers = {
      'Content-Type': 'application/json',
      ...(authHeader && { 'Authorization': authHeader }),
      ...(language && { 'x-language': language }), // Add language header
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

  async proxyGet(service: string, path: string, query: any, authHeader?: string, language?: string) {
    const url = `${this.serviceUrls[service]}${path}`;
    
    const headers = {
      'Content-Type': 'application/json',
      ...(authHeader && { 'Authorization': authHeader }),
      ...(language && { 'x-language': language }), // Add language header
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

  async proxyPut(service: string, path: string, data: any, authHeader?: string, language?: string) {
    const url = `${this.serviceUrls[service]}${path}`;

    const headers = {
      'Content-Type': 'application/json',
      ...(authHeader && { 'Authorization': authHeader }),
      ...(language && { 'x-language': language }), // Add language header
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

  async proxyDelete(service: string, path: string, authHeader?: string, language?: string) {
    const url = `${this.serviceUrls[service]}${path}`;

    const headers = {
      'Content-Type': 'application/json',
      ...(authHeader && { 'Authorization': authHeader }),
      ...(language && { 'x-language': language }), // Add language header
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

  // i18n-specific proxy methods
  async proxyI18nGet(path: string, query: any, authHeader?: string, language?: string) {
    return this.proxyGet('i18n', path, query, authHeader, language);
  }

  async proxyI18nPost(path: string, data: any, authHeader?: string, language?: string) {
    return this.proxyRequest('i18n', path, data, authHeader, language);
  }

  async proxyI18nPut(path: string, data: any, authHeader?: string, language?: string) {
    return this.proxyPut('i18n', path, data, authHeader, language);
  }

  async proxyI18nDelete(path: string, authHeader?: string, language?: string) {
    return this.proxyDelete('i18n', path, authHeader, language);
  }

  // Language detection methods
  async detectLanguage(text?: string, headers?: Record<string, string>): Promise<string> {
    try {
      const query: any = {};
      if (text) {
        query.text = text;
      }

      const response = await this.proxyI18nGet('/i18n/detect', query);
      
      if (response && response.language) {
        return response.language;
      }
      
      // Fallback to header detection or default
      const acceptLanguage = headers?.['accept-language'];
      if (acceptLanguage) {
        return acceptLanguage.split(',')[0].split(';')[0];
      }
      
      return process.env.DEFAULT_LANGUAGE || 'en';
    } catch (error) {
      console.error('Language detection failed:', error);
      return process.env.DEFAULT_LANGUAGE || 'en';
    }
  }

  async detectLanguageFromRequest(request: any): Promise<string> {
    const headers = request.headers || {};
    const query = request.query || {};
    const body = request.body || {};
    
    // Check query parameter first
    if (query.language) {
      return query.language;
    }
    
    // Check body parameter
    if (body.language) {
      return body.language;
    }
    
    // Use text from body for detection if available
    if (body.text) {
      return this.detectLanguage(body.text, headers);
    }
    
    // Use headers for detection
    return this.detectLanguage(undefined, headers);
  }

  // Translation methods
  async translateText(text: string, targetLanguage: string, sourceLanguage?: string, authHeader?: string): Promise<string> {
    try {
      const response = await this.proxyI18nPost('/i18n/translate', {
        text,
        targetLanguage,
        sourceLanguage,
      }, authHeader);

      return response.translatedText || text;
    } catch (error) {
      console.error('Translation failed:', error);
      return text; // Return original text if translation fails
    }
  }

  async translateObject(obj: any, targetLanguage: string, sourceLanguage?: string, authHeader?: string): Promise<any> {
    try {
      const response = await this.proxyI18nPost('/i18n/translate/object', {
        object: obj,
        targetLanguage,
        sourceLanguage,
      }, authHeader);

      return response.translatedObject || obj;
    } catch (error) {
      console.error('Object translation failed:', error);
      return obj;
    }
  }

  // Service-specific proxy methods with language support
  async proxyLiveRequest(path: string, data: any, authHeader?: string, language?: string) {
    return this.proxyRequest('live', path, data, authHeader, language);
  }

  async proxyLiveGet(path: string, query: any, authHeader?: string, language?: string) {
    return this.proxyGet('live', path, query, authHeader, language);
  }

  async proxyLivePut(path: string, data: any, authHeader?: string, language?: string) {
    return this.proxyPut('live', path, data, authHeader, language);
  }

  async proxyLiveDelete(path: string, authHeader?: string, language?: string) {
    return this.proxyDelete('live', path, authHeader, language);
  }

  // Ecommerce-specific proxy methods with language support
  async proxyEcommerceRequest(path: string, data: any, authHeader?: string, language?: string) {
    return this.proxyRequest('ecommerce', path, data, authHeader, language);
  }

  async proxyEcommerceGet(path: string, query: any, authHeader?: string, language?: string) {
    return this.proxyGet('ecommerce', path, query, authHeader, language);
  }

  async proxyEcommercePut(path: string, data: any, authHeader?: string, language?: string) {
    return this.proxyPut('ecommerce', path, data, authHeader, language);
  }

  async proxyEcommerceDelete(path: string, authHeader?: string, language?: string) {
    return this.proxyDelete('ecommerce', path, authHeader, language);
  }

  // Notification-specific proxy methods with language support
  async proxyNotificationRequest(path: string, data: any, authHeader?: string, language?: string) {
    return this.proxyRequest('notifications', path, data, authHeader, language);
  }

  async proxyNotificationGet(path: string, query: any, authHeader?: string, language?: string) {
    return this.proxyGet('notifications', path, query, authHeader, language);
  }

  async proxyNotificationPut(path: string, data: any, authHeader?: string, language?: string) {
    return this.proxyPut('notifications', path, data, authHeader, language);
  }

  async proxyNotificationDelete(path: string, authHeader?: string, language?: string) {
    return this.proxyDelete('notifications', path, authHeader, language);
  }

  // User-specific proxy methods with language support
  async proxyUserRequest(path: string, data: any, authHeader?: string, language?: string) {
    return this.proxyRequest('users', path, data, authHeader, language);
  }

  async proxyUserGet(path: string, query: any, authHeader?: string, language?: string) {
    return this.proxyGet('users', path, query, authHeader, language);
  }

  async proxyUserPut(path: string, data: any, authHeader?: string, language?: string) {
    return this.proxyPut('users', path, data, authHeader, language);
  }

  async proxyUserDelete(path: string, authHeader?: string, language?: string) {
    return this.proxyDelete('users', path, authHeader, language);
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

  // Composite endpoints with language support

  // User composite endpoints
  async getUserDashboard(userId: string, language?: string) {
    const [user, bookings, orders, subscriptions, notifications] = await Promise.all([
      this.proxyGet('users', `/users/profile`, {}, `Bearer ${this.generateSystemToken()}`, language),
      this.proxyGet('bookings', `/bookings/user/${userId}`, { upcoming: true, limit: 5 }, `Bearer ${this.generateSystemToken()}`, language),
      this.proxyGet('ecommerce', `/ecommerce/orders`, { limit: 5 }, `Bearer ${this.generateSystemToken()}`, language),
      this.proxyGet('ecommerce', `/ecommerce/subscriptions`, {}, `Bearer ${this.generateSystemToken()}`, language),
      this.proxyNotificationGet('/notifications', { userId, unreadOnly: true, limit: 5 }, `Bearer ${this.generateSystemToken()}`, language),
    ]);

    return {
      user,
      recentBookings: bookings.bookings || [],
      recentOrders: orders.orders || [],
      activeSubscription: subscriptions[0] || null,
      recentNotifications: notifications.notifications || [],
    };
  }

  // Admin composite endpoints
  async getAdminDashboard(language?: string) {
    const [userStats, bookingStats, salesStats, liveStats, notificationStats] = await Promise.all([
      this.proxyGet('users', `/users/admin/stats`, {}, `Bearer ${this.generateSystemToken()}`, language),
      this.proxyGet('bookings', `/bookings/stats/summary`, {}, `Bearer ${this.generateSystemToken()}`, language),
      this.proxyGet('ecommerce', `/ecommerce/analytics/sales`, { groupBy: 'day' }, `Bearer ${this.generateSystemToken()}`, language),
      this.proxyGet('live', `/live/sessions`, { status: 'LIVE' }, `Bearer ${this.generateSystemToken()}`, language),
      this.proxyNotificationGet('/notifications/stats', {}, `Bearer ${this.generateSystemToken()}`, language),
    ]);

    return {
      userStats,
      bookingStats,
      salesStats,
      liveSessions: liveStats.sessions || [],
      notificationStats,
    };
  }

  // Ecommerce composite endpoints
  async getEcommerceDashboard(language?: string) {
    const [products, orders, revenue, lowStock] = await Promise.all([
      this.proxyGet('ecommerce', '/ecommerce/products', { limit: 5 }, `Bearer ${this.generateSystemToken()}`, language),
      this.proxyGet('ecommerce', '/ecommerce/orders', { limit: 10 }, `Bearer ${this.generateSystemToken()}`, language),
      this.proxyGet('ecommerce', '/ecommerce/analytics/sales', { groupBy: 'day' }, `Bearer ${this.generateSystemToken()}`, language),
      this.proxyGet('ecommerce', '/ecommerce/inventory/low-stock', {}, `Bearer ${this.generateSystemToken()}`, language),
    ]);

    return {
      recentProducts: products.products || [],
      recentOrders: orders.orders || [],
      revenueAnalytics: revenue,
      lowStockAlerts: lowStock,
    };
  }

  async getUserEcommerceData(userId: string, language?: string) {
    const [orders, wishlist, cart] = await Promise.all([
      this.proxyGet('ecommerce', '/ecommerce/orders', { userId, limit: 5 }, `Bearer ${this.generateSystemToken()}`, language),
      this.proxyGet('ecommerce', '/ecommerce/wishlist', { userId }, `Bearer ${this.generateSystemToken()}`, language),
      this.proxyGet('ecommerce', '/ecommerce/cart', { userId }, `Bearer ${this.generateSystemToken()}`, language),
    ]);

    return {
      orders: orders.orders || [],
      wishlist: wishlist.items || [],
      cart: cart,
    };
  }

  async getProductDetailsWithReviews(productId: string, authHeader?: string, language?: string) {
    const [product, reviews, relatedProducts] = await Promise.all([
      this.proxyGet('ecommerce', `/ecommerce/products/${productId}`, {}, authHeader, language),
      this.proxyGet('ecommerce', `/ecommerce/products/${productId}/reviews`, { limit: 10 }, authHeader, language),
      this.proxyGet('ecommerce', `/ecommerce/products/related/${productId}`, { limit: 4 }, authHeader, language),
    ]);

    return {
      product,
      reviews: reviews.reviews || [],
      relatedProducts: relatedProducts.products || [],
    };
  }

  async getOrderWithDetails(orderId: string, authHeader?: string, language?: string) {
    const [order, items, shipping, payment] = await Promise.all([
      this.proxyGet('ecommerce', `/ecommerce/orders/${orderId}`, {}, authHeader, language),
      this.proxyGet('ecommerce', `/ecommerce/orders/${orderId}/items`, {}, authHeader, language),
      this.proxyGet('ecommerce', `/ecommerce/orders/${orderId}/shipping`, {}, authHeader, language),
      this.proxyGet('payment', `/payment/transactions/order/${orderId}`, {}, authHeader, language),
    ]);

    return {
      order,
      items: items.items || [],
      shipping,
      payment,
    };
  }

  // Live service composite endpoints
  async getLiveSessionDetails(sessionId: string, authHeader?: string, language?: string) {
    const [session, participants, recordings] = await Promise.all([
      this.proxyGet('live', `/live/sessions/${sessionId}`, {}, authHeader, language),
      this.proxyGet('live', `/live/sessions/${sessionId}/participants`, {}, authHeader, language),
      this.proxyGet('live', `/live/sessions/${sessionId}/recordings`, {}, authHeader, language),
    ]);

    return {
      session,
      participants,
      recordings,
    };
  }

  async getUserLiveSessions(userId: string, authHeader?: string, language?: string) {
    const [hostedSessions, attendedSessions, upcomingSessions] = await Promise.all([
      this.proxyGet('live', `/live/sessions`, { hostId: userId }, authHeader, language),
      this.proxyGet('live', `/live/sessions`, { participantId: userId, past: true }, authHeader, language),
      this.proxyGet('live', `/live/sessions`, { participantId: userId, upcoming: true }, authHeader, language),
    ]);

    return {
      hostedSessions: hostedSessions.sessions || [],
      attendedSessions: attendedSessions.sessions || [],
      upcomingSessions: upcomingSessions.sessions || [],
    };
  }

  async getLiveSessionAnalytics(sessionId: string, authHeader?: string, language?: string) {
    const [basicAnalytics, participantAnalytics, engagementAnalytics] = await Promise.all([
      this.proxyGet('live', `/live/sessions/${sessionId}/analytics`, {}, authHeader, language),
      this.proxyGet('live', `/live/sessions/${sessionId}/analytics/participants`, {}, authHeader, language),
      this.proxyGet('analytics', `/analytics/live/engagement/${sessionId}`, {}, authHeader, language),
    ]);

    return {
      basicAnalytics,
      participantAnalytics,
      engagementAnalytics,
    };
  }

  async createLiveSessionWithResources(sessionData: any, authHeader: string, language?: string) {
    // First create the live session
    const session = await this.proxyLiveRequest('/live/sessions', sessionData, authHeader, language);
    
    // If there are resources, create them
    if (sessionData.resources && sessionData.resources.length > 0) {
      const resources = await Promise.all(
        sessionData.resources.map(resource => 
          this.proxyLiveRequest(`/live/sessions/${session.id}/resources`, resource, authHeader, language)
        )
      );
      
      return {
        ...session,
        resources,
      };
    }
    
    return session;
  }

  async joinLiveSession(sessionId: string, userId: string, authHeader: string, language?: string) {
    // Join the session
    const joinResponse = await this.proxyLiveRequest(
      `/live/sessions/${sessionId}/join`,
      { userId },
      authHeader,
      language
    );

    // Get session details for the user
    const sessionDetails = await this.getLiveSessionDetails(sessionId, authHeader, language);

    // Get user permissions
    const userPermissions = await this.proxyGet(
      'users',
      `/users/${userId}/permissions`,
      { service: 'live', resource: `session:${sessionId}` },
      authHeader,
      language
    );

    return {
      ...joinResponse,
      session: sessionDetails.session,
      permissions: userPermissions,
    };
  }

  // Cross-service composite endpoints
  async getCompleteUserProfile(userId: string, authHeader?: string, language?: string) {
    const [userProfile, userEcommerceData, userLiveSessions, notificationPreferences] = await Promise.all([
      this.proxyGet('users', `/users/${userId}/profile`, {}, authHeader, language),
      this.getUserEcommerceData(userId, language),
      this.getUserLiveSessions(userId, authHeader, language),
      this.proxyNotificationGet('/preferences', { userId }, authHeader, language),
    ]);

    return {
      ...userProfile,
      ecommerce: userEcommerceData,
      liveSessions: userLiveSessions,
      notificationPreferences,
    };
  }

  // Notification composite endpoints
  async getUserNotifications(userId: string, authHeader?: string, language?: string) {
    const [notifications, preferences, unreadCount] = await Promise.all([
      this.proxyNotificationGet('/notifications', { userId, limit: 20 }, authHeader, language),
      this.proxyNotificationGet('/preferences', { userId }, authHeader, language),
      this.proxyNotificationGet('/notifications/count', { userId, unreadOnly: true }, authHeader, language),
    ]);

    return {
      notifications: notifications.notifications || [],
      preferences,
      unreadCount: unreadCount.count || 0,
    };
  }

  async markNotificationsAsRead(notificationIds: string[], authHeader: string, language?: string) {
    return this.proxyNotificationPut('/notifications/mark-read', { notificationIds }, authHeader, language);
  }

  async deleteNotifications(notificationIds: string[], authHeader: string, language?: string) {
    return this.proxyNotificationDelete('/notifications', authHeader, language, { notificationIds });
  }

  async sendBulkNotifications(notificationData: {
    userIds: string[];
    title: string;
    message: string;
    type: string;
    metadata?: any;
  }, authHeader: string, language?: string) {
    return this.proxyNotificationRequest('/notifications/bulk', notificationData, authHeader, language);
  }

  async testNotificationEndpoint(testData: { type: string; userId: string }, authHeader: string, language?: string) {
    return this.proxyNotificationRequest('/test', testData, authHeader, language);
  }

  // i18n composite endpoints
  async getSupportedLanguages(): Promise<string[]> {
    try {
      const response = await this.proxyI18nGet('/i18n/languages', {});
      return response.languages || ['en'];
    } catch (error) {
      console.error('Failed to get supported languages:', error);
      return ['en'];
    }
  }

  async getTranslations(language: string, namespace?: string): Promise<any> {
    try {
      const query = namespace ? { namespace } : {};
      const response = await this.proxyI18nGet(`/i18n/translations/${language}`, query);
      return response.translations || {};
    } catch (error) {
      console.error('Failed to get translations:', error);
      return {};
    }
  }

  async updateTranslations(language: string, translations: any, authHeader: string): Promise<any> {
    return this.proxyI18nPut(`/i18n/translations/${language}`, { translations }, authHeader);
  }

  async addLanguage(language: string, authHeader: string): Promise<any> {
    return this.proxyI18nPost('/i18n/languages', { language }, authHeader);
  }

  async removeLanguage(language: string, authHeader: string): Promise<any> {
    return this.proxyI18nDelete(`/i18n/languages/${language}`, authHeader);
  }

  private generateSystemToken(): string {
    // Generate a system token for internal service communication
    const systemToken = process.env.SYSTEM_TOKEN || 'system-token-secret';
    return systemToken;
  }

  // Helper method to add language to all downstream requests
  private getLanguageFromRequest(request: any): string {
    return request.language || 
           request.headers?.['x-language'] || 
           request.headers?.['accept-language']?.split(',')[0]?.split(';')[0] ||
           process.env.DEFAULT_LANGUAGE || 
           'en';
  }
}