// File: services/payment-service/src/handlers/integration_handler.go
package handlers

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"
	"time"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
	"github.com/google/uuid"

	"payment-service/models"
	"payment-service/services"
	"payment-service/services/gateway"
	"payment-service/integrations/booking"
	"payment-service/integrations/ecommerce"
)

// ServicePaymentRequest represents payment request from any service
type ServicePaymentRequest struct {
	Type          string                 `json:"type" binding:"required"` // booking, ecommerce, live, subscription, donation
	ServiceID     string                 `json:"service_id" binding:"required"` // booking_id, order_id, session_id, etc.
	Amount        int64                  `json:"amount" binding:"required"`
	Currency      string                 `json:"currency" binding:"required"`
	Gateway       string                 `json:"gateway"` // stripe, paypal, razorpay
	CustomerID    string                 `json:"customer_id"`
	CustomerEmail string                 `json:"customer_email" binding:"required"`
	CustomerName  string                 `json:"customer_name"`
	Description   string                 `json:"description"`
	ReturnURL     string                 `json:"return_url"`
	Metadata      map[string]interface{} `json:"metadata"`
}

// ServicePaymentResponse response for service payment creation
type ServicePaymentResponse struct {
	PaymentID    string                 `json:"payment_id"`
	ClientSecret string                 `json:"client_secret,omitempty"`
	GatewayData  map[string]interface{} `json:"gateway_data,omitempty"`
	Status       string                 `json:"status"`
	ServiceType  string                 `json:"service_type"`
	NextAction   *NextAction            `json:"next_action,omitempty"`
	CreatedAt    time.Time              `json:"created_at"`
}

// ServiceValidationRequest for validating service payment requests
type ServiceValidationRequest struct {
	Type      string `json:"type" binding:"required"`
	ServiceID string `json:"service_id" binding:"required"`
	Amount    int64  `json:"amount" binding:"required"`
	Currency  string `json:"currency" binding:"required"`
}

// ServiceValidationResponse validation response
type ServiceValidationResponse struct {
	Valid     bool                   `json:"valid"`
	Message   string                 `json:"message,omitempty"`
	Details   map[string]interface{} `json:"details,omitempty"`
	ServiceID string                 `json:"service_id"`
}

// ServiceWebhookRequest for service callbacks
type ServiceWebhookRequest struct {
	PaymentID string                 `json:"payment_id" binding:"required"`
	ServiceID string                 `json:"service_id" binding:"required"`
	Type      string                 `json:"type" binding:"required"`
	Status    string                 `json:"status" binding:"required"`
	Data      map[string]interface{} `json:"data"`
}

// IntegrationHandler handles all service integrations
type IntegrationHandler struct {
	db                  *gorm.DB
	paymentService      *PaymentService
	gateways            map[string]gateway.PaymentGateway
	bookingClient       *booking.BookingServiceClient
	ecommerceClient     *ecommerce.EcommerceServiceClient
	notificationService *services.NotificationServiceClient
}

// NewIntegrationHandler creates a new integration handler
func NewIntegrationHandler(
	db *gorm.DB,
	paymentService *PaymentService,
	gateways map[string]gateway.PaymentGateway,
	bookingClient *booking.BookingServiceClient,
	ecommerceClient *ecommerce.EcommerceServiceClient,
	notificationService *services.NotificationServiceClient,
) *IntegrationHandler {
	handler := &IntegrationHandler{
		db:                  db,
		paymentService:      paymentService,
		gateways:            gateways,
		bookingClient:       bookingClient,
		ecommerceClient:     ecommerceClient,
		notificationService: notificationService,
	}
	
	// Start the reconciliation job in background
	go handler.startReconciliationJob()
	
	return handler
}

