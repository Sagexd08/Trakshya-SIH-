import { useCallback, useEffect, useRef, useState } from 'react';
import type { PredictionRequest, PredictionResult, TrainData } from './pathPrediction.worker';

// Worker pool for managing multiple worker instances
class WorkerPool {
  private workers: Worker[] = [];
  private availableWorkers: Worker[] = [];
  private taskQueue: Array<{
    request: PredictionRequest;
    resolve: (result: PredictionResult[]) => void;
    reject: (error: Error) => void;
  }> = [];
  private maxWorkers: number;
  private workerScript: string;

  constructor(workerScript: string, maxWorkers: number = navigator.hardwareConcurrency || 4) {
    this.workerScript = workerScript;
    this.maxWorkers = Math.min(maxWorkers, 8); // Cap at 8 workers
    this.initializeWorkers();
  }

  private initializeWorkers() {
    for (let i = 0; i < this.maxWorkers; i++) {
      this.createWorker();
    }
  }

  private createWorker(): Worker {
    const worker = new Worker(new URL('./pathPrediction.worker.ts', import.meta.url));
    
    worker.onmessage = (e) => {
      this.handleWorkerMessage(worker, e.data);
    };

    worker.onerror = (error) => {
      console.error('Worker error:', error);
      this.handleWorkerError(worker, new Error('Worker execution error'));
    };

    this.workers.push(worker);
    this.availableWorkers.push(worker);
    
    return worker;
  }

  private handleWorkerMessage(worker: Worker, data: PredictionResult[] | { error: string }) {
    // Find and resolve the corresponding task
    const taskIndex = this.taskQueue.findIndex(task => {
      // Simple matching - in a real implementation, you'd want better task tracking
      return true;
    });

    if (taskIndex !== -1) {
      const task = this.taskQueue.splice(taskIndex, 1)[0];
      
      if ('error' in data) {
        task.reject(new Error(data.error));
      } else {
        task.resolve(data);
      }
    }

    // Return worker to available pool
    this.availableWorkers.push(worker);
    
    // Process next task if any
    this.processNextTask();
  }

  private handleWorkerError(worker: Worker, error: Error) {
    // Find and reject the corresponding task
    const taskIndex = this.taskQueue.findIndex(task => true);
    
    if (taskIndex !== -1) {
      const task = this.taskQueue.splice(taskIndex, 1)[0];
      task.reject(error);
    }

    // Remove failed worker and create a new one
    const workerIndex = this.workers.indexOf(worker);
    if (workerIndex !== -1) {
      this.workers.splice(workerIndex, 1);
      worker.terminate();
      this.createWorker();
    }

    // Return to available pool (new worker)
    this.processNextTask();
  }

  private processNextTask() {
    if (this.taskQueue.length === 0 || this.availableWorkers.length === 0) {
      return;
    }

    const worker = this.availableWorkers.pop()!;
    const task = this.taskQueue.shift()!;

    worker.postMessage(task.request);
  }

  execute(request: PredictionRequest): Promise<PredictionResult[]> {
    return new Promise((resolve, reject) => {
      this.taskQueue.push({ request, resolve, reject });
      this.processNextTask();
    });
  }

  terminate() {
    this.workers.forEach(worker => worker.terminate());
    this.workers = [];
    this.availableWorkers = [];
    this.taskQueue = [];
  }

  getStats() {
    return {
      totalWorkers: this.workers.length,
      availableWorkers: this.availableWorkers.length,
      queuedTasks: this.taskQueue.length,
    };
  }
}

// Singleton worker pool instance
let workerPool: WorkerPool | null = null;

function getWorkerPool(): WorkerPool {
  if (!workerPool && typeof window !== 'undefined') {
    workerPool = new WorkerPool('./pathPrediction.worker.ts');
  }
  return workerPool!;
}

