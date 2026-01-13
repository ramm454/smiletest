package ecommerce

import (
    "context"
    "fmt"
    "log"
    "time"
    
    "payment-service/models"
    "payment-service/services/notification"
)

type EcommercePaymentHandler struct {
    ecommerceClient     *EcommerceServiceClient
    notificationService *notification.NotificationService
    db                  interface{} // Your database interface
}

func NewEcommercePaymentHandler(ecommerceClient *EcommerceServiceClient, notificationService *notification.NotificationService, db interface{}) *EcommercePaymentHandler {
    return &EcommercePaymentHandler{
        ecommerceClient:     ecommerceClient,
        notificationService: notificationService,
        db:                  db,
    }
}

// HandleEcommercePayment processes payment for an ecommerce order
func (h *EcommercePaymentHandler) HandleEcommercePayment(ctx context.Context, payment models.Payment) error {
    log.Printf("Processing ecommerce payment: %s for order: %s", payment.ID, payment.OrderID)
    
    // Validate payment is for an order
    if payment.OrderID == "" {
        // Check if we need to create an order from payment metadata
        if _, hasItems := payment.Metadata["items"]; hasItems {
            return h.handlePaymentWithCart(ctx, payment)
        }
        return fmt.Errorf("payment %s is not associated with an order", payment.ID)
    }
    
    // Get order details
    order, err := h.ecommerceClient.GetOrder(ctx, payment.OrderID)
    if err != nil {
        return fmt.Errorf("failed to get order: %w", err)
    }
    
    // Update order payment status based on payment status
    switch payment.Status {
    case "succeeded", "captured":
        return h.handleSuccessfulOrderPayment(ctx, payment, order)
    case "failed", "canceled":
        return h.handleFailedOrderPayment(ctx, payment, order)
    case "refunded":
        return h.handleRefundedOrderPayment(ctx, payment, order)
    case "pending", "processing":
        return h.handlePendingOrderPayment(ctx, payment, order)
    default:
        return fmt.Errorf("unknown payment status: %s", payment.Status)
    }
}

func (h *EcommercePaymentHandler) handlePaymentWithCart(ctx context.Context, payment models.Payment) error {
    log.Printf("Creating order from cart payment: %s", payment.ID)
    
    // Create order from payment metadata (cart items)
    order, err := h.ecommerceClient.CreateOrderFromPayment(ctx, payment)
    if err != nil {
        return fmt.Errorf("failed to create order from payment: %w", err)
    }
    
    // Update payment with order ID
    payment.OrderID = order.ID
    // Save to database
    // h.db.Save(&payment)
    
    // Process the payment
    return h.handleSuccessfulOrderPayment(ctx, payment, order)
}

func (h *EcommercePaymentHandler) handleSuccessfulOrderPayment(ctx context.Context, payment models.Payment, order *Order) error {
    log.Printf("Order payment successful: %s for order: %s", payment.ID, order.ID)
    
    // Update order payment status
    updateReq := UpdateOrderPaymentRequest{
        PaymentID:     payment.ID,
        PaymentStatus: "completed",
        Gateway:       payment.Gateway,
        TransactionID: payment.GatewayPaymentID,
    }
    
    if err := h.ecommerceClient.UpdateOrderPaymentStatus(ctx, order.ID, updateReq); err != nil {
        return fmt.Errorf("failed to update order payment status: %w", err)
    }
    
    // Send confirmation notifications
    go h.sendOrderConfirmationNotifications(ctx, payment, order)
    
    // Process fulfillment based on product types
    go h.processOrderFulfillment(ctx, order)
    
    // Update inventory
    go h.updateInventory(ctx, order)
    
    return nil
}

