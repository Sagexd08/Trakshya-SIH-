import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServer } from '@/lib/supabase/server';
import * as Sentry from '@sentry/nextjs';

// Evaluate pending predictions whose horizon window has passed by comparing to latest actual delays
// This endpoint is intended to be invoked periodically (e.g., via Vercel cron)
export async function GET(req: NextRequest) {
  return Sentry.startSpan({ name: 'api/prediction/accuracy/evaluate#get', op: 'http.server' }, async () => {
    try {
      const supabase = createSupabaseServer();

      // Fetch up to N pending rows (no actual_delay) that have exceeded their horizon window
      const now = Date.now();
      const since = new Date(now - 7 * 24 * 60 * 60 * 1000).toISOString();
      const { data: pending, error } = await supabase
        .from('prediction_accuracy')
        .select('id, train_id, predicted_delay, horizon_minutes, prediction_timestamp')
        .is('actual_delay', null)
        .gte('prediction_timestamp', since)
        .limit(250);
      if (error) throw error;

      const updates: Array<{ id: number; actual_delay: number; accuracy_score: number } | null> = await Promise.all((pending || []).map(async (row: any) => {
        try {
          const tPred = new Date(row.prediction_timestamp).getTime();
          const dueAt = tPred + Number(row.horizon_minutes || 0) * 60 * 1000;
          if (now < dueAt) return null; // not due yet

          // Look up the latest actual delay for this train
          const { data: actualRows, error: err2 } = await supabase
            .from('train_delay_history')
            .select('delay_minutes')
            .eq('train_id', row.train_id)
            .order('timestamp', { ascending: false })
            .limit(1);
          if (err2) throw err2;

          const actual = actualRows && actualRows.length ? Number(actualRows[0].delay_minutes || 0) : null;
          if (actual == null || !Number.isFinite(actual)) return null;

          const pred = Number(row.predicted_delay || 0);
          const err = Math.abs(pred - actual);
          // Continuous accuracy: 1 at 0 error, linearly decay to 0 at 10 minutes error (cap at 0)
          const accuracy = Math.max(0, 1 - err / 10);
          return { id: row.id, actual_delay: actual, accuracy_score: accuracy } as any;
        } catch {
          return null;
        }
      }));

      const rowsToUpdate = updates.filter(Boolean) as any[];
      if (rowsToUpdate.length) {
        // Batch update via upsert on id
        const { error: upErr } = await supabase.from('prediction_accuracy').upsert(rowsToUpdate, { onConflict: 'id' } as any);
        if (upErr) throw upErr;
      }

      return NextResponse.json({ ok: true, evaluated: rowsToUpdate.length });
    } catch (e) {
      Sentry.captureException(e);
      return NextResponse.json({ ok: true, evaluated: 0, meta: { mock: true } }, { status: 200 });
    }
  });
}

