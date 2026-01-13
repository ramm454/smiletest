package gateway

import (
    "context"
    "crypto/hmac"
    "crypto/sha256"
    "encoding/hex"
    "encoding/json"
    "fmt"
    "net/http"
    "strings"
    "time"
    
    "github.com/razorpay/razorpay-go"
)

type RazorPayGateway struct {
    client        *razorpay.Client
    keyID         string
    keySecret     string
    webhookSecret string
    baseURL       string
}

func NewRazorPayGateway(keyID, keySecret, webhookSecret string, isTest bool) *RazorPayGateway {
    client := razorpay.NewClient(keyID, keySecret)
    
    baseURL := "https://api.razorpay.com/v1"
    if isTest {
        baseURL = "https://api.razorpay.com/v1" // RazorPay uses same URL for test/live
    }
    
    return &RazorPayGateway{
        client:        client,
        keyID:         keyID,
        keySecret:     keySecret,
        webhookSecret: webhookSecret,
        baseURL:       baseURL,
    }
}

func (g *RazorPayGateway) Name() string {
    return "razorpay"
}

func (g *RazorPayGateway) IsLive() bool {
    // RazorPay test keys start with "rzp_test_" and live keys start with "rzp_live_"
    return strings.HasPrefix(g.keyID, "rzp_live_")
}

func (g *RazorPayGateway) CreatePaymentIntent(ctx context.Context, params CreatePaymentParams) (*PaymentIntent, error) {
    // Convert amount to smallest currency unit (paise for INR)
    // RazorPay expects amount in paise (1 INR = 100 paise)
    // For USD, 1 USD = 100 cents
    amount := params.Amount
    
    // RazorPay metadata
    notes := make(map[string]interface{})
    for k, v := range params.Metadata {
        notes[k] = v
    }
    
    // Create order in RazorPay
    orderData := map[string]interface{}{
        "amount":          amount,
        "currency":        strings.ToUpper(params.Currency),
        "receipt":         fmt.Sprintf("receipt_%d", time.Now().Unix()),
        "payment_capture": 1, // Auto-capture payments
        "notes":           notes,
    }
    
    if params.Description != "" {
        orderData["notes"] = map[string]interface{}{
            "description": params.Description,
        }
    }
    
    order, err := g.client.Order.Create(orderData, nil)
    if err != nil {
        return nil, fmt.Errorf("failed to create RazorPay order: %v", err)
    }
    
    orderID, _ := order["id"].(string)
    orderAmount, _ := order["amount"].(json.Number).Int64()
    orderCurrency, _ := order["currency"].(string)
    orderStatus, _ := order["status"].(string)
    
    // Create response with necessary data for frontend
    return &PaymentIntent{
        ID:           orderID,
        ClientSecret: "", // RazorPay doesn't use client_secret
        Status:       orderStatus,
        Amount:       orderAmount,
        Currency:     orderCurrency,
        CreatedAt:    time.Now(),
        NextAction: &NextAction{
            Type: "redirect",
            URL:  "", // Will be handled by frontend
            Data: map[string]interface{}{
                "key":          g.keyID,
                "order_id":     orderID,
                "amount":       orderAmount,
                "currency":     orderCurrency,
                "name":         "Yoga Spa Platform",
                "description":  params.Description,
                "prefill": map[string]interface{}{
                    "name":  getCustomerName(params.Metadata),
                    "email": params.CustomerEmail,
                },
                "theme": map[string]interface{}{
                    "color": "#3B82F6",
                },
            },
        },
    }, nil
}

func (g *RazorPayGateway) CapturePayment(ctx context.Context, paymentID string, amount int64) (*Payment, error) {
    // In RazorPay, capture happens automatically when payment_capture=1
    // But we can still verify the payment
    
    payment, err := g.client.Payment.Fetch(paymentID, nil, nil)
    if err != nil {
        return nil, fmt.Errorf("failed to fetch payment: %v", err)
    }
    
    paymentStatus, _ := payment["status"].(string)
    paymentAmount, _ := payment["amount"].(json.Number).Int64()
    paymentCurrency, _ := payment["currency"].(string)
    orderID, _ := payment["order_id"].(string)
    
    return &Payment{
        ID:        paymentID,
        Status:    paymentStatus,
        Amount:    paymentAmount,
        Currency:  paymentCurrency,
        OrderID:   orderID,
        Captured:  paymentStatus == "captured",
        CreatedAt: time.Now(),
    }, nil
}

func (g *RazorPayGateway) RefundPayment(ctx context.Context, paymentID string, amount int64, reason string) (*Refund, error) {
    refundData := map[string]interface{}{
        "amount": amount,
        "notes": map[string]interface{}{
            "reason": reason,
        },
    }
    
    refund, err := g.client.Refund.Create(paymentID, refundData, nil)
    if err != nil {
        return nil, fmt.Errorf("failed to create refund: %v", err)
    }
    
    refundID, _ := refund["id"].(string)
    refundAmount, _ := refund["amount"].(json.Number).Int64()
    refundStatus, _ := refund["status"].(string)
    
    return &Refund{
        ID:     refundID,
        Amount: refundAmount,
        Status: refundStatus,
        Reason: reason,
    }, nil
}

