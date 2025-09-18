
import { GET as LiveStationGET } from './route';

const origin = 'http://localhost';

describe('/api/irctc/live-station', () => {
  const realFetch = globalThis.fetch;
  const realEnv = process.env.IRCTC_RAPIDAPI_KEY;

  beforeEach(() => {
    jest.restoreAllMocks();
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

  it('200 mock payload when IRCTC_RAPIDAPI_KEY missing', async () => {
    process.env.IRCTC_RAPIDAPI_KEY = '';
    const req = new Request(`${origin}/api/irctc/live-station?station_code=NDLS`);
    const res = await LiveStationGET(req as any);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body?.meta?.mock).toBe(true);
    expect(body?.meta?.reason).toBe('missing_IRCTC_RAPIDAPI_KEY');
  });

  it('200 mock payload when upstream not ok', async () => {
    process.env.IRCTC_RAPIDAPI_KEY = 'test-key';
    globalThis.fetch = jest.fn(async () => {
      return new Response(JSON.stringify({ error: 'rate limit' }), { status: 429 });
    }) as any;
    const req = new Request(`${origin}/api/irctc/live-station?station_code=NDLS`);
    const res = await LiveStationGET(req as any);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body?.meta?.mock).toBe(true);
    expect(body?.meta?.reason).toBe('upstream_error');
    expect(body?.meta?.status).toBe(429);
  });

  it('200 and echoes upstream JSON when ok', async () => {
    process.env.IRCTC_RAPIDAPI_KEY = 'test-key';
    const sample = { data: { trains: [{ delay: 5 }] } };
    globalThis.fetch = jest.fn(async () => {
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

