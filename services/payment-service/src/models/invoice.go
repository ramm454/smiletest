package models

import (
    "time"
)

type Invoice struct {
    ID             string    `json:"id" gorm:"primaryKey"`
    InvoiceNumber  string    `json:"invoice_number" gorm:"uniqueIndex"`
    UserID         string    `json:"user_id" gorm:"index"`
    PaymentID      string    `json:"payment_id" gorm:"index"`
    Status         string    `json:"status"` // draft, sent, paid, overdue, cancelled
    Amount         int64     `json:"amount"`
    Currency       string    `json:"currency"`
    TaxAmount      int64     `json:"tax_amount"`
    TaxRate        float64   `json:"tax_rate"`
    InvoiceDate    time.Time `json:"invoice_date"`
    DueDate        time.Time `json:"due_date"`
    PaidAt         time.Time `json:"paid_at"`
    PDFURL         string    `json:"pdf_url"`
    HTMLURL        string    `json:"html_url"`
    Items          JSONB     `json:"items" gorm:"type:jsonb"`
    Notes          string    `json:"notes"`
    Terms          string    `json:"terms"`
    Metadata       JSONB     `json:"metadata" gorm:"type:jsonb"`
    CreatedAt      time.Time `json:"created_at"`
    UpdatedAt      time.Time `json:"updated_at"`
    
    // Relationships
    Payment Payment `json:"payment" gorm:"foreignKey:PaymentID"`
    User    User    `json:"user" gorm:"foreignKey:UserID"`
}

// InvoiceItem represents a line item on an invoice
type InvoiceItem struct {
    ID           string  `json:"id"`
    Description  string  `json:"description"`
    Quantity     float64 `json:"quantity"`
    UnitPrice    float64 `json:"unit_price"`
    TotalPrice   float64 `json:"total_price"`
    TaxRate      float64 `json:"tax_rate"`
    TaxAmount    float64 `json:"tax_amount"`
    ProductID    string  `json:"product_id,omitempty"`
    ProductType  string  `json:"product_type,omitempty"`
    ServiceDate  string  `json:"service_date,omitempty"`
}