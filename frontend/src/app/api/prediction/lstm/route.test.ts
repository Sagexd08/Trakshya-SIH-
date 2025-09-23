/**
 * @jest-environment node
 */

import { POST as lstmPost } from './route';

describe('LSTM Prediction API', () => {
  it('returns forecast for valid series', async () => {
    const req: any = { json: async () => ({ series: [1,2,3,4,5,6,7,8,9,10], horizon: 5 }) };
    const res: any = await lstmPost(req as any);
    expect(res?.status || 200).toBe(200);
    const j = await res.json();
    expect(j.ok).toBe(true);
    expect(Array.isArray(j.forecast)).toBe(true);
    expect(j.forecast.length).toBe(5);
  });

  it('returns 400 on malformed input', async () => {
    const req: any = { json: async () => ({}) };
    const res: any = await lstmPost(req as any);
    expect(res.status).toBe(400);
    const j = await res.json();
    expect(j.error).toBeTruthy();
  });
});

