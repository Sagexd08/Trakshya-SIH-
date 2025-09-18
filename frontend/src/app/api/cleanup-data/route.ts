import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { auth } from '@clerk/nextjs/server';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

function getSupabase() {
  const url = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    // Avoid build-time crashes on Vercel when env isn't available
    throw new Error('Supabase env not configured (SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY)');
  }
  return createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export async function POST(request: NextRequest) {
  try {
    // Verify authentication and admin role
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const supabase = getSupabase();

    // Check if user is admin
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', userId)
      .single();

    if (!profile || profile.role !== 'admin') {
      return NextResponse.json(
        { error: 'Forbidden - Admin access required' },
        { status: 403 }
      );
    }

    const cleanupResults = {
      auditLogs: 0,
      trainData: 0,
      conflicts: 0,
      energyData: 0,
      anonymizedUsers: 0,
    };

    // Clean up old audit logs (older than 2 years)
    const twoYearsAgo = new Date();
    twoYearsAgo.setFullYear(twoYearsAgo.getFullYear() - 2);
    
    const { data: auditLogsDeletedRows } = await supabase
      .from('audit_logs')
      .delete()
      .lt('created_at', twoYearsAgo.toISOString())
      .select();

    cleanupResults.auditLogs = auditLogsDeletedRows?.length ?? 0;

    // Clean up old train data (older than 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    const { data: trainDataDeletedRows } = await supabase
      .from('train_data')
      .delete()
      .lt('timestamp', thirtyDaysAgo.toISOString())
      .select();

    cleanupResults.trainData = trainDataDeletedRows?.length ?? 0;

    // Clean up resolved conflicts (older than 7 days)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    
    const { data: conflictsDeletedRows } = await supabase
      .from('conflicts')
      .delete()
      .eq('status', 'resolved')
      .lt('updated_at', sevenDaysAgo.toISOString())
      .select();

    cleanupResults.conflicts = conflictsDeletedRows?.length ?? 0;

    // Clean up old energy data (older than 90 days)
    const ninetyDaysAgo = new Date();
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
    
    const { data: energyDataDeletedRows } = await supabase
      .from('energy_data')
      .delete()
      .lt('timestamp', ninetyDaysAgo.toISOString())
      .select();

    cleanupResults.energyData = energyDataDeletedRows?.length ?? 0;

    // Anonymize users who haven't been active for 1 year
    const oneYearAgo = new Date();
    oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
    
    const { data: inactiveUsers } = await supabase
      .from('profiles')
      .select('id')
      .lt('last_active', oneYearAgo.toISOString())
      .neq('email', 'anonymized@example.com'); // Don't re-anonymize

    if (inactiveUsers && inactiveUsers.length > 0) {
      for (const user of inactiveUsers) {
        try {
          // Anonymize profile
          await supabase
            .from('profiles')
            .update({
              email: `anonymized_${Date.now()}_${user.id.slice(0, 8)}@example.com`,
              first_name: 'Anonymized',
              last_name: 'User',
              updated_at: new Date().toISOString(),
            })
            .eq('id', user.id);

          // Anonymize audit logs
          await supabase
            .from('audit_logs')
            .update({
              ip_address: '0.0.0.0',
              user_agent: 'Anonymized',
            })
            .eq('user_id', user.id);

          cleanupResults.anonymizedUsers++;
        } catch (error) {
          console.error(`Failed to anonymize user ${user.id}:`, error);
        }
      }
    }

    // Log the cleanup operation
    await supabase
      .from('audit_logs')
      .insert({
        user_id: userId,
        action: 'DATA_CLEANUP',
        details: cleanupResults,
        ip_address: request.headers.get('x-forwarded-for') || 'unknown',
        user_agent: request.headers.get('user-agent') || 'unknown',
      });

    return NextResponse.json({
      success: true,
      message: 'Data cleanup completed successfully',
      results: cleanupResults,
      timestamp: new Date().toISOString(),
    });

  } catch (error) {
    console.error('Data cleanup failed:', error);
    
    return NextResponse.json(
      { 
        error: 'Data cleanup failed',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

// GET endpoint to check cleanup status
export async function GET(_request: NextRequest) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const supabase = getSupabase();

    // Get last cleanup operation
    const { data: lastCleanup } = await supabase
      .from('audit_logs')
      .select('*')
      .eq('action', 'DATA_CLEANUP')
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    // Get data counts for monitoring
    const [
      { count: auditLogsCount },
      { count: trainDataCount },
      { count: conflictsCount },
      { count: energyDataCount },
    ] = await Promise.all([
      supabase.from('audit_logs').select('*', { count: 'exact', head: true }),
      supabase.from('train_data').select('*', { count: 'exact', head: true }),
      supabase.from('conflicts').select('*', { count: 'exact', head: true }),
      supabase.from('energy_data').select('*', { count: 'exact', head: true }),
    ]);

    return NextResponse.json({
      lastCleanup: lastCleanup || null,
      currentCounts: {
        auditLogs: auditLogsCount || 0,
        trainData: trainDataCount || 0,
        conflicts: conflictsCount || 0,
        energyData: energyDataCount || 0,
      },
      nextCleanupDue: lastCleanup 
        ? new Date(new Date(lastCleanup.created_at).getTime() + 24 * 60 * 60 * 1000).toISOString()
        : new Date().toISOString(),
    });

  } catch (error) {
    console.error('Failed to get cleanup status:', error);
    
    return NextResponse.json(
      { 
        error: 'Failed to get cleanup status',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
