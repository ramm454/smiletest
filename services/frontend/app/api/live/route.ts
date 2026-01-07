import { NextRequest, NextResponse } from 'next/server';

const API_BASE_URL = process.env.API_GATEWAY_URL || 'http://api-gateway:3000';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const endpoint = searchParams.get('endpoint') || 'sessions';
    const token = request.headers.get('authorization');

    const response = await fetch(`${API_BASE_URL}/api/live/${endpoint}?${searchParams}`, {
      headers: {
        'Content-Type': 'application/json',
        ...(token && { 'Authorization': token }),
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch ${endpoint}`);
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('Live API Error:', error);
    
    const searchParams = request.nextUrl.searchParams;
    const endpoint = searchParams.get('endpoint');
    
    if (endpoint === 'sessions') {
      return NextResponse.json({
        sessions: [
          {
            id: 'live-1',
            title: 'Morning Yoga Flow',
            description: 'Start your day with energizing yoga',
            instructor: { firstName: 'Sarah', lastName: 'Johnson' },
            startTime: new Date(Date.now() + 3600000).toISOString(), // 1 hour from now
            status: 'LIVE',
            currentParticipants: 15,
            maxParticipants: 50,
          },
        ],
        message: 'Using demo data - service may be offline',
        timestamp: new Date().toISOString(),
      });
    }
    
    return NextResponse.json({
      error: 'Service unavailable',
      timestamp: new Date().toISOString(),
    });
  }
}