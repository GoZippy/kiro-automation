import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Log levels for the logger
 */
export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARNING = 2,
  ERROR = 3,
}

/**
 * Log entry structure
 */
export interface LogEntry {
  timestamp: Date;
  level: LogLevel;
  message: string;
  context?: Record<string, any>;
  correlationId?: string;
}

/**
 * Logger configuration options
 */
export interface LoggerConfig {
  minLevel: LogLevel;
  enableFileLogging: boolean;
  logDirectory?: string;
  maxLogFileSize: number; // in bytes
  maxLogFiles: number;
  enableConsole: boolean;
  enableOutputChannel: boolean;
  useJsonFormat: boolean;
}

/**
 * Session summary data
 */
export interface SessionSummary {
  sessionId: string;
  startTime: Date;
  endTime?: Date;
  totalLogs: number;
  logsByLevel: Record<LogLevel, number>;
  errors: LogEntry[];
  warnings: LogEntry[];
  correlationIds: Set<string>;
}

/**
 * Performance measurement data
 */
export interface PerformanceMeasurement {
  name: string;
  startTime: number;
  endTime?: number;
  duration?: number;
  metadata?: Record<string, any>;
}

/**
 * Diagnostic information
 */
export interface DiagnosticInfo {
  timestamp: Date;
  extensionVersion: string;
  vscodeVersion: string;
  platform: string;
  workspaceFolders: number;
  memoryUsage: NodeJS.MemoryUsage;
  activeCorrelationIds: string[];
  sessionSummary: SessionSummary;
  recentErrors: LogEntry[];
  recentWarnings: LogEntry[];
}

/**
 * Logger utility class for the Kiro Automation Extension
 * Provides multi-level logging with timestamps, context, file-based logging with rotation,
 * and VS Code output channel integration
 */
export class Logger {
  private static instance: Logger;
  private outputChannel: vscode.OutputChannel;
  private config: LoggerConfig;
  private currentLogFile: string | null = null;
  private currentLogFileSize: number = 0;
  private sessionSummary: SessionSummary;
  private correlationIdStack: string[] = [];
  private performanceMeasurements: Map<string, PerformanceMeasurement> = new Map();
  private debugMode: boolean = false;

  // Make constructor public/test-friendly: accept either a config object or a string (output channel name)
  public constructor(config: Partial<LoggerConfig> | string = {}) {
    if (typeof config === 'string') {
      // If a string is passed, treat it as an output channel name and use defaults
      this.config = {
        minLevel: LogLevel.INFO,
        enableFileLogging: false,
        maxLogFileSize: 5 * 1024 * 1024,
        maxLogFiles: 5,
        enableConsole: true,
        enableOutputChannel: true,
        useJsonFormat: false,
      } as LoggerConfig;
      this.outputChannel = vscode.window.createOutputChannel(config as string);
    } else {
      this.config = {
      minLevel: LogLevel.INFO,
      enableFileLogging: true,
      maxLogFileSize: 5 * 1024 * 1024, // 5MB
      maxLogFiles: 5,
      enableConsole: true,
      enableOutputChannel: true,
      useJsonFormat: false,
      ...config,
    };
      this.outputChannel = vscode.window.createOutputChannel('Kiro Automation');
    }
    
    this.sessionSummary = this.createNewSession();
    
    if (this.config.enableFileLogging) {
      this.initializeFileLogging();
    }
  }

  /**
   * Create a new session summary
   */
  private createNewSession(): SessionSummary {
    return {
      sessionId: this.generateCorrelationId(),
      startTime: new Date(),
      totalLogs: 0,
      logsByLevel: {
        [LogLevel.DEBUG]: 0,
        [LogLevel.INFO]: 0,
        [LogLevel.WARNING]: 0,
        [LogLevel.ERROR]: 0,
      },
      errors: [],
      warnings: [],
      correlationIds: new Set(),
    };
  }

  /**
   * Get the singleton instance of the Logger
   */
  public static getInstance(config?: Partial<LoggerConfig>): Logger {
    if (!Logger.instance) {
      Logger.instance = new Logger(config);
    }
    return Logger.instance;
  }

