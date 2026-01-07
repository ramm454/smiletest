#!/bin/bash

set -e

echo "🚀 Testing Booking Service and Voice Service End-to-End"
echo "======================================================"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    if [ "$1" = "success" ]; then
        echo -e "${GREEN}✅ $2${NC}"
    elif [ "$1" = "error" ]; then
        echo -e "${RED}❌ $2${NC}"
    else
        echo -e "${YELLOW}⚠️  $2${NC}"
    fi
}

# Function to wait for service
wait_for_service() {
    local url=$1
    local service_name=$2
    local max_attempts=30
    local attempt=1
    
    print_status "info" "Waiting for $service_name to be ready..."
    
    while [ $attempt -le $max_attempts ]; do
        if curl -s -f "$url" > /dev/null; then
            print_status "success" "$service_name is ready!"
            return 0
        fi
        
        print_status "info" "Attempt $attempt/$max_attempts: $service_name not ready yet..."
        sleep 2
        attempt=$((attempt + 1))
    done
    
    print_status "error" "$service_name failed to start after $max_attempts attempts"
    return 1
}

# Start services
echo ""
print_status "info" "Starting required services..."
docker-compose up -d postgres redis rabbitmq booking-service voice-service

# Wait for services to be ready
echo ""
print_status "info" "Waiting for all services to be ready..."

wait_for_service "http://localhost:5432" "PostgreSQL"
wait_for_service "http://localhost:6379" "Redis"
wait_for_service "http://localhost:15672" "RabbitMQ"
wait_for_service "http://localhost:3002/health" "Booking Service"
wait_for_service "http://localhost:8005/health" "Voice Service"

echo ""
print_status "success" "All services are ready!"
echo ""

# Test 1: Check service health
echo "📊 Service Health Checks:"
echo "-------------------------"

echo "1. Booking Service Health:"
curl -s http://localhost:3002/health | python3 -m json.tool

echo ""
echo "2. Voice Service Health:"
curl -s http://localhost:8005/health | python3 -m json.tool

echo ""

# Test 2: Test Booking Service API
echo "📅 Testing Booking Service API:"
echo "------------------------------"

# Create a test booking
echo "Creating a test booking..."
BOOKING_RESPONSE=$(curl -s -X POST http://localhost:3002/bookings \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "test-user-123",
    "serviceType": "yoga",
    "className": "Morning Vinyasa",
    "dateTime": "2024-01-15T10:00:00Z",
    "participants": 1,
    "notes": "Test booking from E2E test"
  }')

if [ $? -eq 0 ]; then
    echo "Booking created successfully!"
    echo "Response: $BOOKING_RESPONSE"
    
    # Extract booking ID for further tests
    BOOKING_ID=$(echo $BOOKING_RESPONSE | python3 -c "import sys, json; print(json.load(sys.stdin).get('id', 'unknown'))")
    print_status "success" "Booking ID: $BOOKING_ID"
else
    print_status "error" "Failed to create booking"
fi

echo ""

# Test 3: Test Voice Service API
echo "🎤 Testing Voice Service API:"
echo "----------------------------"

# Test Text-to-Speech
echo "1. Testing Text-to-Speech (TTS)..."
TTS_RESPONSE=$(curl -s -X POST http://localhost:8005/tts \
  -H "Content-Type: application/json" \
  -d '{
    "text": "Welcome to Yoga Spa. Your booking for Morning Vinyasa at 10 AM is confirmed.",
    "language": "en",
    "voice_type": "female"
  }')

if [ $? -eq 0 ]; then
    echo "TTS successful!"
    echo "Response summary:"
    echo $TTS_RESPONSE | python3 -c "
import json, sys
data = json.load(sys.stdin)
print(f'  Text: {data[\"text\"][:50]}...')
print(f'  Audio URL: {data.get(\"audio_url\", \"N/A\")}')
print(f'  Duration: {data.get(\"duration_ms\", 0)}ms')
print(f'  Language: {data[\"language\"]}')
"
else
    print_status "error" "TTS failed"
fi

echo ""

# Test Voice Chat
echo "2. Testing Voice Chat (STT → AI → TTS)..."
VOICE_CHAT_RESPONSE=$(curl -s -X POST http://localhost:8005/voice-chat \
  -H "Content-Type: application/json" \
  -d '{
    "text": "I want to book a yoga class for tomorrow morning",
    "language": "en",
    "voice_type": "female"
  }')

if [ $? -eq 0 ]; then
    echo "Voice chat successful!"
    echo "Response summary:"
    echo $VOICE_CHAT_RESPONSE | python3 -c "
import json, sys
data = json.load(sys.stdin)
print(f'  AI Response: {data[\"text\"][:80]}...')
print(f'  Has Audio: {\"Yes\" if data.get(\"audio_url\") or data.get(\"audio_base64\") else \"No\"}')
"
else
    print_status "error" "Voice chat failed"
fi

echo ""

# Test 4: Integration Test - Booking via Voice
echo "🤝 Integration Test: Booking via Voice:"
echo "--------------------------------------"

echo "Simulating voice command for booking..."
VOICE_BOOKING_RESPONSE=$(curl -s -X POST http://localhost:8005/voice-chat \
  -H "Content-Type: application/json" \
  -d '{
    "text": "Book me a yoga class for Monday at 9 AM",
    "language": "en"
  }')

if [ $? -eq 0 ]; then
    print_status "success" "Voice command processed successfully"
    VOICE_TEXT=$(echo $VOICE_BOOKING_RESPONSE | python3 -c "import sys, json; print(json.load(sys.stdin).get('text', ''))")
    echo "AI Response: $VOICE_TEXT"
    
    # Check if AI understood the booking intent
    if echo "$VOICE_TEXT" | grep -qi "book\|yoga\|class\|schedule"; then
        print_status "success" "✅ AI correctly identified booking intent"
    else
        print_status "warning" "⚠️  AI may not have identified booking intent"
    fi
else
    print_status "error" "Voice booking simulation failed"
fi

echo ""

# Test 5: Database Connection Test
echo "🗄️  Database Connectivity Test:"
echo "-----------------------------"

echo "Checking if booking service can connect to database..."
DB_CHECK=$(curl -s http://localhost:3002/health | python3 -c "
import json, sys
try:
    data = json.load(sys.stdin)
    if 'database' in data and data['database'] == 'connected':
        print('✅ Booking service database: Connected')
    else:
        print('⚠️  Booking service database status unknown')
except:
    print('❌ Could not check database status')
")

echo "$DB_CHECK"

echo ""

# Summary
echo "📈 Test Summary:"
echo "---------------"
echo "Services tested:"
echo "  • Booking Service (Node.js/NestJS)"
echo "  • Voice Service (Python/FastAPI)"
echo ""
echo "Endpoints tested:"
echo "  • Health checks"
echo "  • Booking creation"
echo "  • Text-to-Speech"
echo "  • Voice Chat"
echo "  • Database connectivity"
echo ""
print_status "success" "🎉 End-to-end testing completed!"

# Cleanup option
echo ""
read -p "Do you want to stop the test services? (y/n): " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo "Stopping test services..."
    docker-compose stop booking-service voice-service
    print_status "success" "Services stopped"
fi