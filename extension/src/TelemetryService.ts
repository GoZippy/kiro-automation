import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { EventEmitter } from 'events';
import * as crypto from 'crypto';

/**
 * Telemetry event types
 */
export enum TelemetryEventType {
  AUTOMATION_STARTED = 'automation.started',
  AUTOMATION_STOPPED = 'automation.stopped',
  AUTOMATION_PAUSED = 'automation.paused',
  AUTOMATION_RESUMED = 'automation.resumed',
  TASK_STARTED = 'task.started',
  TASK_COMPLETED = 'task.completed',
  TASK_FAILED = 'task.failed',
  TASK_SKIPPED = 'task.skipped',
  ERROR_OCCURRED = 'error.occurred',
  PERFORMANCE_METRIC = 'performance.metric',
  FEATURE_USED = 'feature.used',
  CONFIGURATION_CHANGED = 'configuration.changed'
}

/**
 * Telemetry event data
 */
export interface TelemetryEvent {
  type: TelemetryEventType;
  timestamp: number;
  sessionId: string;
  data: Record<string, any>;
}

/**
 * Telemetry configuration
 */
export interface TelemetryConfig {
  enabled: boolean;
  anonymousId: string;
  optInTimestamp?: number;
  optOutTimestamp?: number;
}

/**
 * TelemetryService provides privacy-compliant anonymous usage tracking
 * with opt-in/opt-out mechanism.
 * 
 * Requirements: 15.1, 15.5, 15.6
 */
export class TelemetryService extends EventEmitter {
  private context: vscode.ExtensionContext;
  private config: TelemetryConfig;
  private sessionId: string;
  private events: TelemetryEvent[] = [];
  private storageFile: string;
  private readonly MAX_EVENTS = 1000;
  private readonly FLUSH_INTERVAL = 60000; // 1 minute
  private flushTimer?: NodeJS.Timeout;
  private isInitialized = false;

  constructor(context: vscode.ExtensionContext) {
    super();
    this.context = context;
    this.sessionId = this.generateSessionId();
    this.storageFile = path.join(context.globalStorageUri.fsPath, 'telemetry.json');
    this.config = this.loadConfig();
  }

  /**
   * Initialize the telemetry service
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    // Ensure storage directory exists
    await this.ensureStorageDirectory();

    // Check if user has made a choice about telemetry
    const hasUserChoice = this.config.optInTimestamp !== undefined || this.config.optOutTimestamp !== undefined;
    
    if (!hasUserChoice) {
      // Prompt user for telemetry consent on first use
      await this.promptForConsent();
    }

    // Start flush timer if telemetry is enabled
    if (this.config.enabled) {
      this.startFlushTimer();
    }

    this.isInitialized = true;
  }

  /**
   * Prompt user for telemetry consent
   */
  private async promptForConsent(): Promise<void> {
    const message = 'Help improve Kiro Automation Extension by sending anonymous usage data?';
    const learnMore = 'Learn More';
    const enable = 'Enable';
    const disable = 'Disable';

    const choice = await vscode.window.showInformationMessage(
      message,
      learnMore,
      enable,
      disable
    );

    if (choice === learnMore) {
      // Open local privacy document if available, otherwise fallback to external URL
      try {
        const privacyUri = vscode.Uri.joinPath(this.context.extensionUri, 'PRIVACY.md');
        await vscode.commands.executeCommand('vscode.open', privacyUri);
      } catch (e) {
        await vscode.env.openExternal(vscode.Uri.parse('https://github.com/kiro-automation/privacy'));
      }
      // Ask again after showing privacy info
      await this.promptForConsent();
    } else if (choice === enable) {
      await this.optIn();
    } else if (choice === disable) {
      await this.optOut();
    } else {
      // User dismissed - default to disabled
      await this.optOut();
    }
  }

  /**
   * Opt in to telemetry
   */
  async optIn(): Promise<void> {
    this.config.enabled = true;
    this.config.optInTimestamp = Date.now();
    this.config.optOutTimestamp = undefined;
    await this.saveConfig();
    this.startFlushTimer();
    
    vscode.window.showInformationMessage('Telemetry enabled. Thank you for helping improve the extension!');
    this.emit('telemetry-enabled');
  }

