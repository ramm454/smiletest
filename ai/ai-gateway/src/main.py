from fastapi import FastAPI, HTTPException
import httpx
import os

app = FastAPI(title="AI Gateway")

# Service URLs (from environment)
AI_SERVICES = {
    "agentic": os.getenv("AGENTIC_AI_URL", "http://agentic-ai-service:8002"),
    "llm": os.getenv("LLM_SERVICE_URL", "http://llm-service:8003"),
    "vector": os.getenv("VECTOR_DB_URL", "http://vector-db-service:8004"),
    "voice": os.getenv("VOICE_SERVICE_URL", "http://voice-service:8005"),
}

@app.get("/health")
async def health():
    # Check all AI services
    status = {}
    async with httpx.AsyncClient() as client:
        for name, url in AI_SERVICES.items():
            try:
                resp = await client.get(f"{url}/health", timeout=2.0)
                status[name] = {"url": url, "status": resp.status_code}
            except Exception as e:
                status[name] = {"url": url, "status": "unreachable", "error": str(e)}
    
    return {
        "service": "ai-gateway",
        "status": "healthy",
        "ai_services": status
    }

@app.post("/chat")
async def chat(message: str, context: str = None):
    """Route chat requests to appropriate AI service"""
    async with httpx.AsyncClient() as client:
        response = await client.post(
            f"{AI_SERVICES['agentic']}/api/chat",
            json={"message": message, "context": context}
        )
        return response.json()