#!/bin/bash

set -e

echo "🚀 Setting up Yoga Spa Platform Microservices"

# Check prerequisites
command -v docker >/dev/null 2>&1 || { echo "❌ Docker is required but not installed. Aborting." >&2; exit 1; }
command -v docker-compose >/dev/null 2>&1 || { echo "❌ Docker Compose is required but not installed. Aborting." >&2; exit 1; }

# Create environment file
if [ ! -f .env ]; then
    echo "📝 Creating .env file from template..."
    cp .env.example .env
    echo "⚠️  Please update .env file with your configuration"
    echo "   Edit .env and set your passwords, then run again"
    exit 0
else
    echo "✅ .env file exists"
fi

echo "🔍 Checking Docker configuration..."
docker version
docker-compose version

# Build services one by one to avoid Buildx issues
echo "🏗️  Building core services..."

# Build essential services first
echo "1. Building databases..."
docker-compose build postgres redis rabbitmq mongodb

echo "2. Building monitoring..."
docker-compose build prometheus grafana loki

echo "3. Building user service..."
docker-compose build user-service

echo "4. Building API gateway..."
docker-compose build api-gateway

echo "5. Building frontend..."
docker-compose build frontend

echo "6. Building other services..."
docker-compose build booking-service yoga-service payment-service notification-service

echo "🚀 Starting services..."
docker-compose up -d

echo "⏳ Waiting for services to be ready..."
sleep 10

echo "✅ Setup complete!"
echo ""
echo "📊 Services are running:"
echo "   Frontend:      http://localhost:80"
echo "   API Gateway:   http://localhost:3000/api"
echo "   Grafana:       http://localhost:3001 (admin/admin)"
echo "   Prometheus:    http://localhost:9090"
echo "   RabbitMQ:      http://localhost:15672"
echo "   MailHog:       http://localhost:8025"
echo ""
echo "To view logs: docker-compose logs -f"
echo "To stop: docker-compose down"