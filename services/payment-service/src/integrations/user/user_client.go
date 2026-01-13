package user

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"time"

	"payment-service/models"
)

// UserServiceClient client for user service
type UserServiceClient struct {
	httpClient *http.Client
	baseURL    string
	apiKey     string
}

// NewUserServiceClient creates a new user service client
func NewUserServiceClient(baseURL, apiKey string) *UserServiceClient {
	return &UserServiceClient{
		httpClient: &http.Client{
			Timeout: 30 * time.Second,
		},
		baseURL: baseURL,
		apiKey:  apiKey,
	}
}

// User represents a user from user service
type User struct {
	ID           string                 `json:"id"`
	Email        string                 `json:"email"`
	Name         string                 `json:"name"`
	Phone        string                 `json:"phone,omitempty"`
	Address      *UserAddress           `json:"address,omitempty"`
	Preferences  map[string]interface{} `json:"preferences,omitempty"`
	GDPRConsent  *GDPRConsent           `json:"gdpr_consent,omitempty"`
	CreatedAt    time.Time              `json:"created_at"`
	UpdatedAt    time.Time              `json:"updated_at"`
	Status       string                 `json:"status"` // active, suspended, deleted
	UserType     string                 `json:"user_type"` // customer, instructor, admin
}

// UserAddress represents user address
type UserAddress struct {
	Street     string `json:"street"`
	City       string `json:"city"`
	State      string `json:"state"`
	Country    string `json:"country"`
	PostalCode string `json:"postal_code"`
}

// GDPRConsent represents user GDPR consent status
type GDPRConsent struct {
	MarketingConsent bool      `json:"marketing_consent"`
	AnalyticsConsent bool      `json:"analytics_consent"`
	ConsentDate      time.Time `json:"consent_date"`
	ConsentVersion   string    `json:"consent_version"`
}

// GetUserByID gets user by ID
func (c *UserServiceClient) GetUserByID(ctx context.Context, userID string) (*User, error) {
	req, err := http.NewRequestWithContext(ctx, "GET", 
		fmt.Sprintf("%s/users/%s", c.baseURL, userID), nil)
	if err != nil {
		return nil, err
	}

	req.Header.Set("Authorization", "Bearer "+c.apiKey)
	req.Header.Set("Content-Type", "application/json")

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("failed to fetch user: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("user service returned status %d", resp.StatusCode)
	}

	var user User
	if err := json.NewDecoder(resp.Body).Decode(&user); err != nil {
		return nil, fmt.Errorf("failed to decode user response: %w", err)
	}

	return &user, nil
}

// GetUserByEmail gets user by email
func (c *UserServiceClient) GetUserByEmail(ctx context.Context, email string) (*User, error) {
	req, err := http.NewRequestWithContext(ctx, "GET", 
		fmt.Sprintf("%s/users/email/%s", c.baseURL, email), nil)
	if err != nil {
		return nil, err
	}

	req.Header.Set("Authorization", "Bearer "+c.apiKey)
	req.Header.Set("Content-Type", "application/json")

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("failed to fetch user by email: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("user service returned status %d", resp.StatusCode)
	}

	var user User
	if err := json.NewDecoder(resp.Body).Decode(&user); err != nil {
		return nil, fmt.Errorf("failed to decode user response: %w", err)
	}

	return &user, nil
}

// ValidateUserToken validates user authentication token
func (c *UserServiceClient) ValidateUserToken(ctx context.Context, token string) (*User, error) {
	req, err := http.NewRequestWithContext(ctx, "POST", 
		fmt.Sprintf("%s/auth/validate", c.baseURL),
		bytes.NewBufferString(fmt.Sprintf(`{"token": "%s"}`, token)))
	if err != nil {
		return nil, err
	}

	req.Header.Set("Authorization", "Bearer "+c.apiKey)
	req.Header.Set("Content-Type", "application/json")

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("failed to validate token: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("token validation failed with status %d", resp.StatusCode)
	}

	var response struct {
		Valid bool `json:"valid"`
		User  User `json:"user"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&response); err != nil {
		return nil, fmt.Errorf("failed to decode validation response: %w", err)
	}

	if !response.Valid {
		return nil, fmt.Errorf("invalid token")
	}

	return &response.User, nil
}

// UpdateUserPaymentPreferences updates user payment preferences
func (c *UserServiceClient) UpdateUserPaymentPreferences(ctx context.Context, userID string, preferences map[string]interface{}) error {
	payload := map[string]interface{}{
		"payment_preferences": preferences,
	}

	jsonData, err := json.Marshal(payload)
	if err != nil {
		return fmt.Errorf("failed to marshal preferences: %w", err)
	}

	req, err := http.NewRequestWithContext(ctx, "PATCH", 
		fmt.Sprintf("%s/users/%s/preferences", c.baseURL, userID),
		bytes.NewBuffer(jsonData))
	if err != nil {
		return fmt.Errorf("failed to create request: %w", err)
	}

	req.Header.Set("Authorization", "Bearer "+c.apiKey)
	req.Header.Set("Content-Type", "application/json")

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return fmt.Errorf("failed to update preferences: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("failed to update preferences, status: %d", resp.StatusCode)
	}

	return nil
}

// GetUserDefaultPaymentMethod gets user's default payment method
func (c *UserServiceClient) GetUserDefaultPaymentMethod(ctx context.Context, userID string) (*PaymentMethod, error) {
	req, err := http.NewRequestWithContext(ctx, "GET", 
		fmt.Sprintf("%s/users/%s/payment-methods/default", c.baseURL, userID), nil)
	if err != nil {
		return nil, err
	}

	req.Header.Set("Authorization", "Bearer "+c.apiKey)
	req.Header.Set("Content-Type", "application/json")

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("failed to fetch payment method: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		// User may not have a default payment method
		return nil, nil
	}

	var paymentMethod PaymentMethod
	if err := json.NewDecoder(resp.Body).Decode(&paymentMethod); err != nil {
		return nil, fmt.Errorf("failed to decode payment method response: %w", err)
	}

	return &paymentMethod, nil
}

// PaymentMethod represents a user's payment method
type PaymentMethod struct {
	ID           string                 `json:"id"`
	UserID       string                 `json:"user_id"`
	Type         string                 `json:"type"` // card, bank_account, wallet
	Provider     string                 `json:"provider"` // stripe, paypal, razorpay
	LastFour     string                 `json:"last_four,omitempty"`
	ExpiryMonth  int                    `json:"expiry_month,omitempty"`
	ExpiryYear   int                    `json:"expiry_year,omitempty"`
	IsDefault    bool                   `json:"is_default"`
	Metadata     map[string]interface{} `json:"metadata,omitempty"`
	CreatedAt    time.Time              `json:"created_at"`
}

// SearchUsers searches users by criteria
func (c *UserServiceClient) SearchUsers(ctx context.Context, query map[string]interface{}) ([]User, error) {
	jsonData, err := json.Marshal(query)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal query: %w", err)
	}

	req, err := http.NewRequestWithContext(ctx, "POST", 
		fmt.Sprintf("%s/users/search", c.baseURL),
		bytes.NewBuffer(jsonData))
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}

	req.Header.Set("Authorization", "Bearer "+c.apiKey)
	req.Header.Set("Content-Type", "application/json")

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("failed to search users: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("search failed with status %d", resp.StatusCode)
	}

	var response struct {
		Users []User `json:"users"`
		Total int    `json:"total"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&response); err != nil {
		return nil, fmt.Errorf("failed to decode search response: %w", err)
	}

	return response.Users, nil
}