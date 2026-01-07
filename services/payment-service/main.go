package main

import (
	"log"
	"net/http"
	"os"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/joho/godotenv"
	"github.com/stripe/stripe-go/v76"
	"github.com/stripe/stripe-go/v76/paymentintent"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"
)

type PaymentRequest struct {
	Amount      int64  `json:"amount" binding:"required"`
	Currency    string `json:"currency" binding:"required"`
	Description string `json:"description" binding:"required"`
	CustomerID  string `json:"customer_id" binding:"required"`
	ClassID     string `json:"class_id" binding:"required"`
}

type Payment struct {
	gorm.Model
	PaymentIntentID string    `json:"payment_intent_id"`
	Amount          int64     `json:"amount"`
	Currency        string    `json:"currency"`
	Status          string    `json:"status"`
	CustomerID      string    `json:"customer_id"`
	ClassID         string    `json:"class_id"`
	Description     string    `json:"description"`
	PaidAt          time.Time `json:"paid_at"`
}

var db *gorm.DB

func init() {
	// Load environment variables
	if err := godotenv.Load(); err != nil {
		log.Println("No .env file found")
	}

	// Initialize Stripe
	stripe.Key = os.Getenv("STRIPE_SECRET_KEY")

	// Initialize Database
	dsn := os.Getenv("DATABASE_URL")
	var err error
	db, err = gorm.Open(postgres.Open(dsn), &gorm.Config{})
	if err != nil {
		log.Fatal("Failed to connect to database:", err)
	}

	// Auto migrate
	db.AutoMigrate(&Payment{})
}

func main() {
	r := gin.Default()

	// Health check
	r.GET("/health", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{
			"status":    "healthy",
			"service":   "payment-service",
			"timestamp": time.Now().UTC(),
		})
	})

	// Create payment intent
	r.POST("/payments/create", createPaymentIntent)
	
	// Webhook handler for Stripe
	r.POST("/webhook/stripe", handleStripeWebhook)

	// Get payment by ID
	r.GET("/payments/:id", getPayment)

	// List payments by customer
	r.GET("/payments/customer/:customer_id", listCustomerPayments)

	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	log.Printf("Payment service starting on port %s", port)
	if err := r.Run(":" + port); err != nil {
		log.Fatal(err)
	}
}

func createPaymentIntent(c *gin.Context) {
	var req PaymentRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Create Stripe Payment Intent
	params := &stripe.PaymentIntentParams{
		Amount:   stripe.Int64(req.Amount),
		Currency: stripe.String(req.Currency),
		Description: stripe.String(req.Description),
		Customer: stripe.String(req.CustomerID),
	}

	pi, err := paymentintent.New(params)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	// Save payment record
	payment := Payment{
		PaymentIntentID: pi.ID,
		Amount:          req.Amount,
		Currency:        req.currency,
		Status:          string(pi.Status),
		CustomerID:      req.CustomerID,
		ClassID:         req.ClassID,
		Description:     req.Description,
	}

	if err := db.Create(&payment).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to save payment record"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"client_secret": pi.ClientSecret,
		"payment_id":    payment.ID,
		"status":        pi.Status,
	})
}

func handleStripeWebhook(c *gin.Context) {
	// Implement Stripe webhook handler
	// Verify signature and update payment status
}

func getPayment(c *gin.Context) {
	id := c.Param("id")
	var payment Payment
	
	if err := db.First(&payment, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Payment not found"})
		return
	}
	
	c.JSON(http.StatusOK, payment)
}

func listCustomerPayments(c *gin.Context) {
	customerID := c.Param("customer_id")
	var payments []Payment
	
	db.Where("customer_id = ?", customerID).Find(&payments)
	c.JSON(http.StatusOK, payments)
}