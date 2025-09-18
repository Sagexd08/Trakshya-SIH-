import { GoogleGenerativeAI } from '@google/generative-ai';

const API_KEY = process.env.GOOGLE_GEMINI_API_KEY;

if (!API_KEY) {
  console.warn('GOOGLE_GEMINI_API_KEY not found. AI features will be disabled.');
}

const genAI = API_KEY ? new GoogleGenerativeAI(API_KEY) : null;

export interface AIRecommendation {
  id: string;
  type: 'delay' | 'route' | 'energy' | 'conflict';
  title: string;
  description: string;
  confidence: number;
  impact: {
    delayReduction?: number;
    energySavings?: number;
    throughputImprovement?: number;
    conflictsResolved?: number;
  };
  actions: {
    trainId?: string;
    delayMinutes?: number;
    routeChange?: string;
    priority?: 'low' | 'medium' | 'high';
  };
  reasoning: string;
  timestamp: Date;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  metadata?: {
    recommendations?: Array<AIRecommendation | string>;
    charts?: string[];
    actions?: string[];
  };
}

export interface SystemContext {
  activeTrains: number;
  conflicts: Array<{
    id: string;
    trainA: string;
    trainB: string;
    severity: 'low' | 'medium' | 'high';
    predictedTime: string;
  }>;
  energyEfficiency: number;
  avgDelay: number;
  throughput: number;
  userRole: 'admin' | 'controller' | 'analyst';
  currentView: string;
}

class GeminiService {
  private model = genAI?.getGenerativeModel({ model: 'gemini-pro' });

  async generateRecommendations(context: SystemContext): Promise<AIRecommendation[]> {
    if (!this.model) {
      return this.getMockRecommendations();
    }

    try {
      const prompt = this.buildRecommendationPrompt(context);
      const result = await this.model.generateContent(prompt);
      const response = await result.response;
      const text = response.text();
      
      return this.parseRecommendations(text);
    } catch (error) {
      console.error('Error generating recommendations:', error);
      return this.getMockRecommendations();
    }
  }

  async chatWithAssistant(
    message: string, 
    context: SystemContext, 
    history: ChatMessage[] = []
  ): Promise<ChatMessage> {
    if (!this.model) {
      return this.getMockChatResponse(message);
    }

    try {
      const prompt = this.buildChatPrompt(message, context, history);
      const result = await this.model.generateContent(prompt);
      const response = await result.response;
      const text = response.text();
      
      return {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: text,
        timestamp: new Date(),
        metadata: this.extractMetadata(text)
      };
    } catch (error) {
      console.error('Error in chat:', error);
      return this.getMockChatResponse(message);
    }
  }

  async explainScenarioImpact(
    scenario: string,
    context: SystemContext
  ): Promise<string> {
    if (!this.model) {
      return this.getMockScenarioExplanation(scenario);
    }

    try {
      const prompt = `
        As a railway operations expert, explain the impact of this scenario on the Indian Railways network:
        
        Scenario: ${scenario}
        Current Context:
        - Active Trains: ${context.activeTrains}
        - Current Conflicts: ${context.conflicts.length}
        - Energy Efficiency: ${context.energyEfficiency}%
        - Average Delay: ${context.avgDelay} minutes
        - Throughput: ${context.throughput}%
        
        Provide a detailed analysis covering:
        1. Immediate impact on train operations
        2. Cascading effects on the network
        3. Estimated delay increases
        4. Energy consumption changes
        5. Recommended mitigation strategies
        
        Keep the explanation clear and actionable for railway controllers.
      `;
      
      const result = await this.model.generateContent(prompt);
      const response = await result.response;
      return response.text();
    } catch (error) {
      console.error('Error explaining scenario:', error);
      return this.getMockScenarioExplanation(scenario);
    }
  }

  private buildRecommendationPrompt(context: SystemContext): string {
    return `
      You are an AI assistant for Indian Railways operations. Analyze the current system state and provide actionable recommendations.
      
      Current System State:
      - Active Trains: ${context.activeTrains}
      - Active Conflicts: ${context.conflicts.length}
      - Energy Efficiency: ${context.energyEfficiency}%
      - Average Delay: ${context.avgDelay} minutes
      - Throughput: ${context.throughput}%
      - User Role: ${context.userRole}
      
      Conflicts:
      ${context.conflicts.map(c => `- ${c.trainA} vs ${c.trainB} (${c.severity} severity) at ${c.predictedTime}`).join('\n')}
      
      Generate 2-3 specific recommendations in JSON format with the following structure:
      {
        "recommendations": [
          {
            "type": "delay|route|energy|conflict",
            "title": "Brief title",
            "description": "Detailed description",
            "confidence": 0.85,
            "impact": {
              "delayReduction": 5,
              "energySavings": 12,
              "throughputImprovement": 3,
              "conflictsResolved": 1
            },
            "actions": {
              "trainId": "12345",
              "delayMinutes": 4,
              "priority": "high"
            },
            "reasoning": "Detailed explanation of why this recommendation is optimal"
          }
        ]
      }
      
      Focus on high-impact, actionable recommendations that a ${context.userRole} can implement.
    `;
  }

