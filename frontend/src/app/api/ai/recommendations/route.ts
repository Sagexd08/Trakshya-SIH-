import { NextRequest, NextResponse } from 'next/server';
import { geminiService, SystemContext } from '@/lib/gemini';
import { createSupabaseServer } from '@/lib/supabase/server';

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
      : "controller";

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
    const context: SystemContext = {
      activeTrains: body.activeTrains || 0,
      conflicts: body.conflicts || [],
      energyEfficiency: body.energyEfficiency || 0,
      avgDelay: body.avgDelay || 0,
      throughput: body.throughput || 0,
      userRole: userRole,
      currentView: body.currentView || 'dashboard'
    };

    // Generate recommendations using Gemini
    const recommendations = await geminiService.generateRecommendations(context);

    // Log the request for audit purposes (only if Supabase is configured)
    if (hasClerk && userId !== 'dev-user') {
      try {
        const supabase = createSupabaseServer();
        await supabase.from('audit_logs').insert({
          user_id: userId,
          action: 'ai_recommendations_requested',
          details: { context, recommendations_count: recommendations.length },
          timestamp: new Date().toISOString()
        });
      } catch (error) {
        console.warn('Could not log audit entry:', error);
      }
    }

    return NextResponse.json({ 
      recommendations,
      timestamp: new Date().toISOString(),
      context 
    });

  } catch (error) {
    console.error('Error generating recommendations:', error);
    return NextResponse.json(
      { error: 'Failed to generate recommendations' },
      { status: 500 }
    );
  }
}

export async function GET(_request: NextRequest) {
  try {
    const { userId, role: defaultRole } = await getAuthenticatedUser();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Define allowed roles
    type AllowedRole = "admin" | "controller" | "analyst";
    const allowedRoles: AllowedRole[] = ["admin", "controller", "analyst"];

    // Get user role
    const userRole: AllowedRole = allowedRoles.includes(defaultRole as AllowedRole)
      ? (defaultRole as AllowedRole)
      : "controller";

    // Mock data for development or fetch from Supabase
    let context: SystemContext;

    if (!hasClerk || userId === 'dev-user') {
      // Return mock data for development
      context = {
        activeTrains: 24,
        conflicts: [
          { id: 'mock-1', trainA: 'T001', trainB: 'T002', severity: 'high', predictedTime: '14:30' }
        ],
        energyEfficiency: 87.5,
        avgDelay: 2.3,
        throughput: 92,
        userRole: userRole,
        currentView: 'dashboard'
      };
    } else {
      // Get current system metrics from Supabase
      const supabase = createSupabaseServer();

      try {
        // Fetch real-time data
        const [trainsResult, conflictsResult, energyResult] = await Promise.all([
          supabase.from('trains').select('id, delay').limit(1000),
          supabase.from('conflicts').select('*').eq('severity', 'high'),
          supabase.from('energy_logs').select('baseline, optimized').order('timestamp', { ascending: false }).limit(100)
        ]);

        // Calculate metrics
        const activeTrains = trainsResult.data?.length || 0;
        const conflicts = conflictsResult.data?.map(c => ({
          id: c.id,
          trainA: c.train_a,
          trainB: c.train_b,
          severity: c.severity,
          predictedTime: c.predicted_time
        })) || [];

        const totalDelay = (trainsResult.data ?? []).reduce((sum, train) => sum + ((train as { delay?: number }).delay ?? 0), 0);
        const avgDelay = activeTrains > 0 ? totalDelay / activeTrains : 0;

        const energyData = energyResult.data ?? [];
        const energyEfficiency = energyData.length > 0
          ? (energyData.reduce((sum, e) => {
              const baseline = (e as { baseline?: number }).baseline ?? 1;
              const optimized = (e as { optimized?: number }).optimized ?? baseline;
              return sum + (baseline > 0 ? optimized / baseline : 1);
            }, 0) / energyData.length) * 100
          : 90;

        context = {
          activeTrains,
          conflicts,
          energyEfficiency,
          avgDelay,
          throughput: Math.max(70, 100 - (avgDelay * 2) - (conflicts.length * 5)),
          userRole: userRole,
          currentView: 'dashboard'
        };
      } catch (error) {
        console.warn('Could not fetch real data, using mock data:', error);
        // Fallback to mock data
        context = {
          activeTrains: 24,
          conflicts: [],
          energyEfficiency: 87.5,
          avgDelay: 2.3,
          throughput: 92,
          userRole: userRole,
          currentView: 'dashboard'
        };
      }
    }

    const recommendations = await geminiService.generateRecommendations(context);

    return NextResponse.json({
      recommendations,
      context,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Error fetching recommendations:', error);
    return NextResponse.json(
      { error: 'Failed to fetch recommendations' },
      { status: 500 }
    );
  }
}
