package gdpr

import (
	"encoding/json"
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

// GDPRAuditLog logs all GDPR-related activities
type GDPRAuditLog struct {
	ID           string    `json:"id" gorm:"primaryKey"`
	Timestamp    time.Time `json:"timestamp"`
	Action       string    `json:"action"`
	UserID       string    `json:"user_id"`
	UserEmail    string    `json:"user_email"`
	IPAddress    string    `json:"ip_address"`
	UserAgent    string    `json:"user_agent"`
	ResourceType string    `json:"resource_type"`
	ResourceID   string    `json:"resource_id"`
	Description  string    `json:"description"`
	Details      []byte    `json:"details" gorm:"type:bytea"`
	Status       string    `json:"status"` // success, failure, partial
	CreatedAt    time.Time `json:"created_at"`
}

// LogGDPRAction logs a GDPR action
func LogGDPRAction(db *gorm.DB, action, userID, userEmail, description string, details interface{}) error {
	detailsJSON, _ := json.Marshal(details)
	
	logEntry := GDPRAuditLog{
		ID:          uuid.New().String(),
		Timestamp:   time.Now(),
		Action:      action,
		UserID:      userID,
		UserEmail:   userEmail,
		Description: description,
		Details:     detailsJSON,
		Status:      "success",
		CreatedAt:   time.Now(),
	}
	
	return db.Create(&logEntry).Error
}

// Common GDPR audit actions
const (
	ActionConsentGranted     = "consent_granted"
	ActionConsentRevoked     = "consent_revoked"
	ActionDataAccessRequest  = "data_access_request"
	ActionDataErasureRequest = "data_erasure_request"
	ActionDataRectification  = "data_rectification"
	ActionDataPortability    = "data_portability"
	ActionBreachDetected     = "breach_detected"
	ActionBreachNotified     = "breach_notified"
	ActionDataAnonymized     = "data_anonymized"
	ActionDPOConsultation    = "dpo_consultation"
	ActionDPIAPerformed      = "dpia_performed"
)