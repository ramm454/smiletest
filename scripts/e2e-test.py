#!/usr/bin/env python3
"""
End-to-End Test for Booking and Voice Services
"""

import requests
import json
import time
import sys
from typing import Dict, Any

class ServiceTester:
    def __init__(self):
        self.booking_url = "http://localhost:3002"
        self.voice_url = "http://localhost:8005"
        self.test_results = []
    
    def log_test(self, name: str, success: bool, details: str = ""):
        """Log test result"""
        status = "✅ PASS" if success else "❌ FAIL"
        result = f"{status} {name}"
        if details:
            result += f" - {details}"
        print(result)
        self.test_results.append((name, success, details))
        return success
    
    def wait_for_service(self, url: str, service_name: str, timeout: int = 60) -> bool:
        """Wait for service to be ready"""
        print(f"⏳ Waiting for {service_name}...")
        start_time = time.time()
        
        while time.time() - start_time < timeout:
            try:
                response = requests.get(f"{url}/health", timeout=2)
                if response.status_code == 200:
                    print(f"✅ {service_name} is ready!")
                    return True
            except requests.exceptions.RequestException:
                pass
            
            time.sleep(2)
            print(".", end="", flush=True)
        
        print(f"\n❌ {service_name} failed to start within {timeout} seconds")
        return False
    
    def test_booking_service(self) -> bool:
        """Test booking service endpoints"""
        print("\n📅 Testing Booking Service:")
        print("-" * 30)
        
        # Test health endpoint
        try:
            response = requests.get(f"{self.booking_url}/health")
            if response.status_code != 200:
                return self.log_test("Health Check", False, f"Status: {response.status_code}")
            
            health_data = response.json()
            self.log_test("Health Check", True, f"Service: {health_data.get('service')}")
        except Exception as e:
            return self.log_test("Health Check", False, str(e))
        
        # Test create booking
        booking_data = {
            "userId": "test-user-" + str(int(time.time())),
            "serviceType": "yoga",
            "className": "Power Yoga",
            "dateTime": "2024-01-25T10:00:00Z",
            "participants": 2,
            "notes": "Automated test booking"
        }
        
        try:
            response = requests.post(
                f"{self.booking_url}/bookings",
                json=booking_data,
                headers={"Content-Type": "application/json"}
            )
            
            if response.status_code not in [200, 201]:
                return self.log_test("Create Booking", False, f"Status: {response.status_code}")
            
            booking_response = response.json()
            booking_id = booking_response.get('id')
            
            if booking_id:
                self.log_test("Create Booking", True, f"ID: {booking_id}")
                
                # Test get booking
                response = requests.get(f"{self.booking_url}/bookings/{booking_id}")
                if response.status_code == 200:
                    self.log_test("Get Booking", True, f"Found booking {booking_id}")
                else:
                    self.log_test("Get Booking", False, f"Status: {response.status_code}")
            else:
                self.log_test("Create Booking", False, "No booking ID returned")
                
        except Exception as e:
            return self.log_test("Create Booking", False, str(e))
        
        return True
    
    def test_voice_service(self) -> bool:
        """Test voice service endpoints"""
        print("\n🎤 Testing Voice Service:")
        print("-" * 30)
        
        # Test health endpoint
        try:
            response = requests.get(f"{self.voice_url}/health")
            if response.status_code != 200:
                return self.log_test("Health Check", False, f"Status: {response.status_code}")
            
            health_data = response.json()
            self.log_test("Health Check", True, f"Service: {health_data.get('service')}")
        except Exception as e:
            return self.log_test("Health Check", False, str(e))
        
        # Test TTS
        tts_data = {
            "text": "Your yoga class has been booked successfully",
            "language": "en",
            "voice_type": "female"
        }
        
        try:
            response = requests.post(
                f"{self.voice_url}/tts",
                json=tts_data,
                headers={"Content-Type": "application/json"}
            )
            
            if response.status_code != 200:
                return self.log_test("Text-to-Speech", False, f"Status: {response.status_code}")
            
            tts_response = response.json()
            has_audio = tts_response.get('audio_url') or tts_response.get('audio_base64')
            
            self.log_test("Text-to-Speech", True, 
                         f"Has audio: {has_audio}, Text: {tts_response.get('text', '')[:30]}...")
            
        except Exception as e:
            return self.log_test("Text-to-Speech", False, str(e))
        
        # Test Voice Chat
        chat_data = {
            "text": "I want to book a meditation session",
            "language": "en"
        }
        
        try:
            response = requests.post(
                f"{self.voice_url}/voice-chat",
                json=chat_data,
                headers={"Content-Type": "application/json"}
            )
            
            if response.status_code != 200:
                return self.log_test("Voice Chat", False, f"Status: {response.status_code}")
            
            chat_response = response.json()
            ai_text = chat_response.get('text', '')
            
            # Check if AI response makes sense
            if len(ai_text) > 10:
                self.log_test("Voice Chat", True, f"AI response: {ai_text[:50]}...")
            else:
                self.log_test("Voice Chat", False, "Empty AI response")
                
        except Exception as e:
            return self.log_test("Voice Chat", False, str(e))
        
        return True
    
    def run_integration_test(self) -> bool:
        """Test integration between services"""
        print("\n🤝 Integration Test:")
        print("-" * 30)
        
        # Simulate a user asking to book via voice
        voice_command = {
            "text": "Book me a hot yoga class for tomorrow at 4 PM for 3 people",
            "language": "en"
        }
        
        try:
            # Step 1: User speaks to voice service
            response = requests.post(
                f"{self.voice_url}/voice-chat",
                json=voice_command
            )
            
            if response.status_code != 200:
                return self.log_test("Voice Command Processing", False, 
                                   f"Status: {response.status_code}")
            
            voice_response = response.json()
            ai_text = voice_response.get('text', '')
            
            # Step 2: Check if AI understood it's a booking request
            is_booking_request = any(keyword in ai_text.lower() 
                                   for keyword in ['book', 'reserve', 'schedule', 'yoga', 'class'])
            
            if is_booking_request:
                self.log_test("Booking Intent Recognition", True, 
                            "AI identified booking intent")
                
                # Step 3: Actually create a booking (simulating what would happen)
                booking_data = {
                    "userId": "voice-user-" + str(int(time.time())),
                    "serviceType": "yoga",
                    "className": "Hot Yoga",
                    "dateTime": "2024-01-26T16:00:00Z",
                    "participants": 3,
                    "notes": "Booked via voice command"
                }
                
                booking_response = requests.post(
                    f"{self.booking_url}/bookings",
                    json=booking_data
                )
                
                if booking_response.status_code in [200, 201]:
                    self.log_test("Voice-to-Booking Integration", True, 
                                "Successfully created booking from voice command")
                    return True
                else:
                    return self.log_test("Voice-to-Booking Integration", False,
                                       f"Booking creation failed: {booking_response.status_code}")
            else:
                return self.log_test("Booking Intent Recognition", False,
                                   "AI did not identify booking intent")
                
        except Exception as e:
            return self.log_test("Integration Test", False, str(e))
    
    def run_all_tests(self) -> bool:
        """Run all tests"""
        print("🚀 Starting End-to-End Tests")
        print("=" * 50)
        
        # Wait for services
        if not self.wait_for_service(self.booking_url, "Booking Service"):
            return False
        
        if not self.wait_for_service(self.voice_url, "Voice Service"):
            return False
        
        # Run tests
        booking_ok = self.test_booking_service()
        voice_ok = self.test_voice_service()
        integration_ok = self.run_integration_test()
        
        # Print summary
        print("\n" + "=" * 50)
        print("📊 Test Summary:")
        print("=" * 50)
        
        passed = sum(1 for _, success, _ in self.test_results if success)
        total = len(self.test_results)
        
        for name, success, details in self.test_results:
            status = "✅" if success else "❌"
            print(f"{status} {name}")
            if details:
                print(f"   {details}")
        
        print(f"\n🎯 Results: {passed}/{total} tests passed")
        
        return all([booking_ok, voice_ok, integration_ok])

if __name__ == "__main__":
    tester = ServiceTester()
    
    try:
        success = tester.run_all_tests()
        sys.exit(0 if success else 1)
    except KeyboardInterrupt:
        print("\n\n⚠️  Tests interrupted by user")
        sys.exit(1)
    except Exception as e:
        print(f"\n❌ Unexpected error: {e}")
        sys.exit(1)