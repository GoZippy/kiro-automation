import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';

/**
 * Audit event types
 */
export enum AuditEventType {
  FILE_READ = 'file_read',
  FILE_WRITE = 'file_write',
  FILE_DELETE = 'file_delete',
  FILE_CREATE = 'file_create',
  TASK_STATUS_CHANGE = 'task_status_change',
  AUTOMATION_START = 'automation_start',
  AUTOMATION_STOP = 'automation_stop',
  AUTOMATION_PAUSE = 'automation_pause',
  AUTOMATION_RESUME = 'automation_resume',
  CONFIGURATION_CHANGE = 'configuration_change',
  PERMISSION_DENIED = 'permission_denied',
  ERROR = 'error',
  SECURITY_VIOLATION = 'security_violation',
}

/**
 * Audit event interface
 */
export interface AuditEvent {
  /** Unique event ID */
  id: string;

  /** Event type */
  type: AuditEventType;

  /** Timestamp of the event */
  timestamp: Date;

  /** User or actor performing the action */
  actor: string;

  /** Resource affected by the action */
  resource?: string;

  /** Action performed */
  action: string;

  /** Result of the action (success, failure, etc.) */
  result: 'success' | 'failure' | 'denied';

  /** Additional details about the event */
  details?: any;

  /** Session ID if applicable */
  sessionId?: string;

  /** IP address or machine identifier */
  source?: string;
}

/**
 * AuditLogger class
 * Provides comprehensive audit logging for security and compliance
 */
export class AuditLogger {
  private logFilePath: string;
  private outputChannel: vscode.OutputChannel;
  private eventBuffer: AuditEvent[] = [];
  private readonly BUFFER_SIZE = 10;
  private readonly MAX_LOG_SIZE = 10 * 1024 * 1024; // 10 MB
  private machineId: string;

  constructor(workspaceRoot: string, outputChannel: vscode.OutputChannel) {
    this.logFilePath = path.join(workspaceRoot, '.kiro', 'logs', 'audit.log');
    this.outputChannel = outputChannel;
    this.machineId = this.getMachineId();
    this.ensureLogDirectory();
  }

  /**
   * Gets a machine identifier
   * @returns Machine ID
   */
  private getMachineId(): string {
    try {
      // Use VS Code's machine ID if available
      return vscode.env.machineId || 'unknown';
    } catch {
      return 'unknown';
    }
  }

  /**
   * Ensures the log directory exists
   */
  private ensureLogDirectory(): void {
    const logDir = path.dirname(this.logFilePath);
    if (!fs.existsSync(logDir)) {
      fs.mkdirSync(logDir, { recursive: true });
    }
  }

  /**
   * Generates a unique event ID
   * @returns Unique ID
   */
  private generateEventId(): string {
    return `${Date.now()}-${Math.random().toString(36).substring(2, 15)}`;
  }

  /**
   * Logs a file read operation
   * @param filePath Path to the file
   * @param success Whether the operation was successful
   * @param sessionId Optional session ID
   */
  async logFileRead(filePath: string, success: boolean, sessionId?: string): Promise<void> {
    await this.logEvent({
      id: this.generateEventId(),
      type: AuditEventType.FILE_READ,
      timestamp: new Date(),
      actor: this.machineId,
      resource: filePath,
      action: 'read file',
      result: success ? 'success' : 'failure',
      sessionId,
      source: this.machineId,
    });
  }

  /**
   * Logs a file write operation
   * @param filePath Path to the file
   * @param success Whether the operation was successful
   * @param details Additional details about the write operation
   * @param sessionId Optional session ID
   */
  async logFileWrite(
    filePath: string,
    success: boolean,
    details?: any,
    sessionId?: string
  ): Promise<void> {
    await this.logEvent({
      id: this.generateEventId(),
      type: AuditEventType.FILE_WRITE,
      timestamp: new Date(),
      actor: this.machineId,
      resource: filePath,
      action: 'write file',
      result: success ? 'success' : 'failure',
      details,
      sessionId,
      source: this.machineId,
    });
  }

  /**
   * Logs a file delete operation
   * @param filePath Path to the file
   * @param success Whether the operation was successful
   * @param sessionId Optional session ID
   */
  async logFileDelete(filePath: string, success: boolean, sessionId?: string): Promise<void> {
    await this.logEvent({
      id: this.generateEventId(),
      type: AuditEventType.FILE_DELETE,
      timestamp: new Date(),
      actor: this.machineId,
      resource: filePath,
      action: 'delete file',
      result: success ? 'success' : 'failure',
      sessionId,
      source: this.machineId,
    });
  }

