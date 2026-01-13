import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Delete,
  Put,
  Query,
  UseGuards,
  Headers,
} from '@nestjs/common';
import { EcommerceService } from '../ecommerce.service';
import { 
  CreateProductDto,
  UpdateProductDto,
  CreateCategoryDto,
  UpdateCategoryDto,
  AddToCartDto,
  UpdateCartItemDto,
  CreateOrderDto,
  UpdateOrderDto,
  CreateReviewDto,
  ApplyCouponDto,
  CreateSubscriptionDto
} from '../dto/ecommerce.dto';
import { AuthGuard } from '../guards/auth.guard';
import { Roles } from '../decorators/roles.decorator';

@Controller('ecommerce')
export class EcommerceController {
  constructor(private readonly ecommerceService: EcommerceService) {}

  @Get('health')
  async healthCheck() {
    return {
      status: 'healthy',
      service: 'ecommerce-service',
      timestamp: new Date().toISOString(),
      database: await this.ecommerceService.checkDatabase(),
    };
  }

  // Product endpoints
  @Post('products')
  @UseGuards(AuthGuard)
  async createProduct(@Body() createProductDto: CreateProductDto) {
    return this.ecommerceService.createProduct(createProductDto);
  }

  @Get('products')
  async listProducts(@Query() query: any) {
    return this.ecommerceService.listProducts(query);
  }

  @Get('products/:id')
  async getProduct(@Param('id') id: string) {
    return this.ecommerceService.getProduct(id);
  }

  @Get('products/slug/:slug')
  async getProductBySlug(@Param('slug') slug: string) {
    return this.ecommerceService.getProductBySlug(slug);
  }

  @Put('products/:id')
  @UseGuards(AuthGuard)
  async updateProduct(
    @Param('id') id: string,
    @Body() updateProductDto: UpdateProductDto,
  ) {
    return this.ecommerceService.updateProduct(id, updateProductDto);
  }

  @Delete('products/:id')
  @UseGuards(AuthGuard)
  async deleteProduct(@Param('id') id: string) {
    return this.ecommerceService.deleteProduct(id);
  }

  // Category endpoints
  @Post('categories')
  @UseGuards(AuthGuard)
  async createCategory(@Body() createCategoryDto: CreateCategoryDto) {
    return this.ecommerceService.createCategory(createCategoryDto);
  }

  @Get('categories')
  async listCategories(@Query() query: any) {
    return this.ecommerceService.listCategories(query);
  }

  @Get('categories/:id')
  async getCategory(@Param('id') id: string) {
    return this.ecommerceService.getCategory(id);
  }

  @Put('categories/:id')
  @UseGuards(AuthGuard)
  async updateCategory(
    @Param('id') id: string,
    @Body() updateCategoryDto: UpdateCategoryDto,
  ) {
    return this.ecommerceService.updateCategory(id, updateCategoryDto);
  }

  // Cart endpoints
  @Get('cart')
  async getCart(
    @Headers('x-user-id') userId?: string,
    @Headers('x-session-id') sessionId?: string,
  ) {
    return this.ecommerceService.getOrCreateCart(userId, sessionId);
  }

  @Post('cart/items')
  async addToCart(
    @Body() addToCartDto: AddToCartDto,
    @Headers('x-user-id') userId?: string,
    @Headers('x-session-id') sessionId?: string,
  ) {
    const cart = await this.ecommerceService.getOrCreateCart(userId, sessionId);
    return this.ecommerceService.addToCart(cart.id, addToCartDto);
  }

  @Put('cart/items/:itemId')
  async updateCartItem(
    @Param('itemId') itemId: string,
    @Body() updateDto: UpdateCartItemDto,
    @Headers('x-user-id') userId?: string,
    @Headers('x-session-id') sessionId?: string,
  ) {
    const cart = await this.ecommerceService.getOrCreateCart(userId, sessionId);
    return this.ecommerceService.updateCartItem(cart.id, itemId, updateDto);
  }

  @Delete('cart/items/:itemId')
  async removeCartItem(
    @Param('itemId') itemId: string,
    @Headers('x-user-id') userId?: string,
    @Headers('x-session-id') sessionId?: string,
  ) {
    const cart = await this.ecommerceService.getOrCreateCart(userId, sessionId);
    return this.ecommerceService.removeCartItem(cart.id, itemId);
  }