  private buildChatPrompt(message: string, context: SystemContext, history: ChatMessage[]): string {
    const historyText = history.slice(-5).map(h => `${h.role}: ${h.content}`).join('\n');
    
    return `
      You are an AI assistant for Indian Railways operations control center. You help railway controllers and analysts with real-time decision making.
      
      Current System Context:
      - Active Trains: ${context.activeTrains}
      - Conflicts: ${context.conflicts.length}
      - Energy Efficiency: ${context.energyEfficiency}%
      - Average Delay: ${context.avgDelay} minutes
      - Throughput: ${context.throughput}%
      - User Role: ${context.userRole}
      - Current View: ${context.currentView}
      
      Recent Conversation:
      ${historyText}
      
      User Message: ${message}
      
      Respond as a knowledgeable railway operations expert. Be concise, actionable, and specific to Indian Railways operations. If the user asks about specific trains, conflicts, or operational decisions, provide detailed analysis and recommendations.
      
      If appropriate, suggest specific actions the user can take in the dashboard.
    `;
  }

  private parseRecommendations(text: string): AIRecommendation[] {
    try {
      const parsed = JSON.parse(text);
      return parsed.recommendations?.map((rec: any) => ({
        id: crypto.randomUUID(),
        ...rec,
        timestamp: new Date()
      })) || [];
    } catch {
      return this.getMockRecommendations();
    }
  }

  private extractMetadata(text: string): ChatMessage['metadata'] {
    // Extract actionable items from AI response
    const recommendations = text.match(/recommend|suggest/gi)?.length || 0;
    const charts = text.match(/chart|graph|visualization/gi)?.length || 0;
    const actions = text.match(/delay|route|stop|priority/gi)?.length || 0;
    
    return {
      recommendations: recommendations > 0 ? ['AI-generated'] : undefined,
      charts: charts > 0 ? ['suggested'] : undefined,
      actions: actions > 0 ? ['available'] : undefined
    };
  }

  private getMockRecommendations(): AIRecommendation[] {
    return [
      {
        id: crypto.randomUUID(),
        type: 'delay',
        title: 'Delay Train 12432 by 4 minutes',
        description: 'Delaying this train will resolve conflict with Train 12001 and improve overall throughput',
        confidence: 0.87,
        impact: {
          delayReduction: 8,
          throughputImprovement: 5,
          conflictsResolved: 1
        },
        actions: {
          trainId: '12432',
          delayMinutes: 4,
          priority: 'high'
        },
        reasoning: 'Analysis shows this minimal delay prevents a cascade of conflicts affecting 3 other trains',
        timestamp: new Date()
      }
    ];
  }

  private getMockChatResponse(message: string): ChatMessage {
    return {
      id: crypto.randomUUID(),
      role: 'assistant',
      content: `I understand you're asking about "${message}". Based on current system status, I recommend checking the conflict heatmap for potential issues. The AI service is currently in demo mode.`,
      timestamp: new Date(),
      metadata: {
        recommendations: ['demo-mode'],
        actions: ['check-conflicts']
      }
    };
  }

  private getMockScenarioExplanation(scenario: string): string {
    return `
      **Impact Analysis for: ${scenario}**
      
      **Immediate Effects:**
      - Estimated 15-20% reduction in network throughput
      - Average delay increase of 8-12 minutes per train
      - 3-5 additional conflicts expected in the next 2 hours
      
      **Cascading Effects:**
      - Passenger train priorities may need adjustment
      - Freight operations will experience delays
      - Energy consumption may increase by 10-15%
      
      **Recommended Actions:**
      1. Implement alternative routing for affected corridors
      2. Increase buffer times for critical connections
      3. Coordinate with maintenance teams for rapid resolution
      4. Communicate delays to passengers and freight customers
      
      *This is a demo response. Connect your Gemini API key for real-time analysis.*
    `;
  }
}

export const geminiService = new GeminiService();
