package gdpr

import (
	"context"
	"crypto/aes"
	"crypto/cipher"
	"crypto/rand"
	"encoding/base64"
	"fmt"
	"io"
	"strings"
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

// DataProtectionByDesign implements privacy by design principles
type DataProtectionByDesign struct {
	db                *gorm.DB
	encryptionKey     []byte
	pseudonymizationSalt string
}

// NewDataProtectionByDesign creates new privacy by design service
func NewDataProtectionByDesign(db *gorm.DB) *DataProtectionByDesign {
	key := os.Getenv("DATA_ENCRYPTION_KEY")
	salt := os.Getenv("PSEUDONYMIZATION_SALT")
	
	return &DataProtectionByDesign{
		db:                    db,
		encryptionKey:         []byte(key),
		pseudonymizationSalt: salt,
	}
}

// PseudonymizedData represents pseudonymized personal data
type PseudonymizedData struct {
	ID               string    `json:"id" gorm:"primaryKey"`
	OriginalValue    string    `json:"original_value" gorm:"-"`
	Pseudonym        string    `json:"pseudonym" gorm:"index"`
	Hash             string    `json:"hash"`
	DataType         string    `json:"data_type"` // email, phone, name, address
	Purpose          string    `json:"purpose"`
	CreatedAt        time.Time `json:"created_at"`
	ExpiresAt        time.Time `json:"expires_at"`
	ReidentificationKey string `json:"reidentification_key"` // Encrypted
}

// DataRetentionPolicy defines data retention periods
type DataRetentionPolicy struct {
	ID              string    `json:"id" gorm:"primaryKey"`
	DataType        string    `json:"data_type"`
	DataCategory    string    `json:"data_category"`
	Purpose         string    `json:"purpose"`
	RetentionPeriod string    `json:"retention_period"` // e.g., "7 years", "30 days", "session"
	LegalBasis      string    `json:"legal_basis"`
	AutoDelete      bool      `json:"auto_delete"`
	CreatedAt       time.Time `json:"created_at"`
	UpdatedAt       time.Time `json:"updated_at"`
}

// ApplyPrivacyByDesign applies privacy by design to payment data
func (dpd *DataProtectionByDesign) ApplyPrivacyByDesign(ctx context.Context, paymentData map[string]interface{}) (map[string]interface{}, error) {
	protectedData := make(map[string]interface{})
	
	// 1. Data Minimization - Only collect necessary data
	protectedData = dpd.applyDataMinimization(paymentData)
	
	// 2. Pseudonymization
	protectedData = dpd.applyPseudonymization(protectedData)
	
	// 3. Encryption of sensitive fields
	protectedData = dpd.encryptSensitiveFields(protectedData)
	
	// 4. Add metadata
	protectedData["privacy_applied_at"] = time.Now().Format(time.RFC3339)
	protectedData["privacy_version"] = "gdpr_v1"
	protectedData["data_protection_level"] = "enhanced"
	
	return protectedData, nil
}

// applyDataMinimization removes unnecessary data
func (dpd *DataProtectionByDesign) applyDataMinimization(data map[string]interface{}) map[string]interface{} {
	minimized := make(map[string]interface{})
	
	// Only keep necessary fields for payment processing
	allowedFields := map[string]bool{
		"amount": true,
		"currency": true,
		"payment_method": true,
		"billing_address": true,
		"email": true,
		"user_id": true,
		"metadata": true,
		"description": true,
	}
	
	for key, value := range data {
		if allowedFields[key] {
			minimized[key] = value
		}
	}
	
	return minimized
}

// applyPseudonymization pseudonymizes personal data
func (dpd *DataProtectionByDesign) applyPseudonymization(data map[string]interface{}) map[string]interface{} {
	pseudonymized := make(map[string]interface{})
	
	for key, value := range data {
		strValue, ok := value.(string)
		if !ok {
			pseudonymized[key] = value
			continue
		}
		
		// Check if field should be pseudonymized
		if dpd.shouldPseudonymize(key) {
			pseudonym := dpd.generatePseudonym(strValue, key)
			pseudonymized[key] = pseudonym
			
			// Store mapping for legitimate purposes
			dpd.storePseudonymMapping(strValue, pseudonym, key)
		} else {
			pseudonymized[key] = value
		}
	}
	
	return pseudonymized
}

// encryptSensitiveFields encrypts sensitive data
func (dpd *DataProtectionByDesign) encryptSensitiveFields(data map[string]interface{}) map[string]interface{} {
	encrypted := make(map[string]interface{})
	
	for key, value := range data {
		if dpd.isSensitiveField(key) {
			encryptedValue, err := dpd.encryptData(value)
			if err == nil {
				encrypted[key] = encryptedValue
				encrypted[key+"_encrypted"] = true
			} else {
				encrypted[key] = value
			}
		} else {
			encrypted[key] = value
		}
	}
	
	return encrypted
}

// generatePseudonym generates a GDPR-compliant pseudonym
func (dpd *DataProtectionByDesign) generatePseudonym(value, fieldType string) string {
	// Use hash-based pseudonymization
	hash := sha256.New()
	hash.Write([]byte(value + dpd.pseudonymizationSalt + fieldType))
	return "pseudo_" + base64.URLEncoding.EncodeToString(hash.Sum(nil))[:32]
}

// encryptData encrypts data using AES-GCM
func (dpd *DataProtectionByDesign) encryptData(data interface{}) (string, error) {
	// Convert data to bytes
	var dataBytes []byte
	switch v := data.(type) {
	case string:
		dataBytes = []byte(v)
	default:
		jsonData, err := json.Marshal(v)
		if err != nil {
			return "", err
		}
		dataBytes = jsonData
	}
	
	block, err := aes.NewCipher(dpd.encryptionKey)
	if err != nil {
		return "", err
	}
	
	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return "", err
	}
	
	nonce := make([]byte, gcm.NonceSize())
	if _, err := io.ReadFull(rand.Reader, nonce); err != nil {
		return "", err
	}
	
	ciphertext := gcm.Seal(nonce, nonce, dataBytes, nil)
	return base64.StdEncoding.EncodeToString(ciphertext), nil
}

