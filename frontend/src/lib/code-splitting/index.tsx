import React, { Suspense, lazy, ComponentType, LazyExoticComponent } from 'react';
import { motion } from 'framer-motion';
import { Loader2 } from 'lucide-react';

// Loading component for code-split components
export function LoadingSpinner({ message = 'Loading...' }: { message?: string }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="flex items-center justify-center p-8"
    >
      <div className="flex items-center space-x-3">
        <Loader2 className="w-6 h-6 animate-spin text-cyan-400" />
        <span className="text-neutral-400">{message}</span>
      </div>
    </motion.div>
  );
}

// Error boundary for code-split components
interface ErrorBoundaryState {
  hasError: boolean;
  error?: Error;
}

export class CodeSplitErrorBoundary extends React.Component<
  { children: React.ReactNode; fallback?: React.ComponentType<{ error: Error; retry: () => void }> },
  ErrorBoundaryState
> {
  constructor(props: any) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('Code split component error:', error, errorInfo);
  }

  retry = () => {
    this.setState({ hasError: false, error: undefined });
  };

  render() {
    if (this.state.hasError) {
      const FallbackComponent = this.props.fallback || DefaultErrorFallback;
      return <FallbackComponent error={this.state.error!} retry={this.retry} />;
    }

    return this.props.children;
  }
}

// Default error fallback component
function DefaultErrorFallback({ error, retry }: { error: Error; retry: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex flex-col items-center justify-center p-8 text-center"
    >
      <div className="text-4xl mb-4">⚠️</div>
      <h3 className="text-lg font-medium text-white mb-2">Failed to load component</h3>
      <p className="text-sm text-neutral-400 mb-4 max-w-md">
        {error.message || 'An error occurred while loading this component.'}
      </p>
      <button
        onClick={retry}
        className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg transition-colors"
      >
        Try Again
      </button>
    </motion.div>
  );
}

// Higher-order component for lazy loading with enhanced features
export function withLazyLoading<P extends object>(
  importFn: () => Promise<{ default: ComponentType<P> }>,
  options: {
    fallback?: React.ComponentType;
    errorFallback?: React.ComponentType<{ error: Error; retry: () => void }>;
    preload?: boolean;
    loadingMessage?: string;
  } = {}
) {
  const LazyComponent = lazy(importFn);

  // Preload the component if requested
  if (options.preload && typeof window !== 'undefined') {
    importFn().catch(console.error);
  }

  const WrappedComponent = (props: P) => {
    const FallbackComponent = options.fallback || (() => <LoadingSpinner message={options.loadingMessage} />);

    return (
      <CodeSplitErrorBoundary fallback={options.errorFallback}>
        <Suspense fallback={<FallbackComponent />}>
          <LazyComponent {...props} />
        </Suspense>
      </CodeSplitErrorBoundary>
    );
  };

  // Add preload method to the component
  (WrappedComponent as any).preload = importFn;

  return WrappedComponent;
}

// Utility for route-based code splitting
export function createLazyRoute<P extends object>(
  importFn: () => Promise<{ default: ComponentType<P> }>,
  loadingMessage?: string
) {
  return withLazyLoading(importFn, {
    loadingMessage: loadingMessage || 'Loading page...',
    preload: false,
  });
}

// Utility for component-based code splitting
export function createLazyComponent<P extends object>(
  importFn: () => Promise<{ default: ComponentType<P> }>,
  options: {
    preload?: boolean;
    loadingMessage?: string;
    errorFallback?: React.ComponentType<{ error: Error; retry: () => void }>;
  } = {}
) {
  return withLazyLoading(importFn, {
    loadingMessage: options.loadingMessage || 'Loading component...',
    preload: options.preload || false,
    errorFallback: options.errorFallback,
  });
}

// Pre-defined lazy components for heavy features
export const LazyDigitalTwinMap = createLazyComponent(
  () => import('@/components/DigitalTwinMap'),
  {
    loadingMessage: 'Loading 3D map...',
    preload: true, // Preload since it's likely to be used
  }
);

