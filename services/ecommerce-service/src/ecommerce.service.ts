import { Injectable, NotFoundException, BadRequestException, ConflictException } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
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
} from './dto/ecommerce.dto';
import * as crypto from 'crypto';

const prisma = new PrismaClient();

@Injectable()
export class EcommerceService {
  // Note: These services would be injected via constructor in real implementation
  // For now, I'll add placeholder properties
  private paymentService: any;
  private shippingService: any;
  private supplierService: any;
  private fileUploadService: any; // Add file upload service

  constructor() {
    // In real implementation, these would be injected:
    // constructor(
    //   private paymentService: PaymentService,
    //   private shippingService: ShippingService,
    //   private supplierService: SupplierService,
    //   private fileUploadService: FileUploadService
    // ) {}
    
    // Placeholder initialization
    this.paymentService = {
      createPaymentIntent: () => ({ id: 'pi_123', client_secret: 'secret' }),
      confirmPayment: () => ({ status: 'succeeded' }),
      createRefund: () => ({ id: 're_123', status: 'succeeded' })
    };
    
    this.shippingService = {
      calculateShipping: () => ({ methods: [], estimatedCost: 0 }),
      createShipment: () => ({ id: 'ship_123', trackingNumber: 'TRACK123' }),
      trackShipment: () => ({ status: 'in_transit', location: 'Warehouse' })
    };
    
    this.supplierService = {
      createSupplier: (data) => ({ id: 'supp_123', ...data }),
      getSuppliers: (filters) => ({ suppliers: [], total: 0 }),
      createPurchaseOrder: (supplierId, items) => ({ id: 'po_123', status: 'pending' }),
      receivePurchaseOrder: (poId, receivedItems) => ({ id: poId, status: 'received' }),
      getInventoryTransactions: (filters) => ({ transactions: [], total: 0 }),
      getLowStockAlerts: (threshold) => ({ alerts: [] })
    };

    // Placeholder for file upload service
    this.fileUploadService = {
      uploadMultipleImages: (files, productId, setFeatured) => {
        // Simulate file upload
        return files.map((file, index) => ({
          id: `img_${Date.now()}_${index}`,
          url: `https://storage.yogaspa.com/products/${productId}/${file.originalname}`,
          thumbnailUrl: `https://storage.yogaspa.com/products/${productId}/thumbnails/${file.originalname}`,
          altText: file.originalname,
          displayOrder: index,
          isFeatured: setFeatured && index === 0,
          dimensions: '1920x1080',
          fileSize: file.size,
          mimeType: file.mimetype
        }));
      },
      deleteImage: (url) => Promise.resolve(true)
    };
  }

  // ============ PRODUCT IMAGE MANAGEMENT ============

  async uploadProductImages(productId: string, files: Express.Multer.File[], setFeatured: boolean = false) {
    // Check if product exists
    const product = await prisma.product.findUnique({
      where: { id: productId },
    });

    if (!product) {
      throw new NotFoundException('Product not found');
    }

    // Upload images using file upload service
    const uploadedImages = await this.fileUploadService.uploadMultipleImages(files, productId, setFeatured);

    // Get current max display order
    const currentImages = await prisma.productImage.findMany({
      where: { productId },
      orderBy: { displayOrder: 'desc' },
      take: 1,
    });

    const startOrder = currentImages.length > 0 ? currentImages[0].displayOrder + 1 : 0;

    // Save image metadata to database
    const savedImages = [];
    for (let i = 0; i < uploadedImages.length; i++) {
      const uploadedImage = uploadedImages[i];
      const imageData = {
        productId,
        url: uploadedImage.url,
        thumbnailUrl: uploadedImage.thumbnailUrl,
        altText: uploadedImage.altText || product.name,
        displayOrder: startOrder + i,
        isFeatured: setFeatured && i === 0,
        fileSize: files[i].size,
        mimeType: files[i].mimetype,
        dimensions: uploadedImage.dimensions || null,
      };

      const savedImage = await prisma.productImage.create({
        data: imageData,
      });
      savedImages.push(savedImage);

      // If setting featured, update other images to not featured
      if (setFeatured && i === 0) {
        await prisma.productImage.updateMany({
          where: {
            productId,
            id: { not: savedImage.id },
          },
          data: {
            isFeatured: false,
          },
        });
      }
    }

    // Update product's images array if it exists
    if (product.images && Array.isArray(product.images)) {
      const newImageUrls = savedImages.map(img => img.url);
      await prisma.product.update({
        where: { id: productId },
        data: {
          images: [...product.images, ...newImageUrls],
        },
      });
    }

    return savedImages;
  }

  async deleteProductImage(imageId: string) {
    const image = await prisma.productImage.findUnique({
      where: { id: imageId },
    });

    if (!image) {
      throw new NotFoundException('Image not found');
    }

    // Delete from storage
    await this.fileUploadService.deleteImage(image.url);
    if (image.thumbnailUrl) {
      await this.fileUploadService.deleteImage(image.thumbnailUrl);
    }

    // If this is the featured image, set another image as featured
    if (image.isFeatured) {
      const otherImage = await prisma.productImage.findFirst({
        where: {
          productId: image.productId,
          id: { not: imageId },
        },
        orderBy: { displayOrder: 'asc' },
      });

      if (otherImage) {
        await prisma.productImage.update({
          where: { id: otherImage.id },
          data: { isFeatured: true },
        });
      }
    }

    // Delete from database
    await prisma.productImage.delete({
      where: { id: imageId },
    });

    // Update product's images array if it exists
    const product = await prisma.product.findUnique({
      where: { id: image.productId },
      select: { images: true },
    });

    if (product && product.images && Array.isArray(product.images)) {
      const updatedImages = product.images.filter(imgUrl => imgUrl !== image.url);
      await prisma.product.update({
        where: { id: image.productId },
        data: {
          images: updatedImages,
        },
      });
    }

    return { success: true, message: 'Image deleted successfully' };
  }

  async getProductImages(productId: string) {
    const product = await prisma.product.findUnique({
      where: { id: productId },
    });

    if (!product) {
      throw new NotFoundException('Product not found');
    }

    const images = await prisma.productImage.findMany({
      where: { productId },
      orderBy: { displayOrder: 'asc' },
    });

    return images;
  }

  async updateProductImageOrder(productId: string, imageOrder: Array<{ id: string; displayOrder: number }>) {
    const product = await prisma.product.findUnique({
      where: { id: productId },
    });

    if (!product) {
      throw new NotFoundException('Product not found');
    }

    // Validate all images belong to the product
    const imageIds = imageOrder.map(item => item.id);
    const imagesCount = await prisma.productImage.count({
      where: {
        id: { in: imageIds },
        productId,
      },
    });

    if (imagesCount !== imageOrder.length) {
      throw new BadRequestException('Some images do not belong to this product');
    }

    // Update display orders
    const updatePromises = imageOrder.map(item =>
      prisma.productImage.update({
        where: { id: item.id },
        data: { displayOrder: item.displayOrder },
      })
    );

    await Promise.all(updatePromises);

    return this.getProductImages(productId);
  }

