package config

import (
    "os"
)

type Config struct {
    RabbitMQURL        string
    DatabaseURL        string
    SendGridAPIKey     string
    TwilioAccountSID   string
    TwilioAuthToken    string
    TwilioPhoneNumber  string
    EmailFromName      string
    EmailFromAddress   string
    FirebaseProjectID  string
    Port               string
}

var AppConfig Config

func LoadConfig() {
    AppConfig = Config{
        RabbitMQURL:        getEnv("RABBITMQ_URL", "amqp://guest:guest@localhost:5672/"),
        DatabaseURL:        getEnv("DATABASE_URL", "postgres://user:password@localhost:5432/notification_db"),
        SendGridAPIKey:     getEnv("SENDGRID_API_KEY", ""),
        TwilioAccountSID:   getEnv("TWILIO_ACCOUNT_SID", ""),
        TwilioAuthToken:    getEnv("TWILIO_AUTH_TOKEN", ""),
        TwilioPhoneNumber:  getEnv("TWILIO_PHONE_NUMBER", ""),
        EmailFromName:      getEnv("EMAIL_FROM_NAME", "Yoga Spa"),
        EmailFromAddress:   getEnv("EMAIL_FROM_ADDRESS", "noreply@yogaspa.com"),
        FirebaseProjectID:  getEnv("FIREBASE_PROJECT_ID", ""),
        Port:               getEnv("PORT", "3006"),
    }
}

func getEnv(key, defaultValue string) string {
    if value := os.Getenv(key); value != "" {
        return value
    }
    return defaultValue
}