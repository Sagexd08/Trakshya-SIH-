/**
 * AI State Management
 * Handles AI recommendations, chat, scenarios, and machine learning features
 */

import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';

// Types
export interface AIRecommendation {
  id: string;
  type: 'delay' | 'route' | 'energy' | 'capacity' | 'maintenance' | 'emergency';
  priority: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  description: string;
  confidence: number;
  impact: {
    delayReduction?: number;
    energySavings?: number;
    throughputImprovement?: number;
    costSavings?: number;
    passengerImpact?: number;
  };
  actions: {
    trainId?: string;
    stationId?: string;
    delayMinutes?: number;
    routeChange?: string;
    energyMode?: string;
    priority?: string;
  };
  reasoning: string;
  alternatives?: AIRecommendation[];
  status: 'pending' | 'accepted' | 'rejected' | 'implemented' | 'expired';
  createdAt: string;
  expiresAt: string;
  implementedAt?: string;
  feedback?: {
    rating: number;
    comment: string;
    effectiveness: number;
  };
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: string;
  metadata?: {
    recommendations?: AIRecommendation[];
    charts?: any[];
    actions?: any[];
    context?: any;
  };
  attachments?: {
    type: 'image' | 'document' | 'data';
    url: string;
    name: string;
  }[];
}

export interface AIScenario {
  id: string;
  name: string;
  type: 'weather' | 'technical' | 'infrastructure' | 'operational' | 'emergency';
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  parameters: {
    duration: number;
    affectedArea: number;
    speedReduction: number;
    capacityReduction: number;
    customParams?: Record<string, any>;
  };
  results?: {
    delayIncrease: number;
    energyImpact: number;
    costImpact: number;
    passengerImpact: number;
    recommendations: AIRecommendation[];
  };
  status: 'draft' | 'running' | 'completed' | 'failed';
  createdAt: string;
  completedAt?: string;
}

export interface AIInsight {
  id: string;
  type: 'pattern' | 'anomaly' | 'prediction' | 'optimization' | 'alert';
  title: string;
  description: string;
  severity: 'info' | 'warning' | 'error' | 'success';
  confidence: number;
  data: any;
  visualizations?: {
    type: 'chart' | 'map' | 'table' | 'metric';
    config: any;
  }[];
  actions?: {
    label: string;
    action: string;
    params?: any;
  }[];
  timestamp: string;
  acknowledged: boolean;
}

export interface AIModel {
  id: string;
  name: string;
  type: 'classification' | 'regression' | 'clustering' | 'forecasting';
  status: 'training' | 'ready' | 'updating' | 'error';
  accuracy: number;
  lastTrained: string;
  version: string;
  features: string[];
  metrics: {
    precision: number;
    recall: number;
    f1Score: number;
    mse?: number;
    mae?: number;
  };
}

export interface AIState {
  // Recommendations
  recommendations: AIRecommendation[];
  recommendationHistory: AIRecommendation[];
  
  // Chat
  chatMessages: ChatMessage[];
  chatHistory: ChatMessage[][];
  isTyping: boolean;
  
  // Scenarios
  scenarios: AIScenario[];
  activeScenario: string | null;
  
  // Insights
  insights: AIInsight[];
  
  // Models
  models: AIModel[];
  
  // Settings
  settings: {
    autoRecommendations: boolean;
    recommendationThreshold: number;
    chatPersonality: 'professional' | 'friendly' | 'technical';
    voiceEnabled: boolean;
    language: 'en' | 'hi';
    contextWindow: number;
  };
  
  // Performance
  performance: {
    responseTime: number;
    accuracy: number;
    uptime: number;
    requestCount: number;
    errorRate: number;
  };
  
  // Loading states
  loading: {
    recommendations: boolean;
    chat: boolean;
    scenarios: boolean;
    insights: boolean;
  };
  
  // Error states
  errors: {
    recommendations: string | null;
    chat: string | null;
    scenarios: string | null;
    insights: string | null;
  };
  
  // Feature availability
  features: {
    recommendations: boolean;
    chat: boolean;
    scenarios: boolean;
    voiceChat: boolean;
    predictiveAnalytics: boolean;
  };
}

// Initial state
const initialState: AIState = {
  recommendations: [],
  recommendationHistory: [],
  
  chatMessages: [
    {
      id: 'welcome',
      role: 'assistant',
      content: 'Hello! I\'m your AI assistant for railway operations. I can help you analyze conflicts, optimize routes, and provide real-time insights. What would you like to know?',
      timestamp: new Date().toISOString(),
    }
  ],
  chatHistory: [],
  isTyping: false,
  
  scenarios: [],
  activeScenario: null,
  
  insights: [],
  
  models: [],
  
  settings: {
    autoRecommendations: true,
    recommendationThreshold: 0.7,
    chatPersonality: 'professional',
    voiceEnabled: false,
    language: 'en',
    contextWindow: 10,
  },
  
  performance: {
    responseTime: 0,
    accuracy: 0,
    uptime: 100,
    requestCount: 0,
    errorRate: 0,
  },
  
  loading: {
    recommendations: false,
    chat: false,
    scenarios: false,
    insights: false,
  },
  
  errors: {
    recommendations: null,
    chat: null,
    scenarios: null,
    insights: null,
  },
  
  features: {
    recommendations: true,
    chat: true,
    scenarios: true,
    voiceChat: false,
    predictiveAnalytics: true,
  },
};

