import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Log levels
 */
export enum LogLevel {
  DEBUG = 'debug',
  INFO = 'info',
  WARNING = 'warning',
  ERROR = 'error'
}

/**
 * Log entry
 */
export interface LogEntry {
  timestamp: Date;
  level: LogLevel;
  message: string;
  context?: string;
}

/**
 * Manages logging and log viewing
 */
export class LogViewer {
  private outputChannel: vscode.OutputChannel;
  private logEntries: LogEntry[] = [];
  private logFilePath: string | null = null;
  private currentLogLevel: LogLevel = LogLevel.INFO;
  private maxLogEntries: number = 1000;

  constructor(private context: vscode.ExtensionContext) {
    this.outputChannel = vscode.window.createOutputChannel('Kiro Automation');
    this.initializeLogFile();
    this.loadLogLevel();
  }

  /**
   * Initialize log file
   */
  private initializeLogFile(): void {
    const config = vscode.workspace.getConfiguration('kiro-automation');
    const saveLogsToFile = config.get<boolean>('saveLogsToFile', true);

    if (saveLogsToFile) {
      const logDir = path.join(this.context.globalStorageUri.fsPath, 'logs');
      if (!fs.existsSync(logDir)) {
        fs.mkdirSync(logDir, { recursive: true });
      }

      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      this.logFilePath = path.join(logDir, `automation-${timestamp}.log`);
    }
  }

  /**
   * Load log level from configuration
   */
  private loadLogLevel(): void {
    const config = vscode.workspace.getConfiguration('kiro-automation');
    const level = config.get<string>('logLevel', 'info');
    this.currentLogLevel = level as LogLevel;
  }

  /**
   * Log a message
   */
  public log(level: LogLevel, message: string, context?: string): void {
    if (!this.shouldLog(level)) {
      return;
    }

    const entry: LogEntry = {
      timestamp: new Date(),
      level,
      message,
      context
    };

    this.logEntries.push(entry);

    // Trim log entries if exceeding max
    if (this.logEntries.length > this.maxLogEntries) {
      this.logEntries = this.logEntries.slice(-this.maxLogEntries);
    }

    // Write to output channel
    this.writeToOutputChannel(entry);

    // Write to file if enabled
    if (this.logFilePath) {
      this.writeToFile(entry);
    }
  }

  /**
   * Check if a log level should be logged
   */
  private shouldLog(level: LogLevel): boolean {
    const levels = [LogLevel.DEBUG, LogLevel.INFO, LogLevel.WARNING, LogLevel.ERROR];
    const currentIndex = levels.indexOf(this.currentLogLevel);
    const messageIndex = levels.indexOf(level);
    return messageIndex >= currentIndex;
  }

  /**
   * Write log entry to output channel
   */
  private writeToOutputChannel(entry: LogEntry): void {
    const timestamp = entry.timestamp.toISOString();
    const levelStr = entry.level.toUpperCase().padEnd(7);
    const contextStr = entry.context ? `[${entry.context}] ` : '';
    const line = `${timestamp} ${levelStr} ${contextStr}${entry.message}`;
    
    this.outputChannel.appendLine(line);
  }

  /**
   * Write log entry to file
   */
  private writeToFile(entry: LogEntry): void {
    if (!this.logFilePath) {
      return;
    }

    try {
      const timestamp = entry.timestamp.toISOString();
      const levelStr = entry.level.toUpperCase().padEnd(7);
      const contextStr = entry.context ? `[${entry.context}] ` : '';
      const line = `${timestamp} ${levelStr} ${contextStr}${entry.message}\n`;
      
      fs.appendFileSync(this.logFilePath, line, 'utf8');

      // Check file size and rotate if needed
      this.checkAndRotateLog();
    } catch (error) {
      console.error('Failed to write to log file:', error);
    }
  }

