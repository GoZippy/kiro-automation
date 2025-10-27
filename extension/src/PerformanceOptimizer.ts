import { Task } from './models';

/**
 * Performance optimization utilities
 * Provides caching, memoization, and optimization strategies
 */
export class PerformanceOptimizer {
  private taskCache: Map<string, Task> = new Map();
  private memoizedResults: Map<string, any> = new Map();
  private readonly MAX_CACHE_SIZE = 1000;
  private readonly CACHE_TTL = 300000; // 5 minutes
  private cacheTimestamps: Map<string, number> = new Map();

  /**
   * Caches a task
   * @param task Task to cache
   */
  cacheTask(task: Task): void {
    // Implement LRU cache
    if (this.taskCache.size >= this.MAX_CACHE_SIZE) {
      const firstKey = this.taskCache.keys().next().value;
      if (firstKey) {
        this.taskCache.delete(firstKey);
        this.cacheTimestamps.delete(firstKey);
      }
    }

    this.taskCache.set(task.id, task);
    this.cacheTimestamps.set(task.id, Date.now());
  }

  /**
   * Gets a cached task
   * @param taskId Task ID
   * @returns Cached task or undefined
   */
  getCachedTask(taskId: string): Task | undefined {
    const timestamp = this.cacheTimestamps.get(taskId);
    
    // Check if cache is expired
    if (timestamp && Date.now() - timestamp > this.CACHE_TTL) {
      this.taskCache.delete(taskId);
      this.cacheTimestamps.delete(taskId);
      return undefined;
    }

    return this.taskCache.get(taskId);
  }

  /**
   * Memoizes a function result
   * @param key Cache key
   * @param fn Function to execute
   * @returns Memoized result
   */
  async memoize<T>(key: string, fn: () => Promise<T>): Promise<T> {
    const cached = this.memoizedResults.get(key);
    if (cached !== undefined) {
      return cached;
    }

    const result = await fn();
    this.memoizedResults.set(key, result);
    return result;
  }

  /**
   * Clears memoized results
   */
  clearMemoization(): void {
    this.memoizedResults.clear();
  }

  /**
   * Clears task cache
   */
  clearTaskCache(): void {
    this.taskCache.clear();
    this.cacheTimestamps.clear();
  }

  /**
   * Optimizes task array by removing duplicates
   * @param tasks Array of tasks
   * @returns Optimized array
   */
  deduplicateTasks(tasks: Task[]): Task[] {
    const seen = new Set<string>();
    return tasks.filter(task => {
      if (seen.has(task.id)) {
        return false;
      }
      seen.add(task.id);
      return true;
    });
  }

  /**
   * Batches async operations for better performance
   * @param items Items to process
   * @param batchSize Batch size
   * @param processor Processing function
   */
  async batchProcess<T, R>(
    items: T[],
    batchSize: number,
    processor: (batch: T[]) => Promise<R[]>
  ): Promise<R[]> {
    const results: R[] = [];
    
    for (let i = 0; i < items.length; i += batchSize) {
      const batch = items.slice(i, i + batchSize);
      const batchResults = await processor(batch);
      results.push(...batchResults);
    }

    return results;
  }

  /**
   * Debounces a function
   * @param fn Function to debounce
   * @param delay Delay in milliseconds
   * @returns Debounced function
   */
  debounce<T extends (...args: any[]) => any>(
    fn: T,
    delay: number
  ): (...args: Parameters<T>) => void {
    let timeoutId: NodeJS.Timeout | null = null;

    return (...args: Parameters<T>) => {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }

      timeoutId = setTimeout(() => {
        fn(...args);
        timeoutId = null;
      }, delay);
    };
  }

  /**
   * Throttles a function
   * @param fn Function to throttle
   * @param limit Time limit in milliseconds
   * @returns Throttled function
   */
  throttle<T extends (...args: any[]) => any>(
    fn: T,
    limit: number
  ): (...args: Parameters<T>) => void {
    let inThrottle = false;

    return (...args: Parameters<T>) => {
      if (!inThrottle) {
        fn(...args);
        inThrottle = true;
        setTimeout(() => {
          inThrottle = false;
        }, limit);
      }
    };
  }

  /**
   * Gets cache statistics
   */
  getCacheStats(): {
    taskCacheSize: number;
    memoizedResultsSize: number;
    cacheHitRate: number;
  } {
    return {
      taskCacheSize: this.taskCache.size,
      memoizedResultsSize: this.memoizedResults.size,
      cacheHitRate: 0, // Would need to track hits/misses
    };
  }

  /**
   * Disposes of resources
   */
  dispose(): void {
    this.clearTaskCache();
    this.clearMemoization();
  }
}
