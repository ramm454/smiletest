import { Injectable, NestMiddleware, UnauthorizedException } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import axios from 'axios';

@Injectable()
export class AuthMiddleware implements NestMiddleware {
  private userServiceUrl = process.env.USER_SERVICE_URL || 'http://user-service:3001';

  async use(req: Request, res: Response, next: NextFunction) {
    // Skip auth for public endpoints
    if (this.isPublicEndpoint(req.path)) {
      return next();
    }

    // Get token from headers
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedException('No token provided');
    }

    const token = authHeader.substring(7);

    try {
      // Validate token with User Service
      const response = await axios.post(
        `${this.userServiceUrl}/users/validate-token`,
        { token },
        { timeout: 5000 }
      );

      if (!response.data.valid) {
        throw new UnauthorizedException('Invalid token');
      }

      // Add user info to request
      req['user'] = response.data.user;
      req['userId'] = response.data.user.id;
      req['userRoles'] = response.data.user.roles || [];

      next();
    } catch (error) {
      if (error.response?.status === 401) {
        throw new UnauthorizedException('Invalid token');
      }
      throw new UnauthorizedException('Authentication service unavailable');
    }
  }

  private isPublicEndpoint(path: string): boolean {
    const publicEndpoints = [
      '/health',
      '/metrics',
      '/api-docs',
      '/auth/login',
      '/auth/register',
      '/users/verify-email',
      '/users/reset-password'
    ];

    return publicEndpoints.some(endpoint => path.includes(endpoint));
  }
}