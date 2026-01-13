package gateway

import (
    "context"
    "encoding/json"
    "fmt"
    "net/http"
    "strings"
    "time"
)

type PayPalGateway struct {
    clientID     string
    secret       string
    baseURL      string
    accessToken  string
    tokenExpiry  time.Time
}

func NewPayPalGateway(clientID, secret string, isSandbox bool) *PayPalGateway {
    baseURL := "https://api.paypal.com"
    if isSandbox {
        baseURL = "https://api.sandbox.paypal.com"
    }
    
    return &PayPalGateway{
        clientID: clientID,
        secret:   secret,
        baseURL:  baseURL,
    }
}

func (g *PayPalGateway) Name() string {
    return "paypal"
}

func (g *PayPalGateway) IsLive() bool {
    return !strings.Contains(g.baseURL, "sandbox")
}

func (g *PayPalGateway) ensureToken(ctx context.Context) error {
    if g.accessToken != "" && time.Now().Before(g.tokenExpiry) {
        return nil
    }
    
    client := &http.Client{}
    req, err := http.NewRequest("POST", g.baseURL+"/v1/oauth2/token", strings.NewReader("grant_type=client_credentials"))
    if err != nil {
        return err
    }
    
    req.SetBasicAuth(g.clientID, g.secret)
    req.Header.Set("Content-Type", "application/x-www-form-urlencoded")
    
    resp, err := client.Do(req)
    if err != nil {
        return err
    }
    defer resp.Body.Close()
    
    var tokenResp struct {
        AccessToken string `json:"access_token"`
        ExpiresIn   int    `json:"expires_in"`
    }
    
    if err := json.NewDecoder(resp.Body).Decode(&tokenResp); err != nil {
        return err
    }
    
    g.accessToken = tokenResp.AccessToken
    g.tokenExpiry = time.Now().Add(time.Duration(tokenResp.ExpiresIn-60) * time.Second) // Subtract 60s buffer
    
    return nil
}

func (g *PayPalGateway) CreatePaymentIntent(ctx context.Context, params CreatePaymentParams) (*PaymentIntent, error) {
    if err := g.ensureToken(ctx); err != nil {
        return nil, err
    }
    
    payload := map[string]interface{}{
        "intent": "CAPTURE",
        "purchase_units": []map[string]interface{}{
            {
                "amount": map[string]interface{}{
                    "currency_code": params.Currency,
                    "value":         fmt.Sprintf("%.2f", float64(params.Amount)/100.0),
                },
                "description": params.Description,
            },
        },
        "application_context": map[string]interface{}{
            "return_url": params.ReturnURL,
            "cancel_url": params.ReturnURL + "?cancel=true",
        },
    }
    
    if params.CustomerEmail != "" {
        payload["payer"] = map[string]interface{}{
            "email_address": params.CustomerEmail,
        }
    }
    
    jsonData, _ := json.Marshal(payload)
    
    client := &http.Client{}
    req, err := http.NewRequest("POST", g.baseURL+"/v2/checkout/orders", strings.NewReader(string(jsonData)))
    if err != nil {
        return nil, err
    }
    
    req.Header.Set("Content-Type", "application/json")
    req.Header.Set("Authorization", "Bearer "+g.accessToken)
    
    resp, err := client.Do(req)
    if err != nil {
        return nil, err
    }
    defer resp.Body.Close()
    
    var orderResp struct {
        ID     string `json:"id"`
        Status string `json:"status"`
        Links  []struct {
            Href   string `json:"href"`
            Rel    string `json:"rel"`
            Method string `json:"method"`
        } `json:"links"`
    }
    
    if err := json.NewDecoder(resp.Body).Decode(&orderResp); err != nil {
        return nil, err
    }
    
    // Find approval URL
    var approvalURL string
    for _, link := range orderResp.Links {
        if link.Rel == "approve" {
            approvalURL = link.Href
            break
        }
    }
    
    return &PaymentIntent{
        ID:           orderResp.ID,
        Status:       orderResp.Status,
        Amount:       params.Amount,
        Currency:     params.Currency,
        CreatedAt:    time.Now(),
        NextAction: &NextAction{
            Type: "redirect",
            URL:  approvalURL,
        },
    }, nil
}