  /**
   * Opt out of telemetry
   */
  async optOut(): Promise<void> {
    this.config.enabled = false;
    this.config.optOutTimestamp = Date.now();
    this.config.optInTimestamp = undefined;
    await this.saveConfig();
    this.stopFlushTimer();
    
    // Clear any stored events
    this.events = [];
    await this.clearStoredEvents();
    
    vscode.window.showInformationMessage('Telemetry disabled. No usage data will be collected.');
    this.emit('telemetry-disabled');
  }

  /**
   * Check if telemetry is enabled
   */
  isEnabled(): boolean {
    return this.config.enabled;
  }

  /**
   * Track a telemetry event
   */
  trackEvent(type: TelemetryEventType, data: Record<string, any> = {}): void {
    if (!this.config.enabled) {
      return;
    }

    // Sanitize data to remove PII
    const sanitizedData = this.sanitizeData(data);

    const event: TelemetryEvent = {
      type,
      timestamp: Date.now(),
      sessionId: this.sessionId,
      data: sanitizedData
    };

    this.events.push(event);

    // Flush if we've reached max events
    if (this.events.length >= this.MAX_EVENTS) {
      this.flush();
    }

    this.emit('event-tracked', event);
  }

  /**
   * Track automation started event
   */
  trackAutomationStarted(specCount: number, taskCount: number): void {
    this.trackEvent(TelemetryEventType.AUTOMATION_STARTED, {
      specCount,
      taskCount
    });
  }

  /**
   * Track automation stopped event
   */
  trackAutomationStopped(reason: 'user' | 'completed' | 'error', duration: number): void {
    this.trackEvent(TelemetryEventType.AUTOMATION_STOPPED, {
      reason,
      duration
    });
  }

  /**
   * Track task completion
   */
  trackTaskCompleted(taskId: string, duration: number, success: boolean): void {
    this.trackEvent(TelemetryEventType.TASK_COMPLETED, {
      taskId: this.hashString(taskId), // Hash task ID for privacy
      duration,
      success
    });
  }

  /**
   * Track task failure
   */
  trackTaskFailed(taskId: string, errorType: string): void {
    this.trackEvent(TelemetryEventType.TASK_FAILED, {
      taskId: this.hashString(taskId),
      errorType
    });
  }

  /**
   * Track error occurrence
   */
  trackError(errorType: string, errorCode?: string): void {
    this.trackEvent(TelemetryEventType.ERROR_OCCURRED, {
      errorType,
      errorCode
    });
  }

  /**
   * Track performance metric
   */
  trackPerformance(metric: string, value: number, unit: string): void {
    this.trackEvent(TelemetryEventType.PERFORMANCE_METRIC, {
      metric,
      value,
      unit
    });
  }

  /**
   * Track feature usage
   */
  trackFeatureUsed(feature: string, context?: Record<string, any>): void {
    this.trackEvent(TelemetryEventType.FEATURE_USED, {
      feature,
      context: context ? this.sanitizeData(context) : undefined
    });
  }