  /**
   * Logs a file create operation
   * @param filePath Path to the file
   * @param success Whether the operation was successful
   * @param sessionId Optional session ID
   */
  async logFileCreate(filePath: string, success: boolean, sessionId?: string): Promise<void> {
    await this.logEvent({
      id: this.generateEventId(),
      type: AuditEventType.FILE_CREATE,
      timestamp: new Date(),
      actor: this.machineId,
      resource: filePath,
      action: 'create file',
      result: success ? 'success' : 'failure',
      sessionId,
      source: this.machineId,
    });
  }

  /**
   * Logs a task status change
   * @param taskId Task ID
   * @param oldStatus Old status
   * @param newStatus New status
   * @param sessionId Optional session ID
   */
  async logTaskStatusChange(
    taskId: string,
    oldStatus: string,
    newStatus: string,
    sessionId?: string
  ): Promise<void> {
    await this.logEvent({
      id: this.generateEventId(),
      type: AuditEventType.TASK_STATUS_CHANGE,
      timestamp: new Date(),
      actor: this.machineId,
      resource: `task:${taskId}`,
      action: 'change task status',
      result: 'success',
      details: {
        oldStatus,
        newStatus,
      },
      sessionId,
      source: this.machineId,
    });
  }

  /**
   * Logs automation start
   * @param sessionId Session ID
   * @param details Additional details
   */
  async logAutomationStart(sessionId: string, details?: any): Promise<void> {
    await this.logEvent({
      id: this.generateEventId(),
      type: AuditEventType.AUTOMATION_START,
      timestamp: new Date(),
      actor: this.machineId,
      action: 'start automation',
      result: 'success',
      details,
      sessionId,
      source: this.machineId,
    });
  }

  /**
   * Logs automation stop
   * @param sessionId Session ID
   * @param details Additional details
   */
  async logAutomationStop(sessionId: string, details?: any): Promise<void> {
    await this.logEvent({
      id: this.generateEventId(),
      type: AuditEventType.AUTOMATION_STOP,
      timestamp: new Date(),
      actor: this.machineId,
      action: 'stop automation',
      result: 'success',
      details,
      sessionId,
      source: this.machineId,
    });
  }

  /**
   * Logs automation pause
   * @param sessionId Session ID
   * @param details Additional details
   */
  async logAutomationPause(sessionId: string, details?: any): Promise<void> {
    await this.logEvent({
      id: this.generateEventId(),
      type: AuditEventType.AUTOMATION_PAUSE,
      timestamp: new Date(),
      actor: this.machineId,
      action: 'pause automation',
      result: 'success',
      details,
      sessionId,
      source: this.machineId,
    });
  }

  /**
   * Logs automation resume
   * @param sessionId Session ID
   * @param details Additional details
   */
  async logAutomationResume(sessionId: string, details?: any): Promise<void> {
    await this.logEvent({
      id: this.generateEventId(),
      type: AuditEventType.AUTOMATION_RESUME,
      timestamp: new Date(),
      actor: this.machineId,
      action: 'resume automation',
      result: 'success',
      details,
      sessionId,
      source: this.machineId,
    });
  }

  /**
   * Logs a configuration change
   * @param key Configuration key
   * @param oldValue Old value
   * @param newValue New value
   * @param sessionId Optional session ID
   */
  async logConfigurationChange(
    key: string,
    oldValue: any,
    newValue: any,
    sessionId?: string
  ): Promise<void> {
    await this.logEvent({
      id: this.generateEventId(),
      type: AuditEventType.CONFIGURATION_CHANGE,
      timestamp: new Date(),
      actor: this.machineId,
      resource: `config:${key}`,
      action: 'change configuration',
      result: 'success',
      details: {
        key,
        oldValue,
        newValue,
      },
      sessionId,
      source: this.machineId,
    });
  }

  /**
   * Logs a permission denied event
   * @param resource Resource that was denied
   * @param action Action that was attempted
   * @param reason Reason for denial
   * @param sessionId Optional session ID
   */
  async logPermissionDenied(
    resource: string,
    action: string,
    reason: string,
    sessionId?: string
  ): Promise<void> {
    await this.logEvent({
      id: this.generateEventId(),
      type: AuditEventType.PERMISSION_DENIED,
      timestamp: new Date(),
      actor: this.machineId,
      resource,
      action,
      result: 'denied',
      details: { reason },
      sessionId,
      source: this.machineId,
    });
  }