  /**
   * Initialize file-based logging
   */
  private initializeFileLogging(): void {
    try {
      const logDir = this.config.logDirectory || this.getDefaultLogDirectory();
      
      if (!fs.existsSync(logDir)) {
        fs.mkdirSync(logDir, { recursive: true });
      }

      this.currentLogFile = path.join(logDir, `automation-${this.getTimestamp()}.log`);
      this.currentLogFileSize = 0;
    } catch (error) {
      console.error('Failed to initialize file logging:', error);
      this.config.enableFileLogging = false;
    }
  }

  /**
   * Get the default log directory
   */
  private getDefaultLogDirectory(): string {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (workspaceFolders && workspaceFolders.length > 0) {
      return path.join(workspaceFolders[0].uri.fsPath, '.kiro', 'logs');
    }
    // Fallback to extension storage path
    return path.join(process.env.HOME || process.env.USERPROFILE || '', '.kiro-automation', 'logs');
  }

  /**
   * Get formatted timestamp for log entries
   */
  private getTimestamp(): string {
    return new Date().toISOString().replace(/[:.]/g, '-').replace('T', '_').split('Z')[0];
  }

  /**
   * Format a log entry for output
   */
  private formatLogEntry(entry: LogEntry): string {
    if (this.config.useJsonFormat) {
      return JSON.stringify({
        timestamp: entry.timestamp.toISOString(),
        level: LogLevel[entry.level],
        message: entry.message,
        context: entry.context,
        correlationId: entry.correlationId,
        sessionId: this.sessionSummary.sessionId,
      });
    }

    const levelStr = LogLevel[entry.level].padEnd(7);
    const timestamp = entry.timestamp.toISOString();
    const contextStr = entry.context ? ` | ${JSON.stringify(entry.context)}` : '';
    const correlationStr = entry.correlationId ? ` [${entry.correlationId}]` : '';
    
    return `[${timestamp}] ${levelStr}${correlationStr}: ${entry.message}${contextStr}`;
  }

  /**
   * Generate a unique correlation ID
   */
  public generateCorrelationId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Push a correlation ID onto the stack for nested operations
   */
  public pushCorrelationId(correlationId?: string): string {
    const id = correlationId || this.generateCorrelationId();
    this.correlationIdStack.push(id);
    this.sessionSummary.correlationIds.add(id);
    return id;
  }

  /**
   * Pop a correlation ID from the stack
   */
  public popCorrelationId(): string | undefined {
    return this.correlationIdStack.pop();
  }

  /**
   * Get the current correlation ID from the stack
   */
  public getCurrentCorrelationId(): string | undefined {
    return this.correlationIdStack[this.correlationIdStack.length - 1];
  }

  /**
   * Write log entry to file with rotation
   */
  private writeToFile(formattedEntry: string): void {
    if (!this.config.enableFileLogging || !this.currentLogFile) {
      return;
    }

    try {
      const entrySize = Buffer.byteLength(formattedEntry + '\n', 'utf8');
      
      // Check if rotation is needed
      if (this.currentLogFileSize + entrySize > this.config.maxLogFileSize) {
        this.rotateLogFiles();
      }

      fs.appendFileSync(this.currentLogFile, formattedEntry + '\n', 'utf8');
      this.currentLogFileSize += entrySize;
    } catch (error) {
      console.error('Failed to write to log file:', error);
    }
  }

  /**
   * Rotate log files when size limit is reached
   */
  private rotateLogFiles(): void {
    try {
      const logDir = path.dirname(this.currentLogFile!);
      const files = fs.readdirSync(logDir)
        .filter(f => f.startsWith('automation-') && f.endsWith('.log'))
        .map(f => ({
          name: f,
          path: path.join(logDir, f),
          mtime: fs.statSync(path.join(logDir, f)).mtime.getTime(),
        }))
        .sort((a, b) => b.mtime - a.mtime);

      // Remove old log files if we exceed the limit
      if (files.length >= this.config.maxLogFiles) {
        const filesToDelete = files.slice(this.config.maxLogFiles - 1);
        filesToDelete.forEach(file => {
          try {
            fs.unlinkSync(file.path);
          } catch (error) {
            console.error(`Failed to delete old log file ${file.name}:`, error);
          }
        });
      }

      // Create new log file
      this.currentLogFile = path.join(logDir, `automation-${this.getTimestamp()}.log`);
      this.currentLogFileSize = 0;
    } catch (error) {
      console.error('Failed to rotate log files:', error);
    }
  }

