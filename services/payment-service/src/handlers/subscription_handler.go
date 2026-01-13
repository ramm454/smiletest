package handlers

import (
    "net/http"
    "time"
    "github.com/gin-gonic/gin"
    "github.com/stripe/stripe-go/v76"
    "github.com/stripe/stripe-go/v76/customer"
    "github.com/stripe/stripe-go/v76/subscription"
    "gorm.io/gorm"
)

type CreateSubscriptionRequest struct {
    UserID    string `json:"user_id" binding:"required"`
    PlanID    string `json:"plan_id" binding:"required"`
    PriceID   string `json:"price_id" binding:"required"`
}

func CreateSubscription(c *gin.Context) {
    var req CreateSubscriptionRequest
    if err := c.ShouldBindJSON(&req); err != nil {
        c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
        return
    }

    db := c.MustGet("db").(*gorm.DB)
    
    // Get or create Stripe customer
    var stripeCustomerID string
    // Check if user already has a Stripe customer ID
    var existingSub Subscription
    if err := db.Where("user_id = ?", req.UserID).First(&existingSub).Error; err == nil {
        stripeCustomerID = existingSub.StripeCustomerID
    } else {
        // Create new Stripe customer
        params := &stripe.CustomerParams{
            Email: stripe.String(getUserEmail(req.UserID)), // You need to implement this
        }
        cust, err := customer.New(params)
        if err != nil {
            c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
            return
        }
        stripeCustomerID = cust.ID
    }

    // Create Stripe subscription
    subParams := &stripe.SubscriptionParams{
        Customer: stripe.String(stripeCustomerID),
        Items: []*stripe.SubscriptionItemsParams{
            {
                Price: stripe.String(req.PriceID),
            },
        },
    }

    sub, err := subscription.New(subParams)
    if err != nil {
        c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
        return
    }

    // Save to database
    subscriptionRecord := Subscription{
        ID:                   generateID(),
        UserID:               req.UserID,
        PlanID:               req.PlanID,
        Status:               string(sub.Status),
        Amount:               sub.Items.Data[0].Price.UnitAmount,
        Currency:             string(sub.Items.Data[0].Price.Currency),
        Interval:             string(sub.Items.Data[0].Price.Recurring.Interval),
        CurrentPeriodStart:   time.Unix(sub.CurrentPeriodStart, 0),
        CurrentPeriodEnd:     time.Unix(sub.CurrentPeriodEnd, 0),
        StripeSubscriptionID: sub.ID,
        StripeCustomerID:     stripeCustomerID,
    }
    db.Create(&subscriptionRecord)

    c.JSON(http.StatusOK, gin.H{
        "subscription_id": subscriptionRecord.ID,
        "status":          subscriptionRecord.Status,
        "client_secret":   sub.LatestInvoice.PaymentIntent.ClientSecret,
    })
}