import {
  IsString,
  IsOptional,
  IsNumber,
  IsArray,
  IsBoolean,
  IsObject,
  IsEnum,
  Min,
  Max,
  IsEmail,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

// Product DTOs
export class CreateProductDto {
  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  slug?: string;

  @IsOptional()
  @IsString()
  sku?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  shortDescription?: string;

  @IsNumber()
  @Min(0)
  price: number;

  @IsOptional()
  @IsNumber()
  compareAtPrice?: number;

  @IsOptional()
  @IsNumber()
  costPrice?: number;

  @IsOptional()
  @IsNumber()
  taxRate?: number = 0;

  @IsOptional()
  @IsNumber()
  stockQuantity?: number = 0;

  @IsOptional()
  @IsNumber()
  lowStockThreshold?: number = 10;

  @IsOptional()
  @IsBoolean()
  trackInventory?: boolean = true;

  @IsOptional()
  @IsBoolean()
  allowBackorders?: boolean = false;

  @IsOptional()
  @IsBoolean()
  isDigital?: boolean = false;

  @IsOptional()
  @IsNumber()
  weight?: number;

  @IsOptional()
  @IsObject()
  dimensions?: any;

  @IsOptional()
  @IsString()
  categoryId?: string;

  @IsOptional()
  @IsString()
  brand?: string;

  @IsOptional()
  @IsArray()
  tags?: string[];

  @IsOptional()
  @IsObject()
  images?: any;

  @IsOptional()
  @IsString()
  featuredImage?: string;

  @IsOptional()
  @IsString()
  videoUrl?: string;

  @IsOptional()
  @IsBoolean()
  hasVariants?: boolean = false;

  @IsOptional()
  @IsObject()
  variantOptions?: any;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateVariantDto)
  variants?: CreateVariantDto[];

  @IsOptional()
  @IsString()
  metaTitle?: string;

  @IsOptional()
  @IsString()
  metaDescription?: string;

  @IsOptional()
  @IsArray()
  metaKeywords?: string[];

  @IsOptional()
  @IsEnum(['DRAFT', 'ACTIVE', 'ARCHIVED', 'OUT_OF_STOCK', 'DISCONTINUED'])
  status?: string = 'DRAFT';

  @IsOptional()
  @IsEnum(['VISIBLE', 'HIDDEN', 'SEARCHABLE'])
  visibility?: string = 'VISIBLE';

  @IsOptional()
  @IsBoolean()
  isFeatured?: boolean = false;

  @IsOptional()
  @IsBoolean()
  isBestSeller?: boolean = false;

  @IsOptional()
  @IsBoolean()
  isNew?: boolean = false;
}

export class UpdateProductDto extends CreateProductDto {
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(5)
  rating?: number;
}

export class CreateVariantDto {
  @IsOptional()
  @IsString()
  option1?: string;

  @IsOptional()
  @IsString()
  option2?: string;

  @IsOptional()
  @IsString()
  option3?: string;

  @IsOptional()
  @IsString()
  sku?: string;

  @IsNumber()
  price: number;

  @IsOptional()
  @IsNumber()
  compareAtPrice?: number;

  @IsOptional()
  @IsNumber()
  costPrice?: number;

  @IsOptional()
  @IsNumber()
  stockQuantity?: number = 0;

  @IsOptional()
  @IsBoolean()
  trackInventory?: boolean = true;

  @IsOptional()
  @IsString()
  image?: string;

  @IsOptional()
  @IsEnum(['DRAFT', 'ACTIVE', 'ARCHIVED', 'OUT_OF_STOCK', 'DISCONTINUED'])
  status?: string = 'ACTIVE';
}

// Category DTOs
export class CreateCategoryDto {
  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  slug?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  image?: string;

  @IsOptional()
  @IsString()
  parentId?: string;

  @IsOptional()
  @IsString()
  metaTitle?: string;

  @IsOptional()
  @IsString()
  metaDescription?: string;

  @IsOptional()
  @IsNumber()
  displayOrder?: number = 0;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean = true;
}

export class UpdateCategoryDto extends CreateCategoryDto {}

// Cart DTOs
export class AddToCartDto {
  @IsString()
  productId: string;

  @IsOptional()
  @IsString()
  variantId?: string;

  @IsNumber()
  @Min(1)
  quantity: number = 1;

  @IsOptional()
  @IsObject()
  customizations?: any;
}

export class UpdateCartItemDto {
  @IsOptional()
  @IsNumber()
  @Min(1)
  quantity?: number;

  @IsOptional()
  @IsObject()
  customizations?: any;
}

export class ApplyCouponDto {
  @IsString()
  code: string;
}

// Order DTOs
export class CreateOrderDto {
  @IsOptional()
  @IsEmail()
  customerEmail?: string;

  @IsString()
  customerName: string;

  @IsOptional()
  @IsString()
  customerPhone?: string;

  @IsOptional()
  @IsString()
  customerNote?: string;

  @IsObject()
  shippingAddress: any;

  @IsOptional()
  @IsObject()
  billingAddress?: any;
}

export class UpdateOrderDto {
  @IsOptional()
  @IsEnum(['PENDING', 'CONFIRMED', 'PROCESSING', 'SHIPPED', 'DELIVERED', 'CANCELLED', 'REFUNDED'])
  status?: string;

  @IsOptional()
  @IsEnum(['PENDING', 'PROCESSING', 'COMPLETED', 'FAILED', 'REFUNDED', 'PARTIALLY_REFUNDED'])
  paymentStatus?: string;

  @IsOptional()
  @IsEnum(['UNFULFILLED', 'PARTIALLY_FULFILLED', 'FULFILLED', 'DELIVERED', 'RETURNED'])
  fulfillmentStatus?: string;

  @IsOptional()
  @IsString()
  paymentMethod?: string;

  @IsOptional()
  @IsString()
  transactionId?: string;

  @IsOptional()
  @IsString()
  paymentGateway?: string;

  @IsOptional()
  @IsString()
  shippingMethod?: string;

  @IsOptional()
  @IsString()
  trackingNumber?: string;

  @IsOptional()
  @IsString()
  couponCode?: string;
}

// Review DTOs
export class CreateReviewDto {
  @IsString()
  productId: string;

  @IsOptional()
  @IsString()
  orderId?: string;

  @IsNumber()
  @Min(1)
  @Max(5)
  rating: number;

  @IsOptional()
  @IsString()
  title?: string;

  @IsString()
  comment: string;

  @IsOptional()
  @IsArray()
  images?: string[];
}

// Subscription DTOs
export class CreateSubscriptionDto {
  @IsString()
  planId: string;
}

// Analytics DTOs
export class AnalyticsFilterDto {
  @IsOptional()
  @IsString()
  startDate?: string;

  @IsOptional()
  @IsString()
  endDate?: string;

  @IsOptional()
  @IsEnum(['day', 'week', 'month'])
  groupBy?: string = 'day';
}