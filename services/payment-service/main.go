package main

import (
	"context"
	"log"
	"net/http"
	"os"
	"time"

	"github.com/gin-gonic/gin"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"

	"payment-service/gdpr"
	"payment-service/handlers"
	"payment-service/models"
	"payment-service/services/gateway"
	"payment-service/validation"
)

func main() {
	// Initialize database
	dsn := os.Getenv("DATABASE_URL")
	db, err := gorm.Open(postgres.Open(dsn), &gorm.Config{})
	if err != nil {
		log.Fatal("Failed to connect to database:", err)
	}

	// Auto-migrate models
	db.AutoMigrate(
		&models.Payment{},
		&models.Subscription{},
		&models.Customer{},
		&models.Refund{},
		&models.Invoice{},
		&models.GDPRConsent{},
		&models.GDPRRequest{},
		&models.DataBreach{},
		&models.RetentionPolicy{},
	)

	// Initialize payment service
	paymentService := handlers.NewPaymentService(db)

	// Initialize gateways
	// Stripe
	stripeGateway := gateway.NewStripeGateway(
		os.Getenv("STRIPE_SECRET_KEY"),
		os.Getenv("STRIPE_WEBHOOK_SECRET"),
		os.Getenv("STRIPE_PUBLISHABLE_KEY"),
	)
	paymentService.gateways["stripe"] = stripeGateway

	// PayPal
	paypalGateway := gateway.NewPayPalGateway(
		os.Getenv("PAYPAL_CLIENT_ID"),
		os.Getenv("PAYPAL_SECRET"),
		os.Getenv("PAYPAL_SANDBOX") == "true",
	)
	paymentService.gateways["paypal"] = paypalGateway

	// RazorPay (you would need to implement this)
	// razorpayGateway := gateway.NewRazorPayGateway(...)
	// paymentService.gateways["razorpay"] = razorpayGateway

	// Mock gateway for testing
	if os.Getenv("ENV") == "test" {
		mockGateway := gateway.NewMockGateway()
		paymentService.gateways["mock"] = mockGateway
	}

	// Initialize clients for services
	bookingClient := handlers.NewBookingServiceClient(os.Getenv("BOOKING_SERVICE_URL"))
	ecommerceClient := handlers.NewEcommerceServiceClient(os.Getenv("ECOMMERCE_SERVICE_URL"))
	notificationClient := handlers.NewNotificationServiceClient(os.Getenv("NOTIFICATION_SERVICE_URL"))

	// Initialize unified validator
	unifiedValidator := validation.NewUnifiedPaymentValidator(db)
	validationHandler := handlers.NewValidationHandler(unifiedValidator)

	// Initialize integration handler
	integrationHandler := handlers.NewIntegrationHandler(
		db,
		paymentService,
		paymentService.gateways,
		bookingClient,
		ecommerceClient,
		notificationClient,
		unifiedValidator,
	)

	// Initialize GDPR services
	dpoService := gdpr.NewDataProtectionOfficer(db)
	consentManager := gdpr.NewConsentManager(db)
	privacyDesign := gdpr.NewDataProtectionByDesign(db)
	breachManager := gdpr.NewBreachNotificationManager(db)

	// Initialize GDPR handler
	gdprHandler := handlers.NewGDPRHandler(dpoService, consentManager, privacyDesign, breachManager)

	// Initialize router
	r := gin.Default()

	// Health check route
	r.GET("/health", healthCheck)

	// Payment routes
	r.POST("/payments", paymentService.CreatePayment)
	r.GET("/payments/:id", paymentService.GetPayment)
	r.POST("/payments/:id/capture", paymentService.CapturePayment)
	r.POST("/payments/refund", paymentService.CreateRefund)

	// Subscription routes
	r.POST("/subscriptions", paymentService.CreateSubscription)
	r.POST("/subscriptions/:id/cancel", paymentService.CancelSubscription)

	// Webhook routes (one per gateway)
	r.POST("/webhook/stripe", paymentService.HandleWebhook("stripe"))
	r.POST("/webhook/paypal", paymentService.HandleWebhook("paypal"))
	r.POST("/webhook/razorpay", paymentService.HandleWebhook("razorpay"))

	// Validation routes
	r.POST("/validate/payment", validationHandler.ValidatePayment)
	r.GET("/validate/:id", validationHandler.GetValidation)
	r.POST("/validate/:id/use", validationHandler.UseValidation)
	r.GET("/validate/currency/:currency", validationHandler.ValidateCurrency)
	r.GET("/currencies", validationHandler.GetSupportedCurrencies)

	// Integration routes
	r.POST("/integrations/payment", integrationHandler.HandleServicePayment)
	r.POST("/integrations/validate", integrationHandler.ValidateServicePayment)
	r.POST("/integrations/webhook/:service_type", integrationHandler.ServiceWebhookCallback)
	r.GET("/integrations/payments/:service_type/:service_id", integrationHandler.GetServicePayments)

	// Service-specific validation endpoints
	r.POST("/integrations/booking/:booking_id/verify", paymentService.VerifyBookingPayment)
	r.POST("/integrations/ecommerce/:order_id/verify", paymentService.VerifyEcommercePayment)

	// GDPR Public Endpoints (for data subjects)
	r.GET("/gdpr/privacy-policy", gdprHandler.GetPrivacyPolicy)
	r.GET("/gdpr/consent/:user_id", gdprHandler.GetConsentPreferences)
	r.POST("/gdpr/consent", gdprHandler.UpdateConsent)
	r.POST("/gdpr/request", gdprHandler.HandleDataSubjectRequest)
	r.GET("/gdpr/rights", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{
			"rights": []string{
				"Right to access",
				"Right to rectification",
				"Right to erasure",
				"Right to restriction",
				"Right to data portability",
				"Right to object",
				"Right to withdraw consent",
			},
			"contact":       "gdpr@yogaspa.com",
			"response_time": "30 days",
		})
	})

	// GDPR Admin Endpoints (protected)
	admin := r.Group("/admin/gdpr")
	// Note: You'll need to implement or import your authMiddleware
	// admin.Use(authMiddleware) // Require admin authentication
	{
		admin.GET("/ropa", gdprHandler.GetROPA)
		admin.POST("/breach", gdprHandler.ReportDataBreach)
		admin.POST("/cleanup", gdprHandler.RunDataCleanup)
		admin.GET("/compliance", func(c *gin.Context) {
			c.JSON(http.StatusOK, gin.H{
				"status":      "compliant",
				"last_audit":  "2024-01-15",
				"next_audit":  "2024-04-15",
				"dpo_contact": "dpo@yogaspa.com",
			})
		})
	}

	// Initialize default GDPR data in background
	go func() {
		// Wait a moment for the server to start
		time.Sleep(2 * time.Second)
		
		// Initialize default consents
		if err := consentManager.InitializeDefaultConsents(); err != nil {
			log.Printf("Error initializing default consents: %v", err)
		}
		
		// Initialize retention policies
		if err := privacyDesign.InitializeRetentionPolicies(); err != nil {
			log.Printf("Error initializing retention policies: %v", err)
		}
		
		log.Println("GDPR default data initialized")
	}()

	// Run regular GDPR cleanup in background
	go func() {
		ticker := time.NewTicker(24 * time.Hour)
		defer ticker.Stop()
		
		for range ticker.C {
			ctx := context.Background()
			if err := privacyDesign.CleanExpiredData(ctx); err != nil {
				log.Printf("Error cleaning expired data: %v", err)
			}
			log.Println("GDPR data cleanup completed")
		}
	}()

	// Start server
	port := os.Getenv("PORT")
	if port == "" {
		port = "3006"
	}

	log.Printf("Payment service starting on port %s", port)
	log.Printf("Available gateways: %v", getGatewayNames(paymentService.gateways))
	log.Printf("GDPR features enabled")

	if err := r.Run(":" + port); err != nil {
		log.Fatal(err)
	}
}

func getGatewayNames(gateways map[string]gateway.PaymentGateway) []string {
	names := make([]string, 0, len(gateways))
	for name := range gateways {
		names = append(names, name)
	}
	return names
}

func healthCheck(c *gin.Context) {
	c.JSON(200, gin.H{
		"status":  "healthy",
		"service": "payment-service",
		"version": "1.0.0",
	})
}