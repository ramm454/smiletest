#!/bin/bash
# scripts/integrate-services.sh

echo "🔗 Integrating i18n Service with Existing Microservices"
echo "======================================================="

# 1. Update API Gateway
echo "1. Updating API Gateway..."
cd services/api-gateway

# Add i18n service URL to environment
cat > .env.i18n << EOF
I18N_SERVICE_URL=http://i18n-service:3000
EOF

# Merge with existing .env
cat .env .env.i18n > .env.tmp && mv .env.tmp .env

# 2. Update User Service
echo "2. Updating User Service..."
cd ../user-service

# Add i18n middleware
cp ../../templates/i18n.middleware.ts src/middleware/

# Update app module
sed -i '/imports:/a\  imports: [I18nModule],' src/app.module.ts
sed -i "/imports:/a\import { I18nModule } from './i18n/i18n.module';" src/app.module.ts

# 3. Update Booking Service
echo "3. Updating Booking Service..."
cd ../booking-service

# Similar updates as user service

# 4. Update Docker Compose
echo "4. Updating Docker Compose..."
cd ../..

# Add i18n service to docker-compose.yml
cat >> docker-compose.yml << EOF

  i18n-service:
    build:
      context: ./services/i18n-service
      dockerfile: Dockerfile.dev
    ports:
      - "3005:3000"
    environment:
      DATABASE_URL: postgresql://i18n_user:i18n_password@postgres:5432/i18n_service
      REDIS_URL: redis://redis:6379
      NODE_ENV: development
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy
    volumes:
      - ./services/i18n-service:/app
      - /app/node_modules
    networks:
      - app-network
EOF

# 5. Restart services
echo "5. Restarting services..."
docker-compose down
docker-compose up -d --build

echo "✅ Integration completed!"
echo ""
echo "📋 Next steps:"
echo "   1. Test i18n service: curl http://localhost:3005/health"
echo "   2. Test API gateway: curl http://localhost:3000/api/i18n/detect"
echo "   3. Verify language detection is working"