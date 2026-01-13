import { NextRequest, NextResponse } from 'next/server';

const API_BASE_URL = process.env.API_GATEWAY_URL || 'http://api-gateway:3000';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const token = request.headers.get('authorization');

    const response = await fetch(`${API_BASE_URL}/api/yoga/sequences?${searchParams}`, {
      headers: {
        'Content-Type': 'application/json',
        ...(token && { Authorization: token }),
      },
    });

    if (!response.ok) {
      throw new Error('Failed to fetch sequences');
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('Yoga sequences API error:', error);
    
    // Return mock data for development
    return NextResponse.json({
      sequences: [
        {
          id: 'seq-1',
          name: 'Morning Energizer',
          description: 'A gentle sequence to wake up your body and mind',
          type: 'morning',
          difficulty: 'beginner',
          totalDuration: 30,
          focusArea: 'full body',
          instructor: {
            id: 'inst-1',
            firstName: 'Sarah',
            lastName: 'Johnson',
            avatar: '/images/instructors/sarah.jpg',
          },
          usageCount: 45,
          averageRating: 4.8,
        },
        {
          id: 'seq-2',
          name: 'Evening Wind Down',
          description: 'Relaxing sequence to release tension before bed',
          type: 'evening',
          difficulty: 'beginner',
          totalDuration: 25,
          focusArea: 'relaxation',
          instructor: {
            id: 'inst-2',
            firstName: 'Michael',
            lastName: 'Chen',
            avatar: '/images/instructors/michael.jpg',
          },
          usageCount: 32,
          averageRating: 4.9,
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