/**
 * AI API using RTK Query
 * Provides AI-powered features including recommendations, chat, and scenarios
 */

import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';
import { config } from '@/config';
import type { AIRecommendation, ChatMessage, AIScenario, AIInsight } from '../slices/aiSlice';

// Base query configuration
const baseQuery = fetchBaseQuery({
  baseUrl: '/api/ai',
  timeout: 30000, // AI requests may take longer
  prepareHeaders: (headers, { getState }) => {
    const token = (getState() as any).auth?.user?.token;
    if (token) {
      headers.set('authorization', `Bearer ${token}`);
    }
    headers.set('content-type', 'application/json');
    return headers;
  },
});

// AI API definition
export const aiApi = createApi({
  reducerPath: 'aiApi',
  baseQuery,
  tagTypes: ['Recommendation', 'Chat', 'Scenario', 'Insight', 'Model'],
  keepUnusedDataFor: 600, // 10 minutes for AI data
  
  endpoints: (builder) => ({
    // Recommendations
    getRecommendations: builder.mutation<{
      recommendations: AIRecommendation[];
      timestamp: string;
      context: any;
    }, {
      activeTrains?: number;
      conflicts?: any[];
      energyEfficiency?: number;
      avgDelay?: number;
      throughput?: number;
      currentView?: string;
      userRole?: string;
    }>({
      query: (context) => ({
        url: '/recommendations',
        method: 'POST',
        body: context,
      }),
      invalidatesTags: [{ type: 'Recommendation', id: 'LIST' }],
    }),
    
    acceptRecommendation: builder.mutation<{
      success: boolean;
      message: string;
    }, {
      recommendationId: string;
      feedback?: {
        rating: number;
        comment: string;
        effectiveness: number;
      };
    }>({
      query: ({ recommendationId, feedback }) => ({
        url: '/decisions',
        method: 'POST',
        body: {
          action: 'accept',
          proposalId: recommendationId,
          feedback,
        },
      }),
      invalidatesTags: [{ type: 'Recommendation', id: 'LIST' }],
    }),
    
    rejectRecommendation: builder.mutation<{
      success: boolean;
      message: string;
    }, {
      recommendationId: string;
      reason?: string;
    }>({
      query: ({ recommendationId, reason }) => ({
        url: '/decisions',
        method: 'POST',
        body: {
          action: 'reject',
          proposalId: recommendationId,
          reason,
        },
      }),
      invalidatesTags: [{ type: 'Recommendation', id: 'LIST' }],
    }),
    
    // Chat
    sendChatMessage: builder.mutation<{
      message: ChatMessage;
      timestamp: string;
    }, {
      message: string;
      context?: any;
      history?: ChatMessage[];
    }>({
      query: (params) => ({
        url: '/chat',
        method: 'POST',
        body: params,
      }),
      invalidatesTags: [{ type: 'Chat', id: 'HISTORY' }],
    }),
    
    getChatHistory: builder.query<{
      history: any[];
      timestamp: string;
    }, {
      limit?: number;
      offset?: number;
    }>({
      query: (params = {}) => ({
        url: '/chat',
        params: {
          limit: 50,
          offset: 0,
          ...params,
        },
      }),
      providesTags: [{ type: 'Chat', id: 'HISTORY' }],
    }),
    
    // Scenarios
    runScenario: builder.mutation<{
      scenario: AIScenario;
      analysis: string;
      timestamp: string;
    }, {
      scenario: {
        name: string;
        type: string;
        severity: string;
        description: string;
        parameters: any;
        duration?: number;
        location?: string;
      };
      context?: any;
    }>({
      query: (params) => ({
        url: '/scenario',
        method: 'POST',
        body: params,
      }),
      invalidatesTags: [{ type: 'Scenario', id: 'LIST' }],
    }),
    
    getScenarios: builder.query<{
      scenarios: AIScenario[];
      timestamp: string;
    }, void>({
      query: () => '/scenario',
      providesTags: [{ type: 'Scenario', id: 'LIST' }],
    }),
    
    deleteScenario: builder.mutation<{
      success: boolean;
    }, string>({
      query: (scenarioId) => ({
        url: `/scenario/${scenarioId}`,
        method: 'DELETE',
      }),
      invalidatesTags: [{ type: 'Scenario', id: 'LIST' }],
    }),
    
    // Insights and Analytics
    getInsights: builder.query<{
      insights: AIInsight[];
      timestamp: string;
    }, {
      type?: string;
      severity?: string;
      limit?: number;
    }>({
      query: (params = {}) => ({
        url: '/insights',
        params: {
          limit: 20,
          ...params,
        },
      }),
      providesTags: [{ type: 'Insight', id: 'LIST' }],
    }),
    
    acknowledgeInsight: builder.mutation<{
      success: boolean;
    }, string>({
      query: (insightId) => ({
        url: `/insights/${insightId}/acknowledge`,
        method: 'POST',
      }),
      invalidatesTags: (result, error, insightId) => [
        { type: 'Insight', id: insightId },
        { type: 'Insight', id: 'LIST' },
      ],
    }),
    
    // Predictive Analytics
    getPredictions: builder.query<{
      predictions: {
        delays: any[];
        conflicts: any[];
        energy: any[];
        capacity: any[];
      };
      confidence: number;
      timestamp: string;
    }, {
      timeHorizon?: number; // hours
      includeTypes?: string[];
    }>({
      query: (params = {}) => ({
        url: '/predictions',
        params: {
          timeHorizon: 24,
          includeTypes: ['delays', 'conflicts', 'energy'],
          ...params,
        },
      }),
      keepUnusedDataFor: 300, // 5 minutes for predictions
    }),
    
    // Natural Language Query
    queryNaturalLanguage: builder.mutation<{
      answer: string;
      recommendations?: AIRecommendation[];
      visualizations?: any[];
      confidence: number;
    }, {
      query: string;
      context?: any;
    }>({
      query: (params) => ({
        url: '/query',
        method: 'POST',
        body: params,
      }),
    }),
    
    // Model Management
    getModels: builder.query<{
      models: Array<{
        id: string;
        name: string;
        type: string;
        status: string;
        accuracy: number;
        lastTrained: string;
        version: string;
      }>;
    }, void>({
      query: () => '/models',
      providesTags: [{ type: 'Model', id: 'LIST' }],
    }),
    
    trainModel: builder.mutation<{
      success: boolean;
      jobId: string;
    }, {
      modelId: string;
      parameters?: any;
    }>({
      query: ({ modelId, parameters }) => ({
        url: `/models/${modelId}/train`,
        method: 'POST',
        body: { parameters },
      }),
      invalidatesTags: [{ type: 'Model', id: 'LIST' }],
    }),
    
    // Performance Analytics
    getPerformanceMetrics: builder.query<{
      metrics: {
        responseTime: number;
        accuracy: number;
        uptime: number;
        requestCount: number;
        errorRate: number;
      };
      timestamp: string;
    }, {
      timeRange?: string;
    }>({
      query: (params = {}) => ({
        url: '/performance',
        params: {
          timeRange: '24h',
          ...params,
        },
      }),
    }),
    
    // Voice Integration
    processVoiceCommand: builder.mutation<{
      transcript: string;
      response: string;
      actions?: any[];
    }, {
      audioData: Blob;
      language?: string;
    }>({
      query: ({ audioData, language = 'en' }) => {
        const formData = new FormData();
        formData.append('audio', audioData);
        formData.append('language', language);
        
        return {
          url: '/voice',
          method: 'POST',
          body: formData,
          formData: true,
        };
      },
    }),
    
    // Text-to-Speech
    synthesizeSpeech: builder.mutation<{
      audioUrl: string;
    }, {
      text: string;
      voice?: string;
      language?: string;
    }>({
      query: (params) => ({
        url: '/tts',
        method: 'POST',
        body: {
          voice: 'neural',
          language: 'en',
          ...params,
        },
      }),
    }),
  }),
});

// Export hooks
export const {
  useGetRecommendationsMutation,
  useAcceptRecommendationMutation,
  useRejectRecommendationMutation,
  useSendChatMessageMutation,
  useGetChatHistoryQuery,
  useRunScenarioMutation,
  useGetScenariosQuery,
  useDeleteScenarioMutation,
  useGetInsightsQuery,
  useAcknowledgeInsightMutation,
  useGetPredictionsQuery,
  useQueryNaturalLanguageMutation,
  useGetModelsQuery,
  useTrainModelMutation,
  useGetPerformanceMetricsQuery,
  useProcessVoiceCommandMutation,
  useSynthesizeSpeechMutation,
} = aiApi;

export default aiApi;