  /**
   * Get automation metrics
   * Requirements: 15.2, 15.3
   */
  async getAutomationMetrics(): Promise<{
    totalAutomations: number;
    totalTasks: number;
    successRate: number;
    averageTaskDuration: number;
    failurePatterns: Array<{ errorType: string; count: number }>;
    performanceMetrics: Array<{ metric: string; average: number; unit: string }>;
  }> {
    const events = await this.loadStoredEvents();
    
    let totalAutomations = 0;
    let totalTasks = 0;
    let successfulTasks = 0;
    let taskDurations: number[] = [];
    const failureMap = new Map<string, number>();
    const performanceMap = new Map<string, { values: number[]; unit: string }>();

    for (const event of events) {
      switch (event.type) {
        case TelemetryEventType.AUTOMATION_STARTED:
          totalAutomations++;
          break;
        
        case TelemetryEventType.TASK_COMPLETED:
          totalTasks++;
          if (event.data.success) {
            successfulTasks++;
          }
          if (event.data.duration) {
            taskDurations.push(event.data.duration);
          }
          break;
        
        case TelemetryEventType.TASK_FAILED:
          totalTasks++;
          const errorType = event.data.errorType || 'unknown';
          failureMap.set(errorType, (failureMap.get(errorType) || 0) + 1);
          break;
        
        case TelemetryEventType.PERFORMANCE_METRIC:
          const metric = event.data.metric;
          if (metric && event.data.value !== undefined) {
            if (!performanceMap.has(metric)) {
              performanceMap.set(metric, { values: [], unit: event.data.unit || '' });
            }
            performanceMap.get(metric)!.values.push(event.data.value);
          }
          break;
      }
    }

    // Calculate success rate
    const successRate = totalTasks > 0 ? (successfulTasks / totalTasks) * 100 : 0;

    // Calculate average task duration
    const averageTaskDuration = taskDurations.length > 0
      ? taskDurations.reduce((a, b) => a + b, 0) / taskDurations.length
      : 0;

    // Build failure patterns array
    const failurePatterns = Array.from(failureMap.entries())
      .map(([errorType, count]) => ({ errorType, count }))
      .sort((a, b) => b.count - a.count);

    // Build performance metrics array
    const performanceMetrics = Array.from(performanceMap.entries())
      .map(([metric, data]) => ({
        metric,
        average: data.values.reduce((a, b) => a + b, 0) / data.values.length,
        unit: data.unit
      }));

    return {
      totalAutomations,
      totalTasks,
      successRate,
      averageTaskDuration,
      failurePatterns,
      performanceMetrics
    };
  }

  /**
   * Get task execution statistics
   * Requirements: 15.2
   */
  async getTaskExecutionStats(): Promise<{
    totalExecutions: number;
    successfulExecutions: number;
    failedExecutions: number;
    skippedExecutions: number;
    averageDuration: number;
    medianDuration: number;
    minDuration: number;
    maxDuration: number;
  }> {
    const events = await this.loadStoredEvents();
    
    let totalExecutions = 0;
    let successfulExecutions = 0;
    let failedExecutions = 0;
    let skippedExecutions = 0;
    const durations: number[] = [];

    for (const event of events) {
      if (event.type === TelemetryEventType.TASK_COMPLETED) {
        totalExecutions++;
        if (event.data.success) {
          successfulExecutions++;
        } else {
          failedExecutions++;
        }
        if (event.data.duration) {
          durations.push(event.data.duration);
        }
      } else if (event.type === TelemetryEventType.TASK_FAILED) {
        totalExecutions++;
        failedExecutions++;
      } else if (event.type === TelemetryEventType.TASK_SKIPPED) {
        skippedExecutions++;
      }
    }

    // Calculate duration statistics
    const sortedDurations = durations.sort((a, b) => a - b);
    const averageDuration = durations.length > 0
      ? durations.reduce((a, b) => a + b, 0) / durations.length
      : 0;
    const medianDuration = durations.length > 0
      ? sortedDurations[Math.floor(sortedDurations.length / 2)]
      : 0;
    const minDuration = durations.length > 0 ? sortedDurations[0] : 0;
    const maxDuration = durations.length > 0 ? sortedDurations[sortedDurations.length - 1] : 0;

    return {
      totalExecutions,
      successfulExecutions,
      failedExecutions,
      skippedExecutions,
      averageDuration,
      medianDuration,
      minDuration,
      maxDuration
    };
  }

