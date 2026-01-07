import logging
from typing import Dict, Any, Optional
from datetime import datetime
import httpx

from ..services.stt_service import STTService
from ..services.tts_service import TTSService

logger = logging.getLogger(__name__)

class VoiceAgent:
    def __init__(self):
        self.stt_service = STTService()
        self.tts_service = TTSService()
        
        # URLs to other services (from environment)
        self.agentic_ai_url = "http://agentic-ai-service:8002"
        self.booking_service_url = "http://booking-service:3002"
    
    async def process_voice_command(self, 
                                   audio_data: Optional[str] = None,
                                   text: Optional[str] = None,
                                   language: str = "en") -> Dict[str, Any]:
        """
        Process voice command - complete pipeline
        
        1. STT (if audio provided)
        2. Intent analysis
        3. Route to appropriate service
        4. TTS response (if needed)
        """
        try:
            # Step 1: Convert speech to text if audio provided
            if audio_data:
                stt_result = await self.stt_service.transcribe(
                    audio_data=audio_data,
                    language=language,
                    provider="openai"
                )
                
                if not stt_result["success"]:
                    return {
                        "success": False,
                        "error": "STT failed",
                        "stt_error": stt_result.get("error")
                    }
                
                text = stt_result["text"]
                logger.info(f"Transcribed text: {text}")
            
            # Step 2: Analyze intent
            intent = await self._analyze_intent(text, language)
            
            # Step 3: Process based on intent
            processing_result = await self._process_intent(intent, text, language)
            
            # Step 4: Generate audio response if requested
            response_data = processing_result["response"]
            if processing_result.get("needs_audio_response", True):
                tts_result = await self.tts_service.synthesize(
                    text=response_data.get("message", "Processing complete"),
                    language=language,
                    voice="nova"
                )
                
                if tts_result["success"]:
                    response_data["audio"] = {
                        "base64": tts_result["audio_base64"],
                        "url": tts_result["audio_url"],
                        "duration_ms": tts_result["duration_ms"]
                    }
            
            return {
                "success": True,
                "input_text": text,
                "intent": intent,
                "response": response_data,
                "timestamp": datetime.utcnow().isoformat()
            }
            
        except Exception as e:
            logger.error(f"Voice processing error: {e}")
            return {
                "success": False,
                "error": str(e),
                "timestamp": datetime.utcnow().isoformat()
            }
    
    async def _analyze_intent(self, text: str, language: str) -> Dict[str, Any]:
        """Analyze user intent from text"""
        # Simple rule-based intent detection
        # In production, use NLP service
        
        text_lower = text.lower()
        
        intent_mapping = {
            "booking": ["book", "reserve", "schedule", "appointment", "register"],
            "cancellation": ["cancel", "remove", "delete", "unbook"],
            "information": ["what", "when", "where", "how", "info", "information"],
            "pricing": ["price", "cost", "how much", "fee", "charge"],
            "support": ["help", "support", "problem", "issue", "trouble"]
        }
        
        detected_intents = []
        for intent_type, keywords in intent_mapping.items():
            if any(keyword in text_lower for keyword in keywords):
                detected_intents.append({
                    "type": intent_type,
                    "confidence": 0.8,
                    "keywords": [k for k in keywords if k in text_lower]
                })
        
        # Default to conversation if no intent detected
        if not detected_intents:
            detected_intents.append({
                "type": "conversation",
                "confidence": 0.5,
                "keywords": []
            })
        
        # Return highest confidence intent
        detected_intents.sort(key=lambda x: x["confidence"], reverse=True)
        return detected_intents[0]
    
    async def _process_intent(self, intent: Dict[str, Any], text: str, language: str) -> Dict[str, Any]:
        """Process the detected intent"""
        intent_type = intent["type"]
        
        if intent_type == "booking":
            return await self._handle_booking_intent(text, language)
        elif intent_type == "cancellation":
            return await self._handle_cancellation_intent(text, language)
        elif intent_type == "pricing":
            return await self._handle_pricing_intent(text, language)
        elif intent_type == "support":
            return await self._handle_support_intent(text, language)
        else:
            return await self._handle_general_intent(text, language)
    
    async def _handle_booking_intent(self, text: str, language: str) -> Dict[str, Any]:
        """Handle booking-related voice commands"""
        try:
            # Extract booking details from text
            booking_details = self._extract_booking_details(text)
            
            # Call booking service via agentic AI
            async with httpx.AsyncClient() as client:
                response = await client.post(
                    f"{self.agentic_ai_url}/agents/booking/process",
                    json={
                        "command": text,
                        "details": booking_details,
                        "language": language
                    },
                    timeout=30.0
                )
                
                if response.status_code == 200:
                    return {
                        "response": response.json(),
                        "needs_audio_response": True
                    }
                else:
                    return {
                        "response": {
                            "message": "I had trouble connecting to the booking system. Please try again.",
                            "action": "retry"
                        },
                        "needs_audio_response": True
                    }
                    
        except Exception as e:
            logger.error(f"Booking intent error: {e}")
            return {
                "response": {
                    "message": "Sorry, I couldn't process your booking request.",
                    "action": "error"
                },
                "needs_audio_response": True
            }
    
    def _extract_booking_details(self, text: str) -> Dict[str, Any]:
        """Extract booking details from text"""
        # Simple extraction - in production use NLP
        details = {
            "service_type": "yoga",
            "time": "morning",
            "participants": 1,
            "date": "tomorrow"
        }
        
        text_lower = text.lower()
        
        if "spa" in text_lower or "massage" in text_lower:
            details["service_type"] = "spa"
        elif "meditation" in text_lower:
            details["service_type"] = "meditation"
        
        # Extract time
        time_keywords = {
            "morning": ["morning", "am", "9", "10"],
            "afternoon": ["afternoon", "pm", "2", "3", "4"],
            "evening": ["evening", "pm", "5", "6", "7"]
        }
        
        for time_slot, keywords in time_keywords.items():
            if any(keyword in text_lower for keyword in keywords):
                details["time"] = time_slot
                break
        
        return details
    
    async def _handle_cancellation_intent(self, text: str, language: str) -> Dict[str, Any]:
        """Handle cancellation requests"""
        return {
            "response": {
                "message": "I can help you cancel a booking. Please provide your booking ID or tell me which booking you'd like to cancel.",
                "action": "get_booking_id",
                "requires_followup": True
            },
            "needs_audio_response": True
        }
    
    async def _handle_pricing_intent(self, text: str, language: str) -> Dict[str, Any]:
        """Handle pricing inquiries"""
        return {
            "response": {
                "message": "Our yoga classes start at $25 per session. Spa treatments range from $80 to $150. Would you like more specific pricing?",
                "action": "provide_pricing",
                "details": {
                    "yoga": "$25-$50",
                    "spa": "$80-$150",
                    "packages": "Available"
                }
            },
            "needs_audio_response": True
        }
    
    async def _handle_support_intent(self, text: str, language: str) -> Dict[str, Any]:
        """Handle support requests"""
        return {
            "response": {
                "message": "I'm here to help! Please describe your issue or tell me what you need assistance with.",
                "action": "start_support",
                "requires_followup": True
            },
            "needs_audio_response": True
        }
    
    async def _handle_general_intent(self, text: str, language: str) -> Dict[str, Any]:
        """Handle general conversation"""
        responses = [
            "How can I help you with your yoga and spa needs today?",
            "Welcome to our wellness center! What brings you here today?",
            "I'm here to assist with bookings, pricing, and any questions you have.",
            "Feel free to ask about our classes, treatments, or membership options."
        ]
        
        import random
        return {
            "response": {
                "message": random.choice(responses),
                "action": "conversation"
            },
            "needs_audio_response": True
        }