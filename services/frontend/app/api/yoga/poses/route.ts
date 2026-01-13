import { NextRequest, NextResponse } from 'next/server';

const API_BASE_URL = process.env.API_GATEWAY_URL || 'http://api-gateway:3000';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const token = request.headers.get('authorization');

    const response = await fetch(`${API_BASE_URL}/api/yoga/poses?${searchParams}`, {
      headers: {
        'Content-Type': 'application/json',
        ...(token && { Authorization: token }),
      },
    });

    if (!response.ok) {
      throw new Error('Failed to fetch poses');
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('Yoga poses API error:', error);
    
    // Return mock data for development
    return NextResponse.json({
      poses: [
        {
          id: 'pose-1',
          name: 'Mountain Pose',
          sanskritName: 'Tadasana',
          category: 'standing',
          difficulty: 'beginner',
          benefits: ['Improves posture', 'Strengthens legs', 'Reduces flat feet'],
          duration: 60,
          imageUrl: '/images/poses/mountain.jpg',
        },
        {
          id: 'pose-2',
          name: 'Downward Dog',
          sanskritName: 'Adho Mukha Svanasana',
          category: 'inversion',
          difficulty: 'beginner',
          benefits: ['Strengthens arms', 'Stretches hamstrings', 'Calms mind'],
          duration: 90,
          imageUrl: '/images/poses/downward-dog.jpg',
        },
      ],
      pagination: {
        total: 2,
        page: 1,
        limit: 20,
        pages: 1,
      },
      message: 'Using demo data - service may be offline',
    });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const token = request.headers.get('authorization');

    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const response = await fetch(`${API_BASE_URL}/api/yoga/poses`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: token,
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      throw new Error('Failed to create pose');
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('Create pose error:', error);
    return NextResponse.json(
      { error: 'Failed to create pose', message: error.message },
      { status: 500 }
    );
  }
}