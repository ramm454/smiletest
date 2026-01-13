// payment_handler.go
package handlers

import (
	"context"
	"fmt"
	"log"
	"net/http"
	"os"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"gorm.io/gorm"

	"payment-service/models"
	"payment-service/services"
	"payment-service/services/gateway"
	"payment-service/user" // NEW: Import user package
)

type CreatePaymentRequest struct {
	BookingID     string            `json:"booking_id" binding:"required"`
	SessionID     string            `json:"session_id"`
	Gateway       string            `json:"gateway" binding:"required"` // stripe, paypal, razorpay
	PaymentMethod string            `json:"payment_method"`             // card, paypal, bank_transfer
	ReturnURL     string            `json:"return_url"`
	Metadata      map[string]string `json:"metadata"`
}

type PaymentService struct {
	db                  *gorm.DB
	bookingClient       *services.BookingServiceClient
	liveClient          *services.LiveServiceClient
	notificationClient  *services.NotificationServiceClient
	integrationService  *services.IntegrationService
	invoiceService      *services.InvoiceService
	userClient          *user.UserServiceClient           // NEW
	userHandler         *user.UserIntegrationHandler      // NEW
	gateways            map[string]gateway.PaymentGateway
}

func NewPaymentService(db *gorm.DB) *PaymentService {
	// Initialize user client
	userServiceURL := os.Getenv("USER_SERVICE_URL")
	if userServiceURL == "" {
		userServiceURL = "http://user-service:8080" // Default
	}
	
	userClient := user.NewUserServiceClient(userServiceURL)
	userHandler := user.NewUserIntegrationHandler(db, userClient)
	
	return &PaymentService{
		db:                  db,
		bookingClient:       services.NewBookingServiceClient(os.Getenv("BOOKING_SERVICE_URL")),
		liveClient:          services.NewLiveServiceClient(os.Getenv("LIVE_SERVICE_URL")),
		integrationService:  services.NewIntegrationService(db),
		invoiceService:      services.NewInvoiceService(db),
		userClient:          userClient,              // NEW
		userHandler:         userHandler,             // NEW
		gateways:            make(map[string]gateway.PaymentGateway),
	}
}