  /**
   * Identify common failure patterns
   * Requirements: 15.3
   */
  async identifyFailurePatterns(): Promise<Array<{
    pattern: string;
    occurrences: number;
    percentage: number;
    recentOccurrences: number;
    trend: 'increasing' | 'decreasing' | 'stable';
  }>> {
    const events = await this.loadStoredEvents();
    const now = Date.now();
    const thirtyDaysAgo = now - (30 * 24 * 60 * 60 * 1000);
    const sevenDaysAgo = now - (7 * 24 * 60 * 60 * 1000);
    
    const failureMap = new Map<string, { total: number; recent: number; timestamps: number[] }>();
    let totalFailures = 0;

    for (const event of events) {
      if (event.type === TelemetryEventType.TASK_FAILED || event.type === TelemetryEventType.ERROR_OCCURRED) {
        const errorType = event.data.errorType || event.data.errorCode || 'unknown';
        totalFailures++;
        
        if (!failureMap.has(errorType)) {
          failureMap.set(errorType, { total: 0, recent: 0, timestamps: [] });
        }
        
        const data = failureMap.get(errorType)!;
        data.total++;
        data.timestamps.push(event.timestamp);
        
        if (event.timestamp >= sevenDaysAgo) {
          data.recent++;
        }
      }
    }

    // Calculate trends
    const patterns = Array.from(failureMap.entries()).map(([pattern, data]) => {
      const percentage = totalFailures > 0 ? (data.total / totalFailures) * 100 : 0;
      
      // Calculate trend based on recent vs historical occurrences
      const recentTimestamps = data.timestamps.filter(t => t >= sevenDaysAgo);
      const olderTimestamps = data.timestamps.filter(t => t < sevenDaysAgo && t >= thirtyDaysAgo);
      
      const recentRate = recentTimestamps.length / 7; // per day
      const olderRate = olderTimestamps.length / 23; // per day
      
      let trend: 'increasing' | 'decreasing' | 'stable' = 'stable';
      if (recentRate > olderRate * 1.2) {
        trend = 'increasing';
      } else if (recentRate < olderRate * 0.8) {
        trend = 'decreasing';
      }

      return {
        pattern,
        occurrences: data.total,
        percentage,
        recentOccurrences: data.recent,
        trend
      };
    });

    return patterns.sort((a, b) => b.occurrences - a.occurrences);
  }

  /**
   * Get performance trends over time
   * Requirements: 15.2
   */
  async getPerformanceTrends(metric: string, days: number = 30): Promise<Array<{
    date: string;
    value: number;
    count: number;
  }>> {
    const events = await this.loadStoredEvents();
    const now = Date.now();
    const startTime = now - (days * 24 * 60 * 60 * 1000);
    
    const dailyData = new Map<string, { values: number[]; count: number }>();

    for (const event of events) {
      if (event.timestamp < startTime) {
        continue;
      }

      if (event.type === TelemetryEventType.PERFORMANCE_METRIC && event.data.metric === metric) {
        const date = new Date(event.timestamp).toISOString().split('T')[0];
        
        if (!dailyData.has(date)) {
          dailyData.set(date, { values: [], count: 0 });
        }
        
        const data = dailyData.get(date)!;
        data.values.push(event.data.value);
        data.count++;
      }
    }

    return Array.from(dailyData.entries())
      .map(([date, data]) => ({
        date,
        value: data.values.reduce((a, b) => a + b, 0) / data.values.length,
        count: data.count
      }))
      .sort((a, b) => a.date.localeCompare(b.date));
  }

  /**
   * Flush events to storage
   */
  private async flush(): Promise<void> {
    if (this.events.length === 0) {
      return;
    }

    try {
      // Load existing events
      const existingEvents = await this.loadStoredEvents();
      
      // Append new events
      const allEvents = [...existingEvents, ...this.events];
      
      // Keep only recent events (last 10000)
      const recentEvents = allEvents.slice(-10000);
      
      // Save to file
      await fs.promises.writeFile(
        this.storageFile,
        JSON.stringify(recentEvents, null, 2),
        'utf8'
      );

      // Clear in-memory events
      this.events = [];
      
      this.emit('events-flushed', recentEvents.length);
    } catch (error) {
      console.error('Failed to flush telemetry events:', error);
    }
  }

  /**
   * Load stored events from file
   */
  private async loadStoredEvents(): Promise<TelemetryEvent[]> {
    try {
      if (fs.existsSync(this.storageFile)) {
        const data = await fs.promises.readFile(this.storageFile, 'utf8');
        return JSON.parse(data);
      }
    } catch (error) {
      console.error('Failed to load stored telemetry events:', error);
    }
    return [];
  }

  /**
   * Clear stored events
   */
  private async clearStoredEvents(): Promise<void> {
    try {
      if (fs.existsSync(this.storageFile)) {
        await fs.promises.unlink(this.storageFile);
      }
    } catch (error) {
      console.error('Failed to clear stored telemetry events:', error);
    }
  }

