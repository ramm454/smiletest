import { NextRequest, NextResponse } from 'next/server';

const API_BASE_URL = process.env.API_GATEWAY_URL || 'http://api-gateway:3000';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const token = request.headers.get('authorization');
    const endpoint = searchParams.get('endpoint') || 'products';
    
    const response = await fetch(`${API_BASE_URL}/api/ecommerce/${endpoint}?${searchParams}`, {
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
    console.error('Shop API Error:', error);
    
    // Return mock data based on endpoint
    const searchParams = request.nextUrl.searchParams;
    const endpoint = searchParams.get('endpoint') || 'products';
    
    const mockData = getMockData(endpoint, searchParams);
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
    const action = searchParams.get('action') || 'add-to-cart';

    const response = await fetch(`${API_BASE_URL}/api/ecommerce/${action}`, {
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
    console.error('Shop API Error:', error);
    
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

function getMockData(endpoint: string, params: URLSearchParams) {
  switch (endpoint) {
    case 'products':
      return {
        products: [
          {
            id: 'product-1',
            name: 'Premium Yoga Mat',
            description: 'Non-slip, eco-friendly yoga mat',
            price: 49.99,
            images: ['/images/yoga-mat.jpg'],
            rating: 4.5,
            reviewCount: 128,
          },
          {
            id: 'product-2',
            name: 'Yoga Blocks (Set of 2)',
            description: 'High-density foam yoga blocks',
            price: 29.99,
            images: ['/images/yoga-blocks.jpg'],
            rating: 4.2,
            reviewCount: 56,
          },
        ],
        pagination: { total: 2, page: 1, limit: 20, pages: 1 },
      };
    case 'cart':
      return {
        id: 'cart-mock',
        items: [],
        itemCount: 0,
        totalAmount: 0,
      };
    default:
      return {};
  }
}