export const LazyConflictHeatmap = createLazyComponent(
  () => import('@/components/ConflictHeatmap'),
  {
    loadingMessage: 'Loading conflict analysis...',
  }
);

export const LazyEnergyChart = createLazyComponent(
  () => import('@/components/EnergyChart'),
  {
    loadingMessage: 'Loading energy analytics...',
  }
);

export const LazyScenarioModal = createLazyComponent(
  () => import('@/components/ScenarioModal'),
  {
    loadingMessage: 'Loading scenario simulator...',
  }
);

export const LazyAssistantPanel = createLazyComponent(
  () => import('@/components/AssistantPanel'),
  {
    loadingMessage: 'Loading AI assistant...',
  }
);

export const LazyThreeMapOverlay = createLazyComponent(
  () => import('@/components/ThreeMapOverlay'),
  {
    loadingMessage: 'Loading 3D visualization...',
  }
);

export const LazyVirtualizedTrainList = createLazyComponent(
  () => import('@/components/VirtualizedList').then(module => ({ default: module.VirtualizedTrainList })),
  {
    loadingMessage: 'Loading train list...',
  }
);

// Utility for preloading components based on user interaction
export class ComponentPreloader {
  private static preloadedComponents = new Set<string>();

  static preloadComponent(componentName: string, importFn: () => Promise<any>) {
    if (this.preloadedComponents.has(componentName)) {
      return;
    }

    this.preloadedComponents.add(componentName);
    
    // Preload after a short delay to avoid blocking initial render
    setTimeout(() => {
      importFn().catch(error => {
        console.warn(`Failed to preload component ${componentName}:`, error);
        this.preloadedComponents.delete(componentName);
      });
    }, 100);
  }

  static preloadOnHover(componentName: string, importFn: () => Promise<any>) {
    return {
      onMouseEnter: () => this.preloadComponent(componentName, importFn),
      onFocus: () => this.preloadComponent(componentName, importFn),
    };
  }

  static preloadOnIntersection(
    componentName: string,
    importFn: () => Promise<any>,
    options: IntersectionObserverInit = {}
  ) {
    return (element: HTMLElement | null) => {
      if (!element || typeof window === 'undefined') return;

      const observer = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting) {
              this.preloadComponent(componentName, importFn);
              observer.disconnect();
            }
          });
        },
        { threshold: 0.1, ...options }
      );

      observer.observe(element);
    };
  }
}

// Hook for managing component preloading
export function useComponentPreloader() {
  const preloadOnHover = (componentName: string, importFn: () => Promise<any>) => {
    return ComponentPreloader.preloadOnHover(componentName, importFn);
  };

  const preloadOnIntersection = (
    componentName: string,
    importFn: () => Promise<any>,
    options?: IntersectionObserverInit
  ) => {
    return ComponentPreloader.preloadOnIntersection(componentName, importFn, options);
  };

  const preloadComponent = (componentName: string, importFn: () => Promise<any>) => {
    ComponentPreloader.preloadComponent(componentName, importFn);
  };

  return {
    preloadOnHover,
    preloadOnIntersection,
    preloadComponent,
  };
}

// Bundle analyzer utility for development
export function logBundleInfo() {
  if (process.env.NODE_ENV === 'development') {
    console.group('📦 Bundle Information');
    console.log('Lazy components loaded:', ComponentPreloader['preloadedComponents']);
    console.log('Performance timing:', performance.getEntriesByType('navigation'));
    console.groupEnd();
  }
}

// Performance monitoring for code-split components
export function measureComponentLoadTime(componentName: string) {
  const startTime = performance.now();
  
  return () => {
    const endTime = performance.now();
    const loadTime = endTime - startTime;
    
    console.log(`⚡ Component ${componentName} loaded in ${loadTime.toFixed(2)}ms`);
    
    // Send to analytics if available
    if (typeof window !== 'undefined' && (window as any).gtag) {
      (window as any).gtag('event', 'component_load_time', {
        component_name: componentName,
        load_time: Math.round(loadTime),
      });
    }
  };
}