func (s *PaymentService) CreatePayment(c *gin.Context) {
	var req CreatePaymentRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	ctx := c.Request.Context()
	
	// Get user from context (from JWT token)
	userID := c.GetString("user_id")
	if userID == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "User not authenticated"})
		return
	}

	// Get user details from user service
	user, err := s.userClient.GetUserByID(ctx, userID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid user: " + err.Error()})
		return
	}

	// Validate user can make payment
	valid, err := s.userHandler.ValidateUserForPayment(ctx, userID)
	if !valid {
		c.JSON(http.StatusForbidden, gin.H{"error": err.Error()})
		return
	}

	// Validate and get payment amount from booking or session
	var amount int64
	var currency string = "USD"
	var description string

	if req.BookingID != "" {
		// Get booking details
		booking, err := s.bookingClient.GetBookingForPayment(ctx, req.BookingID)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid booking: " + err.Error()})
			return
		}

		// Verify booking belongs to user
		if booking.UserID != userID {
			c.JSON(http.StatusForbidden, gin.H{"error": "Booking does not belong to user"})
			return
		}

		amount = booking.Amount
		currency = booking.Currency
		description = fmt.Sprintf("Booking: %s - %s", booking.Type, booking.StartTime.Format("Jan 2, 2006 3:04 PM"))

	} else if req.SessionID != "" {
		// Get live session details
		valid, err := s.liveClient.ValidateSessionPayment(ctx, req.SessionID, amount, currency)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid session: " + err.Error()})
			return
		}

		if !valid {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Session validation failed"})
			return
		}

		session, err := s.liveClient.GetSession(ctx, req.SessionID)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to get session details"})
			return
		}

		amount = session.Price
		currency = session.Currency
		description = fmt.Sprintf("Live Session: %s - %s", session.Title, session.StartTime.Format("Jan 2, 2006 3:04 PM"))
	} else {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Either booking_id or session_id is required"})
		return
	}

	// Get or select gateway
	gatewayName := req.Gateway
	if gatewayName == "" {
		// Try to get user's preferred payment method
		preferredMethod, err := s.userHandler.GetUserPaymentPreferences(ctx, userID)
		if err == nil && preferredMethod.Gateway != "" {
			gatewayName = preferredMethod.Gateway
		} else {
			gatewayName = "stripe" // Default
		}
	}

	gw, exists := s.gateways[gatewayName]
	if !exists {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Unsupported payment gateway"})
		return
	}

	// Create customer in gateway if needed
	var customerID string
	userEmail := user.Email
	userName := fmt.Sprintf("%s %s", user.FirstName, user.LastName)
	
	// Check if user already has a customer record
	var customer models.Customer
	if err := s.db.Where("user_id = ? AND gateway = ?", userID, gatewayName).First(&customer).Error; err == nil {
		customerID = customer.GatewayCustomerID
	} else {
		// Create new customer in gateway
		customerParams := gateway.CustomerParams{
			Email:    userEmail,
			Name:     userName,
			Metadata: map[string]string{
				"user_id": userID,
				"user_email": userEmail,
				"user_name": userName,
			},
		}

		gatewayCustomer, err := gw.CreateCustomer(ctx, customerParams)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create customer: " + err.Error()})
			return
		}

		customerID = gatewayCustomer.ID

		// Save to database
		customer = models.Customer{
			ID:                uuid.New().String(),
			UserID:            userID,
			Gateway:           gatewayName,
			GatewayCustomerID: customerID,
			Email:             userEmail,
			Name:              userName,
			CreatedAt:         time.Now(),
		}
		s.db.Create(&customer)
		
		// Update user's payment preferences
		go func() {
			ctx := context.Background()
			err := s.userHandler.UpdateUserPaymentPreferences(ctx, userID, &user.PaymentPreferences{
				DefaultGateway: gatewayName,
				GatewayCustomerIDs: map[string]string{
					gatewayName: customerID,
				},
			})
			if err != nil {
				log.Printf("Failed to update user payment preferences: %v", err)
			}
		}()
	}

	// Validate with integration service
	paymentType := getPaymentTypeFromRequest(req)
	valid, validatedPaymentType, err := s.integrationService.ValidatePaymentRequest(ctx, map[string]interface{}{
		"type":       paymentType,
		"booking_id": req.BookingID,
		"session_id": req.SessionID,
		"amount":     amount,
		"currency":   currency,
		"user_id":    userID,
	})

	if !valid {
		c.JSON(http.StatusBadRequest, gin.H{"error": fmt.Sprintf("Invalid payment request: %v", err)})
		return
	}
	
	// Use validated payment type
	paymentType = validatedPaymentType

	// Create payment intent
	paymentParams := gateway.CreatePaymentParams{
		Amount:             amount,
		Currency:           currency,
		CustomerID:         customerID,
		CustomerEmail:      userEmail,
		Description:        description,
		Metadata:           req.Metadata,
		PaymentMethodTypes: []string{"card"}, // Could be configurable based on user preferences
		ReturnURL:          req.ReturnURL,
		Confirm:            true,
	}

	// Add specific metadata
	if paymentParams.Metadata == nil {
		paymentParams.Metadata = make(map[string]string)
	}
	if req.BookingID != "" {
		paymentParams.Metadata["booking_id"] = req.BookingID
	}
	if req.SessionID != "" {
		paymentParams.Metadata["session_id"] = req.SessionID
	}
	paymentParams.Metadata["user_id"] = userID
	paymentParams.Metadata["user_email"] = userEmail
	paymentParams.Metadata["payment_type"] = paymentType

	paymentIntent, err := gw.CreatePaymentIntent(ctx, paymentParams)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create payment: " + err.Error()})
		return
	}

	// Save payment to database
	payment := models.Payment{
		ID:               uuid.New().String(),
		BookingID:        req.BookingID,
		SessionID:        req.SessionID,
		UserID:           userID,
		UserEmail:        userEmail,
		UserName:         userName,
		Amount:           amount,
		Currency:         currency,
		Status:           "pending",
		Gateway:          gatewayName,
		GatewayPaymentID: paymentIntent.ID,
		ClientSecret:     paymentIntent.ClientSecret,
		Description:      description,
		PaymentType:      paymentType,
		Metadata:         make(map[string]interface{}),
		CreatedAt:        time.Now(),
	}

	// Copy metadata
	for k, v := range paymentParams.Metadata {
		payment.Metadata[k] = v
	}
	payment.Metadata["payment_type"] = paymentType
	payment.Metadata["user_tier"] = user.Tier

	// Save payment
	if err := s.db.Create(&payment).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to save payment: " + err.Error()})
		return
	}

	// If payment requires immediate processing (like wallet top-up)
	if paymentType == "wallet_topup" && payment.Status == "succeeded" {
		go s.integrationService.ProcessPaymentIntegration(context.Background(), &payment)
	}

	// Prepare response
	response := gin.H{
		"payment_id":     payment.ID,
		"client_secret":  payment.ClientSecret,
		"status":         payment.Status,
		"amount":         payment.Amount,
		"currency":       payment.Currency,
		"gateway":        payment.Gateway,
		"payment_type":   payment.PaymentType,
		"next_action":    paymentIntent.NextAction,
	}

	// If there's a next action (like 3D Secure), include it
	if paymentIntent.NextAction != nil {
		response["next_action"] = gin.H{
			"type": paymentIntent.NextAction.Type,
			"url":  paymentIntent.NextAction.URL,
		}
	}

	c.JSON(http.StatusOK, response)
}

