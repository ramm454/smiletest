.PHONY: help start stop build logs clean test setup ps restart

help:
	@echo "Available commands:"
	@echo "  make setup     - Setup environment"
	@echo "  make start     - Start all services"
	@echo "  make stop      - Stop all services"
	@echo "  make build     - Build all services"
	@echo "  make logs      - Show logs"
	@echo "  make clean     - Clean everything"
	@echo "  make ps        - Show running containers"
	@echo "  make restart   - Restart services"

setup:
	@echo "Setting up Yoga Spa Platform..."
	@if [ ! -f .env ]; then \
		cp .env.example .env; \
		echo "Created .env file. Please edit it with your configuration."; \
	fi
	@echo "✅ Setup complete! Edit .env file if needed."

start:
	docker-compose up -d
	@echo "✅ Services started!"
	@echo "Frontend: http://localhost:80"
	@echo "API Gateway: http://localhost:3000/api"

stop:
	docker-compose down
	@echo "✅ Services stopped!"

build:
	docker-compose build --no-cache
	@echo "✅ Services built!"

logs:
	docker-compose logs -f

clean:
	docker-compose down -v --remove-orphans
	docker system prune -f
	@echo "✅ Cleaned everything!"

ps:
	docker-compose ps

restart: stop start

health:
	@echo "Checking service health..."
	@curl -f http://localhost:3000/api/health || echo "API Gateway not responding"
	@curl -f http://localhost:3001/api/users/health || echo "User service not responding"
	@echo "✅ Health check complete!"

test-setup:
	@echo "Testing Docker setup..."
	@docker run hello-world
	@echo "✅ Docker is working!"