package gateway

import (
    "context"
    "fmt"
    "github.com/stripe/stripe-go/v76"
    "github.com/stripe/stripe-go/v76/paymentintent"
    "github.com/stripe/stripe-go/v76/refund"
    "github.com/stripe/stripe-go/v76/customer"
    "github.com/stripe/stripe-go/v76/subscription"
    "github.com/stripe/stripe-go/v76/webhook"
)

type StripeGateway struct {
    secretKey      string
    webhookSecret  string
    publishableKey string
}

func NewStripeGateway(secretKey, webhookSecret, publishableKey string) *StripeGateway {
    stripe.Key = secretKey
    return &StripeGateway{
        secretKey:      secretKey,
        webhookSecret:  webhookSecret,
        publishableKey: publishableKey,
    }
}

func (g *StripeGateway) Name() string {
    return "stripe"
}

func (g *StripeGateway) IsLive() bool {
    return len(g.secretKey) > 0 && g.secretKey[:8] == "sk_live_"
}

func (g *StripeGateway) CreatePaymentIntent(ctx context.Context, params CreatePaymentParams) (*PaymentIntent, error) {
    stripeParams := &stripe.PaymentIntentParams{
        Amount:   stripe.Int64(params.Amount),
        Currency: stripe.String(params.Currency),
    }
    
    if params.CustomerID != "" {
        stripeParams.Customer = stripe.String(params.CustomerID)
    }
    
    if params.Description != "" {
        stripeParams.Description = stripe.String(params.Description)
    }
    
    if len(params.Metadata) > 0 {
        stripeParams.Metadata = make(map[string]string)
        for k, v := range params.Metadata {
            stripeParams.Metadata[k] = v
        }
    }
    
    if len(params.PaymentMethodTypes) > 0 {
        stripeParams.PaymentMethodTypes = stripe.StringSlice(params.PaymentMethodTypes)
    }
    
    if params.ReturnURL != "" {
        stripeParams.ReturnURL = stripe.String(params.ReturnURL)
    }
    
    stripeParams.Confirm = stripe.Bool(params.Confirm)
    
    pi, err := paymentintent.New(stripeParams)
    if err != nil {
        return nil, err
    }
    
    var nextAction *NextAction
    if pi.NextAction != nil {
        nextAction = &NextAction{
            Type: string(pi.NextAction.Type),
            URL:  pi.NextAction.RedirectToURL.URL,
        }
    }
    
    return &PaymentIntent{
        ID:           pi.ID,
        ClientSecret: pi.ClientSecret,
        Status:       string(pi.Status),
        Amount:       pi.Amount,
        Currency:     string(pi.Currency),
        CreatedAt:    time.Unix(pi.Created, 0),
        NextAction:   nextAction,
    }, nil
}

func (g *StripeGateway) CreateCustomer(ctx context.Context, params CustomerParams) (*Customer, error) {
    stripeParams := &stripe.CustomerParams{
        Email: stripe.String(params.Email),
        Name:  stripe.String(params.Name),
        Phone: stripe.String(params.Phone),
    }
    
    if len(params.Metadata) > 0 {
        stripeParams.Metadata = params.Metadata
    }
    
    c, err := customer.New(stripeParams)
    if err != nil {
        return nil, err
    }
    
    return &Customer{
        ID:       c.ID,
        Email:    c.Email,
        Name:     c.Name,
        Phone:    c.Phone,
        Metadata: c.Metadata,
    }, nil
}

func (g *StripeGateway) CreateSubscription(ctx context.Context, params SubscriptionParams) (*Subscription, error) {
    stripeParams := &stripe.SubscriptionParams{
        Customer: stripe.String(params.CustomerID),
        Items: []*stripe.SubscriptionItemsParams{
            {
                Price: stripe.String(params.PriceID),
            },
        },
    }
    
    if len(params.Metadata) > 0 {
        stripeParams.Metadata = params.Metadata
    }
    
    s, err := subscription.New(stripeParams)
    if err != nil {
        return nil, err
    }
    
    return &Subscription{
        ID:                     s.ID,
        Status:                 string(s.Status),
        CurrentPeriodStart:     time.Unix(s.CurrentPeriodStart, 0),
        CurrentPeriodEnd:       time.Unix(s.CurrentPeriodEnd, 0),
        LatestInvoicePaymentID: s.LatestInvoice.PaymentIntent.ID,
    }, nil
}

func (g *StripeGateway) VerifyWebhookSignature(ctx context.Context, payload []byte, signature string) (bool, error) {
    _, err := webhook.ConstructEvent(payload, signature, g.webhookSecret)
    return err == nil, err
}