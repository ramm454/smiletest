package main

import (
	"context"
	"log"
	"os"

	amqp "github.com/rabbitmq/amqp091-go"
)

func main() {
	rabbitMQURL := os.Getenv("RABBITMQ_URL")
	if rabbitMQURL == "" {
		rabbitMQURL = "amqp://guest:guest@localhost:5672/"
	}

	conn, err := amqp.Dial(rabbitMQURL)
	if err != nil {
		log.Fatal("Failed to connect to RabbitMQ:", err)
	}
	defer conn.Close()

	ch, err := conn.Channel()
	if err != nil {
		log.Fatal("Failed to open a channel:", err)
	}
	defer ch.Close()

	q, err := ch.QueueDeclare(
		"notifications",
		true,
		false,
		false,
		false,
		nil,
	)
	if err != nil {
		log.Fatal("Failed to declare a queue:", err)
	}

	msgs, err := ch.Consume(
		q.Name,
		"",
		true,
		false,
		false,
		false,
		nil,
	)
	if err != nil {
		log.Fatal("Failed to register a consumer:", err)
	}

	log.Println("Notification service started. Waiting for messages...")

	for msg := range msgs {
		log.Printf("Received notification: %s", msg.Body)
		// Here you would send email/SMS notifications
	}
}