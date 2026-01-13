import { NextRequest, NextResponse } from 'next/server';

const API_BASE_URL = process.env.API_GATEWAY_URL || 'http://api-gateway:3000';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const token = request.headers.get('authorization');

    const response = await fetch(
      `${API_BASE_URL}/api/recurring-bookings?${searchParams}`,
      {
        headers: {
          'Content-Type': 'application/json',
          ...(token && { Authorization: token }),
        },
      }
    );

    if (!response.ok) {
      throw new Error('Failed to fetch recurring bookings');
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('Recurring bookings API error:', error);
    
    // Mock data for development
    return NextResponse.json({
      bookings: [
        {
          id: 'recurring-1',
          userId: 'user-1',
          classId: 'class-1',
          firstOccurrence: new Date().toISOString(),
          recurrenceType: 'WEEKLY',
          status: 'ACTIVE',
          generatedCount: 4,
          bookings: [
            { id: 'booking-1', startTime: new Date().toISOString(), status: 'CONFIRMED' },
            { id: 'booking-2', startTime: new Date(Date.now() + 7 * 86400000).toISOString(), status: 'CONFIRMED' },
          ],
        },
      ],
      pagination: { total: 1, page: 1, limit: 20, pages: 1 },
    });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const token = request.headers.get('authorization');

    const response = await fetch(`${API_BASE_URL}/api/recurring-bookings`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token && { Authorization: token }),
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      throw new Error('Failed to create recurring booking');
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('Recurring booking creation error:', error);
    
    // Mock response
    return NextResponse.json({
      id: `recurring-${Date.now()}`,
      ...body,
      status: 'ACTIVE',
      createdAt: new Date().toISOString(),
      invitationToken: 'mock-token-' + Date.now(),
      message: 'Demo recurring booking created',
    });
  }
}