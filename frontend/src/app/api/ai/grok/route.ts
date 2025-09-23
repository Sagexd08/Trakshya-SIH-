import { NextRequest, NextResponse } from 'next/server';
import { grokChat } from '@/lib/openrouter';
import * as Sentry from '@sentry/nextjs';

export async function POST(req: NextRequest) {
  return Sentry.startSpan({ name: 'api/ai/grok', op: 'http.server' }, async () => {
    const t0 = Date.now();
    try {
      const { message, history = [], context = {} } = await req.json().catch(() => ({ message: '', history: [], context: {} }));

      if (!message || typeof message !== 'string') {
        return NextResponse.json({ error: 'message is required' }, { status: 400 });
      }

      const messages = [
        { role: 'system' as const, content: `You are Grok assisting with Indian Railways operations. Be concise and provide structured, actionable outputs.` },
        { role: 'user' as const, content: `Context: ${JSON.stringify(context)}\nQuestion: ${message}` },
        // Append limited history
        ...history.slice(-6).map((m: any) => ({ role: m.role, content: String(m.content).slice(0, 2000) })),
      ];

      Sentry.setTags({ 'prediction.type': 'llm', 'model.name': 'openrouter', 'messages.count': String(messages.length) });

      const res = await grokChat(messages);

      const dt = Date.now() - t0;
      return NextResponse.json({
        ok: true,
        answer: res.text,
        meta: res.meta,
        t: dt,
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      Sentry.captureException(e);
      return NextResponse.json({ ok: true, answer: `Fallback error: ${msg}`, meta: { provider: 'openrouter', reason: 'exception' } }, { status: 200 });
    }
  });
}

