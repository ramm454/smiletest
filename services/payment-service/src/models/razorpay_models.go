package models

import (
    "time"
)

// RazorPayOrder represents an order in RazorPay
type RazorPayOrder struct {
    ID              string    `json:"id" gorm:"primaryKey"`
    OrderID         string    `json:"order_id"` // RazorPay order ID
    Amount          int64     `json:"amount"`
    Currency        string    `json:"currency"`
    Receipt         string    `json:"receipt"`
    Status          string    `json:"status"`
    Attempts        int       `json:"attempts"`
    Notes           JSONB     `json:"notes" gorm:"type:jsonb"`
    CreatedAt       time.Time `json:"created_at"`
    UpdatedAt       time.Time `json:"updated_at"`
}

// RazorPayPayment represents a payment in RazorPay
type RazorPayPayment struct {
    ID              string    `json:"id" gorm:"primaryKey"`
    PaymentID       string    `json:"payment_id"` // RazorPay payment ID
    OrderID         string    `json:"order_id"`
    Amount          int64     `json:"amount"`
    Currency        string    `json:"currency"`
    Status          string    `json:"status"`
    Method          string    `json:"method"` // card, netbanking, upi, wallet
    Bank            string    `json:"bank"`
    Wallet          string    `json:"wallet"`
    VPA             string    `json:"vpa"` // for UPI
    CardID          string    `json:"card_id"`
    CardNetwork     string    `json:"card_network"`
    CardType        string    `json:"card_type"`
    International   bool      `json:"international"`
    Email           string    `json:"email"`
    Contact         string    `json:"contact"`
    Fee             int64     `json:"fee"`
    Tax             int64     `json:"tax"`
    ErrorCode       string    `json:"error_code"`
    ErrorDescription string   `json:"error_description"`
    ErrorSource     string    `json:"error_source"`
    ErrorStep       string    `json:"error_step"`
    ErrorReason     string    `json:"error_reason"`
    Notes           JSONB     `json:"notes" gorm:"type:jsonb"`
    CreatedAt       time.Time `json:"created_at"`
}

// RazorPayRefund represents a refund in RazorPay
type RazorPayRefund struct {
    ID              string    `json:"id" gorm:"primaryKey"`
    RefundID        string    `json:"refund_id"` // RazorPay refund ID
    PaymentID       string    `json:"payment_id"`
    Amount          int64     `json:"amount"`
    Currency        string    `json:"currency"`
    Status          string    `json:"status"`
    SpeedProcessed  string    `json:"speed_processed"` // instant, normal
    SpeedRequested  string    `json:"speed_requested"`
    Notes           JSONB     `json:"notes" gorm:"type:jsonb"`
    CreatedAt       time.Time `json:"created_at"`
}