import { Controller, Get, Post, Body, Param, Query, Headers, UseGuards } from '@nestjs/common';
import { GatewayService } from './gateway.service';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { AuthGuard } from './guards/auth.guard';

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

  // Payment endpoints
  @Post('payments/refund')
  @ApiOperation({ summary: 'Create refund' })
  async createRefund(@Body() refundDto: any, @Headers('authorization') auth: string) {
    return this.gatewayService.proxyRequest('payment', '/payments/refund', refundDto, auth);
  }

  @Post('subscriptions')
  @ApiOperation({ summary: 'Create subscription' })
  async createSubscription(@Body() subscriptionDto: any, @Headers('authorization') auth: string) {
    return this.gatewayService.proxyRequest('payment', '/subscriptions', subscriptionDto, auth);
  }

  @Post('subscriptions/:id/cancel')
  @ApiOperation({ summary: 'Cancel subscription' })
  async cancelSubscription(@Param('id') id: string, @Headers('authorization') auth: string) {
    return this.gatewayService.proxyRequest('payment', `/subscriptions/${id}/cancel`, {}, auth);
  }

  @Get('invoices/user/:user_id')
  @ApiOperation({ summary: 'Get user invoices' })
  async getUserInvoices(@Param('user_id') userId: string, @Headers('authorization') auth: string) {
    return this.gatewayService.proxyRequest('payment', `/invoices/user/${userId}`, {}, auth);
  }

  // Ecommerce endpoints
  @Get('ecommerce/products')
  @ApiOperation({ summary: 'Get products' })
  async getProducts(@Query() query: any) {
    return this.gatewayService.proxyGet('ecommerce', '/ecommerce/products', query);
  }

  @Get('ecommerce/products/:id')
  @ApiOperation({ summary: 'Get product by ID' })
  async getProduct(@Param('id') id: string) {
    return this.gatewayService.proxyGet('ecommerce', `/ecommerce/products/${id}`, {});
  }

  @Post('ecommerce/cart')
  @ApiOperation({ summary: 'Add to cart' })
  async addToCart(@Body() cartData: any, @Headers('authorization') auth: string) {
    return this.gatewayService.proxyRequest('ecommerce', '/ecommerce/cart/items', cartData, auth);
  }

  @Post('ecommerce/orders')
  @ApiOperation({ summary: 'Create order' })
  async createOrder(@Body() orderData: any, @Headers('authorization') auth: string) {
    return this.gatewayService.proxyRequest('ecommerce', '/ecommerce/orders', orderData, auth);
  }

  @Post('ecommerce/payments/intent')
  @ApiOperation({ summary: 'Create payment intent' })
  async createEcommercePaymentIntent(@Body() paymentData: any, @Headers('authorization') auth: string) {
    return this.gatewayService.proxyRequest('ecommerce', '/ecommerce/payments/intent', paymentData, auth);
  }

  @Get('ecommerce/dashboard')
  @ApiOperation({ summary: 'Get ecommerce dashboard data' })
  async getEcommerceDashboard(@Headers('authorization') auth: string) {
    return this.gatewayService.getEcommerceDashboard();
  }

  // Yoga endpoints
  @Get('yoga/poses')
  @ApiOperation({ summary: 'Get yoga poses' })
  async getPoses(
    @Query('category') category: string,
    @Query('difficulty') difficulty: string,
    @Query('search') search: string,
  ) {
    return this.gatewayService.proxyRequest('yoga', '/poses', {
      category,
      difficulty,
      search,
    });
  }

  @Get('yoga/sequences')
  @ApiOperation({ summary: 'Get yoga sequences' })
  async getSequences(
    @Query('type') type: string,
    @Query('difficulty') difficulty: string,
    @Query('instructorId') instructorId: string,
  ) {
    return this.gatewayService.proxyRequest('yoga', '/sequences', {
      type,
      difficulty,
      instructorId,
    });
  }

  @Post('yoga/progress/track')
  @ApiOperation({ summary: 'Track yoga practice' })
  async trackPractice(
    @Body() trackDto: any,
    @Headers('authorization') auth: string,
  ) {
    return this.gatewayService.proxyRequest('yoga', '/progress/track', trackDto, auth);
  }

  @Get('yoga/progress/stats')
  @ApiOperation({ summary: 'Get progress stats' })
  async getProgressStats(
    @Query('timeframe') timeframe: string,
    @Headers('authorization') auth: string,
  ) {
    return this.gatewayService.proxyRequest('yoga', '/progress/stats', { timeframe }, auth);
  }

  @Get('yoga/certifications')
  @ApiOperation({ summary: 'Get certifications' })
  async getCertifications(@Query() query: any) {
    return this.gatewayService.proxyRequest('yoga', '/certifications', query);
  }

  // Staff endpoints
  @Get('staff')
  @ApiOperation({ summary: 'Get staff members' })
  @UseGuards(AuthGuard)
  async getStaff(
    @Query() query: any,
    @Headers('authorization') auth: string,
  ) {
    return this.gatewayService.proxyRequest('staff', '/staff', query, auth);
  }

  @Get('staff/:id')
  @ApiOperation({ summary: 'Get staff by ID' })
  @UseGuards(AuthGuard)
  async getStaffById(
    @Param('id') id: string,
    @Headers('authorization') auth: string,
  ) {
    return this.gatewayService.proxyRequest('staff', `/staff/${id}`, {}, auth);
  }

  @Post('staff')
  @ApiOperation({ summary: 'Create staff member' })
  @UseGuards(AuthGuard)
  async createStaff(
    @Body() staffDto: any,
    @Headers('authorization') auth: string,
  ) {
    return this.gatewayService.proxyRequest('staff', '/staff', staffDto, auth);
  }

  @Get('staff/department/:department')
  @ApiOperation({ summary: 'Get staff by department' })
  @UseGuards(AuthGuard)
  async getStaffByDepartment(
    @Param('department') department: string,
    @Headers('authorization') auth: string,
  ) {
    return this.gatewayService.proxyRequest('staff', `/staff/department/${department}`, {}, auth);
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