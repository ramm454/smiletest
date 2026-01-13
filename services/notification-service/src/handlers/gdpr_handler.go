package handlers

import (
    "encoding/json"
    "net/http"
    "time"
    
    "github.com/gorilla/mux"
    "gorm.io/gorm"
    
    "../services"
)

type GDPRHandler struct {
    gdprService *services.GDPRComplianceService
    db          *gorm.DB
}

func NewGDPRHandler(db *gorm.DB) *GDPRHandler {
    return &GDPRHandler{
        gdprService: services.NewGDPRComplianceService(db),
        db:          db,
    }
}

// Get user consent
func (h *GDPRHandler) GetConsent(w http.ResponseWriter, r *http.Request) {
    userID := r.URL.Query().Get("user_id")
    if userID == "" {
        http.Error(w, "user_id is required", http.StatusBadRequest)
        return
    }
    
    consent, err := h.gdprService.GetUserConsent(userID)
    if err != nil {
        http.Error(w, err.Error(), http.StatusInternalServerError)
        return
    }
    
    // Log access
    h.gdprService.LogGDPREvent(
        userID,
        "consent_access",
        r.RemoteAddr,
        r.UserAgent(),
        "User accessed consent settings",
    )
    
    w.Header().Set("Content-Type", "application/json")
    json.NewEncoder(w).Encode(consent)
}

// Update consent
func (h *GDPRHandler) UpdateConsent(w http.ResponseWriter, r *http.Request) {
    var request struct {
        UserID  string            `json:"user_id"`
        Updates map[string]bool   `json:"updates"`
    }
    
    if err := json.NewDecoder(r.Body).Decode(&request); err != nil {
        http.Error(w, err.Error(), http.StatusBadRequest)
        return
    }
    
    if err := h.gdprService.UpdateConsent(request.UserID, request.Updates); err != nil {
        http.Error(w, err.Error(), http.StatusInternalServerError)
        return
    }
    
    // Log update
    h.gdprService.LogGDPREvent(
        request.UserID,
        "consent_update",
        r.RemoteAddr,
        r.UserAgent(),
        "User updated consent settings",
    )
    
    w.Header().Set("Content-Type", "application/json")
    json.NewEncoder(w).Encode(map[string]string{
        "status": "success",
        "message": "Consent updated successfully",
    })
}

// Right to be forgotten
func (h *GDPRHandler) DeleteData(w http.ResponseWriter, r *http.Request) {
    var request struct {
        UserID string `json:"user_id"`
        Reason string `json:"reason"`
        Confirm bool  `json:"confirm"`
    }
    
    if err := json.NewDecoder(r.Body).Decode(&request); err != nil {
        http.Error(w, err.Error(), http.StatusBadRequest)
        return
    }
    
    if !request.Confirm {
        http.Error(w, "Confirmation required for data deletion", http.StatusBadRequest)
        return
    }
    
    // Send confirmation email before deletion
    confirmationCode := generateConfirmationCode()
    
    // Store deletion request with confirmation code
    deletionRequest := map[string]interface{}{
        "user_id":           request.UserID,
        "requested_at":      time.Now(),
        "confirmation_code": confirmationCode,
        "ip_address":        r.RemoteAddr,
        "reason":            request.Reason,
        "status":            "pending_confirmation",
    }
    
    // In production, store this in database
    
    // Send confirmation email/SMS
    // h.sendDeletionConfirmation(request.UserID, confirmationCode)
    
    w.Header().Set("Content-Type", "application/json")
    json.NewEncoder(w).Encode(map[string]string{
        "status": "pending_confirmation",
        "message": "Confirmation required. Check your email for confirmation code.",
        "next_step": "Submit confirmation code to /gdpr/confirm-deletion",
    })
}

func (h *GDPRHandler) ConfirmDeletion(w http.ResponseWriter, r *http.Request) {
    var request struct {
        UserID string `json:"user_id"`
        Code   string `json:"code"`
    }
    
    if err := json.NewDecoder(r.Body).Decode(&request); err != nil {
        http.Error(w, err.Error(), http.StatusBadRequest)
        return
    }
    
    // Verify confirmation code (in production, check against stored code)
    if request.Code != "valid_code" { // Replace with actual validation
        http.Error(w, "Invalid confirmation code", http.StatusBadRequest)
        return
    }
    
    // Perform deletion
    if err := h.gdprService.DeleteUserData(request.UserID); err != nil {
        http.Error(w, err.Error(), http.StatusInternalServerError)
        return
    }
    
    // Log deletion
    h.gdprService.LogGDPREvent(
        request.UserID,
        "data_deletion",
        r.RemoteAddr,
        r.UserAgent(),
        "User data deleted per GDPR right to be forgotten",
    )
    
    w.Header().Set("Content-Type", "application/json")
    json.NewEncoder(w).Encode(map[string]string{
        "status": "success",
        "message": "Your data has been deleted successfully",
        "deletion_date": time.Now().Format(time.RFC3339),
    })
}

// Right to access - Data portability
func (h *GDPRHandler) ExportData(w http.ResponseWriter, r *http.Request) {
    userID := r.URL.Query().Get("user_id")
    if userID == "" {
        http.Error(w, "user_id is required", http.StatusBadRequest)
        return
    }
    
    format := r.URL.Query().Get("format")
    if format == "" {
        format = "json"
    }
    
    data, err := h.gdprService.ExportUserData(userID)
    if err != nil {
        http.Error(w, err.Error(), http.StatusInternalServerError)
        return
    }
    
    // Log export
    h.gdprService.LogGDPREvent(
        userID,
        "data_export",
        r.RemoteAddr,
        r.UserAgent(),
        "User exported their data",
    )
    
    switch format {
    case "json":
        w.Header().Set("Content-Type", "application/json")
        w.Header().Set("Content-Disposition", "attachment; filename=\"user-data-"+userID+".json\"")
        json.NewEncoder(w).Encode(data)
        
    case "csv":
        // Convert to CSV format
        w.Header().Set("Content-Type", "text/csv")
        w.Header().Set("Content-Disposition", "attachment; filename=\"user-data-"+userID+".csv\"")
        // Implement CSV conversion
        
    default:
        http.Error(w, "Unsupported format", http.StatusBadRequest)
    }
}

// Register GDPR routes
func (h *GDPRHandler) RegisterRoutes(router *mux.Router) {
    router.HandleFunc("/gdpr/consent", h.GetConsent).Methods("GET")
    router.HandleFunc("/gdpr/consent", h.UpdateConsent).Methods("PUT")
    router.HandleFunc("/gdpr/data", h.DeleteData).Methods("DELETE")
    router.HandleFunc("/gdpr/data/confirm", h.ConfirmDeletion).Methods("POST")
    router.HandleFunc("/gdpr/export", h.ExportData).Methods("GET")
}

func generateConfirmationCode() string {
    // Generate random 6-digit code
    return "123456" // Replace with actual generation
}