  /**
   * Log a message at the specified level
   */
  private log(level: LogLevel, message: string, context?: Record<string, any>, correlationId?: string): void {
    if (level < this.config.minLevel) {
      return;
    }

    // Use current correlation ID from stack if not provided
    const effectiveCorrelationId = correlationId || this.getCurrentCorrelationId();

    const entry: LogEntry = {
      timestamp: new Date(),
      level,
      message,
      context,
      correlationId: effectiveCorrelationId,
    };

    // Update session summary
    this.updateSessionSummary(entry);

    const formattedEntry = this.formatLogEntry(entry);

    // Output to console
    if (this.config.enableConsole) {
      const consoleMethod = level === LogLevel.ERROR ? 'error' : 
                           level === LogLevel.WARNING ? 'warn' : 
                           level === LogLevel.DEBUG ? 'debug' : 'log';
      console[consoleMethod](formattedEntry);
    }

    // Output to VS Code output channel
    if (this.config.enableOutputChannel) {
      this.outputChannel.appendLine(formattedEntry);
    }

    // Write to file
    this.writeToFile(formattedEntry);
  }

  /**
   * Update session summary with log entry
   */
  private updateSessionSummary(entry: LogEntry): void {
    this.sessionSummary.totalLogs++;
    this.sessionSummary.logsByLevel[entry.level]++;

    if (entry.level === LogLevel.ERROR) {
      this.sessionSummary.errors.push(entry);
    } else if (entry.level === LogLevel.WARNING) {
      this.sessionSummary.warnings.push(entry);
    }

    if (entry.correlationId) {
      this.sessionSummary.correlationIds.add(entry.correlationId);
    }
  }

  /**
   * Log a debug message
   */
  public debug(message: string, context?: Record<string, any>, correlationId?: string): void {
    this.log(LogLevel.DEBUG, message, context, correlationId);
  }

  /**
   * Log an info message
   */
  public info(message: string, context?: Record<string, any>, correlationId?: string): void {
    this.log(LogLevel.INFO, message, context, correlationId);
  }

  /**
   * Log a warning message
   */
  public warning(message: string, context?: Record<string, any>, correlationId?: string): void {
    this.log(LogLevel.WARNING, message, context, correlationId);
  }

  /**
   * Log an error message
   */
  public error(message: string, context?: Record<string, any>, correlationId?: string): void {
    this.log(LogLevel.ERROR, message, context, correlationId);
  }

  /**
   * Show the output channel
   */
  public show(): void {
    this.outputChannel.show();
  }

  /**
   * Clear the output channel
   */
  public clear(): void {
    this.outputChannel.clear();
  }

  /**
   * Update logger configuration
   */
  public updateConfig(config: Partial<LoggerConfig>): void {
    this.config = { ...this.config, ...config };
    
    if (config.enableFileLogging && !this.currentLogFile) {
      this.initializeFileLogging();
    }
  }

  /**
   * Get the current log file path
   */
  public getCurrentLogFile(): string | null {
    return this.currentLogFile;
  }

  /**
   * Get all log files in the log directory
   */
  public getLogFiles(): string[] {
    if (!this.config.enableFileLogging || !this.currentLogFile) {
      return [];
    }

    try {
      const logDir = path.dirname(this.currentLogFile);
      return fs.readdirSync(logDir)
        .filter(f => f.startsWith('automation-') && f.endsWith('.log'))
        .map(f => path.join(logDir, f))
        .sort((a, b) => {
          const statA = fs.statSync(a);
          const statB = fs.statSync(b);
          return statB.mtime.getTime() - statA.mtime.getTime();
        });
    } catch (error) {
      this.error('Failed to get log files', { error: String(error) });
      return [];
    }
  }

  /**
   * Get the current session summary
   */
  public getSessionSummary(): SessionSummary {
    return {
      ...this.sessionSummary,
      endTime: new Date(),
      correlationIds: new Set(this.sessionSummary.correlationIds),
    };
  }

