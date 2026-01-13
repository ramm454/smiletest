package validation

import (
	"context"
	"fmt"
	"regexp"
	"strings"
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"

	"payment-service/models"
)

// UnifiedPaymentValidator provides consistent validation across all services
type UnifiedPaymentValidator struct {
	db                 *gorm.DB
	serviceValidators  map[string]ServiceValidator
	currencyValidator  *CurrencyValidator
	amountValidator    *AmountValidator
	customerValidator  *CustomerValidator
	metadataValidator  *MetadataValidator
	rateLimitValidator *RateLimitValidator
}

// ServiceValidator interface for service-specific validation
type ServiceValidator interface {
	Validate(ctx context.Context, serviceID string, amount int64, currency string) (*ValidationResult, error)
	GetServiceType() string
}

// ValidationResult represents validation result
type ValidationResult struct {
	Valid           bool                   `json:"valid"`
	ServiceType     string                 `json:"service_type"`
	ServiceID       string                 `json:"service_id"`
	Errors          []ValidationError      `json:"errors,omitempty"`
	Warnings        []ValidationWarning    `json:"warnings,omitempty"`
	Details         map[string]interface{} `json:"details"`
	ValidatedAmount int64                  `json:"validated_amount"`
	ValidatedCurrency string               `json:"validated_currency"`
	ExpiresAt       time.Time              `json:"expires_at"`
	ValidationID    string                 `json:"validation_id"`
}

// ValidationError represents a validation error
type ValidationError struct {
	Code    string `json:"code"`
	Message string `json:"message"`
	Field   string `json:"field,omitempty"`
	Severity string `json:"severity"` // error, warning, info
}

// ValidationWarning represents a validation warning
type ValidationWarning struct {
	Code    string `json:"code"`
	Message string `json:"message"`
	Action  string `json:"action,omitempty"`
}

// NewUnifiedPaymentValidator creates a new unified payment validator
func NewUnifiedPaymentValidator(db *gorm.DB) *UnifiedPaymentValidator {
	validator := &UnifiedPaymentValidator{
		db:                db,
		serviceValidators: make(map[string]ServiceValidator),
		currencyValidator: NewCurrencyValidator(),
		amountValidator:   NewAmountValidator(),
		customerValidator: NewCustomerValidator(),
		metadataValidator: NewMetadataValidator(),
		rateLimitValidator: NewRateLimitValidator(),
	}

	// Register service validators
	validator.RegisterServiceValidator("booking", NewBookingValidator(db))
	validator.RegisterServiceValidator("ecommerce", NewEcommerceValidator(db))
	validator.RegisterServiceValidator("live", NewLiveValidator(db))
	validator.RegisterServiceValidator("subscription", NewSubscriptionValidator(db))
	validator.RegisterServiceValidator("donation", NewDonationValidator(db))

	return validator
}

// RegisterServiceValidator registers a service validator
func (v *UnifiedPaymentValidator) RegisterServiceValidator(serviceType string, validator ServiceValidator) {
	v.serviceValidators[serviceType] = validator
}

// ValidatePayment validates payment request consistently across all services
func (v *UnifiedPaymentValidator) ValidatePayment(ctx context.Context, request PaymentRequest) (*ValidationResult, error) {
	// Generate validation ID
	validationID := uuid.New().String()

	// Start with basic validation
	result := &ValidationResult{
		ServiceType:     request.Type,
		ServiceID:       request.ServiceID,
		Valid:           true,
		ValidationID:    validationID,
		ExpiresAt:       time.Now().Add(15 * time.Minute), // Validation expires in 15 minutes
		Details:         make(map[string]interface{}),
	}

	// 1. Validate request structure
	if err := v.validateRequestStructure(request, result); err != nil {
		return result, err
	}

	// 2. Validate rate limits
	if err := v.rateLimitValidator.Validate(ctx, request, result); err != nil {
		return result, err
	}

	// 3. Validate currency
	if err := v.currencyValidator.Validate(request.Currency, result); err != nil {
		return result, err
	}

	// 4. Validate amount
	if err := v.amountValidator.Validate(request.Amount, request.Currency, result); err != nil {
		return result, err
	}

	// 5. Validate customer
	if err := v.customerValidator.Validate(request.CustomerEmail, request.CustomerID, result); err != nil {
		return result, err
	}

	// 6. Validate metadata
	if err := v.metadataValidator.Validate(request.Metadata, request.Type, result); err != nil {
		return result, err
	}

	// 7. Service-specific validation
	if validator, exists := v.serviceValidators[request.Type]; exists {
		serviceResult, err := validator.Validate(ctx, request.ServiceID, request.Amount, request.Currency)
		if err != nil {
			result.Errors = append(result.Errors, ValidationError{
				Code:     "SERVICE_VALIDATION_FAILED",
				Message:  fmt.Sprintf("Service validation failed: %v", err),
				Severity: "error",
			})
			result.Valid = false
		} else {
			// Merge service validation results
			result.Valid = result.Valid && serviceResult.Valid
			result.Errors = append(result.Errors, serviceResult.Errors...)
			result.Warnings = append(result.Warnings, serviceResult.Warnings...)
			result.Details["service_details"] = serviceResult.Details
			result.ValidatedAmount = serviceResult.ValidatedAmount
			result.ValidatedCurrency = serviceResult.ValidatedCurrency
		}
	}

	// 8. Check for duplicate payments
	if err := v.checkDuplicatePayment(ctx, request, result); err != nil {
		return result, err
	}

	// 9. Validate payment gateway
	if err := v.validatePaymentGateway(request.Gateway, request.Currency, result); err != nil {
		return result, err
	}

	// 10. Final validation summary
	v.finalizeValidation(result)

	// Store validation result in database
	v.storeValidationResult(ctx, validationID, request, result)

	return result, nil
}

