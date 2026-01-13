import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

@Injectable()
export class GdprMiddleware implements NestMiddleware {
  async use(req: Request, res: Response, next: NextFunction) {
    // 1. Check for consent cookies
    const consentCookie = req.cookies['gdpr_consent'];
    
    if (!consentCookie && this.requiresConsent(req)) {
      // Redirect to consent page or add consent header
      req.headers['x-requires-consent'] = 'true';
    }
    
    // 2. Log data processing for ROPA
    await this.logProcessingActivity(req);
    
    // 3. Check for data minimization
    this.applyDataMinimization(req);
    
    // 4. Add GDPR headers
    res.setHeader('X-Data-Controller', 'Yoga Spa Platform Ltd.');
    res.setHeader('X-DPO-Contact', 'dpo@yogaspa.com');
    res.setHeader('X-Data-Retention', 'See privacy policy');
    
    next();
  }
  
  private requiresConsent(req: Request): boolean {
    // Check if endpoint requires consent
    const consentRequiredEndpoints = [
      '/analytics',
      '/marketing',
      '/tracking',
      '/profiling'
    ];
    
    return consentRequiredEndpoints.some(endpoint => 
      req.path.includes(endpoint)
    );
  }
  
  private async logProcessingActivity(req: Request): Promise<void> {
    // Log for Records of Processing Activities
    await prisma.userActivity.create({
      data: {
        userId: req.headers['x-user-id'] as string || 'anonymous',
        activityType: 'data_processing',
        entityType: 'request',
        entityId: req.method + ' ' + req.path,
        metadata: {
          method: req.method,
          path: req.path,
          query: req.query,
          userAgent: req.headers['user-agent'],
          ipAddress: req.ip,
          timestamp: new Date().toISOString(),
          purpose: this.getProcessingPurpose(req)
        },
        createdAt: new Date()
      }
    });
  }
  
  private getProcessingPurpose(req: Request): string {
    if (req.path.includes('/booking')) return 'service_provisioning';
    if (req.path.includes('/payment')) return 'contract_fulfillment';
    if (req.path.includes('/profile')) return 'account_management';
    if (req.path.includes('/analytics')) return 'analytics';
    return 'service_operation';
  }
  
  private applyDataMinimization(req: Request): void {
    // Remove unnecessary data from request
    if (req.body) {
      // Only keep fields that are necessary for the operation
      const allowedFields = this.getAllowedFieldsForEndpoint(req.method, req.path);
      
      Object.keys(req.body).forEach(key => {
        if (!allowedFields.includes(key)) {
          delete req.body[key];
        }
      });
    }
  }
  
  private getAllowedFieldsForEndpoint(method: string, path: string): string[] {
    // Define minimum necessary fields for each endpoint
    const fieldMaps = {
      'POST /users/register': ['email', 'password', 'firstName', 'lastName'],
      'PUT /users/profile': ['firstName', 'lastName', 'phone', 'preferences'],
      // ... other endpoints
    };
    
    return fieldMaps[`${method} ${path}`] || [];
  }
}