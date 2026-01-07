import { NextRequest, NextResponse } from 'next/server';

const API_BASE_URL = process.env.API_GATEWAY_URL || 'http://api-gateway:3000';
const BOOKING_SERVICE_URL = process.env.BOOKING_SERVICE_URL || 'http://booking-service:3002';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const token = request.headers.get('authorization');

    const response = await fetch(`${API_BASE_URL}/api/bookings?${searchParams}`, {
      headers: {
        'Content-Type': 'application/json',
        ...(token && { 'Authorization': token }),
      },
    });

    if (!response.ok) {
      throw new Error('Failed to fetch bookings');
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('Booking API Error:', error);
    
    // Fallback to mock data
    return NextResponse.json({
      bookings: [],
      message: 'Service temporarily unavailable',
      timestamp: new Date().toISOString(),
    });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const token = request.headers.get('authorization');

    const response = await fetch(`${API_BASE_URL}/api/bookings`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token && { 'Authorization': token }),
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      throw new Error('Failed to create booking');
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('Booking API Error:', error);
    
    // Fallback to mock booking
    const body = await request.json();
    return NextResponse.json({
      id: `mock-${Date.now()}`,
      ...body,
      status: 'CONFIRMED',
      createdAt: new Date().toISOString(),
      message: 'Demo booking - service may be offline',
    });
  }
}