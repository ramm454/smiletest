package gateway

import (
    "context"
    "time"
)

// PaymentGateway defines the interface for all payment gateways
type PaymentGateway interface {
    // Payment Methods
    CreatePaymentIntent(ctx context.Context, params CreatePaymentParams) (*PaymentIntent, error)
    CapturePayment(ctx context.Context, paymentID string, amount int64) (*Payment, error)
    RefundPayment(ctx context.Context, paymentID string, amount int64, reason string) (*Refund, error)
    
    // Customer Management
    CreateCustomer(ctx context.Context, params CustomerParams) (*Customer, error)
    UpdateCustomer(ctx context.Context, customerID string, params CustomerParams) (*Customer, error)
    
    // Subscription Management
    CreateSubscription(ctx context.Context, params SubscriptionParams) (*Subscription, error)
    CancelSubscription(ctx context.Context, subscriptionID string) (*Subscription, error)
    UpdateSubscription(ctx context.Context, subscriptionID string, params UpdateSubscriptionParams) (*Subscription, error)
    
    // Webhook Handling
    VerifyWebhookSignature(ctx context.Context, payload []byte, signature string) (bool, error)
    ParseWebhookEvent(ctx context.Context, payload []byte) (*WebhookEvent, error)
    
    // Payouts
    CreatePayout(ctx context.Context, params PayoutParams) (*Payout, error)
    
    // Utility
    Name() string
    IsLive() bool
}

// Common types for all gateways
type CreatePaymentParams struct {
    Amount               int64
    Currency             string
    CustomerID           string
    CustomerEmail        string
    Description          string
    Metadata             map[string]string
    PaymentMethodTypes   []string
    ReturnURL            string
    Confirm              bool
}

type PaymentIntent struct {
    ID           string
    ClientSecret string
    Status       string
    Amount       int64
    Currency     string
    CreatedAt    time.Time
    NextAction   *NextAction
}

type NextAction struct {
    Type     string
    URL      string
    Data     map[string]interface{}
}

type CustomerParams struct {
    Email     string
    Name      string
    Phone     string
    Metadata  map[string]string
}

type SubscriptionParams struct {
    CustomerID string
    PriceID    string
    Quantity   int64
    Metadata   map[string]string
}

type PayoutParams struct {
    Amount    int64
    Currency  string
    Method    string // bank_transfer, paypal, etc.
    Recipient Recipient
}

type Recipient struct {
    ID    string
    Type  string // user, instructor, business
    Email string
    Name  string
}