import { NextRequest, NextResponse } from 'next/server';

const API_BASE_URL = process.env.API_GATEWAY_URL || 'http://api-gateway:3000';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const token = request.headers.get('authorization');

    const response = await fetch(
      `${API_BASE_URL}/api/group-bookings?${searchParams}`,
      {
        headers: {
          'Content-Type': 'application/json',
          ...(token && { Authorization: token }),
        },
      }
    );

    if (!response.ok) {
      throw new Error('Failed to fetch group bookings');
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('Group bookings API error:', error);
    
    // Mock data
    return NextResponse.json({
      bookings: [
        {
          id: 'group-1',
          groupName: 'Team Yoga Session',
          classId: 'class-1',
          status: 'PENDING',
          totalAmount: 200,
          amountPaid: 100,
          members: [
            { email: 'member1@example.com', status: 'CONFIRMED' },
            { email: 'member2@example.com', status: 'INVITED' },
          ],
        },
      ],
    });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const token = request.headers.get('authorization');

    const response = await fetch(`${API_BASE_URL}/api/group-bookings`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token && { Authorization: token }),
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      throw new Error('Failed to create group booking');
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('Group booking creation error:', error);
    
    // Mock response
    return NextResponse.json({
      id: `group-${Date.now()}`,
      ...body,
      status: 'PENDING',
      invitationToken: 'mock-invitation-' + Date.now(),
      createdAt: new Date().toISOString(),
      message: 'Demo group booking created',
    });
  }
}