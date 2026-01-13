package models

import "time"

type UserNotificationPreferences struct {
    ID                string    `json:"id" gorm:"primaryKey"`
    UserID            string    `json:"user_id" gorm:"uniqueIndex"`
    
    // Channel preferences
    EmailEnabled      bool      `json:"email_enabled" gorm:"default:true"`
    SMSEnabled        bool      `json:"sms_enabled" gorm:"default:false"`
    PushEnabled       bool      `json:"push_enabled" gorm:"default:true"`
    WhatsAppEnabled   bool      `json:"whatsapp_enabled" gorm:"default:false"`
    InAppEnabled      bool      `json:"in_app_enabled" gorm:"default:true"`
    
    // Do Not Disturb
    DNDEnabled        bool      `json:"dnd_enabled" gorm:"default:false"`
    DNDStart          string    `json:"dnd_start"` // Format: "22:00"
    DNDEnd            string    `json:"dnd_end"`   // Format: "08:00"
    
    // Category preferences
    BookingAlerts     bool      `json:"booking_alerts" gorm:"default:true"`
    PaymentAlerts     bool      `json:"payment_alerts" gorm:"default:true"`
    ClassReminders    bool      `json:"class_reminders" gorm:"default:true"`
    Promotional       bool      `json:"promotional" gorm:"default:true"`
    SystemAlerts      bool      `json:"system_alerts" gorm:"default:true"`
    
    // Timestamps
    CreatedAt         time.Time `json:"created_at"`
    UpdatedAt         time.Time `json:"updated_at"`
}