func (s *PaymentService) handleSuccessfulPayment(ctx context.Context, payment models.Payment) error {
    // Update payment status
    payment.Status = "succeeded"
    payment.PaidAt = time.Now()
    s.db.Save(&payment)
    
    // Generate invoice
    invoice, err := s.invoiceService.GenerateInvoice(ctx, payment)
    if err != nil {
        log.Printf("Failed to generate invoice for payment %s: %v", payment.ID, err)
        // Continue processing even if invoice fails
    } else {
        log.Printf("Generated invoice %s for payment %s", invoice.InvoiceNumber, payment.ID)
    }
    
    // Update user's payment history and stats
    go func() {
        ctx := context.Background()
        err := s.userHandler.UpdateUserPaymentHistory(ctx, payment.UserID, &payment)
        if err != nil {
            log.Printf("Failed to update user payment history: %v", err)
        }
    }()
    
    // Trigger service integrations
    s.integrationService.ProcessPaymentIntegration(ctx, payment)
    
    return nil
}

func (s *PaymentService) HandlePaymentSuccess(ctx context.Context, paymentID, gatewayPaymentID string) error {
	// Update payment status
	var payment models.Payment
	if err := s.db.Where("id = ?", paymentID).First(&payment).Error; err != nil {
		return err
	}

	// Use the new handleSuccessfulPayment function
	if err := s.handleSuccessfulPayment(ctx, payment); err != nil {
		return err
	}

	// Update related booking
	if payment.BookingID != "" {
		err := s.bookingClient.UpdateBookingStatus(ctx, payment.BookingID, "confirmed", payment.ID)
		if err != nil {
			// Log error but don't fail payment
			log.Printf("Failed to update booking status: %v", err)
		}
	}

	// Grant access to live session
	if payment.SessionID != "" {
		access, err := s.liveClient.GrantAccess(ctx, payment.SessionID, payment.UserID, payment.ID)
		if err != nil {
			log.Printf("Failed to grant session access: %v", err)
		} else {
			// Store access token (optional)
			log.Printf("Granted access to session %s", payment.SessionID)
		}
	}

	// Update user's loyalty points or rewards
	go func() {
		ctx := context.Background()
		err := s.userHandler.UpdateUserLoyaltyPoints(ctx, payment.UserID, payment.Amount)
		if err != nil {
			log.Printf("Failed to update user loyalty points: %v", err)
		}
	}()

	// Send notification
	if s.notificationClient != nil {
		notification := services.Notification{
			UserID:  payment.UserID,
			Type:    "payment_success",
			Title:   "Payment Successful",
			Message: fmt.Sprintf("Your payment of %s %.2f was successful", payment.Currency, float64(payment.Amount)/100),
			Data: map[string]interface{}{
				"payment_id": payment.ID,
				"amount":     payment.Amount,
				"booking_id": payment.BookingID,
				"session_id": payment.SessionID,
			},
		}
		s.notificationClient.Send(ctx, notification)
	}

	// Trigger integration processing
	go func() {
		if err := s.integrationService.ProcessPaymentIntegration(context.Background(), &payment); err != nil {
			log.Printf("Failed to process payment integration: %v", err)
		}
	}()

	return nil
}

