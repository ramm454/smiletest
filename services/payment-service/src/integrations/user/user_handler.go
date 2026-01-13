package user

import (
	"context"
	"fmt"
	"log"
	"time"

	"payment-service/models"
)

// UserIntegrationHandler handles user service integration
type UserIntegrationHandler struct {
	userClient *UserServiceClient
	db         interface{} // Your database interface
}

// NewUserIntegrationHandler creates a new user integration handler
func NewUserIntegrationHandler(userClient *UserServiceClient, db interface{}) *UserIntegrationHandler {
	return &UserIntegrationHandler{
		userClient: userClient,
		db:         db,
	}
}

// SyncUserToPaymentService syncs user data from user service to payment service
func (h *UserIntegrationHandler) SyncUserToPaymentService(ctx context.Context, userID string) (*models.Customer, error) {
	// Get user from user service
	user, err := h.userClient.GetUserByID(ctx, userID)
	if err != nil {
		return nil, fmt.Errorf("failed to get user: %w", err)
	}

	// Create or update customer in payment service
	customer, err := h.createOrUpdateCustomer(ctx, user)
	if err != nil {
		return nil, fmt.Errorf("failed to sync customer: %w", err)
	}

	log.Printf("Synced user %s to payment service as customer %s", user.ID, customer.ID)
	return customer, nil
}

// createOrUpdateCustomer creates or updates customer record
func (h *UserIntegrationHandler) createOrUpdateCustomer(ctx context.Context, user *User) (*models.Customer, error) {
	// Check if customer already exists
	var existingCustomer models.Customer
	// This would query your database
	// h.db.Where("user_id = ?", user.ID).First(&existingCustomer)

	if existingCustomer.ID != "" {
		// Update existing customer
		existingCustomer.Email = user.Email
		existingCustomer.Name = user.Name
		existingCustomer.Phone = user.Phone
		existingCustomer.UpdatedAt = time.Now()
		
		// Update metadata
		if existingCustomer.Metadata == nil {
			existingCustomer.Metadata = make(map[string]interface{})
		}
		existingCustomer.Metadata["last_sync"] = time.Now().Format(time.RFC3339)
		existingCustomer.Metadata["user_type"] = user.UserType
		existingCustomer.Metadata["user_status"] = user.Status
		
		// Save updates
		// h.db.Save(&existingCustomer)
		
		return &existingCustomer, nil
	}

	// Create new customer
	customer := models.Customer{
		ID:        generateCustomerID(),
		UserID:    user.ID,
		Email:     user.Email,
		Name:      user.Name,
		Phone:     user.Phone,
		CreatedAt: time.Now(),
		UpdatedAt: time.Now(),
		Metadata: map[string]interface{}{
			"synced_from_user_service": true,
			"sync_date":                time.Now().Format(time.RFC3339),
			"user_type":                user.UserType,
			"user_status":              user.Status,
			"gdpr_consent": map[string]interface{}{
				"marketing": user.GDPRConsent != nil && user.GDPRConsent.MarketingConsent,
				"analytics": user.GDPRConsent != nil && user.GDPRConsent.AnalyticsConsent,
				"consent_date": user.GDPRConsent.ConsentDate,
				"version": user.GDPRConsent.ConsentVersion,
			},
		},
	}

	// Save to database
	// h.db.Create(&customer)

	return &customer, nil
}

// GetUserForPayment retrieves user data for payment processing
func (h *UserIntegrationHandler) GetUserForPayment(ctx context.Context, userID string) (*PaymentUser, error) {
	// Get user from user service
	user, err := h.userClient.GetUserByID(ctx, userID)
	if err != nil {
		return nil, fmt.Errorf("failed to get user: %w", err)
	}

	// Get user's default payment method
	paymentMethod, _ := h.userClient.GetUserDefaultPaymentMethod(ctx, userID)

	// Create payment user object
	paymentUser := &PaymentUser{
		User:         user,
		PaymentMethod: paymentMethod,
		HasGDPRConsent: user.GDPRConsent != nil,
	}

	return paymentUser, nil
}

// ValidateUserForPayment validates if user can make a payment
func (h *UserIntegrationHandler) ValidateUserForPayment(ctx context.Context, userID string) (bool, error) {
	user, err := h.userClient.GetUserByID(ctx, userID)
	if err != nil {
		return false, fmt.Errorf("failed to get user: %w", err)
	}

	// Check user status
	if user.Status != "active" {
		return false, fmt.Errorf("user account is %s", user.Status)
	}

	// Check if user has necessary GDPR consent
	if user.GDPRConsent == nil {
		return false, fmt.Errorf("user has not provided necessary consent")
	}

	// Additional validation logic
	// Check for payment restrictions, fraud flags, etc.

	return true, nil
}

// PaymentUser represents user data for payment processing
type PaymentUser struct {
	User          *User
	PaymentMethod *PaymentMethod
	HasGDPRConsent bool
}

// Helper function to generate customer ID
func generateCustomerID() string {
	// Implement your ID generation logic
	return "cust_" + time.Now().Format("20060102") + "_" + generateRandomString(8)
}

func generateRandomString(n int) string {
	// Implement random string generation
	return "random"
}