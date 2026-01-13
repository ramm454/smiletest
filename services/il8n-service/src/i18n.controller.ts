// src/i18n.controller.ts
import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  Headers,
  Req,
  UseGuards,
  UseInterceptors
} from '@nestjs/common';
import { I18nService } from './i18n.service';
import { LanguageDetectionGuard } from './i18n.guard';
import { TranslationInterceptor } from './interceptors/translation.interceptor';

@Controller('i18n')
@UseInterceptors(TranslationInterceptor)
export class I18nController {
  constructor(private readonly i18nService: I18nService) {}

  @Get('detect')
  async detectLanguage(@Req() request: any) {
    const lang = await this.i18nService.detectLanguage(request);
    return {
      detectedLanguage: lang,
      timestamp: new Date().toISOString(),
      method: 'auto-detection'
    };
  }

  @Post('translate')
  async translate(
    @Body() body: {
      text: string;
      targetLang: string;
      sourceLang?: string;
      context?: any;
    }
  ) {
    const translated = await this.i18nService.translate(
      body.text,
      body.targetLang,
      body.sourceLang,
      body.context
    );
    
    return {
      original: body.text,
      translated,
      targetLang: body.targetLang,
      sourceLang: body.sourceLang || 'auto-detected'
    };
  }

  @Post('translate-batch')
  async translateBatch(
    @Body() body: {
      texts: string[];
      targetLang: string;
      sourceLang?: string;
      context?: any;
    }
  ) {
    const translated = await this.i18nService.translateBatch(
      body.texts,
      body.targetLang,
      body.sourceLang,
      body.context
    );
    
    return {
      originals: body.texts,
      translated,
      targetLang: body.targetLang
    };
  }

  @Post('localize')
  async localize(
    @Body() body: {
      data: any;
      targetLang: string;
      formatOptions?: any;
    }
  ) {
    const localized = await this.i18nService.localize(
      body.data,
      body.targetLang,
      body.formatOptions
    );
    
    return {
      original: body.data,
      localized,
      targetLang: body.targetLang
    };
  }

  @Get('languages')
  async getLanguages(@Query('activeOnly') activeOnly: boolean = true) {
    const languages = await this.i18nService['prisma'].language.findMany({
      where: activeOnly ? { isActive: true } : undefined,
      orderBy: { name: 'asc' }
    });
    
    return {
      languages,
      count: languages.length,
      default: languages.find(l => l.isDefault)?.code || 'en'
    };
  }

  @Post('languages')
  async addLanguage(@Body() body: any) {
    const language = await this.i18nService['prisma'].language.create({
      data: body
    });
    
    return {
      message: 'Language added successfully',
      language
    };
  }

  @Get('services')
  async getServices() {
    const services = await this.i18nService['prisma'].serviceRegistry.findMany({
      where: { isActive: true }
    });
    
    return {
      services,
      count: services.length
    };
  }

  @Post('services/discover')
  async discoverServices() {
    await this.i18nService.autoDiscoverServices();
    
    return {
      message: 'Service discovery completed',
      timestamp: new Date().toISOString()
    };
  }

  @Post('train')
  async trainModel(@Body() body: any) {
    await this.i18nService.trainCustomModel(body.dataset, body.config);
    
    return {
      message: 'Training job started',
      timestamp: new Date().toISOString()
    };
  }

  @Get('health')
  async healthCheck() {
    const dbStatus = await this.i18nService['prisma'].$queryRaw`SELECT 1`;
    const aiStatus = this.i18nService['detectionModel'] ? 'loaded' : 'not-loaded';
    
    return {
      status: 'healthy',
      service: 'i18n-service',
      timestamp: new Date().toISOString(),
      database: dbStatus ? 'connected' : 'disconnected',
      aiModels: {
        detection: aiStatus,
        translation: aiStatus
      }
    };
  }
}