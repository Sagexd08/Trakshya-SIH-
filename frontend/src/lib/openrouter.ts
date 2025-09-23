import { config } from '@/config';

export type ORMessage = { role: 'system' | 'user' | 'assistant'; content: string };

// Lightweight OpenRouter client with graceful fallbacks
export async function grokChat(messages: ORMessage[], opts?: { model?: string; max_tokens?: number; temperature?: number }) {
  const apiKey = process.env.OPENROUTER_API_KEY;
  const model = opts?.model || (config.services as any).openrouter?.model || 'x-ai/grok-4-fast:free';

  if (!apiKey) {
    return {
      mock: true,
      text: 'OpenRouter API key not configured. Providing fallback advisory based on heuristics.',
      meta: { provider: 'openrouter', model, reason: 'missing_api_key' },
    };
  }

  try {
    const r = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'authorization': `Bearer ${apiKey}`,
        // Optional but recommended by OpenRouter
        'HTTP-Referer': (process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3031'),
        'X-Title': process.env.NEXT_PUBLIC_APP_NAME || 'Trakshya',
      },
      body: JSON.stringify({
        model,
        messages,
        max_tokens: opts?.max_tokens ?? 512,
        temperature: opts?.temperature ?? 0.2,
      })
    });

    const j = await r.json();
    if (!r.ok) throw new Error(j?.error?.message || `OpenRouter error ${r.status}`);

    const text: string = j?.choices?.[0]?.message?.content ?? '';
    return {
      text,
      meta: { provider: 'openrouter', model },
    };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return {
      mock: true,
      text: `Fallback due to error: ${message}`,
      meta: { provider: 'openrouter', model, reason: 'error' },
    };
  }
}

