package handlers

import (
    "net/http"
    "github.com/gin-gonic/gin"
    "github.com/stripe/stripe-go/v76"
    "github.com/stripe/stripe-go/v76/refund"
    "gorm.io/gorm"
)

type RefundRequest struct {
    PaymentID string `json:"payment_id" binding:"required"`
    Amount    int64  `json:"amount"`
    Reason    string `json:"reason"`
}

func CreateRefund(c *gin.Context) {
    var req RefundRequest
    if err := c.ShouldBindJSON(&req); err != nil {
        c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
        return
    }

    // Get payment from database
    db := c.MustGet("db").(*gorm.DB)
    var payment Payment
    if err := db.Where("id = ?", req.PaymentID).First(&payment).Error; err != nil {
        c.JSON(http.StatusNotFound, gin.H{"error": "Payment not found"})
        return
    }

    // Create Stripe refund
    params := &stripe.RefundParams{
        PaymentIntent: stripe.String(payment.PaymentIntentID),
    }
    if req.Amount > 0 {
        params.Amount = stripe.Int64(req.Amount)
    }
    if req.Reason != "" {
        params.Reason = stripe.String(req.Reason)
    }

    r, err := refund.New(params)
    if err != nil {
        c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
        return
    }

    // Save refund to database
    refundRecord := Refund{
        ID:         generateID(),
        PaymentID:  payment.ID,
        Amount:     r.Amount,
        Status:     string(r.Status),
        RefundID:   r.ID,
    }
    db.Create(&refundRecord)

    // Update payment status
    payment.Status = "refunded"
    payment.RefundedAt = time.Now()
    db.Save(&payment)

    c.JSON(http.StatusOK, gin.H{
        "refund_id": refundRecord.ID,
        "status":    refundRecord.Status,
        "amount":    refundRecord.Amount,
    })
}