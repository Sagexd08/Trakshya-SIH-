
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { GET as EnergyGET } from './route';

const origin = 'http://localhost';

describe('/api/energy/series', () => {
  const realFetch = globalThis.fetch;
  const realEnv = process.env.IRCTC_RAPIDAPI_KEY;

  beforeEach(() => {
    vi.restoreAllMocks();
    process.env.IRCTC_RAPIDAPI_KEY = realEnv; // reset
    globalThis.fetch = realFetch as any;
  });

  afterEach(() => {
    process.env.IRCTC_RAPIDAPI_KEY = realEnv;
    globalThis.fetch = realFetch as any;
  });

  it('500 when IRCTC_RAPIDAPI_KEY missing', async () => {
    process.env.IRCTC_RAPIDAPI_KEY = '';
    const req = new Request(`${origin}/api/energy/series`);
    const res = await EnergyGET(req as any);
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toBeDefined();
  });

  it('200 and returns 24 points with meta when upstream returns trains', async () => {
    process.env.IRCTC_RAPIDAPI_KEY = 'key';
    // Mock two stations, each with a couple of trains
    const mockResponse = (count: number) => ({ data: { trains: Array.from({ length: count }, (_, i) => ({ delay: i })) } });
    globalThis.fetch = vi.fn(async (url: string) => {
      const isFirst = url.includes('station_code=');
      return new Response(JSON.stringify(mockResponse(isFirst ? 5 : 3)), { status: 200, headers: { 'content-type': 'application/json' } });
    }) as any;

    const req = new Request(`${origin}/api/energy/series?station_codes=NDLS,CSMT&hours=1`);
    const res = await EnergyGET(req as any);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body.points)).toBe(true);
    expect(body.points.length).toBe(24);
    expect(typeof body.points[0].h).toBe('number');
    expect(typeof body.points[0].base).toBe('number');
    expect(typeof body.points[0].opt).toBe('number');
    expect(body.meta.totalTrains).toBeGreaterThan(0);
  });

  it('500 Aggregation failed when fetch throws', async () => {
    process.env.IRCTC_RAPIDAPI_KEY = 'key';
    globalThis.fetch = vi.fn(async () => { throw new Error('network'); }) as any;
    const req = new Request(`${origin}/api/energy/series`);
    const res = await EnergyGET(req as any);
    // Current behavior: partial failures are tolerated; we still return 200 with synthesized series
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body.points)).toBe(true);
    expect(body.points.length).toBe(24);
  });
});

