package validation

import (
	"context"
	"fmt"
	"log"
	"time"

	"gorm.io/gorm"
)

// BookingValidator validates booking payments
type BookingValidator struct {
	db *gorm.DB
}

func NewBookingValidator(db *gorm.DB) *BookingValidator {
	return &BookingValidator{db: db}
}

func (bv *BookingValidator) GetServiceType() string {
	return "booking"
}

func (bv *BookingValidator) Validate(ctx context.Context, bookingID string, amount int64, currency string) (*ValidationResult, error) {
	result := &ValidationResult{
		ServiceType: "booking",
		ServiceID:   bookingID,
		Valid:       true,
		Details:     make(map[string]interface{}),
	}

	// In production, this would call booking service
	// For now, simulate validation

	// Check if booking exists
	result.Details["booking_exists"] = true
	result.Details["booking_status"] = "confirmed"

	// Validate booking amount
	expectedAmount := int64(2500) // $25.00 in cents
	if amount != expectedAmount {
		result.Errors = append(result.Errors, ValidationError{
			Code:     "AMOUNT_MISMATCH",
			Message:  fmt.Sprintf("Amount mismatch. Expected: %s %.2f, Got: %s %.2f", 
				currency, float64(expectedAmount)/100, currency, float64(amount)/100),
			Severity: "error",
		})
		result.Valid = false
	}

	// Check if booking hasn't started
	bookingTime := time.Now().Add(2 * time.Hour)
	if time.Now().After(bookingTime) {
		result.Errors = append(result.Errors, ValidationError{
			Code:     "BOOKING_EXPIRED",
			Message:  "Booking has already started or expired",
			Severity: "error",
		})
		result.Valid = false
	}

	// Check capacity
	result.Details["capacity_available"] = true
	result.Details["participants_count"] = 1

	result.ValidatedAmount = expectedAmount
	result.ValidatedCurrency = currency

	return result, nil
}

// EcommerceValidator validates ecommerce payments
type EcommerceValidator struct {
	db *gorm.DB
}

func NewEcommerceValidator(db *gorm.DB) *EcommerceValidator {
	return &EcommerceValidator{db: db}
}

func (ev *EcommerceValidator) GetServiceType() string {
	return "ecommerce"
}

func (ev *EcommerceValidator) Validate(ctx context.Context, orderID string, amount int64, currency string) (*ValidationResult, error) {
	result := &ValidationResult{
		ServiceType: "ecommerce",
		ServiceID:   orderID,
		Valid:       true,
		Details:     make(map[string]interface{}),
	}

	// Simulate order validation
	result.Details["order_exists"] = true
	result.Details["order_status"] = "pending"

	// Validate order total with tolerance for shipping/tax
	orderTotal := amount
	tolerance := int64(100) // $1.00 tolerance
	expectedAmount := int64(5000) // $50.00

	if abs(orderTotal-expectedAmount) > tolerance {
		result.Errors = append(result.Errors, ValidationError{
			Code:     "ORDER_TOTAL_MISMATCH",
			Message:  "Order total mismatch beyond tolerance",
			Severity: "error",
		})
		result.Valid = false
	}

	// Check inventory
	result.Details["inventory_available"] = true
	result.Details["items_count"] = 3

	// Validate shipping address
	result.Details["shipping_valid"] = true
	result.Details["billing_valid"] = true

	result.ValidatedAmount = orderTotal
	result.ValidatedCurrency = currency

	return result, nil
}

// LiveValidator validates live session payments
type LiveValidator struct {
	db *gorm.DB
}

func NewLiveValidator(db *gorm.DB) *LiveValidator {
	return &LiveValidator{db: db}
}

func (lv *LiveValidator) GetServiceType() string {
	return "live"
}

