import * as vscode from 'vscode';
import { EventEmitter } from 'events';
import { PerformanceMonitor, MemorySnapshot } from './PerformanceMonitor';

/**
 * Resource types
 */
export enum ResourceType {
  FILE_WATCHER = 'file_watcher',
  EVENT_LISTENER = 'event_listener',
  TIMER = 'timer',
  CACHE = 'cache',
  SESSION = 'session',
  WEBVIEW = 'webview',
}

/**
 * Resource entry
 */
export interface ResourceEntry {
  id: string;
  type: ResourceType;
  name: string;
  createdAt: Date;
  lastAccessedAt: Date;
  size?: number;
  metadata?: Record<string, any>;
}

/**
 * Memory leak detection result
 */
export interface MemoryLeakDetection {
  detected: boolean;
  severity: 'low' | 'medium' | 'high';
  leakRate: number; // MB per minute
  suspectedResources: ResourceEntry[];
  recommendations: string[];
}

/**
 * Cleanup result
 */
export interface CleanupResult {
  resourcesFreed: number;
  memoryFreed: number;
  errors: string[];
}

/**
 * Cache entry
 */
interface CacheEntry<T> {
  key: string;
  value: T;
  size: number;
  createdAt: Date;
  lastAccessedAt: Date;
  accessCount: number;
}

/**
 * ResourceManager class
 * Implements cleanup for completed sessions, memory leak detection,
 * and optimizes file watching and caching
 */
export class ResourceManager extends EventEmitter {
  private resources: Map<string, ResourceEntry> = new Map();
  private disposables: vscode.Disposable[] = [];
  private fileWatchers: Map<string, vscode.FileSystemWatcher> = new Map();
  private timers: Map<string, NodeJS.Timeout> = new Map();
  private cache: Map<string, CacheEntry<any>> = new Map();
  
  private performanceMonitor?: PerformanceMonitor;
  private memoryCheckInterval?: NodeJS.Timeout;
  private cacheCleanupInterval?: NodeJS.Timeout;
  
  private readonly MAX_CACHE_SIZE_MB = 50;
  private readonly MAX_CACHE_ENTRIES = 1000;
  private readonly CACHE_TTL_MS = 300000; // 5 minutes
  private readonly MEMORY_CHECK_INTERVAL = 30000; // 30 seconds
  private readonly CACHE_CLEANUP_INTERVAL = 60000; // 1 minute
  
  private memoryHistory: MemorySnapshot[] = [];
  private readonly MEMORY_HISTORY_SIZE = 20;

  constructor(performanceMonitor?: PerformanceMonitor) {
    super();
    this.performanceMonitor = performanceMonitor;
    this.startMemoryMonitoring();
    this.startCacheCleanup();
  }

  /**
   * Registers a resource for tracking
   */
  registerResource(
    id: string,
    type: ResourceType,
    name: string,
    metadata?: Record<string, any>
  ): void {
    const resource: ResourceEntry = {
      id,
      type,
      name,
      createdAt: new Date(),
      lastAccessedAt: new Date(),
      metadata,
    };

    this.resources.set(id, resource);
    this.emit('resource:registered', resource);
  }

  /**
   * Unregisters a resource
   */
  unregisterResource(id: string): void {
    const resource = this.resources.get(id);
    
    if (resource) {
      this.resources.delete(id);
      this.emit('resource:unregistered', resource);
    }
  }

  /**
   * Updates resource access time
   */
  touchResource(id: string): void {
    const resource = this.resources.get(id);
    
    if (resource) {
      resource.lastAccessedAt = new Date();
    }
  }

  /**
   * Registers a disposable resource
   */
  registerDisposable(disposable: vscode.Disposable, name: string): void {
    this.disposables.push(disposable);
    this.registerResource(
      `disposable-${this.disposables.length}`,
      ResourceType.EVENT_LISTENER,
      name
    );
  }

