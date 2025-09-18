import { useEffect, useCallback, useRef, useState } from 'react';
import { debounce, throttle } from 'lodash-es';

// Performance optimization utilities
export class PerformanceOptimizer {
  private static instance: PerformanceOptimizer;
  private observers: Map<string, IntersectionObserver> = new Map();
  private rafCallbacks: Set<() => void> = new Set();
  private isRAFScheduled = false;

  static getInstance(): PerformanceOptimizer {
    if (!PerformanceOptimizer.instance) {
      PerformanceOptimizer.instance = new PerformanceOptimizer();
    }
    return PerformanceOptimizer.instance;
  }

  // Batch DOM updates using requestAnimationFrame
  scheduleUpdate(callback: () => void) {
    this.rafCallbacks.add(callback);
    
    if (!this.isRAFScheduled) {
      this.isRAFScheduled = true;
      requestAnimationFrame(() => {
        this.rafCallbacks.forEach(cb => cb());
        this.rafCallbacks.clear();
        this.isRAFScheduled = false;
      });
    }
  }

  // Create optimized intersection observer
  createIntersectionObserver(
    key: string,
    callback: IntersectionObserverCallback,
    options?: IntersectionObserverInit
  ): IntersectionObserver {
    if (this.observers.has(key)) {
      return this.observers.get(key)!;
    }

    const observer = new IntersectionObserver(callback, {
      rootMargin: '50px',
      threshold: [0, 0.1, 0.5, 1],
      ...options,
    });

    this.observers.set(key, observer);
    return observer;
  }

  // Cleanup observers
  cleanup() {
    this.observers.forEach(observer => observer.disconnect());
    this.observers.clear();
    this.rafCallbacks.clear();
  }
}

// Hook for optimized scrolling
export function useOptimizedScroll(
  callback: (scrollY: number, direction: 'up' | 'down') => void,
  deps: any[] = []
) {
  const lastScrollY = useRef(0);
  const ticking = useRef(false);

  const handleScroll = useCallback(
    throttle(() => {
      const scrollY = window.scrollY;
      const direction = scrollY > lastScrollY.current ? 'down' : 'up';
      
      if (!ticking.current) {
        requestAnimationFrame(() => {
          callback(scrollY, direction);
          lastScrollY.current = scrollY;
          ticking.current = false;
        });
        ticking.current = true;
      }
    }, 16), // ~60fps
    [callback, ...deps]
  );

  useEffect(() => {
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, [handleScroll]);
}

// Hook for optimized resize handling
export function useOptimizedResize(
  callback: (width: number, height: number) => void,
  deps: any[] = []
) {
  const handleResize = useCallback(
    debounce(() => {
      callback(window.innerWidth, window.innerHeight);
    }, 150),
    [callback, ...deps]
  );

  useEffect(() => {
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [handleResize]);
}

// Hook for intersection observer
export function useIntersectionObserver(
  options?: IntersectionObserverInit
) {
  const [isIntersecting, setIsIntersecting] = useState(false);
  const [entry, setEntry] = useState<IntersectionObserverEntry | null>(null);
  const elementRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const element = elementRef.current;
    if (!element) return;

    const optimizer = PerformanceOptimizer.getInstance();
    const observer = optimizer.createIntersectionObserver(
      `intersection-${Math.random()}`,
      (entries) => {
        const [entry] = entries;
        setIsIntersecting(entry.isIntersecting);
        setEntry(entry);
      },
      options
    );

    observer.observe(element);

    return () => {
      observer.unobserve(element);
    };
  }, [options]);

  return { elementRef, isIntersecting, entry };
}

// Hook for lazy loading images
export function useLazyImage(src: string, placeholder?: string) {
  const [imageSrc, setImageSrc] = useState(placeholder || '');
  const [isLoaded, setIsLoaded] = useState(false);
  const [isError, setIsError] = useState(false);
  const { elementRef, isIntersecting } = useIntersectionObserver({
    threshold: 0.1,
    rootMargin: '100px',
  });

  useEffect(() => {
    if (isIntersecting && src && !isLoaded) {
      const img = new Image();
      
      img.onload = () => {
        setImageSrc(src);
        setIsLoaded(true);
      };
      
      img.onerror = () => {
        setIsError(true);
      };
      
      img.src = src;
    }
  }, [isIntersecting, src, isLoaded]);

  return { elementRef, imageSrc, isLoaded, isError };
}

