package handlers

import (
    "encoding/json"
    "net/http"
    "time"
    
    "gorm.io/gorm"
    
    "../models"
)

type NotificationHandler struct {
    db *gorm.DB
}

func NewNotificationHandler(db *gorm.DB) *NotificationHandler {
    return &NotificationHandler{db: db}
}

func (h *NotificationHandler) CreateNotification(w http.ResponseWriter, r *http.Request) {
    var notification models.Notification
    if err := json.NewDecoder(r.Body).Decode(&notification); err != nil {
        http.Error(w, err.Error(), http.StatusBadRequest)
        return
    }
    
    notification.ID = generateUUID()
    notification.Status = "pending"
    notification.CreatedAt = time.Now()
    notification.UpdatedAt = time.Now()
    
    if err := h.db.Create(&notification).Error; err != nil {
        http.Error(w, err.Error(), http.StatusInternalServerError)
        return
    }
    
    // TODO: Publish to RabbitMQ
    
    w.Header().Set("Content-Type", "application/json")
    json.NewEncoder(w).Encode(notification)
}

func (h *NotificationHandler) GetUserPreferences(w http.ResponseWriter, r *http.Request) {
    userID := r.URL.Query().Get("user_id")
    if userID == "" {
        http.Error(w, "user_id is required", http.StatusBadRequest)
        return
    }
    
    var prefs models.UserNotificationPreferences
    result := h.db.Where("user_id = ?", userID).First(&prefs)
    
    if result.Error == gorm.ErrRecordNotFound {
        // Return default preferences
        prefs = models.UserNotificationPreferences{
            UserID:           userID,
            EmailEnabled:     true,
            PushEnabled:      true,
            InAppEnabled:     true,
            BookingAlerts:    true,
            PaymentAlerts:    true,
            ClassReminders:   true,
            SystemAlerts:     true,
        }
    } else if result.Error != nil {
        http.Error(w, result.Error.Error(), http.StatusInternalServerError)
        return
    }
    
    w.Header().Set("Content-Type", "application/json")
    json.NewEncoder(w).Encode(prefs)
}

func (h *NotificationHandler) UpdatePreferences(w http.ResponseWriter, r *http.Request) {
    var prefs models.UserNotificationPreferences
    if err := json.NewDecoder(r.Body).Decode(&prefs); err != nil {
        http.Error(w, err.Error(), http.StatusBadRequest)
        return
    }
    
    prefs.UpdatedAt = time.Now()
    
    result := h.db.Save(&prefs)
    if result.Error != nil {
        http.Error(w, result.Error.Error(), http.StatusInternalServerError)
        return
    }
    
    w.Header().Set("Content-Type", "application/json")
    json.NewEncoder(w).Encode(prefs)
}

func (h *NotificationHandler) GetTemplates(w http.ResponseWriter, r *http.Request) {
    var templates []models.NotificationTemplate
    result := h.db.Where("is_active = ?", true).Find(&templates)
    
    if result.Error != nil {
        http.Error(w, result.Error.Error(), http.StatusInternalServerError)
        return
    }
    
    w.Header().Set("Content-Type", "application/json")
    json.NewEncoder(w).Encode(templates)
}

func generateUUID() string {
    // Implement UUID generation
    return "uuid-" + time.Now().Format("20060102150405")
}