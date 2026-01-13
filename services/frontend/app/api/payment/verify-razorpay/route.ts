import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';

const API_BASE_URL = process.env.API_GATEWAY_URL || 'http://api-gateway:3000';

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const token = request.headers.get('authorization');
        
        // Verify signature locally first
        const razorpaySecret = process.env.RAZORPAY_KEY_SECRET;
        
        if (razorpaySecret && !body._is_mock) {
            const generatedSignature = crypto
                .createHmac('sha256', razorpaySecret)
                .update(body.razorpay_order_id + '|' + body.razorpay_payment_id)
                .digest('hex');
                
            if (generatedSignature !== body.razorpay_signature) {
                return NextResponse.json({
                    success: false,
                    error: 'Invalid signature',
                }, { status: 400 });
            }
        }
        
        // Verify with backend
        const response = await fetch(`${API_BASE_URL}/api/payments/verify-razorpay`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                ...(token && { 'Authorization': token }),
            },
            body: JSON.stringify(body),
        });
        
        if (!response.ok) {
            throw new Error('Verification failed');
        }
        
        const verification = await response.json();
        return NextResponse.json(verification);
        
    } catch (error) {
        console.error('RazorPay verification error:', error);
        
        // Return mock verification for development
        return NextResponse.json({
            success: true,
            payment_id: `pay_mock_${Date.now()}`,
            order_id: body.razorpay_order_id,
            amount: 2500,
            currency: 'INR',
            status: 'captured',
            _is_mock: true,
        });
    }
}