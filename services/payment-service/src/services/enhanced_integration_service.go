package services

import (
	"context"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"log"
	"net/http"
	"sync"
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"

	"payment-service/models"
	"payment-service/integrations/booking"
	"payment-service/integrations/ecommerce"
	"payment-service/integrations/live"
	"payment-service/integrations/subscription"
	"payment-service/services/notification"
)

// EnhancedIntegrationService handles all service integrations with improvements
type EnhancedIntegrationService struct {
	db                    *gorm.DB
	bookingHandler        *booking.BookingPaymentHandler
	ecommerceHandler      *ecommerce.EcommercePaymentHandler
	liveHandler           *live.LivePaymentHandler
	subscriptionHandler   *subscription.SubscriptionPaymentHandler
	notificationService   *notification.NotificationService
	serviceClients        map[string]ServiceClient
	webhookRetryQueue     chan WebhookRetryItem
	metadataValidator     *MetadataValidator
	rateLimiter           *RateLimiter
	reconciliationTicker  *time.Ticker
	apiKeyStore           *APIKeyStore
}

// ServiceClient interface for all service clients
type ServiceClient interface {
	ValidatePayment(ctx context.Context, serviceID string, amount int64, currency string) (bool, map[string]interface{}, error)
	UpdatePaymentStatus(ctx context.Context, serviceID, paymentID, status string) error
}

// WebhookRetryItem represents a webhook to retry
type WebhookRetryItem struct {
	ServiceType    string
	ServiceID      string
	PaymentID      string
	Status         string
	Data           map[string]interface{}
	RetryCount     int
	NextRetryTime  time.Time
}

// MetadataValidator validates and standardizes metadata
type MetadataValidator struct {
	allowedFields map[string][]string
	requiredFields map[string][]string
}

// RateLimiter limits requests to services
type RateLimiter struct {
	limits    map[string]RateLimit
	mu        sync.RWMutex
}

type RateLimit struct {
	Requests    int
	Window      time.Duration
	LastRequest time.Time
	Count       int
}

// APIKeyStore manages service API keys
type APIKeyStore struct {
	keys map[string]string // service -> api_key
	mu   sync.RWMutex
}

// NewEnhancedIntegrationService creates a new enhanced integration service
func NewEnhancedIntegrationService(
	db *gorm.DB,
	bookingHandler *booking.BookingPaymentHandler,
	ecommerceHandler *ecommerce.EcommercePaymentHandler,
	liveHandler *live.LivePaymentHandler,
	subscriptionHandler *subscription.SubscriptionPaymentHandler,
	notificationService *notification.NotificationService,
) *EnhancedIntegrationService {
	service := &EnhancedIntegrationService{
		db:                  db,
		bookingHandler:      bookingHandler,
		ecommerceHandler:    ecommerceHandler,
		liveHandler:         liveHandler,
		subscriptionHandler: subscriptionHandler,
		notificationService: notificationService,
		webhookRetryQueue:   make(chan WebhookRetryItem, 1000),
		metadataValidator:   NewMetadataValidator(),
		rateLimiter:         NewRateLimiter(),
		apiKeyStore:         NewAPIKeyStore(),
		reconciliationTicker: time.NewTicker(1 * time.Hour),
	}

	// Initialize service clients
	service.serviceClients = map[string]ServiceClient{
		"booking":     bookingHandler,
		"ecommerce":   ecommerceHandler,
		"live":        liveHandler,
		"subscription": subscriptionHandler,
	}

	// Start background workers
	go service.webhookRetryWorker()
	go service.reconciliationWorker()
	go service.cleanupWorker()

	return service
}

// ProcessPaymentIntegration routes payment to appropriate service handler with enhancements
func (s *EnhancedIntegrationService) ProcessPaymentIntegration(ctx context.Context, payment models.Payment) error {
	// Validate API key for service integration
	serviceType := getPaymentType(payment)
	if !s.validateServiceRequest(ctx, serviceType, payment) {
		return fmt.Errorf("unauthorized service request")
	}

	// Apply rate limiting
	if s.rateLimiter.IsLimited(serviceType) {
		return fmt.Errorf("rate limit exceeded for service: %s", serviceType)
	}

	// Standardize metadata
	standardizedMetadata := s.metadataValidator.Standardize(payment.Metadata, serviceType)
	payment.Metadata = standardizedMetadata

	log.Printf("Processing payment integration for payment: %s, type: %s",
		payment.ID, serviceType)

	// Route to appropriate handler
	switch serviceType {
	case "booking":
		return s.bookingHandler.HandleBookingPayment(ctx, payment)
	case "ecommerce":
		return s.ecommerceHandler.HandleEcommercePayment(ctx, payment)
	case "live":
		return s.liveHandler.HandleLivePayment(ctx, payment)
	case "subscription":
		return s.subscriptionHandler.HandleSubscriptionPayment(ctx, payment)
	case "donation":
		return s.handleDonationPayment(ctx, payment)
	default:
		return fmt.Errorf("unknown payment type: %s", serviceType)
	}
}

