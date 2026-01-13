package services

import (
    "context"
    "encoding/json"
    "fmt"
    "net/http"
    "time"
)

type BookingServiceClient struct {
    baseURL string
    client  *http.Client
}

func NewBookingServiceClient(baseURL string) *BookingServiceClient {
    return &BookingServiceClient{
        baseURL: baseURL,
        client: &http.Client{
            Timeout: 10 * time.Second,
        },
    }
}

type Booking struct {
    ID           string    `json:"id"`
    UserID       string    `json:"user_id"`
    ClassID      string    `json:"class_id"`
    SessionID    string    `json:"session_id"`
    Type         string    `json:"type"`
    Status       string    `json:"status"`
    Amount       int64     `json:"amount"`
    Currency     string    `json:"currency"`
    Participants int       `json:"participants"`
    StartTime    time.Time `json:"start_time"`
    EndTime      time.Time `json:"end_time"`
}

type UpdateBookingStatusRequest struct {
    Status    string `json:"status"`
    PaymentID string `json:"payment_id"`
}

func (c *BookingServiceClient) GetBooking(ctx context.Context, bookingID string) (*Booking, error) {
    req, err := http.NewRequestWithContext(ctx, "GET", c.baseURL+"/bookings/"+bookingID, nil)
    if err != nil {
        return nil, err
    }
    
    resp, err := c.client.Do(req)
    if err != nil {
        return nil, err
    }
    defer resp.Body.Close()
    
    if resp.StatusCode != http.StatusOK {
        return nil, fmt.Errorf("booking service returned status %d", resp.StatusCode)
    }
    
    var booking Booking
    if err := json.NewDecoder(resp.Body).Decode(&booking); err != nil {
        return nil, err
    }
    
    return &booking, nil
}

func (c *BookingServiceClient) UpdateBookingStatus(ctx context.Context, bookingID string, status string, paymentID string) error {
    payload := UpdateBookingStatusRequest{
        Status:    status,
        PaymentID: paymentID,
    }
    
    jsonData, _ := json.Marshal(payload)
    
    req, err := http.NewRequestWithContext(ctx, "PATCH", c.baseURL+"/bookings/"+bookingID+"/status", bytes.NewBuffer(jsonData))
    if err != nil {
        return err
    }
    
    req.Header.Set("Content-Type", "application/json")
    
    resp, err := c.client.Do(req)
    if err != nil {
        return err
    }
    defer resp.Body.Close()
    
    if resp.StatusCode != http.StatusOK {
        return fmt.Errorf("failed to update booking status: %d", resp.StatusCode)
    }
    
    return nil
}

func (c *BookingServiceClient) GetBookingForPayment(ctx context.Context, bookingID string) (*Booking, error) {
    // This method validates that booking exists and is payable
    booking, err := c.GetBooking(ctx, bookingID)
    if err != nil {
        return nil, err
    }
    
    // Validate booking is in a payable state
    if booking.Status != "pending" && booking.Status != "reserved" {
        return nil, fmt.Errorf("booking is not payable, current status: %s", booking.Status)
    }
    
    // Validate booking hasn't started
    if time.Now().After(booking.StartTime) {
        return nil, fmt.Errorf("booking has already started")
    }
    
    return booking, nil
}