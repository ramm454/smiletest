from fastapi import APIRouter, HTTPException, UploadFile, File, Form
from pydantic import BaseModel
from typing import Optional, List
import base64
import logging

from ..agents.voice_agent import VoiceAgent
from ..services.stt_service import STTService
from ..services.tts_service import TTSService

router = APIRouter(prefix="/api/v1/voice", tags=["Voice"])
voice_agent = VoiceAgent()
stt_service = STTService()
tts_service = TTSService()

logger = logging.getLogger(__name__)

class VoiceCommand(BaseModel):
    audio_base64: Optional[str] = None
    text: Optional[str] = None
    language: str = "en"
    session_id: Optional[str] = None

class TTSRequest(BaseModel):
    text: str
    language: str = "en"
    voice: str = "nova"
    provider: str = "openai"

class TranscriptionRequest(BaseModel):
    audio_base64: Optional[str] = None
    audio_url: Optional[str] = None
    language: str = "en"
    provider: str = "openai"

@router.post("/command")
async def process_voice_command(command: VoiceCommand):
    """
    Process voice command with full pipeline:
    STT → Intent Analysis → Action → TTS
    """
    if not command.audio_base64 and not command.text:
        raise HTTPException(status_code=400, detail="Either audio or text must be provided")
    
    try:
        result = await voice_agent.process_voice_command(
            audio_data=command.audio_base64,
            text=command.text,
            language=command.language
        )
        
        return {
            "success": result["success"],
            "data": result,
            "session_id": command.session_id
        }
        
    except Exception as e:
        logger.error(f"Voice command error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/stt")
async def speech_to_text(request: TranscriptionRequest):
    """Convert speech to text"""
    try:
        result = await stt_service.transcribe(
            audio_data=request.audio_base64,
            audio_url=request.audio_url,
            language=request.language,
            provider=request.provider
        )
        
        return result
        
    except Exception as e:
        logger.error(f"STT error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/tts")
async def text_to_speech(request: TTSRequest):
    """Convert text to speech"""
    try:
        result = await tts_service.synthesize(
            text=request.text,
            language=request.language,
            voice=request.voice,
            provider=request.provider
        )
        
        return result
        
    except Exception as e:
        logger.error(f"TTS error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/upload-audio")
async def upload_audio_file(
    file: UploadFile = File(...),
    language: str = Form("en"),
    provider: str = Form("openai")
):
    """Upload audio file for processing"""
    try:
        # Read audio file
        contents = await file.read()
        audio_base64 = base64.b64encode(contents).decode('utf-8')
        
        # Transcribe
        result = await stt_service.transcribe(
            audio_data=audio_base64,
            language=language,
            provider=provider
        )
        
        return {
            "filename": file.filename,
            "content_type": file.content_type,
            "size": len(contents),
            "transcription": result
        }
        
    except Exception as e:
        logger.error(f"Audio upload error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/conversation")
async def voice_conversation(command: VoiceCommand):
    """
    Voice conversation with context
    Maintains session state
    """
    # In production, use session_id to maintain conversation state
    # For now, process as single command
    
    result = await voice_agent.process_voice_command(
        audio_data=command.audio_base64,
        text=command.text,
        language=command.language
    )
    
    return {
        "session_id": command.session_id or "new_session",
        "response": result.get("response", {}),
        "requires_followup": result.get("response", {}).get("requires_followup", False),
        "next_expected": "user_input" if result.get("response", {}).get("requires_followup") else "done"
    }