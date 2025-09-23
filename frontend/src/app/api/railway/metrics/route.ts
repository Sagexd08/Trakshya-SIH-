import { NextRequest } from 'next/server';
import { createSupabaseServer } from '@/utils/supabase/server';

export const dynamic = 'force-dynamic';

export async function GET(_req: NextRequest) {
  // Try to compute metrics from Supabase if configured; otherwise return mock
  try {
    const url = process.env.SUPABASE_URL;
    const anon = process.env.SUPABASE_ANON_KEY;
    if (url && anon) {
      const supabase = createSupabaseServer();
      const [trainsCount, activeTrains, delayedTrains, conflictsActive] = await Promise.all([
        supabase.from('trains').select('*', { count: 'exact', head: true }),
        supabase.from('trains').select('*', { count: 'exact', head: true }).neq('status', 'terminated'),
        supabase.from('trains').select('*', { count: 'exact', head: true }).gt('delay', 0),
        supabase.from('conflicts').select('*', { count: 'exact', head: true }).eq('status', 'active'),
      ]);

      const totalTrains = trainsCount.count ?? 0;
      const active = activeTrains.count ?? Math.max(0, Math.floor(totalTrains * 0.7));
      const delayed = delayedTrains.count ?? Math.max(0, Math.floor(totalTrains * 0.25));
      const activeConflicts = conflictsActive.count ?? 0;

      const avgDelay = totalTrains > 0 ? Math.round((delayed / Math.max(1, totalTrains)) * 30) : 0;
      const onTime = totalTrains > 0 ? Math.max(0, Math.min(100, Math.round(((totalTrains - delayed) / totalTrains) * 100))) : 100;

      const body = {
        totalTrains,
        activeTrains: active,
        delayedTrains: delayed,
        onTimePerformance: onTime,
        averageDelay: avgDelay,
        throughput: Math.max(0, Math.round(active * 0.85)),
        energyEfficiency: 92,
        activeConflicts,
        resolvedConflicts: Math.max(0, Math.round(activeConflicts * 0.6)),
        systemHealth: Math.max(50, 100 - activeConflicts * 3),
        lastUpdate: new Date().toISOString(),
      };
      return new Response(JSON.stringify(body), { status: 200, headers: { 'content-type': 'application/json' } });
    }
  } catch (_) {
    // ignore and fall back
  }

  // Mock fallback (keeps pages responsive in dev)
  const totalTrains = 240;
  const delayedTrains = 62;
  const activeTrains = 180;
  const activeConflicts = 7;
  const body = {
    totalTrains,
    activeTrains,
    delayedTrains,
    onTimePerformance: Math.round(((totalTrains - delayedTrains) / totalTrains) * 100),
    averageDelay: 12,
    throughput: 156,
    energyEfficiency: 93,
    activeConflicts,
    resolvedConflicts: 11,
    systemHealth: 91,
    lastUpdate: new Date().toISOString(),
  };
  return new Response(JSON.stringify(body), { status: 200, headers: { 'content-type': 'application/json' } });
}

