package gdpr

import (
	"context"
	"fmt"
	"log"
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

// BreachNotificationManager manages GDPR breach notifications
type BreachNotificationManager struct {
	db                *gorm.DB
	supervisoryAuthorityEmail string
	notificationEmail string
}

// DataBreach represents a GDPR personal data breach
type DataBreach struct {
	ID                     string    `json:"id" gorm:"primaryKey"`
	BreachType             string    `json:"breach_type"` // confidentiality, integrity, availability
	DetectionDate          time.Time `json:"detection_date"`
	BreachDate             time.Time `json:"breach_date"`
	Description            string    `json:"description"`
	Cause                  string    `json:"cause"`
	DataCategories         []string  `json:"data_categories" gorm:"type:jsonb"`
	AffectedIndividuals    int       `json:"affected_individuals"`
	RiskLevel              string    `json:"risk_level"` // low, medium, high
	Likelihood             string    `json:"likelihood"` // unlikely, possible, likely
	Severity               string    `json:"severity"` // minor, moderate, major
	MitigationActions      []string  `json:"mitigation_actions" gorm:"type:jsonb"`
	ReportedToSA           bool      `json:"reported_to_sa"`
	SARefNumber            string    `json:"sa_ref_number"`
	ReportedToIndividuals  bool      `json:"reported_to_individuals"`
	NotificationDate       *time.Time `json:"notification_date"`
	Status                 string    `json:"status"` // detected, assessing, notifying, resolved
	CreatedAt              time.Time `json:"created_at"`
	UpdatedAt              time.Time `json:"updated_at"`
}

// NewBreachNotificationManager creates new breach notification manager
func NewBreachNotificationManager(db *gorm.DB) *BreachNotificationManager {
	return &BreachNotificationManager{
		db: db,
		supervisoryAuthorityEmail: os.Getenv("SUPERVISORY_AUTHORITY_EMAIL"),
		notificationEmail: os.Getenv("BREACH_NOTIFICATION_EMAIL"),
	}
}

// DetectBreach detects and records a data breach
func (bnm *BreachNotificationManager) DetectBreach(ctx context.Context, breach DataBreach) error {
	// Calculate risk assessment
	breach.RiskLevel = bnm.assessRiskLevel(breach)
	
	// Store breach record
	breach.ID = uuid.New().String()
	breach.Status = "detected"
	breach.CreatedAt = time.Now()
	breach.UpdatedAt = time.Now()
	
	if err := bnm.db.Create(&breach).Error; err != nil {
		return fmt.Errorf("failed to record breach: %w", err)
	}
	
	// Log breach detection
	bnm.logBreachDetection(ctx, breach)
	
	// Start breach response process
	go bnm.handleBreachResponse(ctx, breach)
	
	return nil
}

// handleBreachResponse handles GDPR breach response process
func (bnm *BreachNotificationManager) handleBreachResponse(ctx context.Context, breach DataBreach) {
	log.Printf("Handling data breach: %s", breach.ID)
	
	// 1. Contain the breach
	bnm.containBreach(ctx, breach)
	
	// 2. Assess the breach
	assessment := bnm.assessBreach(ctx, breach)
	
	// 3. Notify if required (within 72 hours)
	if assessment.NotificationRequired {
		bnm.notifySupervisoryAuthority(ctx, breach, assessment)
		
		if assessment.NotifyIndividuals {
			bnm.notifyAffectedIndividuals(ctx, breach, assessment)
		}
	}
	
	// 4. Document everything
	bnm.documentBreachResponse(ctx, breach, assessment)
}

// assessBreach assesses breach for notification requirements
func (bnm *BreachNotificationManager) assessBreach(ctx context.Context, breach DataBreach) *BreachAssessment {
	assessment := &BreachAssessment{
		BreachID: breach.ID,
	}
	
	// GDPR Article 33: Notify supervisory authority within 72 hours
	// unless breach is unlikely to result in risk to rights and freedoms
	
	// Check if notification is required
	assessment.NotificationRequired = bnm.isNotificationRequired(breach)
	
	if assessment.NotificationRequired {
		// Check if individuals need to be notified (Article 34)
		assessment.NotifyIndividuals = bnm.shouldNotifyIndividuals(breach)
		assessment.NotificationDeadline = time.Now().Add(72 * time.Hour)
	}
	
	return assessment
}

// notifySupervisoryAuthority notifies supervisory authority
func (bnm *BreachNotificationManager) notifySupervisoryAuthority(ctx context.Context, breach DataBreach, assessment *BreachAssessment) {
	notification := SANotification{
		BreachID:           breach.ID,
		OrganizationName:   os.Getenv("ORGANIZATION_NAME"),
		DPOName:           os.Getenv("DPO_NAME"),
		DPOEmail:          os.Getenv("DPO_EMAIL"),
		DetectionDate:      breach.DetectionDate,
		BreachDate:        breach.BreachDate,
		Description:       breach.Description,
		DataCategories:    breach.DataCategories,
		AffectedIndividuals: breach.AffectedIndividuals,
		RiskLevel:         breach.RiskLevel,
		MitigationActions: breach.MitigationActions,
		ContactPerson:     os.Getenv("BREACH_CONTACT_PERSON"),
		ContactPhone:      os.Getenv("BREACH_CONTACT_PHONE"),
		ContactEmail:      bnm.notificationEmail,
	}
	
	// Send notification email
	if err := bnm.sendSANotification(notification); err != nil {
		log.Printf("Failed to send SA notification: %v", err)
	}
	
	// Update breach record
	breach.ReportedToSA = true
	breach.SARefNumber = fmt.Sprintf("SA-%s-%d", time.Now().Format("20060102"), time.Now().Unix())
	breach.Status = "notifying"
	bnm.db.Save(&breach)
}

// notifyAffectedIndividuals notifies affected individuals
func (bnm *BreachNotificationManager) notifyAffectedIndividuals(ctx context.Context, breach DataBreach, assessment *BreachAssessment) {
	// Get affected individuals
	individuals := bnm.getAffectedIndividuals(ctx, breach)
	
	for _, individual := range individuals {
		notification := IndividualNotification{
			BreachID:        breach.ID,
			RecipientEmail:  individual.Email,
			RecipientName:   individual.Name,
			BreachType:      breach.BreachType,
			BreachDate:      breach.BreachDate,
			DataInvolved:    bnm.getIndividualDataInvolved(individual, breach),
			RiskLevel:       breach.RiskLevel,
			MitigationActions: breach.MitigationActions,
			RecommendedActions: bnm.getRecommendedActions(breach),
			ContactPoint:    bnm.notificationEmail,
			DPOContact:      os.Getenv("DPO_EMAIL"),
		}
		
		// Send individual notification
		bnm.sendIndividualNotification(notification)
	}
	
	// Update breach record
	now := time.Now()
	breach.ReportedToIndividuals = true
	breach.NotificationDate = &now
	bnm.db.Save(&breach)
}

// BreachAssessment represents breach assessment
type BreachAssessment struct {
	BreachID             string    `json:"breach_id"`
	NotificationRequired bool      `json:"notification_required"`
	NotifyIndividuals    bool      `json:"notify_individuals"`
	NotificationDeadline time.Time `json:"notification_deadline"`
	RiskToRights         bool      `json:"risk_to_rights"`
	AssessmentDate       time.Time `json:"assessment_date"`
}

// SANotification represents supervisory authority notification
type SANotification struct {
	BreachID            string    `json:"breach_id"`
	OrganizationName    string    `json:"organization_name"`
	DPOName             string    `json:"dpo_name"`
	DPOEmail            string    `json:"dpo_email"`
	DetectionDate       time.Time `json:"detection_date"`
	BreachDate          time.Time `json:"breach_date"`
	Description         string    `json:"description"`
	DataCategories      []string  `json:"data_categories"`
	AffectedIndividuals int       `json:"affected_individuals"`
	RiskLevel           string    `json:"risk_level"`
	MitigationActions   []string  `json:"mitigation_actions"`
	ContactPerson       string    `json:"contact_person"`
	ContactPhone        string    `json:"contact_phone"`
	ContactEmail        string    `json:"contact_email"`
}

// IndividualNotification represents individual breach notification
type IndividualNotification struct {
	BreachID           string    `json:"breach_id"`
	RecipientEmail     string    `json:"recipient_email"`
	RecipientName      string    `json:"recipient_name"`
	BreachType         string    `json:"breach_type"`
	BreachDate         time.Time `json:"breach_date"`
	DataInvolved       []string  `json:"data_involved"`
	RiskLevel          string    `json:"risk_level"`
	MitigationActions  []string  `json:"mitigation_actions"`
	RecommendedActions []string  `json:"recommended_actions"`
	ContactPoint       string    `json:"contact_point"`
	DPOContact         string    `json:"dpo_contact"`
}