// decryptData decrypts data
func (dpd *DataProtectionByDesign) decryptData(encrypted string) (string, error) {
	ciphertext, err := base64.StdEncoding.DecodeString(encrypted)
	if err != nil {
		return "", err
	}
	
	block, err := aes.NewCipher(dpd.encryptionKey)
	if err != nil {
		return "", err
	}
	
	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return "", err
	}
	
	nonceSize := gcm.NonceSize()
	if len(ciphertext) < nonceSize {
		return "", fmt.Errorf("ciphertext too short")
	}
	
	nonce, ciphertext := ciphertext[:nonceSize], ciphertext[nonceSize:]
	plaintext, err := gcm.Open(nil, nonce, ciphertext, nil)
	if err != nil {
		return "", err
	}
	
	return string(plaintext), nil
}

// shouldPseudonymize determines if field should be pseudonymized
func (dpd *DataProtectionByDesign) shouldPseudonymize(field string) bool {
	pseudonymizeFields := map[string]bool{
		"email": true,
		"phone": true,
		"ip_address": true,
		"user_agent": true,
		"billing_address": true,
		"shipping_address": true,
	}
	return pseudonymizeFields[field]
}

// isSensitiveField determines if field contains sensitive data
func (dpd *DataProtectionByDesign) isSensitiveField(field string) bool {
	sensitiveFields := map[string]bool{
		"card_number": true,
		"cvv": true,
		"expiry_date": true,
		"bank_account": true,
		"tax_id": true,
		"ssn": true,
		"passport_number": true,
	}
	return sensitiveFields[field]
}

// storePseudonymMapping stores pseudonym mapping for legitimate purposes
func (dpd *DataProtectionByDesign) storePseudonymMapping(original, pseudonym, dataType string) {
	mapping := PseudonymizedData{
		ID:               uuid.New().String(),
		OriginalValue:    original,
		Pseudonym:        pseudonym,
		Hash:             dpd.generateHash(original),
		DataType:         dataType,
		Purpose:          "fraud_prevention",
		CreatedAt:        time.Now(),
		ExpiresAt:        time.Now().Add(365 * 24 * time.Hour), // 1 year
		ReidentificationKey: dpd.encryptReidentificationKey(original),
	}
	
	dpd.db.Create(&mapping)
}

// InitializeRetentionPolicies creates default retention policies
func (dpd *DataProtectionByDesign) InitializeRetentionPolicies() error {
	policies := []DataRetentionPolicy{
		{
			ID:              uuid.New().String(),
			DataType:        "payment_transaction",
			DataCategory:    "financial_data",
			Purpose:         "legal_compliance",
			RetentionPeriod: "7 years",
			LegalBasis:      "legal_obligation",
			AutoDelete:      true,
		},
		{
			ID:              uuid.New().String(),
			DataType:        "customer_contact",
			DataCategory:    "contact_data",
			Purpose:         "customer_service",
			RetentionPeriod: "2 years",
			LegalBasis:      "legitimate_interest",
			AutoDelete:      true,
		},
		{
			ID:              uuid.New().String(),
			DataType:        "analytics_data",
			DataCategory:    "usage_data",
			Purpose:         "service_improvement",
			RetentionPeriod: "1 year",
			LegalBasis:      "consent",
			AutoDelete:      true,
		},
		{
			ID:              uuid.New().String(),
			DataType:        "marketing_consent",
			DataCategory:    "consent_data",
			Purpose:         "marketing",
			RetentionPeriod: "2 years",
			LegalBasis:      "consent",
			AutoDelete:      true,
		},
		{
			ID:              uuid.New().String(),
			DataType:        "login_records",
			DataCategory:    "technical_data",
			Purpose:         "security",
			RetentionPeriod: "6 months",
			LegalBasis:      "legitimate_interest",
			AutoDelete:      true,
		},
	}
	
	for _, policy := range policies {
		policy.CreatedAt = time.Now()
		policy.UpdatedAt = time.Now()
		if err := dpd.db.Create(&policy).Error; err != nil {
			return fmt.Errorf("failed to create retention policy: %w", err)
		}
	}
	
	return nil
}

// CleanExpiredData cleans data based on retention policies
func (dpd *DataProtectionByDesign) CleanExpiredData(ctx context.Context) error {
	log.Println("Starting GDPR data cleanup...")
	
	// Get all retention policies
	var policies []DataRetentionPolicy
	if err := dpd.db.Find(&policies).Error; err != nil {
		return err
	}
	
	for _, policy := range policies {
		if policy.AutoDelete {
			dpd.cleanDataByPolicy(ctx, policy)
		}
	}
	
	return nil
}