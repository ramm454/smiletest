import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';

const API_BASE_URL = process.env.API_GATEWAY_URL || 'http://api-gateway:3000';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const endpoint = searchParams.get('endpoint') || 'profile';
    const token = request.headers.get('authorization') || cookies().get('token')?.value;

    if (!token && endpoint !== 'public') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const response = await fetch(`${API_BASE_URL}/api/users/${endpoint}?${searchParams}`, {
      headers: {
        'Content-Type': 'application/json',
        ...(token && { 'Authorization': `Bearer ${token}` }),
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch ${endpoint}`);
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('User API Error:', error);
    
    const searchParams = request.nextUrl.searchParams;
    const endpoint = searchParams.get('endpoint');
    
    if (endpoint === 'profile') {
      return NextResponse.json({
        id: 'demo-user',
        email: 'demo@example.com',
        firstName: 'Demo',
        lastName: 'User',
        role: 'MEMBER',
        avatar: '/images/avatar.jpg',
        profile: {
          experienceLevel: 'beginner',
          preferredStyles: ['vinyasa', 'hatha'],
        },
        message: 'Using demo profile - service may be offline',
        timestamp: new Date().toISOString(),
      });
    }
    
    return NextResponse.json({
      error: 'Service unavailable',
      timestamp: new Date().toISOString(),
    }, { status: 503 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const searchParams = request.nextUrl.searchParams;
    const action = searchParams.get('action') || 'login';
    const token = request.headers.get('authorization') || cookies().get('token')?.value;

    const response = await fetch(`${API_BASE_URL}/api/users/${action}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token && action !== 'login' && action !== 'register' && { 'Authorization': `Bearer ${token}` }),
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      throw new Error(`Failed to perform ${action}`);
    }

    const data = await response.json();
    
    // Set cookie for login/register
    if (action === 'login' || action === 'register') {
      const response = NextResponse.json(data);
      if (data.accessToken) {
        response.cookies.set('token', data.accessToken, {
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'strict',
          maxAge: 24 * 60 * 60, // 24 hours
        });
        
        if (data.refreshToken) {
          response.cookies.set('refreshToken', data.refreshToken, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'strict',
            maxAge: 7 * 24 * 60 * 60, // 7 days
          });
        }
      }
      return response;
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error('User API Error:', error);
    
    const searchParams = request.nextUrl.searchParams;
    const action = searchParams.get('action');
    
    if (action === 'login') {
      const body = await request.json();
      return NextResponse.json({
        user: {
          id: 'demo-user',
          email: body.email || 'demo@example.com',
          firstName: 'Demo',
          lastName: 'User',
          role: 'MEMBER',
        },
        accessToken: 'demo-token',
        refreshToken: 'demo-refresh-token',
        message: 'Demo login - service may be offline',
        timestamp: new Date().toISOString(),
      });
    }
    
    return NextResponse.json({
      success: false,
      message: 'Service unavailable',
      timestamp: new Date().toISOString(),
    }, { status: 503 });
  }
}