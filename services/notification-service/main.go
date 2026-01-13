package main

import (
    "context"
    "encoding/json"
    "log"
    "os"
    "os/signal"
    "syscall"
    "time"
    
    amqp "github.com/rabbitmq/amqp091-go"
    "gorm.io/driver/postgres"
    "gorm.io/gorm"
    
    "./config"
    "./models"
    "./services"
)

func main() {
    // Load configuration
    config.LoadConfig()
    
    // Connect to database
    db, err := gorm.Open(postgres.Open(config.AppConfig.DatabaseURL), &gorm.Config{})
    if err != nil {
        log.Fatal("Failed to connect to database:", err)
    }
    
    // Auto migrate
    db.AutoMigrate(&models.Notification{}, &models.NotificationTemplate{}, &models.UserNotificationPreferences{})
    
    // Connect to RabbitMQ
    conn, err := amqp.Dial(config.AppConfig.RabbitMQURL)
    if err != nil {
        log.Fatal("Failed to connect to RabbitMQ:", err)
    }
    defer conn.Close()
    
    ch, err := conn.Channel()
    if err != nil {
        log.Fatal("Failed to open a channel:", err)
    }
    defer ch.Close()
    
    // Declare exchange and queues
    err = ch.ExchangeDeclare(
        "notifications", // name
        "topic",         // type
        true,            // durable
        false,           // auto-deleted
        false,           // internal
        false,           // no-wait
        nil,             // arguments
    )
    if err != nil {
        log.Fatal("Failed to declare exchange:", err)
    }
    
    // Declare queues for different notification types
    queues := []string{"email", "sms", "push", "whatsapp", "in_app"}
    for _, queue := range queues {
        _, err = ch.QueueDeclare(
            "notifications."+queue,
            true,  // durable
            false, // delete when unused
            false, // exclusive
            false, // no-wait
            nil,   // arguments
        )
        if err != nil {
            log.Fatal("Failed to declare queue:", err)
        }
        
        // Bind queue to exchange
        err = ch.QueueBind(
            "notifications."+queue,
            "notification."+queue,
            "notifications",
            false,
            nil,
        )
        if err != nil {
            log.Fatal("Failed to bind queue:", err)
        }
    }
    
    // Create notification sender
    sender := services.NewNotificationSender(db)
    
    // Start consumers for each queue
    for _, queue := range queues {
        go startConsumer(ch, queue, sender, db)
    }
    
    // Start HTTP server for API
    go startHTTPServer(db)
    
    log.Println("Notification service started. Waiting for messages...")
    
    // Wait for termination signal
    sigChan := make(chan os.Signal, 1)
    signal.Notify(sigChan, syscall.SIGINT, syscall.SIGTERM)
    <-sigChan
    
    log.Println("Shutting down notification service...")
}

func startConsumer(ch *amqp.Channel, queueName string, sender *services.NotificationSender, db *gorm.DB) {
    msgs, err := ch.Consume(
        "notifications."+queueName,
        "",    // consumer
        false, // auto-ack
        false, // exclusive
        false, // no-local
        false, // no-wait
        nil,   // args
    )
    if err != nil {
        log.Fatal("Failed to register consumer:", err)
    }
    
    for msg := range msgs {
        log.Printf("Received %s notification: %s", queueName, msg.Body)
        
        var notification models.Notification
        if err := json.Unmarshal(msg.Body, &notification); err != nil {
            log.Printf("Failed to unmarshal notification: %v", err)
            msg.Nack(false, false) // Don't requeue
            continue
        }
        
        // Process notification
        if err := sender.ProcessNotification(&notification); err != nil {
            log.Printf("Failed to process notification: %v", err)
            // Retry logic
            if notification.RetryCount < 3 {
                notification.RetryCount++
                notification.LastRetryAt = &time.Time{}
                *notification.LastRetryAt = time.Now()
                db.Save(&notification)
                
                // Requeue with delay
                time.Sleep(time.Duration(notification.RetryCount) * time.Minute)
                msg.Nack(false, true)
            } else {
                msg.Nack(false, false)
            }
        } else {
            msg.Ack(false)
        }
    }
}

func startHTTPServer(db *gorm.DB) {
    // HTTP server implementation
    // This would handle API endpoints for template management, preferences, etc.
}