func (lv *LiveValidator) Validate(ctx context.Context, sessionID string, amount int64, currency string) (*ValidationResult, error) {
	result := &ValidationResult{
		ServiceType: "live",
		ServiceID:   sessionID,
		Valid:       true,
		Details:     make(map[string]interface{}),
	}

	// Simulate session validation
	result.Details["session_exists"] = true
	result.Details["session_status"] = "scheduled"

	// Validate session price
	sessionPrice := int64(1500) // $15.00
	if amount != sessionPrice {
		result.Errors = append(result.Errors, ValidationError{
			Code:     "SESSION_PRICE_MISMATCH",
			Message:  fmt.Sprintf("Session price mismatch. Expected: %s %.2f", 
				currency, float64(sessionPrice)/100),
			Severity: "error",
		})
		result.Valid = false
	}

	// Check capacity
	result.Details["capacity_available"] = true
	result.Details["current_participants"] = 12
	result.Details["max_participants"] = 50

	// Check session time
	sessionTime := time.Now().Add(3 * time.Hour)
	if time.Now().After(sessionTime.Add(-30 * time.Minute)) {
		result.Errors = append(result.Errors, ValidationError{
			Code:     "SESSION_TOO_SOON",
			Message:  "Session starts in less than 30 minutes",
			Severity: "error",
		})
		result.Valid = false
	}

	result.ValidatedAmount = sessionPrice
	result.ValidatedCurrency = currency

	return result, nil
}

// SubscriptionValidator validates subscription payments
type SubscriptionValidator struct {
	db *gorm.DB
}

func NewSubscriptionValidator(db *gorm.DB) *SubscriptionValidator {
	return &SubscriptionValidator{db: db}
}

func (sv *SubscriptionValidator) GetServiceType() string {
	return "subscription"
}

func (sv *SubscriptionValidator) Validate(ctx context.Context, subscriptionID string, amount int64, currency string) (*ValidationResult, error) {
	result := &ValidationResult{
		ServiceType: "subscription",
		ServiceID:   subscriptionID,
		Valid:       true,
		Details:     make(map[string]interface{}),
	}

	// Simulate subscription validation
	result.Details["subscription_exists"] = true
	result.Details["subscription_status"] = "active"

	// Validate subscription amount
	subscriptionAmount := int64(2999) // $29.99
	if amount != subscriptionAmount {
		result.Errors = append(result.Errors, ValidationError{
			Code:     "SUBSCRIPTION_AMOUNT_MISMATCH",
			Message:  fmt.Sprintf("Subscription amount mismatch. Expected: %s %.2f", 
				currency, float64(subscriptionAmount)/100),
			Severity: "error",
		})
		result.Valid = false
	}

	// Check if subscription is not cancelled
	result.Details["cancelled"] = false
	result.Details["next_billing_date"] = time.Now().AddDate(0, 1, 0)

	// Check for trial period
	result.Details["in_trial"] = false
	result.Details["trial_ends_at"] = nil

	result.ValidatedAmount = subscriptionAmount
	result.ValidatedCurrency = currency

	return result, nil
}

// DonationValidator validates donation payments
type DonationValidator struct {
	db *gorm.DB
}

func NewDonationValidator(db *gorm.DB) *DonationValidator {
	return &DonationValidator{db: db}
}

func (dv *DonationValidator) GetServiceType() string {
	return "donation"
}

func (dv *DonationValidator) Validate(ctx context.Context, donationID string, amount int64, currency string) (*ValidationResult, error) {
	result := &ValidationResult{
		ServiceType: "donation",
		ServiceID:   donationID,
		Valid:       true,
		Details:     make(map[string]interface{}),
	}

	// Donations have minimal validation
	result.Details["donation_type"] = "general"
	result.Details["tax_deductible"] = true

	// Suggested donation amounts
	suggestedAmounts := []int64{500, 1000, 2500, 5000, 10000}
	result.Details["suggested_amounts"] = suggestedAmounts

	// Check if amount is unusually large
	if amount > 1000000 { // $10,000
		result.Warnings = append(result.Warnings, ValidationWarning{
			Code:    "LARGE_DONATION",
			Message: "Large donation detected. Please ensure this is correct.",
			Action:  "review_donation_amount",
		})
	}

	result.ValidatedAmount = amount
	result.ValidatedCurrency = currency

	return result, nil
}

// Utility function
func abs(x int64) int64 {
	if x < 0 {
		return -x
	}
	return x
}