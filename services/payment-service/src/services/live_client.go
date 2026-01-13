package services

import (
    "context"
    "encoding/json"
    "fmt"
    "net/http"
    "time"
)

type LiveServiceClient struct {
    baseURL string
    client  *http.Client
}

func NewLiveServiceClient(baseURL string) *LiveServiceClient {
    return &LiveServiceClient{
        baseURL: baseURL,
        client: &http.Client{
            Timeout: 10 * time.Second,
        },
    }
}

type LiveSession struct {
    ID               string    `json:"id"`
    Title            string    `json:"title"`
    InstructorID     string    `json:"instructor_id"`
    StartTime        time.Time `json:"start_time"`
    EndTime          time.Time `json:"end_time"`
    Price            int64     `json:"price"`
    Currency         string    `json:"currency"`
    MaxParticipants  int       `json:"max_participants"`
    CurrentParticipants int    `json:"current_participants"`
    Status           string    `json:"status"`
}

type SessionAccess struct {
    SessionID   string `json:"session_id"`
    UserID      string `json:"user_id"`
    AccessToken string `json:"access_token"`
    ExpiresAt   string `json:"expires_at"`
}

func (c *LiveServiceClient) GetSession(ctx context.Context, sessionID string) (*LiveSession, error) {
    req, err := http.NewRequestWithContext(ctx, "GET", c.baseURL+"/sessions/"+sessionID, nil)
    if err != nil {
        return nil, err
    }
    
    resp, err := c.client.Do(req)
    if err != nil {
        return nil, err
    }
    defer resp.Body.Close()
    
    if resp.StatusCode != http.StatusOK {
        return nil, fmt.Errorf("live service returned status %d", resp.StatusCode)
    }
    
    var session LiveSession
    if err := json.NewDecoder(resp.Body).Decode(&session); err != nil {
        return nil, err
    }
    
    return &session, nil
}

func (c *LiveServiceClient) GrantAccess(ctx context.Context, sessionID, userID, paymentID string) (*SessionAccess, error) {
    payload := map[string]string{
        "session_id": sessionID,
        "user_id":    userID,
        "payment_id": paymentID,
    }
    
    jsonData, _ := json.Marshal(payload)
    
    req, err := http.NewRequestWithContext(ctx, "POST", c.baseURL+"/sessions/access", bytes.NewBuffer(jsonData))
    if err != nil {
        return nil, err
    }
    
    req.Header.Set("Content-Type", "application/json")
    
    resp, err := c.client.Do(req)
    if err != nil {
        return nil, err
    }
    defer resp.Body.Close()
    
    if resp.StatusCode != http.StatusOK {
        return nil, fmt.Errorf("failed to grant access: %d", resp.StatusCode)
    }
    
    var access SessionAccess
    if err := json.NewDecoder(resp.Body).Decode(&access); err != nil {
        return nil, err
    }
    
    return &access, nil
}

func (c *LiveServiceClient) ValidateSessionPayment(ctx context.Context, sessionID string, amount int64, currency string) (bool, error) {
    session, err := c.GetSession(ctx, sessionID)
    if err != nil {
        return false, err
    }
    
    // Check if session is still available
    if session.Status != "scheduled" {
        return false, fmt.Errorf("session is not available for booking")
    }
    
    // Check capacity
    if session.CurrentParticipants >= session.MaxParticipants {
        return false, fmt.Errorf("session is full")
    }
    
    // Validate amount
    if session.Price != amount {
        return false, fmt.Errorf("payment amount mismatch. expected: %d, got: %d", session.Price, amount)
    }
    
    // Validate currency
    if session.Currency != currency {
        return false, fmt.Errorf("currency mismatch. expected: %s, got: %s", session.Currency, currency)
    }
    
    return true, nil
}