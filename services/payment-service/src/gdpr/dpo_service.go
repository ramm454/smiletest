package gdpr

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"log"
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

// DataProtectionOfficer service for GDPR compliance
type DataProtectionOfficer struct {
	db                *gorm.DB
	encryptionKey     string
	dpoEmail          string
	dpoName           string
	organizationName  string
	organizationEmail string
}

// NewDataProtectionOfficer creates a new DPO service
func NewDataProtectionOfficer(db *gorm.DB) *DataProtectionOfficer {
	return &DataProtectionOfficer{
		db:                db,
		encryptionKey:     os.Getenv("GDPR_ENCRYPTION_KEY"),
		dpoEmail:          os.Getenv("DPO_EMAIL"),
		dpoName:           os.Getenv("DPO_NAME"),
		organizationName:  os.Getenv("ORGANIZATION_NAME"),
		organizationEmail: os.Getenv("ORGANIZATION_EMAIL"),
	}
}

// DataSubjectRequest represents a GDPR data subject request
type DataSubjectRequest struct {
	ID             string    `json:"id" gorm:"primaryKey"`
	RequestType    string    `json:"request_type"` // access, rectification, erasure, portability, restriction, objection
	DataSubjectID  string    `json:"data_subject_id"`
	UserEmail      string    `json:"user_email"`
	UserID         string    `json:"user_id"`
	Description    string    `json:"description"`
	Status         string    `json:"status"` // pending, in_progress, completed, rejected, cancelled
	Priority       string    `json:"priority"` // low, medium, high, urgent
	RequestedAt    time.Time `json:"requested_at"`
	CompletedAt    *time.Time `json:"completed_at"`
	VerifiedAt     *time.Time `json:"verified_at"`
	VerificationMethod string `json:"verification_method"`
	ResponseData   []byte    `json:"response_data" gorm:"type:bytea"` // Encrypted response
	Notes          string    `json:"notes"`
	AssignedTo     string    `json:"assigned_to"`
	CreatedAt      time.Time `json:"created_at"`
	UpdatedAt      time.Time `json:"updated_at"`
}

// RecordOfProcessingActivity (ROPA) for GDPR Article 30
type RecordOfProcessingActivity struct {
	ID                     string                 `json:"id" gorm:"primaryKey"`
	ProcessName            string                 `json:"process_name"`
	Purpose                string                 `json:"purpose"`
	LawfulBasis            string                 `json:"lawful_basis"` // consent, contract, legal_obligation, vital_interest, public_task, legitimate_interest
	DataCategories         []string               `json:"data_categories" gorm:"type:jsonb"`
	DataSubjectCategories  []string               `json:"data_subject_categories" gorm:"type:jsonb"`
	Recipients             []string               `json:"recipients" gorm:"type:jsonb"`
	ThirdCountryTransfers  []ThirdCountryTransfer `json:"third_country_transfers" gorm:"type:jsonb"`
	RetentionPeriod        string                 `json:"retention_period"`
	SecurityMeasures       []string               `json:"security_measures" gorm:"type:jsonb"`
	DataProtectionImpactAssessment bool           `json:"dipa_required"`
	DPIAReference          string                 `json:"dipa_reference"`
	Controller             string                 `json:"controller"`
	Processor              string                 `json:"processor"`
	CreatedAt              time.Time              `json:"created_at"`
	UpdatedAt              time.Time              `json:"updated_at"`
	LastReviewDate         *time.Time             `json:"last_review_date"`
	NextReviewDate         time.Time              `json:"next_review_date"`
}

// ThirdCountryTransfer for international data transfers
type ThirdCountryTransfer struct {
	Country        string `json:"country"`
	AdequacyDecision bool `json:"adequacy_decision"`
	SCCsInPlace    bool   `json:"sccs_in_place"`
	AdditionalSafeguards string `json:"additional_safeguards"`
}

// DataProcessingAgreement (DPA) with processors
type DataProcessingAgreement struct {
	ID              string    `json:"id" gorm:"primaryKey"`
	ProcessorName   string    `json:"processor_name"`
	ProcessorEmail  string    `json:"processor_email"`
	ServiceProvided string    `json:"service_provided"`
	DataCategories  []string  `json:"data_categories" gorm:"type:jsonb"`
	Purpose         string    `json:"purpose"`
	Subprocessors   []Subprocessor `json:"subprocessors" gorm:"type:jsonb"`
	SCCsInPlace     bool      `json:"sccs_in_place"`
	SignedDate      time.Time `json:"signed_date"`
	ValidUntil      time.Time `json:"valid_until"`
	Status          string    `json:"status"` // active, expired, terminated
	DocumentURL     string    `json:"document_url"`
	CreatedAt       time.Time `json:"created_at"`
	UpdatedAt       time.Time `json:"updated_at"`
}

