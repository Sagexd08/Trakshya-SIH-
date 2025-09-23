import { NextRequest, NextResponse } from 'next/server';
import * as tf from '@tensorflow/tfjs';
import * as Sentry from '@sentry/nextjs';
import { createSupabaseServer } from '@/lib/supabase/server';

/*
  Simple LSTM time series forecaster with robust fallbacks.
  Input JSON examples:
  - { series: number[], horizon?: number }
  - { trains: [{ id: string, series: number[] }], horizon?: number }
*/

async function getAccuracyBucket(horizonMinutes: number): Promise<'high'|'medium'|'low'|'unknown'> {
  try {
    const supabase = createSupabaseServer();
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { data, error } = await supabase
      .from('prediction_accuracy')
      .select('accuracy_score')
      .eq('horizon_minutes', horizonMinutes)
      .gte('prediction_timestamp', since)
      .limit(200);
    if (error || !data || data.length === 0) return 'unknown';
    const vals = data.map((d: any) => Number(d.accuracy_score)).filter((n) => Number.isFinite(n));
    if (!vals.length) return 'unknown';
    const avg = vals.reduce((a, b) => a + b, 0) / vals.length;
    if (avg >= 0.8) return 'high';
    if (avg >= 0.6) return 'medium';
    return 'low';
  } catch {
    return 'unknown';
  }
}

function safeForecast(series: number[], horizon: number) {
  // Fallback: exponential smoothing based projection
  const alpha = 0.5;
  let level = series[0] ?? 0;
  for (let i = 1; i < series.length; i++) level = alpha * series[i] + (1 - alpha) * level;
  return Array.from({ length: horizon }, (_, i) => level);
}

async function lstmForecast(series: number[], horizon: number) {
  if (!Array.isArray(series) || series.length < 8) return safeForecast(series, horizon);

  // Prepare supervised learning pairs (window -> next)
  const windowSize = Math.min(12, Math.max(4, Math.floor(series.length / 4)));
  const xs: number[][] = [];
  const ys: number[] = [];
  for (let i = 0; i < series.length - windowSize; i++) {
    xs.push(series.slice(i, i + windowSize));
    ys.push(series[i + windowSize]);
  }

  const xTensor = tf.tensor(xs).reshape([xs.length, windowSize, 1]);
  const yTensor = tf.tensor(ys).reshape([ys.length, 1]);

  const model = tf.sequential();
  model.add(tf.layers.lstm({ units: 16, inputShape: [windowSize, 1] }));
  model.add(tf.layers.dense({ units: 1 }));
  model.compile({ optimizer: tf.train.adam(0.01), loss: 'meanSquaredError' });

  // Quick fit (limit to keep API responsive)
  await model.fit(xTensor, yTensor, { epochs: 15, batchSize: 8, verbose: 0 });

  // Roll-forward forecasting
  const history = series.slice(-windowSize);
  const out: number[] = [];
  for (let i = 0; i < horizon; i++) {
    const pred = tf.tidy(() => {
      const input = tf.tensor(history).reshape([1, windowSize, 1]);
      const yhat = model.predict(input) as tf.Tensor;
      return yhat.dataSync()[0];
    });
    out.push(pred);
    history.shift();
    history.push(pred);
  }

  xTensor.dispose(); yTensor.dispose();
  model.dispose();

  return out;
}

export async function POST(req: NextRequest) {
  return Sentry.startSpan({ name: 'api/prediction/lstm', op: 'http.server' }, async () => {
    const t0 = Date.now();
    try {
      const body = await req.json();
      const horizon = Math.max(1, Math.min(60, Number(body.horizon ?? 12)));
      const horizonMinutes = horizon * 5; // 1 step ~= 5 minutes
      Sentry.setTags({ 'prediction.type': 'lstm', 'model.version': 'tfjs-4.22' });
      Sentry.setTag('pred_horizon', String(horizonMinutes));
      try { (Sentry as any)?.metrics?.increment?.('prediction.lstm.request'); } catch {}
      try {
        const bucket = await getAccuracyBucket(horizonMinutes);
        Sentry.setTag('pred_accuracy_bucket', bucket);
      } catch {}

      if (Array.isArray(body.trains)) {
        const inputSize = body.trains.reduce((acc: number, t: any) => acc + ((t?.series || []).length), 0);
        Sentry.setTag('input.size', String(inputSize));

        const results = await Promise.all(body.trains.map(async (t: any) => {
          try {
            const series: number[] = (t?.series || []).map((n: any) => Number(n)).filter((n: any) => Number.isFinite(n));
            const forecast = await lstmForecast(series, horizon).catch(() => safeForecast(series, horizon));
            return { id: t.id, forecast };
          } catch {
            return { id: t?.id ?? 'unknown', forecast: safeForecast([], horizon), meta: { mock: true } };
          }
        }));

        // Opportunistically log predictions for future accuracy evaluation (best-effort)
        try {
          const supabase = createSupabaseServer();
          const now = new Date().toISOString();
          const rows: any[] = [];
          for (const r of results) {
            const fc = Array.isArray(r.forecast) ? r.forecast : [];
            const candidates: Array<{ idx: number; minutes: number }> = [
              { idx: 1, minutes: 5 }, { idx: 3, minutes: 15 }, { idx: 5, minutes: 30 }
            ];
            for (const c of candidates) {
              if (fc.length > c.idx) {
                rows.push({
                  train_id: String(r.id),
                  predicted_delay: Number(fc[c.idx]) || 0,
                  actual_delay: null,
                  horizon_minutes: c.minutes,
                  prediction_timestamp: now,
                  accuracy_score: null,
                });
              }
            }
          }
          if (rows.length) {
            await supabase.from('prediction_accuracy').insert(rows as any);
          }
        } catch {}

        return NextResponse.json({ ok: true, horizon, results, t: Date.now() - t0 });
      }

      if (Array.isArray(body.series)) {
        const series: number[] = body.series.map((n: any) => Number(n)).filter(Number.isFinite);
        Sentry.setTag('input.size', String(series.length));
        const forecast = await lstmForecast(series, horizon).catch(() => safeForecast(series, horizon));
        return NextResponse.json({ ok: true, horizon, forecast, t: Date.now() - t0 });
      }

      return NextResponse.json({ error: 'Expected { series:number[] } or { trains:[{id,series}] }' }, { status: 400 });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      Sentry.captureException(e);
      return NextResponse.json({ ok: true, forecast: safeForecast([], 12), meta: { mock: true, reason: msg } }, { status: 200 });
    }
  });
}

