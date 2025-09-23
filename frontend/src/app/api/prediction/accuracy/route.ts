import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServer } from '@/lib/supabase/server';
import * as Sentry from '@sentry/nextjs';

// GET: Aggregate accuracy metrics
//   /api/prediction/accuracy?window=7d&horizon=5|15|30
export async function GET(req: NextRequest) {
  return Sentry.startSpan({ name: 'api/prediction/accuracy#get', op: 'http.server' }, async () => {
    try {
      const { searchParams } = new URL(req.url);
      const windowParam = searchParams.get('window') || '7d';
      const horizonParam = searchParams.get('horizon');
      const now = Date.now();
      const windowMs = windowParam.endsWith('d')
        ? parseInt(windowParam) * 24 * 60 * 60 * 1000
        : windowParam.endsWith('h')
          ? parseInt(windowParam) * 60 * 60 * 1000
          : 7 * 24 * 60 * 60 * 1000; // default 7d
      const since = new Date(now - windowMs).toISOString();

      const supabase = createSupabaseServer();

      let query = supabase
        .from('prediction_accuracy')
        .select('horizon_minutes, predicted_delay, actual_delay, accuracy_score, prediction_timestamp')
        .gte('prediction_timestamp', since);

      if (horizonParam) {
        const h = Number(horizonParam);
        if (Number.isFinite(h)) query = query.eq('horizon_minutes', h);
      }

      const { data, error } = await query.limit(2000);
      if (error) throw error;

      // Aggregate by horizon
      const byH: Record<string, { count: number; within2: number; within5: number; avgAcc: number; accs: number[] }>
        = {};
      for (const row of data || []) {
        const key = String(row.horizon_minutes);
        if (!byH[key]) byH[key] = { count: 0, within2: 0, within5: 0, avgAcc: 0, accs: [] };
        byH[key].count += 1;
        const pred = Number(row.predicted_delay);
        const act = row.actual_delay == null ? null : Number(row.actual_delay);
        if (act != null && Number.isFinite(pred) && Number.isFinite(act)) {
          const err = Math.abs(pred - act);
          if (err <= 2) byH[key].within2 += 1;
          if (err <= 5) byH[key].within5 += 1;
        }
        const acc = row.accuracy_score == null ? null : Number(row.accuracy_score);
        if (acc != null && Number.isFinite(acc)) byH[key].accs.push(acc);
      }
      const horizons = Object.keys(byH).sort((a,b)=>Number(a)-Number(b)).map((k) => {
        const s = byH[k];
        const avgAcc = s.accs.length ? s.accs.reduce((a,b)=>a+b,0)/s.accs.length : null;
        const pct2 = s.count ? Math.round((s.within2 / s.count) * 100) : null;
        const pct5 = s.count ? Math.round((s.within5 / s.count) * 100) : null;
        return { horizon_minutes: Number(k), count: s.count, pct_within_2m: pct2, pct_within_5m: pct5, avg_accuracy: avgAcc };
      });

      return NextResponse.json({ ok: true, since, horizons });
    } catch (e) {
      Sentry.captureException(e);
      return NextResponse.json({ ok: true, horizons: [] }, { status: 200 });
    }
  });
}

// POST: Insert accuracy records (or prediction placeholders)
// body: { items: Array<{ train_id: string, predicted_delay: number, actual_delay?: number|null, horizon_minutes: number, prediction_timestamp?: string, accuracy_score?: number|null }> }
export async function POST(req: NextRequest) {
  return Sentry.startSpan({ name: 'api/prediction/accuracy#post', op: 'http.server' }, async () => {
    try {
      const body = await req.json();
      const items = Array.isArray(body?.items) ? body.items : [];
      if (!items.length) return NextResponse.json({ ok: true, inserted: 0 });
      const supabase = createSupabaseServer();
      const sanitized = items.map((r: any) => ({
        train_id: String(r.train_id || ''),
        predicted_delay: Number(r.predicted_delay || 0),
        actual_delay: r.actual_delay == null ? null : Number(r.actual_delay),
        horizon_minutes: Number(r.horizon_minutes || 0),
        prediction_timestamp: r.prediction_timestamp || new Date().toISOString(),
        accuracy_score: r.accuracy_score == null ? null : Number(r.accuracy_score),
      }));
      const { error } = await supabase.from('prediction_accuracy').insert(sanitized as any);
      if (error) throw error;
      return NextResponse.json({ ok: true, inserted: sanitized.length });
    } catch (e) {
      Sentry.captureException(e);
      return NextResponse.json({ ok: false, inserted: 0, meta: { mock: true } }, { status: 200 });
    }
  });
}

