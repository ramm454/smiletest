import { Controller, Get, Post, Body, Param, Query, Headers } from '@nestjs/common';
import { GatewayService } from './gateway.service';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';

@Controller()
@ApiTags('API Gateway')
export class GatewayController {
  constructor(private readonly gatewayService: GatewayService) {}

  @Get('health')
  @ApiOperation({ summary: 'Health check for API gateway' })
  async healthCheck() {
    return {
      status: 'healthy',
      service: 'api-gateway',
      timestamp: new Date().toISOString(),
      version: process.env.npm_package_version || '1.0.0'
    };
  }

  @Post('auth/login')
  @ApiOperation({ summary: 'User login' })
  async login(@Body() loginDto: { email: string; password: string }) {
    return this.gatewayService.proxyRequest('user-service', '/auth/login', loginDto);
  }

  @Post('auth/register')
  @ApiOperation({ summary: 'User registration' })
  async register(@Body() registerDto: any) {
    return this.gatewayService.proxyRequest('user-service', '/auth/register', registerDto);
  }

  @Get('yoga/classes')
  @ApiOperation({ summary: 'Get yoga classes' })
  async getClasses(
    @Query('date') date: string,
    @Query('type') type: string,
    @Query('difficulty') difficulty: string
  ) {
    return this.gatewayService.proxyRequest('yoga-service', '/classes', { date, type, difficulty });
  }

  @Post('bookings')
  @ApiOperation({ summary: 'Create a booking' })
  async createBooking(@Body() bookingDto: any, @Headers('authorization') auth: string) {
    return this.gatewayService.proxyRequest('booking-service', '/bookings', bookingDto, auth);
  }

  @Post('payments/create-intent')
  @ApiOperation({ summary: 'Create payment intent' })
  async createPaymentIntent(@Body() paymentDto: any, @Headers('authorization') auth: string) {
    return this.gatewayService.proxyRequest('payment-service', '/payments/intent', paymentDto, auth);
  }

  @Get('ai/chat')
  @ApiOperation({ summary: 'Chat with AI assistant' })
  async chatWithAI(
    @Query('message') message: string,
    @Query('context') context: string,
    @Headers('authorization') auth: string
  ) {
    return this.gatewayService.proxyRequest('ai-gateway', '/chat', { message, context }, auth);
  }

  // Catch-all route for service-specific endpoints
  @Get(':service/*')
  async proxyGet(
    @Param('service') service: string,
    @Headers() headers: Record<string, string>,
    @Query() query: Record<string, any>
  ) {
    return this.gatewayService.proxyRequest(service, '', query, headers.authorization);
  }

  @Post(':service/*')
  async proxyPost(
    @Param('service') service: string,
    @Body() body: any,
    @Headers() headers: Record<string, string>
  ) {
    return this.gatewayService.proxyRequest(service, '', body, headers.authorization);
  }
}