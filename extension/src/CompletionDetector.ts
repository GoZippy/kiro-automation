import * as vscode from 'vscode';
import { Task, TaskStatus } from './models/Task';

/**
 * Completion detection result
 */
export interface CompletionDetectionResult {
  /** Whether completion was detected */
  completed: boolean;

  /** Confidence level (0-1) */
  confidence: number;

  /** Detection method used */
  method: 'file-change' | 'response-indicator' | 'timeout' | 'heuristic';

  /** Detected indicators */
  indicators: string[];

  /** Timestamp of detection */
  timestamp: Date;

  /** Additional context */
  context?: any;
}

/**
 * File change event
 */
interface FileChangeEvent {
  uri: vscode.Uri;
  type: 'created' | 'modified' | 'deleted';
  timestamp: Date;
}

/**
 * Completion heuristics configuration
 */
export interface CompletionHeuristics {
  /** Minimum number of file changes to consider completion */
  minFileChanges: number;

  /** Time window for file changes in milliseconds */
  fileChangeWindow: number;

  /** File patterns to watch */
  watchPatterns: string[];

  /** File patterns to ignore */
  ignorePatterns: string[];

  /** Minimum idle time before considering completion (ms) */
  minIdleTime: number;
}

/**
 * Default completion heuristics
 */
const DEFAULT_HEURISTICS: CompletionHeuristics = {
  minFileChanges: 1,
  fileChangeWindow: 30000, // 30 seconds
  watchPatterns: ['**/*.{ts,js,tsx,jsx,py,java,go,rs,cpp,c,h}'],
  ignorePatterns: ['**/node_modules/**', '**/dist/**', '**/build/**', '**/.git/**'],
  minIdleTime: 5000, // 5 seconds
};

/**
 * CompletionDetector class
 * Detects task completion using multiple strategies
 */
export class CompletionDetector {
  private fileWatchers: vscode.FileSystemWatcher[] = [];
  private fileChanges: FileChangeEvent[] = [];
  private lastChangeTime?: Date;
  private heuristics: CompletionHeuristics;
  private disposables: vscode.Disposable[] = [];
  private timeoutHandles: Map<string, NodeJS.Timeout> = new Map();

  constructor(heuristics?: Partial<CompletionHeuristics>) {
    this.heuristics = { ...DEFAULT_HEURISTICS, ...heuristics };
  }

  /**
   * Starts monitoring for completion
   * @param task Task to monitor
   * @param timeout Timeout in milliseconds
   * @returns Promise that resolves with detection result
   */
  async monitorCompletion(task: Task, timeout: number = 300000): Promise<CompletionDetectionResult> {
    return new Promise((resolve, reject) => {
      // Set up file watchers
      this.setupFileWatchers();

      // Set up timeout
      const timeoutHandle = setTimeout(() => {
        this.cleanup();
        resolve({
          completed: false,
          confidence: 0,
          method: 'timeout',
          indicators: ['timeout'],
          timestamp: new Date(),
        });
      }, timeout);

      this.timeoutHandles.set(task.id, timeoutHandle);

      // Start monitoring loop
      this.startMonitoringLoop(task, resolve);
    });
  }

  /**
   * Sets up file system watchers
   */
  private setupFileWatchers(): void {
    // Clean up existing watchers
    this.cleanupFileWatchers();

    // Create watchers for each pattern
    for (const pattern of this.heuristics.watchPatterns) {
      const watcher = vscode.workspace.createFileSystemWatcher(pattern);

      // Watch for file creation
      watcher.onDidCreate((uri) => {
        if (!this.shouldIgnoreFile(uri)) {
          this.recordFileChange(uri, 'created');
        }
      });

      // Watch for file modification
      watcher.onDidChange((uri) => {
        if (!this.shouldIgnoreFile(uri)) {
          this.recordFileChange(uri, 'modified');
        }
      });

      // Watch for file deletion
      watcher.onDidDelete((uri) => {
        if (!this.shouldIgnoreFile(uri)) {
          this.recordFileChange(uri, 'deleted');
        }
      });

      this.fileWatchers.push(watcher);
      this.disposables.push(watcher);
    }
  }

