package ecommerce

import (
    "bytes"
    "context"
    "encoding/json"
    "fmt"
    "net/http"
    "time"
    
    "payment-service/models"
)

type EcommerceServiceClient struct {
    baseURL    string
    httpClient *http.Client
    apiKey     string
}

func NewEcommerceServiceClient(baseURL, apiKey string) *EcommerceServiceClient {
    return &EcommerceServiceClient{
        baseURL: baseURL,
        httpClient: &http.Client{
            Timeout: 30 * time.Second,
        },
        apiKey: apiKey,
    }
}

// Order represents an ecommerce order
type Order struct {
    ID                string                 `json:"id"`
    UserID            string                 `json:"user_id"`
    Status            string                 `json:"status"` // pending, processing, completed, cancelled, refunded
    PaymentStatus     string                 `json:"payment_status"`
    TotalAmount       int64                  `json:"total_amount"`
    Currency          string                 `json:"currency"`
    Items             []OrderItem            `json:"items"`
    ShippingAddress   map[string]interface{} `json:"shipping_address"`
    BillingAddress    map[string]interface{} `json:"billing_address"`
    ShippingMethod    string                 `json:"shipping_method"`
    ShippingCost      int64                  `json:"shipping_cost"`
    TaxAmount         int64                  `json:"tax_amount"`
    DiscountAmount    int64                  `json:"discount_amount"`
    PaymentID         string                 `json:"payment_id"`
    PaymentMethod     string                 `json:"payment_method"`
    Metadata          map[string]interface{} `json:"metadata"`
    CreatedAt         time.Time              `json:"created_at"`
    UpdatedAt         time.Time              `json:"updated_at"`
}

type OrderItem struct {
    ID           string `json:"id"`
    ProductID    string `json:"product_id"`
    ProductName  string `json:"product_name"`
    ProductType  string `json:"product_type"` // yoga_mat, blocks, clothing, accessory, digital
    Quantity     int    `json:"quantity"`
    UnitPrice    int64  `json:"unit_price"`
    TotalPrice   int64  `json:"total_price"`
    VariantID    string `json:"variant_id"`
    VariantName  string `json:"variant_name"`
}

// CreateOrderRequest for creating a new order
type CreateOrderRequest struct {
    UserID          string                 `json:"user_id"`
    Items           []OrderItem            `json:"items"`
    ShippingAddress map[string]interface{} `json:"shipping_address"`
    BillingAddress  map[string]interface{} `json:"billing_address"`
    ShippingMethod  string                 `json:"shipping_method"`
    DiscountCode    string                 `json:"discount_code"`
    Notes           string                 `json:"notes"`
}

// UpdateOrderPaymentRequest for updating order payment status
type UpdateOrderPaymentRequest struct {
    PaymentID     string `json:"payment_id"`
    PaymentStatus string `json:"payment_status"`
    Gateway       string `json:"gateway"`
    TransactionID string `json:"transaction_id"`
}

// GetOrder retrieves an order by ID
func (c *EcommerceServiceClient) GetOrder(ctx context.Context, orderID string) (*Order, error) {
    req, err := http.NewRequestWithContext(ctx, "GET", 
        fmt.Sprintf("%s/orders/%s", c.baseURL, orderID), nil)
    if err != nil {
        return nil, err
    }
    
    req.Header.Set("Authorization", "Bearer "+c.apiKey)
    req.Header.Set("Content-Type", "application/json")
    
    resp, err := c.httpClient.Do(req)
    if err != nil {
        return nil, fmt.Errorf("failed to fetch order: %w", err)
    }
    defer resp.Body.Close()
    
    if resp.StatusCode != http.StatusOK {
        return nil, fmt.Errorf("ecommerce service returned status %d", resp.StatusCode)
    }
    
    var order Order
    if err := json.NewDecoder(resp.Body).Decode(&order); err != nil {
        return nil, fmt.Errorf("failed to decode order response: %w", err)
    }
    
    return &order, nil
}

// CreateOrder creates a new order from cart/items
func (c *EcommerceServiceClient) CreateOrder(ctx context.Context, req CreateOrderRequest) (*Order, error) {
    jsonData, err := json.Marshal(req)
    if err != nil {
        return nil, fmt.Errorf("failed to marshal order request: %w", err)
    }
    
    httpReq, err := http.NewRequestWithContext(ctx, "POST",
        fmt.Sprintf("%s/orders", c.baseURL),
        bytes.NewBuffer(jsonData))
    if err != nil {
        return nil, fmt.Errorf("failed to create order request: %w", err)
    }
    
    httpReq.Header.Set("Authorization", "Bearer "+c.apiKey)
    httpReq.Header.Set("Content-Type", "application/json")
    
    resp, err := c.httpClient.Do(httpReq)
    if err != nil {
        return nil, fmt.Errorf("failed to create order: %w", err)
    }
    defer resp.Body.Close()
    
    if resp.StatusCode != http.StatusCreated {
        return nil, fmt.Errorf("failed to create order, status: %d", resp.StatusCode)
    }
    
    var order Order
    if err := json.NewDecoder(resp.Body).Decode(&order); err != nil {
        return nil, fmt.Errorf("failed to decode order response: %w", err)
    }
    
    return &order, nil
}