func (s *PaymentService) HandleWebhook(c *gin.Context) {
	gatewayName := c.Param("gateway")
	gw, exists := s.gateways[gatewayName]
	if !exists {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Unsupported gateway"})
		return
	}

	// Verify webhook signature
	payload, err := gw.VerifyWebhook(c.Request)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid webhook signature"})
		return
	}

	// Process webhook event
	event, err := gw.ParseWebhookEvent(payload)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Failed to parse webhook event"})
		return
	}

	ctx := context.Background()

	switch event.Type {
	case "payment_intent.succeeded":
		paymentIntent := event.Data.Object.(*gateway.PaymentIntent)
		
		// Find payment in database
		var payment models.Payment
		if err := s.db.Where("gateway_payment_id = ?", paymentIntent.ID).First(&payment).Error; err != nil {
			c.JSON(http.StatusOK, gin.H{"status": "payment not found"})
			return
		}

		// Use the new handleSuccessfulPayment function
		if err := s.handleSuccessfulPayment(ctx, payment); err != nil {
			log.Printf("Failed to handle successful payment: %v", err)
		}

		// Handle additional payment success logic
		if err := s.HandlePaymentSuccess(ctx, payment.ID, paymentIntent.ID); err != nil {
			log.Printf("Failed to handle payment success: %v", err)
		}

	case "payment_intent.payment_failed":
		paymentIntent := event.Data.Object.(*gateway.PaymentIntent)
		
		var payment models.Payment
		if err := s.db.Where("gateway_payment_id = ?", paymentIntent.ID).First(&payment).Error; err == nil {
			payment.Status = "failed"
			payment.FailureMessage = paymentIntent.LastPaymentError.Message
			s.db.Save(&payment)
			
			// Update user's payment failure count
			go func() {
				ctx := context.Background()
				err := s.userHandler.RecordPaymentFailure(ctx, payment.UserID)
				if err != nil {
					log.Printf("Failed to record payment failure: %v", err)
				}
			}()
		}

	case "refund.created", "refund.updated":
		refund := event.Data.Object.(*gateway.Refund)
		
		var payment models.Payment
		if err := s.db.Where("gateway_payment_id = ?", refund.PaymentIntentID).First(&payment).Error; err == nil {
			// Create refund record
			refundRecord := models.Refund{
				ID:               uuid.New().String(),
				PaymentID:        payment.ID,
				GatewayRefundID:  refund.ID,
				Amount:           refund.Amount,
				Currency:         refund.Currency,
				Status:           refund.Status,
				Reason:           refund.Reason,
				CreatedAt:        time.Now(),
			}
			s.db.Create(&refundRecord)

			// Update payment status if fully refunded
			if refund.Amount == payment.Amount {
				payment.Status = "refunded"
				s.db.Save(&payment)
				
				// Update user's loyalty points (deduct)
				go func() {
					ctx := context.Background()
					err := s.userHandler.RefundUserLoyaltyPoints(ctx, payment.UserID, payment.Amount)
					if err != nil {
						log.Printf("Failed to update user loyalty points after refund: %v", err)
					}
				}()
			}

			// Trigger integration processing based on payment status
			if payment.Status == "succeeded" || payment.Status == "refunded" {
				go func() {
					if err := s.integrationService.ProcessPaymentIntegration(context.Background(), &payment); err != nil {
						log.Printf("Failed to process payment integration: %v", err)
					}
				}()
			}
		}
	}

	c.JSON(http.StatusOK, gin.H{"status": "success"})
}

// Helper functions
func getUserEmailFromContext(c *gin.Context) string {
	if email, exists := c.Get("user_email"); exists {
		return email.(string)
	}
	return ""
}

func getUserNameFromContext(c *gin.Context) string {
	if name, exists := c.Get("user_name"); exists {
		return name.(string)
	}
	return ""
}

func getPaymentTypeFromRequest(req CreatePaymentRequest) string {
	if req.BookingID != "" {
		return "booking"
	} else if req.SessionID != "" {
		return "session"
	}
	return "general"
}

// Additional helper methods for the PaymentService
func (s *PaymentService) RegisterGateway(name string, gateway gateway.PaymentGateway) {
	s.gateways[name] = gateway
}

func (s *PaymentService) GetPaymentStatus(c *gin.Context) {
	paymentID := c.Param("id")
	
	// Check user authorization
	userID := c.GetString("user_id")
	if userID == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "User not authenticated"})
		return
	}
	
	var payment models.Payment
	if err := s.db.Where("id = ? AND user_id = ?", paymentID, userID).First(&payment).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Payment not found"})
		return
	}
	
	// Optionally refresh status from gateway
	if payment.Status == "pending" {
		gw, exists := s.gateways[payment.Gateway]
		if exists {
			ctx := c.Request.Context()
			gatewayPayment, err := gw.GetPaymentIntent(ctx, payment.GatewayPaymentID)
			if err == nil && gatewayPayment.Status != payment.Status {
				payment.Status = gatewayPayment.Status
				s.db.Save(&payment)
			}
		}
	}
	
	c.JSON(http.StatusOK, gin.H{
		"payment_id": payment.ID,
		"status":     payment.Status,
		"amount":     payment.Amount,
		"currency":   payment.Currency,
		"created_at": payment.CreatedAt,
		"paid_at":    payment.PaidAt,
		"user_tier":  payment.Metadata["user_tier"],
	})
}

