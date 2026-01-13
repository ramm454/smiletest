import { NextRequest, NextResponse } from 'next/server';

const API_BASE_URL = process.env.API_GATEWAY_URL || 'http://api-gateway:3000';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const endpoint = searchParams.get('endpoint') || 'stats';
    const token = request.headers.get('authorization');

    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const response = await fetch(`${API_BASE_URL}/api/yoga/progress/${endpoint}?${searchParams}`, {
      headers: {
        'Content-Type': 'application/json',
        Authorization: token,
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch ${endpoint}`);
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('Yoga progress API error:', error);
    
    // Return mock data based on endpoint
    const searchParams = request.nextUrl.searchParams;
    const endpoint = searchParams.get('endpoint');
    const timeframe = searchParams.get('timeframe') || 'month';

    if (endpoint === 'stats') {
      return NextResponse.json({
        timeframe,
        summary: {
          totalSessions: 12,
          totalPracticeTime: 360, // minutes
          averageSessionDuration: 30,
          masteredPoses: 3,
          inProgressPoses: 8,
          currentStreak: 7,
          longestStreak: 14,
          goals: {
            total: 2,
            completed: 1,
            averageProgress: 75,
          },
        },
        practiceDistribution: {
          yoga: 8,
          meditation: 3,
          pranayama: 1,
        },
        recentSessions: Array.from({ length: 5 }).map((_, i) => ({
          id: `session-${i}`,
          practiceDate: new Date(Date.now() - i * 86400000).toISOString(),
          duration: 30,
          practiceType: i % 2 === 0 ? 'yoga' : 'meditation',
          posesPracticed: ['pose-1', 'pose-2'],
        })),
        poseProgress: {
          mastered: [],
          inProgress: [
            {
              id: 'progress-1',
              poseId: 'pose-1',
              pose: { id: 'pose-1', name: 'Mountain Pose', difficulty: 'beginner' },
              practiceCount: 5,
              comfortLevel: 3,
              mastered: false,
            },
          ],
        },
        activeGoals: [
          {
            id: 'goal-1',
            goalType: 'flexibility',
            target: 'Touch toes',
            currentProgress: 80,
            status: 'active',
          },
        ],
        message: 'Using demo progress data - service may be offline',
      });
    }

    return NextResponse.json(
      { error: 'Endpoint not found', message: error.message },
      { status: 404 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const endpoint = request.nextUrl.searchParams.get('endpoint') || 'track';
    const token = request.headers.get('authorization');

    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const response = await fetch(`${API_BASE_URL}/api/yoga/progress/${endpoint}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: token,
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      throw new Error(`Failed to ${endpoint} progress`);
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('Track progress error:', error);
    return NextResponse.json(
      { error: 'Failed to track progress', message: error.message },
      { status: 500 }
    );
  }
}