func (h *EcommercePaymentHandler) handleFailedOrderPayment(ctx context.Context, payment models.Payment, order *Order) error {
    log.Printf("Order payment failed: %s for order: %s", payment.ID, order.ID)
    
    // Update order payment status
    updateReq := UpdateOrderPaymentRequest{
        PaymentID:     payment.ID,
        PaymentStatus: "failed",
        Gateway:       payment.Gateway,
        TransactionID: payment.GatewayPaymentID,
    }
    
    if err := h.ecommerceClient.UpdateOrderPaymentStatus(ctx, order.ID, updateReq); err != nil {
        return fmt.Errorf("failed to update order payment status: %w", err)
    }
    
    // Send failure notification
    if h.notificationService != nil {
        notification := notification.Notification{
            UserID:  order.UserID,
            Type:    "order_payment_failed",
            Title:   "Payment Failed for Your Order",
            Message: fmt.Sprintf("Payment for your order #%s failed. Please try again.", order.ID),
            Data: map[string]interface{}{
                "order_id":    order.ID,
                "total_amount": order.TotalAmount,
                "currency":     order.Currency,
                "items_count":  len(order.Items),
            },
        }
        h.notificationService.Send(ctx, notification)
    }
    
    return nil
}

func (h *EcommercePaymentHandler) handleRefundedOrderPayment(ctx context.Context, payment models.Payment, order *Order) error {
    log.Printf("Order payment refunded: %s for order: %s", payment.ID, order.ID)
    
    // Update order payment status
    updateReq := UpdateOrderPaymentRequest{
        PaymentID:     payment.ID,
        PaymentStatus: "refunded",
        Gateway:       payment.Gateway,
        TransactionID: payment.GatewayPaymentID,
    }
    
    if err := h.ecommerceClient.UpdateOrderPaymentStatus(ctx, order.ID, updateReq); err != nil {
        return fmt.Errorf("failed to update order payment status: %w", err)
    }
    
    // Restore inventory if needed
    go h.restoreInventory(ctx, order)
    
    // Send refund notification
    if h.notificationService != nil {
        notification := notification.Notification{
            UserID:  order.UserID,
            Type:    "order_refunded",
            Title:   "Order Refund Processed",
            Message: fmt.Sprintf("Your refund for order #%s has been processed.", order.ID),
            Data: map[string]interface{}{
                "order_id":     order.ID,
                "refund_amount": payment.Amount,
                "currency":      payment.Currency,
                "refund_date":   time.Now(),
            },
        }
        h.notificationService.Send(ctx, notification)
    }
    
    return nil
}

func (h *EcommercePaymentHandler) handlePendingOrderPayment(ctx context.Context, payment models.Payment, order *Order) error {
    log.Printf("Order payment pending: %s for order: %s", payment.ID, order.ID)
    
    // Update order payment status
    updateReq := UpdateOrderPaymentRequest{
        PaymentID:     payment.ID,
        PaymentStatus: "processing",
        Gateway:       payment.Gateway,
        TransactionID: payment.GatewayPaymentID,
    }
    
    if err := h.ecommerceClient.UpdateOrderPaymentStatus(ctx, order.ID, updateReq); err != nil {
        return fmt.Errorf("failed to update order payment status: %w", err)
    }
    
    return nil
}

func (h *EcommercePaymentHandler) processOrderFulfillment(ctx context.Context, order *Order) {
    // Process different product types differently
    
    for _, item := range order.Items {
        switch item.ProductType {
        case "digital", "ebook", "video":
            // Generate download links, send access emails
            h.fulfillDigitalProduct(ctx, order, item)
            
        case "yoga_mat", "blocks", "clothing", "accessory":
            // Physical product - process shipping
            h.fulfillPhysicalProduct(ctx, order, item)
            
        case "membership", "subscription":
            // Activate membership/subscription
            h.activateMembership(ctx, order, item)
            
        default:
            log.Printf("Unknown product type: %s", item.ProductType)
        }
    }
    
    // Mark order as fulfilled if all items are digital
    if h.isAllDigital(order) {
        if err := h.ecommerceClient.FulfillOrder(ctx, order.ID, "digital"); err != nil {
            log.Printf("Failed to fulfill digital order: %v", err)
        }
    }
}

