import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

@Injectable()
export class SupplierService {
  async createSupplier(data: any) {
    const supplier = await prisma.supplier.create({
      data: {
        name: data.name,
        email: data.email,
        phone: data.phone,
        address: data.address,
        taxId: data.taxId,
        contactPerson: data.contactPerson,
        paymentTerms: data.paymentTerms || 'NET30',
        minimumOrder: data.minimumOrder || 0,
        leadTime: data.leadTime || 7,
        status: 'ACTIVE',
      },
    });

    return supplier;
  }

  async getSuppliers(filters: any) {
    const { search, status, page = 1, limit = 20 } = filters;
    const skip = (page - 1) * limit;

    const where: any = {};
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
        { contactPerson: { contains: search, mode: 'insensitive' } },
      ];
    }
    if (status) where.status = status;

    const [suppliers, total] = await Promise.all([
      prisma.supplier.findMany({
        where,
        include: {
          _count: {
            select: { products: true, purchaseOrders: true },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.supplier.count({ where }),
    ]);

    return {
      suppliers,
      pagination: {
        total,
        page,
        limit,
        pages: Math.ceil(total / limit),
      },
    };
  }

  async createPurchaseOrder(supplierId: string, items: any[]) {
    const supplier = await prisma.supplier.findUnique({
      where: { id: supplierId },
    });

    if (!supplier) {
      throw new NotFoundException('Supplier not found');
    }

    // Calculate totals
    let subtotal = 0;
    const poItems = items.map(item => {
      const total = item.quantity * item.unitPrice;
      subtotal += total;
      return {
        productId: item.productId,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        total,
        expectedDelivery: item.expectedDelivery,
      };
    });

    const tax = subtotal * 0.1; // 10% tax
    const totalAmount = subtotal + tax;

    const purchaseOrder = await prisma.purchaseOrder.create({
      data: {
        supplierId,
        poNumber: `PO${Date.now()}`,
        items: poItems,
        subtotal,
        tax,
        totalAmount,
        status: 'PENDING',
        expectedDelivery: items[0]?.expectedDelivery,
      },
      include: {
        supplier: true,
      },
    });

    return purchaseOrder;
  }

  async receivePurchaseOrder(poId: string, receivedItems: any[]) {
    const purchaseOrder = await prisma.purchaseOrder.findUnique({
      where: { id: poId },
      include: { items: true },
    });

    if (!purchaseOrder) {
      throw new NotFoundException('Purchase order not found');
    }

    // Update inventory for received items
    for (const receivedItem of receivedItems) {
      const poItem = purchaseOrder.items.find(item => item.productId === receivedItem.productId);
      if (poItem) {
        await prisma.product.update({
          where: { id: receivedItem.productId },
          data: {
            stockQuantity: { increment: receivedItem.quantityReceived },
          },
        });

        // Create inventory transaction
        await prisma.inventoryTransaction.create({
          data: {
            productId: receivedItem.productId,
            type: 'PURCHASE',
            quantity: receivedItem.quantityReceived,
            unitCost: poItem.unitPrice,
            referenceId: poId,
            notes: `Received from PO ${purchaseOrder.poNumber}`,
          },
        });
      }
    }

    // Update PO status
    const allReceived = purchaseOrder.items.every(poItem => {
      const received = receivedItems.find(ri => ri.productId === poItem.productId);
      return received && received.quantityReceived >= poItem.quantity;
    });

    const updatedPO = await prisma.purchaseOrder.update({
      where: { id: poId },
      data: {
        status: allReceived ? 'COMPLETED' : 'PARTIALLY_RECEIVED',
        receivedAt: new Date(),
      },
    });

    return updatedPO;
  }

  async getInventoryTransactions(filters: any) {
    const { productId, type, startDate, endDate, page = 1, limit = 20 } = filters;
    const skip = (page - 1) * limit;

    const where: any = {};
    if (productId) where.productId = productId;
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
          product: {
            select: { name: true, sku: true },
          },
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
        page,
        limit,
        pages: Math.ceil(total / limit),
      },
    };
  }

  async getLowStockAlerts(threshold: number = 10) {
    const products = await prisma.product.findMany({
      where: {
        trackInventory: true,
        stockQuantity: { lte: threshold },
        status: 'ACTIVE',
      },
      include: {
        category: true,
        variants: {
          where: {
            trackInventory: true,
            stockQuantity: { lte: threshold },
          },
        },
      },
    });

    return products.map(product => ({
      productId: product.id,
      name: product.name,
      sku: product.sku,
      currentStock: product.stockQuantity,
      lowStockThreshold: product.lowStockThreshold,
      variants: product.variants.map(variant => ({
        variantId: variant.id,
        option1: variant.option1,
        sku: variant.sku,
        currentStock: variant.stockQuantity,
      })),
    }));
  }
}