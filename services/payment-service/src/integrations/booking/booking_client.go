package booking

import (
    "bytes"
    "context"
    "encoding/json"
    "fmt"
    "net/http"
    "time"
    
    "payment-service/models"
)

type BookingServiceClient struct {
    baseURL    string
    httpClient *http.Client
    apiKey     string
}

func NewBookingServiceClient(baseURL, apiKey string) *BookingServiceClient {
    return &BookingServiceClient{
        baseURL: baseURL,
        httpClient: &http.Client{
            Timeout: 30 * time.Second,
        },
        apiKey: apiKey,
    }
}

// Booking represents a yoga booking
type Booking struct {
    ID               string    `json:"id"`
    UserID           string    `json:"user_id"`
    ClassID          string    `json:"class_id"`
    InstructorID     string    `json:"instructor_id"`
    StartTime        time.Time `json:"start_time"`
    EndTime          time.Time `json:"end_time"`
    Status           string    `json:"status"` // pending, confirmed, cancelled, completed
    PaymentStatus    string    `json:"payment_status"`
    Amount           int64     `json:"amount"`
    Currency         string    `json:"currency"`
    Participants     int       `json:"participants"`
    Notes            string    `json:"notes"`
    CreatedAt        time.Time `json:"created_at"`
    UpdatedAt        time.Time `json:"updated_at"`
    PaymentID        string    `json:"payment_id"`
    Metadata         map[string]interface{} `json:"metadata"`
}

// CreateBookingRequest for creating a new booking
type CreateBookingRequest struct {
    UserID       string    `json:"user_id"`
    ClassID      string    `json:"class_id"`
    SessionID    string    `json:"session_id"`
    StartTime    time.Time `json:"start_time"`
    EndTime      time.Time `json:"end_time"`
    Participants int       `json:"participants"`
    Notes        string    `json:"notes"`
    Amount       int64     `json:"amount"`
    Currency     string    `json:"currency"`
}

// UpdateBookingPaymentRequest for updating booking payment status
type UpdateBookingPaymentRequest struct {
    PaymentID     string `json:"payment_id"`
    PaymentStatus string `json:"payment_status"` // pending, processing, completed, failed, refunded
    Gateway       string `json:"gateway"`
    TransactionID string `json:"transaction_id"`
}

// GetBooking retrieves a booking by ID
func (c *BookingServiceClient) GetBooking(ctx context.Context, bookingID string) (*Booking, error) {
    req, err := http.NewRequestWithContext(ctx, "GET", 
        fmt.Sprintf("%s/bookings/%s", c.baseURL, bookingID), nil)
    if err != nil {
        return nil, err
    }
    
    req.Header.Set("Authorization", "Bearer "+c.apiKey)
    req.Header.Set("Content-Type", "application/json")
    
    resp, err := c.httpClient.Do(req)
    if err != nil {
        return nil, fmt.Errorf("failed to fetch booking: %w", err)
    }
    defer resp.Body.Close()
    
    if resp.StatusCode != http.StatusOK {
        return nil, fmt.Errorf("booking service returned status %d", resp.StatusCode)
    }
    
    var booking Booking
    if err := json.NewDecoder(resp.Body).Decode(&booking); err != nil {
        return nil, fmt.Errorf("failed to decode booking response: %w", err)
    }
    
    return &booking, nil
}

// UpdateBookingPaymentStatus updates booking with payment information
func (c *BookingServiceClient) UpdateBookingPaymentStatus(ctx context.Context, bookingID string, req UpdateBookingPaymentRequest) error {
    jsonData, err := json.Marshal(req)
    if err != nil {
        return fmt.Errorf("failed to marshal request: %w", err)
    }
    
    httpReq, err := http.NewRequestWithContext(ctx, "PATCH",
        fmt.Sprintf("%s/bookings/%s/payment", c.baseURL, bookingID),
        bytes.NewBuffer(jsonData))
    if err != nil {
        return fmt.Errorf("failed to create request: %w", err)
    }
    
    httpReq.Header.Set("Authorization", "Bearer "+c.apiKey)
    httpReq.Header.Set("Content-Type", "application/json")
    
    resp, err := c.httpClient.Do(httpReq)
    if err != nil {
        return fmt.Errorf("failed to update booking payment: %w", err)
    }
    defer resp.Body.Close()
    
    if resp.StatusCode != http.StatusOK {
        return fmt.Errorf("failed to update booking payment, status: %d", resp.StatusCode)
    }
    
    return nil
}