func (g *RazorPayGateway) CreateCustomer(ctx context.Context, params CustomerParams) (*Customer, error) {
    // RazorPay customer creation
    customerData := map[string]interface{}{
        "name":  params.Name,
        "email": params.Email,
        "notes": params.Metadata,
    }
    
    if params.Phone != "" {
        customerData["contact"] = params.Phone
    }
    
    customer, err := g.client.Customer.Create(customerData, nil)
    if err != nil {
        return nil, fmt.Errorf("failed to create customer: %v", err)
    }
    
    customerID, _ := customer["id"].(string)
    customerEmail, _ := customer["email"].(string)
    customerName, _ := customer["name"].(string)
    
    return &Customer{
        ID:       customerID,
        Email:    customerEmail,
        Name:     customerName,
        Phone:    params.Phone,
        Metadata: params.Metadata,
    }, nil
}

func (g *RazorPayGateway) CreateSubscription(ctx context.Context, params SubscriptionParams) (*Subscription, error) {
    // RazorPay subscription creation
    subscriptionData := map[string]interface{}{
        "plan_id":     params.PriceID,
        "total_count": 12, // 12 months by default, can be configurable
        "customer_notify": 1,
        "notes": params.Metadata,
    }
    
    if params.CustomerID != "" {
        subscriptionData["customer_id"] = params.CustomerID
    }
    
    subscription, err := g.client.Subscription.Create(subscriptionData, nil)
    if err != nil {
        return nil, fmt.Errorf("failed to create subscription: %v", err)
    }
    
    subscriptionID, _ := subscription["id"].(string)
    subscriptionStatus, _ := subscription["status"].(string)
    currentStart, _ := subscription["current_start"].(json.Number).Int64()
    currentEnd, _ := subscription["current_end"].(json.Number).Int64()
    
    return &Subscription{
        ID:                     subscriptionID,
        Status:                 subscriptionStatus,
        CurrentPeriodStart:     time.Unix(currentStart, 0),
        CurrentPeriodEnd:       time.Unix(currentEnd, 0),
        LatestInvoicePaymentID: "", // Will be populated from webhook
    }, nil
}

func (g *RazorPayGateway) VerifyWebhookSignature(ctx context.Context, payload []byte, signature string) (bool, error) {
    // RazorPay webhook signature verification
    expectedSignature := hmac.New(sha256.New, []byte(g.webhookSecret))
    expectedSignature.Write(payload)
    expectedSig := hex.EncodeToString(expectedSignature.Sum(nil))
    
    return hmac.Equal([]byte(signature), []byte(expectedSig)), nil
}

func (g *RazorPayGateway) ParseWebhookEvent(ctx context.Context, payload []byte) (*WebhookEvent, error) {
    var data map[string]interface{}
    if err := json.Unmarshal(payload, &data); err != nil {
        return nil, err
    }
    
    eventType, _ := data["event"].(string)
    
    // Extract relevant data based on event type
    var paymentID, orderID, subscriptionID string
    
    if payloadObj, ok := data["payload"].(map[string]interface{}); ok {
        if paymentObj, ok := payloadObj["payment"].(map[string]interface{}); ok {
            paymentID, _ = paymentObj["entity"].(map[string]interface{})["id"].(string)
            orderID, _ = paymentObj["entity"].(map[string]interface{})["order_id"].(string)
        }
        if subscriptionObj, ok := payloadObj["subscription"].(map[string]interface{}); ok {
            subscriptionID, _ = subscriptionObj["entity"].(map[string]interface{})["id"].(string)
        }
    }
    
    return &WebhookEvent{
        Type:           eventType,
        Gateway:        "razorpay",
        PaymentID:      paymentID,
        OrderID:        orderID,
        SubscriptionID: subscriptionID,
        Data:           data,
        CreatedAt:      time.Now(),
    }, nil
}

func (g *RazorPayGateway) CreatePayout(ctx context.Context, params PayoutParams) (*Payout, error) {
    // RazorPay supports payouts to bank accounts, UPI, etc.
    // This is a simplified implementation
    
    // For bank transfers
    if params.Method == "bank_transfer" {
        payoutData := map[string]interface{}{
            "account_number": params.Recipient.ID, // Bank account number
            "fund_account_id": params.Recipient.ID, // RazorPay fund account ID
            "amount":         params.Amount,
            "currency":       params.Currency,
            "mode":           "IMPS", // NEFT, RTGS, IMPS
            "purpose":        "payout",
            "notes": map[string]interface{}{
                "recipient_name": params.Recipient.Name,
                "recipient_type": params.Recipient.Type,
            },
        }
        
        payout, err := g.client.Payout.Create(payoutData, nil)
        if err != nil {
            return nil, fmt.Errorf("failed to create payout: %v", err)
        }
        
        payoutID, _ := payout["id"].(string)
        payoutAmount, _ := payout["amount"].(json.Number).Int64()
        payoutStatus, _ := payout["status"].(string)
        
        return &Payout{
            ID:     payoutID,
            Amount: payoutAmount,
            Status: payoutStatus,
            Method: params.Method,
        }, nil
    }
    
    return nil, fmt.Errorf("payout method %s not supported", params.Method)
}

// Helper function to get customer name from metadata
func getCustomerName(metadata map[string]string) string {
    if name, ok := metadata["customer_name"]; ok {
        return name
    }
    return "Customer"
}