// React hook for using workers
export function useWorkerPool() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const execute = useCallback(async (request: PredictionRequest): Promise<PredictionResult[]> => {
    if (typeof window === 'undefined') {
      throw new Error('Workers are not available on the server');
    }

    // Cancel previous request if still running
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    abortControllerRef.current = new AbortController();
    setIsLoading(true);
    setError(null);

    try {
      const pool = getWorkerPool();
      const result = await pool.execute(request);
      
      if (abortControllerRef.current.signal.aborted) {
        throw new Error('Request was cancelled');
      }

      return result;
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Unknown worker error');
      setError(error);
      throw error;
    } finally {
      setIsLoading(false);
      abortControllerRef.current = null;
    }
  }, []);

  const cancel = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
  }, []);

  const getStats = useCallback(() => {
    if (typeof window === 'undefined') return null;
    return getWorkerPool().getStats();
  }, []);

  useEffect(() => {
    return () => {
      cancel();
    };
  }, [cancel]);

  return {
    execute,
    cancel,
    isLoading,
    error,
    getStats,
  };
}

// Specialized hooks for different types of predictions
export function usePathPrediction() {
  const { execute, isLoading, error } = useWorkerPool();

  const predictPaths = useCallback(async (
    trains: TrainData[],
    timeHorizon: number = 60,
    options?: PredictionRequest['options']
  ) => {
    const request: PredictionRequest = {
      type: 'PREDICT_PATH',
      trains,
      timeHorizon,
      options,
    };

    return execute(request);
  }, [execute]);

  return {
    predictPaths,
    isLoading,
    error,
  };
}

export function useConflictAnalysis() {
  const { execute, isLoading, error } = useWorkerPool();

  const analyzeConflicts = useCallback(async (
    trains: TrainData[],
    timeHorizon: number = 120,
    options?: PredictionRequest['options']
  ) => {
    const request: PredictionRequest = {
      type: 'CALCULATE_CONFLICTS',
      trains,
      timeHorizon,
      options,
    };

    return execute(request);
  }, [execute]);

  return {
    analyzeConflicts,
    isLoading,
    error,
  };
}

export function useRouteOptimization() {
  const { execute, isLoading, error } = useWorkerPool();

  const optimizeRoutes = useCallback(async (
    trains: TrainData[],
    timeHorizon: number = 180,
    options?: PredictionRequest['options']
  ) => {
    const request: PredictionRequest = {
      type: 'OPTIMIZE_ROUTES',
      trains,
      timeHorizon,
      options,
    };

    return execute(request);
  }, [execute]);

  return {
    optimizeRoutes,
    isLoading,
    error,
  };
}

// Performance monitoring for workers
export function useWorkerPerformance() {
  const [metrics, setMetrics] = useState<{
    averageExecutionTime: number;
    totalTasks: number;
    successRate: number;
    errorCount: number;
  }>({
    averageExecutionTime: 0,
    totalTasks: 0,
    successRate: 100,
    errorCount: 0,
  });

  const executionTimes = useRef<number[]>([]);
  const totalTasks = useRef(0);
  const errorCount = useRef(0);

  const recordExecution = useCallback((executionTime: number, success: boolean) => {
    totalTasks.current++;
    
    if (success) {
      executionTimes.current.push(executionTime);
      // Keep only last 100 measurements
      if (executionTimes.current.length > 100) {
        executionTimes.current.shift();
      }
    } else {
      errorCount.current++;
    }

    const averageExecutionTime = executionTimes.current.length > 0
      ? executionTimes.current.reduce((sum, time) => sum + time, 0) / executionTimes.current.length
      : 0;

    const successRate = totalTasks.current > 0
      ? ((totalTasks.current - errorCount.current) / totalTasks.current) * 100
      : 100;

    setMetrics({
      averageExecutionTime,
      totalTasks: totalTasks.current,
      successRate,
      errorCount: errorCount.current,
    });
  }, []);

  const reset = useCallback(() => {
    executionTimes.current = [];
    totalTasks.current = 0;
    errorCount.current = 0;
    setMetrics({
      averageExecutionTime: 0,
      totalTasks: 0,
      successRate: 100,
      errorCount: 0,
    });
  }, []);

  return {
    metrics,
    recordExecution,
    reset,
  };
}

// Cleanup function for when the app unmounts
export function cleanupWorkers() {
  if (workerPool) {
    workerPool.terminate();
    workerPool = null;
  }
}

// Initialize workers on app start
export function initializeWorkers() {
  if (typeof window !== 'undefined' && !workerPool) {
    getWorkerPool();
    console.log('🔧 Worker pool initialized');
  }
}
