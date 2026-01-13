package handlers

import (
    "encoding/json"
    "io"
    "net/http"
    
    "github.com/gin-gonic/gin"
    "github.com/razorpay/razorpay-go"
)

type RazorPayWebhookService struct {
    paymentService *PaymentService
    razorpayClient *razorpay.Client
}

func NewRazorPayWebhookService(paymentService *PaymentService, keyID, keySecret string) *RazorPayWebhookService {
    client := razorpay.NewClient(keyID, keySecret)
    return &RazorPayWebhookService{
        paymentService: paymentService,
        razorpayClient: client,
    }
}

func (s *RazorPayWebhookService) HandleRazorPayWebhook(c *gin.Context) {
    body, err := io.ReadAll(c.Request.Body)
    if err != nil {
        c.JSON(http.StatusBadRequest, gin.H{"error": "Error reading request body"})
        return
    }
    
    // Verify webhook signature
    razorpaySignature := c.GetHeader("X-Razorpay-Signature")
    if !s.verifyWebhookSignature(body, razorpaySignature) {
        c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid webhook signature"})
        return
    }
    
    var webhookData map[string]interface{}
    if err := json.Unmarshal(body, &webhookData); err != nil {
        c.JSON(http.StatusBadRequest, gin.H{"error": "Error parsing webhook data"})
        return
    }
    
    event, _ := webhookData["event"].(string)
    
    switch event {
    case "payment.captured":
        s.handlePaymentCaptured(c, webhookData)
    case "payment.failed":
        s.handlePaymentFailed(c, webhookData)
    case "order.paid":
        s.handleOrderPaid(c, webhookData)
    case "refund.created":
        s.handleRefundCreated(c, webhookData)
    case "subscription.charged":
        s.handleSubscriptionCharged(c, webhookData)
    case "subscription.cancelled":
        s.handleSubscriptionCancelled(c, webhookData)
    default:
        c.JSON(http.StatusOK, gin.H{"status": "unhandled_event"})
    }
    
    c.JSON(http.StatusOK, gin.H{"status": "success"})
}

func (s *RazorPayWebhookService) verifyWebhookSignature(body []byte, signature string) bool {
    // In production, you should implement proper signature verification
    // RazorPay sends the webhook secret in dashboard
    webhookSecret := s.paymentService.razorpayWebhookSecret
    return s.paymentService.gateways["razorpay"].VerifyWebhookSignature(c.Request.Context(), body, signature)
}

func (s *RazorPayWebhookService) handlePaymentCaptured(c *gin.Context, data map[string]interface{}) {
    ctx := c.Request.Context()
    
    payload, _ := data["payload"].(map[string]interface{})
    paymentEntity, _ := payload["payment"].(map[string]interface{})
    entity, _ := paymentEntity["entity"].(map[string]interface{})
    
    paymentID, _ := entity["id"].(string)
    orderID, _ := entity["order_id"].(string)
    amount, _ := entity["amount"].(json.Number).Int64()
    
    // Find payment in database by order ID
    var payment models.Payment
    if err := s.paymentService.db.Where("gateway_payment_id = ?", orderID).First(&payment).Error; err != nil {
        // Try to find by payment ID
        if err := s.paymentService.db.Where("gateway_payment_id = ?", paymentID).First(&payment).Error; err != nil {
            log.Printf("Payment not found for RazorPay payment ID: %s", paymentID)
            return
        }
    }
    
    // Update payment status
    payment.Status = "succeeded"
    payment.GatewayPaymentID = paymentID
    payment.GatewayOrderID = orderID
    s.paymentService.db.Save(&payment)
    
    // Handle payment success
    s.paymentService.HandlePaymentSuccess(ctx, payment.ID, paymentID)
    
    // Send notification
    s.sendPaymentSuccessNotification(payment)
}

func (s *RazorPayWebhookService) handlePaymentFailed(c *gin.Context, data map[string]interface{}) {
    payload, _ := data["payload"].(map[string]interface{})
    paymentEntity, _ := payload["payment"].(map[string]interface{})
    entity, _ := paymentEntity["entity"].(map[string]interface{})
    
    paymentID, _ := entity["id"].(string)
    orderID, _ := entity["order_id"].(string)
    errorCode, _ := entity["error_code"].(string)
    errorDescription, _ := entity["error_description"].(string)
    
    // Update payment status
    s.paymentService.db.Model(&models.Payment{}).
        Where("gateway_payment_id = ? OR gateway_order_id = ?", paymentID, orderID).
        Updates(map[string]interface{}{
            "status":       "failed",
            "error_code":   errorCode,
            "error_reason": errorDescription,
            "updated_at":   time.Now(),
        })
}

