package services

import (
    "context"
    "fmt"
    "log"
    "time"
    
    "github.com/sendgrid/sendgrid-go"
    "github.com/sendgrid/sendgrid-go/helpers/mail"
    "github.com/twilio/twilio-go"
    api "github.com/twilio/twilio-go/rest/api/v2010"
    "gorm.io/gorm"
    
    "../models"
    "../config"
)

type NotificationSender struct {
    db          *gorm.DB
    sgClient    *sendgrid.Client
    twilioClient *twilio.RestClient
}

func NewNotificationSender(db *gorm.DB) *NotificationSender {
    sender := &NotificationSender{
        db: db,
    }
    
    // Initialize SendGrid
    if config.AppConfig.SendGridAPIKey != "" {
        sender.sgClient = sendgrid.NewSendClient(config.AppConfig.SendGridAPIKey)
    }
    
    // Initialize Twilio
    if config.AppConfig.TwilioAccountSID != "" && config.AppConfig.TwilioAuthToken != "" {
        sender.twilioClient = twilio.NewRestClientWithParams(twilio.ClientParams{
            Username: config.AppConfig.TwilioAccountSID,
            Password: config.AppConfig.TwilioAuthToken,
        })
    }
    
    return sender
}

func (s *NotificationSender) ProcessNotification(notification *models.Notification) error {
    // Check user preferences
    userPrefs, err := s.getUserNotificationPreferences(notification.UserID)
    if err != nil {
        return err
    }
    
    // Check DND (Do Not Disturb) period
    if s.isInDNDPeriod(userPrefs) {
        notification.Status = "scheduled"
        notification.SentAt = nil
        s.db.Save(notification)
        return fmt.Errorf("in DND period, scheduled for later")
    }
    
    // Send based on channel
    switch notification.Channel {
    case "email":
        return s.sendEmail(notification, userPrefs)
    case "sms":
        return s.sendSMS(notification, userPrefs)
    case "push":
        return s.sendPush(notification, userPrefs)
    case "whatsapp":
        return s.sendWhatsApp(notification, userPrefs)
    case "in_app":
        return s.sendInApp(notification, userPrefs)
    default:
        return fmt.Errorf("unsupported channel: %s", notification.Channel)
    }
}

func (s *NotificationSender) sendEmail(notification *models.Notification, prefs *models.UserNotificationPreferences) error {
    if !prefs.EmailEnabled {
        return fmt.Errorf("email notifications disabled by user")
    }
    
    // Get template
    template, err := s.getTemplate(notification.Template)
    if err != nil {
        return err
    }
    
    // Render template with data
    content := s.renderTemplate(template.Body, notification.Data)
    htmlContent := s.renderTemplate(template.HTMLBody, notification.Data)
    
    from := mail.NewEmail(config.AppConfig.EmailFromName, config.AppConfig.EmailFromAddress)
    to := mail.NewEmail("", notification.Email)
    subject := s.renderTemplate(template.Subject, notification.Data)
    
    message := mail.NewSingleEmail(from, subject, to, content, htmlContent)
    
    response, err := s.sgClient.Send(message)
    if err != nil {
        return err
    }
    
    if response.StatusCode >= 200 && response.StatusCode < 300 {
        notification.Status = "sent"
        notification.SentAt = &time.Time{}
        *notification.SentAt = time.Now()
        s.db.Save(notification)
        
        // Track delivery
        go s.trackDelivery(notification, "email", response.Body)
    } else {
        notification.Status = "failed"
        notification.Error = fmt.Sprintf("SendGrid error: %d", response.StatusCode)
        s.db.Save(notification)
    }
    
    return nil
}

func (s *NotificationSender) sendSMS(notification *models.Notification, prefs *models.UserNotificationPreferences) error {
    if !prefs.SMSEnabled {
        return fmt.Errorf("SMS notifications disabled by user")
    }
    
    template, err := s.getTemplate(notification.Template)
    if err != nil {
        return err
    }
    
    message := s.renderTemplate(template.SMSBody, notification.Data)
    
    params := &api.CreateMessageParams{}
    params.SetTo(notification.Phone)
    params.SetFrom(config.AppConfig.TwilioPhoneNumber)
    params.SetBody(message)
    
    resp, err := s.twilioClient.Api.CreateMessage(params)
    if err != nil {
        notification.Status = "failed"
        notification.Error = err.Error()
        s.db.Save(notification)
        return err
    }
    
    notification.Status = "sent"
    notification.SentAt = &time.Time{}
    *notification.SentAt = time.Now()
    notification.ExternalID = *resp.Sid
    s.db.Save(notification)
    
    return nil
}

func (s *NotificationSender) sendPush(notification *models.Notification, prefs *models.UserNotificationPreferences) error {
    // Implementation for Firebase Cloud Messaging
    // Would require FCM setup
    return fmt.Errorf("push notifications not implemented yet")
}

func (s *NotificationSender) getUserNotificationPreferences(userID string) (*models.UserNotificationPreferences, error) {
    var prefs models.UserNotificationPreferences
    result := s.db.Where("user_id = ?", userID).First(&prefs)
    if result.Error != nil {
        // Return default preferences if not found
        return &models.UserNotificationPreferences{
            UserID:        userID,
            EmailEnabled:  true,
            SMSEnabled:    false,
            PushEnabled:   true,
            WhatsAppEnabled: false,
            InAppEnabled:  true,
            DNDStart:      "22:00",
            DNDEnd:        "08:00",
        }, nil
    }
    return &prefs, nil
}

func (s *NotificationSender) getTemplate(templateName string) (*models.NotificationTemplate, error) {
    var template models.NotificationTemplate
    result := s.db.Where("name = ? AND is_active = ?", templateName, true).First(&template)
    if result.Error != nil {
        return nil, result.Error
    }
    return &template, nil
}

func (s *NotificationSender) renderTemplate(template string, data map[string]interface{}) string {
    // Simple template rendering
    // In production, use a proper templating engine
    result := template
    for key, value := range data {
        placeholder := fmt.Sprintf("{{%s}}", key)
        result = fmt.Sprintf(result, placeholder, value)
    }
    return result
}

func (s *NotificationSender) isInDNDPeriod(prefs *models.UserNotificationPreferences) bool {
    if prefs.DNDStart == "" || prefs.DNDEnd == "" {
        return false
    }
    
    now := time.Now()
    currentTime := now.Format("15:04")
    
    // Simple DND check (24-hour format)
    return currentTime >= prefs.DNDStart && currentTime <= prefs.DNDEnd
}