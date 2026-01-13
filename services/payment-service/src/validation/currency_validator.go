package validation

import (
	"fmt"
)

// CurrencyValidator validates currencies
type CurrencyValidator struct {
	supportedCurrencies map[string]CurrencyInfo
}

// CurrencyInfo contains currency information
type CurrencyInfo struct {
	Code     string `json:"code"`
	Name     string `json:"name"`
	Symbol   string `json:"symbol"`
	Decimals int    `json:"decimals"`
	Enabled  bool   `json:"enabled"`
}

// NewCurrencyValidator creates a new currency validator
func NewCurrencyValidator() *CurrencyValidator {
	validator := &CurrencyValidator{
		supportedCurrencies: make(map[string]CurrencyInfo),
	}

	// Initialize supported currencies
	validator.initializeCurrencies()

	return validator
}

// Validate validates currency
func (cv *CurrencyValidator) Validate(currency string, result *ValidationResult) error {
	currency = strings.ToUpper(currency)

	info, exists := cv.supportedCurrencies[currency]
	if !exists {
		result.Errors = append(result.Errors, ValidationError{
			Code:     "UNSUPPORTED_CURRENCY",
			Message:  fmt.Sprintf("Currency '%s' is not supported", currency),
			Field:    "currency",
			Severity: "error",
		})
		result.Valid = false
		return fmt.Errorf("unsupported currency: %s", currency)
	}

	if !info.Enabled {
		result.Errors = append(result.Errors, ValidationError{
			Code:     "CURRENCY_DISABLED",
			Message:  fmt.Sprintf("Currency '%s' is temporarily disabled", currency),
			Field:    "currency",
			Severity: "error",
		})
		result.Valid = false
		return fmt.Errorf("currency disabled: %s", currency)
	}

	// Add currency details to result
	result.Details["currency_info"] = info
	result.ValidatedCurrency = currency

	return nil
}

// initializeCurrencies initializes supported currencies
func (cv *CurrencyValidator) initializeCurrencies() {
	cv.supportedCurrencies = map[string]CurrencyInfo{
		"USD": {Code: "USD", Name: "US Dollar", Symbol: "$", Decimals: 2, Enabled: true},
		"EUR": {Code: "EUR", Name: "Euro", Symbol: "€", Decimals: 2, Enabled: true},
		"GBP": {Code: "GBP", Name: "British Pound", Symbol: "£", Decimals: 2, Enabled: true},
		"INR": {Code: "INR", Name: "Indian Rupee", Symbol: "₹", Decimals: 2, Enabled: true},
		"CAD": {Code: "CAD", Name: "Canadian Dollar", Symbol: "C$", Decimals: 2, Enabled: true},
		"AUD": {Code: "AUD", Name: "Australian Dollar", Symbol: "A$", Decimals: 2, Enabled: true},
		"JPY": {Code: "JPY", Name: "Japanese Yen", Symbol: "¥", Decimals: 0, Enabled: true},
		"SGD": {Code: "SGD", Name: "Singapore Dollar", Symbol: "S$", Decimals: 2, Enabled: true},
		"MYR": {Code: "MYR", Name: "Malaysian Ringgit", Symbol: "RM", Decimals: 2, Enabled: true},
		"AED": {Code: "AED", Name: "UAE Dirham", Symbol: "د.إ", Decimals: 2, Enabled: true},
	}
}

// GetSupportedCurrencies returns list of supported currencies
func (cv *CurrencyValidator) GetSupportedCurrencies() []CurrencyInfo {
	var currencies []CurrencyInfo
	for _, info := range cv.supportedCurrencies {
		if info.Enabled {
			currencies = append(currencies, info)
		}
	}
	return currencies
}