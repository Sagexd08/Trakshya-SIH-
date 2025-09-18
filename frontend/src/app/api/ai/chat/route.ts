import { NextRequest, NextResponse } from 'next/server';
import { geminiService, SystemContext, ChatMessage } from '@/lib/gemini';
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
    const { message, context, history = [] } = body;

    if (!message || typeof message !== 'string') {
      return NextResponse.json({ error: 'Message is required' }, { status: 400 });
    }

    // Build system context
    const systemContext: SystemContext = {
      activeTrains: context?.activeTrains || 0,
      conflicts: context?.conflicts || [],
      energyEfficiency: context?.energyEfficiency || 0,
      avgDelay: context?.avgDelay || 0,
      throughput: context?.throughput || 0,
      userRole: userRole,
      currentView: context?.currentView || 'dashboard'
    };

    // Generate AI response
    const response = await geminiService.chatWithAssistant(
      message,
      systemContext,
      history
    );

    // Store chat interaction for audit (only if Supabase is configured)
    if (hasClerk && userId !== 'dev-user') {
      try {
        const supabase = createSupabaseServer();
        await supabase.from('audit_logs').insert({
          user_id: userId,
          action: 'ai_chat_interaction',
          details: {
            message: message.substring(0, 100), // Truncate for storage
            response_length: response.content.length,
            context: systemContext
          },
          timestamp: new Date().toISOString()
        });
      } catch (error) {
        console.warn('Could not log chat audit entry:', error);
      }
    }

    return NextResponse.json({
      message: response,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Error in AI chat:', error);
    return NextResponse.json(
      { error: 'Failed to process chat message' },
      { status: 500 }
    );
  }
}

// GET endpoint for chat history (if needed)
export async function GET(_request: NextRequest) {
  try {
    const { userId } = await getAuthenticatedUser();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!hasClerk || userId === 'dev-user') {
      // Return mock chat history for development
      return NextResponse.json({
        history: [
          {
            details: {
              message: 'What is the current system status?',
              response_length: 150,
              context: { activeTrains: 24, userRole: 'controller' }
            },
            timestamp: new Date().toISOString()
          }
        ],
        timestamp: new Date().toISOString()
      });
    }

    try {
      const supabase = createSupabaseServer();

      // Fetch recent chat interactions from audit logs
      const { data: chatHistory } = await supabase
        .from('audit_logs')
        .select('details, timestamp')
        .eq('user_id', userId)
        .eq('action', 'ai_chat_interaction')
        .order('timestamp', { ascending: false })
        .limit(20);

      return NextResponse.json({
        history: chatHistory || [],
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.warn('Could not fetch chat history, returning empty list:', error);
      return NextResponse.json({
        history: [],
        timestamp: new Date().toISOString()
      });
    }

  } catch (error) {
    console.error('Error fetching chat history:', error);
    return NextResponse.json(
      { error: 'Failed to fetch chat history' },
      { status: 500 }
    );
  }
}
