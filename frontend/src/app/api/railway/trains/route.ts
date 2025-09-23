import { NextRequest } from 'next/server';
import { createSupabaseServer } from '@/utils/supabase/server';

export const dynamic = 'force-dynamic';

function mockTrains(limit: number, status?: string) {
  const types = ['passenger','freight','express','local','special'] as const;
  const statuses = ['on_time','delayed','cancelled','diverted','terminated'] as const;
  const trains = Array.from({ length: limit }).map((_, i) => {
    const delayed = i % 3 === 0;
    const s = (status as any) || (delayed ? 'delayed' : 'on_time');
    return {
      id: `T${1000 + i}`,
      number: String(10000 + i),
      name: `Train ${i + 1}`,
      type: types[i % types.length],
      status: s,
      currentStation: 'NDLS',
      nextStation: 'AGC',
      destination: 'BCT',
      origin: 'HWH',
      delay: delayed ? (i % 5) * 5 : 0,
      speed: 40 + (i % 60),
      position: { lat: 22 + (i % 10) * 0.2, lng: 77 + (i % 10) * 0.2 },
      schedule: {
        departure: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
        arrival: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
        estimatedArrival: new Date(Date.now() + 2.2 * 60 * 60 * 1000).toISOString(),
        estimatedDeparture: new Date(Date.now() - 50 * 60 * 1000).toISOString(),
      },
      capacity: { total: 1000, occupied: 800 - (i % 200), reserved: 50 + (i % 50) },
      energy: { consumption: 120 + (i % 40), efficiency: 90 - (i % 10), mode: 'normal' as const },
      lastUpdate: new Date().toISOString(),
    };
  });
  return { trains };
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const limit = Math.min(200, Math.max(1, Number(searchParams.get('limit') || '50')));
  const offset = Math.max(0, Number(searchParams.get('offset') || '0'));
  const status = searchParams.get('status') || undefined;

  try {
    const url = process.env.SUPABASE_URL;
    const anon = process.env.SUPABASE_ANON_KEY;
    if (url && anon) {
      const supabase = createSupabaseServer();
      let query = supabase
        .from('trains')
        .select('*')
        .range(offset, offset + limit - 1);

      if (status) {
        query = query.eq('status', status);
      }

      const { data, error } = await query;
      if (!error && Array.isArray(data)) {
        // Map to UI type; if schema differs, best-effort mapping
        const trains = data.map((t: any, i: number) => ({
          id: t.id ?? `T${t.number ?? 1000 + i}`,
          number: String(t.number ?? 10000 + i),
          name: t.name ?? `Train ${i + 1}`,
          type: t.type ?? 'passenger',
          status: t.status ?? 'on_time',
          currentStation: t.current_station ?? t.currentStation ?? 'NDLS',
          nextStation: t.next_station ?? t.nextStation ?? 'AGC',
          destination: t.destination ?? 'BCT',
          origin: t.origin ?? 'HWH',
          delay: Number(t.delay ?? 0),
          speed: Number(t.speed ?? 50),
          position: {
            lat: Number(t.lat ?? t.position?.lat ?? 28.6),
            lng: Number(t.lng ?? t.position?.lng ?? 77.2),
            heading: typeof t.heading === 'number' ? t.heading : undefined,
          },
          schedule: {
            departure: t.departure ?? new Date().toISOString(),
            arrival: t.arrival ?? new Date(Date.now() + 3600000).toISOString(),
            estimatedArrival: t.estimated_arrival ?? t.estimatedArrival ?? new Date(Date.now() + 3900000).toISOString(),
            estimatedDeparture: t.estimated_departure ?? t.estimatedDeparture ?? new Date(Date.now() + 600000).toISOString(),
          },
          capacity: {
            total: Number(t.capacity_total ?? t.capacity?.total ?? 1000),
            occupied: Number(t.capacity_occupied ?? t.capacity?.occupied ?? 800),
            reserved: Number(t.capacity_reserved ?? t.capacity?.reserved ?? 50),
          },
          energy: {
            consumption: Number(t.energy_consumption ?? t.energy?.consumption ?? 120),
            efficiency: Number(t.energy_efficiency ?? t.energy?.efficiency ?? 90),
            mode: (t.energy_mode ?? t.energy?.mode ?? 'normal') as 'normal' | 'eco' | 'performance',
          },
          lastUpdate: t.updated_at ?? t.lastUpdate ?? new Date().toISOString(),
        }));
        return new Response(JSON.stringify({ trains }), { status: 200, headers: { 'content-type': 'application/json' } });
      }
    }
  } catch (_) {
    // ignore and fall back
  }

  return new Response(JSON.stringify(mockTrains(limit, status)), { status: 200, headers: { 'content-type': 'application/json' } });
}