// ProcessRefundIntegration routes refund to appropriate service
func (s *EnhancedIntegrationService) ProcessRefundIntegration(ctx context.Context, refund models.Refund, originalPayment models.Payment) error {
	paymentType := getPaymentType(originalPayment)

	// Apply rate limiting
	if s.rateLimiter.IsLimited(paymentType + "_refund") {
		return fmt.Errorf("rate limit exceeded for refunds")
	}

	switch paymentType {
	case "booking":
		return s.bookingHandler.HandleBookingPayment(ctx, originalPayment)
	case "ecommerce":
		return s.ecommerceHandler.HandleEcommercePayment(ctx, originalPayment)
	case "live":
		return s.liveHandler.HandleLivePayment(ctx, originalPayment)
	case "subscription":
		return s.subscriptionHandler.HandleSubscriptionPayment(ctx, originalPayment)
	default:
		log.Printf("Processing generic refund for payment type: %s", paymentType)
		return nil
	}
}

// ValidatePaymentRequest validates payment request with enhanced validation
func (s *EnhancedIntegrationService) ValidatePaymentRequest(ctx context.Context,
	paymentRequest map[string]interface{}) (bool, string, map[string]interface{}, error) {

	paymentType, _ := paymentRequest["type"].(string)
	serviceID, _ := paymentRequest["service_id"].(string)
	amount, _ := paymentRequest["amount"].(float64)
	currency, _ := paymentRequest["currency"].(string)

	// Validate metadata structure
	if !s.metadataValidator.Validate(paymentRequest["metadata"], paymentType) {
		return false, "", nil, fmt.Errorf("invalid metadata structure")
	}

	// Call service-specific validation
	client, exists := s.serviceClients[paymentType]
	if !exists {
		// Generic validation for unknown services
		return true, paymentType, nil, nil
	}

	valid, details, err := client.ValidatePayment(ctx, serviceID, int64(amount), currency)
	if err != nil {
		return false, "", nil, err
	}

	return valid, paymentType, details, nil
}

// NotifyServiceWebhook sends webhook to service with retry logic
func (s *EnhancedIntegrationService) NotifyServiceWebhook(ctx context.Context,
	payment models.Payment, serviceType, serviceID string) {

	webhookURL := s.getServiceWebhookURL(serviceType, serviceID)
	if webhookURL == "" {
		return
	}

	// Prepare webhook data
	webhookData := map[string]interface{}{
		"payment_id":    payment.ID,
		"service_type":  serviceType,
		"service_id":    serviceID,
		"status":        payment.Status,
		"amount":        payment.Amount,
		"currency":      payment.Currency,
		"gateway":       payment.Gateway,
		"timestamp":     time.Now().Unix(),
		"signature":     s.generateWebhookSignature(payment),
	}

	// Try immediate webhook
	success := s.sendWebhook(ctx, webhookURL, webhookData, serviceType)

	// If failed, add to retry queue
	if !success {
		retryItem := WebhookRetryItem{
			ServiceType:   serviceType,
			ServiceID:     serviceID,
			PaymentID:     payment.ID,
			Status:        payment.Status,
			Data:          webhookData,
			RetryCount:    0,
			NextRetryTime: time.Now().Add(5 * time.Minute),
		}
		s.webhookRetryQueue <- retryItem
	}
}

// webhookRetryWorker processes failed webhook retries
func (s *EnhancedIntegrationService) webhookRetryWorker() {
	for retryItem := range s.webhookRetryQueue {
		// Wait until retry time
		if time.Now().Before(retryItem.NextRetryTime) {
			time.Sleep(time.Until(retryItem.NextRetryTime))
		}

		webhookURL := s.getServiceWebhookURL(retryItem.ServiceType, retryItem.ServiceID)
		if webhookURL == "" {
			continue
		}

		ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		success := s.sendWebhook(ctx, webhookURL, retryItem.Data, retryItem.ServiceType)
		cancel()

		if !success && retryItem.RetryCount < 3 {
			retryItem.RetryCount++
			retryItem.NextRetryTime = time.Now().Add(time.Duration(retryItem.RetryCount*5) * time.Minute)
			s.webhookRetryQueue <- retryItem
		} else if !success {
			log.Printf("Webhook failed after %d retries for payment %s", retryItem.RetryCount, retryItem.PaymentID)
			s.logWebhookFailure(retryItem)
		}
	}
}

