import * as Sentry from '@sentry/nextjs';
import { useEffect, useCallback } from 'react';
import { useUser } from '@clerk/nextjs';

// Performance monitoring
export interface PerformanceMetrics {
  pageLoadTime: number;
  firstContentfulPaint: number;
  largestContentfulPaint: number;
  cumulativeLayoutShift: number;
  firstInputDelay: number;
  timeToInteractive: number;
  totalBlockingTime: number;
}

export interface UserInteractionMetrics {
  clickEvents: number;
  scrollEvents: number;
  keyboardEvents: number;
  formSubmissions: number;
  errorEvents: number;
  sessionDuration: number;
}

export interface SystemMetrics {
  memoryUsage: number;
  cpuUsage: number;
  networkLatency: number;
  apiResponseTimes: Record<string, number>;
  errorRate: number;
  activeUsers: number;
}

class PerformanceMonitor {
  private static instance: PerformanceMonitor;
  private metrics: PerformanceMetrics | null = null;
  private userMetrics: UserInteractionMetrics;
  private startTime: number;
  private observer: PerformanceObserver | null = null;

  static getInstance(): PerformanceMonitor {
    if (!PerformanceMonitor.instance) {
      PerformanceMonitor.instance = new PerformanceMonitor();
    }
    return PerformanceMonitor.instance;
  }

  constructor() {
    this.startTime = Date.now();
    this.userMetrics = {
      clickEvents: 0,
      scrollEvents: 0,
      keyboardEvents: 0,
      formSubmissions: 0,
      errorEvents: 0,
      sessionDuration: 0,
    };

    this.initializePerformanceObserver();
    this.trackUserInteractions();
  }

  private initializePerformanceObserver() {
    if (typeof window === 'undefined' || !('PerformanceObserver' in window)) return;

    try {
      this.observer = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        
        entries.forEach((entry) => {
          switch (entry.entryType) {
            case 'navigation':
              this.handleNavigationEntry(entry as PerformanceNavigationTiming);
              break;
            case 'paint':
              this.handlePaintEntry(entry as PerformancePaintTiming);
              break;
            case 'largest-contentful-paint':
              this.handleLCPEntry(entry);
              break;
            case 'layout-shift':
              this.handleLayoutShiftEntry(entry);
              break;
            case 'first-input':
              this.handleFirstInputEntry(entry);
              break;
          }
        });
      });

      this.observer.observe({ entryTypes: ['navigation', 'paint', 'largest-contentful-paint', 'layout-shift', 'first-input'] });
    } catch (error) {
      console.warn('Performance Observer not supported:', error);
    }
  }

  private handleNavigationEntry(entry: PerformanceNavigationTiming) {
    this.metrics = {
      ...this.metrics,
      pageLoadTime: entry.loadEventEnd - entry.startTime,
      timeToInteractive: entry.domInteractive - entry.startTime,
      totalBlockingTime: entry.domContentLoadedEventEnd - entry.domContentLoadedEventStart,
    } as PerformanceMetrics;
  }

  private handlePaintEntry(entry: PerformancePaintTiming) {
    if (entry.name === 'first-contentful-paint') {
      this.metrics = {
        ...this.metrics,
        firstContentfulPaint: entry.startTime,
      } as PerformanceMetrics;
    }
  }

  private handleLCPEntry(entry: any) {
    this.metrics = {
      ...this.metrics,
      largestContentfulPaint: entry.startTime,
    } as PerformanceMetrics;
  }

  private handleLayoutShiftEntry(entry: any) {
    if (!entry.hadRecentInput) {
      this.metrics = {
        ...this.metrics,
        cumulativeLayoutShift: (this.metrics?.cumulativeLayoutShift || 0) + entry.value,
      } as PerformanceMetrics;
    }
  }

  private handleFirstInputEntry(entry: any) {
    this.metrics = {
      ...this.metrics,
      firstInputDelay: entry.processingStart - entry.startTime,
    } as PerformanceMetrics;
  }

  private trackUserInteractions() {
    if (typeof window === 'undefined') return;

    // Track clicks
    document.addEventListener('click', () => {
      this.userMetrics.clickEvents++;
    });

    // Track scrolls
    document.addEventListener('scroll', () => {
      this.userMetrics.scrollEvents++;
    });

    // Track keyboard events
    document.addEventListener('keydown', () => {
      this.userMetrics.keyboardEvents++;
    });

    // Track form submissions
    document.addEventListener('submit', () => {
      this.userMetrics.formSubmissions++;
    });

    // Track errors
    window.addEventListener('error', () => {
      this.userMetrics.errorEvents++;
    });

    // Update session duration periodically
    setInterval(() => {
      this.userMetrics.sessionDuration = Date.now() - this.startTime;
    }, 1000);
  }

  getMetrics(): PerformanceMetrics | null {
    return this.metrics;
  }

  getUserMetrics(): UserInteractionMetrics {
    return { ...this.userMetrics };
  }

  sendMetrics() {
    if (!this.metrics) return;

    // Send to analytics service
    fetch('/api/analytics/performance', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        performance: this.metrics,
        userInteractions: this.userMetrics,
        timestamp: new Date().toISOString(),
        url: window.location.href,
        userAgent: navigator.userAgent,
      }),
    }).catch(console.error);

    // Send to Sentry for performance monitoring
    Sentry.addBreadcrumb({
      category: 'performance',
      message: 'Performance metrics collected',
      data: this.metrics,
      level: 'info',
    });
  }

  disconnect() {
    if (this.observer) {
      this.observer.disconnect();
    }
  }
}

