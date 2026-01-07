// models/payment.go
package models

import (
	"time"
)

type Payment struct {
	ID            string    `json:"id" gorm:"primaryKey"`
	BookingID     string    `json:"booking_id" gorm:"index"`
	Amount        float64   `json:"amount"`
	Currency      string    `json:"currency" gorm:"default:'USD'"`
	Method        string    `json:"method"` // stripe, paypal, etc.
	Status        string    `json:"status" gorm:"default:'pending'"`
	
	// Customer info
	CustomerID    string    `json:"customer_id"`
	CustomerEmail string    `json:"customer_email"`
	
	// Gateway details
	Gateway       string    `json:"gateway"`
	TransactionID string    `json:"transaction_id" gorm:"index"`
	PaymentIntent string    `json:"payment_intent"`
	ClientSecret  string    `json:"client_secret"`
	ReceiptURL    string    `json:"receipt_url"`
	
	// Metadata
	Metadata      JSONB     `json:"metadata" gorm:"type:jsonb"`
	
	// Timestamps
	CreatedAt     time.Time `json:"created_at"`
	UpdatedAt     time.Time `json:"updated_at"`
	PaidAt        *time.Time `json:"paid_at"`
	RefundedAt    *time.Time `json:"refunded_at"`
}

type Subscription struct {
	ID            string    `json:"id" gorm:"primaryKey"`
	UserID        string    `json:"user_id" gorm:"index"`
	PlanID        string    `json:"plan_id"`
	Status        string    `json:"status" gorm:"default:'active'"`
	
	// Pricing
	Amount        float64   `json:"amount"`
	Currency      string    `json:"currency" gorm:"default:'USD'"`
	Interval      string    `json:"interval"` // month, year
	
	// Dates
	StartDate     time.Time `json:"start_date"`
	EndDate       *time.Time `json:"end_date"`
	CurrentPeriodStart time.Time `json:"current_period_start"`
	CurrentPeriodEnd   time.Time `json:"current_period_end"`
	
	// Gateway
	Gateway       string    `json:"gateway"`
	SubscriptionID string   `json:"subscription_id"`
	CustomerID    string    `json:"customer_id"`
	
	// Metadata
	Metadata      JSONB     `json:"metadata" gorm:"type:jsonb"`
	
	// Timestamps
	CreatedAt     time.Time `json:"created_at"`
	UpdatedAt     time.Time `json:"updated_at"`
	CancelledAt   *time.Time `json:"cancelled_at"`
}

type Refund struct {
	ID            string    `json:"id" gorm:"primaryKey"`
	PaymentID     string    `json:"payment_id" gorm:"index"`
	Amount        float64   `json:"amount"`
	Reason        string    `json:"reason"`
	Status        string    `json:"status" gorm:"default:'pending'"`
	
	// Gateway
	Gateway       string    `json:"gateway"`
	RefundID      string    `json:"refund_id"`
	
	// Metadata
	Metadata      JSONB     `json:"metadata" gorm:"type:jsonb"`
	
	// Timestamps
	CreatedAt     time.Time `json:"created_at"`
	UpdatedAt     time.Time `json:"updated_at"`
	ProcessedAt   *time.Time `json:"processed_at"`
}

// JSONB type for PostgreSQL JSONB
type JSONB map[string]interface{}

func (j JSONB) GormDataType() string {
	return "jsonb"
}