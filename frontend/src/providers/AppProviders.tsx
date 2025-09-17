/**
 * Application Providers
 * Wraps the app with all necessary providers for state management, theming, and services
 */

'use client';

import React, { useEffect, useState } from 'react';
import { Provider } from 'react-redux';
import { PersistGate } from 'redux-persist/integration/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { ThemeProvider } from 'next-themes';
import { ClerkProvider } from '@clerk/nextjs';
import { Toaster } from 'sonner';

import { store, persistor } from '@/store';
import { config, isDevelopment, configValidation } from '@/config';
import { initializeDemoMode } from '@/store/slices/authSlice';
import { addNotification } from '@/store/slices/notificationSlice';

// Error Boundary Component
class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; error?: Error }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('Application Error:', error, errorInfo);
    
    // Log error to monitoring service
    if (config.monitoring.sentryDsn) {
      // Sentry.captureException(error, { extra: errorInfo });
    }
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-neutral-950 text-neutral-100 flex items-center justify-center">
          <div className="text-center space-y-4">
            <h1 className="text-2xl font-bold text-red-400">Something went wrong</h1>
            <p className="text-neutral-400">
              The application encountered an unexpected error.
            </p>
            <button
              onClick={() => window.location.reload()}
              className="px-4 py-2 bg-cyan-600 text-white rounded hover:bg-cyan-700"
            >
              Reload Application
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

// Loading Component
const LoadingScreen = () => (
  <div className="min-h-screen bg-neutral-950 text-neutral-100 flex items-center justify-center">
    <div className="text-center space-y-4">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-cyan-400 mx-auto"></div>
      <p className="text-neutral-400">Loading Trakshya...</p>
    </div>
  </div>
);

// Configuration Status Component
const ConfigurationStatus = ({ children }: { children: React.ReactNode }) => {
  const [showWarnings, setShowWarnings] = useState(false);

  useEffect(() => {
    if (!configValidation.isValid && isDevelopment()) {
      setShowWarnings(true);
      
      // Auto-hide warnings after 10 seconds
      const timer = setTimeout(() => setShowWarnings(false), 10000);
      return () => clearTimeout(timer);
    }
  }, []);

  if (showWarnings && configValidation.issues.length > 0) {
    return (
      <div className="min-h-screen bg-neutral-950 text-neutral-100">
        <div className="bg-amber-500/10 border-b border-amber-500/20 p-4">
          <div className="max-w-7xl mx-auto">
            <h3 className="text-amber-400 font-semibold mb-2">Configuration Issues</h3>
            <ul className="text-sm text-amber-300 space-y-1">
              {configValidation.issues.map((issue, index) => (
                <li key={index}>• {issue}</li>
              ))}
            </ul>
            <button
              onClick={() => setShowWarnings(false)}
              className="mt-2 text-xs text-amber-400 hover:text-amber-300"
            >
              Dismiss
            </button>
          </div>
        </div>
        {children}
      </div>
    );
  }

  return <>{children}</>;
};

// React Query Client Configuration
const createQueryClient = () => {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: config.performance.cacheTtl * 1000,
        gcTime: 10 * 60 * 1000, // 10 minutes
        retry: (failureCount, error: any) => {
          // Don't retry on 4xx errors
          if (error?.status >= 400 && error?.status < 500) {
            return false;
          }
          return failureCount < 3;
        },
        refetchOnWindowFocus: false,
        refetchOnReconnect: true,
      },
      mutations: {
        retry: 1,
      },
    },
  });
};

// Store Initialization
const StoreInitializer = ({ children }: { children: React.ReactNode }) => {
  useEffect(() => {
    // Initialize demo mode if Clerk is not configured
    if (!config.services.clerk.enabled) {
      store.dispatch(initializeDemoMode());
      
      // Add welcome notification
      store.dispatch(addNotification({
        type: 'info',
        category: 'system',
        title: 'Demo Mode Active',
        message: 'Running in demo mode with mock data. Configure authentication to enable full features.',
        persistent: false,
        priority: 'low',
        source: 'system',
      }));
    }

    // Add configuration warnings as notifications
    if (configValidation.issues.length > 0) {
      configValidation.issues.forEach((issue, index) => {
        store.dispatch(addNotification({
          type: 'warning',
          category: 'system',
          title: 'Configuration Issue',
          message: issue,
          persistent: false,
          priority: 'medium',
          source: 'config',
        }));
      });
    }
  }, []);

  return <>{children}</>;
};

// Main App Providers Component
export default function AppProviders({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => createQueryClient());

  return (
    <ErrorBoundary>
      <Provider store={store}>
        <PersistGate loading={<LoadingScreen />} persistor={persistor}>
          <StoreInitializer>
            <QueryClientProvider client={queryClient}>
              <ThemeProvider
                attribute="class"
                defaultTheme="dark"
                enableSystem
                disableTransitionOnChange
              >
                {config.services.clerk.enabled ? (
                  <ClerkProvider
                    publishableKey={config.services.clerk.publishableKey!}
                    appearance={{
                      baseTheme: undefined,
                      variables: {
                        colorPrimary: '#06b6d4',
                        colorBackground: '#0a0a0a',
                        colorInputBackground: '#171717',
                        colorInputText: '#f5f5f5',
                      },
                    }}
                  >
                    <ConfigurationStatus>
                      {children}
                    </ConfigurationStatus>
                  </ClerkProvider>
                ) : (
                  <ConfigurationStatus>
                    {children}
                  </ConfigurationStatus>
                )}
                
                {/* Toast Notifications */}
                <Toaster
                  position="top-right"
                  theme="dark"
                  richColors
                  closeButton
                  duration={5000}
                  toastOptions={{
                    style: {
                      background: '#171717',
                      border: '1px solid #404040',
                      color: '#f5f5f5',
                    },
                  }}
                />
                
                {/* React Query DevTools */}
                {isDevelopment() && (
                  <ReactQueryDevtools
                    initialIsOpen={false}
                    position="bottom-right"
                    buttonPosition="bottom-right"
                  />
                )}
              </ThemeProvider>
            </QueryClientProvider>
          </StoreInitializer>
        </PersistGate>
      </Provider>
    </ErrorBoundary>
  );
}

// Performance Monitor Hook
export const usePerformanceMonitor = () => {
  useEffect(() => {
    if (!isDevelopment()) return;

    const observer = new PerformanceObserver((list) => {
      const entries = list.getEntries();
      entries.forEach((entry) => {
        if (entry.entryType === 'navigation') {
          console.log('Navigation Performance:', {
            loadTime: entry.loadEventEnd - entry.loadEventStart,
            domContentLoaded: entry.domContentLoadedEventEnd - entry.domContentLoadedEventStart,
            firstPaint: performance.getEntriesByType('paint')[0]?.startTime,
          });
        }
      });
    });

    observer.observe({ entryTypes: ['navigation', 'paint'] });

    return () => observer.disconnect();
  }, []);
};

// Service Worker Registration
export const registerServiceWorker = () => {
  if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker
        .register('/sw.js')
        .then((registration) => {
          console.log('SW registered: ', registration);
        })
        .catch((registrationError) => {
          console.log('SW registration failed: ', registrationError);
        });
    });
  }
};
