import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    // Get client IP from various headers
    const forwarded = request.headers.get('x-forwarded-for');
    const realIp = request.headers.get('x-real-ip');
    const cfConnectingIp = request.headers.get('cf-connecting-ip');
    
    // Priority order: CF-Connecting-IP > X-Real-IP > X-Forwarded-For
    let clientIp = cfConnectingIp || realIp || forwarded;
    
    // If X-Forwarded-For contains multiple IPs, take the first one
    if (clientIp && clientIp.includes(',')) {
      clientIp = clientIp.split(',')[0].trim();
    }
    
    // Fallback to connection remote address
    if (!clientIp) {
      clientIp = 'unknown';
    }

    return NextResponse.json({
      ip: clientIp,
      headers: {
        'x-forwarded-for': forwarded,
        'x-real-ip': realIp,
        'cf-connecting-ip': cfConnectingIp,
      },
    });
  } catch (error) {
    console.error('Error getting client IP:', error);
    return NextResponse.json(
      { error: 'Failed to get client IP' },
      { status: 500 }
    );
  }
}