  @Delete('cart')
  async clearCart(
    @Headers('x-user-id') userId?: string,
    @Headers('x-session-id') sessionId?: string,
  ) {
    const cart = await this.ecommerceService.getOrCreateCart(userId, sessionId);
    return this.ecommerceService.clearCart(cart.id);
  }

  @Post('cart/coupon')
  async applyCoupon(
    @Body() applyCouponDto: ApplyCouponDto,
    @Headers('x-user-id') userId?: string,
    @Headers('x-session-id') sessionId?: string,
  ) {
    const cart = await this.ecommerceService.getOrCreateCart(userId, sessionId);
    return this.ecommerceService.applyCoupon(cart.id, applyCouponDto);
  }

  // Order endpoints
  @Post('orders')
  @UseGuards(AuthGuard)
  async createOrder(
    @Body() createOrderDto: CreateOrderDto,
    @Headers('x-user-id') userId: string,
  ) {
    return this.ecommerceService.createOrder(userId, createOrderDto);
  }

  @Get('orders')
  @UseGuards(AuthGuard)
  async listOrders(
    @Headers('x-user-id') userId: string,
    @Query() query: any,
  ) {
    return this.ecommerceService.listOrders(userId, query);
  }

  @Get('orders/:id')
  async getOrder(
    @Param('id') id: string,
    @Headers('x-user-id') userId?: string,
  ) {
    return this.ecommerceService.getOrder(id, userId);
  }

  @Get('orders/number/:orderNumber')
  async getOrderByNumber(
    @Param('orderNumber') orderNumber: string,
    @Query('email') email: string,
  ) {
    return this.ecommerceService.getOrderByNumber(orderNumber, email);
  }

  @Put('orders/:id')
  @UseGuards(AuthGuard)
  async updateOrder(
    @Param('id') id: string,
    @Body() updateOrderDto: UpdateOrderDto,
  ) {
    return this.ecommerceService.updateOrder(id, updateOrderDto);
  }

  @Post('orders/:id/cancel')
  async cancelOrder(
    @Param('id') id: string,
    @Headers('x-user-id') userId?: string,
  ) {
    return this.ecommerceService.cancelOrder(id, userId);
  }

  // Review endpoints
  @Post('reviews')
  @UseGuards(AuthGuard)
  async createReview(
    @Body() createReviewDto: CreateReviewDto,
    @Headers('x-user-id') userId: string,
  ) {
    return this.ecommerceService.createReview(userId, createReviewDto);
  }

  @Get('products/:productId/reviews')
  async listProductReviews(
    @Param('productId') productId: string,
    @Query() query: any,
  ) {
    return this.ecommerceService.listProductReviews(productId, query);
  }

  // Wishlist endpoints
  @Get('wishlist')
  @UseGuards(AuthGuard)
  async getWishlist(@Headers('x-user-id') userId: string) {
    return this.ecommerceService.getOrCreateWishlist(userId);
  }

  @Post('wishlist/items')
  @UseGuards(AuthGuard)
  async addToWishlist(
    @Body() body: { productId: string; variantId?: string },
    @Headers('x-user-id') userId: string,
  ) {
    return this.ecommerceService.addToWishlist(userId, body.productId, body.variantId);
  }

  @Delete('wishlist/items/:itemId')
  @UseGuards(AuthGuard)
  async removeFromWishlist(
    @Param('itemId') itemId: string,
    @Headers('x-user-id') userId: string,
  ) {
    return this.ecommerceService.removeFromWishlist(userId, itemId);
  }

  // Subscription endpoints
  @Post('subscriptions')
  @UseGuards(AuthGuard)
  async createSubscription(
    @Body() createSubscriptionDto: CreateSubscriptionDto,
    @Headers('x-user-id') userId: string,
  ) {
    return this.ecommerceService.createSubscription(userId, createSubscriptionDto);
  }

  @Get('subscriptions/plans')
  async listSubscriptionPlans() {
    // Implementation would fetch subscription plans
    return [];
  }

  // Analytics endpoints
  @Get('analytics/sales')
  @UseGuards(AuthGuard)
  async getSalesAnalytics(@Query() query: any) {
    return this.ecommerceService.getSalesAnalytics(query);
  }

