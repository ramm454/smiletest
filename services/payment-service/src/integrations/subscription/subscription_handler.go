package subscription

import (
	"context"
	"fmt"
	"log"
	"time"

	"github.com/google/uuid"
	"payment-service/models"
	"payment-service/services"
	"payment-service/services/notification"
)

// SubscriptionPaymentHandler handles subscription payments
type SubscriptionPaymentHandler struct {
	subscriptionClient  *services.SubscriptionServiceClient
	notificationService *notification.NotificationService
	db                  interface{}
}

// NewSubscriptionPaymentHandler creates a new subscription payment handler
func NewSubscriptionPaymentHandler(
	subscriptionClient *services.SubscriptionServiceClient,
	notificationService *notification.NotificationService,
	db interface{}) *SubscriptionPaymentHandler {
	return &SubscriptionPaymentHandler{
		subscriptionClient:  subscriptionClient,
		notificationService: notificationService,
		db:                  db,
	}
}

// HandleSubscriptionPayment processes subscription payment
func (h *SubscriptionPaymentHandler) HandleSubscriptionPayment(ctx context.Context, payment models.Payment) error {
	log.Printf("Processing subscription payment: %s for subscription: %s",
		payment.ID, payment.SubscriptionID)

	if payment.SubscriptionID == "" {
		return fmt.Errorf("payment %s is not associated with a subscription", payment.ID)
	}

	// Get subscription details
	subscription, err := h.subscriptionClient.GetSubscription(ctx, payment.SubscriptionID)
	if err != nil {
		return fmt.Errorf("failed to get subscription: %w", err)
	}

	// Handle based on payment status
	switch payment.Status {
	case "succeeded", "captured":
		return h.handleSuccessfulSubscriptionPayment(ctx, payment, subscription)
	case "failed", "canceled":
		return h.handleFailedSubscriptionPayment(ctx, payment, subscription)
	case "refunded":
		return h.handleRefundedSubscriptionPayment(ctx, payment, subscription)
	case "pending", "processing":
		return h.handlePendingSubscriptionPayment(ctx, payment, subscription)
	default:
		return fmt.Errorf("unknown payment status: %s", payment.Status)
	}
}

// handleSuccessfulSubscriptionPayment handles successful subscription payment
func (h *SubscriptionPaymentHandler) handleSuccessfulSubscriptionPayment(ctx context.Context,
	payment models.Payment, subscription *models.Subscription) error {

	log.Printf("Subscription payment successful: %s for subscription: %s",
		payment.ID, subscription.ID)

	// Activate or renew subscription
	if err := h.subscriptionClient.ActivateSubscription(ctx, subscription.ID, payment.ID); err != nil {
		return fmt.Errorf("failed to activate subscription: %w", err)
	}

	// Calculate next billing date
	nextBillingDate := calculateNextBillingDate(subscription)

	// Send confirmation notification
	if h.notificationService != nil {
		notification := notification.Notification{
			UserID: subscription.UserID,
			Type:   "subscription_activated",
			Title:  "Subscription Activated!",
			Message: fmt.Sprintf("Your %s subscription has been activated. Next billing: %s",
				subscription.PlanID, nextBillingDate.Format("Jan 2, 2006")),
			Data: map[string]interface{}{
				"subscription_id": subscription.ID,
				"plan_id":         subscription.PlanID,
				"amount":          subscription.Amount,
				"currency":        subscription.Currency,
				"interval":        subscription.Interval,
				"current_period_start": subscription.CurrentPeriodStart,
				"current_period_end":   subscription.CurrentPeriodEnd,
				"next_billing_date":    nextBillingDate,
				"features":             getSubscriptionFeatures(subscription.PlanID),
			},
		}
		h.notificationService.Send(ctx, notification)
	}

	// Update user access permissions
	go h.updateUserAccess(ctx, subscription.UserID, subscription.PlanID)

	return nil
}

