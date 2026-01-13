package gdpr

import (
	"context"
	"fmt"
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

// ConsentManager manages GDPR consents
type ConsentManager struct {
	db *gorm.DB
}

// Consent represents GDPR consent record
type Consent struct {
	ID                string                 `json:"id" gorm:"primaryKey"`
	UserID            string                 `json:"user_id" gorm:"index"`
	UserEmail         string                 `json:"user_email" gorm:"index"`
	ConsentType       string                 `json:"consent_type"` // marketing, analytics, necessary, preferences, third_party
	ConsentVersion    string                 `json:"consent_version"`
	Purpose           string                 `json:"purpose"`
	LawfulBasis       string                 `json:"lawful_basis"` // consent, legitimate_interest, contract, legal_obligation
	Status            string                 `json:"status"` // granted, revoked, expired
	GrantedAt         time.Time              `json:"granted_at"`
	RevokedAt         *time.Time             `json:"revoked_at"`
	ExpiresAt         *time.Time             `json:"expires_at"`
	IPAddress         string                 `json:"ip_address"`
	UserAgent         string                 `json:"user_agent"`
	ConsentMedium     string                 `json:"consent_medium"` // website, mobile_app, email, paper
	ProofOfConsent    string                 `json:"proof_of_consent"` // Screenshot, log entry
	Preferences       map[string]interface{} `json:"preferences" gorm:"type:jsonb"`
	CreatedAt         time.Time              `json:"created_at"`
	UpdatedAt         time.Time              `json:"updated_at"`
}

// ConsentTemplate for standardized consent requests
type ConsentTemplate struct {
	ID                string    `json:"id" gorm:"primaryKey"`
	ConsentType       string    `json:"consent_type"`
	Version           string    `json:"version"`
	Title             string    `json:"title"`
	Description       string    `json:"description"`
	Required          bool      `json:"required"`
	DefaultStatus     string    `json:"default_status"` // granted, denied
	LawfulBasis       string    `json:"lawful_basis"`
	RetentionPeriod   string    `json:"retention_period"`
	ThirdParties      []string  `json:"third_parties" gorm:"type:jsonb"`
	CreatedAt         time.Time `json:"created_at"`
	UpdatedAt         time.Time `json:"updated_at"`
	Active            bool      `json:"active"`
}

// NewConsentManager creates a new consent manager
func NewConsentManager(db *gorm.DB) *ConsentManager {
	return &ConsentManager{db: db}
}

// GrantConsent records user consent
func (cm *ConsentManager) GrantConsent(ctx context.Context, userID, userEmail, consentType string, preferences map[string]interface{}) (*Consent, error) {
	// Check for existing consent
	var existingConsent Consent
	cm.db.Where("user_id = ? AND consent_type = ? AND status = 'granted'", userID, consentType).
		First(&existingConsent)

	if existingConsent.ID != "" {
		// Revoke existing consent
		now := time.Now()
		existingConsent.Status = "revoked"
		existingConsent.RevokedAt = &now
		cm.db.Save(&existingConsent)
	}

	// Create new consent
	consent := Consent{
		ID:             uuid.New().String(),
		UserID:         userID,
		UserEmail:      userEmail,
		ConsentType:    consentType,
		ConsentVersion: "1.0",
		Purpose:        cm.getConsentPurpose(consentType),
		LawfulBasis:    "consent",
		Status:         "granted",
		GrantedAt:      time.Now(),
		IPAddress:      getClientIP(ctx),
		UserAgent:      getUserAgent(ctx),
		ConsentMedium:  "website",
		ProofOfConsent: "digital_record",
		Preferences:    preferences,
		CreatedAt:      time.Now(),
		UpdatedAt:      time.Now(),
	}

	if err := cm.db.Create(&consent).Error; err != nil {
		return nil, fmt.Errorf("failed to record consent: %w", err)
	}

	// Log consent grant
	cm.logConsentAction(ctx, "consent_granted", consent)

	return &consent, nil
}

// RevokeConsent revokes user consent
func (cm *ConsentManager) RevokeConsent(ctx context.Context, userID, consentType string) error {
	var consent Consent
	if err := cm.db.Where("user_id = ? AND consent_type = ? AND status = 'granted'", userID, consentType).
		First(&consent).Error; err != nil {
		return fmt.Errorf("consent not found: %w", err)
	}

	now := time.Now()
	consent.Status = "revoked"
	consent.RevokedAt = &now
	consent.UpdatedAt = now

	if err := cm.db.Save(&consent).Error; err != nil {
		return fmt.Errorf("failed to revoke consent: %w", err)
	}

	// Take action based on consent type
	switch consentType {
	case "marketing":
		cm.unsubscribeFromMarketing(ctx, userID)
	case "analytics":
		cm.disableAnalytics(ctx, userID)
	case "third_party":
		cm.notifyThirdParties(ctx, userID, "consent_revoked")
	}

	// Log consent revocation
	cm.logConsentAction(ctx, "consent_revoked", consent)

	return nil
}

// CheckConsent checks if user has given consent
func (cm *ConsentManager) CheckConsent(ctx context.Context, userID, consentType string) (bool, *Consent, error) {
	var consent Consent
	if err := cm.db.Where("user_id = ? AND consent_type = ? AND status = 'granted'", userID, consentType).
		First(&consent).Error; err != nil {
		return false, nil, nil
	}

	// Check if consent has expired
	if consent.ExpiresAt != nil && time.Now().After(*consent.ExpiresAt) {
		consent.Status = "expired"
		cm.db.Save(&consent)
		return false, &consent, nil
	}

	return true, &consent, nil
}

// GetUserConsents returns all consents for a user
func (cm *ConsentManager) GetUserConsents(ctx context.Context, userID string) ([]Consent, error) {
	var consents []Consent
	if err := cm.db.Where("user_id = ?", userID).
		Order("granted_at DESC").
		Find(&consents).Error; err != nil {
		return nil, err
	}
	return consents, nil
}

// ExportConsents exports consent data for portability
func (cm *ConsentManager) ExportConsents(ctx context.Context, userID string) (map[string]interface{}, error) {
	consents, err := cm.GetUserConsents(ctx, userID)
	if err != nil {
		return nil, err
	}

	data := map[string]interface{}{
		"user_id":     userID,
		"exported_at": time.Now().Format(time.RFC3339),
		"consents":    consents,
		"format":      "gdpr_portability_v1",
	}

	return data, nil
}

// InitializeDefaultConsents creates default consent templates
func (cm *ConsentManager) InitializeDefaultConsents() error {
	defaultConsents := []ConsentTemplate{
		{
			ID:              uuid.New().String(),
			ConsentType:     "necessary",
			Version:         "1.0",
			Title:           "Necessary Cookies",
			Description:     "Required for the website to function. Cannot be disabled.",
			Required:        true,
			DefaultStatus:   "granted",
			LawfulBasis:     "contract",
			RetentionPeriod: "Session",
			Active:          true,
		},
		{
			ID:              uuid.New().String(),
			ConsentType:     "preferences",
			Version:         "1.0",
			Title:           "Preference Cookies",
			Description:     "Remember your settings and preferences",
			Required:        false,
			DefaultStatus:   "granted",
			LawfulBasis:     "consent",
			RetentionPeriod: "1 year",
			Active:          true,
		},
		{
			ID:              uuid.New().String(),
			ConsentType:     "analytics",
			Version:         "1.0",
			Title:           "Analytics Cookies",
			Description:     "Help us understand how visitors interact with our website",
			Required:        false,
			DefaultStatus:   "denied",
			LawfulBasis:     "consent",
			RetentionPeriod: "2 years",
			ThirdParties:    []string{"Google Analytics", "Amplitude"},
			Active:          true,
		},
		{
			ID:              uuid.New().String(),
			ConsentType:     "marketing",
			Version:         "1.0",
			Title:           "Marketing Cookies",
			Description:     "Used to track visitors across websites for advertising",
			Required:        false,
			DefaultStatus:   "denied",
			LawfulBasis:     "consent",
			RetentionPeriod: "1 year",
			ThirdParties:    []string{"Facebook", "Google Ads", "LinkedIn"},
			Active:          true,
		},
		{
			ID:              uuid.New().String(),
			ConsentType:     "payment_processing",
			Version:         "1.0",
			Title:           "Payment Processing",
			Description:     "Process your payments securely",
			Required:        true,
			DefaultStatus:   "granted",
			LawfulBasis:     "contract",
			RetentionPeriod: "7 years for tax purposes",
			ThirdParties:    []string{"Stripe", "PayPal", "RazorPay"},
			Active:          true,
		},
	}

	for _, template := range defaultConsents {
		template.CreatedAt = time.Now()
		template.UpdatedAt = time.Now()
		if err := cm.db.Create(&template).Error; err != nil {
			return fmt.Errorf("failed to create consent template: %w", err)
		}
	}

	return nil
}

// Helper methods
func (cm *ConsentManager) getConsentPurpose(consentType string) string {
	purposes := map[string]string{
		"necessary":     "Essential website functionality",
		"preferences":   "Remember user preferences and settings",
		"analytics":     "Website analytics and improvement",
		"marketing":     "Personalized marketing and advertising",
		"payment_processing": "Secure payment processing",
		"fraud_prevention": "Fraud detection and prevention",
		"customer_support": "Customer support and communication",
	}
	return purposes[consentType]
}

func (cm *ConsentManager) unsubscribeFromMarketing(ctx context.Context, userID string) {
	// Update user preferences
	// Remove from marketing lists
	// Notify marketing systems
}

func (cm *ConsentManager) disableAnalytics(ctx context.Context, userID string) {
	// Disable tracking for this user
	// Anonymize existing analytics data
}

func (cm *ConsentManager) notifyThirdParties(ctx context.Context, userID, action string) {
	// Notify all third-party processors of consent change
}

func (cm *ConsentManager) logConsentAction(ctx context.Context, action string, consent Consent) {
	// Log to audit trail
}