  /**
   * Creates and registers a file watcher
   */
  createFileWatcher(
    pattern: string,
    name: string,
    options?: { ignoreCreateEvents?: boolean; ignoreChangeEvents?: boolean; ignoreDeleteEvents?: boolean }
  ): vscode.FileSystemWatcher {
    const id = `watcher-${pattern}`;
    
    // Check if watcher already exists
    if (this.fileWatchers.has(id)) {
      this.touchResource(id);
      return this.fileWatchers.get(id)!;
    }

    // Create new watcher
    const watcher = vscode.workspace.createFileSystemWatcher(pattern, 
      options?.ignoreCreateEvents,
      options?.ignoreChangeEvents,
      options?.ignoreDeleteEvents
    );

    this.fileWatchers.set(id, watcher);
    this.registerResource(id, ResourceType.FILE_WATCHER, name, { pattern });
    this.registerDisposable(watcher, `FileWatcher: ${name}`);

    return watcher;
  }

  /**
   * Disposes a file watcher
   */
  disposeFileWatcher(pattern: string): void {
    const id = `watcher-${pattern}`;
    const watcher = this.fileWatchers.get(id);
    
    if (watcher) {
      watcher.dispose();
      this.fileWatchers.delete(id);
      this.unregisterResource(id);
    }
  }

