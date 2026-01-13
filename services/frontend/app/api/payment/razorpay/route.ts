import { NextRequest, NextResponse } from 'next/server';

const API_BASE_URL = process.env.API_GATEWAY_URL || 'http://api-gateway:3000';

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const token = request.headers.get('authorization');
        
        // Create RazorPay order through payment service
        const response = await fetch(`${API_BASE_URL}/api/payments`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                ...(token && { 'Authorization': token }),
            },
            body: JSON.stringify({
                ...body,
                gateway: 'razorpay',
            }),
        });
        
        if (!response.ok) {
            throw new Error('Failed to create RazorPay order');
        }
        
        const data = await response.json();
        
        // Return data needed for frontend checkout
        return NextResponse.json({
            key: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID,
            order_id: data.gateway_order_id,
            amount: data.amount,
            currency: data.currency,
            name: 'Yoga Spa Platform',
            description: data.description,
            prefill: {
                name: body.customer_name || 'Customer',
                email: body.customer_email || '',
                contact: body.customer_phone || '',
            },
            theme: {
                color: '#3B82F6',
            },
        });
        
    } catch (error) {
        console.error('RazorPay API Error:', error);
        
        // Return mock data for development
        return NextResponse.json({
            key: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID || 'rzp_test_mock_key',
            order_id: `order_mock_${Date.now()}`,
            amount: body?.amount || 2500,
            currency: body?.currency || 'INR',
            name: 'Yoga Spa Platform',
            description: 'Mock payment for development',
            prefill: {
                name: 'Test Customer',
                email: 'test@example.com',
                contact: '9999999999',
            },
            theme: {
                color: '#3B82F6',
            },
            _is_mock: true,
        });
    }
}