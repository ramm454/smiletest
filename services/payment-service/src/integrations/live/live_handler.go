package live

import (
	"context"
	"fmt"
	"log"
	"time"

	"payment-service/models"
	"payment-service/services"
	"payment-service/services/notification"
)

// LivePaymentHandler handles live session payments
type LivePaymentHandler struct {
	liveClient          *services.LiveServiceClient
	notificationService *notification.NotificationService
	db                  interface{}
}

// NewLivePaymentHandler creates a new live payment handler
func NewLivePaymentHandler(liveClient *services.LiveServiceClient,
	notificationService *notification.NotificationService,
	db interface{}) *LivePaymentHandler {
	return &LivePaymentHandler{
		liveClient:          liveClient,
		notificationService: notificationService,
		db:                  db,
	}
}

// HandleLivePayment processes payment for a live session
func (h *LivePaymentHandler) HandleLivePayment(ctx context.Context, payment models.Payment) error {
	log.Printf("Processing live session payment: %s for session: %s",
		payment.ID, payment.SessionID)

	// Validate payment is for a live session
	if payment.SessionID == "" {
		return fmt.Errorf("payment %s is not associated with a live session", payment.ID)
	}

	// Get session details
	session, err := h.liveClient.GetSession(ctx, payment.SessionID)
	if err != nil {
		return fmt.Errorf("failed to get session: %w", err)
	}

	// Handle based on payment status
	switch payment.Status {
	case "succeeded", "captured":
		return h.handleSuccessfulLivePayment(ctx, payment, session)
	case "failed", "canceled":
		return h.handleFailedLivePayment(ctx, payment, session)
	case "refunded":
		return h.handleRefundedLivePayment(ctx, payment, session)
	case "pending", "processing":
		return h.handlePendingLivePayment(ctx, payment, session)
	default:
		return fmt.Errorf("unknown payment status: %s", payment.Status)
	}
}

// handleSuccessfulLivePayment handles successful live session payment
func (h *LivePaymentHandler) handleSuccessfulLivePayment(ctx context.Context,
	payment models.Payment, session *services.LiveSession) error {

	log.Printf("Live session payment successful: %s for session: %s",
		payment.ID, session.ID)

	// Grant access to the live session
	access, err := h.liveClient.GrantAccess(ctx, session.ID, payment.UserID, payment.ID)
	if err != nil {
		return fmt.Errorf("failed to grant access: %w", err)
	}

	// Send access notification
	if h.notificationService != nil {
		notification := notification.Notification{
			UserID: payment.UserID,
			Type:   "live_session_access",
			Title:  "Live Session Access Granted!",
			Message: fmt.Sprintf("Access granted for %s at %s. Your access token: %s",
				session.Title, session.StartTime.Format("Jan 2, 2006 3:04 PM"), access.AccessToken),
			Data: map[string]interface{}{
				"session_id":    session.ID,
				"session_title": session.Title,
				"start_time":    session.StartTime,
				"end_time":      session.EndTime,
				"access_token":  access.AccessToken,
				"expires_at":    access.ExpiresAt,
				"join_url":      fmt.Sprintf("/live/session/%s?token=%s", session.ID, access.AccessToken),
			},
		}
		h.notificationService.Send(ctx, notification)
	}

	// Notify instructor if applicable
	go h.notifyInstructor(ctx, session, payment)

	return nil
}

// handleFailedLivePayment handles failed live session payment
func (h *LivePaymentHandler) handleFailedLivePayment(ctx context.Context,
	payment models.Payment, session *services.LiveSession) error {

	log.Printf("Live session payment failed: %s for session: %s",
		payment.ID, session.ID)

	// Send failure notification
	if h.notificationService != nil {
		notification := notification.Notification{
			UserID: payment.UserID,
			Type:   "live_payment_failed",
			Title:  "Live Session Payment Failed",
			Message: fmt.Sprintf("Payment for %s at %s failed. Please try again.",
				session.Title, session.StartTime.Format("Jan 2, 2006 3:04 PM")),
			Data: map[string]interface{}{
				"session_id":    session.ID,
				"session_title": session.Title,
				"start_time":    session.StartTime,
				"amount":        session.Price,
				"currency":      session.Currency,
			},
		}
		h.notificationService.Send(ctx, notification)
	}

	return nil
}

// handleRefundedLivePayment handles refunded live session payment
func (h *LivePaymentHandler) handleRefundedLivePayment(ctx context.Context,
	payment models.Payment, session *services.LiveSession) error {

	log.Printf("Live session payment refunded: %s for session: %s",
		payment.ID, session.ID)

	// Revoke access if session hasn't started
	if time.Now().Before(session.StartTime) {
		if err := h.liveClient.RevokeAccess(ctx, session.ID, payment.UserID); err != nil {
			log.Printf("Failed to revoke access: %v", err)
		}
	}

	// Send refund notification
	if h.notificationService != nil {
		notification := notification.Notification{
			UserID: payment.UserID,
			Type:   "live_session_refunded",
			Title:  "Live Session Refund Processed",
			Message: fmt.Sprintf("Refund processed for %s at %s.",
				session.Title, session.StartTime.Format("Jan 2, 2006 3:04 PM")),
			Data: map[string]interface{}{
				"session_id":    session.ID,
				"session_title": session.Title,
				"refund_amount": payment.Amount,
				"currency":      payment.Currency,
				"refund_date":   time.Now(),
			},
		}
		h.notificationService.Send(ctx, notification)
	}

	return nil
}

// handlePendingLivePayment handles pending live session payment
func (h *LivePaymentHandler) handlePendingLivePayment(ctx context.Context,
	payment models.Payment, session *services.LiveSession) error {

	log.Printf("Live session payment pending: %s for session: %s",
		payment.ID, session.ID)

	// Reserve spot temporarily
	if err := h.liveClient.ReserveSpot(ctx, session.ID, payment.UserID); err != nil {
		log.Printf("Failed to reserve spot: %v", err)
	}

	return nil
}

// notifyInstructor notifies the instructor about new participant
func (h *LivePaymentHandler) notifyInstructor(ctx context.Context,
	session *services.LiveSession, payment models.Payment) {

	// In production, fetch instructor details and send notification
	log.Printf("Would notify instructor %s about new participant for session %s",
		session.InstructorID, session.ID)
}