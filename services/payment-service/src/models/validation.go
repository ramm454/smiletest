package models

import (
	"time"
	"encoding/json"
)

// PaymentValidation stores payment validation results
type PaymentValidation struct {
	ID               string                 `json:"id" gorm:"primaryKey"`
	ServiceType      string                 `json:"service_type" gorm:"index"`
	ServiceID        string                 `json:"service_id" gorm:"index"`
	Amount           int64                  `json:"amount"`
	Currency         string                 `json:"currency"`
	CustomerEmail    string                 `json:"customer_email"`
	Gateway          string                 `json:"gateway"`
	Valid            bool                   `json:"valid"`
	ValidationErrors []ValidationError      `json:"validation_errors" gorm:"type:jsonb"`
	Warnings         []ValidationWarning    `json:"warnings" gorm:"type:jsonb"`
	Details          map[string]interface{} `json:"details" gorm:"type:jsonb"`
	ExpiresAt        time.Time              `json:"expires_at"`
	CreatedAt        time.Time              `json:"created_at"`
	UsedAt           *time.Time             `json:"used_at"`
	PaymentID        *string                `json:"payment_id"`
}

// ValidationError represents a validation error
type ValidationError struct {
	Code     string `json:"code"`
	Message  string `json:"message"`
	Field    string `json:"field,omitempty"`
	Severity string `json:"severity"`
}

// ValidationWarning represents a validation warning
type ValidationWarning struct {
	Code    string `json:"code"`
	Message string `json:"message"`
	Action  string `json:"action,omitempty"`
}

// GormDataType for JSONB fields
func (ValidationError) GormDataType() string {
	return "jsonb"
}

func (ValidationWarning) GormDataType() string {
	return "jsonb"
}