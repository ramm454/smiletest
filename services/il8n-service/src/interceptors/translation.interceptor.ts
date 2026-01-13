// src/interceptors/translation.interceptor.ts
import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { I18nService } from '../i18n.service';

@Injectable()
export class TranslationInterceptor implements NestInterceptor {
  constructor(private readonly i18nService: I18nService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const targetLang = request.language || 'en';
    
    return next.handle().pipe(
      map(async (data) => {
        // Only translate if it's a successful response
        if (data && typeof data === 'object') {
          return await this.translateResponse(data, targetLang);
        }
        return data;
      })
    );
  }

  private async translateResponse(data: any, targetLang: string): Promise<any> {
    if (Array.isArray(data)) {
      return Promise.all(data.map(item => this.translateObject(item, targetLang)));
    }
    return this.translateObject(data, targetLang);
  }

  private async translateObject(obj: any, targetLang: string): Promise<any> {
    const translated = { ...obj };
    
    for (const key in obj) {
      if (typeof obj[key] === 'string' && this.isTranslatableKey(key)) {
        translated[key] = await this.i18nService.translate(
          obj[key],
          targetLang,
          undefined,
          { field: key, context: 'response' }
        );
      } else if (typeof obj[key] === 'object' && obj[key] !== null) {
        translated[key] = await this.translateObject(obj[key], targetLang);
      }
    }
    
    return translated;
  }

  private isTranslatableKey(key: string): boolean {
    const nonTranslatable = ['id', 'code', 'url', 'email', 'phone', 'createdAt', 'updatedAt'];
    return !nonTranslatable.includes(key) &&
           !key.endsWith('Id') &&
           !key.includes('_id') &&
           !key.startsWith('$');
  }
}