  /**
   * Checks if a file should be ignored
   * @param uri File URI
   * @returns True if file should be ignored
   */
  private shouldIgnoreFile(uri: vscode.Uri): boolean {
    const filePath = uri.fsPath;

    for (const pattern of this.heuristics.ignorePatterns) {
      // Simple pattern matching (could be enhanced with glob library)
      const regexPattern = pattern
        .replace(/\*\*/g, '.*')
        .replace(/\*/g, '[^/]*')
        .replace(/\?/g, '.');

      if (new RegExp(regexPattern).test(filePath)) {
        return true;
      }
    }

    return false;
  }

  /**
   * Records a file change event
   * @param uri File URI
   * @param type Change type
   */
  private recordFileChange(uri: vscode.Uri, type: 'created' | 'modified' | 'deleted'): void {
    const event: FileChangeEvent = {
      uri,
      type,
      timestamp: new Date(),
    };

    this.fileChanges.push(event);
    this.lastChangeTime = event.timestamp;

    // Clean up old file changes outside the window
    const now = new Date();
    this.fileChanges = this.fileChanges.filter(
      (change) => now.getTime() - change.timestamp.getTime() < this.heuristics.fileChangeWindow
    );
  }

  /**
   * Starts the monitoring loop
   * @param task Task being monitored
   * @param resolve Resolve function for the promise
   */
  private startMonitoringLoop(
    task: Task,
    resolve: (result: CompletionDetectionResult) => void
  ): void {
    const checkInterval = 1000; // Check every second

    const intervalHandle = setInterval(() => {
      const result = this.checkCompletion(task);

      if (result.completed) {
        clearInterval(intervalHandle);
        this.cleanup();
        resolve(result);
      }
    }, checkInterval);

    // Store interval handle for cleanup
    this.disposables.push({
      dispose: () => clearInterval(intervalHandle),
    });
  }

  /**
   * Checks if completion criteria are met
   * @param task Task being monitored
   * @returns Completion detection result
   */
  private checkCompletion(task: Task): CompletionDetectionResult {
    const now = new Date();

    // Check if there have been file changes
    if (this.fileChanges.length >= this.heuristics.minFileChanges) {
      // Check if system has been idle for minimum time
      if (this.lastChangeTime) {
        const idleTime = now.getTime() - this.lastChangeTime.getTime();

        if (idleTime >= this.heuristics.minIdleTime) {
          return {
            completed: true,
            confidence: 0.8,
            method: 'file-change',
            indicators: this.fileChanges.map((change) => `${change.type}: ${change.uri.fsPath}`),
            timestamp: now,
            context: {
              fileChanges: this.fileChanges.length,
              idleTime,
            },
          };
        }
      }
    }

    // No completion detected
    return {
      completed: false,
      confidence: 0,
      method: 'heuristic',
      indicators: [],
      timestamp: now,
    };
  }

