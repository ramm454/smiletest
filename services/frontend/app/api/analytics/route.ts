import { NextRequest, NextResponse } from 'next/server';

const API_BASE_URL = process.env.API_GATEWAY_URL || 'http://api-gateway:3000';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const token = request.headers.get('authorization');

    const response = await fetch(
      `${API_BASE_URL}/api/analytics?${searchParams}`,
      {
        headers: {
          'Content-Type': 'application/json',
          ...(token && { Authorization: token }),
        },
      }
    );

    if (!response.ok) {
      throw new Error('Failed to fetch analytics');
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('Analytics API error:', error);
    
    // Mock analytics data
    const trends = [];
    const now = new Date();
    
    for (let i = 14; i >= 0; i--) {
      const date = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
      trends.push({
        date: date.toISOString().split('T')[0],
        total: Math.floor(Math.random() * 20) + 5,
        confirmed: Math.floor(Math.random() * 15) + 5,
        cancelled: Math.floor(Math.random() * 5),
        revenue: Math.floor(Math.random() * 1000) + 200,
      });
    }
    
    return NextResponse.json({
      summary: {
        totalBookings: 156,
        confirmedBookings: 142,
        cancelledBookings: 14,
        cancellationRate: 9.0,
        revenue: 12560,
        averageBookingValue: 88.45,
      },
      trends,
      popularClasses: [
        {
          classId: 'class-1',
          className: 'Morning Vinyasa Flow',
          instructor: 'Sarah Johnson',
          bookingCount: 45,
          totalRevenue: 2250,
          averageRevenue: 50,
        },
      ],
      peakHours: [
        { hourFormatted: '08:00', bookingCount: 15 },
        { hourFormatted: '17:00', bookingCount: 12 },
        { hourFormatted: '10:00', bookingCount: 10 },
      ],
      timeRange: {
        startDate: new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000),
        endDate: now,
      },
    });
  }
}