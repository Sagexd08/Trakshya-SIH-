import React from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import { useLstmDelayPrediction } from './useLstmDelayPrediction'

function TestComp() {
  const { results, loading, error } = useLstmDelayPrediction([
    { id: 'T1', series: [1,2,3,4,5,6,7,8] },
  ], 3)
  return (
    <div>
      <div data-testid="loading">{String(loading)}</div>
      <div data-testid="error">{error || ''}</div>
      <div data-testid="results">{results?.[0]?.forecast?.join(',') || ''}</div>
    </div>
  )
}

describe('useLstmDelayPrediction hook', () => {
  const originalFetch = global.fetch
  beforeEach(() => {
    ;(global.fetch as any) = jest.fn(() => Promise.resolve({
      ok: true,
      json: async () => ({ results: [{ id: 'T1', forecast: [10,11,12] }] }),
    }))
  })
  afterEach(() => {
    ;(global.fetch as any) = originalFetch
  })

  it('fetches and returns forecasts', async () => {
    render(<TestComp />)
    await waitFor(() => expect(screen.getByTestId('results').textContent).toBe('10,11,12'))
    expect(screen.getByTestId('loading').textContent).toBe('false')
  })
})

