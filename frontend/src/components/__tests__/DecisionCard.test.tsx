import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { toast } from 'sonner';
import DecisionCard from '../DecisionCard';
import { AIRecommendation, SystemContext } from '@/lib/gemini';

// Mock dependencies
jest.mock('sonner', () => ({
  toast: {
    success: jest.fn(),
    error: jest.fn(),
    info: jest.fn(),
  },
}));

jest.mock('@/lib/api', () => ({
  postJSON: jest.fn(),
}));

const mockRecommendation: AIRecommendation = {
  id: 'test-rec-1',
  type: 'delay',
  title: 'Hold Train 123 for 2 mins → Saves 14 mins overall',
  description: 'Reduces conflict near Kanpur Jn by sequencing faster train first',
  confidence: 0.87,
  impact: {
    delayReduction: 14,
    throughputImprovement: 12,
    conflictsResolved: 1,
  },
  actions: {
    trainId: '123',
    delayMinutes: 2,
    priority: 'high',
  },
  reasoning: 'Analysis shows this minimal delay prevents a cascade of conflicts affecting 3 other trains',
  timestamp: new Date(),
};

const mockContext: SystemContext = {
  activeTrains: 142,
  conflicts: [],
  energyEfficiency: 92.4,
  avgDelay: 4.2,
  throughput: 87.6,
  userRole: 'controller',
  currentView: 'dashboard',
};

// Mock fetch for API calls
global.fetch = jest.fn();

