import httpx
import logging
from typing import Dict, Any, Optional
from datetime import datetime

logger = logging.getLogger(__name__)

class BookingAgent:
    def __init__(self):
        self.booking_service_url = "http://booking-service:3002"
        
    async def process_booking_request(self, command: str, details: Dict[str, Any]) -> Dict[str, Any]:
        """Process booking-related commands"""
        try:
            logger.info(f"Processing booking request: {command}")
            
            # Extract booking details from command
            booking_data = self._parse_booking_command(command, details)
            
            # Create booking via booking service
            async with httpx.AsyncClient() as client:
                response = await client.post(
                    f"{self.booking_service_url}/bookings",
                    json=booking_data,
                    timeout=30.0
                )
                
                if response.status_code in [200, 201]:
                    booking_result = response.json()
                    
                    return {
                        "success": True,
                        "action": "booking_created",
                        "message": f"Booking confirmed! Your {booking_data.get('serviceType', 'service')} is scheduled.",
                        "booking": booking_result,
                        "next_steps": ["view_details", "add_to_calendar", "share"]
                    }
                else:
                    logger.error(f"Booking service error: {response.status_code}")
                    return {
                        "success": False,
                        "action": "booking_failed",
                        "message": "Sorry, I couldn't create the booking. Please try again.",
                        "error": f"Service returned {response.status_code}"
                    }
                    
        except Exception as e:
            logger.error(f"Booking agent error: {e}")
            return {
                "success": False,
                "action": "error",
                "message": "An error occurred while processing your booking.",
                "error": str(e)
            }
    
    def _parse_booking_command(self, command: str, details: Dict[str, Any]) -> Dict[str, Any]:
        """Parse natural language command into booking data"""
        command_lower = command.lower()
        
        # Default booking data
        booking_data = {
            "userId": details.get("userId", "demo-user"),
            "serviceType": "yoga",
            "className": "General Class",
            "dateTime": self._get_next_available_time(),
            "participants": 1,
            "notes": f"Booked via voice command: {command}",
            "source": "voice_agent"
        }
        
        # Extract service type
        if any(word in command_lower for word in ["yoga", "class", "session"]):
            booking_data["serviceType"] = "yoga"
            booking_data["className"] = self._get_yoga_class_type(command_lower)
        
        if any(word in command_lower for word in ["spa", "massage", "treatment"]):
            booking_data["serviceType"] = "spa"
            booking_data["className"] = self._get_spa_treatment_type(command_lower)
        
        if any(word in command_lower for word in ["meditation", "mindfulness"]):
            booking_data["serviceType"] = "meditation"
            booking_data["className"] = "Guided Meditation"
        
        # Extract time preferences
        if "morning" in command_lower:
            booking_data["dateTime"] = self._get_next_morning_time()
        elif "afternoon" in command_lower:
            booking_data["dateTime"] = self._get_next_afternoon_time()
        elif "evening" in command_lower:
            booking_data["dateTime"] = self._get_next_evening_time()
        
        # Extract participants
        import re
        participant_match = re.search(r'(\d+)\s*(person|people|participant)', command_lower)
        if participant_match:
            booking_data["participants"] = int(participant_match.group(1))
        
        return booking_data
    
    def _get_yoga_class_type(self, command: str) -> str:
        """Determine yoga class type from command"""
        if "hot" in command:
            return "Hot Yoga"
        elif "vinyasa" in command or "flow" in command:
            return "Vinyasa Flow"
        elif "hatha" in command:
            return "Hatha Yoga"
        elif "yin" in command:
            return "Yin Yoga"
        elif "restorative" in command:
            return "Restorative Yoga"
        else:
            return "General Yoga"
    
    def _get_spa_treatment_type(self, command: str) -> str:
        """Determine spa treatment type from command"""
        if "massage" in command:
            if "deep" in command or "tissue" in command:
                return "Deep Tissue Massage"
            elif "swedish" in command:
                return "Swedish Massage"
            else:
                return "Therapeutic Massage"
        elif "facial" in command:
            return "Signature Facial"
        elif "body" in command or "scrub" in command:
            return "Body Treatment"
        else:
            return "Spa Package"
    
    def _get_next_available_time(self):
        """Get next available booking time"""
        from datetime import datetime, timedelta
        # Next hour rounded up
        now = datetime.utcnow()
        next_hour = now.replace(minute=0, second=0, microsecond=0) + timedelta(hours=1)
        return next_hour.isoformat() + 'Z'
    
    def _get_next_morning_time(self):
        """Get next morning slot (9 AM)"""
        from datetime import datetime, timedelta
        now = datetime.utcnow()
        tomorrow = now + timedelta(days=1)
        morning_time = tomorrow.replace(hour=9, minute=0, second=0, microsecond=0)
        return morning_time.isoformat() + 'Z'
    
    def _get_next_afternoon_time(self):
        """Get next afternoon slot (2 PM)"""
        from datetime import datetime, timedelta
        now = datetime.utcnow()
        tomorrow = now + timedelta(days=1)
        afternoon_time = tomorrow.replace(hour=14, minute=0, second=0, microsecond=0)
        return afternoon_time.isoformat() + 'Z'
    
    def _get_next_evening_time(self):
        """Get next evening slot (6 PM)"""
        from datetime import datetime, timedelta
        now = datetime.utcnow()
        tomorrow = now + timedelta(days=1)
        evening_time = tomorrow.replace(hour=18, minute=0, second=0, microsecond=0)
        return evening_time.isoformat() + 'Z'
    
    async def cancel_booking(self, booking_id: str, reason: str = None) -> Dict[str, Any]:
        """Cancel a booking"""
        try:
            async with httpx.AsyncClient() as client:
                response = await client.post(
                    f"{self.booking_service_url}/bookings/{booking_id}/cancel",
                    timeout=30.0
                )
                
                if response.status_code == 200:
                    return {
                        "success": True,
                        "message": "Booking cancelled successfully.",
                        "booking_id": booking_id
                    }
                else:
                    return {
                        "success": False,
                        "message": "Failed to cancel booking.",
                        "error": f"Status: {response.status_code}"
                    }
                    
        except Exception as e:
            logger.error(f"Cancel booking error: {e}")
            return {
                "success": False,
                "message": "Error cancelling booking.",
                "error": str(e)
            }
    
    async def get_user_bookings(self, user_id: str) -> Dict[str, Any]:
        """Get bookings for a user"""
        try:
            async with httpx.AsyncClient() as client:
                response = await client.get(
                    f"{self.booking_service_url}/bookings/user/{user_id}",
                    timeout=30.0
                )
                
                if response.status_code == 200:
                    return {
                        "success": True,
                        "bookings": response.json(),
                        "count": len(response.json())
                    }
                else:
                    return {
                        "success": False,
                        "bookings": [],
                        "error": f"Status: {response.status_code}"
                    }
                    
        except Exception as e:
            logger.error(f"Get bookings error: {e}")
            return {
                "success": False,
                "bookings": [],
                "error": str(e)
            }