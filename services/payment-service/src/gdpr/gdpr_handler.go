package handlers

import (
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"

	"payment-service/gdpr"
)

// GDPRHandler handles GDPR-related HTTP requests
type GDPRHandler struct {
	dpoService     *gdpr.DataProtectionOfficer
	consentManager *gdpr.ConsentManager
	privacyDesign  *gdpr.DataProtectionByDesign
	breachManager  *gdpr.BreachNotificationManager
}

// NewGDPRHandler creates a new GDPR handler
func NewGDPRHandler(
	dpoService *gdpr.DataProtectionOfficer,
	consentManager *gdpr.ConsentManager,
	privacyDesign *gdpr.DataProtectionByDesign,
	breachManager *gdpr.BreachNotificationManager,
) *GDPRHandler {
	return &GDPRHandler{
		dpoService:     dpoService,
		consentManager: consentManager,
		privacyDesign:  privacyDesign,
		breachManager:  breachManager,
	}
}

// HandleDataSubjectRequest handles GDPR data subject requests
func (h *GDPRHandler) HandleDataSubjectRequest(c *gin.Context) {
	var request struct {
		RequestType   string                 `json:"request_type" binding:"required"`
		UserEmail     string                 `json:"user_email" binding:"required,email"`
		UserID        string                 `json:"user_id,omitempty"`
		Description   string                 `json:"description"`
		Verification  map[string]interface{} `json:"verification,omitempty"`
	}

	if err := c.ShouldBindJSON(&request); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Create data subject request
	dsr := gdpr.DataSubjectRequest{
		ID:            uuid.New().String(),
		RequestType:   request.RequestType,
		UserEmail:     request.UserEmail,
		UserID:        request.UserID,
		Description:   request.Description,
		Status:        "pending",
		Priority:      "medium",
		RequestedAt:   time.Now(),
		CreatedAt:     time.Now(),
	}

	// Process request
	if err := h.dpoService.HandleDataSubjectRequest(c.Request.Context(), dsr); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error":   "Failed to process request",
			"details": err.Error(),
		})
		return
	}

	c.JSON(http.StatusAccepted, gin.H{
		"request_id":     dsr.ID,
		"request_type":   dsr.RequestType,
		"status":         dsr.Status,
		"estimated_completion": time.Now().Add(30 * 24 * time.Hour).Format(time.RFC3339), // 30 days max by GDPR
		"message":        "Your request has been received and will be processed within 30 days",
	})
}

// GetConsentPreferences gets user consent preferences
func (h *GDPRHandler) GetConsentPreferences(c *gin.Context) {
	userID := c.Param("user_id")
	
	consents, err := h.consentManager.GetUserConsents(c.Request.Context(), userID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	
	c.JSON(http.StatusOK, gin.H{
		"user_id":  userID,
		"consents": consents,
		"timestamp": time.Now().Format(time.RFC3339),
	})
}

// UpdateConsent updates user consent
func (h *GDPRHandler) UpdateConsent(c *gin.Context) {
	var request struct {
		UserID      string                 `json:"user_id" binding:"required"`
		UserEmail   string                 `json:"user_email" binding:"required,email"`
		ConsentType string                 `json:"consent_type" binding:"required"`
		Grant       bool                   `json:"grant"`
		Preferences map[string]interface{} `json:"preferences,omitempty"`
	}

	if err := c.ShouldBindJSON(&request); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if request.Grant {
		consent, err := h.consentManager.GrantConsent(c.Request.Context(), 
			request.UserID, request.UserEmail, request.ConsentType, request.Preferences)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusOK, consent)
	} else {
		err := h.consentManager.RevokeConsent(c.Request.Context(), request.UserID, request.ConsentType)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusOK, gin.H{
			"message": "Consent revoked successfully",
			"consent_type": request.ConsentType,
			"user_id": request.UserID,
		})
	}
}

// GetPrivacyPolicy returns privacy policy
func (h *GDPRHandler) GetPrivacyPolicy(c *gin.Context) {
	policy := gin.H{
		"version": "2.1",
		"effective_date": "2024-01-01",
		"last_updated": time.Now().Format("2006-01-02"),
		"sections": []gin.H{
			{
				"title": "Data Controller",
				"content": "Yoga Spa Platform is the data controller for your personal data.",
			},
			{
				"title": "Data Protection Officer",
				"content": "Our Data Protection Officer can be contacted at dpo@yogaspa.com",
			},
			{
				"title": "Personal Data We Collect",
				"content": "We collect: Identity data, Contact data, Financial data, Transaction data, Technical data, Profile data, Usage data, Marketing data",
			},
			{
				"title": "How We Use Your Data",
				"content": "Payment processing, Account management, Customer support, Fraud prevention, Marketing (with consent), Legal compliance",
			},
			{
				"title": "Lawful Basis for Processing",
				"content": "Contract performance, Legal obligation, Legitimate interests, Consent",
			},
			{
				"title": "Data Sharing",
				"content": "Payment processors (Stripe, PayPal, RazorPay), Cloud providers (AWS), Customer support tools, Analytics providers (with consent)",
			},
			{
				"title": "International Transfers",
				"content": "We use Standard Contractual Clauses for data transfers outside the EEA",
			},
			{
				"title": "Data Retention",
				"content": "Payment records: 7 years for tax purposes, Customer data: Until account deletion, Marketing data: Until consent withdrawal",
			},
			{
				"title": "Your Rights",
				"content": "Right to access, rectification, erasure, restriction, portability, objection, and withdrawal of consent",
			},
			{
				"title": "Contact Information",
				"content": "For GDPR requests: gdpr@yogaspa.com",
			},
		},
		"compliant_with": []string{
			"GDPR (EU) 2016/679",
			"UK GDPR",
			"CCPA (California)",
			"LGPD (Brazil)",
			"PIPEDA (Canada)",
		},
	}
	
	c.JSON(http.StatusOK, policy)
}

// GetROPA returns Records of Processing Activities
func (h *GDPRHandler) GetROPA(c *gin.Context) {
	ropa, err := h.dpoService.GetROPA(c.Request.Context())
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	
	c.JSON(http.StatusOK, gin.H{
		"ropa": ropa,
		"generated_at": time.Now().Format(time.RFC3339),
	})
}

// ReportDataBreach reports a data breach (internal API)
func (h *GDPRHandler) ReportDataBreach(c *gin.Context) {
	// This endpoint should be protected with proper authentication
	
	var breach gdpr.DataBreach
	if err := c.ShouldBindJSON(&breach); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	
	if err := h.breachManager.DetectBreach(c.Request.Context(), breach); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	
	c.JSON(http.StatusAccepted, gin.H{
		"breach_id": breach.ID,
		"message": "Breach reported and response initiated",
		"notification_deadline": time.Now().Add(72 * time.Hour).Format(time.RFC3339),
	})
}

// RunDataCleanup runs GDPR data cleanup
func (h *GDPRHandler) RunDataCleanup(c *gin.Context) {
	// Protected endpoint - requires admin authentication
	
	if err := h.privacyDesign.CleanExpiredData(c.Request.Context()); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	
	c.JSON(http.StatusOK, gin.H{
		"status": "cleanup_completed",
		"timestamp": time.Now().Format(time.RFC3339),
	})
}