import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';

const API_BASE_URL = process.env.API_GATEWAY_URL || 'http://api-gateway:3000';

// Update endpoint mappings
const endpointMappings: Record<string, string> = {
  'profile': '/api/users/profile',
  'update': '/api/users/update',
  'preferences': '/api/users/preferences',
  'guest-create': '/api/users/guest/create',
  'guest-convert': '/api/users/guest/convert',
  'guest-session': '/api/users/guest/session',
  'guest-preferences': '/api/users/guest/preferences',
  'guest-cart': '/api/users/guest/cart',
  'guest-login': '/api/users/guest/login',
  'public': '/api/users/public',
  
  // GDPR and Privacy endpoints
  'gdpr-request': '/api/users/gdpr/request',
  'gdpr-verify': '/api/users/gdpr/request/verify',
  'consents': '/api/users/consents',
  'data-requests': '/api/users/gdpr/requests',
  'privacy-settings': '/api/users/privacy/settings',
  'cookies-preferences': '/api/users/cookies/preferences',
  'dpa-latest': '/api/users/dpa/latest',
  'dpa-accept': '/api/users/dpa/accept',
  'breach-acknowledge': '/api/users/breach/acknowledge',
};

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const endpoint = searchParams.get('endpoint') || 'profile';
    const token = request.headers.get('authorization') || cookies().get('token')?.value;

    // Check if endpoint requires authentication
    const publicEndpoints = ['public', 'dpa-latest'];
    const guestEndpoints = ['guest-session', 'guest-preferences', 'guest-cart'];
    
    if (!token && !publicEndpoints.includes(endpoint) && !endpoint.includes('guest-') && !guestEndpoints.includes(endpoint)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get the mapped API endpoint
    const apiEndpoint = endpointMappings[endpoint] || `/api/users/${endpoint}`;
    
    // Handle gdpr-verify endpoint which might have an ID parameter
    let finalEndpoint = apiEndpoint;
    if (endpoint === 'gdpr-verify') {
      const requestId = searchParams.get('requestId');
      if (requestId) {
        finalEndpoint = `/api/users/gdpr/request/${requestId}/verify`;
      }
    }
    
    // Remove the 'endpoint' parameter from search params to avoid duplication
    const filteredParams = new URLSearchParams(searchParams);
    filteredParams.delete('endpoint');
    filteredParams.delete('requestId');
    
    const response = await fetch(`${API_BASE_URL}${finalEndpoint}?${filteredParams}`, {
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
    
    // GDPR demo responses
    if (endpoint === 'gdpr-request') {
      return NextResponse.json({
        requestId: `gdpr-req-${Date.now()}`,
        status: 'pending',
        type: searchParams.get('type') || 'data_export',
        createdAt: new Date().toISOString(),
        estimatedCompletion: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        message: 'Demo GDPR request - service may be offline',
        timestamp: new Date().toISOString(),
      });
    }
    
    if (endpoint === 'gdpr-verify') {
      return NextResponse.json({
        verified: true,
        requestId: searchParams.get('requestId') || `gdpr-req-${Date.now()}`,
        verifiedAt: new Date().toISOString(),
        message: 'Demo GDPR verification - service may be offline',
        timestamp: new Date().toISOString(),
      });
    }
    
    if (endpoint === 'consents') {
      return NextResponse.json({
        marketing: true,
        analytics: true,
        necessary: true,
        updatedAt: new Date().toISOString(),
        version: '1.0.0',
        message: 'Demo consents - service may be offline',
        timestamp: new Date().toISOString(),
      });
    }
    
    if (endpoint === 'data-requests') {
      return NextResponse.json({
        requests: [
          {
            id: `gdpr-req-${Date.now() - 86400000}`,
            type: 'data_export',
            status: 'completed',
            createdAt: new Date(Date.now() - 86400000).toISOString(),
            completedAt: new Date(Date.now() - 43200000).toISOString(),
          }
        ],
        message: 'Demo data requests - service may be offline',
        timestamp: new Date().toISOString(),
      });
    }
    
    if (endpoint === 'privacy-settings') {
      return NextResponse.json({
        profileVisibility: 'friends',
        dataSharing: {
          analytics: true,
          marketing: false,
          thirdParty: false,
        },
        retentionPeriod: 365,
        autoDelete: false,
        message: 'Demo privacy settings - service may be offline',
        timestamp: new Date().toISOString(),
      });
    }
    
    if (endpoint === 'cookies-preferences') {
      return NextResponse.json({
        necessary: true,
        preferences: true,
        statistics: true,
        marketing: false,
        updatedAt: new Date().toISOString(),
        message: 'Demo cookie preferences - service may be offline',
        timestamp: new Date().toISOString(),
      });
    }
    
    if (endpoint === 'dpa-latest') {
      return NextResponse.json({
        version: '2.1.0',
        effectiveDate: '2024-01-15',
        content: 'This is a demo Data Processing Agreement. In production, this would contain the actual legal agreement text.',
        acceptanceRequired: true,
        message: 'Demo DPA - service may be offline',
        timestamp: new Date().toISOString(),
      });
    }
    
    if (endpoint === 'breach-acknowledge') {
      return NextResponse.json({
        acknowledged: true,
        breachId: searchParams.get('breachId') || `breach-${Date.now()}`,
        acknowledgedAt: new Date().toISOString(),
        message: 'Demo breach acknowledgment - service may be offline',
        timestamp: new Date().toISOString(),
      });
    }
    
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
    
    // Handle guest endpoints with demo responses
    if (endpoint?.includes('guest-')) {
      return NextResponse.json({
        success: true,
        guestId: `guest-${Date.now()}`,
        sessionId: `session-${Date.now()}`,
        message: 'Demo guest response - service may be offline',
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

    // Check if this is a guest action to determine auth requirements
    const isGuestAction = action.includes('guest-');
    const isAuthAction = action === 'login' || action === 'register';
    
    // Check if this is a GDPR action that might require special handling
    const isGDPRAction = [
      'gdpr-request', 
      'gdpr-verify', 
      'consents', 
      'dpa-accept', 
      'breach-acknowledge'
    ].includes(action);
    
    const apiEndpoint = endpointMappings[action] || `/api/users/${action}`;
    
    // Special handling for gdpr-verify endpoint
    let finalEndpoint = apiEndpoint;
    if (action === 'gdpr-verify' && body.requestId) {
      finalEndpoint = `/api/users/gdpr/request/${body.requestId}/verify`;
    }
    
    const response = await fetch(`${API_BASE_URL}${finalEndpoint}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        // Add Authorization header for GDPR actions and other authenticated endpoints
        ...(token && (isGDPRAction || !isAuthAction) && { 'Authorization': `Bearer ${token}` }),
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
    
    // For guest login, set guest session cookie
    if (action === 'guest-login' && data.guestId) {
      const response = NextResponse.json(data);
      response.cookies.set('guestId', data.guestId, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 30 * 24 * 60 * 60, // 30 days for guest sessions
      });
      return response;
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error('User API Error:', error);
    
    const searchParams = request.nextUrl.searchParams;
    const action = searchParams.get('action') || 'login';
    
    // Handle demo responses for GDPR actions
    if (action === 'gdpr-request') {
      const body = await request.json();
      return NextResponse.json({
        requestId: `gdpr-req-${Date.now()}`,
        status: 'pending',
        type: body.type || 'data_export',
        createdAt: new Date().toISOString(),
        estimatedCompletion: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        message: 'Demo GDPR request - service may be offline',
        timestamp: new Date().toISOString(),
      });
    }
    
    if (action === 'gdpr-verify') {
      return NextResponse.json({
        verified: true,
        requestId: 'gdpr-req-demo',
        verifiedAt: new Date().toISOString(),
        message: 'Demo GDPR verification - service may be offline',
        timestamp: new Date().toISOString(),
      });
    }
    
    if (action === 'consents') {
      const body = await request.json();
      return NextResponse.json({
        ...body,
        updatedAt: new Date().toISOString(),
        version: '1.0.0',
        message: 'Demo consents update - service may be offline',
        timestamp: new Date().toISOString(),
      });
    }
    
    if (action === 'dpa-accept') {
      return NextResponse.json({
        accepted: true,
        version: '2.1.0',
        acceptedAt: new Date().toISOString(),
        userId: 'demo-user',
        message: 'Demo DPA acceptance - service may be offline',
        timestamp: new Date().toISOString(),
      });
    }
    
    if (action === 'breach-acknowledge') {
      const body = await request.json();
      return NextResponse.json({
        acknowledged: true,
        breachId: body.breachId || `breach-${Date.now()}`,
        acknowledgedAt: new Date().toISOString(),
        userId: 'demo-user',
        message: 'Demo breach acknowledgment - service may be offline',
        timestamp: new Date().toISOString(),
      });
    }
    
    // Handle demo responses for guest actions
    if (action.includes('guest-')) {
      return NextResponse.json({
        success: true,
        guestId: `guest-${Date.now()}`,
        sessionId: `session-${Date.now()}`,
        message: 'Demo guest action - service may be offline',
        timestamp: new Date().toISOString(),
      });
    }
    
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

// Add other HTTP methods if needed (PUT, DELETE, etc.)
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const searchParams = request.nextUrl.searchParams;
    const action = searchParams.get('action') || 'update';
    const token = request.headers.get('authorization') || cookies().get('token')?.value;

    // GDPR endpoints that use PUT
    const gdprPutEndpoints = ['privacy-settings', 'cookies-preferences', 'consents'];
    
    if (!token && !gdprPutEndpoints.includes(action)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const apiEndpoint = endpointMappings[action] || `/api/users/${action}`;
    
    const response = await fetch(`${API_BASE_URL}${apiEndpoint}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        ...(token && { 'Authorization': `Bearer ${token}` }),
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      throw new Error(`Failed to perform ${action}`);
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('User API Error:', error);
    
    const searchParams = request.nextUrl.searchParams;
    const action = searchParams.get('action') || 'update';
    
    // Demo responses for GDPR PUT endpoints
    if (action === 'privacy-settings') {
      const body = await request.json();
      return NextResponse.json({
        ...body,
        updatedAt: new Date().toISOString(),
        message: 'Demo privacy settings update - service may be offline',
        timestamp: new Date().toISOString(),
      });
    }
    
    if (action === 'cookies-preferences') {
      const body = await request.json();
      return NextResponse.json({
        ...body,
        updatedAt: new Date().toISOString(),
        message: 'Demo cookie preferences update - service may be offline',
        timestamp: new Date().toISOString(),
      });
    }
    
    if (action === 'consents') {
      const body = await request.json();
      return NextResponse.json({
        ...body,
        updatedAt: new Date().toISOString(),
        version: '1.0.0',
        message: 'Demo consents update - service may be offline',
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

export async function DELETE(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const action = searchParams.get('action') || 'delete';
    const token = request.headers.get('authorization') || cookies().get('token')?.value;

    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const apiEndpoint = endpointMappings[action] || `/api/users/${action}`;
    
    const response = await fetch(`${API_BASE_URL}${apiEndpoint}`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to perform ${action}`);
    }

    const data = await response.json();
    
    // Clear cookies on account deletion
    if (action === 'delete') {
      const response = NextResponse.json(data);
      response.cookies.delete('token');
      response.cookies.delete('refreshToken');
      return response;
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error('User API Error:', error);
    return NextResponse.json({
      success: false,
      message: 'Service unavailable',
      timestamp: new Date().toISOString(),
    }, { status: 503 });
  }
}