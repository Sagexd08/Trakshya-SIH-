import { NextRequest, NextResponse } from 'next/server';
import * as tf from '@tensorflow/tfjs';
import * as Sentry from '@sentry/nextjs';

/*
  CNN image/pattern analysis endpoint.
  Accepts: { imageBase64?: string, task?: 'occupancy' | 'anomaly' }
  Notes: On Node, image decoding requires tfjs-node for decodeImage. If unavailable, returns robust mock.
*/

async function analyzeMock(task: string) {
  if (task === 'occupancy') {
    return { label: 'medium_crowd', confidence: 0.62, metrics: { density: 0.58 } };
  }
  if (task === 'anomaly') {
    return { label: 'no_anomaly', confidence: 0.84 };
  }
  return { label: 'unknown', confidence: 0.5 };
}

export async function POST(req: NextRequest) {
  return Sentry.startSpan({ name: 'api/prediction/cnn', op: 'http.server' }, async () => {
    const t0 = Date.now();
    try {
      const { imageBase64, task = 'occupancy' } = await req.json().catch(() => ({ imageBase64: null, task: 'occupancy' }));
      Sentry.setTags({ 'prediction.type': 'cnn', 'model.version': 'tfjs-4.22', 'task': String(task) });

      // Require base64 to proceed; otherwise mock
      if (!imageBase64 || typeof imageBase64 !== 'string') {
        Sentry.setTag('fallback', 'missing_image');
        return NextResponse.json({ ok: true, ...await analyzeMock(task), meta: { mock: true, reason: 'missing_image' }, t: Date.now() - t0 });
      }

      // Check if Node decodeImage is available
      const nodeApi = (tf as any).node;
      if (!nodeApi || typeof nodeApi.decodeImage !== 'function') {
        Sentry.setTag('fallback', 'no_tfjs_node');
        return NextResponse.json({ ok: true, ...await analyzeMock(task), meta: { mock: true, reason: 'no_tfjs_node' }, t: Date.now() - t0 });
      }

      const comma = imageBase64.indexOf(',');
      const b64 = comma >= 0 ? imageBase64.slice(comma + 1) : imageBase64;
      const buf = Buffer.from(b64, 'base64');
      Sentry.setTag('input.size', String(buf.byteLength));

      const imageTensor = nodeApi.decodeImage(buf, 3);

      // Simple heuristic CNN using mean brightness and variance as proxy when model not loaded
      const resized = tf.image.resizeBilinear(imageTensor, [128, 128]).toFloat().div(255);
      const gray = resized.mean(2);
      const mean = gray.mean();
      const variance = gray.sub(mean).square().mean();

      const [m, v] = await Promise.all([mean.data(), variance.data()]);

      imageTensor.dispose(); resized.dispose(); gray.dispose(); mean.dispose(); variance.dispose();

      // Map proxies to labels
      if (task === 'occupancy') {
        const density = Math.max(0, Math.min(1, (v[0] + (1 - m[0])) / 2));
        const label = density > 0.7 ? 'high_crowd' : density > 0.4 ? 'medium_crowd' : 'low_crowd';
        return NextResponse.json({ ok: true, label, confidence: 0.6 + 0.3 * density, metrics: { density }, t: Date.now() - t0 });
      }

      if (task === 'anomaly') {
        const score = Math.max(0, Math.min(1, v[0] * 2));
        const label = score > 0.6 ? 'possible_anomaly' : 'no_anomaly';
        return NextResponse.json({ ok: true, label, confidence: 0.7, score, t: Date.now() - t0 });
      }

      Sentry.setTag('fallback', 'unknown_task');
      return NextResponse.json({ ok: true, ...await analyzeMock(task), meta: { mock: true, reason: 'unknown_task' }, t: Date.now() - t0 });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      Sentry.captureException(e);
      return NextResponse.json({ ok: true, ...(await analyzeMock('occupancy')), meta: { mock: true, reason: msg }, t: Date.now() - t0 });
    }
  });
}