  async setFeaturedImage(productId: string, imageId: string) {
    const product = await prisma.product.findUnique({
      where: { id: productId },
    });

    if (!product) {
      throw new NotFoundException('Product not found');
    }

    const image = await prisma.productImage.findUnique({
      where: { id: imageId },
    });

    if (!image || image.productId !== productId) {
      throw new NotFoundException('Image not found for this product');
    }

    // Set all images to not featured
    await prisma.productImage.updateMany({
      where: { productId },
      data: { isFeatured: false },
    });

    // Set the specified image as featured
    const updatedImage = await prisma.productImage.update({
      where: { id: imageId },
      data: { isFeatured: true },
    });

    return updatedImage;
  }

  // ============ END OF PRODUCT IMAGE METHODS ============

  // Product Management
  async createProduct(createProductDto: CreateProductDto) {
    // Generate slug if not provided
    const slug = createProductDto.slug || this.generateSlug(createProductDto.name);
    
    // Generate SKU if not provided
    const sku = createProductDto.sku || this.generateSKU(createProductDto.name);

    const product = await prisma.product.create({
      data: {
        ...createProductDto,
        slug,
        sku,
        status: createProductDto.status || 'DRAFT',
        images: createProductDto.images || [],
        tags: createProductDto.tags || [],
        metaKeywords: createProductDto.metaKeywords || [],
      },
    });

    // Create variants if provided
    if (createProductDto.variants && createProductDto.variants.length > 0) {
      await this.createProductVariants(product.id, createProductDto.variants);
    }

    return this.getProductWithDetails(product.id);
  }