// validateRequestStructure validates basic request structure
func (v *UnifiedPaymentValidator) validateRequestStructure(request PaymentRequest, result *ValidationResult) error {
	// Check required fields
	if request.Type == "" {
		result.Errors = append(result.Errors, ValidationError{
			Code:     "MISSING_TYPE",
			Message:  "Payment type is required",
			Field:    "type",
			Severity: "error",
		})
		result.Valid = false
	}

	if request.ServiceID == "" {
		result.Errors = append(result.Errors, ValidationError{
			Code:     "MISSING_SERVICE_ID",
			Message:  "Service ID is required",
			Field:    "service_id",
			Severity: "error",
		})
		result.Valid = false
	}

	if request.Amount <= 0 {
		result.Errors = append(result.Errors, ValidationError{
			Code:     "INVALID_AMOUNT",
			Message:  "Amount must be greater than 0",
			Field:    "amount",
			Severity: "error",
		})
		result.Valid = false
	}

	if request.Currency == "" {
		result.Errors = append(result.Errors, ValidationError{
			Code:     "MISSING_CURRENCY",
			Message:  "Currency is required",
			Field:    "currency",
			Severity: "error",
		})
		result.Valid = false
	}

	if request.CustomerEmail == "" {
		result.Errors = append(result.Errors, ValidationError{
			Code:     "MISSING_CUSTOMER_EMAIL",
			Message:  "Customer email is required",
			Field:    "customer_email",
			Severity: "error",
		})
		result.Valid = false
	}

	// Validate email format
	if request.CustomerEmail != "" {
		if !isValidEmail(request.CustomerEmail) {
			result.Errors = append(result.Errors, ValidationError{
				Code:     "INVALID_EMAIL",
				Message:  "Invalid email format",
				Field:    "customer_email",
				Severity: "error",
			})
			result.Valid = false
		}
	}

	return nil
}

// checkDuplicatePayment checks for duplicate payment attempts
func (v *UnifiedPaymentValidator) checkDuplicatePayment(ctx context.Context, request PaymentRequest, result *ValidationResult) error {
	// Look for recent payments for the same service
	var recentPayments []models.Payment
	query := v.db.Where("created_at > ?", time.Now().Add(-1*time.Hour))

	switch request.Type {
	case "booking":
		query = query.Where("booking_id = ?", request.ServiceID)
	case "ecommerce":
		query = query.Where("metadata->>'order_id' = ?", request.ServiceID)
	case "live":
		query = query.Where("session_id = ?", request.ServiceID)
	case "subscription":
		query = query.Where("subscription_id = ?", request.ServiceID)
	}

	if err := query.Find(&recentPayments).Error; err == nil {
		if len(recentPayments) > 0 {
			// Check if any payment was successful
			for _, payment := range recentPayments {
				if payment.Status == "succeeded" {
					result.Errors = append(result.Errors, ValidationError{
						Code:     "DUPLICATE_PAYMENT",
						Message:  "A successful payment already exists for this service",
						Severity: "error",
					})
					result.Valid = false
					result.Details["duplicate_payment_id"] = payment.ID
					break
				}
			}

			// Warn about multiple pending payments
			if len(recentPayments) >= 3 {
				result.Warnings = append(result.Warnings, ValidationWarning{
					Code:    "MULTIPLE_PENDING_PAYMENTS",
					Message: fmt.Sprintf("Multiple pending payments found (%d). Consider consolidating.", len(recentPayments)),
					Action:  "review_pending_payments",
				})
			}
		}
	}

	return nil
}

