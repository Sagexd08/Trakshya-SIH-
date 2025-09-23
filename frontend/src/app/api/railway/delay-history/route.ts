import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseAdmin, createSupabaseServer } from '@/utils/supabase/server'
import * as Sentry from '@sentry/nextjs'

// NOTE: Create this table and indexes in your Supabase project:
//
// create table if not exists public.train_delay_history (
//   id bigint primary key generated always as identity,
//   train_id text not null,
//   delay_minutes integer not null,
//   timestamp timestamptz not null default now(),
//   station_code text
// );
// create index if not exists idx_tdh_train_time on public.train_delay_history (train_id, timestamp desc);
// create index if not exists idx_tdh_time on public.train_delay_history (timestamp desc);
// -- Optional RLS (adjust as needed)
// alter table public.train_delay_history enable row level security;
// create policy "Allow read to anon" on public.train_delay_history for select using (true);
// create policy "Allow insert to anon" on public.train_delay_history for insert with check (true);

function getClients() {
  try {
    return { admin: createSupabaseAdmin(), adminAvailable: true }
  } catch {
    // Fallback to non-privileged client for read-only operations
    try {
      const server = createSupabaseServer()
      return { server, adminAvailable: false }
    } catch {
      return { server: null as any, adminAvailable: false }
    }
  }
}

async function cleanupOlderThan(days = 7) {
  const { admin, adminAvailable, server } = getClients()
  if (!adminAvailable) return { ok: false, reason: 'no_service_role' }
  const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString()
  const { error } = await (admin as any).from('train_delay_history').delete().lt('timestamp', cutoff)
  if (error) return { ok: false, error: error.message }
  return { ok: true }
}

export async function GET(req: NextRequest) {
  return Sentry.startSpan({ name: 'api/railway/delay-history[GET]', op: 'http.server' }, async () => {
    const t0 = Date.now()
    try {
      const url = new URL(req.url)
      const trainId = url.searchParams.get('train_id') || undefined
      const trainIdsCsv = url.searchParams.get('train_ids') || undefined
      const limit = Math.min(200, Math.max(1, Number(url.searchParams.get('limit') || '15')))
      const since = url.searchParams.get('since') || undefined

      const { server } = getClients()
      if (!server) return NextResponse.json({ ok: true, items: [], meta: { mock: true, reason: 'no_supabase' } })

      let query = server.from('train_delay_history').select('*').order('timestamp', { ascending: false }).limit(limit)
      if (trainId) query = query.eq('train_id', trainId)
      if (trainIdsCsv) query = query.in('train_id', trainIdsCsv.split(',').map(s => s.trim()).filter(Boolean))
      if (since) query = query.gte('timestamp', since)

      const { data, error } = await query
      if (error) return NextResponse.json({ ok: true, items: [], meta: { mock: true, reason: error.message } })

      const dt = Date.now() - t0
      return NextResponse.json({ ok: true, items: data || [], t: dt })
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      return NextResponse.json({ ok: true, items: [], meta: { mock: true, reason: msg } })
    }
  })
}

export async function POST(req: NextRequest) {
  return Sentry.startSpan({ name: 'api/railway/delay-history[POST]', op: 'http.server' }, async () => {
    const t0 = Date.now()
    try {
      const body = await req.json().catch(() => ({}))
      const items = Array.isArray(body?.items) ? body.items : (body?.train_id ? [body] : [])
      if (!items.length) {
        return NextResponse.json({ error: 'No items to insert' }, { status: 400 })
      }

      const norm = items.map((r: any) => ({
        train_id: String(r.train_id),
        delay_minutes: Number(r.delay_minutes ?? 0),
        timestamp: r.timestamp ? new Date(r.timestamp).toISOString() : new Date().toISOString(),
        station_code: r.station_code ? String(r.station_code) : null,
      }))

      const { admin, adminAvailable, server } = getClients()
      const client = adminAvailable ? admin : server
      if (!client) return NextResponse.json({ ok: true, inserted: 0, meta: { mock: true, reason: 'no_supabase' } })

      const { error } = await client.from('train_delay_history').insert(norm)
      if (error) return NextResponse.json({ ok: true, inserted: 0, meta: { mock: true, reason: error.message } })

      // Opportunistic cleanup (server role only)
      if (adminAvailable) {
        void cleanupOlderThan(7)
      }

      const dt = Date.now() - t0
      return NextResponse.json({ ok: true, inserted: norm.length, t: dt })
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      return NextResponse.json({ ok: true, inserted: 0, meta: { mock: true, reason: msg } })
    }
  })
}

export async function DELETE(req: NextRequest) {
  return Sentry.startSpan({ name: 'api/railway/delay-history[DELETE]', op: 'http.server' }, async () => {
    try {
      const url = new URL(req.url)
      const action = url.searchParams.get('action') || ''
      const olderThan = Math.max(1, Number(url.searchParams.get('older_than_days') || '7'))
      const trainId = url.searchParams.get('train_id') || undefined

      const { admin, adminAvailable, server } = getClients()
      if (!adminAvailable) return NextResponse.json({ ok: false, meta: { reason: 'no_service_role' } }, { status: 200 })

      if (action === 'cleanup' || !trainId) {
        const res = await cleanupOlderThan(olderThan)
        return NextResponse.json({ ok: !!res.ok, meta: res })
      }

      const cutoff = new Date(Date.now() - olderThan * 86400 * 1000).toISOString()
      const { error } = await (admin as any).from('train_delay_history').delete().eq('train_id', trainId).lt('timestamp', cutoff)
      if (error) return NextResponse.json({ ok: false, error: error.message })
      return NextResponse.json({ ok: true })
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      return NextResponse.json({ ok: false, error: msg })
    }
  })
}

