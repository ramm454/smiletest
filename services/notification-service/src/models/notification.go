// models/notification.go
package models

import "time"

type Notification struct {
	ID        string    `json:"id" gorm:"primaryKey"`
	UserID    string    `json:"user_id" gorm:"index"`
	Type      string    `json:"type"` // email, sms, push, whatsapp
	Channel   string    `json:"channel"`
	Template  string    `json:"template"`
	
	// Content
	Subject   string    `json:"subject"`
	Content   string    `json:"content"`
	Data      JSONB     `json:"data" gorm:"type:jsonb"`
	
	// Status
	Status    string    `json:"status" gorm:"default:'pending'"`
	SentAt    *time.Time `json:"sent_at"`
	DeliveredAt *time.Time `json:"delivered_at"`
	OpenedAt  *time.Time `json:"opened_at"`
	
	// Retry
	RetryCount int       `json:"retry_count" gorm:"default:0"`
	LastRetryAt *time.Time `json:"last_retry_at"`
	Error      string    `json:"error"`
	
	// Timestamps
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}

type NotificationTemplate struct {
	ID       string `json:"id" gorm:"primaryKey"`
	Name     string `json:"name" gorm:"uniqueIndex"`
	Type     string `json:"type"` // booking_confirmation, reminder, etc.
	Channels []string `json:"channels" gorm:"type:text[]"`
	
	// Templates
	Subject  string `json:"subject"`
	Body     string `json:"body"`
	HTMLBody string `json:"html_body"`
	SMSBody  string `json:"sms_body"`
	
	// Variables
	Variables []string `json:"variables" gorm:"type:text[]"`
	
	// Metadata
	IsActive bool `json:"is_active" gorm:"default:true"`
	
	// Timestamps
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}