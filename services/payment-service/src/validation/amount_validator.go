package validation

import (
	"fmt"
	"math"
)

// AmountValidator validates payment amounts
type AmountValidator struct {
	minAmounts map[string]int64 // currency -> min amount in smallest unit
	maxAmounts map[string]int64 // currency -> max amount in smallest unit
}

// NewAmountValidator creates a new amount validator
func NewAmountValidator() *AmountValidator {
	validator := &AmountValidator{
		minAmounts: make(map[string]int64),
		maxAmounts: make(map[string]int64),
	}

	// Initialize amount limits by currency
	validator.initializeAmountLimits()

	return validator
}

// Validate validates amount for currency
func (av *AmountValidator) Validate(amount int64, currency string, result *ValidationResult) error {
	currency = strings.ToUpper(currency)

	// Check minimum amount
	minAmount, hasMin := av.minAmounts[currency]
	if hasMin && amount < minAmount {
		result.Errors = append(result.Errors, ValidationError{
			Code:     "AMOUNT_TOO_SMALL",
			Message:  fmt.Sprintf("Amount is too small. Minimum is %s %.2f", 
				currency, float64(minAmount)/100),
			Field:    "amount",
			Severity: "error",
		})
		result.Valid = false
	}

	// Check maximum amount
	maxAmount, hasMax := av.maxAmounts[currency]
	if hasMax && amount > maxAmount {
		result.Errors = append(result.Errors, ValidationError{
			Code:     "AMOUNT_TOO_LARGE",
			Message:  fmt.Sprintf("Amount is too large. Maximum is %s %.2f", 
				currency, float64(maxAmount)/100),
			Field:    "amount",
			Severity: "error",
		})
		result.Valid = false
	}

	// Check for suspicious amounts (e.g., 999999)
	if av.isSuspiciousAmount(amount, currency) {
		result.Warnings = append(result.Warnings, ValidationWarning{
			Code:    "SUSPICIOUS_AMOUNT",
			Message: "Amount appears suspicious. Please verify.",
			Action:  "review_amount",
		})
	}

	// Round amount to valid increments
	roundedAmount := av.roundAmount(amount, currency)
	if roundedAmount != amount {
		result.Warnings = append(result.Warnings, ValidationWarning{
			Code:    "AMOUNT_ROUNDED",
			Message: fmt.Sprintf("Amount rounded from %s %.4f to %s %.2f", 
				currency, float64(amount)/100, currency, float64(roundedAmount)/100),
			Action:  "amount_adjusted",
		})
		amount = roundedAmount
	}

	result.ValidatedAmount = amount
	result.Details["amount_limits"] = map[string]int64{
		"min_amount": minAmount,
		"max_amount": maxAmount,
		"input_amount": amount,
		"rounded_amount": roundedAmount,
	}

	return nil
}

// initializeAmountLimits initializes amount limits by currency
func (av *AmountValidator) initializeAmountLimits() {
	// Minimum amounts in smallest currency unit (cents/paise)
	av.minAmounts = map[string]int64{
		"USD": 50,    // $0.50
		"EUR": 50,    // €0.50
		"GBP": 50,    // £0.50
		"INR": 100,   // ₹1.00
		"JPY": 1,     // ¥1
		"AED": 200,   // 2 AED
		"SGD": 50,    // S$0.50
		"MYR": 100,   // RM1.00
	}

	// Maximum amounts
	av.maxAmounts = map[string]int64{
		"USD": 100000000,  // $1,000,000.00
		"EUR": 100000000,  // €1,000,000.00
		"GBP": 100000000,  // £1,000,000.00
		"INR": 1500000000, // ₹15,000,000.00
		"JPY": 1000000000, // ¥10,000,000
		"AED": 500000000,  // 5,000,000 AED
		"SGD": 200000000,  // S$2,000,000.00
		"MYR": 500000000,  // RM5,000,000.00
	}
}

// isSuspiciousAmount checks for suspicious amounts
func (av *AmountValidator) isSuspiciousAmount(amount int64, currency string) bool {
	// Check for round numbers that might be test amounts
	suspiciousAmounts := []int64{999999, 123456, 1000000, 500000, 111111}

	for _, suspicious := range suspiciousAmounts {
		if amount == suspicious {
			return true
		}
	}

	// Check for amounts ending in many zeros
	if amount%1000000 == 0 && amount > 1000000 {
		return true
	}

	return false
}

// roundAmount rounds amount to valid increments
func (av *AmountValidator) roundAmount(amount int64, currency string) int64 {
	// Different rounding rules per currency
	switch currency {
	case "JPY": // No decimals for JPY
		return amount
	case "INR", "USD", "EUR", "GBP", "AUD", "CAD", "SGD", "MYR", "AED":
		// Round to 2 decimal places
		return (amount / 100) * 100
	default:
		// Default rounding to 2 decimal places
		return (amount / 100) * 100
	}
}