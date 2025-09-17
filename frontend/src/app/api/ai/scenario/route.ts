import { NextRequest, NextResponse } from 'next/server';
import { geminiService, SystemContext } from '@/lib/gemini';
import { createSupabaseServer } from '@/lib/supabase/server';

// Check if Clerk is configured
const hasClerk = !!process.env.CLERK_PUBLISHABLE_KEY && !!process.env.CLERK_SECRET_KEY;

async function getAuthenticatedUser() {
  if (!hasClerk) {
    // Return mock user for development
    return { userId: 'dev-user', role: 'operator' };
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
    const { userId, role: defaultRole } = await getAuthenticatedUser();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Define allowed roles
    type AllowedRole = "admin" | "controller" | "analyst";
    const allowedRoles: AllowedRole[] = ["admin", "controller", "analyst"];

    // Get user role from Supabase or use default
    let userRole: AllowedRole = allowedRoles.includes(defaultRole as AllowedRole)
      ? (defaultRole as AllowedRole)
      : "analyst";

    if (hasClerk && userId !== 'dev-user') {
      try {
        const supabase = createSupabaseServer();
        const { data: profile } = await supabase
          .from('profiles')
          .select('role')
          .eq('clerk_id', userId)
          .single();

        if (profile?.role && allowedRoles.includes(profile.role)) {
          userRole = profile.role as AllowedRole;
        }
      } catch (error) {
        console.warn('Could not fetch user profile, using default role:', error);
      }
    }

    // Parse request body
    const body = await request.json();
    const { scenario, context } = body;

    if (!scenario || typeof scenario !== 'string') {
      return NextResponse.json({ error: 'Scenario description is required' }, { status: 400 });
    }

    // Build system context
    const systemContext: SystemContext = {
      activeTrains: context?.activeTrains || 0,
      conflicts: context?.conflicts || [],
      energyEfficiency: context?.energyEfficiency || 0,
      avgDelay: context?.avgDelay || 0,
      throughput: context?.throughput || 0,
      userRole: userRole,
      currentView: context?.currentView || 'scenarios'
    };

    // Generate scenario impact analysis
    const analysis = await geminiService.explainScenarioImpact(scenario, systemContext);

    // Store scenario analysis for future reference (only if Supabase is configured)
    if (hasClerk && userId !== 'dev-user') {
      try {
        const supabase = createSupabaseServer();
        await supabase.from('scenarios').insert({
          name: scenario.substring(0, 100), // Truncate for storage
          payload: {
            scenario,
            analysis,
            context: systemContext,
            user_id: userId,
            timestamp: new Date().toISOString()
          }
        });

        // Log the request for audit purposes
        await supabase.from('audit_logs').insert({
          user_id: userId,
          action: 'ai_scenario_analysis',
          details: {
            scenario: scenario.substring(0, 100),
            analysis_length: analysis.length,
            context: systemContext
          },
          timestamp: new Date().toISOString()
        });
      } catch (error) {
        console.warn('Could not store scenario analysis:', error);
      }
    }

    return NextResponse.json({
      scenario,
      analysis,
      context: systemContext,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Error analyzing scenario:', error);
    return NextResponse.json(
      { error: 'Failed to analyze scenario' },
      { status: 500 }
    );
  }
}

// GET endpoint for saved scenarios
export async function GET(request: NextRequest) {
  try {
    // Authenticate user using the same method as POST
    const { userId } = await getAuthenticatedUser();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Only fetch scenarios if we have proper authentication and Supabase
    if (!hasClerk || userId === 'dev-user') {
      // Return mock scenarios for development
      return NextResponse.json({
        scenarios: [
          {
            id: 'mock-1',
            name: 'Peak Hour Traffic Optimization',
            payload: {
              scenario: 'Optimize train scheduling during peak hours',
              analysis: 'Mock analysis for development',
              timestamp: new Date().toISOString()
            },
            created_at: new Date().toISOString()
          }
        ],
        timestamp: new Date().toISOString()
      });
    }

    const supabase = createSupabaseServer();

    // Fetch saved scenarios
    const { data: scenarios } = await supabase
      .from('scenarios')
      .select('id, name, payload, created_at')
      .order('created_at', { ascending: false })
      .limit(50);

    return NextResponse.json({
      scenarios: scenarios || [],
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Error fetching scenarios:', error);
    return NextResponse.json(
      { error: 'Failed to fetch scenarios' },
      { status: 500 }
    );
  }
}
