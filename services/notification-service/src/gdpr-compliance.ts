package services

import (
    "context"
    "encoding/json"
    "fmt"
    "log"
    "time"
    
    "gorm.io/gorm"
    
    "../models"
)

type GDPRComplianceService struct {
    db *gorm.DB
}

func NewGDPRComplianceService(db *gorm.DB) *GDPRComplianceService {
    return &GDPRComplianceService{db: db}
}

// Check if notification is GDPR compliant
func (s *GDPRComplianceService) ValidateGDPRCompliance(notification *models.Notification) (bool, []string) {
    violations := []string{}
    
    // 1. Check if user has opted in for this notification type
    if !s.hasUserConsent(notification.UserID, notification.Type, notification.Channel) {
        violations = append(violations, 
            fmt.Sprintf("User %s has not consented to %s notifications via %s", 
                notification.UserID, notification.Type, notification.Channel))
    }
    
    // 2. Check DNT (Do Not Track) flag
    if s.hasDNTEnabled(notification.UserID) {
        violations = append(violations, 
            fmt.Sprintf("User %s has DNT (Do Not Track) enabled", notification.UserID))
    }
    
    // 3. Check if in DND period
    if s.isInDNDPeriod(notification.UserID) {
        violations = append(violations, 
            fmt.Sprintf("User %s is in Do Not Disturb period", notification.UserID))
    }
    
    // 4. Check data minimization
    if !s.isDataMinimized(notification.Data) {
        violations = append(violations, "Notification contains excessive personal data")
    }
    
    // 5. Check retention policy
    if !s.compliesWithRetentionPolicy(notification.Type) {
        violations = append(violations, 
            fmt.Sprintf("Notification type %s doesn't comply with retention policy", notification.Type))
    }
    
    return len(violations) == 0, violations
}

// Get user consent
func (s *GDPRComplianceService) GetUserConsent(userID string) (*models.GDPRConsent, error) {
    var consent models.GDPRConsent
    result := s.db.Where("user_id = ?", userID).First(&consent)
    
    if result.Error == gorm.ErrRecordNotFound {
        // Return default consent (all false)
        return &models.GDPRConsent{
            UserID:           userID,
            MarketingEmail:   false,
            MarketingSMS:     false,
            Transactional:    true, // Transactional emails are allowed by default
            Analytics:        false,
            ThirdPartySharing: false,
            ConsentDate:      time.Now(),
            Version:          "1.0",
        }, nil
    }
    
    return &consent, result.Error
}

// Update user consent
func (s *GDPRComplianceService) UpdateConsent(userID string, updates map[string]bool) error {
    consent, err := s.GetUserConsent(userID)
    if err != nil {
        return err
    }
    
    // Update consent fields
    if marketingEmail, ok := updates["marketing_email"]; ok {
        consent.MarketingEmail = marketingEmail
    }
    if marketingSMS, ok := updates["marketing_sms"]; ok {
        consent.MarketingSMS = marketingSMS
    }
    if analytics, ok := updates["analytics"]; ok {
        consent.Analytics = analytics
    }
    if thirdParty, ok := updates["third_party_sharing"]; ok {
        consent.ThirdPartySharing = thirdParty
    }
    
    consent.ConsentDate = time.Now()
    consent.Version = "1.0"
    
    return s.db.Save(consent).Error
}

// Right to be forgotten - Delete all user data
func (s *GDPRComplianceService) DeleteUserData(userID string) error {
    // Start transaction
    tx := s.db.Begin()
    
    // Anonymize notifications
    if err := tx.Model(&models.Notification{}).
        Where("user_id = ?", userID).
        Updates(map[string]interface{}{
            "user_id": "deleted_user",
            "email":   "deleted@example.com",
            "phone":   "0000000000",
            "data":    json.RawMessage(`{"anonymized": true}`),
        }).Error; err != nil {
        tx.Rollback()
        return err
    }
    
    // Delete preferences
    if err := tx.Where("user_id = ?", userID).
        Delete(&models.UserNotificationPreferences{}).Error; err != nil {
        tx.Rollback()
        return err
    }
    
    // Delete consent record
    if err := tx.Where("user_id = ?", userID).
        Delete(&models.GDPRConsent{}).Error; err != nil {
        tx.Rollback()
        return err
    }
    
    // Log deletion for audit trail
    auditLog := models.GDPRAuditLog{
        UserID:     userID,
        Action:     "data_deletion",
        Timestamp:  time.Now(),
        IPAddress:  "system",
        UserAgent:  "gdpr_service",
        Details:    "User exercised right to be forgotten",
    }
    
    if err := tx.Create(&auditLog).Error; err != nil {
        tx.Rollback()
        return err
    }
    
    return tx.Commit().Error
}

