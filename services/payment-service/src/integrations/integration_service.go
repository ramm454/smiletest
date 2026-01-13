package integrations

import (
    "context"
    "fmt"
    "log"
    
    "payment-service/models"
    "payment-service/integrations/booking"
    "payment-service/integrations/ecommerce"
    "payment-service/integrations/live"
    "payment-service/services/notification"
)

type IntegrationService struct {
    bookingHandler      *booking.BookingPaymentHandler
    ecommerceHandler    *ecommerce.EcommercePaymentHandler
    liveHandler         *live.LivePaymentHandler  // NEW
    notificationService *notification.NotificationService
}

func NewIntegrationService(
    bookingHandler *booking.BookingPaymentHandler,
    ecommerceHandler *ecommerce.EcommercePaymentHandler,
    liveHandler *live.LivePaymentHandler, // NEW
    notificationService *notification.NotificationService,
) *IntegrationService {
    return &IntegrationService{
        bookingHandler:      bookingHandler,
        ecommerceHandler:    ecommerceHandler,
        liveHandler:         liveHandler, // NEW
        notificationService: notificationService,
    }
}

// ProcessPaymentIntegration routes payment to appropriate service handler
func (s *IntegrationService) ProcessPaymentIntegration(ctx context.Context, payment models.Payment) error {
    log.Printf("Processing payment integration for payment: %s, type: %s", 
        payment.ID, getPaymentType(payment))
    
    // Determine payment type based on metadata or IDs
    paymentType := getPaymentType(payment)
    
    switch paymentType {
    case "booking":
        return s.bookingHandler.HandleBookingPayment(ctx, payment)
        
    case "ecommerce":
        return s.ecommerceHandler.HandleEcommercePayment(ctx, payment)
        
    case "live":  // NEW
        return s.liveHandler.HandleLivePayment(ctx, payment)
        
    case "subscription":
        return s.handleSubscriptionPayment(ctx, payment)
        
    case "donation":
        return s.handleDonationPayment(ctx, payment)
        
    case "wallet_topup":
        return s.handleWalletTopup(ctx, payment)
        
    default:
        return fmt.Errorf("unknown payment type: %s", paymentType)
    }
}

// ProcessRefundIntegration routes refund to appropriate service
func (s *IntegrationService) ProcessRefundIntegration(ctx context.Context, refund models.Refund, originalPayment models.Payment) error {
    paymentType := getPaymentType(originalPayment)
    
    switch paymentType {
    case "booking":
        // Booking refunds may have special logic
        return s.bookingHandler.HandleBookingPayment(ctx, originalPayment)
        
    case "ecommerce":
        return s.ecommerceHandler.HandleEcommercePayment(ctx, originalPayment)
        
    case "live":  // NEW
        return s.liveHandler.HandleLivePayment(ctx, originalPayment)
        
    default:
        log.Printf("Processing generic refund for payment type: %s", paymentType)
        return nil
    }
}

// ValidatePaymentRequest validates payment request based on type
func (s *IntegrationService) ValidatePaymentRequest(ctx context.Context, paymentRequest map[string]interface{}) (bool, string, error) {
    paymentType, _ := paymentRequest["type"].(string)
    
    switch paymentType {
    case "booking":
        bookingID, _ := paymentRequest["booking_id"].(string)
        amount, _ := paymentRequest["amount"].(float64)
        currency, _ := paymentRequest["currency"].(string)
        
        // Validate with booking service
        // return s.bookingHandler.ValidateBookingForPayment(ctx, bookingID, int64(amount), currency)
        return true, "booking", nil
        
    case "ecommerce":
        orderID, _ := paymentRequest["order_id"].(string)
        amount, _ := paymentRequest["amount"].(float64)
        currency, _ := paymentRequest["currency"].(string)
        
        // Validate with ecommerce service
        // return s.ecommerceHandler.ValidateOrderForPayment(ctx, orderID, int64(amount), currency)
        return true, "ecommerce", nil
        
    case "live":  // NEW
        liveEventID, _ := paymentRequest["live_event_id"].(string)
        amount, _ := paymentRequest["amount"].(float64)
        currency, _ := paymentRequest["currency"].(string)
        
        // Validate with live service
        // return s.liveHandler.ValidateLiveEventForPayment(ctx, liveEventID, int64(amount), currency)
        return true, "live", nil
        
    default:
        return true, paymentType, nil
    }
}

func getPaymentType(payment models.Payment) string {
    // Check metadata first
    if paymentType, ok := payment.Metadata["payment_type"].(string); ok {
        return paymentType
    }
    
    // Check based on IDs
    if payment.BookingID != "" {
        return "booking"
    }
    
    if payment.OrderID != "" {
        return "ecommerce"
    }
    
    if payment.LiveEventID != "" {  // NEW - assuming you'll add this field to models.Payment
        return "live"
    }
    
    if payment.SubscriptionID != "" {
        return "subscription"
    }
    
    // Check description
    if contains(payment.Description, "booking") || contains(payment.Description, "class") {
        return "booking"
    }
    
    if contains(payment.Description, "order") || contains(payment.Description, "product") {
        return "ecommerce"
    }
    
    if contains(payment.Description, "live") || contains(payment.Description, "event") {  // NEW
        return "live"
    }
    
    // Default
    return "unknown"
}

func contains(str, substr string) bool {
    return len(str) >= len(substr) && (str == substr || 
        len(str) > len(substr) && (str[:len(substr)] == substr || 
        contains(str[1:], substr)))
}

func (s *IntegrationService) handleSubscriptionPayment(ctx context.Context, payment models.Payment) error {
    // Handle subscription payments
    // Activate/update subscription
    log.Printf("Handling subscription payment: %s", payment.ID)
    return nil
}

func (s *IntegrationService) handleDonationPayment(ctx context.Context, payment models.Payment) error {
    // Handle donation payments
    log.Printf("Handling donation payment: %s", payment.ID)
    return nil
}

func (s *IntegrationService) handleWalletTopup(ctx context.Context, payment models.Payment) error {
    // Handle wallet top-up payments
    log.Printf("Handling wallet top-up payment: %s", payment.ID)
    return nil
}