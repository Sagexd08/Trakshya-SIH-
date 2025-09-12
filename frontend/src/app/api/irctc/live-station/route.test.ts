/// <reference types="vitest" />
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { GET as LiveStationGET } from './route';

const origin = 'http://localhost';

describe('/api/irctc/live-station', () => {
  const realFetch = globalThis.fetch;
  const realEnv = process.env.IRCTC_RAPIDAPI_KEY;

  beforeEach(() => {
    vi.restoreAllMocks();
    process.env.IRCTC_RAPIDAPI_KEY = realEnv; // reset each test
    globalThis.fetch = realFetch as any;
  });

  afterEach(() => {
    process.env.IRCTC_RAPIDAPI_KEY = realEnv;
    globalThis.fetch = realFetch as any;
  });

  it('400 when station_code missing', async () => {
    const req = new Request(`${origin}/api/irctc/live-station`);
    const res = await LiveStationGET(req as any);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBeDefined();
  });

  it('500 when IRCTC_RAPIDAPI_KEY missing', async () => {
    process.env.IRCTC_RAPIDAPI_KEY = '';
    const req = new Request(`${origin}/api/irctc/live-station?station_code=NDLS`);
    const res = await LiveStationGET(req as any);
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toBeDefined();
  });

  it('502 when upstream not ok', async () => {
    process.env.IRCTC_RAPIDAPI_KEY = 'test-key';
    globalThis.fetch = vi.fn(async () => {
      return new Response(JSON.stringify({ error: 'rate limit' }), { status: 429 });
    }) as any;
    const req = new Request(`${origin}/api/irctc/live-station?station_code=NDLS`);
    const res = await LiveStationGET(req as any);
    expect(res.status).toBe(502);
    const body = await res.json();
    expect(body.error).toBeDefined();
    // Upstream code is echoed into body.status while we return 502 overall
    expect(body.status).toBe(429);
  });

  it('200 and echoes upstream JSON when ok', async () => {
    process.env.IRCTC_RAPIDAPI_KEY = 'test-key';
    const sample = { data: { trains: [{ delay: 5 }] } };
    globalThis.fetch = vi.fn(async () => {
      // handler reads .text() and then attempts JSON.parse
      return new Response(JSON.stringify(sample), { status: 200, headers: { 'content-type': 'application/json' } });
    }) as any;
    const req = new Request(`${origin}/api/irctc/live-station?station_code=NDLS&hours=1`);
    const res = await LiveStationGET(req as any);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual(sample);
  });
});

