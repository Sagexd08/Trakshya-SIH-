import React from 'react';
import { render, screen } from '@testing-library/react';
import { VirtualizedTrainList } from '@/components/VirtualizedList';

// Mock the virtualizer so header + first row always render in tests
jest.mock('@tanstack/react-virtual', () => ({
  useVirtualizer: () => ({
    getTotalSize: () => 120,
    getVirtualItems: () => [
      { key: 'hdr', index: 0, size: 40, start: 0 },
      { key: 'row-0', index: 1, size: 80, start: 40 },
    ],
  }),
}));

function makeTrain(id: string, name = 'Train ' + id) {
  return {
    id,
    name,
    status: 'delayed' as const,
    delay: 7,
    position: { lat: 0, lng: 0 },
    speed: 60,
    route: 'Alpha → Beta',
    nextStation: 'Beta',
    eta: new Date()
  };
}

describe('VirtualizedTrainList prediction badges', () => {
  it('renders 5m/15m/30m badges with forecast values when predictions provided', async () => {
    const trains = [makeTrain('T1')];
    // forecast indices used: 1 (5m), 3 (15m), 5 (30m) with trends vs previous index
    const predictions: Record<string, number[]> = {
      T1: [8, 10, 10, 12, 12, 15], // 5m:+10, 15m:+12, 30m:+15
    };

    render(
      <VirtualizedTrainList
        trains={trains}
        predictions={predictions}
      />
    );

    // Look for badges anywhere in the rendered output
    expect(screen.getByText(/5m:\s*\+10m/)).toBeInTheDocument();
    expect(screen.getByText(/15m:\s*\+12m/)).toBeInTheDocument();
    expect(screen.getByText(/30m:\s*\+15m/)).toBeInTheDocument();
  });

  it('shows N/A for badges when predictions are missing', () => {
    const trains = [makeTrain('T2')];
    const predictions: Record<string, number[]> = {}; // none

    render(
      <VirtualizedTrainList
        trains={trains}
        predictions={predictions}
      />
    );

    // At least one N/A should appear in the badges group
    expect(screen.getAllByText(/N\/A/).length).toBeGreaterThan(0);
  });
});

