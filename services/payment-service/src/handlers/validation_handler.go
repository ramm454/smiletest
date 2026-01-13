package handlers

import (
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"

	"payment-service/validation"
)

// ValidationHandler handles payment validation requests
type ValidationHandler struct {
	validator *validation.UnifiedPaymentValidator
}

// NewValidationHandler creates a new validation handler
func NewValidationHandler(validator *validation.UnifiedPaymentValidator) *ValidationHandler {
	return &ValidationHandler{
		validator: validator,
	}
}

// ValidatePayment validates payment request
func (h *ValidationHandler) ValidatePayment(c *gin.Context) {
	var request validation.PaymentRequest
	if err := c.ShouldBindJSON(&request); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "Invalid request format",
			"details": err.Error(),
		})
		return
	}

	// Validate payment request
	result, err := h.validator.ValidatePayment(c.Request.Context(), request)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "Validation failed",
			"details": err.Error(),
		})
		return
	}

	// Return validation result
	response := gin.H{
		"validation_id": result.ValidationID,
		"valid":         result.Valid,
		"service_type":  result.ServiceType,
		"service_id":    result.ServiceID,
		"expires_at":    result.ExpiresAt.Format(time.RFC3339),
		"details":       result.Details,
	}

	if len(result.Errors) > 0 {
		response["errors"] = result.Errors
	}

	if len(result.Warnings) > 0 {
		response["warnings"] = result.Warnings
	}

	// If valid, provide payment creation parameters
	if result.Valid {
		response["payment_parameters"] = gin.H{
			"amount":   result.ValidatedAmount,
			"currency": result.ValidatedCurrency,
			"metadata": map[string]interface{}{
				"validation_id": result.ValidationID,
				"validated_at":  time.Now().Format(time.RFC3339),
			},
		}
	}

	c.JSON(http.StatusOK, response)
}

// GetValidation retrieves validation result
func (h *ValidationHandler) GetValidation(c *gin.Context) {
	validationID := c.Param("id")

	// In production, fetch from database
	// For now, return mock response
	c.JSON(http.StatusOK, gin.H{
		"validation_id": validationID,
		"valid":         true,
		"status":        "completed",
		"checked_at":    time.Now().Format(time.RFC3339),
	})
}

// UseValidation marks validation as used for a payment
func (h *ValidationHandler) UseValidation(c *gin.Context) {
	validationID := c.Param("id")
	var request struct {
		PaymentID string `json:"payment_id" binding:"required"`
	}

	if err := c.ShouldBindJSON(&request); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// In production, update validation record in database
	// Mark validation as used with payment ID

	c.JSON(http.StatusOK, gin.H{
		"validation_id": validationID,
		"payment_id":    request.PaymentID,
		"used_at":       time.Now().Format(time.RFC3339),
		"status":        "linked",
	})
}

// ValidateCurrency validates currency
func (h *ValidationHandler) ValidateCurrency(c *gin.Context) {
	currency := c.Param("currency")

	// Create mock validation request
	request := validation.PaymentRequest{
		Type:          "currency_check",
		ServiceID:     uuid.New().String(),
		Amount:        1000,
		Currency:      currency,
		Gateway:       "stripe",
		CustomerEmail: "test@example.com",
		Metadata:      make(map[string]interface{}),
	}

	result, err := h.validator.ValidatePayment(c.Request.Context(), request)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"currency": currency,
		"supported": result.Valid,
		"details":   result.Details["currency_info"],
		"errors":    result.Errors,
	})
}

// GetSupportedCurrencies returns list of supported currencies
func (h *ValidationHandler) GetSupportedCurrencies(c *gin.Context) {
	// In production, fetch from currency validator
	currencies := []map[string]interface{}{
		{"code": "USD", "name": "US Dollar", "symbol": "$", "decimals": 2},
		{"code": "EUR", "name": "Euro", "symbol": "€", "decimals": 2},
		{"code": "GBP", "name": "British Pound", "symbol": "£", "decimals": 2},
		{"code": "INR", "name": "Indian Rupee", "symbol": "₹", "decimals": 2},
		{"code": "JPY", "name": "Japanese Yen", "symbol": "¥", "decimals": 0},
		{"code": "CAD", "name": "Canadian Dollar", "symbol": "C$", "decimals": 2},
		{"code": "AUD", "name": "Australian Dollar", "symbol": "A$", "decimals": 2},
		{"code": "SGD", "name": "Singapore Dollar", "symbol": "S$", "decimals": 2},
		{"code": "MYR", "name": "Malaysian Ringgit", "symbol": "RM", "decimals": 2},
		{"code": "AED", "name": "UAE Dirham", "symbol": "د.إ", "decimals": 2},
	}

	c.JSON(http.StatusOK, gin.H{
		"currencies": currencies,
		"count":      len(currencies),
		"timestamp":  time.Now().Format(time.RFC3339),
	})
}