// Right to access - Export all user data
func (s *GDPRComplianceService) ExportUserData(userID string) (map[string]interface{}, error) {
    data := make(map[string]interface{})
    
    // Get notifications
    var notifications []models.Notification
    if err := s.db.Where("user_id = ?", userID).Find(&notifications).Error; err != nil {
        return nil, err
    }
    data["notifications"] = notifications
    
    // Get preferences
    var preferences models.UserNotificationPreferences
    s.db.Where("user_id = ?", userID).First(&preferences)
    data["preferences"] = preferences
    
    // Get consent
    var consent models.GDPRConsent
    s.db.Where("user_id = ?", userID).First(&consent)
    data["consent"] = consent
    
    // Get audit logs
    var auditLogs []models.GDPRAuditLog
    s.db.Where("user_id = ?", userID).Find(&auditLogs)
    data["audit_logs"] = auditLogs
    
    return data, nil
}

// Log GDPR events for audit trail
func (s *GDPRComplianceService) LogGDPREvent(userID, action, ipAddress, userAgent, details string) error {
    log := models.GDPRAuditLog{
        UserID:     userID,
        Action:     action,
        Timestamp:  time.Now(),
        IPAddress:  ipAddress,
        UserAgent:  userAgent,
        Details:    details,
    }
    
    return s.db.Create(&log).Error
}

// Helper methods
func (s *GDPRComplianceService) hasUserConsent(userID, notificationType, channel string) bool {
    consent, err := s.GetUserConsent(userID)
    if err != nil {
        log.Printf("Error getting consent for user %s: %v", userID, err)
        return false
    }
    
    // Transactional notifications are always allowed
    if notificationType == "transactional" {
        return true
    }
    
    // Marketing notifications require explicit consent
    if notificationType == "marketing" {
        switch channel {
        case "email":
            return consent.MarketingEmail
        case "sms":
            return consent.MarketingSMS
        default:
            return false
        }
    }
    
    return true
}

func (s *GDPRComplianceService) hasDNTEnabled(userID string) bool {
    var preferences models.UserNotificationPreferences
    result := s.db.Where("user_id = ?", userID).First(&preferences)
    if result.Error != nil {
        return false
    }
    return preferences.DNTEnabled
}

func (s *GDPRComplianceService) isInDNDPeriod(userID string) bool {
    var preferences models.UserNotificationPreferences
    result := s.db.Where("user_id = ?", userID).First(&preferences)
    if result.Error != nil || !preferences.DNDEnabled {
        return false
    }
    
    now := time.Now()
    currentTime := now.Format("15:04")
    
    return currentTime >= preferences.DNDStart && currentTime <= preferences.DNDEnd
}

func (s *GDPRComplianceService) isDataMinimized(data map[string]interface{}) bool {
    // Check if data contains unnecessary personal information
    sensitiveFields := []string{"ssn", "credit_card", "password", "full_address"}
    
    for _, field := range sensitiveFields {
        if _, exists := data[field]; exists {
            return false
        }
    }
    
    return true
}

func (s *GDPRComplianceService) compliesWithRetentionPolicy(notificationType string) bool {
    retentionPolicies := map[string]time.Duration{
        "transactional":  3 * 365 * 24 * time.Hour, // 3 years
        "marketing":      1 * 365 * 24 * time.Hour, // 1 year
        "security":       5 * 365 * 24 * time.Hour, // 5 years
        "analytics":      2 * 365 * 24 * time.Hour, // 2 years
    }
    
    _, exists := retentionPolicies[notificationType]
    return exists
}