// Async thunks
export const fetchRecommendations = createAsyncThunk(
  'ai/fetchRecommendations',
  async (context: any) => {
    const response = await fetch('/api/ai/recommendations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(context),
    });
    if (!response.ok) throw new Error('Failed to fetch recommendations');
    return response.json();
  }
);

export const sendChatMessage = createAsyncThunk(
  'ai/sendChatMessage',
  async (params: { message: string; context?: any; history?: ChatMessage[] }) => {
    const response = await fetch('/api/ai/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });
    if (!response.ok) throw new Error('Failed to send message');
    return response.json();
  }
);

export const runScenario = createAsyncThunk(
  'ai/runScenario',
  async (scenario: Omit<AIScenario, 'id' | 'status' | 'createdAt'>) => {
    const response = await fetch('/api/ai/scenario', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ scenario }),
    });
    if (!response.ok) throw new Error('Failed to run scenario');
    return response.json();
  }
);

// AI slice
const aiSlice = createSlice({
  name: 'ai',
  initialState,
  reducers: {
    // Recommendations
    addRecommendation: (state, action: PayloadAction<AIRecommendation>) => {
      state.recommendations.push(action.payload);
    },
    
    updateRecommendation: (state, action: PayloadAction<{ id: string; updates: Partial<AIRecommendation> }>) => {
      const index = state.recommendations.findIndex(r => r.id === action.payload.id);
      if (index !== -1) {
        state.recommendations[index] = { ...state.recommendations[index], ...action.payload.updates };
      }
    },
    
    acceptRecommendation: (state, action: PayloadAction<{ id: string; feedback?: AIRecommendation['feedback'] }>) => {
      const recommendation = state.recommendations.find(r => r.id === action.payload.id);
      if (recommendation) {
        recommendation.status = 'accepted';
        recommendation.implementedAt = new Date().toISOString();
        if (action.payload.feedback) {
          recommendation.feedback = action.payload.feedback;
        }
        // Move to history
        state.recommendationHistory.push(recommendation);
        state.recommendations = state.recommendations.filter(r => r.id !== action.payload.id);
      }
    },
    
    rejectRecommendation: (state, action: PayloadAction<{ id: string; reason?: string }>) => {
      const recommendation = state.recommendations.find(r => r.id === action.payload.id);
      if (recommendation) {
        recommendation.status = 'rejected';
        if (action.payload.reason) {
          recommendation.feedback = { rating: 0, comment: action.payload.reason, effectiveness: 0 };
        }
        // Move to history
        state.recommendationHistory.push(recommendation);
        state.recommendations = state.recommendations.filter(r => r.id !== action.payload.id);
      }
    },
    
    clearExpiredRecommendations: (state) => {
      const now = new Date().toISOString();
      state.recommendations = state.recommendations.filter(r => r.expiresAt > now);
    },
    
    // Chat
    addChatMessage: (state, action: PayloadAction<ChatMessage>) => {
      state.chatMessages.push(action.payload);
    },
    
    updateChatMessage: (state, action: PayloadAction<{ id: string; updates: Partial<ChatMessage> }>) => {
      const index = state.chatMessages.findIndex(m => m.id === action.payload.id);
      if (index !== -1) {
        state.chatMessages[index] = { ...state.chatMessages[index], ...action.payload.updates };
      }
    },
    
    setTyping: (state, action: PayloadAction<boolean>) => {
      state.isTyping = action.payload;
    },
    
    clearChatMessages: (state) => {
      // Save current chat to history
      if (state.chatMessages.length > 1) {
        state.chatHistory.push([...state.chatMessages]);
      }
      // Reset to welcome message
      state.chatMessages = [initialState.chatMessages[0]];
    },
    
    // Scenarios
    addScenario: (state, action: PayloadAction<AIScenario>) => {
      state.scenarios.push(action.payload);
    },
    
    updateScenario: (state, action: PayloadAction<{ id: string; updates: Partial<AIScenario> }>) => {
      const index = state.scenarios.findIndex(s => s.id === action.payload.id);
      if (index !== -1) {
        state.scenarios[index] = { ...state.scenarios[index], ...action.payload.updates };
      }
    },
    
    setActiveScenario: (state, action: PayloadAction<string | null>) => {
      state.activeScenario = action.payload;
    },
    
    removeScenario: (state, action: PayloadAction<string>) => {
      state.scenarios = state.scenarios.filter(s => s.id !== action.payload);
      if (state.activeScenario === action.payload) {
        state.activeScenario = null;
      }
    },
    
    // Insights
    addInsight: (state, action: PayloadAction<AIInsight>) => {
      state.insights.unshift(action.payload);
      // Keep only last 100 insights
      if (state.insights.length > 100) {
        state.insights = state.insights.slice(0, 100);
      }
    },
    
    acknowledgeInsight: (state, action: PayloadAction<string>) => {
      const insight = state.insights.find(i => i.id === action.payload);
      if (insight) {
        insight.acknowledged = true;
      }
    },
    
    removeInsight: (state, action: PayloadAction<string>) => {
      state.insights = state.insights.filter(i => i.id !== action.payload);
    },
    
    // Models
    updateModel: (state, action: PayloadAction<AIModel>) => {
      const index = state.models.findIndex(m => m.id === action.payload.id);
      if (index !== -1) {
        state.models[index] = action.payload;
      } else {
        state.models.push(action.payload);
      }
    },
    
    // Settings
    updateSettings: (state, action: PayloadAction<Partial<AIState['settings']>>) => {
      state.settings = { ...state.settings, ...action.payload };
    },
    
    // Performance
    updatePerformance: (state, action: PayloadAction<Partial<AIState['performance']>>) => {
      state.performance = { ...state.performance, ...action.payload };
    },
    
    // Features
    toggleFeature: (state, action: PayloadAction<keyof AIState['features']>) => {
      state.features[action.payload] = !state.features[action.payload];
    },
    
    // Reset
    resetAI: () => initialState,
  },
  
  extraReducers: (builder) => {
    // Fetch recommendations
    builder
      .addCase(fetchRecommendations.pending, (state) => {
        state.loading.recommendations = true;
        state.errors.recommendations = null;
      })
      .addCase(fetchRecommendations.fulfilled, (state, action) => {
        state.loading.recommendations = false;
        if (action.payload.recommendations) {
          state.recommendations = action.payload.recommendations;
        }
        state.performance.requestCount += 1;
      })
      .addCase(fetchRecommendations.rejected, (state, action) => {
        state.loading.recommendations = false;
        state.errors.recommendations = action.error.message || 'Failed to fetch recommendations';
        state.performance.errorRate += 1;
      });
    
    // Send chat message
    builder
      .addCase(sendChatMessage.pending, (state) => {
        state.loading.chat = true;
        state.isTyping = true;
        state.errors.chat = null;
      })
      .addCase(sendChatMessage.fulfilled, (state, action) => {
        state.loading.chat = false;
        state.isTyping = false;
        if (action.payload.message) {
          state.chatMessages.push(action.payload.message);
        }
        state.performance.requestCount += 1;
      })
      .addCase(sendChatMessage.rejected, (state, action) => {
        state.loading.chat = false;
        state.isTyping = false;
        state.errors.chat = action.error.message || 'Failed to send message';
        state.performance.errorRate += 1;
      });
    
    // Run scenario
    builder
      .addCase(runScenario.pending, (state) => {
        state.loading.scenarios = true;
        state.errors.scenarios = null;
      })
      .addCase(runScenario.fulfilled, (state, action) => {
        state.loading.scenarios = false;
        if (action.payload.scenario) {
          const index = state.scenarios.findIndex(s => s.id === action.payload.scenario.id);
          if (index !== -1) {
            state.scenarios[index] = action.payload.scenario;
          } else {
            state.scenarios.push(action.payload.scenario);
          }
        }
      })
      .addCase(runScenario.rejected, (state, action) => {
        state.loading.scenarios = false;
        state.errors.scenarios = action.error.message || 'Failed to run scenario';
      });
  },
});

// Export actions
export const {
  addRecommendation,
  updateRecommendation,
  acceptRecommendation,
  rejectRecommendation,
  clearExpiredRecommendations,
  addChatMessage,
  updateChatMessage,
  setTyping,
  clearChatMessages,
  addScenario,
  updateScenario,
  setActiveScenario,
  removeScenario,
  addInsight,
  acknowledgeInsight,
  removeInsight,
  updateModel,
  updateSettings,
  updatePerformance,
  toggleFeature,
  resetAI,
} = aiSlice.actions;

// Selectors
export const selectAI = (state: { ai: AIState }) => state.ai;
export const selectRecommendations = (state: { ai: AIState }) => state.ai.recommendations;
export const selectChatMessages = (state: { ai: AIState }) => state.ai.chatMessages;
export const selectScenarios = (state: { ai: AIState }) => state.ai.scenarios;
export const selectInsights = (state: { ai: AIState }) => state.ai.insights;
export const selectAISettings = (state: { ai: AIState }) => state.ai.settings;

export default aiSlice.reducer;