// validatePaymentGateway validates payment gateway compatibility
func (v *UnifiedPaymentValidator) validatePaymentGateway(gateway, currency string, result *ValidationResult) error {
	// Gateway-specific validation
	gatewayConfigs := map[string]GatewayConfig{
		"stripe": {
			SupportedCurrencies: []string{"USD", "EUR", "GBP", "CAD", "AUD", "JPY", "SGD"},
			MinAmount:           50, // $0.50
			MaxAmount:           99999999,
		},
		"paypal": {
			SupportedCurrencies: []string{"USD", "EUR", "GBP", "CAD", "AUD", "JPY"},
			MinAmount:           1, // $0.01
			MaxAmount:           10000000,
		},
		"razorpay": {
			SupportedCurrencies: []string{"INR", "USD", "EUR", "GBP", "AED", "SGD", "MYR"},
			MinAmount:           100, // ₹1.00
			MaxAmount:           1500000000,
		},
	}

	config, exists := gatewayConfigs[gateway]
	if !exists {
		result.Errors = append(result.Errors, ValidationError{
			Code:     "UNSUPPORTED_GATEWAY",
			Message:  fmt.Sprintf("Payment gateway '%s' is not supported", gateway),
			Severity: "error",
		})
		result.Valid = false
		return fmt.Errorf("unsupported gateway: %s", gateway)
	}

	// Check currency support
	currencySupported := false
	for _, supportedCurrency := range config.SupportedCurrencies {
		if strings.EqualFold(currency, supportedCurrency) {
			currencySupported = true
			break
		}
	}

	if !currencySupported {
		result.Errors = append(result.Errors, ValidationError{
			Code:     "CURRENCY_NOT_SUPPORTED",
			Message:  fmt.Sprintf("Currency '%s' is not supported by gateway '%s'", currency, gateway),
			Severity: "error",
		})
		result.Valid = false
	}

	result.Details["gateway_config"] = config
	return nil
}

// finalizeValidation finalizes validation result
func (v *UnifiedPaymentValidator) finalizeValidation(result *ValidationResult) {
	if result.Valid {
		result.Details["validation_status"] = "passed"
		result.Details["validation_timestamp"] = time.Now().Format(time.RFC3339)
	} else {
		result.Details["validation_status"] = "failed"
		result.Details["validation_timestamp"] = time.Now().Format(time.RFC3339)
	}

	// Add summary
	result.Details["error_count"] = len(result.Errors)
	result.Details["warning_count"] = len(result.Warnings)
}

// storeValidationResult stores validation result in database
func (v *UnifiedPaymentValidator) storeValidationResult(ctx context.Context, validationID string, request PaymentRequest, result *ValidationResult) {
	validationRecord := models.PaymentValidation{
		ID:               validationID,
		ServiceType:      request.Type,
		ServiceID:        request.ServiceID,
		Amount:           request.Amount,
		Currency:         request.Currency,
		CustomerEmail:    request.CustomerEmail,
		Gateway:          request.Gateway,
		Valid:            result.Valid,
		ValidationErrors: result.Errors,
		Warnings:         result.Warnings,
		Details:          result.Details,
		ExpiresAt:        result.ExpiresAt,
		CreatedAt:        time.Now(),
	}

	// Store in database (async)
	go func() {
		if err := v.db.Create(&validationRecord).Error; err != nil {
			log.Printf("Failed to store validation result: %v", err)
		}
	}()
}

// PaymentRequest represents payment request for validation
type PaymentRequest struct {
	Type          string                 `json:"type"`
	ServiceID     string                 `json:"service_id"`
	Amount        int64                  `json:"amount"`
	Currency      string                 `json:"currency"`
	Gateway       string                 `json:"gateway"`
	CustomerEmail string                 `json:"customer_email"`
	CustomerID    string                 `json:"customer_id,omitempty"`
	CustomerName  string                 `json:"customer_name,omitempty"`
	Metadata      map[string]interface{} `json:"metadata"`
}

// GatewayConfig represents gateway configuration
type GatewayConfig struct {
	SupportedCurrencies []string `json:"supported_currencies"`
	MinAmount          int64    `json:"min_amount"`
	MaxAmount          int64    `json:"max_amount"`
}