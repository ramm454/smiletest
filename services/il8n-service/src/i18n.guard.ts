// src/i18n.guard.ts
import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { Observable } from 'rxjs';
import { I18nService } from './i18n.service';

@Injectable()
export class LanguageDetectionGuard implements CanActivate {
  constructor(private readonly i18nService: I18nService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    
    // Detect language
    const detectedLang = await this.i18nService.detectLanguage(request);
    
    // Store language in request for use in controllers
    request.language = detectedLang;
    
    // Set response headers
    const response = context.switchToHttp().getResponse();
    response.setHeader('Content-Language', detectedLang);
    
    return true;
  }
}