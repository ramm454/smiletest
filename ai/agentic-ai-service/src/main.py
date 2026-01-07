from fastapi import FastAPI
from contextlib import asynccontextmanager
import logging
from dotenv import load_dotenv

from api.voice_routes import router as voice_router
# Import other routers as needed

# Load environment
load_dotenv()

# Setup logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    logger.info("Starting Agentic AI Service...")
    # Initialize agents, models, etc.
    yield
    # Shutdown
    logger.info("Shutting down Agentic AI Service...")

app = FastAPI(
    title="Agentic AI Service",
    description="Autonomous AI agents for Yoga Spa",
    version="1.0.0",
    lifespan=lifespan
)

# Include routers
app.include_router(voice_router)

@app.get("/health")
async def health():
    return {
        "status": "healthy",
        "service": "agentic-ai-service",
        "agents": ["voice", "booking", "pricing", "support", "coach"],
        "timestamp": datetime.utcnow().isoformat()
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8002)