// src/interceptors/global-i18n.interceptor.ts
import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Inject
} from '@nestjs/common';
import { Observable, from } from 'rxjs';
import { map, switchMap } from 'rxjs/operators';
import { I18nService } from '../i18n.service';
import { ContextProcessorService } from '../modules/context/context-processor.service';

@Injectable()
export class GlobalI18nInterceptor implements NestInterceptor {
  constructor(
    private readonly i18nService: I18nService,
    private readonly contextProcessor: ContextProcessorService
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const response = context.switchToHttp().getResponse();
    
    // Detect language
    return from(this.i18nService.detectLanguage(request)).pipe(
      switchMap(async (language) => {
        request.language = language;
        response.setHeader('Content-Language', language);
        
        // Process request body for translation if needed
        if (request.body && this.shouldTranslateRequest(request)) {
          request.originalBody = JSON.parse(JSON.stringify(request.body));
          request.body = await this.translateRequestData(request.body, language, request);
        }
        
        return next.handle();
      }),
      switchMap(observable => observable.pipe(
        map(async (data) => {
          if (this.shouldTranslateResponse(data, request)) {
            return await this.translateResponseData(data, request.language, request);
          }
          return data;
        })
      ))
    );
  }

  private shouldTranslateRequest(request: any): boolean {
    // Don't translate binary uploads, file uploads, etc.
    if (request.headers['content-type']?.includes('multipart/form-data')) {
      return false;
    }
    
    // Only translate certain content types
    const translateContentTypes = [
      'application/json',
      'application/x-www-form-urlencoded'
    ];
    
    return translateContentTypes.some(type => 
      request.headers['content-type']?.includes(type)
    );
  }

  private shouldTranslateResponse(data: any, request: any): boolean {
    // Don't translate binary responses
    if (Buffer.isBuffer(data) || data instanceof Stream) {
      return false;
    }
    
    // Check if response should be translated based on endpoint
    const noTranslateEndpoints = [
      '/health',
      '/metrics',
      '/api-docs',
      '/internal/'
    ];
    
    const path = request.path;
    if (noTranslateEndpoints.some(endpoint => path.includes(endpoint))) {
      return false;
    }
    
    return true;
  }

  private async translateRequestData(data: any, targetLang: string, request: any): Promise<any> {
    if (typeof data === 'string') {
      return this.i18nService.translate(data, targetLang);
    }
    
    if (Array.isArray(data)) {
      return Promise.all(data.map(item => this.translateRequestData(item, targetLang, request)));
    }
    
    if (typeof data === 'object' && data !== null) {
      const translated: any = {};
      
      for (const [key, value] of Object.entries(data)) {
        if (this.isTranslatableField(key, value)) {
          translated[key] = await this.translateRequestData(value, targetLang, request);
        } else {
          translated[key] = value;
        }
      }
      
      return translated;
    }
    
    return data;
  }

  private async translateResponseData(data: any, targetLang: string, request: any): Promise<any> {
    // Analyze context
    const context = await this.contextProcessor.analyzeTextContext(
      JSON.stringify(data),
      {
        userLocation: request.headers['x-user-location'],
        userPreferences: request.headers['x-user-preferences']
      }
    );
    
    if (typeof data === 'string') {
      return this.i18nService.translate(data, targetLang, undefined, context);
    }
    
    if (Array.isArray(data)) {
      return Promise.all(data.map(item => this.translateResponseData(item, targetLang, request)));
    }
    
    if (typeof data === 'object' && data !== null) {
      const translated: any = {};
      
      for (const [key, value] of Object.entries(data)) {
        if (this.isTranslatableField(key, value)) {
          translated[key] = await this.translateResponseData(value, targetLang, request);
        } else {
          translated[key] = value;
        }
      }
      
      return translated;
    }
    
    return data;
  }

  private isTranslatableField(key: string, value: any): boolean {
    // Skip IDs, URLs, emails, etc.
    const nonTranslatable = [
      'id', '_id', 'uuid', 'url', 'uri', 'email', 'phone', 'password',
      'token', 'key', 'secret', 'hash', 'signature', 'createdAt',
      'updatedAt', 'deletedAt', 'timestamp', 'code', 'statusCode',
      'errorCode', 'version', 'count', 'total', 'limit', 'offset',
      'page', 'size', 'amount', 'price', 'cost', 'quantity'
    ];
    
    const nonTranslatablePatterns = [
      /_id$/i,
      /Id$/,
      /_at$/,
      /_url$/i,
      /_key$/i,
      /_token$/i
    ];
    
    if (nonTranslatable.includes(key.toLowerCase())) {
      return false;
    }
    
    if (nonTranslatablePatterns.some(pattern => pattern.test(key))) {
      return false;
    }
    
    // Only translate strings or objects/arrays containing strings
    return typeof value === 'string' || 
           (typeof value === 'object' && value !== null) ||
           Array.isArray(value);
  }
}