func (s *PaymentService) GetUserPayments(c *gin.Context) {
	userID := c.GetString("user_id")
	if userID == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "User not authenticated"})
		return
	}
	
	limit := 20
	offset := 0
	
	if limitStr := c.Query("limit"); limitStr != "" {
		fmt.Sscanf(limitStr, "%d", &limit)
	}
	if offsetStr := c.Query("offset"); offsetStr != "" {
		fmt.Sscanf(offsetStr, "%d", &offset)
	}
	
	var payments []models.Payment
	var total int64
	
	s.db.Model(&models.Payment{}).Where("user_id = ?", userID).Count(&total)
	s.db.Where("user_id = ?", userID).
		Order("created_at DESC").
		Limit(limit).
		Offset(offset).
		Find(&payments)
	
	// Get user details to include in response
	user, err := s.userClient.GetUserByID(c.Request.Context(), userID)
	userDetails := gin.H{}
	if err == nil {
		userDetails = gin.H{
			"id":         user.ID,
			"email":      user.Email,
			"first_name": user.FirstName,
			"last_name":  user.LastName,
			"tier":       user.Tier,
		}
	}
	
	c.JSON(http.StatusOK, gin.H{
		"user":     userDetails,
		"payments": payments,
		"total":    total,
		"limit":    limit,
		"offset":   offset,
	})
}

func (s *PaymentService) RefundPayment(c *gin.Context) {
	var req struct {
		PaymentID string `json:"payment_id" binding:"required"`
		Amount    int64  `json:"amount"` // Optional, defaults to full amount
		Reason    string `json:"reason"`
	}
	
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	
	ctx := c.Request.Context()
	
	// Check user authorization
	userID := c.GetString("user_id")
	if userID == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "User not authenticated"})
		return
	}
	
	// Get payment
	var payment models.Payment
	if err := s.db.Where("id = ? AND user_id = ?", req.PaymentID, userID).First(&payment).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Payment not found"})
		return
	}
	
	// Check if payment is refundable
	if payment.Status != "succeeded" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Payment is not refundable"})
		return
	}
	
	// Check refund policy based on user tier
	canRefund, err := s.userHandler.CanUserRefundPayment(ctx, userID, &payment)
	if !canRefund {
		c.JSON(http.StatusForbidden, gin.H{"error": err.Error()})
		return
	}
	
	// Get gateway
	gw, exists := s.gateways[payment.Gateway]
	if !exists {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Gateway not supported"})
		return
	}
	
	// Process refund
	refundAmount := req.Amount
	if refundAmount == 0 {
		refundAmount = payment.Amount
	}
	
	refund, err := gw.CreateRefund(ctx, payment.GatewayPaymentID, refundAmount, req.Reason)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create refund: " + err.Error()})
		return
	}
	
	// Create refund record
	refundRecord := models.Refund{
		ID:              uuid.New().String(),
		PaymentID:       payment.ID,
		GatewayRefundID: refund.ID,
		Amount:          refund.Amount,
		Currency:        refund.Currency,
		Status:          refund.Status,
		Reason:          refund.Reason,
		CreatedAt:       time.Now(),
	}
	s.db.Create(&refundRecord)
	
	// Update payment status if fully refunded
	if refundAmount == payment.Amount {
		payment.Status = "refunded"
		s.db.Save(&payment)
		
		// Update user's loyalty points
		go func() {
			ctx := context.Background()
			err := s.userHandler.RefundUserLoyaltyPoints(ctx, userID, payment.Amount)
			if err != nil {
				log.Printf("Failed to update user loyalty points after refund: %v", err)
			}
		}()
	}
	
	c.JSON(http.StatusOK, gin.H{
		"refund_id": refundRecord.ID,
		"status":    refundRecord.Status,
		"amount":    refundRecord.Amount,
		"reason":    refundRecord.Reason,
	})
}