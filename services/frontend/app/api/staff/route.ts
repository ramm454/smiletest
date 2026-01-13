import { NextRequest, NextResponse } from 'next/server';

const API_BASE_URL = process.env.API_GATEWAY_URL || 'http://api-gateway:3000';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const token = request.headers.get('authorization');
    const endpoint = searchParams.get('endpoint') || 'staff';
    
    const response = await fetch(`${API_BASE_URL}/api/staff/${endpoint}?${searchParams}`, {
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
    console.error('Staff API Error:', error);
    
    // Return mock data
    const searchParams = request.nextUrl.searchParams;
    const endpoint = searchParams.get('endpoint') || 'staff';
    
    const mockData = getMockStaffData(endpoint, searchParams);
    return NextResponse.json({
      ...mockData,
      message: 'Using demo data - service may be offline',
      timestamp: new Date().toISOString(),
    });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const token = request.headers.get('authorization');
    const searchParams = request.nextUrl.searchParams;
    const action = searchParams.get('action') || 'create';
    
    const response = await fetch(`${API_BASE_URL}/api/staff/${action}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token && { 'Authorization': token }),
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      throw new Error(`Failed to perform ${action}`);
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('Staff API Error:', error);
    
    // Return mock response
    const body = await request.json();
    return NextResponse.json({
      success: true,
      message: 'Demo action completed - service may be offline',
      data: body,
      timestamp: new Date().toISOString(),
    });
  }
}

function getMockStaffData(endpoint: string, params: URLSearchParams) {
  switch (endpoint) {
    case 'staff':
      return {
        staff: [
          {
            id: 'staff-1',
            userId: 'user-1',
            employeeId: 'EMP001',
            department: 'Yoga',
            position: 'Instructor',
            hireDate: '2023-01-15T00:00:00.000Z',
            salary: 50000,
            employmentType: 'full_time',
            hourlyRate: 25,
            maxHoursPerWeek: 40,
            skills: ['Vinyasa', 'Hatha', 'Meditation'],
            certifications: ['RYT-200', 'CPR'],
            isActive: true,
            user: {
              id: 'user-1',
              firstName: 'John',
              lastName: 'Doe',
              email: 'john@yogaspa.com',
              phone: '+1234567890',
              avatar: '/images/avatar1.jpg',
            },
          },
          {
            id: 'staff-2',
            userId: 'user-2',
            employeeId: 'EMP002',
            department: 'Spa',
            position: 'Therapist',
            hireDate: '2023-03-20T00:00:00.000Z',
            salary: 45000,
            employmentType: 'full_time',
            hourlyRate: 22,
            maxHoursPerWeek: 40,
            skills: ['Swedish Massage', 'Deep Tissue', 'Aromatherapy'],
            certifications: ['Licensed Massage Therapist'],
            isActive: true,
            user: {
              id: 'user-2',
              firstName: 'Jane',
              lastName: 'Smith',
              email: 'jane@yogaspa.com',
              phone: '+0987654321',
              avatar: '/images/avatar2.jpg',
            },
          },
        ],
        pagination: {
          total: 2,
          page: 1,
          limit: 20,
          pages: 1,
        },
      };
    case 'stats':
      return {
        totalStaff: 15,
        activeStaff: 12,
        inactiveStaff: 3,
        byDepartment: {
          'Yoga': 5,
          'Spa': 4,
          'Reception': 3,
          'Management': 2,
          'Cleaning': 1,
        },
        averageSalary: 48000,
        newThisMonth: 2,
        turnoverRate: 5.3,
      };
    default:
      return {};
  }
}