// ValidateBookingForPayment checks if booking can be paid for
func (c *BookingServiceClient) ValidateBookingForPayment(ctx context.Context, bookingID string, amount int64, currency string) (bool, *Booking, error) {
    booking, err := c.GetBooking(ctx, bookingID)
    if err != nil {
        return false, nil, fmt.Errorf("failed to get booking: %w", err)
    }
    
    // Check if booking exists and is in payable state
    if booking.Status != "pending" && booking.Status != "reserved" {
        return false, booking, fmt.Errorf("booking is not payable, status: %s", booking.Status)
    }
    
    // Check if booking has already been paid for
    if booking.PaymentStatus == "completed" {
        return false, booking, fmt.Errorf("booking already paid")
    }
    
    // Check if booking hasn't started
    if time.Now().After(booking.StartTime) {
        return false, booking, fmt.Errorf("booking has already started")
    }
    
    // Validate amount matches
    if booking.Amount != amount {
        return false, booking, fmt.Errorf("amount mismatch, expected: %d, got: %d", 
            booking.Amount, amount)
    }
    
    // Validate currency matches
    if booking.Currency != currency {
        return false, booking, fmt.Errorf("currency mismatch, expected: %s, got: %s", 
            booking.Currency, currency)
    }
    
    return true, booking, nil
}

// CreateBookingFromPayment creates a new booking when payment is initiated without a booking ID
func (c *BookingServiceClient) CreateBookingFromPayment(ctx context.Context, payment models.Payment) (*Booking, error) {
    // Extract booking details from payment metadata
    metadata := payment.Metadata
    
    bookingReq := CreateBookingRequest{
        UserID:       payment.UserID,
        ClassID:      metadata["class_id"].(string),
        SessionID:    metadata["session_id"].(string),
        StartTime:    time.Unix(int64(metadata["start_time"].(float64)), 0),
        EndTime:      time.Unix(int64(metadata["end_time"].(float64)), 0),
        Participants: int(metadata["participants"].(float64)),
        Notes:        metadata["notes"].(string),
        Amount:       payment.Amount,
        Currency:     payment.Currency,
    }
    
    jsonData, err := json.Marshal(bookingReq)
    if err != nil {
        return nil, fmt.Errorf("failed to marshal booking request: %w", err)
    }
    
    httpReq, err := http.NewRequestWithContext(ctx, "POST",
        fmt.Sprintf("%s/bookings", c.baseURL),
        bytes.NewBuffer(jsonData))
    if err != nil {
        return nil, fmt.Errorf("failed to create booking request: %w", err)
    }
    
    httpReq.Header.Set("Authorization", "Bearer "+c.apiKey)
    httpReq.Header.Set("Content-Type", "application/json")
    
    resp, err := c.httpClient.Do(httpReq)
    if err != nil {
        return nil, fmt.Errorf("failed to create booking: %w", err)
    }
    defer resp.Body.Close()
    
    if resp.StatusCode != http.StatusCreated {
        return nil, fmt.Errorf("failed to create booking, status: %d", resp.StatusCode)
    }
    
    var booking Booking
    if err := json.NewDecoder(resp.Body).Decode(&booking); err != nil {
        return nil, fmt.Errorf("failed to decode booking response: %w", err)
    }
    
    return &booking, nil
}

// CancelBooking cancels a booking (for refunds)
func (c *BookingServiceClient) CancelBooking(ctx context.Context, bookingID, reason string) error {
    cancelReq := map[string]string{
        "reason": reason,
    }
    
    jsonData, err := json.Marshal(cancelReq)
    if err != nil {
        return fmt.Errorf("failed to marshal cancel request: %w", err)
    }
    
    httpReq, err := http.NewRequestWithContext(ctx, "POST",
        fmt.Sprintf("%s/bookings/%s/cancel", c.baseURL, bookingID),
        bytes.NewBuffer(jsonData))
    if err != nil {
        return fmt.Errorf("failed to create cancel request: %w", err)
    }
    
    httpReq.Header.Set("Authorization", "Bearer "+c.apiKey)
    httpReq.Header.Set("Content-Type", "application/json")
    
    resp, err := c.httpClient.Do(httpReq)
    if err != nil {
        return fmt.Errorf("failed to cancel booking: %w", err)
    }
    defer resp.Body.Close()
    
    if resp.StatusCode != http.StatusOK {
        return fmt.Errorf("failed to cancel booking, status: %d", resp.StatusCode)
    }
    
    return nil
}