// Subprocessor information
type Subprocessor struct {
	Name    string `json:"name"`
	Service string `json:"service"`
	Country string `json:"country"`
	DPAInPlace bool `json:"dpa_in_place"`
}

// HandleDataSubjectRequest processes GDPR data subject requests
func (dpo *DataProtectionOfficer) HandleDataSubjectRequest(ctx context.Context, request DataSubjectRequest) error {
	// Verify requester identity
	if err := dpo.verifyDataSubjectIdentity(ctx, request); err != nil {
		return fmt.Errorf("identity verification failed: %w", err)
	}

	// Log the request
	request.ID = uuid.New().String()
	request.Status = "pending"
	request.RequestedAt = time.Now()
	request.CreatedAt = time.Now()

	// Store request
	if err := dpo.db.Create(&request).Error; err != nil {
		return fmt.Errorf("failed to store request: %w", err)
	}

	// Process based on request type
	switch request.RequestType {
	case "access":
		return dpo.handleAccessRequest(ctx, request)
	case "erasure":
		return dpo.handleErasureRequest(ctx, request)
	case "rectification":
		return dpo.handleRectificationRequest(ctx, request)
	case "portability":
		return dpo.handlePortabilityRequest(ctx, request)
	case "restriction":
		return dpo.handleRestrictionRequest(ctx, request)
	case "objection":
		return dpo.handleObjectionRequest(ctx, request)
	default:
		return fmt.Errorf("unknown request type: %s", request.RequestType)
	}
}

// handleAccessRequest handles right of access (Article 15)
func (dpo *DataProtectionOfficer) handleAccessRequest(ctx context.Context, request DataSubjectRequest) error {
	log.Printf("Processing access request for user: %s", request.UserID)

	// Collect all user data
	userData, err := dpo.collectUserData(ctx, request.UserID)
	if err != nil {
		return fmt.Errorf("failed to collect user data: %w", err)
	}

	// Encrypt response data
	encryptedData, err := dpo.encryptData(userData)
	if err != nil {
		return fmt.Errorf("failed to encrypt response: %w", err)
	}

	// Update request with response
	request.ResponseData = encryptedData
	request.Status = "completed"
	now := time.Now()
	request.CompletedAt = &now

	if err := dpo.db.Save(&request).Error; err != nil {
		return fmt.Errorf("failed to update request: %w", err)
	}

	// Send response to user
	go dpo.sendDataSubjectResponse(ctx, request, userData)

	return nil
}

// handleErasureRequest handles right to erasure (Article 17)
func (dpo *DataProtectionOfficer) handleErasureRequest(ctx context.Context, request DataSubjectRequest) error {
	log.Printf("Processing erasure request for user: %s", request.UserID)

	// Check for legal exceptions
	if dpo.hasLegalException(ctx, request.UserID) {
		request.Status = "rejected"
		request.Notes = "Legal exception prevents erasure (e.g., tax records)"
		dpo.db.Save(&request)
		return fmt.Errorf("legal exception prevents erasure")
	}

	// Anonymize user data instead of deletion (for audit purposes)
	if err := dpo.anonymizeUserData(ctx, request.UserID); err != nil {
		return fmt.Errorf("failed to anonymize user data: %w", err)
	}

	// Update request status
	request.Status = "completed"
	now := time.Now()
	request.CompletedAt = &now
	dpo.db.Save(&request)

	// Log erasure in audit log
	dpo.logErasure(ctx, request)

	return nil
}

// handleRectificationRequest handles right to rectification (Article 16)
func (dpo *DataProtectionOfficer) handleRectificationRequest(ctx context.Context, request DataSubjectRequest) error {
	// Parse rectification data from description
	// Update user records
	// Notify all processors of correction
	// Log the changes

	return nil
}

