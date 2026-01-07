# agents/multichannel_agent.py
from twilio.rest import Client
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
import requests

class MultiChannelAgent:
    def __init__(self):
        self.twilio_client = Client(os.getenv('TWILIO_SID'), os.getenv('TWILIO_TOKEN'))
        self.smtp_server = os.getenv('SMTP_SERVER')
        
    async def send_whatsapp_message(self, to_number: str, message: str, 
                                   media_url: Optional[str] = None) -> Dict:
        """Send WhatsApp message"""
        
        try:
            if media_url:
                message = self.twilio_client.messages.create(
                    body=message,
                    media_url=[media_url],
                    from_=f'whatsapp:{os.getenv("TWILIO_WHATSAPP_NUMBER")}',
                    to=f'whatsapp:{to_number}'
                )
            else:
                message = self.twilio_client.messages.create(
                    body=message,
                    from_=f'whatsapp:{os.getenv("TWILIO_WHATSAPP_NUMBER")}',
                    to=f'whatsapp:{to_number}'
                )
            
            return {
                "success": True,
                "message_id": message.sid,
                "status": message.status
            }
        except Exception as e:
            return {
                "success": False,
                "error": str(e)
            }
    
    async def handle_whatsapp_conversation(self, message: str, 
                                          sender_number: str) -> Dict:
        """Handle incoming WhatsApp messages"""
        
        # Process message with AI
        ai_response = await self.process_with_ai(message, sender_number, "whatsapp")
        
        # Format response for WhatsApp
        formatted_response = self.format_for_whatsapp(ai_response)
        
        # Send response
        send_result = await self.send_whatsapp_message(sender_number, formatted_response)
        
        return {
            "ai_response": ai_response,
            "send_result": send_result,
            "channel": "whatsapp"
        }
    
    def format_for_whatsapp(self, ai_response: Dict) -> str:
        """Format AI response for WhatsApp"""
        
        # WhatsApp has character limits and formatting preferences
        message = ai_response.get("message", "")
        
        # Add emojis for engagement
        if "booking" in ai_response.get("intent", ""):
            message += " 📅"
        elif "confirm" in ai_response.get("intent", ""):
            message += " ✅"
        elif "thank" in ai_response.get("intent", ""):
            message += " 🙏"
        
        # Add quick reply buttons if supported
        if ai_response.get("options"):
            message += "\n\n"
            for i, option in enumerate(ai_response["options"][:3], 1):
                message += f"{i}. {option}\n"
            message += "\nReply with the number of your choice."
        
        return message[:1600]  # WhatsApp limit
    
    async def send_personalized_email(self, to_email: str, template: str, 
                                     personalization: Dict) -> Dict:
        """Send personalized email"""
        
        # Get email template
        email_content = await self.get_email_template(template)
        
        # Personalize content
        personalized_content = self.personalize_email(email_content, personalization)
        
        # Create email
        msg = MIMEMultipart('alternative')
        msg['Subject'] = personalized_content["subject"]
        msg['From'] = os.getenv('EMAIL_FROM')
        msg['To'] = to_email
        
        # Attach HTML and plain text versions
        msg.attach(MIMEText(personalized_content["text"], 'plain'))
        msg.attach(MIMEText(personalized_content["html"], 'html'))
        
        # Send email
        try:
            with smtplib.SMTP(self.smtp_server, 587) as server:
                server.starttls()
                server.login(os.getenv('EMAIL_USER'), os.getenv('EMAIL_PASS'))
                server.send_message(msg)
            
            return {"success": True, "email_sent": True}
        except Exception as e:
            return {"success": False, "error": str(e)}