// Hook for virtual scrolling
export function useVirtualScroll<T>(
  items: T[],
  itemHeight: number,
  containerHeight: number,
  overscan: number = 5
) {
  const [scrollTop, setScrollTop] = useState(0);
  const scrollElementRef = useRef<HTMLElement | null>(null);

  const startIndex = Math.max(0, Math.floor(scrollTop / itemHeight) - overscan);
  const endIndex = Math.min(
    items.length - 1,
    Math.ceil((scrollTop + containerHeight) / itemHeight) + overscan
  );

  const visibleItems = items.slice(startIndex, endIndex + 1).map((item, index) => ({
    item,
    index: startIndex + index,
  }));

  const totalHeight = items.length * itemHeight;
  const offsetY = startIndex * itemHeight;

  const handleScroll = useCallback(
    throttle((e: Event) => {
      const target = e.target as HTMLElement;
      setScrollTop(target.scrollTop);
    }, 16),
    []
  );

  useEffect(() => {
    const element = scrollElementRef.current;
    if (!element) return;

    element.addEventListener('scroll', handleScroll, { passive: true });
    return () => element.removeEventListener('scroll', handleScroll);
  }, [handleScroll]);

  return {
    scrollElementRef,
    visibleItems,
    totalHeight,
    offsetY,
  };
}

// Hook for optimized animations
export function useOptimizedAnimation(
  animationFn: () => void,
  dependencies: any[] = []
) {
  const rafRef = useRef<number | null>(null);
  const isRunning = useRef(false);

  const start = useCallback(() => {
    if (isRunning.current) return;
    
    isRunning.current = true;
    
    const animate = () => {
      animationFn();
      
      if (isRunning.current) {
        rafRef.current = requestAnimationFrame(animate);
      }
    };
    
    rafRef.current = requestAnimationFrame(animate);
  }, [animationFn, ...dependencies]);

  const stop = useCallback(() => {
    isRunning.current = false;
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
    }
  }, []);

  useEffect(() => {
    return () => {
      stop();
    };
  }, [stop]);

  return { start, stop, isRunning: isRunning.current };
}

// Memory management utilities
export class MemoryManager {
  private static cache = new Map<string, any>();
  private static maxCacheSize = 100;

  static set(key: string, value: any, ttl?: number) {
    // Implement LRU cache
    if (this.cache.size >= this.maxCacheSize) {
      const firstKey = this.cache.keys().next().value as string | undefined;
      if (firstKey !== undefined) {
        this.cache.delete(firstKey);
      }
    }

    const item = {
      value,
      timestamp: Date.now(),
      ttl: ttl ? Date.now() + ttl : undefined,
    };

    this.cache.set(key, item);
  }

  static get(key: string) {
    const item = this.cache.get(key);
    
    if (!item) return undefined;
    
    // Check TTL
    if (item.ttl && Date.now() > item.ttl) {
      this.cache.delete(key);
      return undefined;
    }

    return item.value;
  }

  static clear() {
    this.cache.clear();
  }

  static cleanup() {
    const now = Date.now();
    
    for (const [key, item] of this.cache.entries()) {
      if (item.ttl && now > item.ttl) {
        this.cache.delete(key);
      }
    }
  }
}

// Hook for memory-efficient caching
export function useMemoryCache<T>(
  key: string,
  factory: () => T,
  ttl?: number
): T {
  const [value, setValue] = useState<T>(() => {
    const cached = MemoryManager.get(key);
    if (cached !== undefined) {
      return cached;
    }
    
    const newValue = factory();
    MemoryManager.set(key, newValue, ttl);
    return newValue;
  });

  useEffect(() => {
    const cached = MemoryManager.get(key);
    if (cached === undefined) {
      const newValue = factory();
      MemoryManager.set(key, newValue, ttl);
      setValue(newValue);
    }
  }, [key, factory, ttl]);

  return value;
}

// Performance monitoring hook
export function usePerformanceMonitor(componentName: string) {
  const renderCount = useRef(0);
  const startTime = useRef(performance.now());

  useEffect(() => {
    renderCount.current++;
    const endTime = performance.now();
    const renderTime = endTime - startTime.current;

    if (process.env.NODE_ENV === 'development') {
      console.log(`🔍 ${componentName} render #${renderCount.current}: ${renderTime.toFixed(2)}ms`);
    }

    startTime.current = performance.now();
  });

  return {
    renderCount: renderCount.current,
  };
}

// Initialize performance optimizations
export function initializePerformanceOptimizations() {
  // Cleanup memory cache periodically
  setInterval(() => {
    MemoryManager.cleanup();
  }, 5 * 60 * 1000); // Every 5 minutes

  // Monitor performance
  if (typeof window !== 'undefined') {
    // Report long tasks
    if ('PerformanceObserver' in window) {
      const observer = new PerformanceObserver((list) => {
        list.getEntries().forEach((entry) => {
          if (entry.duration > 50) {
            console.warn(`⚠️ Long task detected: ${entry.duration.toFixed(2)}ms`);
          }
        });
      });

      try {
        observer.observe({ entryTypes: ['longtask'] });
      } catch (e) {
        // Long task API not supported
      }
    }
  }

  console.log('⚡ Performance optimizations initialized');
}