// reconciliationWorker reconciles payment status with services
func (s *EnhancedIntegrationService) reconciliationWorker() {
	for range s.reconciliationTicker.C {
		s.reconcilePayments()
	}
}

// reconcilePayments reconciles payment status across all services
func (s *EnhancedIntegrationService) reconcilePayments() {
	log.Println("Starting payment reconciliation...")

	// Find payments that need reconciliation
	var payments []models.Payment
	s.db.Where("status IN (?)", []string{"pending", "processing"}).
		Where("created_at < ?", time.Now().Add(-1*time.Hour)).
		Find(&payments)

	for _, payment := range payments {
		serviceType := getPaymentType(payment)
		serviceID := getServiceID(payment, serviceType)

		// Check if service has different status
		client, exists := s.serviceClients[serviceType]
		if exists && serviceID != "" {
			serviceStatus, err := s.getServicePaymentStatus(payment, client)
			if err == nil && serviceStatus != payment.Status {
				// Update payment status to match service
				payment.Status = serviceStatus
				s.db.Save(&payment)

				log.Printf("Reconciled payment %s: %s -> %s",
					payment.ID, payment.Status, serviceStatus)
			}
		}
	}

	log.Printf("Payment reconciliation completed. Processed %d payments.", len(payments))
}

// cleanupWorker cleans up old data
func (s *EnhancedIntegrationService) cleanupWorker() {
	ticker := time.NewTicker(24 * time.Hour)
	for range ticker.C {
		// Clean up old webhook logs
		s.cleanupOldWebhookLogs()

		// Clean up old retry items
		s.cleanupOldRetryItems()
	}
}

// Helper methods
func (s *EnhancedIntegrationService) sendWebhook(ctx context.Context, url string, data map[string]interface{}, serviceType string) bool {
	jsonData, _ := json.Marshal(data)
	req, err := http.NewRequestWithContext(ctx, "POST", url, bytes.NewReader(jsonData))
	if err != nil {
		return false
	}

	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("X-Payment-Service-Signature", s.generateWebhookSignature(data))

	client := &http.Client{Timeout: 10 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return false
	}
	defer resp.Body.Close()

	return resp.StatusCode >= 200 && resp.StatusCode < 300
}

func (s *EnhancedIntegrationService) generateWebhookSignature(data map[string]interface{}) string {
	secret := s.apiKeyStore.GetKey("webhook_secret")
	if secret == "" {
		return ""
	}

	jsonData, _ := json.Marshal(data)
	h := hmac.New(sha256.New, []byte(secret))
	h.Write(jsonData)
	return hex.EncodeToString(h.Sum(nil))
}

func (s *EnhancedIntegrationService) getServiceWebhookURL(serviceType, serviceID string) string {
	urls := map[string]string{
		"booking":     os.Getenv("BOOKING_SERVICE_WEBHOOK_URL"),
		"ecommerce":   os.Getenv("ECOMMERCE_SERVICE_WEBHOOK_URL"),
		"live":        os.Getenv("LIVE_SERVICE_WEBHOOK_URL"),
		"subscription": os.Getenv("SUBSCRIPTION_SERVICE_WEBHOOK_URL"),
	}
	return urls[serviceType]
}

func (s *EnhancedIntegrationService) validateServiceRequest(ctx context.Context, serviceType string, payment models.Payment) bool {
	// Check API key from metadata
	apiKey, ok := payment.Metadata["api_key"].(string)
	if !ok {
		return false
	}

	expectedKey := s.apiKeyStore.GetKey(serviceType)
	return hmac.Equal([]byte(apiKey), []byte(expectedKey))
}

// NewMetadataValidator creates a new metadata validator
func NewMetadataValidator() *MetadataValidator {
	return &MetadataValidator{
		allowedFields: map[string][]string{
			"booking":     {"user_id", "class_id", "instructor_id", "start_time", "end_time", "participants"},
			"ecommerce":   {"user_id", "items", "shipping_address", "billing_address", "discount_code"},
			"live":        {"user_id", "session_title", "instructor_id", "start_time", "duration"},
			"subscription": {"user_id", "plan_id", "interval", "trial_end", "cancel_at_period_end"},
		},
		requiredFields: map[string][]string{
			"booking":     {"user_id", "class_id"},
			"ecommerce":   {"user_id", "items"},
			"live":        {"user_id", "session_id"},
			"subscription": {"user_id", "plan_id"},
		},
	}
}

