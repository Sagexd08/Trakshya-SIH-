import { useUser } from '@clerk/nextjs';

export interface AuditEvent {
  id: string;
  timestamp: Date;
  userId: string;
  userEmail: string;
  action: string;
  resource: string;
  resourceId?: string;
  details: Record<string, any>;
  ipAddress?: string;
  userAgent?: string;
  sessionId?: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  category: 'authentication' | 'authorization' | 'data' | 'system' | 'user' | 'ai' | 'scenario';
  outcome: 'success' | 'failure' | 'error';
  metadata?: Record<string, any>;
}

export interface AuditFilter {
  userId?: string;
  action?: string;
  resource?: string;
  category?: string;
  severity?: string;
  outcome?: string;
  startDate?: Date;
  endDate?: Date;
  limit?: number;
  offset?: number;
}

class AuditLogger {
  private static instance: AuditLogger;
  private events: AuditEvent[] = [];
  private maxEvents = 10000; // Keep last 10k events in memory
  private batchSize = 50;
  private batchTimeout = 5000; // 5 seconds
  private pendingEvents: AuditEvent[] = [];
  private batchTimer: NodeJS.Timeout | null = null;

  static getInstance(): AuditLogger {
    if (!AuditLogger.instance) {
      AuditLogger.instance = new AuditLogger();
    }
    return AuditLogger.instance;
  }

  constructor() {
    this.loadFromStorage();
    this.setupPeriodicFlush();
  }

  private loadFromStorage() {
    if (typeof window === 'undefined') return;
    
    try {
      const stored = localStorage.getItem('trakshya-audit-events');
      if (stored) {
        const events = JSON.parse(stored);
        this.events = events.map((e: any) => ({
          ...e,
          timestamp: new Date(e.timestamp)
        }));
      }
    } catch (error) {
      console.error('Failed to load audit events from storage:', error);
    }
  }

  private saveToStorage() {
    if (typeof window === 'undefined') return;
    
    try {
      // Keep only recent events in localStorage
      const recentEvents = this.events.slice(-1000);
      localStorage.setItem('trakshya-audit-events', JSON.stringify(recentEvents));
    } catch (error) {
      console.error('Failed to save audit events to storage:', error);
    }
  }

  private setupPeriodicFlush() {
    // Flush pending events every 30 seconds
    setInterval(() => {
      this.flushPendingEvents();
    }, 30000);
  }

