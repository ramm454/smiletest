package handlers

import (
    "io"
    "net/http"
    
    "github.com/gin-gonic/gin"
    "github.com/stripe/stripe-go/v76/webhook"
)

type WebhookService struct {
    paymentService *PaymentService
}

func (s *WebhookService) HandleWebhook(c *gin.Context) {
    gateway := c.Param("gateway") // stripe, paypal, razorpay
    
    body, err := io.ReadAll(c.Request.Body)
    if err != nil {
        c.JSON(http.StatusBadRequest, gin.H{"error": "Error reading request body"})
        return
    }
    
    // Get the gateway implementation
    gw, exists := s.paymentService.gateways[gateway]
    if !exists {
        c.JSON(http.StatusBadRequest, gin.H{"error": "Unsupported gateway"})
        return
    }
    
    // Verify webhook signature
    signature := c.GetHeader("Stripe-Signature")
    if gateway == "paypal" {
        signature = c.GetHeader("Paypal-Transmission-Sig")
    }
    
    valid, err := gw.VerifyWebhookSignature(c.Request.Context(), body, signature)
    if err != nil || !valid {
        c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid webhook signature"})
        return
    }
    
    // Parse webhook event
    event, err := gw.ParseWebhookEvent(c.Request.Context(), body)
    if err != nil {
        c.JSON(http.StatusBadRequest, gin.H{"error": "Error parsing webhook"})
        return
    }
    
    // Handle event based on type
    switch event.Type {
    case "payment_intent.succeeded":
        paymentID := event.Data["payment_intent"].(string)
        // Find payment by gateway payment ID
        var payment models.Payment
        if err := s.paymentService.db.Where("gateway_payment_id = ?", paymentID).First(&payment).Error; err != nil {
            c.JSON(http.StatusOK, gin.H{"status": "payment not found"})
            return
        }
        
        // Handle successful payment
        if err := s.paymentService.HandlePaymentSuccess(c.Request.Context(), payment.ID, paymentID); err != nil {
            c.JSON(http.StatusOK, gin.H{"status": "error processing payment"})
            return
        }
        
    case "payment_intent.payment_failed":
        paymentID := event.Data["payment_intent"].(string)
        // Update payment status to failed
        s.paymentService.db.Model(&models.Payment{}).
            Where("gateway_payment_id = ?", paymentID).
            Updates(map[string]interface{}{
                "status": "failed",
                "updated_at": time.Now(),
            })
            
    case "invoice.payment_succeeded":
        // Handle subscription payment
        subscriptionID := event.Data["subscription"].(string)
        s.handleSubscriptionPayment(c.Request.Context(), subscriptionID)
        
    case "customer.subscription.deleted":
        // Handle subscription cancellation
        subscriptionID := event.Data["subscription"].(string)
        s.handleSubscriptionCancellation(c.Request.Context(), subscriptionID)
    }
    
    c.JSON(http.StatusOK, gin.H{"status": "success"})
}