  /**
   * Export session summary as JSON
   */
  public exportSessionSummary(): string {
    const summary = this.getSessionSummary();
    return JSON.stringify({
      ...summary,
      correlationIds: Array.from(summary.correlationIds),
      errors: summary.errors.map(e => ({
        timestamp: e.timestamp.toISOString(),
        message: e.message,
        context: e.context,
        correlationId: e.correlationId,
      })),
      warnings: summary.warnings.map(w => ({
        timestamp: w.timestamp.toISOString(),
        message: w.message,
        context: w.context,
        correlationId: w.correlationId,
      })),
    }, null, 2);
  }

  /**
   * Write session summary to file
   */
  public async saveSessionSummary(): Promise<void> {
    if (!this.config.enableFileLogging || !this.currentLogFile) {
      return;
    }

    try {
      const logDir = path.dirname(this.currentLogFile);
      const summaryFile = path.join(logDir, `session-${this.sessionSummary.sessionId}.json`);
      const summaryJson = this.exportSessionSummary();
      
      fs.writeFileSync(summaryFile, summaryJson, 'utf8');
      this.info('Session summary saved', { summaryFile });
    } catch (error) {
      this.error('Failed to save session summary', { error: String(error) });
    }
  }

  /**
   * Reset session summary (start a new session)
   */
  public resetSession(): void {
    // Save current session before resetting
    this.saveSessionSummary();
    this.sessionSummary = this.createNewSession();
    this.correlationIdStack = [];
    this.info('New logging session started', { sessionId: this.sessionSummary.sessionId });
  }

  /**
   * Get logs by correlation ID
   */
  public getLogsByCorrelationId(correlationId: string): LogEntry[] {
    // This would require maintaining a log buffer in memory
    // For now, we'll return empty array and suggest reading from file
    this.warning('getLogsByCorrelationId requires reading from log files', { correlationId });
    return [];
  }

  // ============================================================================
  // Debugging Utilities
  // ============================================================================

  /**
   * Enable debug mode with verbose logging
   */
  public enableDebugMode(): void {
    this.debugMode = true;
    this.config.minLevel = LogLevel.DEBUG;
    this.info('Debug mode enabled - verbose logging active');
  }

  /**
   * Disable debug mode
   */
  public disableDebugMode(): void {
    this.debugMode = false;
    this.config.minLevel = LogLevel.INFO;
    this.info('Debug mode disabled');
  }

  /**
   * Check if debug mode is enabled
   */
  public isDebugMode(): boolean {
    return this.debugMode;
  }

  /**
   * Start a performance measurement
   */
  public startPerformanceMeasurement(name: string, metadata?: Record<string, any>): void {
    const measurement: PerformanceMeasurement = {
      name,
      startTime: performance.now(),
      metadata,
    };
    this.performanceMeasurements.set(name, measurement);
    
    if (this.debugMode) {
      this.debug(`Performance measurement started: ${name}`, metadata);
    }
  }

  /**
   * End a performance measurement and log the duration
   */
  public endPerformanceMeasurement(name: string, additionalMetadata?: Record<string, any>): number | null {
    const measurement = this.performanceMeasurements.get(name);
    
    if (!measurement) {
      this.warning(`Performance measurement not found: ${name}`);
      return null;
    }

    measurement.endTime = performance.now();
    measurement.duration = measurement.endTime - measurement.startTime;

    const metadata = {
      ...measurement.metadata,
      ...additionalMetadata,
      duration: `${measurement.duration.toFixed(2)}ms`,
    };

    if (this.debugMode) {
      this.debug(`Performance measurement completed: ${name}`, metadata);
    } else {
      this.info(`Performance: ${name}`, metadata);
    }

    this.performanceMeasurements.delete(name);
    return measurement.duration;
  }

  /**
   * Measure the execution time of a function
   */
  public async measureAsync<T>(
    name: string,
    fn: () => Promise<T>,
    metadata?: Record<string, any>
  ): Promise<T> {
    this.startPerformanceMeasurement(name, metadata);
    try {
      const result = await fn();
      this.endPerformanceMeasurement(name, { success: true });
      return result;
    } catch (error) {
      this.endPerformanceMeasurement(name, { success: false, error: String(error) });
      throw error;
    }
  }

