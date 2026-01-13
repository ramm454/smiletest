package live

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"payment-service/models"
)

// LiveWebhookHandler handles webhooks from live service
type LiveWebhookHandler struct {
	db interface{}
}

// NewLiveWebhookHandler creates a new live webhook handler
func NewLiveWebhookHandler(db interface{}) *LiveWebhookHandler {
	return &LiveWebhookHandler{
		db: db,
	}
}

// HandleLiveWebhook handles incoming webhooks from live service
func (h *LiveWebhookHandler) HandleLiveWebhook(c *gin.Context) {
	var webhookData map[string]interface{}
	if err := c.ShouldBindJSON(&webhookData); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Verify webhook signature
	if !h.verifyWebhookSignature(c.Request, webhookData) {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid signature"})
		return
	}

	eventType, _ := webhookData["event"].(string)
	sessionID, _ := webhookData["session_id"].(string)

	log.Printf("Live webhook received: %s for session: %s", eventType, sessionID)

	switch eventType {
	case "session_started":
		h.handleSessionStarted(c.Request.Context(), webhookData)
	case "session_ended":
		h.handleSessionEnded(c.Request.Context(), webhookData)
	case "session_cancelled":
		h.handleSessionCancelled(c.Request.Context(), webhookData)
	case "participant_joined":
		h.handleParticipantJoined(c.Request.Context(), webhookData)
	case "participant_left":
		h.handleParticipantLeft(c.Request.Context(), webhookData)
	default:
		log.Printf("Unhandled live webhook event: %s", eventType)
	}

	c.JSON(http.StatusOK, gin.H{"status": "processed"})
}

// handleSessionStarted processes session started event
func (h *LiveWebhookHandler) handleSessionStarted(ctx context.Context, data map[string]interface{}) {
	sessionID, _ := data["session_id"].(string)
	log.Printf("Session started: %s", sessionID)

	// Mark all payments for this session as "session_started"
	// In production, update payment metadata
}

// handleSessionEnded processes session ended event
func (h *LiveWebhookHandler) handleSessionEnded(ctx context.Context, data map[string]interface{}) {
	sessionID, _ := data["session_id"].(string)
	log.Printf("Session ended: %s", sessionID)

	// Mark all payments for this session as "session_completed"
	// In production, update payment metadata and trigger follow-up
}

// handleSessionCancelled processes session cancelled event
func (h *LiveWebhookHandler) handleSessionCancelled(ctx context.Context, data map[string]interface{}) {
	sessionID, _ := data["session_id"].(string)
	reason, _ := data["reason"].(string)

	log.Printf("Session cancelled: %s, reason: %s", sessionID, reason)

	// Process automatic refunds for cancelled sessions
	go h.processSessionRefunds(ctx, sessionID, reason)
}

// handleParticipantJoined processes participant joined event
func (h *LiveWebhookHandler) handleParticipantJoined(ctx context.Context, data map[string]interface{}) {
	sessionID, _ := data["session_id"].(string)
	userID, _ := data["user_id"].(string)

	log.Printf("Participant %s joined session %s", userID, sessionID)

	// Update payment metadata to mark attendance
}

// handleParticipantLeft processes participant left event
func (h *LiveWebhookHandler) handleParticipantLeft(ctx context.Context, data map[string]interface{}) {
	sessionID, _ := data["session_id"].(string)
	userID, _ := data["user_id"].(string)

	log.Printf("Participant %s left session %s", userID, sessionID)
}

// processSessionRefunds processes refunds for cancelled sessions
func (h *LiveWebhookHandler) processSessionRefunds(ctx context.Context, sessionID, reason string) {
	// Find all payments for this session
	// Process refunds based on cancellation policy
	// Send refund notifications
	log.Printf("Processing refunds for cancelled session: %s", sessionID)
}

// verifyWebhookSignature verifies live service webhook signature
func (h *LiveWebhookHandler) verifyWebhookSignature(req *http.Request, data map[string]interface{}) bool {
	// In production, implement proper signature verification
	// using shared secret from environment
	expectedSecret := "live_service_webhook_secret" // Should be from env
	signature := req.Header.Get("X-Live-Signature")

	// Simplified verification for example
	return signature == expectedSecret
}

// Webhook models
type LiveSessionEvent struct {
	Event     string                 `json:"event"`
	SessionID string                 `json:"session_id"`
	UserID    string                 `json:"user_id,omitempty"`
	Timestamp time.Time              `json:"timestamp"`
	Data      map[string]interface{} `json:"data,omitempty"`
}