  /**
   * Detects completion based on response indicators
   * @param response Response text to analyze
   * @returns Completion detection result
   */
  detectCompletionFromResponse(response: string): CompletionDetectionResult {
    const indicators: string[] = [];
    let confidence = 0;

    // Success indicators
    const successIndicators = [
      'completed',
      'done',
      'finished',
      'success',
      'implemented',
      'created',
      'updated',
      'fixed',
    ];

    // Check for success indicators
    const lowerResponse = response.toLowerCase();
    for (const indicator of successIndicators) {
      if (lowerResponse.includes(indicator)) {
        indicators.push(indicator);
        confidence += 0.2;
      }
    }

    // Check for code blocks (indicates implementation)
    const codeBlockCount = (response.match(/```/g) || []).length / 2;
    if (codeBlockCount > 0) {
      indicators.push(`${codeBlockCount} code blocks`);
      confidence += 0.3;
    }

    // Check for file operations
    const fileOperations = ['created file', 'updated file', 'modified', 'wrote to'];
    for (const operation of fileOperations) {
      if (lowerResponse.includes(operation)) {
        indicators.push(operation);
        confidence += 0.2;
      }
    }

    // Cap confidence at 1.0
    confidence = Math.min(confidence, 1.0);

    return {
      completed: confidence >= 0.6,
      confidence,
      method: 'response-indicator',
      indicators,
      timestamp: new Date(),
    };
  }

  /**
   * Detects completion based on task status
   * @param task Task to check
   * @returns Completion detection result
   */
  detectCompletionFromTaskStatus(task: Task): CompletionDetectionResult {
    const completed = task.status === TaskStatus.COMPLETED;
    const confidence = completed ? 1.0 : 0.0;

    return {
      completed,
      confidence,
      method: 'heuristic',
      indicators: completed ? ['task status: completed'] : [],
      timestamp: new Date(),
    };
  }

  /**
   * Combines multiple detection results
   * @param results Array of detection results
   * @returns Combined result
   */
  combineDetectionResults(results: CompletionDetectionResult[]): CompletionDetectionResult {
    if (results.length === 0) {
      return {
        completed: false,
        confidence: 0,
        method: 'heuristic',
        indicators: [],
        timestamp: new Date(),
      };
    }

    // Calculate average confidence
    const avgConfidence = results.reduce((sum, r) => sum + r.confidence, 0) / results.length;

    // Combine indicators
    const allIndicators = results.flatMap((r) => r.indicators);

    // Consider completed if any result is completed with high confidence
    const completed = results.some((r) => r.completed && r.confidence >= 0.7);

    return {
      completed,
      confidence: avgConfidence,
      method: 'heuristic',
      indicators: allIndicators,
      timestamp: new Date(),
      context: {
        resultCount: results.length,
        methods: results.map((r) => r.method),
      },
    };
  }

  /**
   * Handles ambiguous completion states
   * @param result Detection result
   * @returns Clarified result
   */
  handleAmbiguousState(result: CompletionDetectionResult): CompletionDetectionResult {
    // If confidence is between 0.4 and 0.7, it's ambiguous
    if (result.confidence >= 0.4 && result.confidence < 0.7) {
      return {
        ...result,
        completed: false, // Err on the side of caution
        indicators: [...result.indicators, 'ambiguous state - needs verification'],
      };
    }

    return result;
  }

  /**
   * Gets recent file changes
   */
  getRecentFileChanges(): FileChangeEvent[] {
    return [...this.fileChanges];
  }

  /**
   * Gets last change time
   */
  getLastChangeTime(): Date | undefined {
    return this.lastChangeTime;
  }

  /**
   * Gets current idle time
   */
  getCurrentIdleTime(): number {
    if (!this.lastChangeTime) {
      return 0;
    }

    return new Date().getTime() - this.lastChangeTime.getTime();
  }

  /**
   * Updates heuristics configuration
   * @param heuristics Partial heuristics to update
   */
  updateHeuristics(heuristics: Partial<CompletionHeuristics>): void {
    this.heuristics = { ...this.heuristics, ...heuristics };
  }

  /**
   * Gets current heuristics configuration
   */
  getHeuristics(): CompletionHeuristics {
    return { ...this.heuristics };
  }

  /**
   * Cancels monitoring for a task
   * @param taskId Task ID
   */
  cancelMonitoring(taskId: string): void {
    const timeoutHandle = this.timeoutHandles.get(taskId);
    if (timeoutHandle) {
      clearTimeout(timeoutHandle);
      this.timeoutHandles.delete(taskId);
    }
  }

  /**
   * Cleans up file watchers
   */
  private cleanupFileWatchers(): void {
    this.fileWatchers.forEach((watcher) => watcher.dispose());
    this.fileWatchers = [];
  }

  /**
   * Cleans up resources
   */
  private cleanup(): void {
    this.cleanupFileWatchers();
    this.fileChanges = [];
    this.lastChangeTime = undefined;
  }

  /**
   * Disposes of all resources
   */
  dispose(): void {
    this.cleanup();
    this.disposables.forEach((d) => d.dispose());
    this.disposables = [];
    this.timeoutHandles.forEach((handle) => clearTimeout(handle));
    this.timeoutHandles.clear();
  }
}

/**
 * Creates a CompletionDetector instance
 */
export function createCompletionDetector(heuristics?: Partial<CompletionHeuristics>): CompletionDetector {
  return new CompletionDetector(heuristics);
}