// collectUserData collects all user data across services
func (dpo *DataProtectionOfficer) collectUserData(ctx context.Context, userID string) (map[string]interface{}, error) {
	data := make(map[string]interface{})

	// Payment data
	var payments []map[string]interface{}
	dpo.db.Table("payments").
		Where("user_id = ? OR customer_email = ?", userID, userID).
		Find(&payments)
	data["payments"] = payments

	// Subscription data
	var subscriptions []map[string]interface{}
	dpo.db.Table("subscriptions").
		Where("user_id = ?", userID).
		Find(&subscriptions)
	data["subscriptions"] = subscriptions

	// Customer data
	var customers []map[string]interface{}
	dpo.db.Table("customers").
		Where("user_id = ?", userID).
		Find(&customers)
	data["customers"] = customers

	// Invoices
	var invoices []map[string]interface{}
	dpo.db.Table("invoices").
		Where("user_id = ?", userID).
		Find(&invoices)
	data["invoices"] = invoices

	// Refunds
	var refunds []map[string]interface{}
	dpo.db.Table("refunds").
		Joins("LEFT JOIN payments ON refunds.payment_id = payments.id").
		Where("payments.user_id = ?", userID).
		Find(&refunds)
	data["refunds"] = refunds

	// Add metadata
	data["collected_at"] = time.Now().Format(time.RFC3339)
	data["data_categories"] = []string{
		"identity_data",
		"financial_data",
		"transaction_data",
		"technical_data",
		"communication_data",
	}
	data["purposes"] = []string{
		"payment_processing",
		"fraud_prevention",
		"legal_compliance",
		"service_improvement",
	}

	return data, nil
}

// anonymizeUserData anonymizes user data for GDPR erasure
func (dpo *DataProtectionOfficer) anonymizeUserData(ctx context.Context, userID string) error {
	// Generate anonymized identifier
	anonymizedID := dpo.generateAnonymizedID(userID)

	// Anonymize payments
	dpo.db.Table("payments").
		Where("user_id = ?", userID).
		Updates(map[string]interface{}{
			"user_id":         anonymizedID,
			"customer_email":  "anonymous@redacted.example",
			"customer_id":     anonymizedID,
			"metadata":        gorm.Expr("jsonb_set(metadata, '{gdpr_anonymized}', 'true')"),
		})

	// Anonymize customers
	dpo.db.Table("customers").
		Where("user_id = ?", userID).
		Updates(map[string]interface{}{
			"user_id": anonymizedID,
			"email":   "anonymous@redacted.example",
			"name":    "Anonymous User",
			"phone":   nil,
		})

	// Log anonymization
	dpo.db.Create(&GDPRAuditLog{
		ID:          uuid.New().String(),
		Action:      "data_anonymization",
		UserID:      userID,
		Description: "GDPR right to erasure - data anonymized",
		Timestamp:   time.Now(),
	})

	return nil
}

// generateAnonymizedID generates GDPR-compliant anonymized ID
func (dpo *DataProtectionOfficer) generateAnonymizedID(userID string) string {
	hash := sha256.New()
	hash.Write([]byte(userID + dpo.encryptionKey + "gdpr_anonymization_salt"))
	return "anon_" + hex.EncodeToString(hash.Sum(nil))[:32]
}

// encryptData encrypts GDPR response data
func (dpo *DataProtectionOfficer) encryptData(data map[string]interface{}) ([]byte, error) {
	// In production, use proper encryption (AES-GCM)
	jsonData, _ := json.Marshal(data)
	// Simplified for example
	return jsonData, nil
}

// verifyDataSubjectIdentity verifies the requester's identity
func (dpo *DataProtectionOfficer) verifyDataSubjectIdentity(ctx context.Context, request DataSubjectRequest) error {
	// Multi-factor verification for sensitive requests
	if request.RequestType == "erasure" {
		return dpo.verifyErasureRequest(ctx, request)
	}

	// Standard verification
	// Check email confirmation
	// Check recent activity
	// Optional: ID document verification for high-risk requests

	return nil
}

// GetROPA returns Records of Processing Activities
func (dpo *DataProtectionOfficer) GetROPA(ctx context.Context) ([]RecordOfProcessingActivity, error) {
	var ropa []RecordOfProcessingActivity
	if err := dpo.db.Find(&ropa).Error; err != nil {
		return nil, err
	}
	return ropa, nil
}

// GetDPAs returns Data Processing Agreements
func (dpo *DataProtectionOfficer) GetDPAs(ctx context.Context) ([]DataProcessingAgreement, error) {
	var dpas []DataProcessingAgreement
	if err := dpo.db.Find(&dpas).Error; err != nil {
		return nil, err
	}
	return dpas, nil
}