// HandleServicePayment creates a payment for any service
func (h *IntegrationHandler) HandleServicePayment(c *gin.Context) {
	var req ServicePaymentRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Validate service payment request
	if !h.validateServicePaymentRequest(c.Request.Context(), &req) {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid payment request"})
		return
	}

	// Create payment based on service type
	payment, err := h.createServicePayment(c.Request.Context(), &req)
	if err != nil {
		log.Printf("Failed to create service payment: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	// Trigger async service notification
	go h.notifyService(c.Request.Context(), payment, req.Type, req.ServiceID)

	// Prepare response
	response := ServicePaymentResponse{
		PaymentID:    payment.ID,
		ClientSecret: payment.ClientSecret,
		Status:       payment.Status,
		ServiceType:  req.Type,
		CreatedAt:    payment.CreatedAt,
	}

	// Add gateway-specific data
	if req.Gateway == "razorpay" && payment.GatewayOrderID != "" {
		response.GatewayData = map[string]interface{}{
			"order_id": payment.GatewayOrderID,
			"key":      getRazorPayKey(req.Gateway),
		}
	}

	c.JSON(http.StatusOK, response)
}

// ValidateServicePayment validates payment request for a service
func (h *IntegrationHandler) ValidateServicePayment(c *gin.Context) {
	var req ServiceValidationRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	ctx := c.Request.Context()
	isValid, details, err := h.validateServiceRequest(ctx, &req)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	response := ServiceValidationResponse{
		Valid:     isValid,
		ServiceID: req.ServiceID,
		Details:   details,
	}

	if !isValid {
		response.Message = "Service payment validation failed"
	}

	c.JSON(http.StatusOK, response)
}

// ServiceWebhookCallback handles callbacks from services
func (h *IntegrationHandler) ServiceWebhookCallback(c *gin.Context) {
	var req ServiceWebhookRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	serviceType := c.Param("service_type")
	ctx := c.Request.Context()

	switch serviceType {
	case "booking":
		err := h.handleBookingWebhook(ctx, req)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
	case "ecommerce":
		err := h.handleEcommerceWebhook(ctx, req)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
	case "live":
		err := h.handleLiveWebhook(ctx, req)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
	default:
		c.JSON(http.StatusBadRequest, gin.H{"error": "Unknown service type"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"status": "success"})
}

// GetServicePayments gets payments for a specific service
func (h *IntegrationHandler) GetServicePayments(c *gin.Context) {
	serviceType := c.Param("service_type")
	serviceID := c.Param("service_id")

	var payments []models.Payment
	query := h.db.Model(&models.Payment{})

	switch serviceType {
	case "booking":
		query = query.Where("booking_id = ?", serviceID)
	case "ecommerce":
		query = query.Where("metadata->>'order_id' = ?", serviceID)
	case "live":
		query = query.Where("metadata->>'session_id' = ?", serviceID)
	default:
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid service type"})
		return
	}

	if err := query.Find(&payments).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"service_type": serviceType,
		"service_id":   serviceID,
		"payments":     payments,
		"count":        len(payments),
	})
}

// CheckServiceHealth checks the health of all integrated services
func (h *IntegrationHandler) CheckServiceHealth(c *gin.Context) {
	services := map[string]string{
		"booking":   os.Getenv("BOOKING_SERVICE_URL"),
		"ecommerce": os.Getenv("ECOMMERCE_SERVICE_URL"),
		"live":      os.Getenv("LIVE_SERVICE_URL"),
	}

	healthStatus := make(map[string]interface{})
	for name, url := range services {
		healthy, err := h.checkServiceHealth(url)
		healthStatus[name] = map[string]interface{}{
			"healthy": healthy,
			"error":   err,
			"url":     url,
		}
	}

	c.JSON(http.StatusOK, healthStatus)
}

// ============ PRIVATE METHODS ============

// startReconciliationJob starts the background reconciliation job
func (h *IntegrationHandler) startReconciliationJob() {
	// Run immediately on startup
	h.reconcilePayments()
	
	// Schedule daily reconciliation at 2 AM
	ticker := time.NewTicker(24 * time.Hour)
	defer ticker.Stop()
	
	for {
		select {
		case <-ticker.C:
			// Check if current time is around 2 AM
			now := time.Now()
			if now.Hour() == 2 && now.Minute() < 5 {
				log.Println("Starting daily payment reconciliation job...")
				h.reconcilePayments()
			}
		}
	}
}

// Daily job to sync payment status with services
func (h *IntegrationHandler) reconcilePayments() {
	log.Println("Starting payment reconciliation...")
	
	var pendingPayments []models.Payment
	h.db.Where("status IN (?)", []string{"pending", "processing"}).
		Where("created_at < ?", time.Now().Add(-24*time.Hour)).
		Find(&pendingPayments)
	
	log.Printf("Found %d pending/processing payments older than 24 hours", len(pendingPayments))
	
	for _, payment := range pendingPayments {
		h.reconcilePaymentWithService(payment)
	}
	
	log.Println("Payment reconciliation completed")
}

// reconcilePaymentWithService reconciles a single payment with its service
func (h *IntegrationHandler) reconcilePaymentWithService(payment models.Payment) {
	log.Printf("Reconciling payment %s for service %s", payment.ID, payment.Metadata["service_id"])
	
	// Check payment status with gateway
	gatewayStatus, err := h.checkGatewayPaymentStatus(payment)
	if err != nil {
		log.Printf("Failed to check gateway status for payment %s: %v", payment.ID, err)
		return
	}
	
	// If status changed, update local record
	if gatewayStatus != payment.Status {
		log.Printf("Payment %s status changed from %s to %s", payment.ID, payment.Status, gatewayStatus)
		
		// Update payment status
		payment.Status = gatewayStatus
		if err := h.db.Save(&payment).Error; err != nil {
			log.Printf("Failed to update payment %s status: %v", payment.ID, err)
			return
		}
		
		// Notify service about status change
		serviceType, ok := payment.Metadata["service_type"].(string)
		if !ok {
			serviceType = "unknown"
		}
		
		serviceID, ok := payment.Metadata["service_id"].(string)
		if !ok {
			log.Printf("No service ID found for payment %s", payment.ID)
			return
		}
		
		// Send webhook notification to service
		go h.notifyService(context.Background(), &payment, serviceType, serviceID)
		
		// Send notification to customer if payment failed
		if gatewayStatus == "failed" || gatewayStatus == "canceled" {
			h.sendPaymentFailureNotification(payment)
		}
	}
}

// checkGatewayPaymentStatus checks the current status of a payment with the gateway
func (h *IntegrationHandler) checkGatewayPaymentStatus(payment models.Payment) (string, error) {
	if payment.Gateway == "" || payment.GatewayPaymentID == "" {
		return payment.Status, nil
	}
	
	gw, exists := h.gateways[payment.Gateway]
	if !exists {
		return payment.Status, fmt.Errorf("gateway %s not found", payment.Gateway)
	}
	
	ctx := context.Background()
	paymentIntent, err := gw.GetPaymentIntent(ctx, payment.GatewayPaymentID)
	if err != nil {
		return payment.Status, fmt.Errorf("failed to get payment intent: %w", err)
	}
	
	return string(paymentIntent.Status), nil
}

// sendPaymentFailureNotification sends notification for failed payment
func (h *IntegrationHandler) sendPaymentFailureNotification(payment models.Payment) {
	if h.notificationService == nil {
		return
	}
	
	ctx := context.Background()
	notification := services.Notification{
		UserID:  payment.CustomerID,
		Type:    "payment_failed",
		Title:   "Payment Failed",
		Message: fmt.Sprintf("Your payment of %s %.2f has failed. Please try again.", payment.Currency, float64(payment.Amount)/100),
		Data: map[string]interface{}{
			"payment_id":   payment.ID,
			"amount":       payment.Amount,
			"currency":     payment.Currency,
			"gateway":      payment.Gateway,
			"service_type": payment.Metadata["service_type"],
		},
	}
	
	if err := h.notificationService.Send(ctx, notification); err != nil {
		log.Printf("Failed to send payment failure notification: %v", err)
	}
}

// checkServiceHealth checks the health of a service by making a health check request
func (h *IntegrationHandler) checkServiceHealth(serviceURL string) (bool, string) {
	if serviceURL == "" {
		return false, "Service URL not configured"
	}

	// Try to reach the service health endpoint
	healthURL := fmt.Sprintf("%s/health", serviceURL)
	
	client := &http.Client{Timeout: 5 * time.Second}
	resp, err := client.Get(healthURL)
	if err != nil {
		return false, fmt.Sprintf("Failed to connect to service: %v", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return false, fmt.Sprintf("Service returned non-200 status: %d", resp.StatusCode)
	}

	return true, ""
}

// validateServicePaymentRequest validates payment request
func (h *IntegrationHandler) validateServicePaymentRequest(ctx context.Context, req *ServicePaymentRequest) bool {
	// Basic validation
	if req.Amount <= 0 {
		return false
	}

	if req.Gateway == "" {
		req.Gateway = "stripe" // default
	}

	// Check if gateway is supported
	if _, exists := h.gateways[req.Gateway]; !exists {
		return false
	}

	return true
}

// createServicePayment creates a payment for a service
func (h *IntegrationHandler) createServicePayment(ctx context.Context, req *ServicePaymentRequest) (*models.Payment, error) {
	// Build payment metadata
	metadata := make(map[string]interface{})
	if req.Metadata != nil {
		metadata = req.Metadata
	}

	metadata["service_type"] = req.Type
	metadata["service_id"] = req.ServiceID
	metadata["integration_source"] = "service-api"

	// Add service-specific metadata
	switch req.Type {
	case "booking":
		metadata["booking_id"] = req.ServiceID
	case "ecommerce":
		metadata["order_id"] = req.ServiceID
	case "live":
		metadata["session_id"] = req.ServiceID
	}

	// Create payment record
	payment := &models.Payment{
		ID:            uuid.New().String(),
		Amount:        req.Amount,
		Currency:      req.Currency,
		Status:        "pending",
		Gateway:       req.Gateway,
		CustomerID:    req.CustomerID,
		CustomerEmail: req.CustomerEmail,
		Description:   req.Description,
		Metadata:      metadata,
		CreatedAt:     time.Now(),
	}

	// Set service-specific IDs
	switch req.Type {
	case "booking":
		payment.BookingID = req.ServiceID
	case "ecommerce":
		// Order ID stored in metadata
	}

	// Save to database
	if err := h.db.Create(payment).Error; err != nil {
		return nil, fmt.Errorf("failed to create payment: %w", err)
	}

	// Create payment intent with gateway
	gw, exists := h.gateways[req.Gateway]
	if !exists {
		return payment, nil // Payment saved, but no gateway processing
	}

	// Prepare gateway parameters
	gatewayParams := gateway.CreatePaymentParams{
		Amount:             req.Amount,
		Currency:           req.Currency,
		CustomerID:         req.CustomerID,
		CustomerEmail:      req.CustomerEmail,
		Description:        req.Description,
		Metadata:           convertToGatewayMetadata(metadata),
		ReturnURL:          req.ReturnURL,
		PaymentMethodTypes: []string{"card"},
		Confirm:            true,
	}

	// Create payment intent
	paymentIntent, err := gw.CreatePaymentIntent(ctx, gatewayParams)
	if err != nil {
		log.Printf("Gateway payment intent creation failed: %v", err)
		// Still return the payment record
		return payment, nil
	}

	// Update payment with gateway info
	payment.GatewayPaymentID = paymentIntent.ID
	payment.ClientSecret = paymentIntent.ClientSecret
	payment.Status = string(paymentIntent.Status)

	if req.Gateway == "razorpay" {
		payment.GatewayOrderID = paymentIntent.ID
	}

	if err := h.db.Save(payment).Error; err != nil {
		log.Printf("Failed to update payment with gateway info: %v", err)
	}

	return payment, nil
}

// validateServiceRequest validates service-specific payment request
func (h *IntegrationHandler) validateServiceRequest(ctx context.Context, req *ServiceValidationRequest) (bool, map[string]interface{}, error) {
	details := make(map[string]interface{})
	details["service_type"] = req.Type
	details["service_id"] = req.ServiceID

	switch req.Type {
	case "booking":
		return h.validateBookingPayment(ctx, req.ServiceID, req.Amount, req.Currency)
	case "ecommerce":
		return h.validateEcommercePayment(ctx, req.ServiceID, req.Amount, req.Currency)
	case "live":
		return h.validateLivePayment(ctx, req.ServiceID, req.Amount, req.Currency)
	default:
		return false, details, fmt.Errorf("unknown service type: %s", req.Type)
	}
}

// validateBookingPayment validates booking payment
func (h *IntegrationHandler) validateBookingPayment(ctx context.Context, bookingID string, amount int64, currency string) (bool, map[string]interface{}, error) {
	if h.bookingClient == nil {
		return true, nil, nil // Skip validation if client not available
	}

	valid, booking, err := h.bookingClient.ValidateBookingForPayment(ctx, bookingID, amount, currency)
	if err != nil {
		return false, nil, err
	}

	details := map[string]interface{}{
		"booking_id":   booking.ID,
		"user_id":      booking.UserID,
		"class_id":     booking.ClassID,
		"start_time":   booking.StartTime,
		"status":       booking.Status,
		"amount_match": booking.Amount == amount,
	}

	return valid, details, nil
}

// validateEcommercePayment validates ecommerce payment
func (h *IntegrationHandler) validateEcommercePayment(ctx context.Context, orderID string, amount int64, currency string) (bool, map[string]interface{}, error) {
	if h.ecommerceClient == nil {
		return true, nil, nil // Skip validation if client not available
	}

	valid, order, err := h.ecommerceClient.ValidateOrderForPayment(ctx, orderID, amount, currency)
	if err != nil {
		return false, nil, err
	}

	details := map[string]interface{}{
		"order_id":     order.ID,
		"user_id":      order.UserID,
		"total_amount": order.TotalAmount,
		"status":       order.Status,
		"items_count":  len(order.Items),
	}

	return valid, details, nil
}

// validateLivePayment validates live session payment
func (h *IntegrationHandler) validateLivePayment(ctx context.Context, sessionID string, amount int64, currency string) (bool, map[string]interface{}, error) {
	// For now, return true - implement when live service client is available
	details := map[string]interface{}{
		"session_id": sessionID,
		"amount":     amount,
		"currency":   currency,
	}
	return true, details, nil
}

// notifyService notifies the originating service about payment
func (h *IntegrationHandler) notifyService(ctx context.Context, payment *models.Payment, serviceType, serviceID string) {
	webhookURL := h.getServiceWebhookURL(serviceType, serviceID)
	if webhookURL == "" {
		return
	}

	webhookData := map[string]interface{}{
		"payment_id":   payment.ID,
		"service_type": serviceType,
		"service_id":   serviceID,
		"status":       payment.Status,
		"amount":       payment.Amount,
		"currency":     payment.Currency,
		"gateway":      payment.Gateway,
		"created_at":   payment.CreatedAt,
		"metadata":     payment.Metadata,
	}

	// Make async HTTP call to service webhook
	go func() {
		jsonData, _ := json.Marshal(webhookData)
		resp, err := http.Post(webhookURL, "application/json", bytes.NewReader(jsonData))
		if err != nil {
			log.Printf("Failed to call service webhook: %v", err)
			return
		}
		resp.Body.Close()
	}()
}

// handleBookingWebhook processes booking service webhooks
func (h *IntegrationHandler) handleBookingWebhook(ctx context.Context, req ServiceWebhookRequest) error {
	// Update booking with payment status
	if h.bookingClient != nil {
		updateReq := booking.UpdateBookingPaymentRequest{
			PaymentID:     req.PaymentID,
			PaymentStatus: req.Status,
			Gateway:       "payment-service",
			TransactionID: req.PaymentID,
		}

		if err := h.bookingClient.UpdateBookingPaymentStatus(ctx, req.ServiceID, updateReq); err != nil {
			log.Printf("Failed to update booking payment status: %v", err)
			return err
		}
	}

	// Send notification if payment successful
	if req.Status == "succeeded" && h.notificationService != nil {
		notification := services.Notification{
			UserID:  extractUserIDFromMetadata(req.Data),
			Type:    "booking_payment_success",
			Title:   "Booking Payment Successful",
			Message: fmt.Sprintf("Your booking payment of %s %.2f was successful", req.Data["currency"], float64(req.Data["amount"].(int64))/100),
			Data:    req.Data,
		}

		if err := h.notificationService.Send(ctx, notification); err != nil {
			log.Printf("Failed to send notification: %v", err)
		}
	}

	return nil
}

// handleEcommerceWebhook processes ecommerce service webhooks
func (h *IntegrationHandler) handleEcommerceWebhook(ctx context.Context, req ServiceWebhookRequest) error {
	// Update order with payment status
	if h.ecommerceClient != nil {
		updateReq := ecommerce.UpdateOrderPaymentRequest{
			PaymentID:     req.PaymentID,
			PaymentStatus: req.Status,
			Gateway:       "payment-service",
			TransactionID: req.PaymentID,
		}

		if err := h.ecommerceClient.UpdateOrderPaymentStatus(ctx, req.ServiceID, updateReq); err != nil {
			log.Printf("Failed to update order payment status: %v", err)
			return err
		}
	}

	// Fulfill order if payment successful
	if req.Status == "succeeded" {
		go func() {
			if h.ecommerceClient != nil {
				if err := h.ecommerceClient.FulfillOrder(ctx, req.ServiceID, "payment_processed"); err != nil {
					log.Printf("Failed to fulfill order: %v", err)
				}
			}
		}()
	}

	return nil
}

// handleLiveWebhook processes live service webhooks
func (h *IntegrationHandler) handleLiveWebhook(ctx context.Context, req ServiceWebhookRequest) error {
	// TODO: Implement live service integration
	log.Printf("Live service webhook received: %+v", req)
	return nil
}

// getServiceWebhookURL returns webhook URL for a service
func (h *IntegrationHandler) getServiceWebhookURL(serviceType, serviceID string) string {
	baseURL := ""
	switch serviceType {
	case "booking":
		baseURL = os.Getenv("BOOKING_SERVICE_URL")
	case "ecommerce":
		baseURL = os.Getenv("ECOMMERCE_SERVICE_URL")
	case "live":
		baseURL = os.Getenv("LIVE_SERVICE_URL")
	}

	if baseURL == "" {
		return ""
	}

	return fmt.Sprintf("%s/webhook/payment", baseURL)
}

// getRazorPayKey returns RazorPay key based on environment
func getRazorPayKey(gateway string) string {
	if gateway == "razorpay" {
		if os.Getenv("RAZORPAY_ENV") == "production" {
			return os.Getenv("RAZORPAY_LIVE_KEY_ID")
		}
		return os.Getenv("RAZORPAY_TEST_KEY_ID")
	}
	return ""
}

// convertToGatewayMetadata converts metadata to gateway format
func convertToGatewayMetadata(metadata map[string]interface{}) map[string]string {
	result := make(map[string]string)
	for k, v := range metadata {
		if strVal, ok := v.(string); ok {
			result[k] = strVal
		} else {
			// Convert non-string values to JSON string
			jsonVal, _ := json.Marshal(v)
			result[k] = string(jsonVal)
		}
	}
	return result
}

// extractUserIDFromMetadata extracts user ID from metadata
func extractUserIDFromMetadata(metadata map[string]interface{}) string {
	if userID, ok := metadata["user_id"].(string); ok {
		return userID
	}
	return ""
}

// NextAction represents next action for payment
type NextAction struct {
	Type string                 `json:"type"`
	URL  string                 `json:"url,omitempty"`
	Data map[string]interface{} `json:"data,omitempty"`
}