// UpdateOrderPaymentStatus updates order with payment information
func (c *EcommerceServiceClient) UpdateOrderPaymentStatus(ctx context.Context, orderID string, req UpdateOrderPaymentRequest) error {
    jsonData, err := json.Marshal(req)
    if err != nil {
        return fmt.Errorf("failed to marshal request: %w", err)
    }
    
    httpReq, err := http.NewRequestWithContext(ctx, "PATCH",
        fmt.Sprintf("%s/orders/%s/payment", c.baseURL, orderID),
        bytes.NewBuffer(jsonData))
    if err != nil {
        return fmt.Errorf("failed to create request: %w", err)
    }
    
    httpReq.Header.Set("Authorization", "Bearer "+c.apiKey)
    httpReq.Header.Set("Content-Type", "application/json")
    
    resp, err := c.httpClient.Do(httpReq)
    if err != nil {
        return fmt.Errorf("failed to update order payment: %w", err)
    }
    defer resp.Body.Close()
    
    if resp.StatusCode != http.StatusOK {
        return fmt.Errorf("failed to update order payment, status: %d", resp.StatusCode)
    }
    
    return nil
}

// ValidateOrderForPayment checks if order can be paid for
func (c *EcommerceServiceClient) ValidateOrderForPayment(ctx context.Context, orderID string, amount int64, currency string) (bool, *Order, error) {
    order, err := c.GetOrder(ctx, orderID)
    if err != nil {
        return false, nil, fmt.Errorf("failed to get order: %w", err)
    }
    
    // Check if order exists and is in payable state
    if order.Status != "pending" {
        return false, order, fmt.Errorf("order is not payable, status: %s", order.Status)
    }
    
    // Check if order has already been paid for
    if order.PaymentStatus == "completed" {
        return false, order, fmt.Errorf("order already paid")
    }
    
    // Validate amount matches (with tolerance for rounding)
    tolerance := int64(10) // 10 cents/paise tolerance
    amountDiff := order.TotalAmount - amount
    if amountDiff < 0 {
        amountDiff = -amountDiff
    }
    
    if amountDiff > tolerance {
        return false, order, fmt.Errorf("amount mismatch, expected: %d, got: %d, diff: %d", 
            order.TotalAmount, amount, amountDiff)
    }
    
    // Validate currency matches
    if order.Currency != currency {
        return false, order, fmt.Errorf("currency mismatch, expected: %s, got: %s", 
            order.Currency, currency)
    }
    
    return true, order, nil
}

// CreateOrderFromPayment creates a new order when payment is initiated without an order ID
func (c *EcommerceServiceClient) CreateOrderFromPayment(ctx context.Context, payment models.Payment) (*Order, error) {
    // Extract order details from payment metadata
    metadata := payment.Metadata
    
    items := make([]OrderItem, 0)
    if itemsData, ok := metadata["items"].([]interface{}); ok {
        for _, item := range itemsData {
            itemMap := item.(map[string]interface{})
            orderItem := OrderItem{
                ProductID:   itemMap["product_id"].(string),
                ProductName: itemMap["product_name"].(string),
                ProductType: itemMap["product_type"].(string),
                Quantity:    int(itemMap["quantity"].(float64)),
                UnitPrice:   int64(itemMap["unit_price"].(float64)),
                TotalPrice:  int64(itemMap["total_price"].(float64)),
            }
            items = append(items, orderItem)
        }
    }
    
    var shippingAddress map[string]interface{}
    if addr, ok := metadata["shipping_address"].(map[string]interface{}); ok {
        shippingAddress = addr
    }
    
    var billingAddress map[string]interface{}
    if addr, ok := metadata["billing_address"].(map[string]interface{}); ok {
        billingAddress = addr
    }
    
    orderReq := CreateOrderRequest{
        UserID:          payment.UserID,
        Items:           items,
        ShippingAddress: shippingAddress,
        BillingAddress:  billingAddress,
        ShippingMethod:  metadata["shipping_method"].(string),
        DiscountCode:    metadata["discount_code"].(string),
        Notes:           metadata["notes"].(string),
    }
    
    return c.CreateOrder(ctx, orderReq)
}

// FulfillOrder marks order as fulfilled/shipped
func (c *EcommerceServiceClient) FulfillOrder(ctx context.Context, orderID string, trackingNumber string) error {
    fulfillReq := map[string]string{
        "tracking_number": trackingNumber,
        "status": "fulfilled",
    }
    
    jsonData, err := json.Marshal(fulfillReq)
    if err != nil {
        return fmt.Errorf("failed to marshal fulfill request: %w", err)
    }
    
    httpReq, err := http.NewRequestWithContext(ctx, "POST",
        fmt.Sprintf("%s/orders/%s/fulfill", c.baseURL, orderID),
        bytes.NewBuffer(jsonData))
    if err != nil {
        return fmt.Errorf("failed to create fulfill request: %w", err)
    }
    
    httpReq.Header.Set("Authorization", "Bearer "+c.apiKey)
    httpReq.Header.Set("Content-Type", "application/json")
    
    resp, err := c.httpClient.Do(httpReq)
    if err != nil {
        return fmt.Errorf("failed to fulfill order: %w", err)
    }
    defer resp.Body.Close()
    
    if resp.StatusCode != http.StatusOK {
        return fmt.Errorf("failed to fulfill order, status: %d", resp.StatusCode)
    }
    
    return nil
}