import { NextRequest, NextResponse } from 'next/server';

const API_GATEWAY_URL = process.env.API_GATEWAY_URL || 'http://api-gateway:3000';

export async function GET(request: NextRequest) {
  try {
    const token = request.headers.get('authorization');
    const userId = request.nextUrl.searchParams.get('userId');
    
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const response = await fetch(`${API_GATEWAY_URL}/api/notifications?userId=${userId}`, {
      headers: {
        'Authorization': token,
        'Content-Type': 'application/json',
      },
    });
    
    if (!response.ok) {
      throw new Error('Failed to fetch notifications');
    }
    
    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('Notification API Error:', error);
    
    // Return mock data for development
    return NextResponse.json({
      notifications: [
        {
          id: 'notif-1',
          type: 'email',
          title: 'Booking Confirmed',
          message: 'Your yoga class booking for tomorrow at 10:00 AM has been confirmed',
          timestamp: new Date().toISOString(),
          read: false,
        },
        {
          id: 'notif-2',
          type: 'sms',
          title: 'Payment Successful',
          message: 'Payment of $25.00 for your booking has been processed',
          timestamp: new Date(Date.now() - 3600000).toISOString(),
          read: true,
        },
      ],
      unreadCount: 1,
    });
  }
}

export async function POST(request: NextRequest) {
  try {
    const token = request.headers.get('authorization');
    const body = await request.json();
    
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const response = await fetch(`${API_GATEWAY_URL}/api/notifications`, {
      method: 'POST',
      headers: {
        'Authorization': token,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });
    
    if (!response.ok) {
      throw new Error('Failed to create notification');
    }
    
    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('Notification API Error:', error);
    return NextResponse.json(
      { error: 'Failed to process notification' },
      { status: 500 }
    );
  }
}