  async getProduct(productId: string) {
    const product = await prisma.product.findUnique({
      where: { id: productId },
      include: {
        category: true,
        variants: true,
        productImages: {
          orderBy: { displayOrder: 'asc' },
        },
        reviews: {
          where: { status: 'APPROVED' },
          take: 10,
          include: {
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                avatar: true,
              },
            },
          },
          orderBy: { createdAt: 'desc' },
        },
        _count: {
          select: {
            reviews: true,
          },
        },
      },
    });

    if (!product) {
      throw new NotFoundException('Product not found');
    }

    return product;
  }

  async getProductBySlug(slug: string) {
    const product = await prisma.product.findUnique({
      where: { slug },
      include: {
        category: true,
        variants: true,
        productImages: {
          orderBy: { displayOrder: 'asc' },
        },
        reviews: {
          where: { status: 'APPROVED' },
          take: 5,
          include: {
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                avatar: true,
              },
            },
          },
          orderBy: { createdAt: 'desc' },
        },
        _count: {
          select: {
            reviews: true,
          },
        },
      },
    });

    if (!product) {
      throw new NotFoundException('Product not found');
    }

    return product;
  }

  async listProducts(filters: any) {
    const {
      categoryId,
      status,
      minPrice,
      maxPrice,
      inStock,
      isFeatured,
      isBestSeller,
      isNew,
      search,
      sortBy = 'createdAt',
      sortOrder = 'desc',
      page = 1,
      limit = 20,
    } = filters;

    const skip = (page - 1) * limit;
    const where: any = {};

    if (categoryId) where.categoryId = categoryId;
    if (status) where.status = status;
    if (isFeatured !== undefined) where.isFeatured = isFeatured;
    if (isBestSeller !== undefined) where.isBestSeller = isBestSeller;
    if (isNew !== undefined) where.isNew = isNew;
    if (inStock !== undefined) {
      if (inStock) {
        where.stockQuantity = { gt: 0 };
      } else {
        where.stockQuantity = { lte: 0 };
      }
    }
    if (minPrice !== undefined || maxPrice !== undefined) {
      where.price = {};
      if (minPrice !== undefined) where.price.gte = minPrice;
      if (maxPrice !== undefined) where.price.lte = maxPrice;
    }
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
        { sku: { contains: search, mode: 'insensitive' } },
        { tags: { has: search } },
      ];
    }

    const [products, total] = await Promise.all([
      prisma.product.findMany({
        where,
        include: {
          category: true,
          variants: true,
          productImages: {
            where: { isFeatured: true },
            take: 1,
          },
          _count: {
            select: {
              reviews: true,
            },
          },
        },
        orderBy: { [sortBy]: sortOrder },
        skip,
        take: limit,
      }),
      prisma.product.count({ where }),
    ]);

    return {
      products,
      pagination: {
        total,
        page: parseInt(page.toString()),
        limit: parseInt(limit.toString()),
        pages: Math.ceil(total / limit),
      },
    };
  }

  async updateProduct(productId: string, updateProductDto: UpdateProductDto) {
    const product = await prisma.product.findUnique({
      where: { id: productId },
    });

    if (!product) {
      throw new NotFoundException('Product not found');
    }

    const updatedProduct = await prisma.product.update({
      where: { id: productId },
      data: updateProductDto,
    });

    return this.getProductWithDetails(updatedProduct.id);
  }

  async deleteProduct(productId: string) {
    const product = await prisma.product.findUnique({
      where: { id: productId },
      include: {
        variants: true,
        productImages: true,
        cartItems: true,
        orderItems: true,
      },
    });

    if (!product) {
      throw new NotFoundException('Product not found');
    }

    // Check if product has orders
    if (product.orderItems.length > 0) {
      throw new BadRequestException('Cannot delete product with existing orders');
    }

    // Delete product images from storage
    if (product.productImages && product.productImages.length > 0) {
      for (const image of product.productImages) {
        await this.fileUploadService.deleteImage(image.url);
        if (image.thumbnailUrl) {
          await this.fileUploadService.deleteImage(image.thumbnailUrl);
        }
      }
    }

    // Archive instead of delete
    await prisma.product.update({
      where: { id: productId },
      data: {
        status: 'ARCHIVED',
        visibility: 'HIDDEN',
      },
    });

    return { success: true, message: 'Product archived successfully' };
  }

  // Category Management
  async createCategory(createCategoryDto: CreateCategoryDto) {
    const slug = createCategoryDto.slug || this.generateSlug(createCategoryDto.name);

    const category = await prisma.category.create({
      data: {
        ...createCategoryDto,
        slug,
        isActive: createCategoryDto.isActive ?? true,
      },
    });

    return category;
  }

  async getCategory(categoryId: string) {
    const category = await prisma.category.findUnique({
      where: { id: categoryId },
      include: {
        parent: true,
        children: true,
        products: {
          take: 10,
          orderBy: { createdAt: 'desc' },
          include: {
            variants: true,
            productImages: {
              where: { isFeatured: true },
              take: 1,
            },
            _count: {
              select: {
                reviews: true,
              },
            },
          },
        },
        _count: {
          select: {
            products: true,
            children: true,
          },
        },
      },
    });

    if (!category) {
      throw new NotFoundException('Category not found');
    }

    return category;
  }

  async listCategories(filters: any) {
    const { parentId, isActive, search } = filters;

    const where: any = {};

    if (parentId !== undefined) {
      if (parentId === null) {
        where.parentId = null;
      } else {
        where.parentId = parentId;
      }
    }
    if (isActive !== undefined) where.isActive = isActive;
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
      ];
    }

    const categories = await prisma.category.findMany({
      where,
      include: {
        parent: true,
        children: {
          include: {
            _count: {
              select: {
                products: true,
              },
            },
          },
        },
        _count: {
          select: {
            products: true,
            children: true,
          },
        },
      },
      orderBy: { displayOrder: 'asc' },
    });

    return categories;
  }

  // Cart Management
  async getOrCreateCart(userId?: string, sessionId?: string) {
    let cart;
    
    if (userId) {
      cart = await prisma.cart.findUnique({
        where: { userId },
        include: {
          items: {
            include: {
              product: {
                include: {
                  productImages: {
                    where: { isFeatured: true },
                    take: 1,
                  },
                },
              },
              variant: true,
            },
          },
        },
      });
    } else if (sessionId) {
      cart = await prisma.cart.findUnique({
        where: { sessionId },
        include: {
          items: {
            include: {
              product: {
                include: {
                  productImages: {
                    where: { isFeatured: true },
                    take: 1,
                  },
                },
              },
              variant: true,
            },
          },
        },
      });
    }

    if (!cart) {
      const cartData: any = {
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
      };

      if (userId) cartData.userId = userId;
      if (sessionId) cartData.sessionId = sessionId;

      cart = await prisma.cart.create({
        data: cartData,
        include: {
          items: {
            include: {
              product: {
                include: {
                  productImages: {
                    where: { isFeatured: true },
                    take: 1,
                  },
                },
              },
              variant: true,
            },
          },
        },
      });
    }

    return cart;
  }

  async addToCart(cartId: string, addToCartDto: AddToCartDto) {
    const cart = await prisma.cart.findUnique({
      where: { id: cartId },
      include: { items: true },
    });

    if (!cart) {
      throw new NotFoundException('Cart not found');
    }

    // Get product
    const product = await prisma.product.findUnique({
      where: { id: addToCartDto.productId },
    });

    if (!product) {
      throw new NotFoundException('Product not found');
    }

    // Check variant if provided
    let variant = null;
    if (addToCartDto.variantId) {
      variant = await prisma.productVariant.findUnique({
        where: { id: addToCartDto.variantId },
      });

      if (!variant) {
        throw new NotFoundException('Variant not found');
      }

      // Check variant belongs to product
      if (variant.productId !== product.id) {
        throw new BadRequestException('Variant does not belong to this product');
      }
    }

    // Check stock
    const stockQuantity = variant?.stockQuantity ?? product.stockQuantity;
    if (product.trackInventory && !product.allowBackorders && stockQuantity < addToCartDto.quantity) {
      throw new BadRequestException(`Only ${stockQuantity} items available in stock`);
    }

    // Check if item already in cart
    const existingItem = cart.items.find(item =>
      item.productId === addToCartDto.productId &&
      item.variantId === addToCartDto.variantId
    );

    let cartItem;
    if (existingItem) {
      // Update quantity
      const newQuantity = existingItem.quantity + addToCartDto.quantity;
      
      // Check stock again for updated quantity
      if (product.trackInventory && !product.allowBackorders && stockQuantity < newQuantity) {
        throw new BadRequestException(`Only ${stockQuantity} items available in stock`);
      }

      cartItem = await prisma.cartItem.update({
        where: { id: existingItem.id },
        data: {
          quantity: newQuantity,
          totalPrice: (variant?.price || product.price) * newQuantity,
        },
      });
    } else {
      // Add new item
      const price = variant?.price || product.price;
      cartItem = await prisma.cartItem.create({
        data: {
          cartId,
          productId: addToCartDto.productId,
          variantId: addToCartDto.variantId,
          quantity: addToCartDto.quantity,
          price,
          totalPrice: price * addToCartDto.quantity,
          customizations: addToCartDto.customizations,
        },
      });
    }

    // Update cart totals
    await this.updateCartTotals(cartId);

    return this.getCartWithDetails(cartId);
  }

  async updateCartItem(cartId: string, itemId: string, updateDto: UpdateCartItemDto) {
    const cartItem = await prisma.cartItem.findFirst({
      where: {
        id: itemId,
        cartId,
      },
      include: {
        product: true,
        variant: true,
      },
    });

    if (!cartItem) {
      throw new NotFoundException('Cart item not found');
    }

    // Check stock if updating quantity
    if (updateDto.quantity !== undefined) {
      const product = cartItem.product;
      const variant = cartItem.variant;
      const stockQuantity = variant?.stockQuantity ?? product.stockQuantity;
      
      if (product.trackInventory && !product.allowBackorders && stockQuantity < updateDto.quantity) {
        throw new BadRequestException(`Only ${stockQuantity} items available in stock`);
      }
    }

    const updatedCartItem = await prisma.cartItem.update({
      where: { id: itemId },
      data: {
        ...updateDto,
        totalPrice: updateDto.quantity !== undefined 
          ? cartItem.price * updateDto.quantity 
          : undefined,
      },
    });

    // Update cart totals
    await this.updateCartTotals(cartId);

    return this.getCartWithDetails(cartId);
  }

  async removeCartItem(cartId: string, itemId: string) {
    const cartItem = await prisma.cartItem.findFirst({
      where: {
        id: itemId,
        cartId,
      },
    });

    if (!cartItem) {
      throw new NotFoundException('Cart item not found');
    }

    await prisma.cartItem.delete({
      where: { id: itemId },
    });

    // Update cart totals
    await this.updateCartTotals(cartId);

    return this.getCartWithDetails(cartId);
  }

  async clearCart(cartId: string) {
    const cart = await prisma.cart.findUnique({
      where: { id: cartId },
    });

    if (!cart) {
      throw new NotFoundException('Cart not found');
    }

    await prisma.cartItem.deleteMany({
      where: { cartId },
    });

    await prisma.cart.update({
      where: { id: cartId },
      data: {
        itemCount: 0,
        totalQuantity: 0,
        subtotal: 0,
        tax: 0,
        discount: 0,
        shipping: 0,
        totalAmount: 0,
      },
    });

    return this.getCartWithDetails(cartId);
  }

  async applyCoupon(cartId: string, applyCouponDto: ApplyCouponDto) {
    const cart = await prisma.cart.findUnique({
      where: { id: cartId },
      include: { items: { include: { product: true } } },
    });

    if (!cart) {
      throw new NotFoundException('Cart not found');
    }

    const coupon = await prisma.coupon.findUnique({
      where: { 
        code: applyCouponDto.code,
        isActive: true,
      },
    });

    if (!coupon) {
      throw new NotFoundException('Invalid coupon code');
    }

    // Check validity
    const now = new Date();
    if (coupon.expiresAt && coupon.expiresAt < now) {
      throw new BadRequestException('Coupon has expired');
    }
    if (coupon.startsAt > now) {
      throw new BadRequestException('Coupon is not yet valid');
    }

    // Check usage limits
    if (coupon.usageLimit && coupon.usageCount >= coupon.usageLimit) {
      throw new BadRequestException('Coupon usage limit reached');
    }

    // Check minimum purchase
    if (coupon.minimumPurchase && cart.subtotal < coupon.minimumPurchase) {
      throw new BadRequestException(`Minimum purchase of $${coupon.minimumPurchase} required`);
    }

    // Check applicability
    if (coupon.applicableTo !== 'ALL') {
      const applicableProductIds = new Set(coupon.productIds);
      const applicableCategoryIds = new Set(coupon.categoryIds);
      
      const hasApplicableItems = cart.items.some(item => {
        if (coupon.applicableTo === 'PRODUCTS') {
          return applicableProductIds.has(item.productId);
        } else if (coupon.applicableTo === 'CATEGORIES') {
          return item.product.categoryId && applicableCategoryIds.has(item.product.categoryId);
        }
        return false;
      });

      if (!hasApplicableItems) {
        throw new BadRequestException('Coupon not applicable to cart items');
      }
    }

    // Calculate discount
    let discount = 0;
    if (coupon.discountType === 'PERCENTAGE') {
      discount = (cart.subtotal * coupon.discountValue) / 100;
      if (coupon.maximumDiscount && discount > coupon.maximumDiscount) {
        discount = coupon.maximumDiscount;
      }
    } else if (coupon.discountType === 'FIXED_AMOUNT') {
      discount = coupon.discountValue;
    } else if (coupon.discountType === 'FREE_SHIPPING') {
      discount = cart.shipping;
    }

    // Update cart with coupon
    const updatedCart = await prisma.cart.update({
      where: { id: cartId },
      data: {
        couponCode: coupon.code,
        discountType: coupon.discountType,
        discountValue: coupon.discountValue,
        discount,
        totalAmount: cart.subtotal + cart.tax + cart.shipping - discount,
      },
    });

    // Update coupon usage
    await prisma.coupon.update({
      where: { id: coupon.id },
      data: {
        usageCount: { increment: 1 },
      },
    });

    return this.getCartWithDetails(cartId);
  }

  // Order Management
  async createOrder(userId: string, createOrderDto: CreateOrderDto) {
    // Get cart
    const cart = await prisma.cart.findUnique({
      where: { userId },
      include: {
        items: {
          include: {
            product: true,
            variant: true,
          },
        },
      },
    });

    if (!cart || cart.items.length === 0) {
      throw new BadRequestException('Cart is empty');
    }

    // Generate order number
    const orderNumber = this.generateOrderNumber();

    // Create order
    const order = await prisma.order.create({
      data: {
        orderNumber,
        userId,
        customerEmail: createOrderDto.customerEmail || cart.customerEmail,
        customerName: createOrderDto.customerName,
        customerPhone: createOrderDto.customerPhone,
        customerNote: createOrderDto.customerNote,
        subtotal: cart.subtotal,
        tax: cart.tax,
        discount: cart.discount,
        shipping: cart.shipping,
        totalAmount: cart.totalAmount,
        shippingMethod: cart.shippingMethod,
        shippingAddress: createOrderDto.shippingAddress,
        billingAddress: createOrderDto.billingAddress || createOrderDto.shippingAddress,
        couponCode: cart.couponCode,
        discountType: cart.discountType,
        discountValue: cart.discountValue,
      },
    });

    // Create order items
    for (const item of cart.items) {
      await prisma.orderItem.create({
        data: {
          orderId: order.id,
          productId: item.productId,
          variantId: item.variantId,
          name: item.variant?.option1 
            ? `${item.product.name} - ${item.variant.option1}${item.variant.option2 ? `, ${item.variant.option2}` : ''}`
            : item.product.name,
          sku: item.variant?.sku || item.product.sku,
          quantity: item.quantity,
          price: item.price,
          compareAtPrice: item.compareAtPrice,
          totalPrice: item.totalPrice,
          customizations: item.customizations,
          // For digital products
          digitalFileUrl: item.product.isDigital ? this.generateDigitalFileUrl(item.product.id) : null,
          downloadKey: item.product.isDigital ? this.generateDownloadKey() : null,
        },
      });

      // Update inventory
      if (item.product.trackInventory) {
        if (item.variantId) {
          await prisma.productVariant.update({
            where: { id: item.variantId },
            data: {
              stockQuantity: { decrement: item.quantity },
            },
          });
        } else {
          await prisma.product.update({
            where: { id: item.productId },
            data: {
              stockQuantity: { decrement: item.quantity },
            },
          });
        }

        // Update product status if out of stock
        const updatedProduct = await prisma.product.findUnique({
          where: { id: item.productId },
          include: { variants: true },
        });

        if (updatedProduct) {
          const totalStock = updatedProduct.variants.length > 0
            ? updatedProduct.variants.reduce((sum, v) => sum + v.stockQuantity, 0)
            : updatedProduct.stockQuantity;

          if (totalStock <= 0) {
            await prisma.product.update({
              where: { id: item.productId },
              data: {
                status: 'OUT_OF_STOCK',
              },
            });
          }
        }
      }
    }

    // Clear cart
    await this.clearCart(cart.id);

    // Send order confirmation
    await this.sendOrderConfirmation(order.id);

    return this.getOrderWithDetails(order.id);
  }

  async getOrder(orderId: string, userId?: string) {
    const where: any = { id: orderId };
    if (userId) where.userId = userId;

    const order = await prisma.order.findUnique({
      where,
      include: {
        items: {
          include: {
            product: {
              include: {
                productImages: {
                  where: { isFeatured: true },
                  take: 1,
                },
              },
            },
            variant: true,
          },
        },
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
      },
    });

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    return order;
  }

  async getOrderByNumber(orderNumber: string, email: string) {
    const order = await prisma.order.findUnique({
      where: { orderNumber },
      include: {
        items: {
          include: {
            product: {
              include: {
                productImages: {
                  where: { isFeatured: true },
                  take: 1,
                },
              },
            },
            variant: true,
          },
        },
      },
    });

    if (!order || order.customerEmail !== email) {
      throw new NotFoundException('Order not found');
    }

    return order;
  }

  async listOrders(userId?: string, filters: any = {}) {
    const {
      status,
      startDate,
      endDate,
      page = 1,
      limit = 20,
    } = filters;

    const skip = (page - 1) * limit;
    const where: any = {};

    if (userId) where.userId = userId;
    if (status) where.status = status;
    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt.gte = new Date(startDate);
      if (endDate) where.createdAt.lte = new Date(endDate);
    }

    const [orders, total] = await Promise.all([
      prisma.order.findMany({
        where,
        include: {
          items: {
            take: 2,
            include: {
              product: {
                include: {
                  productImages: {
                    where: { isFeatured: true },
                    take: 1,
                  },
                },
              },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.order.count({ where }),
    ]);

    return {
      orders,
      pagination: {
        total,
        page: parseInt(page.toString()),
        limit: parseInt(limit.toString()),
        pages: Math.ceil(total / limit),
      },
    };
  }

  async updateOrder(orderId: string, updateOrderDto: UpdateOrderDto) {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
    });

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    // Validate status transitions
    if (updateOrderDto.status) {
      this.validateOrderStatusTransition(order.status, updateOrderDto.status);
    }

    const updatedOrder = await prisma.order.update({
      where: { id: orderId },
      data: updateOrderDto,
    });

    // Send status update notification
    if (updateOrderDto.status) {
      await this.sendOrderStatusUpdate(order.id, updateOrderDto.status);
    }

    return this.getOrderWithDetails(orderId);
  }

  async cancelOrder(orderId: string, userId?: string) {
    const where: any = { id: orderId };
    if (userId) where.userId = userId;

    const order = await prisma.order.findUnique({
      where,
      include: {
        items: {
          include: {
            product: true,
            variant: true,
          },
        },
      },
    });

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    // Check if order can be cancelled
    if (!['PENDING', 'CONFIRMED'].includes(order.status)) {
      throw new BadRequestException(`Order cannot be cancelled in ${order.status.toLowerCase()} status`);
    }

    const cancelledOrder = await prisma.order.update({
      where: { id: orderId },
      data: {
        status: 'CANCELLED',
        cancelledAt: new Date(),
      },
    });

    // Restore inventory
    for (const item of order.items) {
      if (item.product.trackInventory) {
        if (item.variantId) {
          await prisma.productVariant.update({
            where: { id: item.variantId },
            data: {
              stockQuantity: { increment: item.quantity },
            },
          });
        } else {
          await prisma.product.update({
            where: { id: item.productId },
            data: {
              stockQuantity: { increment: item.quantity },
            },
          });
        }
      }
    }

    // Send cancellation notification
    await this.sendOrderCancellation(order.id);

    return cancelledOrder;
  }

  // Review Management
  async createReview(userId: string, createReviewDto: CreateReviewDto) {
    // Check if user has purchased the product
    if (createReviewDto.orderId) {
      const orderItem = await prisma.orderItem.findFirst({
        where: {
          orderId: createReviewDto.orderId,
          productId: createReviewDto.productId,
          order: {
            userId,
            status: 'DELIVERED',
          },
        },
      });

      if (!orderItem) {
        throw new BadRequestException('You must purchase the product to review it');
      }
    }

    // Check if user already reviewed this product
    const existingReview = await prisma.review.findFirst({
      where: {
        userId,
        productId: createReviewDto.productId,
        ...(createReviewDto.orderId && { orderId: createReviewDto.orderId }),
      },
    });

    if (existingReview) {
      throw new ConflictException('You have already reviewed this product');
    }

    const review = await prisma.review.create({
      data: {
        ...createReviewDto,
        userId,
        images: createReviewDto.images || [],
        status: 'PENDING', // Requires moderation
      },
    });

    // Update product rating
    await this.updateProductRating(createReviewDto.productId);

    return review;
  }

  async listProductReviews(productId: string, filters: any) {
    const { rating, verified, page = 1, limit = 10 } = filters;
    const skip = (page - 1) * limit;

    const where: any = {
      productId,
      status: 'APPROVED',
    };

    if (rating) where.rating = rating;
    if (verified !== undefined) where.isVerified = verified;

    const [reviews, total] = await Promise.all([
      prisma.review.findMany({
        where,
        include: {
          user: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              avatar: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.review.count({ where }),
    ]);

    return {
      reviews,
      pagination: {
        total,
        page: parseInt(page.toString()),
        limit: parseInt(limit.toString()),
        pages: Math.ceil(total / limit),
      },
    };
  }

  // Wishlist Management
  async getOrCreateWishlist(userId: string) {
    let wishlist = await prisma.wishlist.findUnique({
      where: { userId },
      include: {
        items: {
          include: {
            product: {
              include: {
                productImages: {
                  where: { isFeatured: true },
                  take: 1,
                },
              },
            },
            variant: true,
          },
        },
      },
    });

    if (!wishlist) {
      wishlist = await prisma.wishlist.create({
        data: { userId },
        include: {
          items: {
            include: {
              product: {
                include: {
                  productImages: {
                    where: { isFeatured: true },
                    take: 1,
                  },
                },
              },
              variant: true,
            },
          },
        },
      });
    }

    return wishlist;
  }

  async addToWishlist(userId: string, productId: string, variantId?: string) {
    const wishlist = await this.getOrCreateWishlist(userId);

    // Check if already in wishlist
    const existingItem = wishlist.items.find(item =>
      item.productId === productId && item.variantId === variantId
    );

    if (existingItem) {
      throw new ConflictException('Item already in wishlist');
    }

    const wishlistItem = await prisma.wishlistItem.create({
      data: {
        wishlistId: wishlist.id,
        productId,
        variantId,
      },
    });

    // Update wishlist count
    await prisma.wishlist.update({
      where: { id: wishlist.id },
      data: {
        itemCount: { increment: 1 },
      },
    });

    return this.getOrCreateWishlist(userId);
  }

  async removeFromWishlist(userId: string, itemId: string) {
    const wishlistItem = await prisma.wishlistItem.findFirst({
      where: {
        id: itemId,
        wishlist: { userId },
      },
    });

    if (!wishlistItem) {
      throw new NotFoundException('Wishlist item not found');
    }

    await prisma.wishlistItem.delete({
      where: { id: itemId },
    });

    // Update wishlist count
    await prisma.wishlist.update({
      where: { id: wishlistItem.wishlistId },
      data: {
        itemCount: { decrement: 1 },
      },
    });

    return this.getOrCreateWishlist(userId);
  }

  // Subscription Management
  async createSubscription(userId: string, createSubscriptionDto: CreateSubscriptionDto) {
    const plan = await prisma.subscriptionPlan.findUnique({
      where: { id: createSubscriptionDto.planId },
    });

    if (!plan) {
      throw new NotFoundException('Subscription plan not found');
    }

    // Check if user already has active subscription
    const existingSubscription = await prisma.subscription.findFirst({
      where: {
        userId,
        status: 'ACTIVE',
      },
    });

    if (existingSubscription) {
      throw new BadRequestException('User already has an active subscription');
    }

    // Calculate period dates
    const now = new Date();
    const endDate = new Date(now);

    switch (plan.interval) {
      case 'DAY':
        endDate.setDate(endDate.getDate() + plan.intervalCount);
        break;
      case 'WEEK':
        endDate.setDate(endDate.getDate() + (plan.intervalCount * 7));
        break;
      case 'MONTH':
        endDate.setMonth(endDate.getMonth() + plan.intervalCount);
        break;
      case 'YEAR':
        endDate.setFullYear(endDate.getFullYear() + plan.intervalCount);
        break;
    }

    // Add trial days if applicable
    if (plan.trialDays > 0) {
      endDate.setDate(endDate.getDate() + plan.trialDays);
    }

    const subscription = await prisma.subscription.create({
      data: {
        userId,
        planId: plan.id,
        status: plan.trialDays > 0 ? 'TRIALING' : 'ACTIVE',
        currentPeriodStart: now,
        currentPeriodEnd: endDate,
        cancelAtPeriodEnd: false,
      },
    });

    // Update user membership in user service (via message queue or direct call)
    await this.updateUserMembership(userId, plan.name);

    return subscription;
  }

  // Analytics
  async getSalesAnalytics(filters: any) {
    const { startDate, endDate, groupBy = 'day' } = filters;

    const where: any = {
      status: { in: ['DELIVERED', 'COMPLETED'] },
      createdAt: {},
    };

    if (startDate) where.createdAt.gte = new Date(startDate);
    if (endDate) where.createdAt.lte = new Date(endDate);

    const orders = await prisma.order.findMany({
      where,
      include: {
        items: true,
      },
      orderBy: { createdAt: 'asc' },
    });

    // Group orders by time period
    const groupedData = this.groupOrdersByPeriod(orders, groupBy);

    const totalRevenue = orders.reduce((sum, order) => sum + order.totalAmount, 0);
    const totalOrders = orders.length;
    const averageOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;

    // Top products
    const productSales = {};
    orders.forEach(order => {
      order.items.forEach(item => {
        const productId = item.productId;
        productSales[productId] = (productSales[productId] || 0) + item.totalPrice;
      });
    });

    const topProducts = Object.entries(productSales)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)
      .map(([productId, revenue]) => ({ productId, revenue }));

    return {
      summary: {
        totalRevenue,
        totalOrders,
        averageOrderValue,
      },
      timeSeries: groupedData,
      topProducts,
    };
  }

  // ============ NEWLY ADDED METHODS ============

  // Payment methods
  async createPaymentIntent(orderId: string, amount: number, currency: string = 'usd') {
    // Validate order exists
    const order = await prisma.order.findUnique({
      where: { id: orderId },
    });

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    // Check if order already has payment
    if (order.paymentStatus === 'PAID') {
      throw new BadRequestException('Order is already paid');
    }

    // Create payment intent using payment service
    const paymentIntent = await this.paymentService.createPaymentIntent(orderId, amount, currency);
    
    // Update order with payment intent
    await prisma.order.update({
      where: { id: orderId },
      data: {
        paymentIntentId: paymentIntent.id,
        paymentStatus: 'PENDING',
      },
    });

    return paymentIntent;
  }

  async confirmPayment(paymentIntentId: string) {
    const order = await prisma.order.findFirst({
      where: { paymentIntentId },
    });

    if (!order) {
      throw new NotFoundException('Order not found for this payment intent');
    }

    const paymentResult = await this.paymentService.confirmPayment(paymentIntentId);
    
    if (paymentResult.status === 'succeeded') {
      await prisma.order.update({
        where: { id: order.id },
        data: {
          paymentStatus: 'PAID',
          paidAt: new Date(),
          status: 'CONFIRMED', // Move order to confirmed status
        },
      });
    }

    return paymentResult;
  }

  async createRefund(paymentIntentId: string, amount?: number) {
    const order = await prisma.order.findFirst({
      where: { paymentIntentId },
    });

    if (!order) {
      throw new NotFoundException('Order not found for this payment intent');
    }

    // Check if order can be refunded
    if (!['PAID', 'PARTIALLY_REFUNDED'].includes(order.paymentStatus)) {
      throw new BadRequestException('Order cannot be refunded');
    }

    const refundResult = await this.paymentService.createRefund(paymentIntentId, amount);
    
    if (refundResult.status === 'succeeded') {
      const refundAmount = amount || order.totalAmount;
      const newPaymentStatus = amount && amount < order.totalAmount 
        ? 'PARTIALLY_REFUNDED' 
        : 'REFUNDED';

      await prisma.order.update({
        where: { id: order.id },
        data: {
          paymentStatus: newPaymentStatus,
          refundedAmount: {
            increment: refundAmount,
          },
          refundedAt: new Date(),
        },
      });
    }

    return refundResult;
  }

  // Shipping methods
  async calculateShipping(address: any, items: any[]) {
    if (!address || !items || items.length === 0) {
      throw new BadRequestException('Address and items are required');
    }

    // Calculate total weight and dimensions
    let totalWeight = 0;
    let totalValue = 0;
    let isFragile = false;
    let isInternational = address.country !== 'US'; // Example

    for (const item of items) {
      const product = await prisma.product.findUnique({
        where: { id: item.productId },
      });

      if (product) {
        totalWeight += product.weight * item.quantity;
        totalValue += product.price * item.quantity;
        if (product.isFragile) isFragile = true;
      }
    }

    // Prepare shipping request
    const shippingRequest = {
      address,
      totalWeight,
      totalValue,
      isFragile,
      isInternational,
      itemCount: items.length,
    };

    return this.shippingService.calculateShipping(shippingRequest);
  }

  async createShipment(orderId: string, shippingMethod: any) {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: { items: true },
    });

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    if (order.status !== 'CONFIRMED' && order.status !== 'PROCESSING') {
      throw new BadRequestException(`Order cannot be shipped in ${order.status} status`);
    }

    const shipment = await this.shippingService.createShipment(orderId, {
      ...shippingMethod,
      orderNumber: order.orderNumber,
      shippingAddress: order.shippingAddress,
      items: order.items,
    });

    // Update order with shipment info
    await prisma.order.update({
      where: { id: orderId },
      data: {
        status: 'SHIPPED',
        shippingMethod: shippingMethod.name,
        shippingCost: shippingMethod.cost,
        trackingNumber: shipment.trackingNumber,
        shippedAt: new Date(),
      },
    });

    return shipment;
  }

  async trackShipment(trackingNumber: string) {
    if (!trackingNumber) {
      throw new BadRequestException('Tracking number is required');
    }

    const order = await prisma.order.findFirst({
      where: { trackingNumber },
    });

    if (!order) {
      throw new NotFoundException('Order not found for this tracking number');
    }

    return this.shippingService.trackShipment(trackingNumber);
  }

  // Supplier methods
  async createSupplier(data: any) {
    // Validate required fields
    if (!data.name || !data.email) {
      throw new BadRequestException('Supplier name and email are required');
    }

    // Check if supplier already exists
    const existingSupplier = await prisma.supplier.findUnique({
      where: { email: data.email },
    });

    if (existingSupplier) {
      throw new ConflictException('Supplier with this email already exists');
    }

    return this.supplierService.createSupplier(data);
  }

  async listSuppliers(filters: any) {
    const { search, page = 1, limit = 20 } = filters;
    const skip = (page - 1) * limit;

    const where: any = {};
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
        { company: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [suppliers, total] = await Promise.all([
      prisma.supplier.findMany({
        where,
        include: {
          _count: {
            select: {
              products: true,
              purchaseOrders: true,
            },
          },
        },
        skip,
        take: limit,
        orderBy: { name: 'asc' },
      }),
      prisma.supplier.count({ where }),
    ]);

    return {
      suppliers,
      pagination: {
        total,
        page: parseInt(page.toString()),
        limit: parseInt(limit.toString()),
        pages: Math.ceil(total / limit),
      },
    };
  }

  async createPurchaseOrder(supplierId: string, items: any[]) {
    if (!items || items.length === 0) {
      throw new BadRequestException('Purchase order items are required');
    }

    // Validate supplier exists
    const supplier = await prisma.supplier.findUnique({
      where: { id: supplierId },
    });

    if (!supplier) {
      throw new NotFoundException('Supplier not found');
    }

    // Calculate totals
    let subtotal = 0;
    for (const item of items) {
      const product = await prisma.product.findUnique({
        where: { id: item.productId },
      });

      if (product) {
        item.unitPrice = product.costPrice || product.price * 0.6; // 40% margin
        item.totalPrice = item.unitPrice * item.quantity;
        subtotal += item.totalPrice;
      }
    }

    const tax = subtotal * 0.1; // 10% tax
    const shipping = 50; // Fixed shipping cost
    const total = subtotal + tax + shipping;

    // Generate PO number
    const poNumber = `PO-${Date.now().toString().substring(5)}`;

    // Create purchase order
    const purchaseOrder = await prisma.purchaseOrder.create({
      data: {
        poNumber,
        supplierId,
        status: 'PENDING',
        subtotal,
        tax,
        shipping,
        total,
        expectedDelivery: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days from now
      },
    });

    // Create purchase order items
    for (const item of items) {
      await prisma.purchaseOrderItem.create({
        data: {
          purchaseOrderId: purchaseOrder.id,
          productId: item.productId,
          variantId: item.variantId,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          totalPrice: item.totalPrice,
        },
      });
    }

    return this.supplierService.createPurchaseOrder(supplierId, {
      ...purchaseOrder,
      items,
    });
  }

  async receivePurchaseOrder(poId: string, receivedItems: any[]) {
    const purchaseOrder = await prisma.purchaseOrder.findUnique({
      where: { id: poId },
      include: { items: true },
    });

    if (!purchaseOrder) {
      throw new NotFoundException('Purchase order not found');
    }

    if (purchaseOrder.status === 'RECEIVED') {
      throw new BadRequestException('Purchase order already received');
    }

    // Update inventory
    for (const receivedItem of receivedItems) {
      const poItem = purchaseOrder.items.find(item => item.id === receivedItem.itemId);
      if (poItem) {
        const quantity = receivedItem.quantity || poItem.quantity;
        
        if (poItem.variantId) {
          await prisma.productVariant.update({
            where: { id: poItem.variantId },
            data: {
              stockQuantity: { increment: quantity },
            },
          });
        } else {
          await prisma.product.update({
            where: { id: poItem.productId },
            data: {
              stockQuantity: { increment: quantity },
            },
          });
        }

        // Create inventory transaction
        await prisma.inventoryTransaction.create({
          data: {
            productId: poItem.productId,
            variantId: poItem.variantId,
            type: 'PURCHASE',
            quantity,
            unitCost: poItem.unitPrice,
            totalCost: poItem.unitPrice * quantity,
            reference: purchaseOrder.poNumber,
            notes: `Received from PO ${purchaseOrder.poNumber}`,
          },
        });
      }
    }

    // Update purchase order status
    await prisma.purchaseOrder.update({
      where: { id: poId },
      data: {
        status: 'RECEIVED',
        receivedAt: new Date(),
      },
    });

    return this.supplierService.receivePurchaseOrder(poId, receivedItems);
  }

  // Inventory methods
  async getInventoryTransactions(filters: any) {
    const {
      productId,
      variantId,
      type,
      startDate,
      endDate,
      page = 1,
      limit = 50,
    } = filters;

    const skip = (page - 1) * limit;
    const where: any = {};

    if (productId) where.productId = productId;
    if (variantId) where.variantId = variantId;
    if (type) where.type = type;
    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt.gte = new Date(startDate);
      if (endDate) where.createdAt.lte = new Date(endDate);
    }

    const [transactions, total] = await Promise.all([
      prisma.inventoryTransaction.findMany({
        where,
        include: {
          product: true,
          variant: true,
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.inventoryTransaction.count({ where }),
    ]);

    return {
      transactions,
      pagination: {
        total,
        page: parseInt(page.toString()),
        limit: parseInt(limit.toString()),
        pages: Math.ceil(total / limit),
      },
    };
  }

  async getLowStockAlerts(threshold: number = 10) {
    const products = await prisma.product.findMany({
      where: {
        trackInventory: true,
        stockQuantity: {
          gt: 0,
          lte: threshold,
        },
        status: {
          not: 'DISCONTINUED',
        },
      },
      include: {
        category: true,
        variants: {
          where: {
            trackInventory: true,
            stockQuantity: {
              gt: 0,
              lte: threshold,
            },
          },
        },
      },
      orderBy: { stockQuantity: 'asc' },
    });

    const variants = await prisma.productVariant.findMany({
      where: {
        trackInventory: true,
        stockQuantity: {
          gt: 0,
          lte: threshold,
        },
        product: {
          status: {
            not: 'DISCONTINUED',
          },
        },
      },
      include: {
        product: true,
      },
      orderBy: { stockQuantity: 'asc' },
    });

    return {
      products,
      variants,
      totalAlerts: products.length + variants.length,
    };
  }

  // Analytics methods
  async getProductAnalytics(filters: any) {
    const { startDate, endDate, groupBy = 'month' } = filters;
    
    const where: any = {
      status: { in: ['DELIVERED', 'COMPLETED'] },
    };
    
    if (startDate) where.createdAt.gte = new Date(startDate);
    if (endDate) where.createdAt.lte = new Date(endDate);
    
    const orders = await prisma.order.findMany({
      where,
      include: {
        items: {
          include: {
            product: true,
          },
        },
      },
    });
    
    // Aggregate product sales
    const productSales: Record<string, any> = {};
    const categorySales: Record<string, any> = {};
    
    orders.forEach(order => {
      order.items.forEach(item => {
        // Product sales
        if (!productSales[item.productId]) {
          productSales[item.productId] = {
            productId: item.productId,
            name: item.name,
            totalSales: 0,
            totalQuantity: 0,
            totalRevenue: 0,
          };
        }
        productSales[item.productId].totalSales++;
        productSales[item.productId].totalQuantity += item.quantity;
        productSales[item.productId].totalRevenue += item.totalPrice;
        
        // Category sales
        if (item.product.categoryId) {
          if (!categorySales[item.product.categoryId]) {
            categorySales[item.product.categoryId] = {
              totalRevenue: 0,
              totalOrders: 0,
            };
          }
          categorySales[item.product.categoryId].totalRevenue += item.totalPrice;
          categorySales[item.product.categoryId].totalOrders++;
        }
      });
    });
    
    return {
      topProducts: Object.values(productSales)
        .sort((a: any, b: any) => b.totalRevenue - a.totalRevenue)
        .slice(0, 10),
      categoryPerformance: categorySales,
      totalOrders: orders.length,
      totalRevenue: orders.reduce((sum, order) => sum + order.totalAmount, 0),
    };
  }

  async getInventoryAnalytics() {
    const totalProducts = await prisma.product.count();
    const outOfStock = await prisma.product.count({
      where: {
        trackInventory: true,
        stockQuantity: { lte: 0 },
      },
    });
    
    const lowStock = await prisma.product.count({
      where: {
        trackInventory: true,
        stockQuantity: { 
          gt: 0,
          lte: 10, // Default threshold
        },
      },
    });
    
    const inventoryValue = await prisma.$queryRaw`
      SELECT SUM(p.stock_quantity * COALESCE(p.cost_price, p.price * 0.6)) as total_value
      FROM products p
      WHERE p.track_inventory = true
    `;
    
    return {
      summary: {
        totalProducts,
        outOfStock,
        lowStock,
        inStock: totalProducts - outOfStock,
        inventoryValue: inventoryValue[0]?.total_value || 0,
      },
      metrics: {
        stockTurnover: await this.calculateStockTurnover(),
        inventoryAge: await this.calculateInventoryAge(),
      },
    };
  }

  // ============ END OF NEW METHODS ============

  // Helper Methods
  private async createProductVariants(productId: string, variants: any[]) {
    for (const variant of variants) {
      const sku = variant.sku || this.generateSKU(variant.option1 || 'variant');
      await prisma.productVariant.create({
        data: {
          productId,
          ...variant,
          sku,
          status: variant.status || 'ACTIVE',
        },
      });
    }
  }

  private async getProductWithDetails(productId: string) {
    return prisma.product.findUnique({
      where: { id: productId },
      include: {
        category: true,
        variants: true,
        productImages: {
          orderBy: { displayOrder: 'asc' },
        },
        reviews: {
          where: { status: 'APPROVED' },
          take: 5,
          include: {
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                avatar: true,
              },
            },
          },
        },
        _count: {
          select: {
            reviews: true,
          },
        },
      },
    });
  }

  private async getCartWithDetails(cartId: string) {
    return prisma.cart.findUnique({
      where: { id: cartId },
      include: {
        items: {
          include: {
            product: {
              include: {
                productImages: {
                  where: { isFeatured: true },
                  take: 1,
                },
              },
            },
            variant: true,
          },
        },
      },
    });
  }

  private async getOrderWithDetails(orderId: string) {
    return prisma.order.findUnique({
      where: { id: orderId },
      include: {
        items: {
          include: {
            product: {
              include: {
                productImages: {
                  where: { isFeatured: true },
                  take: 1,
                },
              },
            },
            variant: true,
          },
        },
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
      },
    });
  }

  private async updateCartTotals(cartId: string) {
    const items = await prisma.cartItem.findMany({
      where: { cartId },
      include: {
        product: true,
      },
    });

    const subtotal = items.reduce((sum, item) => sum + item.totalPrice, 0);
    const totalQuantity = items.reduce((sum, item) => sum + item.quantity, 0);
    
    // Calculate tax (simplified - 10%)
    const tax = subtotal * 0.1;
    
    // Apply discount if any
    const cart = await prisma.cart.findUnique({
      where: { id: cartId },
    });

    const discount = cart?.discount || 0;
    const shipping = cart?.shipping || 0;
    const totalAmount = subtotal + tax + shipping - discount;

    await prisma.cart.update({
      where: { id: cartId },
      data: {
        itemCount: items.length,
        totalQuantity,
        subtotal,
        tax,
        discount,
        shipping,
        totalAmount,
      },
    });
  }

  private async updateProductRating(productId: string) {
    const reviews = await prisma.review.findMany({
      where: {
        productId,
        status: 'APPROVED',
      },
      select: { rating: true },
    });

    if (reviews.length > 0) {
      const averageRating = reviews.reduce((sum, review) => sum + review.rating, 0) / reviews.length;
      
      await prisma.product.update({
        where: { id: productId },
        data: {
          rating: averageRating,
          reviewCount: reviews.length,
        },
      });
    }
  }

  private validateOrderStatusTransition(currentStatus: string, newStatus: string) {
    const validTransitions: Record<string, string[]> = {
      PENDING: ['CONFIRMED', 'CANCELLED'],
      CONFIRMED: ['PROCESSING', 'CANCELLED'],
      PROCESSING: ['SHIPPED', 'CANCELLED'],
      SHIPPED: ['DELIVERED', 'RETURNED'],
      DELIVERED: ['RETURNED'],
      CANCELLED: [],
      REFUNDED: [],
    };

    if (!validTransitions[currentStatus]?.includes(newStatus)) {
      throw new BadRequestException(`Cannot transition from ${currentStatus} to ${newStatus}`);
    }
  }

  private groupOrdersByPeriod(orders: any[], groupBy: string) {
    const groups: Record<string, any> = {};
    
    orders.forEach(order => {
      const date = new Date(order.createdAt);
      let key: string;
      
      switch (groupBy) {
        case 'day':
          key = date.toISOString().split('T')[0];
          break;
        case 'week':
          const weekStart = new Date(date);
          weekStart.setDate(date.getDate() - date.getDay());
          key = weekStart.toISOString().split('T')[0];
          break;
        case 'month':
          key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
          break;
        default:
          key = date.toISOString().split('T')[0];
      }
      
      if (!groups[key]) {
        groups[key] = {
          date: key,
          revenue: 0,
          orders: 0,
        };
      }
      
      groups[key].revenue += order.totalAmount;
      groups[key].orders += 1;
    });
    
    return Object.values(groups);
  }

  private async calculateStockTurnover() {
    // Calculate stock turnover ratio
    const lastMonth = new Date();
    lastMonth.setMonth(lastMonth.getMonth() - 1);
    
    const salesLastMonth = await prisma.orderItem.aggregate({
      where: {
        order: {
          status: { in: ['DELIVERED', 'COMPLETED'] },
          createdAt: { gte: lastMonth },
        },
      },
      _sum: {
        quantity: true,
        totalPrice: true,
      },
    });
    
    const avgInventory = await prisma.$queryRaw`
      SELECT AVG(stock_quantity) as avg_inventory
      FROM products
      WHERE track_inventory = true
    `;
    
    const turnover = salesLastMonth._sum.quantity / ((avgInventory as any)[0]?.avg_inventory || 1);
    return turnover.toFixed(2);
  }

  private async calculateInventoryAge() {
    // Calculate average inventory age
    const products = await prisma.product.findMany({
      where: { trackInventory: true },
      select: { 
        stockQuantity: true,
        createdAt: true,
        updatedAt: true,
      },
    });
    
    if (products.length === 0) return "0";
    
    const now = new Date();
    let totalDays = 0;
    let totalQuantity = 0;
    
    products.forEach(product => {
      const lastUpdate = product.updatedAt || product.createdAt;
      const ageInDays = (now.getTime() - lastUpdate.getTime()) / (1000 * 60 * 60 * 24);
      totalDays += ageInDays * product.stockQuantity;
      totalQuantity += product.stockQuantity;
    });
    
    return totalQuantity > 0 ? (totalDays / totalQuantity).toFixed(1) : '0';
  }

  private generateSlug(name: string): string {
    return name
      .toLowerCase()
      .replace(/[^\w\s]/gi, '')
      .replace(/\s+/g, '-')
      .substring(0, 50);
  }

  private generateSKU(name: string): string {
    const prefix = name.substring(0, 3).toUpperCase();
    const random = Math.random().toString(36).substring(2, 8).toUpperCase();
    const timestamp = Date.now().toString().substring(8);
    return `${prefix}-${random}-${timestamp}`;
  }

  private generateOrderNumber(): string {
    const timestamp = Date.now().toString().substring(5);
    const random = Math.random().toString(36).substring(2, 6).toUpperCase();
    return `ORD-${timestamp}-${random}`;
  }

  private generateDigitalFileUrl(productId: string): string {
    return `https://digital.yogaspa.com/products/${productId}/download`;
  }

  private generateDownloadKey(): string {
    return crypto.randomBytes(16).toString('hex');
  }

  private async sendOrderConfirmation(orderId: string) {
    // Implementation depends on notification service
    console.log(`Sending order confirmation for order ${orderId}`);
  }

  private async sendOrderStatusUpdate(orderId: string, status: string) {
    console.log(`Sending order status update for order ${orderId}: ${status}`);
  }

  private async sendOrderCancellation(orderId: string) {
    console.log(`Sending order cancellation for order ${orderId}`);
  }

  private async updateUserMembership(userId: string, planName: string) {
    // This would typically call user-service or use a message queue
    console.log(`Updating user ${userId} membership to ${planName}`);
  }

  async checkDatabase() {
    try {
      await prisma.$queryRaw`SELECT 1`;
      return 'connected';
    } catch (error) {
      return 'disconnected';
    }
  }
}