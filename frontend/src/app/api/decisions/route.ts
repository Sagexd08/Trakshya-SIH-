import { NextRequest, NextResponse } from 'next/server';

// Check if Clerk is configured
const hasClerk = !!process.env.CLERK_PUBLISHABLE_KEY && !!process.env.CLERK_SECRET_KEY;

async function getAuthenticatedUser() {
  if (!hasClerk) {
    // Return mock user for development
    return { userId: 'dev-user', role: 'controller' };
  }

  try {
    const { auth } = await import('@clerk/nextjs/server');
    const authResult = await auth();
    return { userId: authResult.userId, role: null };
  } catch (error) {
    console.warn('Clerk authentication failed:', error);
    return { userId: null, role: null };
  }
}

export async function POST(request: NextRequest) {
  try {
    // Authenticate user
    const { userId } = await getAuthenticatedUser();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Parse request body
    const body = await request.json();
    const { action, proposalId, recommendation } = body;

    if (!action || !proposalId) {
      return NextResponse.json({ error: 'Action and proposalId are required' }, { status: 400 });
    }

    // Validate action
    if (!['accept', 'reject'].includes(action)) {
      return NextResponse.json({ error: 'Invalid action. Must be "accept" or "reject"' }, { status: 400 });
    }

    // Log the decision for audit purposes (only if Supabase is configured)
    if (hasClerk && userId !== 'dev-user') {
      try {
        const { createSupabaseServer } = await import('@/lib/supabase/server');
        const supabase = createSupabaseServer();
        
        await supabase.from('audit_logs').insert({
          user_id: userId,
          action: `recommendation_${action}`,
          details: {
            proposalId,
            recommendation: recommendation ? {
              title: recommendation.title,
              type: recommendation.type,
              priority: recommendation.priority,
              impact: recommendation.impact
            } : null,
            timestamp: new Date().toISOString()
          },
          timestamp: new Date().toISOString()
        });
      } catch (error) {
        console.warn('Could not log decision audit entry:', error);
      }
    }

    // For development, just return success
    return NextResponse.json({
      success: true,
      action,
      proposalId,
      message: action === 'accept' 
        ? 'Recommendation accepted and applied successfully'
        : 'Recommendation rejected',
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Error processing decision:', error);
    return NextResponse.json(
      { error: 'Failed to process decision' },
      { status: 500 }
    );
  }
}

export async function GET(_request: NextRequest) {
  try {
    // Authenticate user
    const { userId } = await getAuthenticatedUser();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Return recent decisions for the user
    if (!hasClerk || userId === 'dev-user') {
      // Return mock decisions for development
      return NextResponse.json({
        decisions: [
          {
            id: 'mock-1',
            action: 'accept',
            proposalId: 'rec-1',
            timestamp: new Date().toISOString(),
            recommendation: {
              title: 'Optimize Signal Timing',
              type: 'efficiency'
            }
          }
        ],
        timestamp: new Date().toISOString()
      });
    }

    try {
      const { createSupabaseServer } = await import('@/lib/supabase/server');
      const supabase = createSupabaseServer();
      
      // Fetch recent decisions from audit logs
      const { data: decisions } = await supabase
        .from('audit_logs')
        .select('details, timestamp')
        .eq('user_id', userId)
        .in('action', ['recommendation_accept', 'recommendation_reject'])
        .order('timestamp', { ascending: false })
        .limit(20);

      return NextResponse.json({
        decisions: decisions || [],
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.warn('Could not fetch decisions, returning empty list:', error);
      return NextResponse.json({
        decisions: [],
        timestamp: new Date().toISOString()
      });
    }

  } catch (error) {
    console.error('Error fetching decisions:', error);
    return NextResponse.json(
      { error: 'Failed to fetch decisions' },
      { status: 500 }
    );
  }
}