  /**
   * Creates and registers a timer
   */
  createTimer(
    name: string,
    callback: () => void,
    interval: number,
    immediate: boolean = false
  ): string {
    const id = `timer-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    const timer = setInterval(callback, interval);
    this.timers.set(id, timer);
    this.registerResource(id, ResourceType.TIMER, name, { interval });

    if (immediate) {
      callback();
    }

    return id;
  }

  /**
   * Clears a timer
   */
  clearTimer(id: string): void {
    const timer = this.timers.get(id);
    
    if (timer) {
      clearInterval(timer);
      this.timers.delete(id);
      this.unregisterResource(id);
    }
  }

  /**
   * Adds an item to cache
   */
  cacheSet<T>(key: string, value: T, size?: number): void {
    const estimatedSize = size || this.estimateSize(value);
    
    const entry: CacheEntry<T> = {
      key,
      value,
      size: estimatedSize,
      createdAt: new Date(),
      lastAccessedAt: new Date(),
      accessCount: 0,
    };

    this.cache.set(key, entry);
    
    // Register as resource
    this.registerResource(`cache-${key}`, ResourceType.CACHE, key, { size: estimatedSize });

    // Check cache limits
    this.enforceCacheLimits();

    this.emit('cache:set', key, estimatedSize);
  }

  /**
   * Gets an item from cache
   */
  cacheGet<T>(key: string): T | undefined {
    const entry = this.cache.get(key) as CacheEntry<T> | undefined;
    
    if (!entry) {
      return undefined;
    }

    // Update access time and count
    entry.lastAccessedAt = new Date();
    entry.accessCount++;
    this.touchResource(`cache-${key}`);

    // Check if entry is expired
    const age = Date.now() - entry.createdAt.getTime();
    if (age > this.CACHE_TTL_MS) {
      this.cacheDelete(key);
      return undefined;
    }

    return entry.value;
  }

  /**
   * Deletes an item from cache
   */
  cacheDelete(key: string): void {
    const entry = this.cache.get(key);
    
    if (entry) {
      this.cache.delete(key);
      this.unregisterResource(`cache-${key}`);
      this.emit('cache:delete', key, entry.size);
    }
  }

  /**
   * Clears the entire cache
   */
  cacheClear(): void {
    const size = this.getCacheSize();
    const count = this.cache.size;
    
    this.cache.forEach((_, key) => {
      this.unregisterResource(`cache-${key}`);
    });
    
    this.cache.clear();
    this.emit('cache:cleared', count, size);
  }

  /**
   * Gets cache statistics
   */
  getCacheStats(): {
    entries: number;
    sizeMB: number;
    hitRate: number;
    oldestEntry: Date | null;
    newestEntry: Date | null;
  } {
    const entries = Array.from(this.cache.values());
    const totalSize = entries.reduce((sum, e) => sum + e.size, 0);
    const totalAccesses = entries.reduce((sum, e) => sum + e.accessCount, 0);
    
    return {
      entries: entries.length,
      sizeMB: totalSize / 1024 / 1024,
      hitRate: entries.length > 0 ? totalAccesses / entries.length : 0,
      oldestEntry: entries.length > 0 
        ? new Date(Math.min(...entries.map(e => e.createdAt.getTime())))
        : null,
      newestEntry: entries.length > 0
        ? new Date(Math.max(...entries.map(e => e.createdAt.getTime())))
        : null,
    };
  }

  /**
   * Estimates the size of an object in bytes
   */
  private estimateSize(obj: any): number {
    const seen = new WeakSet();
    
    const sizeOf = (obj: any): number => {
      if (obj === null || obj === undefined) {
        return 0;
      }

      if (typeof obj === 'boolean') {
        return 4;
      }

      if (typeof obj === 'number') {
        return 8;
      }

      if (typeof obj === 'string') {
        return obj.length * 2;
      }

      if (typeof obj === 'object') {
        if (seen.has(obj)) {
          return 0;
        }
        seen.add(obj);

        let size = 0;
        
        if (Array.isArray(obj)) {
          size = obj.reduce((acc, item) => acc + sizeOf(item), 0);
        } else {
          for (const key in obj) {
            if (obj.hasOwnProperty(key)) {
              size += key.length * 2 + sizeOf(obj[key]);
            }
          }
        }
        
        return size;
      }

      return 0;
    };

    return sizeOf(obj);
  }

  /**
   * Gets total cache size in bytes
   */
  private getCacheSize(): number {
    return Array.from(this.cache.values()).reduce((sum, entry) => sum + entry.size, 0);
  }

  /**
   * Enforces cache size and entry limits
   */
  private enforceCacheLimits(): void {
    const totalSize = this.getCacheSize();
    const maxSizeBytes = this.MAX_CACHE_SIZE_MB * 1024 * 1024;

    // Check size limit
    if (totalSize > maxSizeBytes || this.cache.size > this.MAX_CACHE_ENTRIES) {
      this.evictCacheEntries();
    }
  }

  /**
   * Evicts cache entries using LRU strategy
   */
  private evictCacheEntries(): void {
    const entries = Array.from(this.cache.entries())
      .map(([key, entry]) => ({ key, entry }))
      .sort((a, b) => a.entry.lastAccessedAt.getTime() - b.entry.lastAccessedAt.getTime());

    const targetSize = (this.MAX_CACHE_SIZE_MB * 0.8) * 1024 * 1024;
    const targetEntries = Math.floor(this.MAX_CACHE_ENTRIES * 0.8);

    let currentSize = this.getCacheSize();
    let evicted = 0;

    for (const { key, entry } of entries) {
      if (currentSize <= targetSize && this.cache.size <= targetEntries) {
        break;
      }

      this.cacheDelete(key);
      currentSize -= entry.size;
      evicted++;
    }

    if (evicted > 0) {
      this.emit('cache:evicted', evicted);
    }
  }

  /**
   * Starts periodic cache cleanup
   */
  private startCacheCleanup(): void {
    this.cacheCleanupInterval = setInterval(() => {
      this.cleanupExpiredCache();
    }, this.CACHE_CLEANUP_INTERVAL);
  }

  /**
   * Cleans up expired cache entries
   */
  private cleanupExpiredCache(): void {
    const now = Date.now();
    const expiredKeys: string[] = [];

    this.cache.forEach((entry, key) => {
      const age = now - entry.createdAt.getTime();
      if (age > this.CACHE_TTL_MS) {
        expiredKeys.push(key);
      }
    });

    expiredKeys.forEach(key => this.cacheDelete(key));

    if (expiredKeys.length > 0) {
      this.emit('cache:expired', expiredKeys.length);
    }
  }

  /**
   * Starts memory monitoring for leak detection
   */
  private startMemoryMonitoring(): void {
    this.memoryCheckInterval = setInterval(() => {
      this.checkMemoryUsage();
    }, this.MEMORY_CHECK_INTERVAL);
  }

  /**
   * Checks current memory usage
   */
  private checkMemoryUsage(): void {
    if (!this.performanceMonitor) {
      return;
    }

    const snapshot = this.performanceMonitor.getCurrentMemoryUsage();
    this.memoryHistory.push(snapshot);

    // Keep only recent history
    if (this.memoryHistory.length > this.MEMORY_HISTORY_SIZE) {
      this.memoryHistory.shift();
    }

    // Detect memory leaks
    const leakDetection = this.detectMemoryLeaks();
    
    if (leakDetection.detected) {
      this.emit('memory:leak', leakDetection);
    }
  }

  /**
   * Detects memory leaks based on memory history
   */
  detectMemoryLeaks(): MemoryLeakDetection {
    if (this.memoryHistory.length < 5) {
      return {
        detected: false,
        severity: 'low',
        leakRate: 0,
        suspectedResources: [],
        recommendations: [],
      };
    }

    // Calculate memory growth rate
    const first = this.memoryHistory[0];
    const last = this.memoryHistory[this.memoryHistory.length - 1];
    const timeDiff = (last.timestamp.getTime() - first.timestamp.getTime()) / 1000 / 60; // minutes
    const memoryDiff = (last.heapUsed - first.heapUsed) / 1024 / 1024; // MB
    const leakRate = memoryDiff / timeDiff;

    // Check if there's consistent growth
    let growthCount = 0;
    for (let i = 1; i < this.memoryHistory.length; i++) {
      if (this.memoryHistory[i].heapUsed > this.memoryHistory[i - 1].heapUsed) {
        growthCount++;
      }
    }

    const growthRatio = growthCount / (this.memoryHistory.length - 1);
    const detected = leakRate > 1 && growthRatio > 0.7; // Growing > 1MB/min and 70% of samples show growth

    let severity: 'low' | 'medium' | 'high' = 'low';
    if (leakRate > 5) {
      severity = 'high';
    } else if (leakRate > 2) {
      severity = 'medium';
    }

    // Find suspected resources
    const suspectedResources = this.findSuspectedLeakResources();

    // Generate recommendations
    const recommendations: string[] = [];
    
    if (detected) {
      recommendations.push('Memory usage is growing consistently. Consider the following:');
      
      if (this.cache.size > this.MAX_CACHE_ENTRIES * 0.8) {
        recommendations.push('- Cache is near capacity. Consider clearing old entries.');
      }
      
      if (this.fileWatchers.size > 10) {
        recommendations.push('- Many file watchers are active. Consider consolidating patterns.');
      }
      
      if (this.timers.size > 20) {
        recommendations.push('- Many timers are active. Review and clear unused timers.');
      }
      
      recommendations.push('- Run cleanup for completed sessions.');
      recommendations.push('- Check for event listeners that are not being removed.');
    }

    return {
      detected,
      severity,
      leakRate,
      suspectedResources,
      recommendations,
    };
  }

  /**
   * Finds resources that might be causing memory leaks
   */
  private findSuspectedLeakResources(): ResourceEntry[] {
    const now = Date.now();
    const suspected: ResourceEntry[] = [];

    this.resources.forEach(resource => {
      const age = now - resource.createdAt.getTime();
      const timeSinceAccess = now - resource.lastAccessedAt.getTime();

      // Resources that are old and haven't been accessed recently
      if (age > 600000 && timeSinceAccess > 300000) { // 10 min old, 5 min since access
        suspected.push(resource);
      }
    });

    return suspected.sort((a, b) => 
      a.createdAt.getTime() - b.createdAt.getTime()
    ).slice(0, 10); // Return top 10
  }

  /**
   * Cleans up resources for a completed session
   */
  async cleanupSession(sessionId: string): Promise<CleanupResult> {
    const result: CleanupResult = {
      resourcesFreed: 0,
      memoryFreed: 0,
      errors: [],
    };

    const memoryBefore = this.performanceMonitor?.getCurrentMemoryUsage();

    // Find session-related resources
    const sessionResources = Array.from(this.resources.values())
      .filter(r => r.metadata?.sessionId === sessionId);

    for (const resource of sessionResources) {
      try {
        await this.cleanupResource(resource);
        result.resourcesFreed++;
      } catch (error) {
        result.errors.push(`Failed to cleanup ${resource.name}: ${error}`);
      }
    }

    // Clear session-related cache entries
    const cacheKeys = Array.from(this.cache.keys())
      .filter(key => key.includes(sessionId));
    
    cacheKeys.forEach(key => this.cacheDelete(key));

    // Force garbage collection if available
    if (global.gc) {
      global.gc();
    }

    const memoryAfter = this.performanceMonitor?.getCurrentMemoryUsage();
    
    if (memoryBefore && memoryAfter) {
      result.memoryFreed = (memoryBefore.heapUsed - memoryAfter.heapUsed) / 1024 / 1024;
    }

    this.emit('session:cleaned', sessionId, result);
    return result;
  }

  /**
   * Cleans up a specific resource
   */
  private async cleanupResource(resource: ResourceEntry): Promise<void> {
    switch (resource.type) {
      case ResourceType.FILE_WATCHER:
        if (resource.metadata?.pattern) {
          this.disposeFileWatcher(resource.metadata.pattern);
        }
        break;

      case ResourceType.TIMER:
        this.clearTimer(resource.id);
        break;

      case ResourceType.CACHE:
        this.cacheDelete(resource.name);
        break;

      default:
        this.unregisterResource(resource.id);
    }
  }

  /**
   * Performs aggressive cleanup
   */
  async performAggressiveCleanup(): Promise<CleanupResult> {
    const result: CleanupResult = {
      resourcesFreed: 0,
      memoryFreed: 0,
      errors: [],
    };

    const memoryBefore = this.performanceMonitor?.getCurrentMemoryUsage();

    // Clear all cache
    this.cacheClear();
    result.resourcesFreed += this.cache.size;

    // Find and cleanup stale resources
    const staleResources = this.findSuspectedLeakResources();
    
    for (const resource of staleResources) {
      try {
        await this.cleanupResource(resource);
        result.resourcesFreed++;
      } catch (error) {
        result.errors.push(`Failed to cleanup ${resource.name}: ${error}`);
      }
    }

    // Force garbage collection
    if (global.gc) {
      global.gc();
    }

    const memoryAfter = this.performanceMonitor?.getCurrentMemoryUsage();
    
    if (memoryBefore && memoryAfter) {
      result.memoryFreed = (memoryBefore.heapUsed - memoryAfter.heapUsed) / 1024 / 1024;
    }

    this.emit('cleanup:aggressive', result);
    return result;
  }

  /**
   * Gets all registered resources
   */
  getResources(): ResourceEntry[] {
    return Array.from(this.resources.values());
  }

  /**
   * Gets resources by type
   */
  getResourcesByType(type: ResourceType): ResourceEntry[] {
    return Array.from(this.resources.values()).filter(r => r.type === type);
  }

  /**
   * Gets resource statistics
   */
  getResourceStats(): Record<ResourceType, number> {
    const stats: Record<ResourceType, number> = {
      [ResourceType.FILE_WATCHER]: 0,
      [ResourceType.EVENT_LISTENER]: 0,
      [ResourceType.TIMER]: 0,
      [ResourceType.CACHE]: 0,
      [ResourceType.SESSION]: 0,
      [ResourceType.WEBVIEW]: 0,
    };

    this.resources.forEach(resource => {
      stats[resource.type]++;
    });

    return stats;
  }

  /**
   * Disposes of all resources
   */
  dispose(): void {
    // Stop monitoring
    if (this.memoryCheckInterval) {
      clearInterval(this.memoryCheckInterval);
    }
    
    if (this.cacheCleanupInterval) {
      clearInterval(this.cacheCleanupInterval);
    }

    // Dispose all file watchers
    this.fileWatchers.forEach(watcher => watcher.dispose());
    this.fileWatchers.clear();

    // Clear all timers
    this.timers.forEach(timer => clearInterval(timer));
    this.timers.clear();

    // Clear cache
    this.cacheClear();

    // Dispose all disposables
    this.disposables.forEach(d => d.dispose());
    this.disposables = [];

    // Clear resources
    this.resources.clear();

    // Remove all listeners
    this.removeAllListeners();
  }
}
