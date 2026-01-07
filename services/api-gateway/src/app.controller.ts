import { Controller, Get, Post, Body } from '@nestjs/common';
import { AppService } from './app.service';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get('health')
  healthCheck() {
    return { status: 'ok', timestamp: new Date().toISOString() };
  }

  @Post('auth/login')
  async login(@Body() loginDto: { email: string; password: string }) {
    return this.appService.proxyRequest('user-service', 'auth/login', loginDto);
  }
}