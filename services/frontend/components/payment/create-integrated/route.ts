import { NextRequest, NextResponse } from 'next/server';

const API_BASE_URL = process.env.API_GATEWAY_URL || 'http://api-gateway:3000';

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const token = request.headers.get('authorization');
        
        const { type, itemId, gateway, amount, currency, metadata } = body;
        
        // Build payment request based on type
        let paymentRequest: any = {
            gateway: gateway,
            amount: amount,
            currency: currency,
            metadata: {
                ...metadata,
                payment_type: type,
                frontend_source: 'integrated_payment',
            },
        };
        
        // Add type-specific fields
        switch (type) {
            case 'booking':
                paymentRequest.booking_id = itemId;
                paymentRequest.description = `Booking payment for ${metadata.className || 'yoga class'}`;
                break;
                
            case 'ecommerce':
                paymentRequest.order_id = itemId;
                paymentRequest.description = `Ecommerce order #${itemId}`;
                break;
                
            case 'subscription':
                paymentRequest.subscription_id = itemId;
                paymentRequest.description = `Subscription for ${metadata.planName || 'membership'}`;
                break;
                
            default:
                paymentRequest.description = `Payment for ${type}`;
        }
        
        // Call payment service
        const response = await fetch(`${API_BASE_URL}/api/payments`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                ...(token && { 'Authorization': token }),
            },
            body: JSON.stringify(paymentRequest),
        });
        
        if (!response.ok) {
            throw new Error(`Payment service error: ${response.status}`);
        }
        
        const paymentData = await response.json();
        
        // Return enhanced response
        return NextResponse.json({
            ...paymentData,
            payment_type: type,
            item_id: itemId,
            integration_status: 'pending',
        });
        
    } catch (error) {
        console.error('Integrated payment error:', error);
        
        // Return mock data for development
        return NextResponse.json({
            payment_id: `pay_mock_${Date.now()}`,
            client_secret: 'pi_mock_secret_123',
            status: 'pending',
            gateway: body.gateway,
            amount: body.amount,
            currency: body.currency,
            payment_type: body.type,
            item_id: body.itemId,
            integration_status: 'mock',
            _is_mock: true,
        });
    }
}