// handleFailedSubscriptionPayment handles failed subscription payment
func (h *SubscriptionPaymentHandler) handleFailedSubscriptionPayment(ctx context.Context,
	payment models.Payment, subscription *models.Subscription) error {

	log.Printf("Subscription payment failed: %s for subscription: %s",
		payment.ID, subscription.ID)

	// Mark subscription as payment failed
	if err := h.subscriptionClient.MarkPaymentFailed(ctx, subscription.ID); err != nil {
		log.Printf("Failed to mark subscription payment failed: %v", err)
	}

	// Send failure notification
	if h.notificationService != nil {
		notification := notification.Notification{
			UserID: subscription.UserID,
			Type:   "subscription_payment_failed",
			Title:  "Subscription Payment Failed",
			Message: fmt.Sprintf("Payment for your %s subscription failed. Please update your payment method.",
				subscription.PlanID),
			Data: map[string]interface{}{
				"subscription_id": subscription.ID,
				"plan_id":         subscription.PlanID,
				"amount":          subscription.Amount,
				"retry_count":     getRetryCount(subscription.ID),
				"next_retry_date": time.Now().Add(24 * time.Hour),
			},
		}
		h.notificationService.Send(ctx, notification)
	}

	return nil
}

// handleRefundedSubscriptionPayment handles refunded subscription payment
func (h *SubscriptionPaymentHandler) handleRefundedSubscriptionPayment(ctx context.Context,
	payment models.Payment, subscription *models.Subscription) error {

	log.Printf("Subscription payment refunded: %s for subscription: %s",
		payment.ID, subscription.ID)

	// Cancel subscription
	if err := h.subscriptionClient.CancelSubscription(ctx, subscription.ID, "payment_refunded"); err != nil {
		log.Printf("Failed to cancel subscription: %v", err)
	}

	// Send refund notification
	if h.notificationService != nil {
		notification := notification.Notification{
			UserID: subscription.UserID,
			Type:   "subscription_refunded",
			Title:  "Subscription Refund Processed",
			Message: fmt.Sprintf("Your %s subscription has been cancelled and refund processed.",
				subscription.PlanID),
			Data: map[string]interface{}{
				"subscription_id": subscription.ID,
				"plan_id":         subscription.PlanID,
				"refund_amount":   payment.Amount,
				"currency":        payment.Currency,
				"refund_date":     time.Now(),
				"end_date":        time.Now(),
			},
		}
		h.notificationService.Send(ctx, notification)
	}

	// Revoke user access
	go h.revokeUserAccess(ctx, subscription.UserID, subscription.PlanID)

	return nil
}

// handlePendingSubscriptionPayment handles pending subscription payment
func (h *SubscriptionPaymentHandler) handlePendingSubscriptionPayment(ctx context.Context,
	payment models.Payment, subscription *models.Subscription) error {

	log.Printf("Subscription payment pending: %s for subscription: %s",
		payment.ID, subscription.ID)

	// Mark subscription as pending payment
	if err := h.subscriptionClient.MarkPaymentPending(ctx, subscription.ID, payment.ID); err != nil {
		log.Printf("Failed to mark subscription payment pending: %v", err)
	}

	return nil
}

// Helper functions
func calculateNextBillingDate(subscription *models.Subscription) time.Time {
	now := time.Now()
	switch subscription.Interval {
	case "month":
		return now.AddDate(0, 1, 0)
	case "year":
		return now.AddDate(1, 0, 0)
	case "week":
		return now.AddDate(0, 0, 7)
	default:
		return now.AddDate(0, 1, 0) // Default monthly
	}
}

func getSubscriptionFeatures(planID string) []string {
	// In production, fetch from subscription service
	features := map[string][]string{
		"premium": {"unlimited_classes", "live_sessions", "downloads", "priority_support"},
		"basic":   {"10_classes_month", "recorded_sessions", "community_access"},
	}
	return features[planID]
}

func getRetryCount(subscriptionID string) int {
	// In production, fetch from database
	return 1
}

func (h *SubscriptionPaymentHandler) updateUserAccess(ctx context.Context, userID, planID string) {
	// Update user permissions based on subscription plan
	log.Printf("Updating access for user %s with plan %s", userID, planID)
}

func (h *SubscriptionPaymentHandler) revokeUserAccess(ctx context.Context, userID, planID string) {
	// Revoke subscription-specific access
	log.Printf("Revoking access for user %s from plan %s", userID, planID)
}