#!/bin/bash
# setup-complete-platform.sh

echo "🚀 Setting up Complete Yoga Spa Platform"
echo "========================================="

# Create all required services
services=(
  "user-service"
  "yoga-service" 
  "booking-service"
  "payment-service"
  "content-service"
  "notification-service"
  "ecommerce-service"
  "live-stream-service"
  "video-library-service"
  "staff-service"
  "i18n-service"
  "analytics-service"
)

# Create each service
for service in "${services[@]}"; do
  if [ ! -d "services/$service" ]; then
    echo "Creating $service..."
    ./scripts/add-service.sh $service
    
    # Special configurations
    case $service in
      "payment-service")
        # Go service setup
        rm services/payment-service/package.json
        mkdir -p services/payment-service/src/{handlers,models,services}
        ;;
      "video-library-service")
        # Python service setup
        rm services/video-library-service/package.json
        mkdir -p services/video-library-service/src/{api,services,models}
        ;;
    esac
  fi
done

# Update environment variables
cat >> .env.example << 'EOF'

# New Services Ports
ECOMMERCE_SERVICE_PORT=3010
LIVE_STREAM_SERVICE_PORT=3011
VIDEO_LIBRARY_SERVICE_PORT=3014
STAFF_SERVICE_PORT=3015
I18N_SERVICE_PORT=3016

# Database Names
ECOMMERCE_DB_NAME=ecommerce_db
STAFF_DB_NAME=staff_db
I18N_DB_NAME=i18n_db
VIDEO_DB_NAME=video_db

# Third-party APIs
MINIO_ACCESS_KEY=minioadmin
MINIO_SECRET_KEY=minioadmin
CALENDAR_API_KEY=your_calendar_api_key
GOOGLE_TRANSLATE_API_KEY=your_google_translate_key
DEEP_L_API_KEY=your_deepl_key
# STRIPE_SECRET_KEY=# sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
SENDGRID_API_KEY=your_sendgrid_key
TWILIO_ACCOUNT_SID=your_twilio_sid
TWILIO_AUTH_TOKEN=your_twilio_token
TWILIO_PHONE_NUMBER=+1234567890
AWS_ACCESS_KEY=your_aws_key
AWS_SECRET_KEY=your_aws_secret
S3_BUCKET=your-s3-bucket
EOF

echo "✅ All services created!"
echo ""
echo "📋 Next Steps:"
echo "1. Update .env file with your API keys"
echo "2. Run: docker-compose up -d"
echo "3. Run database migrations for each service"
echo "4. Access frontend at: http://localhost:3000"
echo ""
echo "🎯 Available Ports:"
echo "  Frontend: 3000"
echo "  API Gateway: 3000/api"
echo "  User Service: 3001"
echo "  Yoga Service: 3003"
echo "  Booking Service: 3002"
echo "  Payment Service: 3004"
echo "  E-commerce: 3010"
echo "  Live Stream: 3011"
echo "  Video Library: 3014"
echo "  Staff Service: 3015"
echo "  i18n Service: 3016"
echo "  Monitoring: 9090 (Prometheus), 3000 (Grafana)"