  /**
   * Logs an error event
   * @param error Error object or message
   * @param context Context where the error occurred
   * @param sessionId Optional session ID
   */
  async logError(error: Error | string, context: string, sessionId?: string): Promise<void> {
    const errorMessage = error instanceof Error ? error.message : error;
    const errorStack = error instanceof Error ? error.stack : undefined;

    await this.logEvent({
      id: this.generateEventId(),
      type: AuditEventType.ERROR,
      timestamp: new Date(),
      actor: this.machineId,
      action: context,
      result: 'failure',
      details: {
        message: errorMessage,
        stack: errorStack,
      },
      sessionId,
      source: this.machineId,
    });
  }

  /**
   * Logs a security violation
   * @param violation Description of the violation
   * @param resource Resource involved
   * @param details Additional details
   * @param sessionId Optional session ID
   */
  async logSecurityViolation(
    violation: string,
    resource: string,
    details?: any,
    sessionId?: string
  ): Promise<void> {
    await this.logEvent({
      id: this.generateEventId(),
      type: AuditEventType.SECURITY_VIOLATION,
      timestamp: new Date(),
      actor: this.machineId,
      resource,
      action: 'security violation',
      result: 'denied',
      details: {
        violation,
        ...details,
      },
      sessionId,
      source: this.machineId,
    });

    // Also log to output channel for immediate visibility
    this.outputChannel.appendLine(`[SECURITY VIOLATION] ${violation} - Resource: ${resource}`);
  }

  /**
   * Logs an audit event
   * @param event Audit event to log
   */
  private async logEvent(event: AuditEvent): Promise<void> {
    // Add to buffer
    this.eventBuffer.push(event);

    // Write to output channel
    this.outputChannel.appendLine(this.formatEventForDisplay(event));

    // Flush buffer if it reaches the size limit
    if (this.eventBuffer.length >= this.BUFFER_SIZE) {
      await this.flushBuffer();
    }
  }

  /**
   * Formats an event for display in the output channel
   * @param event Audit event
   * @returns Formatted string
   */
  private formatEventForDisplay(event: AuditEvent): string {
    const timestamp = event.timestamp.toISOString();
    const type = event.type.toUpperCase();
    const result = event.result.toUpperCase();
    const resource = event.resource ? ` | Resource: ${event.resource}` : '';
    const details = event.details ? ` | Details: ${JSON.stringify(event.details)}` : '';

    return `[${timestamp}] [${type}] [${result}] ${event.action}${resource}${details}`;
  }

  /**
   * Formats an event for file logging (JSON format)
   * @param event Audit event
   * @returns JSON string
   */
  private formatEventForFile(event: AuditEvent): string {
    return JSON.stringify(event);
  }

  /**
   * Flushes the event buffer to the log file
   */
  async flushBuffer(): Promise<void> {
    if (this.eventBuffer.length === 0) {
      return;
    }

    try {
      // Check log file size and rotate if necessary
      await this.rotateLogIfNeeded();

      // Format events as JSON lines
      const logLines = this.eventBuffer.map((event) => this.formatEventForFile(event)).join('\n') + '\n';

      // Append to log file
      await fs.promises.appendFile(this.logFilePath, logLines, 'utf8');

      // Clear buffer
      this.eventBuffer = [];
    } catch (error) {
      console.error('Error flushing audit log buffer:', error);
      this.outputChannel.appendLine(`[ERROR] Failed to write audit log: ${error}`);
    }
  }

  /**
   * Rotates the log file if it exceeds the maximum size
   */
  private async rotateLogIfNeeded(): Promise<void> {
    try {
      // Check if log file exists
      const fileExists = await this.fileExists(this.logFilePath);
      if (!fileExists) {
        return;
      }

      // Get file size
      const stats = await fs.promises.stat(this.logFilePath);
      if (stats.size < this.MAX_LOG_SIZE) {
        return;
      }

      // Rotate log file
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const rotatedPath = this.logFilePath.replace('.log', `.${timestamp}.log`);

      await fs.promises.rename(this.logFilePath, rotatedPath);

      this.outputChannel.appendLine(`[INFO] Rotated audit log to ${rotatedPath}`);
    } catch (error) {
      console.error('Error rotating audit log:', error);
    }
  }

