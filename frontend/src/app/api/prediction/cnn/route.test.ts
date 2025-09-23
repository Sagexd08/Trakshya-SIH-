/**
 * @jest-environment node
 */

import { POST as cnnPost } from './route';

describe('CNN Prediction API', () => {
  it('returns mock when image is missing', async () => {
    const req: any = { json: async () => ({}) };
    const res: any = await cnnPost(req as any);
    expect(res?.status || 200).toBe(200);
    const j = await res.json();
    expect(j.ok).toBe(true);
    // meta may be undefined if heuristic path, but should include mock when missing image
    expect(j.meta?.mock).toBe(true);
  });
});