// Error tracking and reporting
export class ErrorTracker {
  private static instance: ErrorTracker;
  private errorQueue: Array<{ error: Error; context: any; timestamp: Date }> = [];
  private maxQueueSize = 100;

  static getInstance(): ErrorTracker {
    if (!ErrorTracker.instance) {
      ErrorTracker.instance = new ErrorTracker();
    }
    return ErrorTracker.instance;
  }

  constructor() {
    this.setupGlobalErrorHandlers();
  }

  private setupGlobalErrorHandlers() {
    if (typeof window === 'undefined') return;

    // Handle unhandled promise rejections
    window.addEventListener('unhandledrejection', (event) => {
      this.captureError(new Error(event.reason), {
        type: 'unhandledrejection',
        promise: event.promise,
      });
    });

    // Handle global errors
    window.addEventListener('error', (event) => {
      this.captureError(event.error || new Error(event.message), {
        type: 'javascript',
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno,
      });
    });
  }

  captureError(error: Error, context: any = {}) {
    const errorEntry = {
      error,
      context: {
        ...context,
        url: typeof window !== 'undefined' ? window.location.href : '',
        userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : '',
        timestamp: new Date(),
      },
      timestamp: new Date(),
    };

    // Add to queue
    this.errorQueue.push(errorEntry);
    
    // Maintain queue size
    if (this.errorQueue.length > this.maxQueueSize) {
      this.errorQueue.shift();
    }

    // Send to Sentry
    Sentry.captureException(error, {
      contexts: {
        custom: context,
      },
    });

    // Send to custom error tracking
    this.sendErrorReport(errorEntry);

    console.error('Error captured:', error, context);
  }

  private async sendErrorReport(errorEntry: any) {
    try {
      await fetch('/api/errors', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: errorEntry.error.message,
          stack: errorEntry.error.stack,
          context: errorEntry.context,
          timestamp: errorEntry.timestamp,
        }),
      });
    } catch (error) {
      console.error('Failed to send error report:', error);
    }
  }

  getErrorQueue() {
    return [...this.errorQueue];
  }

  clearErrorQueue() {
    this.errorQueue = [];
  }
}

// React hook for monitoring
export function usePerformanceMonitoring() {
  const { user } = useUser();
  const performanceMonitor = PerformanceMonitor.getInstance();
  const errorTracker = ErrorTracker.getInstance();

  useEffect(() => {
    // Set user context for Sentry
    if (user) {
      Sentry.setUser({
        id: user.id,
        email: user.emailAddresses[0]?.emailAddress,
        username: user.firstName + ' ' + user.lastName,
      });
    }

    // Send metrics periodically
    const interval = setInterval(() => {
      performanceMonitor.sendMetrics();
    }, 30000); // Every 30 seconds

    return () => {
      clearInterval(interval);
      performanceMonitor.disconnect();
    };
  }, [user, performanceMonitor]);

  const captureError = useCallback((error: Error, context?: any) => {
    errorTracker.captureError(error, context);
  }, [errorTracker]);

  const getMetrics = useCallback(() => {
    return {
      performance: performanceMonitor.getMetrics(),
      userInteractions: performanceMonitor.getUserMetrics(),
      errors: errorTracker.getErrorQueue(),
    };
  }, [performanceMonitor, errorTracker]);

  return {
    captureError,
    getMetrics,
  };
}

// Initialize monitoring
export function initializeMonitoring() {
  if (typeof window === 'undefined') return;

  // Initialize Sentry
  Sentry.init({
    dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
    environment: process.env.NODE_ENV,
    tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,
    debug: process.env.NODE_ENV === 'development',
    integrations: [],
  });

  // Initialize performance monitoring
  PerformanceMonitor.getInstance();
  ErrorTracker.getInstance();

  console.log('🔍 Monitoring initialized');
}

// API response time tracking
export function trackAPICall(endpoint: string, startTime: number, success: boolean) {
  const duration = Date.now() - startTime;
  
  // Send to analytics
  fetch('/api/analytics/api-performance', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      endpoint,
      duration,
      success,
      timestamp: new Date().toISOString(),
    }),
  }).catch(console.error);

  // Add Sentry breadcrumb
  Sentry.addBreadcrumb({
    category: 'api',
    message: `API call to ${endpoint}`,
    data: { duration, success },
    level: success ? 'info' : 'error',
  });
}