describe('DecisionCard', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        recommendations: [mockRecommendation],
      }),
    });
  });

  it('renders loading state initially', () => {
    render(<DecisionCard context={mockContext} />);
    
    expect(screen.getByTestId('loading-skeleton')).toBeInTheDocument();
  });

  it('renders recommendation card with correct data', async () => {
    render(<DecisionCard context={mockContext} />);
    
    await waitFor(() => {
      expect(screen.getByText(mockRecommendation.title)).toBeInTheDocument();
    });

    expect(screen.getByText(mockRecommendation.description)).toBeInTheDocument();
    expect(screen.getByText('87%')).toBeInTheDocument(); // confidence
    expect(screen.getByText('-14m')).toBeInTheDocument(); // delay reduction
    expect(screen.getByText('+12%')).toBeInTheDocument(); // throughput improvement
  });

  it('handles accept recommendation', async () => {
    const user = userEvent.setup();
    const mockOnApply = jest.fn();
    
    render(
      <DecisionCard 
        context={mockContext} 
        onRecommendationApply={mockOnApply}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Accept')).toBeInTheDocument();
    });

    const acceptButton = screen.getByText('Accept');
    await user.click(acceptButton);

    expect(mockOnApply).toHaveBeenCalledWith(mockRecommendation);
    expect(toast.success).toHaveBeenCalledWith(
      expect.stringContaining('Recommendation applied')
    );
  });

  it('handles reject recommendation', async () => {
    const user = userEvent.setup();
    
    render(<DecisionCard context={mockContext} />);

    await waitFor(() => {
      expect(screen.getByText('Reject')).toBeInTheDocument();
    });

    const rejectButton = screen.getByText('Reject');
    await user.click(rejectButton);

    expect(toast.info).toHaveBeenCalledWith('Recommendation dismissed');
  });

  it('shows inline editing when enabled', async () => {
    const user = userEvent.setup();
    
    render(
      <DecisionCard 
        context={mockContext} 
        enableInlineEdit={true}
        showMultiple={true}
      />
    );

    await waitFor(() => {
      expect(screen.getByTestId('edit-button')).toBeInTheDocument();
    });

    const editButton = screen.getByTestId('edit-button');
    await user.click(editButton);

    expect(screen.getByDisplayValue(mockRecommendation.title)).toBeInTheDocument();
    expect(screen.getByDisplayValue(mockRecommendation.description)).toBeInTheDocument();
  });

  it('calculates and displays KPI impacts', async () => {
    render(
      <DecisionCard 
        context={mockContext}
        showMultiple={true}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Average Delay')).toBeInTheDocument();
    });

    expect(screen.getByText('Network Throughput')).toBeInTheDocument();
    expect(screen.getByText('4.2')).toBeInTheDocument(); // current delay
    expect(screen.getByText('87.6')).toBeInTheDocument(); // current throughput
  });

  it('shows train visualization when enabled', async () => {
    render(
      <DecisionCard 
        context={mockContext}
        showTrainVisualization={true}
        showMultiple={true}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Affected Trains')).toBeInTheDocument();
    });

    expect(screen.getByText('Train 123')).toBeInTheDocument();
  });

  it('handles API errors gracefully', async () => {
    (global.fetch as jest.Mock).mockRejectedValue(new Error('API Error'));
    
    render(<DecisionCard context={mockContext} />);

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith(
        expect.stringContaining('demo recommendations')
      );
    });
  });

  it('shows empty state when no recommendations', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ recommendations: [] }),
    });

    render(<DecisionCard context={mockContext} />);

    await waitFor(() => {
      expect(screen.getByText('No Active Recommendations')).toBeInTheDocument();
    });

    expect(screen.getByText('AI is monitoring for optimization opportunities')).toBeInTheDocument();
  });

  it('supports keyboard navigation', async () => {
    const user = userEvent.setup();
    
    render(<DecisionCard context={mockContext} />);

    await waitFor(() => {
      expect(screen.getByText('Accept')).toBeInTheDocument();
    });

    const acceptButton = screen.getByText('Accept');
    acceptButton.focus();
    
    expect(acceptButton).toHaveFocus();

    await user.keyboard('{Tab}');
    expect(screen.getByText('Reject')).toHaveFocus();
  });

  it('handles modify recommendation', async () => {
    const user = userEvent.setup();
    
    render(
      <DecisionCard 
        context={mockContext}
        enableInlineEdit={true}
        showMultiple={true}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Modify')).toBeInTheDocument();
    });

    const modifyButton = screen.getByText('Modify');
    await user.click(modifyButton);

    expect(toast.info).toHaveBeenCalledWith('Recommendation ready for modification');
  });

  it('auto-refreshes recommendations when enabled', async () => {
    jest.useFakeTimers();
    
    render(<DecisionCard context={mockContext} autoRefresh={true} />);

    // Initial fetch
    expect(global.fetch).toHaveBeenCalledTimes(1);

    // Fast-forward 30 seconds
    jest.advanceTimersByTime(30000);

    // Should have made another fetch call
    expect(global.fetch).toHaveBeenCalledTimes(2);

    jest.useRealTimers();
  });

  it('shows confidence badge with correct styling', async () => {
    render(<DecisionCard context={mockContext} />);

    await waitFor(() => {
      const confidenceBadge = screen.getByText('87% confidence');
      expect(confidenceBadge).toBeInTheDocument();
      expect(confidenceBadge).toHaveClass('bg-primary'); // High confidence styling
    });
  });

  it('expands details when clicked', async () => {
    const user = userEvent.setup();
    
    render(
      <DecisionCard 
        context={mockContext}
        showMultiple={true}
      />
    );

    await waitFor(() => {
      expect(screen.getByTestId('expand-button')).toBeInTheDocument();
    });

    const expandButton = screen.getByTestId('expand-button');
    await user.click(expandButton);

    expect(screen.getByText('AI Reasoning')).toBeInTheDocument();
    expect(screen.getByText(mockRecommendation.reasoning)).toBeInTheDocument();
  });

  it('saves edited recommendation', async () => {
    const user = userEvent.setup();
    
    render(
      <DecisionCard 
        context={mockContext}
        enableInlineEdit={true}
        showMultiple={true}
      />
    );

    await waitFor(() => {
      expect(screen.getByTestId('edit-button')).toBeInTheDocument();
    });

    // Start editing
    const editButton = screen.getByTestId('edit-button');
    await user.click(editButton);

    // Modify title
    const titleInput = screen.getByDisplayValue(mockRecommendation.title);
    await user.clear(titleInput);
    await user.type(titleInput, 'Modified recommendation title');

    // Save changes
    const saveButton = screen.getByText('Save Changes');
    await user.click(saveButton);

    expect(toast.success).toHaveBeenCalledWith('Recommendation updated successfully');
  });
});