  // Search endpoint
  @Get('search')
  async searchProducts(@Query() query: any) {
    return this.ecommerceService.listProducts({
      ...query,
      search: query.q,
    });
  }

  // Featured products
  @Get('featured')
  async getFeaturedProducts() {
    return this.ecommerceService.listProducts({
      isFeatured: true,
      limit: 8,
    });
  }

  // New arrivals
  @Get('new-arrivals')
  async getNewArrivals() {
    return this.ecommerceService.listProducts({
      isNew: true,
      limit: 8,
    });
  }

  // Best sellers
  @Get('best-sellers')
  async getBestSellers() {
    return this.ecommerceService.listProducts({
      isBestSeller: true,
      limit: 8,
    });
  }

  // Payment endpoints
  @Post('payments/intent')
  @UseGuards(AuthGuard)
  async createPaymentIntent(
    @Body() body: { orderId: string; amount: number; currency?: string },
    @Headers('x-user-id') userId: string,
  ) {
    return this.ecommerceService.createPaymentIntent(body.orderId, body.amount, body.currency);
  }

  @Post('payments/confirm')
  @UseGuards(AuthGuard)
  async confirmPayment(@Body() body: { paymentIntentId: string }) {
    return this.ecommerceService.confirmPayment(body.paymentIntentId);
  }

  @Post('payments/refund')
  @UseGuards(AuthGuard)
  @Roles('ADMIN')
  async createRefund(
    @Body() body: { paymentIntentId: string; amount?: number },
  ) {
    return this.ecommerceService.createRefund(body.paymentIntentId, body.amount);
  }

  // Shipping endpoints
  @Post('shipping/calculate')
  async calculateShipping(
    @Body() body: { address: any; items: any[] },
  ) {
    return this.ecommerceService.calculateShipping(body.address, body.items);
  }

  @Post('shipping/create')
  @UseGuards(AuthGuard)
  @Roles('ADMIN')
  async createShipment(
    @Body() body: { orderId: string; shippingMethod: any },
  ) {
    return this.ecommerceService.createShipment(body.orderId, body.shippingMethod);
  }

  @Get('shipping/track/:trackingNumber')
  async trackShipment(@Param('trackingNumber') trackingNumber: string) {
    return this.ecommerceService.trackShipment(trackingNumber);
  }

  // Supplier endpoints
  @Post('suppliers')
  @UseGuards(AuthGuard)
  @Roles('ADMIN')
  async createSupplier(@Body() createSupplierDto: any) {
    return this.ecommerceService.createSupplier(createSupplierDto);
  }

  @Get('suppliers')
  @UseGuards(AuthGuard)
  async listSuppliers(@Query() query: any) {
    return this.ecommerceService.listSuppliers(query);
  }

  @Post('purchase-orders')
  @UseGuards(AuthGuard)
  @Roles('ADMIN')
  async createPurchaseOrder(
    @Body() body: { supplierId: string; items: any[] },
  ) {
    return this.ecommerceService.createPurchaseOrder(body.supplierId, body.items);
  }

  @Post('purchase-orders/:id/receive')
  @UseGuards(AuthGuard)
  @Roles('ADMIN')
  async receivePurchaseOrder(
    @Param('id') id: string,
    @Body() body: { items: any[] },
  ) {
    return this.ecommerceService.receivePurchaseOrder(id, body.items);
  }

  // Inventory endpoints
  @Get('inventory/transactions')
  @UseGuards(AuthGuard)
  async getInventoryTransactions(@Query() query: any) {
    return this.ecommerceService.getInventoryTransactions(query);
  }

  @Get('inventory/low-stock')
  @UseGuards(AuthGuard)
  async getLowStockAlerts(@Query('threshold') threshold: string) {
    return this.ecommerceService.getLowStockAlerts(threshold ? parseInt(threshold) : 10);
  }

  // Analytics endpoints
  @Get('analytics/products')
  @UseGuards(AuthGuard)
  @Roles('ADMIN')
  async getProductAnalytics(@Query() query: any) {
    return this.ecommerceService.getProductAnalytics(query);
  }

  @Get('analytics/inventory')
  @UseGuards(AuthGuard)
  @Roles('ADMIN')
  async getInventoryAnalytics() {
    return this.ecommerceService.getInventoryAnalytics();
  }
}