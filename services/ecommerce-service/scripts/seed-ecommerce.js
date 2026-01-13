const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');

const prisma = new PrismaClient();

async function seedDatabase() {
  console.log('🌱 Seeding e-commerce database...');

  try {
    // Clear existing data
    await prisma.$executeRaw`TRUNCATE TABLE products, categories, users, orders, cart_items RESTART IDENTITY CASCADE;`;

    // Create categories
    const categories = await Promise.all([
      prisma.category.create({
        data: {
          name: 'Yoga Mats',
          slug: 'yoga-mats',
          description: 'Premium yoga mats for all levels',
          image: '/images/categories/yoga-mats.jpg',
        },
      }),
      prisma.category.create({
        data: {
          name: 'Yoga Clothing',
          slug: 'yoga-clothing',
          description: 'Comfortable yoga wear',
          image: '/images/categories/yoga-clothing.jpg',
        },
      }),
      prisma.category.create({
        data: {
          name: 'Accessories',
          slug: 'accessories',
          description: 'Yoga blocks, straps, and more',
          image: '/images/categories/accessories.jpg',
        },
      }),
      prisma.category.create({
        data: {
          name: 'Meditation',
          slug: 'meditation',
          description: 'Meditation cushions and tools',
          image: '/images/categories/meditation.jpg',
        },
      }),
    ]);

    // Create products
    const products = await Promise.all([
      prisma.product.create({
        data: {
          name: 'Premium Eco Yoga Mat',
          slug: 'premium-eco-yoga-mat',
          sku: 'YM-001',
          description: 'Extra thick eco-friendly yoga mat with non-slip surface',
          shortDescription: 'Eco-friendly, non-slip, 6mm thickness',
          price: 89.99,
          compareAtPrice: 109.99,
          costPrice: 45.00,
          stockQuantity: 50,
          lowStockThreshold: 10,
          trackInventory: true,
          allowBackorders: false,
          isDigital: false,
          weight: 2.5,
          dimensions: { length: 72, width: 24, height: 0.6 },
          categoryId: categories[0].id,
          brand: 'EcoYoga',
          tags: ['eco-friendly', 'non-slip', 'thick'],
          images: ['/images/products/yoga-mat-1.jpg', '/images/products/yoga-mat-2.jpg'],
          featuredImage: '/images/products/yoga-mat-1.jpg',
          hasVariants: true,
          variantOptions: [
            { name: 'Color', values: ['Purple', 'Blue', 'Green', 'Black'] },
            { name: 'Thickness', values: ['6mm', '8mm'] },
          ],
          metaTitle: 'Premium Eco Yoga Mat | Yoga Spa Store',
          metaDescription: 'Buy the best eco-friendly yoga mat with non-slip surface',
          metaKeywords: ['yoga mat', 'eco', 'non-slip', 'premium'],
          status: 'ACTIVE',
          visibility: 'VISIBLE',
          isFeatured: true,
          isBestSeller: true,
          isNew: true,
        },
      }),
      prisma.product.create({
        data: {
          name: 'Yoga Leggings',
          slug: 'yoga-leggings',
          sku: 'YL-001',
          description: 'High-waisted yoga leggings with moisture-wicking fabric',
          shortDescription: 'Moisture-wicking, high-waisted, flexible',
          price: 49.99,
          compareAtPrice: 59.99,
          costPrice: 25.00,
          stockQuantity: 100,
          lowStockThreshold: 20,
          trackInventory: true,
          allowBackorders: true,
          isDigital: false,
          weight: 0.3,
          dimensions: { length: 40, width: 30, height: 2 },
          categoryId: categories[1].id,
          brand: 'FlexiWear',
          tags: ['leggings', 'high-waisted', 'moisture-wicking'],
          images: ['/images/products/leggings-1.jpg', '/images/products/leggings-2.jpg'],
          featuredImage: '/images/products/leggings-1.jpg',
          hasVariants: true,
          variantOptions: [
            { name: 'Size', values: ['XS', 'S', 'M', 'L', 'XL'] },
            { name: 'Color', values: ['Black', 'Gray', 'Blue', 'Purple'] },
          ],
          status: 'ACTIVE',
          visibility: 'VISIBLE',
          isBestSeller: true,
        },
      }),
      prisma.product.create({
        data: {
          name: 'Yoga Blocks Set',
          slug: 'yoga-blocks-set',
          sku: 'YB-001',
          description: 'Set of 2 high-density foam yoga blocks for support and alignment',
          shortDescription: 'Set of 2, high-density foam, lightweight',
          price: 29.99,
          compareAtPrice: 39.99,
          costPrice: 15.00,
          stockQuantity: 75,
          lowStockThreshold: 15,
          trackInventory: true,
          allowBackorders: false,
          isDigital: false,
          weight: 0.8,
          dimensions: { length: 23, width: 15, height: 7.6 },
          categoryId: categories[2].id,
          brand: 'YogaEssentials',
          tags: ['blocks', 'foam', 'support'],
          images: ['/images/products/blocks-1.jpg'],
          featuredImage: '/images/products/blocks-1.jpg',
          status: 'ACTIVE',
          visibility: 'VISIBLE',
          isNew: true,
        },
      }),
    ]);

    // Create product variants
    await prisma.productVariant.createMany({
      data: [
        {
          productId: products[0].id,
          option1: 'Purple',
          option2: '6mm',
          sku: 'YM-001-PURPLE-6MM',
          price: 89.99,
          compareAtPrice: 109.99,
          costPrice: 45.00,
          stockQuantity: 20,
          trackInventory: true,
          image: '/images/products/yoga-mat-purple.jpg',
          status: 'ACTIVE',
        },
        {
          productId: products[0].id,
          option1: 'Blue',
          option2: '6mm',
          sku: 'YM-001-BLUE-6MM',
          price: 89.99,
          compareAtPrice: 109.99,
          costPrice: 45.00,
          stockQuantity: 15,
          trackInventory: true,
          image: '/images/products/yoga-mat-blue.jpg',
          status: 'ACTIVE',
        },
        {
          productId: products[1].id,
          option1: 'S',
          option2: 'Black',
          sku: 'YL-001-S-BLACK',
          price: 49.99,
          compareAtPrice: 59.99,
          costPrice: 25.00,
          stockQuantity: 30,
          trackInventory: true,
          status: 'ACTIVE',
        },
      ],
    });

    // Create test user
    const hashedPassword = await bcrypt.hash('password123', 10);
    const user = await prisma.user.create({
      data: {
        email: 'test@example.com',
        password: hashedPassword,
        firstName: 'Test',
        lastName: 'User',
        role: 'MEMBER',
        status: 'ACTIVE',
        emailVerified: true,
      },
    });

    // Create user profile
    await prisma.userProfile.create({
      data: {
        userId: user.id,
        experienceLevel: 'intermediate',
        preferredStyles: ['vinyasa', 'hatha'],
        goals: ['flexibility', 'strength'],
        receiveEmails: true,
        receivePush: true,
      },
    });

    // Create test cart
    const cart = await prisma.cart.create({
      data: {
        userId: user.id,
        sessionId: 'test-session-123',
        customerEmail: user.email,
        itemCount: 2,
        subtotal: 139.98,
        tax: 13.99,
        shipping: 9.99,
        discount: 0,
        totalAmount: 163.96,
        currency: 'USD',
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
      },
    });

    // Add items to cart
    await prisma.cartItem.createMany({
      data: [
        {
          cartId: cart.id,
          productId: products[0].id,
          variantId: (await prisma.productVariant.findFirst({
            where: { productId: products[0].id }
          })).id,
          quantity: 1,
          price: 89.99,
          totalPrice: 89.99,
        },
        {
          cartId: cart.id,
          productId: products[1].id,
          variantId: (await prisma.productVariant.findFirst({
            where: { productId: products[1].id }
          })).id,
          quantity: 1,
          price: 49.99,
          totalPrice: 49.99,
        },
      ],
    });

    // Create test order
    const order = await prisma.order.create({
      data: {
        userId: user.id,
        orderNumber: `ORD-${Date.now().toString().substring(8)}`,
        customerEmail: user.email,
        customerName: 'Test User',
        customerPhone: '+1234567890',
        subtotal: 139.98,
        tax: 13.99,
        shipping: 9.99,
        discount: 0,
        totalAmount: 163.96,
        currency: 'USD',
        status: 'CONFIRMED',
        paymentStatus: 'COMPLETED',
        fulfillmentStatus: 'FULFILLED',
        shippingAddress: {
          street: '123 Main St',
          city: 'New York',
          state: 'NY',
          zipCode: '10001',
          country: 'US',
        },
        billingAddress: {
          street: '123 Main St',
          city: 'New York',
          state: 'NY',
          zipCode: '10001',
          country: 'US',
        },
        shippingMethod: 'Standard Shipping',
        paymentMethod: 'card',
        paymentGateway: 'stripe',
        transactionId: 'txn_123456789',
        paidAt: new Date(),
        shippedAt: new Date(),
      },
    });

    // Create order items
    await prisma.orderItem.createMany({
      data: [
        {
          orderId: order.id,
          productId: products[0].id,
          variantId: (await prisma.productVariant.findFirst({
            where: { productId: products[0].id }
          })).id,
          name: 'Premium Eco Yoga Mat - Purple, 6mm',
          sku: 'YM-001-PURPLE-6MM',
          quantity: 1,
          price: 89.99,
          compareAtPrice: 109.99,
          totalPrice: 89.99,
        },
        {
          orderId: order.id,
          productId: products[1].id,
          variantId: (await prisma.productVariant.findFirst({
            where: { productId: products[1].id }
          })).id,
          name: 'Yoga Leggings - S, Black',
          sku: 'YL-001-S-BLACK',
          quantity: 1,
          price: 49.99,
          compareAtPrice: 59.99,
          totalPrice: 49.99,
        },
      ],
    });

    // Create supplier
    const supplier = await prisma.supplier.create({
      data: {
        name: 'EcoYoga Supplies Inc.',
        email: 'orders@ecoyoga.com',
        phone: '+1-800-555-1234',
        address: {
          street: '456 Supplier Ave',
          city: 'Los Angeles',
          state: 'CA',
          zipCode: '90001',
          country: 'US',
        },
        taxId: 'TAX123456789',
        contactPerson: 'John Supplier',
        paymentTerms: 'NET30',
        minimumOrder: 100,
        leadTime: 14,
        status: 'ACTIVE',
      },
    });

    // Create coupon
    await prisma.coupon.create({
      data: {
        code: 'WELCOME10',
        description: 'Welcome discount for new customers',
        discountType: 'PERCENTAGE',
        discountValue: 10,
        minimumPurchase: 50,
        maximumDiscount: 20,
        usageLimit: 100,
        usageCount: 25,
        perUserLimit: 1,
        applicableTo: 'ALL',
        startsAt: new Date('2024-01-01'),
        expiresAt: new Date('2024-12-31'),
        isActive: true,
      },
    });

    console.log('✅ Database seeded successfully!');
    console.log('📦 Test products created:', products.length);
    console.log('👤 Test user created:', user.email);
    console.log('🛒 Test cart created with items');
    console.log('📋 Test order created:', order.orderNumber);
    console.log('🏭 Test supplier created:', supplier.name);

  } catch (error) {
    console.error('❌ Error seeding database:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Run seed
seedDatabase();