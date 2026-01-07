from fastapi import FastAPI
from pydantic import BaseModel
import os

app = FastAPI(title="LLM Service")

class TextRequest(BaseModel):
    text: str
    max_tokens: int = 500
    temperature: float = 0.7

@app.get("/health")
async def health():
    return {
        "status": "healthy", 
        "service": "llm-service",
        "model": os.getenv("LLM_MODEL", "gpt-3.5-turbo")
    }

@app.post("/generate")
async def generate(request: TextRequest):
    """Generate text using LLM"""
    # In production, integrate with OpenAI/Anthropic/Local LLM
    return {
        "text": f"Generated response for: {request.text}",
        "model": "test-llm",
        "tokens": len(request.text.split())
    }

@app.post("/embeddings")
async def embeddings(texts: list[str]):
    """Generate embeddings for texts"""
    return {
        "embeddings": [[0.1] * 384 for _ in texts],  # Mock embeddings
        "model": "text-embedding-ada-002",
        "dimensions": 384
    }