  /**
   * Get telemetry summary
   */
  async getSummary(): Promise<{
    totalEvents: number;
    eventsByType: Record<string, number>;
    oldestEvent?: number;
    newestEvent?: number;
  }> {
    const events = await this.loadStoredEvents();
    
    const eventsByType: Record<string, number> = {};
    let oldestEvent: number | undefined;
    let newestEvent: number | undefined;

    for (const event of events) {
      eventsByType[event.type] = (eventsByType[event.type] || 0) + 1;
      
      if (!oldestEvent || event.timestamp < oldestEvent) {
        oldestEvent = event.timestamp;
      }
      if (!newestEvent || event.timestamp > newestEvent) {
        newestEvent = event.timestamp;
      }
    }

    return {
      totalEvents: events.length,
      eventsByType,
      oldestEvent,
      newestEvent
    };
  }

  /**
   * Export telemetry data
   */
  async exportData(): Promise<string> {
    const events = await this.loadStoredEvents();
    return JSON.stringify({
      config: {
        anonymousId: this.config.anonymousId,
        enabled: this.config.enabled,
        optInTimestamp: this.config.optInTimestamp,
        optOutTimestamp: this.config.optOutTimestamp
      },
      events
    }, null, 2);
  }

  /**
   * Start flush timer
   */
  private startFlushTimer(): void {
    if (this.flushTimer) {
      return;
    }

    this.flushTimer = setInterval(() => {
      this.flush();
    }, this.FLUSH_INTERVAL);
  }

  /**
   * Stop flush timer
   */
  private stopFlushTimer(): void {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = undefined;
    }
  }

  /**
   * Dispose of the telemetry service
   */
  async dispose(): Promise<void> {
    this.stopFlushTimer();
    await this.flush();
    this.removeAllListeners();
  }

  /**
   * Load configuration from storage
   */
  private loadConfig(): TelemetryConfig {
    const stored = this.context.globalState.get<TelemetryConfig>('telemetry-config');
    
    if (stored) {
      return stored;
    }

    // Create new config with anonymous ID
    return {
      enabled: false, // Default to disabled until user opts in
      anonymousId: this.generateAnonymousId()
    };
  }

  /**
   * Save configuration to storage
   */
  private async saveConfig(): Promise<void> {
    await this.context.globalState.update('telemetry-config', this.config);
  }

  /**
   * Generate anonymous ID
   */
  private generateAnonymousId(): string {
    return crypto.randomBytes(16).toString('hex');
  }

  /**
   * Generate session ID
   */
  private generateSessionId(): string {
    return `${Date.now()}-${crypto.randomBytes(8).toString('hex')}`;
  }

  /**
   * Hash a string for privacy
   */
  private hashString(value: string): string {
    return crypto.createHash('sha256').update(value).digest('hex').substring(0, 16);
  }

  /**
   * Sanitize data to remove PII
   */
  private sanitizeData(data: Record<string, any>): Record<string, any> {
    const sanitized: Record<string, any> = {};

    for (const [key, value] of Object.entries(data)) {
      // Skip null/undefined
      if (value === null || value === undefined) {
        continue;
      }

      // Remove potential PII fields
      const lowerKey = key.toLowerCase();
      if (lowerKey.includes('email') || 
          lowerKey.includes('password') || 
          lowerKey.includes('token') ||
          lowerKey.includes('secret') ||
          lowerKey.includes('key') ||
          lowerKey.includes('username') ||
          lowerKey.includes('name') ||
          lowerKey.includes('path') ||
          lowerKey.includes('file')) {
        continue;
      }

      // Recursively sanitize objects
      if (typeof value === 'object' && !Array.isArray(value)) {
        sanitized[key] = this.sanitizeData(value);
      } 
      // Sanitize arrays
      else if (Array.isArray(value)) {
        sanitized[key] = value.map(item => 
          typeof item === 'object' ? this.sanitizeData(item) : item
        );
      }
      // Keep primitive values
      else {
        sanitized[key] = value;
      }
    }

    return sanitized;
  }

  /**
   * Ensure storage directory exists
   */
  private async ensureStorageDirectory(): Promise<void> {
    const dir = path.dirname(this.storageFile);
    if (!fs.existsSync(dir)) {
      await fs.promises.mkdir(dir, { recursive: true });
    }
  }
}
