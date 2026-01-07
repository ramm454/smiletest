from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
import logging
from dotenv import load_dotenv
from datetime import datetime

from api.voice_routes import router as voice_router

# Load environment
load_dotenv()

# Setup logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    logger.info("Starting Voice Service...")
    logger.info(f"Start time: {datetime.utcnow().isoformat()}")
    
    # Initialize services here
    # Example: Load ML models, connect to external APIs
    
    yield
    
    # Shutdown
    logger.info("Shutting down Voice Service...")

app = FastAPI(
    title="Voice Service API",
    description="Complete voice processing service for Yoga Spa Platform",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
    lifespan=lifespan
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Configure properly in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(voice_router)

@app.get("/")
async def root():
    return {
        "service": "voice-service",
        "description": "Voice processing for Yoga Spa Platform",
        "endpoints": {
            "health": "GET /health",
            "docs": "GET /docs",
            "voice_command": "POST /api/v1/voice/command",
            "stt": "POST /api/v1/voice/stt",
            "tts": "POST /api/v1/voice/tts",
            "upload_audio": "POST /api/v1/voice/upload-audio",
            "conversation": "POST /api/v1/voice/conversation"
        },
        "timestamp": datetime.utcnow().isoformat()
    }

@app.get("/health")
async def health():
    """Health check endpoint"""
    return {
        "status": "healthy",
        "service": "voice-service",
        "timestamp": datetime.utcnow().isoformat(),
        "version": "1.0.0",
        "features": ["STT", "TTS", "Voice Agent", "Audio Processing"]
    }

if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("PORT", 8005))
    uvicorn.run(
        app,
        host="0.0.0.0",
        port=port,
        log_level="info"
    )