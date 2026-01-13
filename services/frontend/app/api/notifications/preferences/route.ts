import { NextRequest, NextResponse } from 'next/server';

const API_GATEWAY_URL = process.env.API_GATEWAY_URL || 'http://api-gateway:3000';

export async function GET(request: NextRequest) {
  try {
    const token = request.headers.get('authorization');
    const userId = request.nextUrl.searchParams.get('userId');
    
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const response = await fetch(
      `${API_GATEWAY_URL}/api/notifications/preferences?userId=${userId}`,
      {
        headers: {
          'Authorization': token,
          'Content-Type': 'application/json',
        },
      }
    );
    
    if (!response.ok) {
      throw new Error('Failed to fetch preferences');
    }
    
    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('Notification API Error:', error);
    
    // Return mock preferences
    return NextResponse.json({
      emailEnabled: true,
      smsEnabled: false,
      pushEnabled: true,
      whatsappEnabled: false,
      inAppEnabled: true,
      dndEnabled: false,
      dndStart: '22:00',
      dndEnd: '08:00',
      bookingAlerts: true,
      paymentAlerts: true,
      classReminders: true,
      promotional: true,
      systemAlerts: true,
    });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const token = request.headers.get('authorization');
    const body = await request.json();
    
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const response = await fetch(`${API_GATEWAY_URL}/api/notifications/preferences`, {
      method: 'PUT',
      headers: {
        'Authorization': token,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });
    
    if (!response.ok) {
      throw new Error('Failed to update preferences');
    }
    
    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('Notification API Error:', error);
    return NextResponse.json(
      { error: 'Failed to update preferences' },
      { status: 500 }
    );
  }
}