import * as vscode from 'vscode';
import { EventEmitter } from 'events';

/**
 * Performance metric types
 */
export enum MetricType {
  MEMORY = 'memory',
  CPU = 'cpu',
  TASK_EXECUTION = 'task_execution',
  FILE_OPERATION = 'file_operation',
  API_CALL = 'api_call',
}

/**
 * Memory usage snapshot
 */
export interface MemorySnapshot {
  timestamp: Date;
  heapUsed: number;
  heapTotal: number;
  external: number;
  rss: number;
  arrayBuffers: number;
}

/**
 * CPU usage snapshot
 */
export interface CPUSnapshot {
  timestamp: Date;
  user: number;
  system: number;
  percent: number;
}

/**
 * Task execution metric
 */
export interface TaskExecutionMetric {
  taskId: string;
  taskTitle: string;
  startTime: Date;
  endTime?: Date;
  duration?: number;
  memoryBefore: MemorySnapshot;
  memoryAfter?: MemorySnapshot;
  memoryDelta?: number;
  success: boolean;
  error?: string;
}

/**
 * Performance threshold configuration
 */
export interface PerformanceThresholds {
  /** Maximum memory usage in MB */
  maxMemoryMB: number;
  
  /** Maximum CPU usage percentage */
  maxCPUPercent: number;
  
  /** Maximum task execution time in ms */
  maxTaskDurationMs: number;
  
  /** Memory leak detection threshold in MB */
  memoryLeakThresholdMB: number;
}

/**
 * Performance alert
 */
export interface PerformanceAlert {
  type: 'memory' | 'cpu' | 'duration' | 'leak';
  severity: 'warning' | 'critical';
  message: string;
  timestamp: Date;
  metric: any;
}

/**
 * Performance statistics
 */
export interface PerformanceStatistics {
  totalTasks: number;
  averageTaskDuration: number;
  minTaskDuration: number;
  maxTaskDuration: number;
  averageMemoryUsage: number;
  peakMemoryUsage: number;
  averageCPUUsage: number;
  peakCPUUsage: number;
  totalMemoryAllocated: number;
  totalMemoryFreed: number;
  suspectedMemoryLeaks: number;
  /** Backwards-compatible aliases expected by some tests */
  memoryUsage?: number;
  cpuUsage?: number;
}

/**
 * PerformanceMonitor class
 * Tracks memory usage, CPU usage, and task execution time
 * Collects performance metrics for the automation engine
 */
export class PerformanceMonitor extends EventEmitter {
  private isMonitoring: boolean = false;
  private monitoringInterval?: NodeJS.Timeout;
  private cpuMonitoringInterval?: NodeJS.Timeout;
  
  private memorySnapshots: MemorySnapshot[] = [];
  private cpuSnapshots: CPUSnapshot[] = [];
  private taskMetrics: Map<string, TaskExecutionMetric> = new Map();
  private completedTaskMetrics: TaskExecutionMetric[] = [];
  
  private thresholds: PerformanceThresholds;
  private alerts: PerformanceAlert[] = [];
  
  private baselineMemory?: MemorySnapshot;
  private lastCPUUsage?: NodeJS.CpuUsage;
  private lastCPUTime?: number;
  
  private readonly MEMORY_SNAPSHOT_INTERVAL = 5000; // 5 seconds
  private readonly CPU_SNAPSHOT_INTERVAL = 2000; // 2 seconds
  private readonly MAX_SNAPSHOTS = 1000; // Keep last 1000 snapshots
  private readonly MAX_ALERTS = 100; // Keep last 100 alerts

  constructor(thresholds?: Partial<PerformanceThresholds>) {
    super();
    
    this.thresholds = {
      maxMemoryMB: 100,
      maxCPUPercent: 80,
      maxTaskDurationMs: 300000, // 5 minutes
      memoryLeakThresholdMB: 50,
      ...thresholds,
    };
  }

  /**
   * Starts performance monitoring
   */
  startMonitoring(): void {
    if (this.isMonitoring) {
      return;
    }

    this.isMonitoring = true;
    this.baselineMemory = this.captureMemorySnapshot();
    this.lastCPUUsage = process.cpuUsage();
    this.lastCPUTime = Date.now();

    // Start memory monitoring
    this.monitoringInterval = setInterval(() => {
      this.collectMemoryMetrics();
    }, this.MEMORY_SNAPSHOT_INTERVAL);

    // Start CPU monitoring
    this.cpuMonitoringInterval = setInterval(() => {
      this.collectCPUMetrics();
    }, this.CPU_SNAPSHOT_INTERVAL);

    this.emit('monitoring:started');
  }

