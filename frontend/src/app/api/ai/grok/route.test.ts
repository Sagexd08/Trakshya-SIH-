/**
 * @jest-environment node
 */

import { POST as grokPost } from './route'

jest.mock('@/lib/openrouter', () => ({
  grokChat: jest.fn(async () => ({ text: 'hello world', meta: { provider: 'openrouter' } }))
}))

describe('Grok API', () => {
  it('returns 400 when message missing', async () => {
    const req: any = { json: async () => ({}) }
    const res: any = await grokPost(req as any)
    expect(res.status).toBe(400)
  })

  it('returns answer when message provided', async () => {
    const req: any = { json: async () => ({ message: 'hi', context: { a: 1 } }) }
    const res: any = await grokPost(req as any)
    expect(res?.status || 200).toBe(200)
    const j = await res.json()
    expect(j.ok).toBe(true)
    expect(j.answer).toBe('hello world')
  })
})