func (h *EcommercePaymentHandler) fulfillDigitalProduct(ctx context.Context, order *Order, item OrderItem) {
    // Generate download/access token
    // Send email with access instructions
    log.Printf("Fulfilling digital product: %s for order: %s", item.ProductID, order.ID)
    
    if h.notificationService != nil {
        notification := notification.Notification{
            UserID:  order.UserID,
            Type:    "digital_product_access",
            Title:   "Your Digital Product is Ready!",
            Message: fmt.Sprintf("Access your %s using the link below.", item.ProductName),
            Data: map[string]interface{}{
                "order_id":    order.ID,
                "product_id":  item.ProductID,
                "product_name": item.ProductName,
                "access_url":  fmt.Sprintf("/downloads/%s?token=xxx", item.ProductID),
                "expires_at":  time.Now().AddDate(0, 0, 30), // 30 days access
            },
        }
        h.notificationService.Send(ctx, notification)
    }
}

func (h *EcommercePaymentHandler) fulfillPhysicalProduct(ctx context.Context, order *Order, item OrderItem) {
    // Create shipping label
    // Update order with tracking
    // Notify warehouse
    log.Printf("Processing physical product: %s for order: %s", item.ProductID, order.ID)
}

func (h *EcommercePaymentHandler) activateMembership(ctx context.Context, order *Order, item OrderItem) {
    // Activate user membership
    // Update user profile
    // Send welcome email
    log.Printf("Activating membership: %s for user: %s", item.ProductID, order.UserID)
}

func (h *EcommercePaymentHandler) isAllDigital(order *Order) bool {
    for _, item := range order.Items {
        if item.ProductType != "digital" && item.ProductType != "ebook" && 
           item.ProductType != "video" && item.ProductType != "membership" {
            return false
        }
    }
    return true
}

func (h *EcommercePaymentHandler) sendOrderConfirmationNotifications(ctx context.Context, payment models.Payment, order *Order) {
    // Send to user
    if h.notificationService != nil {
        userNotification := notification.Notification{
            UserID:  order.UserID,
            Type:    "order_confirmed",
            Title:   "Order Confirmed! 🎉",
            Message: fmt.Sprintf("Your order #%s has been confirmed. Total: %s %.2f", 
                order.ID, order.Currency, float64(order.TotalAmount)/100),
            Data: map[string]interface{}{
                "order_id":       order.ID,
                "total_amount":   order.TotalAmount,
                "currency":       order.Currency,
                "items_count":    len(order.Items),
                "shipping_address": order.ShippingAddress,
                "estimated_delivery": time.Now().AddDate(0, 0, 5).Format("Jan 2, 2006"),
            },
        }
        h.notificationService.Send(ctx, userNotification)
    }
    
    // Send to admin/warehouse if physical products
    if !h.isAllDigital(order) {
        // Send warehouse notification
        // This would integrate with your warehouse/fulfillment system
    }
}

func (h *EcommercePaymentHandler) updateInventory(ctx context.Context, order *Order) {
    // Update inventory levels for physical products
    for _, item := range order.Items {
        if item.ProductType == "yoga_mat" || item.ProductType == "blocks" || 
           item.ProductType == "clothing" || item.ProductType == "accessory" {
            log.Printf("Updating inventory for product: %s, quantity: %d", 
                item.ProductID, item.Quantity)
            // Call inventory service
        }
    }
}

func (h *EcommercePaymentHandler) restoreInventory(ctx context.Context, order *Order) {
    // Restore inventory for refunded physical products
    for _, item := range order.Items {
        if item.ProductType == "yoga_mat" || item.ProductType == "blocks" || 
           item.ProductType == "clothing" || item.ProductType == "accessory" {
            log.Printf("Restoring inventory for product: %s, quantity: %d", 
                item.ProductID, item.Quantity)
            // Call inventory service to restore stock
        }
    }
}