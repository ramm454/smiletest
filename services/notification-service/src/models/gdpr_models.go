package models

import "time"

type GDPRConsent struct {
    ID                 string    `json:"id" gorm:"primaryKey"`
    UserID             string    `json:"user_id" gorm:"uniqueIndex"`
    
    // Consent categories
    MarketingEmail     bool      `json:"marketing_email" gorm:"default:false"`
    MarketingSMS       bool      `json:"marketing_sms" gorm:"default:false"`
    MarketingPush      bool      `json:"marketing_push" gorm:"default:false"`
    Transactional      bool      `json:"transactional" gorm:"default:true"`
    Analytics          bool      `json:"analytics" gorm:"default:false"`
    ThirdPartySharing  bool      `json:"third_party_sharing" gorm:"default:false"`
    
    // Metadata
    ConsentDate        time.Time `json:"consent_date"`
    ConsentMethod      string    `json:"consent_method"` // "registration", "settings", "popup"
    Version            string    `json:"version"`
    Language           string    `json:"language" gorm:"default:'en'"`
    
    // Legal basis
    LegalBasis         string    `json:"legal_basis"` // "consent", "contract", "legitimate_interest"
    
    // Timestamps
    CreatedAt          time.Time `json:"created_at"`
    UpdatedAt          time.Time `json:"updated_at"`
    
    // Relations
    AuditLogs          []GDPRAuditLog `json:"audit_logs" gorm:"foreignKey:UserID;references:UserID"`
}

type GDPRAuditLog struct {
    ID          string    `json:"id" gorm:"primaryKey"`
    UserID      string    `json:"user_id" gorm:"index"`
    Action      string    `json:"action"` // "consent_update", "data_access", "data_deletion", "data_portability"
    Timestamp   time.Time `json:"timestamp"`
    IPAddress   string    `json:"ip_address"`
    UserAgent   string    `json:"user_agent"`
    Details     string    `json:"details"`
    RequestID   string    `json:"request_id"` // For tracking specific requests
    
    // Data processing details
    DataController string `json:"data_controller" gorm:"default:'Yoga Spa Platform'"`
    DataProcessor  string `json:"data_processor"`
    Purpose        string `json:"purpose"`
    
    CreatedAt   time.Time `json:"created_at"`
}

type DataProcessingAgreement struct {
    ID           string    `json:"id" gorm:"primaryKey"`
    UserID       string    `json:"user_id" gorm:"uniqueIndex"`
    
    // Agreement details
    Version      string    `json:"version"`
    ContentHash  string    `json:"content_hash"` // Hash of agreement content
    AcceptedAt   time.Time `json:"accepted_at"`
    IPAddress    string    `json:"ip_address"`
    
    // User acknowledgement
    PrivacyPolicy     bool `json:"privacy_policy"`
    TermsOfService    bool `json:"terms_of_service"`
    CookiePolicy      bool `json:"cookie_policy"`
    
    CreatedAt    time.Time `json:"created_at"`
    UpdatedAt    time.Time `json:"updated_at"`
}

type DataRetentionPolicy struct {
    ID               string        `json:"id" gorm:"primaryKey"`
    DataCategory     string        `json:"data_category" gorm:"uniqueIndex"`
    RetentionPeriod  time.Duration `json:"retention_period"` // In hours
    LegalBasis       string        `json:"legal_basis"`
    Description      string        `json:"description"`
    
    // Deletion process
    AutoDelete       bool          `json:"auto_delete" gorm:"default:true"`
    AnonymizeFirst   bool          `json:"anonymize_first" gorm:"default:true"`
    NotificationDays int           `json:"notification_days" gorm:"default:30"`
    
    CreatedAt        time.Time     `json:"created_at"`
    UpdatedAt        time.Time     `json:"updated_at"`
}

// Update UserNotificationPreferences with DNT
type UserNotificationPreferences struct {
    // ... existing fields
    
    DNTEnabled        bool      `json:"dnt_enabled" gorm:"default:false"` // Do Not Track
    GDPRConsentID     string    `json:"gdpr_consent_id"`
    GDPRConsent       GDPRConsent `json:"gdpr_consent" gorm:"foreignKey:GDPRConsentID"`
    
    // ... other fields
}