// Example: user-service/src/middleware/i18n.middleware.ts
import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import axios from 'axios';

@Injectable()
export class I18nMiddleware implements NestMiddleware {
  private i18nServiceUrl = process.env.I18N_SERVICE_URL || 'http://i18n-service:3000';

  async use(req: Request, res: Response, next: NextFunction) {
    try {
      // Detect language if not already set
      if (!req.headers['x-language']) {
        const response = await axios.post(`${this.i18nServiceUrl}/i18n/detect`, {
          headers: req.headers,
          ip: req.ip,
          body: req.body
        });
        
        req.headers['x-language'] = response.data.detectedLanguage;
      }
      
      // Store language in request for controllers
      req['language'] = req.headers['x-language'];
      
      // Set response language header
      res.setHeader('Content-Language', req['language']);
      
    } catch (error) {
      // Fallback to default language
      req['language'] = 'en';
      req.headers['x-language'] = 'en';
    }
    
    next();
  }
}