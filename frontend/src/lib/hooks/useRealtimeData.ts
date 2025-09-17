import { useState, useEffect, useCallback, useRef } from 'react';
import { realtimeManager } from '@/lib/realtime/supabaseRealtime';
import { indexedDBCache } from '@/lib/cache/indexedDBCache';
import { createSupabaseBrowser } from '@/lib/supabase/client';
import { toast } from 'sonner';

interface UseRealtimeDataOptions {
  table: string;
  initialFetch?: boolean;
  cacheEnabled?: boolean;
  optimisticUpdates?: boolean;
  errorRetryCount?: number;
  errorRetryDelay?: number;
}

interface RealtimeDataState<T> {
  data: T[];
  isLoading: boolean;
  isConnected: boolean;
  error: string | null;
  lastUpdated: Date | null;
  cacheStats: {
    cacheHits: number;
    cacheMisses: number;
    totalRequests: number;
  };
}

export function useRealtimeData<T = any>(
  options: UseRealtimeDataOptions
): RealtimeDataState<T> & {
  refetch: () => Promise<void>;
  clearCache: () => Promise<void>;
  addOptimisticUpdate: (item: T) => void;
  removeOptimisticUpdate: (id: string) => void;
  updateOptimisticUpdate: (id: string, updates: Partial<T>) => void;
} {
  const {
    table,
    initialFetch = true,
    cacheEnabled = true,
    optimisticUpdates = true,
    errorRetryCount = 3,
    errorRetryDelay = 1000
  } = options;

  const [state, setState] = useState<RealtimeDataState<T>>({
    data: [],
    isLoading: true,
    isConnected: false,
    error: null,
    lastUpdated: null,
    cacheStats: {
      cacheHits: 0,
      cacheMisses: 0,
      totalRequests: 0
    }
  });

  const supabase = createSupabaseBrowser();
  const subscriptionRef = useRef<string | null>(null);
  const optimisticUpdatesRef = useRef<Map<string, T>>(new Map());
  const retryCountRef = useRef(0);
  const retryTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Fetch data from Supabase
  const fetchFromSupabase = useCallback(async (): Promise<T[]> => {
    try {
      const { data, error } = await supabase
        .from(table)
        .select('*')
        .order('created_at', { ascending: false })
        .limit(1000);

      if (error) {
        // If it's a configuration error, return empty array instead of throwing
        if (error.message?.includes('Missing') || error.message?.includes('Invalid')) {
          console.warn(`Supabase not configured. Using mock data for table: ${table}`);
          return [];
        }
        throw error;
      }
      return data || [];
    } catch (error: any) {
      // Handle network or configuration errors gracefully
      if (error.message?.includes('fetch') || error.message?.includes('network')) {
        console.warn(`Network error fetching from ${table}. Using fallback data.`);
        return [];
      }
      throw error;
    }
  }, [table, supabase]);

  // Fetch data with cache fallback
  const fetchData = useCallback(async (useCache: boolean = true): Promise<void> => {
    setState(prev => ({ ...prev, isLoading: true, error: null }));

    try {
      let data: T[] = [];
      let fromCache = false;

      // Try cache first if enabled and requested
      if (cacheEnabled && useCache) {
        const cachedData = await indexedDBCache.getAll(table as any);
        if (cachedData.length > 0) {
          data = cachedData;
          fromCache = true;
          setState(prev => ({
            ...prev,
            cacheStats: {
              ...prev.cacheStats,
              cacheHits: prev.cacheStats.cacheHits + 1,
              totalRequests: prev.cacheStats.totalRequests + 1
            }
          }));
        }
      }

      // Fetch from Supabase if no cache data or cache disabled
      if (!fromCache) {
        data = await fetchFromSupabase();
        
        // Cache the data if caching is enabled
        if (cacheEnabled && data.length > 0) {
          const cacheItems = data.map(item => ({
            id: (item as any).id || crypto.randomUUID(),
            data: item
          }));
          await indexedDBCache.setBatch(table as any, cacheItems);
        }

        setState(prev => ({
          ...prev,
          cacheStats: {
            ...prev.cacheStats,
            cacheMisses: prev.cacheStats.cacheMisses + 1,
            totalRequests: prev.cacheStats.totalRequests + 1
          }
        }));
      }

      // Merge with optimistic updates
      const optimisticData = Array.from(optimisticUpdatesRef.current.values());
      const mergedData = [...optimisticData, ...data];

      setState(prev => ({
        ...prev,
        data: mergedData,
        isLoading: false,
        lastUpdated: new Date(),
        error: null
      }));

      retryCountRef.current = 0; // Reset retry count on success

    } catch (error) {
      console.warn(`Unable to fetch ${table} data. Using fallback strategy.`, error);

      // Try to load from cache as fallback
      if (cacheEnabled && !useCache) {
        try {
          const cachedData = await indexedDBCache.getAll(table as any);
          if (cachedData.length > 0) {
            setState(prev => ({
              ...prev,
              data: cachedData,
              isLoading: false,
              error: 'Using cached data (offline mode)',
              lastUpdated: new Date()
            }));
            toast.warning(`${table} data loaded from cache (offline mode)`);
            return;
          }
        } catch (cacheError) {
          console.error('Cache fallback failed:', cacheError);
        }
      }

      // Retry logic
      if (retryCountRef.current < errorRetryCount) {
        retryCountRef.current++;
        const delay = errorRetryDelay * Math.pow(2, retryCountRef.current - 1); // Exponential backoff
        
        retryTimeoutRef.current = setTimeout(() => {
          fetchData(false); // Don't use cache on retry
        }, delay);

        setState(prev => ({
          ...prev,
          isLoading: false,
          error: `Retrying... (${retryCountRef.current}/${errorRetryCount})`
        }));
      } else {
        setState(prev => ({
          ...prev,
          isLoading: false,
          error: error instanceof Error ? error.message : 'Failed to fetch data'
        }));
      }
    }
  }, [table, cacheEnabled, fetchFromSupabase, errorRetryCount, errorRetryDelay]);

  // Handle real-time updates
  const handleRealtimeUpdate = useCallback(async (payload: any) => {
    const { eventType, new: newRecord, old: oldRecord } = payload;

    setState(prev => {
      let newData = [...prev.data];

      switch (eventType) {
        case 'INSERT':
          if (newRecord) {
            newData.unshift(newRecord);
            // Cache the new record
            if (cacheEnabled) {
              indexedDBCache.set(table as any, newRecord.id, newRecord);
            }
          }
          break;

        case 'UPDATE':
          if (newRecord) {
            const index = newData.findIndex((item: any) => item.id === newRecord.id);
            if (index !== -1) {
              newData[index] = newRecord;
            } else {
              newData.unshift(newRecord);
            }
            // Update cache
            if (cacheEnabled) {
              indexedDBCache.set(table as any, newRecord.id, newRecord);
            }
          }
          break;

        case 'DELETE':
          if (oldRecord) {
            newData = newData.filter((item: any) => item.id !== oldRecord.id);
            // Remove from cache
            if (cacheEnabled) {
              indexedDBCache.delete(table as any, oldRecord.id);
            }
          }
          break;
      }

      return {
        ...prev,
        data: newData,
        lastUpdated: new Date()
      };
    });
  }, [table, cacheEnabled]);

  // Setup real-time subscription
  useEffect(() => {
    const setupSubscription = async () => {
      try {
        subscriptionRef.current = await realtimeManager.subscribe({
          table,
          event: '*',
          onData: handleRealtimeUpdate,
          onConnect: () => {
            setState(prev => ({ ...prev, isConnected: true }));
            console.log(`Connected to ${table} real-time updates`);
          },
          onDisconnect: () => {
            setState(prev => ({ ...prev, isConnected: false }));
            console.log(`Disconnected from ${table} real-time updates`);
          },
          onError: (error) => {
            setState(prev => ({ ...prev, error: error.message }));
            console.error(`Real-time error for ${table}:`, error);
          }
        });
      } catch (error) {
        console.error(`Failed to setup real-time subscription for ${table}:`, error);
        setState(prev => ({ 
          ...prev, 
          error: 'Failed to setup real-time connection' 
        }));
      }
    };

    setupSubscription();

    return () => {
      if (subscriptionRef.current) {
        realtimeManager.unsubscribe(subscriptionRef.current);
      }
      if (retryTimeoutRef.current) {
        clearTimeout(retryTimeoutRef.current);
      }
    };
  }, [table, handleRealtimeUpdate]);

  // Initial data fetch
  useEffect(() => {
    if (initialFetch) {
      fetchData();
    }
  }, [initialFetch, fetchData]);

  // Optimistic update functions
  const addOptimisticUpdate = useCallback((item: T) => {
    if (!optimisticUpdates) return;

    const id = (item as any).id || crypto.randomUUID();
    optimisticUpdatesRef.current.set(id, { ...item, id } as T);

    setState(prev => ({
      ...prev,
      data: [{ ...item, id } as T, ...prev.data]
    }));
  }, [optimisticUpdates]);

  const removeOptimisticUpdate = useCallback((id: string) => {
    if (!optimisticUpdates) return;

    optimisticUpdatesRef.current.delete(id);

    setState(prev => ({
      ...prev,
      data: prev.data.filter((item: any) => item.id !== id)
    }));
  }, [optimisticUpdates]);

  const updateOptimisticUpdate = useCallback((id: string, updates: Partial<T>) => {
    if (!optimisticUpdates) return;

    const existing = optimisticUpdatesRef.current.get(id);
    if (existing) {
      const updated = { ...existing, ...updates };
      optimisticUpdatesRef.current.set(id, updated);

      setState(prev => ({
        ...prev,
        data: prev.data.map((item: any) => 
          item.id === id ? updated : item
        )
      }));
    }
  }, [optimisticUpdates]);

  // Manual refetch
  const refetch = useCallback(async () => {
    await fetchData(false); // Don't use cache on manual refetch
  }, [fetchData]);

  // Clear cache
  const clearCache = useCallback(async () => {
    if (cacheEnabled) {
      await indexedDBCache.clear(table as any);
      setState(prev => ({
        ...prev,
        cacheStats: {
          cacheHits: 0,
          cacheMisses: 0,
          totalRequests: 0
        }
      }));
      toast.success(`${table} cache cleared`);
    }
  }, [table, cacheEnabled]);

  return {
    ...state,
    refetch,
    clearCache,
    addOptimisticUpdate,
    removeOptimisticUpdate,
    updateOptimisticUpdate
  };
}
