import { NextRequest } from 'next/server';
import { createSupabaseServer } from '@/utils/supabase/server';

export const dynamic = 'force-dynamic';

function mockConflicts(limit: number) {
  const severities = ['low','medium','high','critical'] as const;
  const statuses = ['active','resolved','pending','escalated'] as const;
  const now = Date.now();
  const conflicts = Array.from({ length: limit }).map((_, i) => ({
    id: `C${1000 + i}`,
    type: (['schedule','route','platform','signal','maintenance'] as const)[i % 5],
    severity: severities[i % severities.length],
    status: statuses[i % statuses.length],
    trainIds: [`T${1000 + i}`, `T${1100 + i}`],
    stationId: i % 2 === 0 ? 'NDLS' : 'BCT',
    description: `Conflict ${i + 1} detected between operations`,
    predictedTime: new Date(now + (i % 60) * 60000).toISOString(),
    estimatedDuration: 10 + (i % 20),
    impact: {
      delayMinutes: 5 + (i % 30),
      affectedTrains: 2 + (i % 5),
      passengerImpact: 10 + (i % 90),
    },
    resolution: i % 3 === 0 ? {
      strategy: 'Reroute via alternate track',
      implementedAt: new Date(now - 600000).toISOString(),
      resolvedAt: i % 6 === 0 ? new Date(now - 300000).toISOString() : undefined,
      effectiveness: 80 - (i % 20),
    } : undefined,
    createdAt: new Date(now - 3600000).toISOString(),
    updatedAt: new Date(now - 600000).toISOString(),
  }));
  return { conflicts };
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const limit = Math.min(200, Math.max(1, Number(searchParams.get('limit') || '50')));
  const severity = searchParams.get('severity') || undefined;
  const status = searchParams.get('status') || undefined;

  try {
    const url = process.env.SUPABASE_URL;
    const anon = process.env.SUPABASE_ANON_KEY;
    if (url && anon) {
      const supabase = createSupabaseServer();
      let query = supabase.from('conflicts').select('*').limit(limit);
      if (severity) query = query.eq('severity', severity);
      if (status) query = query.eq('status', status);
      const { data, error } = await query;
      if (!error && Array.isArray(data)) {
        const conflicts = data.map((c: any, i: number) => ({
          id: c.id ?? `C${1000 + i}`,
          type: c.type ?? 'schedule',
          severity: c.severity ?? 'medium',
          status: c.status ?? 'active',
          trainIds: c.train_ids ?? c.trainIds ?? [],
          stationId: c.station_id ?? c.stationId ?? undefined,
          description: c.description ?? '',
          predictedTime: c.predicted_time ?? c.predictedTime ?? new Date().toISOString(),
          estimatedDuration: Number(c.estimated_duration ?? c.estimatedDuration ?? 10),
          impact: {
            delayMinutes: Number(c.impact_delay_minutes ?? c.impact?.delayMinutes ?? 10),
            affectedTrains: Number(c.impact_affected_trains ?? c.impact?.affectedTrains ?? 2),
            passengerImpact: Number(c.impact_passenger ?? c.impact?.passengerImpact ?? 50),
          },
          resolution: c.resolution ?? undefined,
          createdAt: c.created_at ?? c.createdAt ?? new Date().toISOString(),
          updatedAt: c.updated_at ?? c.updatedAt ?? new Date().toISOString(),
        }));
        return new Response(JSON.stringify({ conflicts }), { status: 200, headers: { 'content-type': 'application/json' } });
      }
    }
  } catch (_) {
    // ignore and fall back
  }

  const mock = mockConflicts(limit);
  const filtered = {
    conflicts: mock.conflicts.filter(c => (
      (!severity || c.severity === severity) && (!status || c.status === status)
    )),
  };
  return new Response(JSON.stringify(filtered), { status: 200, headers: { 'content-type': 'application/json' } });
}