  /**
   * Stops performance monitoring
   */
  stopMonitoring(): void {
    if (!this.isMonitoring) {
      return;
    }

    this.isMonitoring = false;

    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = undefined;
    }

    if (this.cpuMonitoringInterval) {
      clearInterval(this.cpuMonitoringInterval);
      this.cpuMonitoringInterval = undefined;
    }

    this.emit('monitoring:stopped');
  }

  /**
   * Captures a memory snapshot
   */
  private captureMemorySnapshot(): MemorySnapshot {
    const usage = process.memoryUsage();
    return {
      timestamp: new Date(),
      heapUsed: usage.heapUsed,
      heapTotal: usage.heapTotal,
      external: usage.external,
      rss: usage.rss,
      arrayBuffers: usage.arrayBuffers || 0,
    };
  }

  /**
   * Collects memory metrics
   */
  private collectMemoryMetrics(): void {
    const snapshot = this.captureMemorySnapshot();
    this.memorySnapshots.push(snapshot);

    // Trim old snapshots
    if (this.memorySnapshots.length > this.MAX_SNAPSHOTS) {
      this.memorySnapshots.shift();
    }

    // Check thresholds
    this.checkMemoryThresholds(snapshot);

    // Emit metric event
    this.emit('metric:memory', snapshot);
  }

  /**
   * Collects CPU metrics
   */
  private collectCPUMetrics(): void {
    if (!this.lastCPUUsage || !this.lastCPUTime) {
      this.lastCPUUsage = process.cpuUsage();
      this.lastCPUTime = Date.now();
      return;
    }

    const currentCPUUsage = process.cpuUsage(this.lastCPUUsage);
    const currentTime = Date.now();
    const elapsedTime = currentTime - this.lastCPUTime;

    // Calculate CPU percentage
    const totalCPUTime = (currentCPUUsage.user + currentCPUUsage.system) / 1000; // Convert to ms
    const cpuPercent = (totalCPUTime / elapsedTime) * 100;

    const snapshot: CPUSnapshot = {
      timestamp: new Date(),
      user: currentCPUUsage.user,
      system: currentCPUUsage.system,
      percent: Math.min(cpuPercent, 100), // Cap at 100%
    };

    this.cpuSnapshots.push(snapshot);

    // Trim old snapshots
    if (this.cpuSnapshots.length > this.MAX_SNAPSHOTS) {
      this.cpuSnapshots.shift();
    }

    // Check thresholds
    this.checkCPUThresholds(snapshot);

    // Emit metric event
    this.emit('metric:cpu', snapshot);

    // Update last values
    this.lastCPUUsage = process.cpuUsage();
    this.lastCPUTime = currentTime;
  }

  /**
   * Checks memory thresholds and creates alerts
   */
  private checkMemoryThresholds(snapshot: MemorySnapshot): void {
    const heapUsedMB = snapshot.heapUsed / 1024 / 1024;

    // Check max memory threshold
    if (heapUsedMB > this.thresholds.maxMemoryMB) {
      this.createAlert({
        type: 'memory',
        severity: heapUsedMB > this.thresholds.maxMemoryMB * 1.5 ? 'critical' : 'warning',
        message: `Memory usage (${heapUsedMB.toFixed(2)} MB) exceeds threshold (${this.thresholds.maxMemoryMB} MB)`,
        timestamp: new Date(),
        metric: snapshot,
      });
    }

    // Check for memory leaks
    if (this.baselineMemory) {
      const memoryDelta = (snapshot.heapUsed - this.baselineMemory.heapUsed) / 1024 / 1024;
      
      if (memoryDelta > this.thresholds.memoryLeakThresholdMB) {
        this.createAlert({
          type: 'leak',
          severity: 'warning',
          message: `Potential memory leak detected: ${memoryDelta.toFixed(2)} MB increase from baseline`,
          timestamp: new Date(),
          metric: { snapshot, baseline: this.baselineMemory, delta: memoryDelta },
        });
      }
    }
  }

  /**
   * Checks CPU thresholds and creates alerts
   */
  private checkCPUThresholds(snapshot: CPUSnapshot): void {
    if (snapshot.percent > this.thresholds.maxCPUPercent) {
      this.createAlert({
        type: 'cpu',
        severity: snapshot.percent > this.thresholds.maxCPUPercent * 1.5 ? 'critical' : 'warning',
        message: `CPU usage (${snapshot.percent.toFixed(2)}%) exceeds threshold (${this.thresholds.maxCPUPercent}%)`,
        timestamp: new Date(),
        metric: snapshot,
      });
    }
  }

  /**
   * Creates a performance alert
   */
  private createAlert(alert: PerformanceAlert): void {
    this.alerts.push(alert);

    // Trim old alerts
    if (this.alerts.length > this.MAX_ALERTS) {
      this.alerts.shift();
    }

    // Emit alert event
    this.emit('alert', alert);
  }

  /**
   * Starts tracking a task execution
   */
  startTaskTracking(taskId: string, taskTitle: string): void {
    const metric: TaskExecutionMetric = {
      taskId,
      taskTitle,
      startTime: new Date(),
      memoryBefore: this.captureMemorySnapshot(),
      success: false,
    };

    this.taskMetrics.set(taskId, metric);
    this.emit('task:started', metric);
  }

  /**
   * Ends tracking a task execution
   */
  endTaskTracking(taskId: string, success: boolean, error?: string): void {
    const metric = this.taskMetrics.get(taskId);
    
    if (!metric) {
      return;
    }

    metric.endTime = new Date();
    metric.duration = metric.endTime.getTime() - metric.startTime.getTime();
    metric.memoryAfter = this.captureMemorySnapshot();
    metric.memoryDelta = metric.memoryAfter.heapUsed - metric.memoryBefore.heapUsed;
    metric.success = success;
    metric.error = error;

    // Check duration threshold
    if (metric.duration > this.thresholds.maxTaskDurationMs) {
      this.createAlert({
        type: 'duration',
        severity: 'warning',
        message: `Task "${metric.taskTitle}" took ${(metric.duration / 1000).toFixed(2)}s, exceeding threshold of ${(this.thresholds.maxTaskDurationMs / 1000).toFixed(2)}s`,
        timestamp: new Date(),
        metric,
      });
    }

    // Move to completed metrics
    this.completedTaskMetrics.push(metric);
    this.taskMetrics.delete(taskId);

    this.emit('task:completed', metric);
  }

  /**
   * Gets current memory usage
   */
  getCurrentMemoryUsage(): MemorySnapshot {
    return this.captureMemorySnapshot();
  }

  /**
   * Gets current CPU usage
   */
  getCurrentCPUUsage(): CPUSnapshot | null {
    if (this.cpuSnapshots.length === 0) {
      return null;
    }
    return this.cpuSnapshots[this.cpuSnapshots.length - 1];
  }

  /**
   * Gets memory snapshots
   */
  getMemorySnapshots(): MemorySnapshot[] {
    return [...this.memorySnapshots];
  }

  /**
   * Gets CPU snapshots
   */
  getCPUSnapshots(): CPUSnapshot[] {
    return [...this.cpuSnapshots];
  }

  /**
   * Gets task metrics
   */
  getTaskMetrics(): TaskExecutionMetric[] {
    return [...this.completedTaskMetrics];
  }

  /**
   * Gets active task metrics
   */
  getActiveTaskMetrics(): TaskExecutionMetric[] {
    return Array.from(this.taskMetrics.values());
  }

  /**
   * Gets performance alerts
   */
  getAlerts(): PerformanceAlert[] {
    return [...this.alerts];
  }

  /**
   * Clears all alerts
   */
  clearAlerts(): void {
    this.alerts = [];
    this.emit('alerts:cleared');
  }

  /**
   * Gets performance statistics
   */
  getStatistics(): PerformanceStatistics {
    const taskDurations = this.completedTaskMetrics
      .filter(m => m.duration !== undefined)
      .map(m => m.duration!);

    const memoryUsages = this.memorySnapshots.map(s => s.heapUsed / 1024 / 1024);
    const cpuUsages = this.cpuSnapshots.map(s => s.percent);

    const memoryDeltas = this.completedTaskMetrics
      .filter(m => m.memoryDelta !== undefined)
      .map(m => m.memoryDelta!);

    return {
      totalTasks: this.completedTaskMetrics.length,
      averageTaskDuration: taskDurations.length > 0 
        ? taskDurations.reduce((a, b) => a + b, 0) / taskDurations.length 
        : 0,
      minTaskDuration: taskDurations.length > 0 ? Math.min(...taskDurations) : 0,
      maxTaskDuration: taskDurations.length > 0 ? Math.max(...taskDurations) : 0,
      averageMemoryUsage: memoryUsages.length > 0 
        ? memoryUsages.reduce((a, b) => a + b, 0) / memoryUsages.length 
        : 0,
      peakMemoryUsage: memoryUsages.length > 0 ? Math.max(...memoryUsages) : 0,
      averageCPUUsage: cpuUsages.length > 0 
        ? cpuUsages.reduce((a, b) => a + b, 0) / cpuUsages.length 
        : 0,
      peakCPUUsage: cpuUsages.length > 0 ? Math.max(...cpuUsages) : 0,
      totalMemoryAllocated: memoryDeltas.filter(d => d > 0).reduce((a, b) => a + b, 0),
      totalMemoryFreed: Math.abs(memoryDeltas.filter(d => d < 0).reduce((a, b) => a + b, 0)),
      suspectedMemoryLeaks: this.alerts.filter(a => a.type === 'leak').length,
      // Backwards-compatible aliases
      memoryUsage: memoryUsages.length > 0 ? memoryUsages[memoryUsages.length - 1] : 0,
      cpuUsage: cpuUsages.length > 0 ? cpuUsages[cpuUsages.length - 1] : 0,
    };
  }

  /**
   * Compatibility alias used by tests
   */
  getMetrics(): PerformanceStatistics {
    return this.getStatistics();
  }

  /**
   * Updates performance thresholds
   */
  updateThresholds(thresholds: Partial<PerformanceThresholds>): void {
    this.thresholds = { ...this.thresholds, ...thresholds };
    this.emit('thresholds:updated', this.thresholds);
  }

  /**
   * Gets current thresholds
   */
  getThresholds(): PerformanceThresholds {
    return { ...this.thresholds };
  }

  /**
   * Resets baseline memory
   */
  resetBaseline(): void {
    this.baselineMemory = this.captureMemorySnapshot();
    this.emit('baseline:reset', this.baselineMemory);
  }

  /**
   * Clears all collected metrics
   */
  clearMetrics(): void {
    this.memorySnapshots = [];
    this.cpuSnapshots = [];
    this.completedTaskMetrics = [];
    this.taskMetrics.clear();
    this.alerts = [];
    this.emit('metrics:cleared');
  }

  /**
   * Exports metrics to JSON
   */
  exportMetrics(): string {
    return JSON.stringify({
      statistics: this.getStatistics(),
      thresholds: this.thresholds,
      memorySnapshots: this.memorySnapshots.map(s => ({
        timestamp: s.timestamp.toISOString(),
        heapUsedMB: (s.heapUsed / 1024 / 1024).toFixed(2),
        heapTotalMB: (s.heapTotal / 1024 / 1024).toFixed(2),
        rssMB: (s.rss / 1024 / 1024).toFixed(2),
      })),
      cpuSnapshots: this.cpuSnapshots.map(s => ({
        timestamp: s.timestamp.toISOString(),
        percent: s.percent.toFixed(2),
      })),
      taskMetrics: this.completedTaskMetrics.map(m => ({
        taskId: m.taskId,
        taskTitle: m.taskTitle,
        startTime: m.startTime.toISOString(),
        endTime: m.endTime?.toISOString(),
        durationMs: m.duration,
        memoryDeltaMB: m.memoryDelta ? (m.memoryDelta / 1024 / 1024).toFixed(2) : null,
        success: m.success,
        error: m.error,
      })),
      alerts: this.alerts.map(a => ({
        type: a.type,
        severity: a.severity,
        message: a.message,
        timestamp: a.timestamp.toISOString(),
      })),
    }, null, 2);
  }

  /**
   * Checks if monitoring is active
   */
  isActive(): boolean {
    return this.isMonitoring;
  }

  /**
   * Disposes of resources
   */
  dispose(): void {
    this.stopMonitoring();
    this.clearMetrics();
    this.removeAllListeners();
  }
}
