#!/bin/bash

echo "🚀 Setting up Complete Yoga Spa Platform"
echo "========================================"


# Create .env file
if [ ! -f .env ]; then
  cat > .env << 'EOF'
# Database
POSTGRES_USER=admin
POSTGRES_PASSWORD=admin123
POSTGRES_MULTIPLE_DATABASES=user_db,booking_db,yoga_db,live_db,ecommerce_db,payment_db,analytics_db,ai_db

# Redis
REDIS_PASSWORD=redis123

# RabbitMQ
RABBITMQ_USER=admin
RABBITMQ_PASSWORD=admin123

# MinIO
MINIO_ROOT_USER=admin
MINIO_ROOT_PASSWORD=admin123

# JWT
JWT_SECRET=your-super-secret-jwt-key-change-in-production

# Stripe


# SMTP
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password

# Twilio
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=xxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_PHONE_NUMBER=+1234567890

# AI
OPENAI_API_KEY=sk-xxxxxxxxxxxxxxxxxxxxxxxx
STREAM_SECRET=stream-secret-key

# Monitoring
GRAFANA_PASSWORD=admin
EOF
  echo "✅ Created .env file. Please update with your values."
fi

# Create database initialization script
cat > infrastructure/docker/databases/init-multiple-databases.sh << 'EOF'
#!/bin/bash

set -e
set -u

function create_database() {
    local database=$1
    echo "Creating database '$database'"
    psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" <<-EOSQL
        CREATE DATABASE $database;
        GRANT ALL PRIVILEGES ON DATABASE $database TO $POSTGRES_USER;
EOSQL
}

if [ -n "$POSTGRES_MULTIPLE_DATABASES" ]; then
    echo "Creating multiple databases: $POSTGRES_MULTIPLE_DATABASES"
    for db in $(echo $POSTGRES_MULTIPLE_DATABASES | tr ',' ' '); do
        create_database $db
    done
    echo "Multiple databases created"
fi
EOF

chmod +x infrastructure/docker/databases/init-multiple-databases.sh

# Create Prometheus config
mkdir -p infrastructure/monitoring/prometheus
cat > infrastructure/monitoring/prometheus/prometheus.yml << 'EOF'
global:
  scrape_interval: 15s
  evaluation_interval: 15s

scrape_configs:
  - job_name: 'prometheus'
    static_configs:
      - targets: ['localhost:9090']

  - job_name: 'node-services'
    static_configs:
      - targets:
        - 'api-gateway:3000'
        - 'user-service:3001'
        - 'booking-service:3002'
        - 'yoga-service:3003'
        - 'live-service:3004'
        - 'ecommerce-service:3005'
        - 'payment-service:3006'
        - 'analytics-service:3008'

  - job_name: 'ai-services'
    static_configs:
      - targets:
        - 'ai-gateway:8001'
        - 'agentic-ai-service:8002'
        - 'llm-service:8003'
        - 'voice-service:8005'
EOF

# Create Makefile for easy commands
cat > Makefile << 'EOF'
.PHONY: help start stop build clean test db-setup db-reset logs

help:
	@echo "Available commands:"
	@echo "  make start      - Start all services"
	@echo "  make stop       - Stop all services"
	@echo "  make build      - Build all services"
	@echo "  make clean      - Remove all containers and volumes"
	@echo "  make test       - Run tests"
	@echo "  make db-setup   - Setup databases and run migrations"
	@echo "  make db-reset   - Reset all databases"
	@echo "  make logs       - View logs"
	@echo "  make ps         - Show running containers"

start:
	docker-compose up -d

stop:
	docker-compose down

restart: stop start

build:
	docker-compose build

clean:
	docker-compose down -v
	docker system prune -f

logs:
	docker-compose logs -f

ps:
	docker-compose ps

db-setup:
	@echo "Setting up databases..."
	@echo "User Service..."
	docker-compose exec user-service npx prisma migrate dev --name init
	@echo "Booking Service..."
	docker-compose exec booking-service npx prisma migrate dev --name init
	@echo "Yoga Service..."
	docker-compose exec yoga-service npx prisma migrate dev --name init
	@echo "Live Service..."
	docker-compose exec live-service npx prisma migrate dev --name init
	@echo "E-commerce Service..."
	docker-compose exec ecommerce-service npx prisma migrate dev --name init
	@echo "✅ Databases setup complete!"

db-reset:
	@echo "⚠️  Resetting all databases..."
	docker-compose down -v
	docker volume rm yoga-spa-platform_postgres_data || true
	docker-compose up -d postgres
	sleep 10
	make db-setup
	@echo "✅ Databases reset complete!"

test:
	@echo "Running tests..."
	docker-compose exec user-service npm test
	docker-compose exec booking-service npm test
	docker-compose exec yoga-service npm test

health:
	@echo "Checking service health..."
	@for service in api-gateway user-service booking-service yoga-service live-service ecommerce-service; do \
		echo "Checking $$service..."; \
		curl -s http://localhost:$$(docker-compose port $$service 3000 | cut -d: -f2)/health || echo "$$service: ❌"; \
	done

deploy-local:
	@echo "Deploying locally..."
	./infrastructure/scripts/deploy-local.sh
EOF

echo "✅ Setup complete!"
echo ""
echo "Next steps:"
echo "1. Update .env file with your actual values"
echo "2. Run: make build"
echo "3. Run: make start"
echo "4. Run: make db-setup"
echo ""
echo "Access URLs:"
echo "  Frontend:        http://localhost"
echo "  API Gateway:     http://localhost:3000/api"
echo "  Grafana:         http://localhost:3001 (admin/admin)"
echo "  RabbitMQ:        http://localhost:15672 (admin/admin123)"
echo "  MinIO:           http://localhost:9001 (admin/admin123)"
echo "  Prometheus:      http://localhost:9090"