func (s *RazorPayWebhookService) handleOrderPaid(c *gin.Context, data map[string]interface{}) {
    payload, _ := data["payload"].(map[string]interface{})
    orderEntity, _ := payload["order"].(map[string]interface{})
    entity, _ := orderEntity["entity"].(map[string]interface{})
    
    orderID, _ := entity["id"].(string)
    amountPaid, _ := entity["amount_paid"].(json.Number).Int64()
    
    // Find payment by order ID
    var payment models.Payment
    if err := s.paymentService.db.Where("gateway_order_id = ?", orderID).First(&payment).Error; err != nil {
        log.Printf("Payment not found for RazorPay order ID: %s", orderID)
        return
    }
    
    // Verify amount matches
    if payment.Amount != amountPaid {
        log.Printf("Amount mismatch for order %s: expected %d, got %d", 
            orderID, payment.Amount, amountPaid)
    }
    
    // Payment already captured via payment.captured webhook, so just log
    log.Printf("Order %s marked as paid", orderID)
}

func (s *RazorPayWebhookService) handleRefundCreated(c *gin.Context, data map[string]interface{}) {
    payload, _ := data["payload"].(map[string]interface{})
    refundEntity, _ := payload["refund"].(map[string]interface{})
    entity, _ := refundEntity["entity"].(map[string]interface{})
    
    refundID, _ := entity["id"].(string)
    paymentID, _ := entity["payment_id"].(string)
    amount, _ := entity["amount"].(json.Number).Int64()
    status, _ := entity["status"].(string)
    
    // Find original payment
    var payment models.Payment
    if err := s.paymentService.db.Where("gateway_payment_id = ?", paymentID).First(&payment).Error; err != nil {
        log.Printf("Payment not found for refund: %s", paymentID)
        return
    }
    
    // Create refund record
    refund := models.Refund{
        ID:        refundID,
        PaymentID: payment.ID,
        Amount:    amount,
        Status:    status,
        Gateway:   "razorpay",
        GatewayRefundID: refundID,
        CreatedAt: time.Now(),
    }
    
    s.paymentService.db.Create(&refund)
    
    // Update payment status if fully refunded
    if amount == payment.Amount {
        payment.Status = "refunded"
        s.paymentService.db.Save(&payment)
    }
}

func (s *RazorPayWebhookService) handleSubscriptionCharged(c *gin.Context, data map[string]interface{}) {
    payload, _ := data["payload"].(map[string]interface{})
    subscriptionEntity, _ := payload["subscription"].(map[string]interface{})
    entity, _ := subscriptionEntity["entity"].(map[string]interface{})
    
    subscriptionID, _ := entity["id"].(string)
    paymentID, _ := entity["invoice_id"].(string) // RazorPay uses invoice_id
    
    // Find subscription
    var subscription models.Subscription
    if err := s.paymentService.db.Where("gateway_subscription_id = ?", subscriptionID).First(&subscription).Error; err != nil {
        log.Printf("Subscription not found: %s", subscriptionID)
        return
    }
    
    // Create payment record for subscription charge
    payment := models.Payment{
        ID:              generateUUID(),
        UserID:          subscription.UserID,
        Amount:          subscription.Amount,
        Currency:        subscription.Currency,
        Status:          "succeeded",
        Gateway:         "razorpay",
        GatewayPaymentID: paymentID,
        GatewayOrderID:  subscriptionID,
        Description:     fmt.Sprintf("Subscription charge for %s", subscription.PlanID),
        CreatedAt:       time.Now(),
        PaidAt:          time.Now(),
    }
    
    s.paymentService.db.Create(&payment)
    
    // Update subscription next billing date
    nextChargeAt := time.Now().AddDate(0, 1, 0) // 1 month later
    subscription.NextBillingDate = &nextChargeAt
    s.paymentService.db.Save(&subscription)
}

func (s *RazorPayWebhookService) sendPaymentSuccessNotification(payment models.Payment) {
    if s.paymentService.notificationClient == nil {
        return
    }
    
    notification := services.Notification{
        UserID:  payment.UserID,
        Type:    "payment_success",
        Title:   "Payment Successful via RazorPay",
        Message: fmt.Sprintf("Your payment of %s %.2f was successful", 
            payment.Currency, float64(payment.Amount)/100),
        Data: map[string]interface{}{
            "payment_id": payment.ID,
            "amount":     payment.Amount,
            "gateway":    "razorpay",
        },
    }
    
    ctx := context.Background()
    s.paymentService.notificationClient.Send(ctx, notification)
}