// Validate validates metadata structure
func (mv *MetadataValidator) Validate(metadata interface{}, serviceType string) bool {
	meta, ok := metadata.(map[string]interface{})
	if !ok {
		return false
	}

	// Check required fields
	required, exists := mv.requiredFields[serviceType]
	if exists {
		for _, field := range required {
			if _, hasField := meta[field]; !hasField {
				return false
			}
		}
	}

	// Check allowed fields
	allowed, exists := mv.allowedFields[serviceType]
	if exists {
		for field := range meta {
			if !contains(allowed, field) && !strings.HasPrefix(field, "custom_") {
				return false
			}
		}
	}

	return true
}

// Standardize standardizes metadata format
func (mv *MetadataValidator) Standardize(metadata map[string]interface{}, serviceType string) map[string]interface{} {
	standardized := make(map[string]interface{})
	
	// Copy all metadata
	for k, v := range metadata {
		standardized[k] = v
	}

	// Add standardized fields
	standardized["service_type"] = serviceType
	standardized["standardized_at"] = time.Now().Format(time.RFC3339)
	standardized["version"] = "1.0"

	// Service-specific standardization
	switch serviceType {
	case "booking":
		standardized["booking_type"] = "yoga_class"
	case "ecommerce":
		standardized["order_type"] = "product_purchase"
	case "live":
		standardized["session_type"] = "live_streaming"
	case "subscription":
		standardized["subscription_type"] = "recurring"
	}

	return standardized
}

// NewRateLimiter creates a new rate limiter
func NewRateLimiter() *RateLimiter {
	return &RateLimiter{
		limits: map[string]RateLimit{
			"booking":     {Requests: 100, Window: 1 * time.Minute},
			"ecommerce":   {Requests: 200, Window: 1 * time.Minute},
			"live":        {Requests: 50, Window: 1 * time.Minute},
			"subscription": {Requests: 30, Window: 1 * time.Minute},
		},
	}
}

// IsLimited checks if service is rate limited
func (rl *RateLimiter) IsLimited(service string) bool {
	rl.mu.RLock()
	limit, exists := rl.limits[service]
	rl.mu.RUnlock()

	if !exists {
		return false
	}

	now := time.Now()
	if now.Sub(limit.LastRequest) > limit.Window {
		// Reset counter
		rl.mu.Lock()
		rl.limits[service] = RateLimit{
			Requests:    limit.Requests,
			Window:      limit.Window,
			LastRequest: now,
			Count:       1,
		}
		rl.mu.Unlock()
		return false
	}

	rl.mu.Lock()
	limit.Count++
	rl.limits[service] = limit
	rl.mu.Unlock()

	return limit.Count > limit.Requests
}

// NewAPIKeyStore creates a new API key store
func NewAPIKeyStore() *APIKeyStore {
	store := &APIKeyStore{
		keys: make(map[string]string),
	}

	// Load keys from environment
	store.keys["booking"] = os.Getenv("BOOKING_SERVICE_API_KEY")
	store.keys["ecommerce"] = os.Getenv("ECOMMERCE_SERVICE_API_KEY")
	store.keys["live"] = os.Getenv("LIVE_SERVICE_API_KEY")
	store.keys["subscription"] = os.Getenv("SUBSCRIPTION_SERVICE_API_KEY")
	store.keys["webhook_secret"] = os.Getenv("WEBHOOK_SHARED_SECRET")

	return store
}

// GetKey gets API key for service
func (aks *APIKeyStore) GetKey(service string) string {
	aks.mu.RLock()
	defer aks.mu.RUnlock()
	return aks.keys[service]
}

// SetKey sets API key for service
func (aks *APIKeyStore) SetKey(service, key string) {
	aks.mu.Lock()
	defer aks.mu.Unlock()
	aks.keys[service] = key
}

// Utility functions
func contains(arr []string, str string) bool {
	for _, a := range arr {
		if a == str {
			return true
		}
	}
	return false
}

func getPaymentType(payment models.Payment) string {
	// Check metadata first
	if paymentType, ok := payment.Metadata["payment_type"].(string); ok {
		return paymentType
	}

	// Infer from IDs
	if payment.BookingID != "" {
		return "booking"
	}
	if _, hasOrder := payment.Metadata["order_id"]; hasOrder {
		return "ecommerce"
	}
	if payment.SessionID != "" {
		return "live"
	}
	if payment.SubscriptionID != "" {
		return "subscription"
	}

	return "unknown"
}

func getServiceID(payment models.Payment, serviceType string) string {
	switch serviceType {
	case "booking":
		return payment.BookingID
	case "ecommerce":
		if orderID, ok := payment.Metadata["order_id"].(string); ok {
			return orderID
		}
	case "live":
		return payment.SessionID
	case "subscription":
		return payment.SubscriptionID
	}
	return ""
}