from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
import logging
from dotenv import load_dotenv

from api.endpoints import router as api_router
from utils.config import settings
from utils.logging import setup_logging

# Load environment variables
load_dotenv()

# Setup logging
setup_logging()
logger = logging.getLogger(__name__)

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    logger.info("Starting Agentic AI Service...")
    yield
    # Shutdown
    logger.info("Shutting down Agentic AI Service...")

app = FastAPI(
    title="Agentic AI Service",
    description="AI agents for Yoga Spa business automation",
    version="1.0.0",
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
app.include_router(api_router, prefix="/api/v1")

@app.get("/health")
async def health_check():
    return {
        "status": "healthy",
        "service": "agentic-ai-service",
        "version": "1.0.0"
    }

@app.get("/")
async def root():
    return {
        "message": "Agentic AI Service",
        "endpoints": {
            "health": "/health",
            "docs": "/docs",
            "agents": "/api/v1/agents",
            "workflows": "/api/v1/workflows"
        }
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        app,
        host="0.0.0.0",
        port=int(settings.PORT or 8002),
        log_level="info"
    )