  private async flushPendingEvents() {
    if (this.pendingEvents.length === 0) return;

    const eventsToFlush = [...this.pendingEvents];
    this.pendingEvents = [];

    try {
      // Send to backend audit service
      await fetch('/api/audit/events', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ events: eventsToFlush }),
      });
    } catch (error) {
      console.error('Failed to flush audit events:', error);
      // Re-add events to pending if failed
      this.pendingEvents.unshift(...eventsToFlush);
    }
  }

  private generateId(): string {
    return `audit_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private getClientInfo() {
    if (typeof window === 'undefined') return {};
    
    return {
      userAgent: navigator.userAgent,
      timestamp: new Date(),
      url: window.location.href,
      referrer: document.referrer
    };
  }

  log(params: Omit<AuditEvent, 'id' | 'timestamp'>) {
    const event: AuditEvent = {
      id: this.generateId(),
      timestamp: new Date(),
      ...params,
      ...this.getClientInfo()
    };

    // Add to in-memory store
    this.events.push(event);
    
    // Maintain max events limit
    if (this.events.length > this.maxEvents) {
      this.events = this.events.slice(-this.maxEvents);
    }

    // Add to pending batch
    this.pendingEvents.push(event);

    // Save to localStorage
    this.saveToStorage();

    // Flush if batch is full or for critical events
    if (this.pendingEvents.length >= this.batchSize || event.severity === 'critical') {
      this.flushPendingEvents();
    } else if (!this.batchTimer) {
      // Set timer for batch flush
      this.batchTimer = setTimeout(() => {
        this.flushPendingEvents();
        this.batchTimer = null;
      }, this.batchTimeout);
    }

    // Console log for development
    if (process.env.NODE_ENV === 'development') {
      console.log('Audit Event:', event);
    }
  }

  query(filter: AuditFilter = {}): AuditEvent[] {
    let filtered = [...this.events];

    if (filter.userId) {
      filtered = filtered.filter(e => e.userId === filter.userId);
    }

    if (filter.action) {
      filtered = filtered.filter(e => e.action.includes(filter.action!));
    }

    if (filter.resource) {
      filtered = filtered.filter(e => e.resource === filter.resource);
    }

    if (filter.category) {
      filtered = filtered.filter(e => e.category === filter.category);
    }

    if (filter.severity) {
      filtered = filtered.filter(e => e.severity === filter.severity);
    }

    if (filter.outcome) {
      filtered = filtered.filter(e => e.outcome === filter.outcome);
    }

    if (filter.startDate) {
      filtered = filtered.filter(e => e.timestamp >= filter.startDate!);
    }

    if (filter.endDate) {
      filtered = filtered.filter(e => e.timestamp <= filter.endDate!);
    }

    // Sort by timestamp (newest first)
    filtered.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

    // Apply pagination
    const offset = filter.offset || 0;
    const limit = filter.limit || 100;
    
    return filtered.slice(offset, offset + limit);
  }

  getStats() {
    const now = new Date();
    const last24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const last7d = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    const recent24h = this.events.filter(e => e.timestamp >= last24h);
    const recent7d = this.events.filter(e => e.timestamp >= last7d);

    return {
      total: this.events.length,
      last24h: recent24h.length,
      last7d: recent7d.length,
      byCategory: this.groupBy(this.events, 'category'),
      bySeverity: this.groupBy(this.events, 'severity'),
      byOutcome: this.groupBy(this.events, 'outcome'),
      topActions: this.getTopActions(recent7d),
      topUsers: this.getTopUsers(recent7d)
    };
  }

  private groupBy(events: AuditEvent[], key: keyof AuditEvent): Record<string, number> {
    return events.reduce((acc, event) => {
      const value = String(event[key]);
      acc[value] = (acc[value] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
  }

  private getTopActions(events: AuditEvent[], limit = 10): Array<{ action: string; count: number }> {
    const counts = this.groupBy(events, 'action');
    return Object.entries(counts)
      .map(([action, count]) => ({ action, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, limit);
  }

  private getTopUsers(events: AuditEvent[], limit = 10): Array<{ userId: string; count: number }> {
    const counts = this.groupBy(events, 'userId');
    return Object.entries(counts)
      .map(([userId, count]) => ({ userId, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, limit);
  }

  export(format: 'json' | 'csv' = 'json', filter: AuditFilter = {}): string {
    const events = this.query(filter);

    if (format === 'csv') {
      const headers = [
        'ID', 'Timestamp', 'User ID', 'User Email', 'Action', 'Resource', 
        'Resource ID', 'Category', 'Severity', 'Outcome', 'Details'
      ];
      
      const rows = events.map(event => [
        event.id,
        event.timestamp.toISOString(),
        event.userId,
        event.userEmail,
        event.action,
        event.resource,
        event.resourceId || '',
        event.category,
        event.severity,
        event.outcome,
        JSON.stringify(event.details)
      ]);

      return [headers, ...rows].map(row => 
        row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',')
      ).join('\n');
    }

    return JSON.stringify(events, null, 2);
  }

  clear() {
    this.events = [];
    this.pendingEvents = [];
    this.saveToStorage();
  }
}

// Hook for using audit logger
export function useAuditLogger() {
  const { user } = useUser();
  const logger = AuditLogger.getInstance();

  const logEvent = (params: Omit<AuditEvent, 'id' | 'timestamp' | 'userId' | 'userEmail'>) => {
    if (!user) return;

    logger.log({
      ...params,
      userId: user.id,
      userEmail: user.emailAddresses[0]?.emailAddress || 'unknown'
    });
  };

  // Predefined logging methods
  const logUserAction = (action: string, resource: string, details: Record<string, any> = {}) => {
    logEvent({
      action,
      resource,
      details,
      category: 'user',
      severity: 'low',
      outcome: 'success'
    });
  };

  const logAIAction = (action: string, details: Record<string, any> = {}) => {
    logEvent({
      action,
      resource: 'ai-system',
      details,
      category: 'ai',
      severity: 'medium',
      outcome: 'success'
    });
  };

  const logScenarioAction = (action: string, scenarioId: string, details: Record<string, any> = {}) => {
    logEvent({
      action,
      resource: 'scenario',
      resourceId: scenarioId,
      details,
      category: 'scenario',
      severity: 'medium',
      outcome: 'success'
    });
  };

  const logSystemEvent = (action: string, details: Record<string, any> = {}, severity: AuditEvent['severity'] = 'low') => {
    logEvent({
      action,
      resource: 'system',
      details,
      category: 'system',
      severity,
      outcome: 'success'
    });
  };

  const logError = (action: string, resource: string, error: Error, details: Record<string, any> = {}) => {
    logEvent({
      action,
      resource,
      details: {
        ...details,
        error: error.message,
        stack: error.stack
      },
      category: 'system',
      severity: 'high',
      outcome: 'error'
    });
  };

  return {
    logEvent,
    logUserAction,
    logAIAction,
    logScenarioAction,
    logSystemEvent,
    logError,
    query: logger.query.bind(logger),
    getStats: logger.getStats.bind(logger),
    export: logger.export.bind(logger),
    clear: logger.clear.bind(logger)
  };
}