  /**
   * Check log file size and rotate if needed
   */
  private checkAndRotateLog(): void {
    if (!this.logFilePath) {
      return;
    }

    try {
      const config = vscode.workspace.getConfiguration('kiro-automation');
      const maxSizeMB = config.get<number>('maxLogFileSize', 10);
      const maxSizeBytes = maxSizeMB * 1024 * 1024;

      const stats = fs.statSync(this.logFilePath);
      if (stats.size > maxSizeBytes) {
        // Rotate log file
        const rotatedPath = this.logFilePath.replace('.log', '-rotated.log');
        fs.renameSync(this.logFilePath, rotatedPath);
        
        // Create new log file
        this.initializeLogFile();
        this.log(LogLevel.INFO, 'Log file rotated due to size limit');
      }
    } catch (error) {
      console.error('Failed to check/rotate log file:', error);
    }
  }

  /**
   * Convenience methods for different log levels
   */
  public debug(message: string, context?: string): void {
    this.log(LogLevel.DEBUG, message, context);
  }

  public info(message: string, context?: string): void {
    this.log(LogLevel.INFO, message, context);
  }

  public warning(message: string, context?: string): void {
    this.log(LogLevel.WARNING, message, context);
  }

  public error(message: string, context?: string): void {
    this.log(LogLevel.ERROR, message, context);
  }

  /**
   * Show the output channel
   */
  public show(): void {
    this.outputChannel.show();
  }

  /**
   * Clear all logs
   */
  public clear(): void {
    this.logEntries = [];
    this.outputChannel.clear();
  }

  /**
   * Get filtered log entries
   */
  public getFilteredLogs(level?: LogLevel, searchTerm?: string): LogEntry[] {
    let filtered = this.logEntries;

    if (level) {
      filtered = filtered.filter(entry => entry.level === level);
    }

    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(entry => 
        entry.message.toLowerCase().includes(term) ||
        (entry.context && entry.context.toLowerCase().includes(term))
      );
    }

    return filtered;
  }

  /**
   * Export logs to a file
   */
  public async exportLogs(format: 'txt' | 'json' | 'csv' = 'txt'): Promise<void> {
    const uri = await vscode.window.showSaveDialog({
      defaultUri: vscode.Uri.file(`kiro-automation-logs.${format}`),
      filters: {
        'Text files': ['txt'],
        'JSON files': ['json'],
        'CSV files': ['csv']
      }
    });

    if (!uri) {
      return;
    }

    try {
      let content: string;

      switch (format) {
        case 'json':
          content = JSON.stringify(this.logEntries, null, 2);
          break;
        case 'csv':
          content = this.exportToCsv();
          break;
        case 'txt':
        default:
          content = this.exportToText();
          break;
      }

      fs.writeFileSync(uri.fsPath, content, 'utf8');
      vscode.window.showInformationMessage(`Logs exported to ${uri.fsPath}`);
    } catch (error) {
      vscode.window.showErrorMessage(`Failed to export logs: ${error}`);
    }
  }

  /**
   * Export logs to text format
   */
  private exportToText(): string {
    return this.logEntries.map(entry => {
      const timestamp = entry.timestamp.toISOString();
      const levelStr = entry.level.toUpperCase().padEnd(7);
      const contextStr = entry.context ? `[${entry.context}] ` : '';
      return `${timestamp} ${levelStr} ${contextStr}${entry.message}`;
    }).join('\n');
  }

  /**
   * Export logs to CSV format
   */
  private exportToCsv(): string {
    const header = 'Timestamp,Level,Context,Message\n';
    const rows = this.logEntries.map(entry => {
      const timestamp = entry.timestamp.toISOString();
      const context = entry.context || '';
      const message = entry.message.replace(/"/g, '""'); // Escape quotes
      return `"${timestamp}","${entry.level}","${context}","${message}"`;
    }).join('\n');
    
    return header + rows;
  }

  /**
   * Get log file path
   */
  public getLogFilePath(): string | null {
    return this.logFilePath;
  }

  /**
   * Open log file in editor
   */
  public async openLogFile(): Promise<void> {
    if (!this.logFilePath) {
      vscode.window.showWarningMessage('Log file is not enabled. Enable it in settings.');
      return;
    }

    if (!fs.existsSync(this.logFilePath)) {
      vscode.window.showWarningMessage('Log file does not exist yet.');
      return;
    }

    const document = await vscode.workspace.openTextDocument(this.logFilePath);
    await vscode.window.showTextDocument(document);
  }

  /**
   * Dispose of resources
   */
  public dispose(): void {
    this.outputChannel.dispose();
  }
}
