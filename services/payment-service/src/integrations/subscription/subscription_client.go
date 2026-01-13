package subscription

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"time"

	"payment-service/models"
)

// SubscriptionServiceClient client for subscription service
type SubscriptionServiceClient struct {
	httpClient *http.Client
	baseURL    string
	apiKey     string
}

// NewSubscriptionServiceClient creates a new subscription service client
func NewSubscriptionServiceClient(baseURL, apiKey string) *SubscriptionServiceClient {
	return &SubscriptionServiceClient{
		httpClient: &http.Client{
			Timeout: 30 * time.Second,
		},
		baseURL: baseURL,
		apiKey:  apiKey,
	}
}

// GetSubscription retrieves a subscription by ID
func (c *SubscriptionServiceClient) GetSubscription(ctx context.Context, subscriptionID string) (*models.Subscription, error) {
	req, err := http.NewRequestWithContext(ctx, "GET",
		fmt.Sprintf("%s/subscriptions/%s", c.baseURL, subscriptionID), nil)
	if err != nil {
		return nil, err
	}

	req.Header.Set("Authorization", "Bearer "+c.apiKey)
	req.Header.Set("Content-Type", "application/json")

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("failed to fetch subscription: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("subscription service returned status %d", resp.StatusCode)
	}

	var subscription models.Subscription
	if err := json.NewDecoder(resp.Body).Decode(&subscription); err != nil {
		return nil, fmt.Errorf("failed to decode subscription response: %w", err)
	}

	return &subscription, nil
}

// ActivateSubscription activates a subscription with payment ID
func (c *SubscriptionServiceClient) ActivateSubscription(ctx context.Context, subscriptionID, paymentID string) error {
	activateReq := map[string]string{
		"payment_id": paymentID,
		"status":     "active",
	}

	jsonData, err := json.Marshal(activateReq)
	if err != nil {
		return fmt.Errorf("failed to marshal activate request: %w", err)
	}

	req, err := http.NewRequestWithContext(ctx, "POST",
		fmt.Sprintf("%s/subscriptions/%s/activate", c.baseURL, subscriptionID),
		bytes.NewBuffer(jsonData))
	if err != nil {
		return fmt.Errorf("failed to create request: %w", err)
	}

	req.Header.Set("Authorization", "Bearer "+c.apiKey)
	req.Header.Set("Content-Type", "application/json")

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return fmt.Errorf("failed to activate subscription: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("failed to activate subscription, status: %d", resp.StatusCode)
	}

	return nil
}

// MarkPaymentFailed marks subscription payment as failed
func (c *SubscriptionServiceClient) MarkPaymentFailed(ctx context.Context, subscriptionID string) error {
	updateReq := map[string]interface{}{
		"payment_status": "failed",
		"failed_at":      time.Now().Format(time.RFC3339),
	}

	jsonData, err := json.Marshal(updateReq)
	if err != nil {
		return fmt.Errorf("failed to marshal update request: %w", err)
	}

	req, err := http.NewRequestWithContext(ctx, "PATCH",
		fmt.Sprintf("%s/subscriptions/%s/payment", c.baseURL, subscriptionID),
		bytes.NewBuffer(jsonData))
	if err != nil {
		return fmt.Errorf("failed to create request: %w", err)
	}

	req.Header.Set("Authorization", "Bearer "+c.apiKey)
	req.Header.Set("Content-Type", "application/json")

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return fmt.Errorf("failed to update subscription payment: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("failed to update subscription payment, status: %d", resp.StatusCode)
	}

	return nil
}

// MarkPaymentPending marks subscription payment as pending
func (c *SubscriptionServiceClient) MarkPaymentPending(ctx context.Context, subscriptionID, paymentID string) error {
	updateReq := map[string]interface{}{
		"payment_status": "pending",
		"payment_id":     paymentID,
	}

	jsonData, err := json.Marshal(updateReq)
	if err != nil {
		return fmt.Errorf("failed to marshal update request: %w", err)
	}

	req, err := http.NewRequestWithContext(ctx, "PATCH",
		fmt.Sprintf("%s/subscriptions/%s/payment", c.baseURL, subscriptionID),
		bytes.NewBuffer(jsonData))
	if err != nil {
		return fmt.Errorf("failed to create request: %w", err)
	}

	req.Header.Set("Authorization", "Bearer "+c.apiKey)
	req.Header.Set("Content-Type", "application/json")

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return fmt.Errorf("failed to update subscription payment: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("failed to update subscription payment, status: %d", resp.StatusCode)
	}

	return nil
}

// CancelSubscription cancels a subscription
func (c *SubscriptionServiceClient) CancelSubscription(ctx context.Context, subscriptionID, reason string) error {
	cancelReq := map[string]string{
		"reason": reason,
	}

	jsonData, err := json.Marshal(cancelReq)
	if err != nil {
		return fmt.Errorf("failed to marshal cancel request: %w", err)
	}

	req, err := http.NewRequestWithContext(ctx, "POST",
		fmt.Sprintf("%s/subscriptions/%s/cancel", c.baseURL, subscriptionID),
		bytes.NewBuffer(jsonData))
	if err != nil {
		return fmt.Errorf("failed to create request: %w", err)
	}

	req.Header.Set("Authorization", "Bearer "+c.apiKey)
	req.Header.Set("Content-Type", "application/json")

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return fmt.Errorf("failed to cancel subscription: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("failed to cancel subscription, status: %d", resp.StatusCode)
	}

	return nil
}

// GetUserSubscriptions gets all subscriptions for a user
func (c *SubscriptionServiceClient) GetUserSubscriptions(ctx context.Context, userID string) ([]models.Subscription, error) {
	req, err := http.NewRequestWithContext(ctx, "GET",
		fmt.Sprintf("%s/users/%s/subscriptions", c.baseURL, userID), nil)
	if err != nil {
		return nil, err
	}

	req.Header.Set("Authorization", "Bearer "+c.apiKey)
	req.Header.Set("Content-Type", "application/json")

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("failed to fetch user subscriptions: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("subscription service returned status %d", resp.StatusCode)
	}

	var subscriptions struct {
		Subscriptions []models.Subscription `json:"subscriptions"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&subscriptions); err != nil {
		return nil, fmt.Errorf("failed to decode subscriptions response: %w", err)
	}

	return subscriptions.Subscriptions, nil
}