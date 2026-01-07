from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
import stripe
import os
from datetime import datetime

app = FastAPI(title="Payment Service")

stripe.api_key = os.getenv("STRIPE_SECRET_KEY")

class PaymentIntentRequest(BaseModel):
    amount: int
    currency: str = "usd"
    description: str
    customer_email: str

@app.post("/create-payment-intent")
async def create_payment_intent(request: PaymentIntentRequest):
    try:
        intent = stripe.PaymentIntent.create(
            amount=request.amount,
            currency=request.currency,
            description=request.description,
            receipt_email=request.customer_email,
        )
        return {
            "client_secret": intent.client_secret,
            "payment_intent_id": intent.id,
            "status": intent.status
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.get("/health")
async def health_check():
    return {
        "status": "healthy",
        "service": "payment-service",
        "timestamp": datetime.utcnow().isoformat()
    }