  /**
   * Measure the execution time of a synchronous function
   */
  public measure<T>(
    name: string,
    fn: () => T,
    metadata?: Record<string, any>
  ): T {
    this.startPerformanceMeasurement(name, metadata);
    try {
      const result = fn();
      this.endPerformanceMeasurement(name, { success: true });
      return result;
    } catch (error) {
      this.endPerformanceMeasurement(name, { success: false, error: String(error) });
      throw error;
    }
  }

  /**
   * Get all active performance measurements
   */
  public getActivePerformanceMeasurements(): PerformanceMeasurement[] {
    return Array.from(this.performanceMeasurements.values());
  }

  /**
   * Collect diagnostic information
   */
  public collectDiagnostics(): DiagnosticInfo {
    const workspaceFolders = vscode.workspace.workspaceFolders?.length || 0;
    const extensionVersion = vscode.extensions.getExtension('kiro-automation')?.packageJSON?.version || 'unknown';

    return {
      timestamp: new Date(),
      extensionVersion,
      vscodeVersion: vscode.version,
      platform: `${process.platform} ${process.arch}`,
      workspaceFolders,
      memoryUsage: process.memoryUsage(),
      activeCorrelationIds: [...this.correlationIdStack],
      sessionSummary: this.getSessionSummary(),
      recentErrors: this.sessionSummary.errors.slice(-10),
      recentWarnings: this.sessionSummary.warnings.slice(-10),
    };
  }

  /**
   * Export diagnostic information as JSON
   */
  public exportDiagnostics(): string {
    const diagnostics = this.collectDiagnostics();
    return JSON.stringify({
      ...diagnostics,
      memoryUsage: {
        heapUsed: `${(diagnostics.memoryUsage.heapUsed / 1024 / 1024).toFixed(2)} MB`,
        heapTotal: `${(diagnostics.memoryUsage.heapTotal / 1024 / 1024).toFixed(2)} MB`,
        external: `${(diagnostics.memoryUsage.external / 1024 / 1024).toFixed(2)} MB`,
        rss: `${(diagnostics.memoryUsage.rss / 1024 / 1024).toFixed(2)} MB`,
      },
      sessionSummary: {
        ...diagnostics.sessionSummary,
        correlationIds: Array.from(diagnostics.sessionSummary.correlationIds),
      },
      recentErrors: diagnostics.recentErrors.map(e => ({
        timestamp: e.timestamp.toISOString(),
        message: e.message,
        context: e.context,
        correlationId: e.correlationId,
      })),
      recentWarnings: diagnostics.recentWarnings.map(w => ({
        timestamp: w.timestamp.toISOString(),
        message: w.message,
        context: w.context,
        correlationId: w.correlationId,
      })),
    }, null, 2);
  }

  /**
   * Save diagnostic information to file
   */
  public async saveDiagnostics(): Promise<void> {
    if (!this.config.enableFileLogging || !this.currentLogFile) {
      this.warning('Cannot save diagnostics: file logging is disabled');
      return;
    }

    try {
      const logDir = path.dirname(this.currentLogFile);
      const diagnosticsFile = path.join(logDir, `diagnostics-${this.getTimestamp()}.json`);
      const diagnosticsJson = this.exportDiagnostics();
      
      fs.writeFileSync(diagnosticsFile, diagnosticsJson, 'utf8');
      this.info('Diagnostics saved', { diagnosticsFile });
    } catch (error) {
      this.error('Failed to save diagnostics', { error: String(error) });
    }
  }

  /**
   * Log a verbose debug message (only in debug mode)
   */
  public verbose(message: string, context?: Record<string, any>, correlationId?: string): void {
    if (this.debugMode) {
      this.debug(`[VERBOSE] ${message}`, context, correlationId);
    }
  }

  /**
   * Log a trace message with stack trace (only in debug mode)
   */
  public trace(message: string, context?: Record<string, any>, correlationId?: string): void {
    if (this.debugMode) {
      const stack = new Error().stack?.split('\n').slice(2).join('\n');
      this.debug(`[TRACE] ${message}`, { ...context, stack }, correlationId);
    }
  }

  /**
   * Dispose of the logger resources
   */
  public dispose(): void {
    this.saveSessionSummary();
    this.outputChannel.dispose();
  }
}