  /**
   * Checks if a file exists
   * @param filePath Path to the file
   * @returns True if file exists
   */
  private async fileExists(filePath: string): Promise<boolean> {
    try {
      await fs.promises.access(filePath, fs.constants.F_OK);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Queries audit events by criteria
   * @param criteria Query criteria
   * @returns Array of matching events
   */
  async queryEvents(criteria: {
    type?: AuditEventType;
    startDate?: Date;
    endDate?: Date;
    actor?: string;
    resource?: string;
    sessionId?: string;
    result?: 'success' | 'failure' | 'denied';
  }): Promise<AuditEvent[]> {
    try {
      // Read log file
      const content = await fs.promises.readFile(this.logFilePath, 'utf8');
      const lines = content.split('\n').filter((line) => line.trim() !== '');

      // Parse events
      const events: AuditEvent[] = [];
      for (const line of lines) {
        try {
          const event = JSON.parse(line) as AuditEvent;
          // Convert timestamp string back to Date
          event.timestamp = new Date(event.timestamp);
          events.push(event);
        } catch {
          // Skip invalid lines
        }
      }

      // Filter events by criteria
      return events.filter((event) => {
        if (criteria.type && event.type !== criteria.type) {
          return false;
        }
        if (criteria.startDate && event.timestamp < criteria.startDate) {
          return false;
        }
        if (criteria.endDate && event.timestamp > criteria.endDate) {
          return false;
        }
        if (criteria.actor && event.actor !== criteria.actor) {
          return false;
        }
        if (criteria.resource && event.resource !== criteria.resource) {
          return false;
        }
        if (criteria.sessionId && event.sessionId !== criteria.sessionId) {
          return false;
        }
        if (criteria.result && event.result !== criteria.result) {
          return false;
        }
        return true;
      });
    } catch (error) {
      console.error('Error querying audit events:', error);
      return [];
    }
  }

  /**
   * Generates an audit report for a session
   * @param sessionId Session ID
   * @returns Audit report
   */
  async generateSessionReport(sessionId: string): Promise<{
    sessionId: string;
    startTime?: Date;
    endTime?: Date;
    totalEvents: number;
    eventsByType: { [key: string]: number };
    fileModifications: string[];
    errors: number;
    securityViolations: number;
  }> {
    const events = await this.queryEvents({ sessionId });

    const report = {
      sessionId,
      startTime: events.length > 0 ? events[0].timestamp : undefined,
      endTime: events.length > 0 ? events[events.length - 1].timestamp : undefined,
      totalEvents: events.length,
      eventsByType: {} as { [key: string]: number },
      fileModifications: [] as string[],
      errors: 0,
      securityViolations: 0,
    };

    // Count events by type
    for (const event of events) {
      report.eventsByType[event.type] = (report.eventsByType[event.type] || 0) + 1;

      // Track file modifications
      if (
        event.resource &&
        (event.type === AuditEventType.FILE_WRITE ||
          event.type === AuditEventType.FILE_DELETE ||
          event.type === AuditEventType.FILE_CREATE)
      ) {
        if (!report.fileModifications.includes(event.resource)) {
          report.fileModifications.push(event.resource);
        }
      }

      // Count errors
      if (event.type === AuditEventType.ERROR) {
        report.errors++;
      }

      // Count security violations
      if (event.type === AuditEventType.SECURITY_VIOLATION) {
        report.securityViolations++;
      }
    }

    return report;
  }

  /**
   * Exports audit log to a file
   * @param outputPath Path to export to
   * @param format Export format (json or csv)
   */
  async exportLog(outputPath: string, format: 'json' | 'csv' = 'json'): Promise<void> {
    try {
      const events = await this.queryEvents({});

      if (format === 'json') {
        await fs.promises.writeFile(outputPath, JSON.stringify(events, null, 2), 'utf8');
      } else if (format === 'csv') {
        const csvLines = ['ID,Type,Timestamp,Actor,Resource,Action,Result,SessionID'];

        for (const event of events) {
          const line = [
            event.id,
            event.type,
            event.timestamp.toISOString(),
            event.actor,
            event.resource || '',
            event.action,
            event.result,
            event.sessionId || '',
          ]
            .map((field) => `"${field}"`)
            .join(',');
          csvLines.push(line);
        }

        await fs.promises.writeFile(outputPath, csvLines.join('\n'), 'utf8');
      }

      this.outputChannel.appendLine(`[INFO] Exported audit log to ${outputPath}`);
    } catch (error) {
      console.error('Error exporting audit log:', error);
      throw error;
    }
  }

  /**
   * Cleans up resources and flushes remaining events
   */
  async dispose(): Promise<void> {
    await this.flushBuffer();
  }
}
