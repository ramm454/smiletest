from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from typing import List, Optional
from qdrant_client import QdrantClient
from qdrant_client.models import Distance, VectorParams, PointStruct
import uuid
import numpy as np

app = FastAPI(title="Vector DB Service")

# Initialize Qdrant client
client = None

class VectorPoint(BaseModel):
    id: Optional[str] = None
    vector: List[float]
    payload: Optional[dict] = None

class SearchRequest(BaseModel):
    vector: List[float]
    limit: int = 10
    score_threshold: Optional[float] = None

@app.on_event("startup")
async def startup_event():
    """Initialize Qdrant client"""
    global client
    client = QdrantClient(host="vector-db", port=6333)
    
    # Create default collection if not exists
    try:
        collections = client.get_collections().collections
        collection_names = [col.name for col in collections]
        
        if "yoga_content" not in collection_names:
            client.create_collection(
                collection_name="yoga_content",
                vectors_config=VectorParams(size=384, distance=Distance.COSINE)
            )
    except Exception as e:
        print(f"Warning: Could not create collection: {e}")

@app.get("/health")
async def health_check():
    try:
        client.get_collections()
        return {
            "status": "healthy",
            "service": "vector-db-service",
            "connected": True
        }
    except:
        return {
            "status": "unhealthy",
            "service": "vector-db-service",
            "connected": False
        }

@app.post("/collections/{collection_name}")
async def create_collection(collection_name: str, vector_size: int = 384):
    """Create a new vector collection"""
    try:
        client.create_collection(
            collection_name=collection_name,
            vectors_config=VectorParams(size=vector_size, distance=Distance.COSINE)
        )
        return {"message": f"Collection '{collection_name}' created"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/collections/{collection_name}/points")
async def upsert_points(collection_name: str, points: List[VectorPoint]):
    """Upsert points into collection"""
    try:
        point_structs = []
        for point in points:
            point_id = point.id or str(uuid.uuid4())
            point_structs.append(
                PointStruct(
                    id=point_id,
                    vector=point.vector,
                    payload=point.payload or {}
                )
            )
        
        operation_info = client.upsert(
            collection_name=collection_name,
            points=point_structs
        )
        
        return {
            "message": "Points upserted",
            "operation_id": operation_info.operation_id,
            "status": operation_info.status,
            "point_ids": [p.id for p in point_structs]
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/collections/{collection_name}/search")
async def search_vectors(collection_name: str, request: SearchRequest):
    """Search for similar vectors"""
    try:
        results = client.search(
            collection_name=collection_name,
            query_vector=request.vector,
            limit=request.limit,
            score_threshold=request.score_threshold
        )
        
        formatted_results = []
        for result in results:
            formatted_results.append({
                "id": result.id,
                "score": result.score,
                "payload": result.payload,
                "vector": result.vector.tolist() if hasattr(result.vector, 'tolist') else result.vector
            })
        
        return {
            "results": formatted_results,
            "count": len(formatted_results)
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/collections/{collection_name}/points/{point_id}")
async def get_point(collection_name: str, point_id: str):
    """Retrieve a specific point"""
    try:
        points = client.retrieve(
            collection_name=collection_name,
            ids=[point_id]
        )
        
        if not points:
            raise HTTPException(status_code=404, detail="Point not found")
        
        point = points[0]
        return {
            "id": point.id,
            "payload": point.payload,
            "vector": point.vector.tolist() if hasattr(point.vector, 'tolist') else point.vector
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))