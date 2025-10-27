import * as vscode from 'vscode';
import { ConfigManager } from './ConfigManager';
import { Logger } from './Logger';

/**
 * Notification level enum
 */
export enum NotificationLevel {
  INFO = 'info',
  WARNING = 'warning',
  ERROR = 'error',
  SUCCESS = 'success',
}

/**
 * Notification options
 */
export interface NotificationOptions {
  /** Whether to show a modal dialog */
  modal?: boolean;
  
  /** Action buttons to display */
  actions?: NotificationAction[];
  
  /** Whether to log the notification */
  log?: boolean;
  
  /** Context data for logging */
  context?: Record<string, any>;
  
  /** Correlation ID for tracking */
  correlationId?: string;
}

/**
 * Notification action button
 */
export interface NotificationAction {
  /** Button label */
  label: string;
  
  /** Callback when button is clicked */
  callback: () => void | Promise<void>;
  
  /** Whether this is the primary action */
  primary?: boolean;
}

/**
 * Notification template
 */
export interface NotificationTemplate {
  /** Template name */
  name: string;
  
  /** Message template with placeholders */
  message: string;
  
  /** Default notification level */
  level: NotificationLevel;
  
  /** Default actions */
  actions?: NotificationAction[];
}

/**
 * Notification history entry
 */
export interface NotificationHistoryEntry {
  /** Timestamp */
  timestamp: Date;
  
  /** Notification level */
  level: NotificationLevel;
  
  /** Message */
  message: string;
  
  /** Context data */
  context?: Record<string, any>;
  
  /** Correlation ID */
  correlationId?: string;
  
  /** User action taken */
  action?: string;
}

/**
 * NotificationService class
 * Manages user notifications with configurable levels and templates
 */
export class NotificationService {
  private static instance: NotificationService;
  private configManager: ConfigManager;
  private logger: Logger;
  private templates: Map<string, NotificationTemplate> = new Map();
  private history: NotificationHistoryEntry[] = [];
  private maxHistorySize: number = 100;

  // Make constructor public and optional to support test instantiation
  public constructor(configManager?: ConfigManager, logger?: Logger) {
    this.configManager = configManager || new ConfigManager();
    this.logger = logger || Logger.getInstance();
    this.initializeDefaultTemplates();
  }

  /**
   * Get the singleton instance of NotificationService
   */
  public static getInstance(configManager: ConfigManager, logger: Logger): NotificationService {
    if (!NotificationService.instance) {
      NotificationService.instance = new NotificationService(configManager, logger);
    }
    return NotificationService.instance;
  }

  /**
   * Initialize default notification templates
   */
  private initializeDefaultTemplates(): void {
    // Automation lifecycle templates
    this.registerTemplate({
      name: 'automation.started',
      message: 'Automation started with {taskCount} tasks',
      level: NotificationLevel.INFO,
    });

    this.registerTemplate({
      name: 'automation.completed',
      message: 'Automation completed successfully! {completedCount} tasks completed',
      level: NotificationLevel.SUCCESS,
    });

    this.registerTemplate({
      name: 'automation.failed',
      message: 'Automation failed: {error}',
      level: NotificationLevel.ERROR,
    });

    this.registerTemplate({
      name: 'automation.paused',
      message: 'Automation paused at task: {taskTitle}',
      level: NotificationLevel.INFO,
    });

    this.registerTemplate({
      name: 'automation.resumed',
      message: 'Automation resumed from task: {taskTitle}',
      level: NotificationLevel.INFO,
    });

    this.registerTemplate({
      name: 'automation.stopped',
      message: 'Automation stopped by user',
      level: NotificationLevel.WARNING,
    });

    // Task execution templates
    this.registerTemplate({
      name: 'task.started',
      message: 'Started task: {taskTitle}',
      level: NotificationLevel.INFO,
    });

    this.registerTemplate({
      name: 'task.completed',
      message: 'Completed task: {taskTitle}',
      level: NotificationLevel.SUCCESS,
    });

    this.registerTemplate({
      name: 'task.failed',
      message: 'Task failed: {taskTitle} - {error}',
      level: NotificationLevel.ERROR,
    });

    this.registerTemplate({
      name: 'task.skipped',
      message: 'Skipped task: {taskTitle}',
      level: NotificationLevel.INFO,
    });

    this.registerTemplate({
      name: 'task.retrying',
      message: 'Retrying task: {taskTitle} (attempt {attempt}/{maxAttempts})',
      level: NotificationLevel.WARNING,
    });

    // Error templates
    this.registerTemplate({
      name: 'error.connection',
      message: 'Connection error: {error}',
      level: NotificationLevel.ERROR,
    });

    this.registerTemplate({
      name: 'error.timeout',
      message: 'Task timeout: {taskTitle}',
      level: NotificationLevel.ERROR,
    });

    this.registerTemplate({
      name: 'error.validation',
      message: 'Validation error: {error}',
      level: NotificationLevel.ERROR,
    });

    this.registerTemplate({
      name: 'error.intervention',
      message: 'User intervention required: {reason}',
      level: NotificationLevel.ERROR,
    });

    // Session templates
    this.registerTemplate({
      name: 'session.recovered',
      message: 'Previous session recovered. Resume automation?',
      level: NotificationLevel.INFO,
    });

    this.registerTemplate({
      name: 'session.saved',
      message: 'Session progress saved',
      level: NotificationLevel.INFO,
    });
  }

  /**
   * Register a notification template
   */
  public registerTemplate(template: NotificationTemplate): void {
    this.templates.set(template.name, template);
    this.logger.debug(`Registered notification template: ${template.name}`);
  }

  /**
   * Get a notification template
   */
  public getTemplate(name: string): NotificationTemplate | undefined {
    return this.templates.get(name);
  }

  /**
   * Check if notifications are enabled
   */
  private areNotificationsEnabled(): boolean {
    return this.configManager.get('notifications', true);
  }

  /**
   * Get the configured notification level
   */
  private getConfiguredNotificationLevel(): string {
    return this.configManager.get('notificationLevel', 'all');
  }

  /**
   * Check if a notification should be shown based on configuration
   */
  private shouldShowNotification(level: NotificationLevel): boolean {
    if (!this.areNotificationsEnabled()) {
      return false;
    }

    const configLevel = this.getConfiguredNotificationLevel();

    switch (configLevel) {
      case 'none':
        return false;
      case 'errors':
        return level === NotificationLevel.ERROR;
      case 'all':
      default:
        return true;
    }
  }

  /**
   * Show an info notification
   */
  public async info(message: string, options?: NotificationOptions): Promise<string | undefined> {
    return this.showNotification(NotificationLevel.INFO, message, options);
  }

  /**
   * Show a warning notification
   */
  public async warning(message: string, options?: NotificationOptions): Promise<string | undefined> {
    return this.showNotification(NotificationLevel.WARNING, message, options);
  }

  /**
   * Alias for compatibility: showWarning
   */
  public async showWarning(message: string, options?: NotificationOptions): Promise<string | undefined> {
    return this.warning(message, options);
  }

  /**
   * Show an error notification
   */
  public async error(message: string, options?: NotificationOptions): Promise<string | undefined> {
    return this.showNotification(NotificationLevel.ERROR, message, options);
  }

  /**
   * Show a success notification
   */
  public async success(message: string, options?: NotificationOptions): Promise<string | undefined> {
    return this.showNotification(NotificationLevel.SUCCESS, message, options);
  }

  /**
   * Show a notification using a template
   */
  public async showFromTemplate(
    templateName: string,
    variables: Record<string, any>,
    options?: NotificationOptions
  ): Promise<string | undefined> {
    const template = this.templates.get(templateName);
    
    if (!template) {
      this.logger.warning(`Notification template not found: ${templateName}`);
      return undefined;
    }

    // Replace variables in message
    let message = template.message;
    for (const [key, value] of Object.entries(variables)) {
      message = message.replace(new RegExp(`\\{${key}\\}`, 'g'), String(value));
    }

    // Merge template actions with provided options
    const mergedOptions: NotificationOptions = {
      ...options,
      actions: [...(template.actions || []), ...(options?.actions || [])],
    };

    return this.showNotification(template.level, message, mergedOptions);
  }

  /**
   * Show a notification
   */
  private async showNotification(
    level: NotificationLevel,
    message: string,
    options?: NotificationOptions
  ): Promise<string | undefined> {
    // Add to history
    this.addToHistory({
      timestamp: new Date(),
      level,
      message,
      context: options?.context,
      correlationId: options?.correlationId,
    });

    // Log if requested
    if (options?.log !== false) {
      this.logNotification(level, message, options?.context, options?.correlationId);
    }

    // Check if notification should be shown
    if (!this.shouldShowNotification(level)) {
      return undefined;
    }

    // Prepare action labels
    const actionLabels = options?.actions?.map((action) => action.label) || [];

    // Show notification based on level
    let result: string | undefined;

    try {
      if (options?.modal) {
        result = await this.showModalNotification(level, message, actionLabels);
      } else {
        result = await this.showToastNotification(level, message, actionLabels);
      }

      // Execute action callback if an action was selected
      if (result && options?.actions) {
        const action = options.actions.find((a) => a.label === result);
        if (action) {
          await action.callback();
          
          // Update history with action taken
          const lastEntry = this.history[this.history.length - 1];
          if (lastEntry) {
            lastEntry.action = result;
          }
        }
      }

      return result;
    } catch (error) {
      this.logger.error(`Failed to show notification: ${error}`, {
        level,
        message,
        error: String(error),
      });
      return undefined;
    }
  }

  /**
   * Show a toast notification
   */
  private async showToastNotification(
    level: NotificationLevel,
    message: string,
    actions: string[]
  ): Promise<string | undefined> {
    switch (level) {
      case NotificationLevel.INFO:
        return vscode.window.showInformationMessage(message, ...actions);
      case NotificationLevel.WARNING:
        return vscode.window.showWarningMessage(message, ...actions);
      case NotificationLevel.ERROR:
        return vscode.window.showErrorMessage(message, ...actions);
      case NotificationLevel.SUCCESS:
        // VS Code doesn't have a success notification, use info with success icon
        return vscode.window.showInformationMessage(`✓ ${message}`, ...actions);
      default:
        return vscode.window.showInformationMessage(message, ...actions);
    }
  }

  /**
   * Show a modal notification
   */
  private async showModalNotification(
    level: NotificationLevel,
    message: string,
    actions: string[]
  ): Promise<string | undefined> {
    const options: vscode.MessageOptions = { modal: true };

    switch (level) {
      case NotificationLevel.INFO:
        return vscode.window.showInformationMessage(message, options, ...actions);
      case NotificationLevel.WARNING:
        return vscode.window.showWarningMessage(message, options, ...actions);
      case NotificationLevel.ERROR:
        return vscode.window.showErrorMessage(message, options, ...actions);
      case NotificationLevel.SUCCESS:
        return vscode.window.showInformationMessage(`✓ ${message}`, options, ...actions);
      default:
        return vscode.window.showInformationMessage(message, options, ...actions);
    }
  }

  /**
   * Log a notification
   */
  private logNotification(
    level: NotificationLevel,
    message: string,
    context?: Record<string, any>,
    correlationId?: string
  ): void {
    const logContext = {
      ...context,
      notificationLevel: level,
    };

    switch (level) {
      case NotificationLevel.ERROR:
        this.logger.error(`[Notification] ${message}`, logContext, correlationId);
        break;
      case NotificationLevel.WARNING:
        this.logger.warning(`[Notification] ${message}`, logContext, correlationId);
        break;
      case NotificationLevel.INFO:
      case NotificationLevel.SUCCESS:
      default:
        this.logger.info(`[Notification] ${message}`, logContext, correlationId);
        break;
    }
  }

  /**
   * Add notification to history
   */
  private addToHistory(entry: NotificationHistoryEntry): void {
    this.history.push(entry);

    // Trim history if it exceeds max size
    if (this.history.length > this.maxHistorySize) {
      this.history = this.history.slice(-this.maxHistorySize);
    }
  }

  /**
   * Get notification history
   */
  public getHistory(): NotificationHistoryEntry[] {
    return [...this.history];
  }

  /**
   * Get notification history filtered by level
   */
  public getHistoryByLevel(level: NotificationLevel): NotificationHistoryEntry[] {
    return this.history.filter((entry) => entry.level === level);
  }

  /**
   * Get notification history filtered by correlation ID
   */
  public getHistoryByCorrelationId(correlationId: string): NotificationHistoryEntry[] {
    return this.history.filter((entry) => entry.correlationId === correlationId);
  }

  /**
   * Clear notification history
   */
  public clearHistory(): void {
    this.history = [];
    this.logger.info('Notification history cleared');
  }

  /**
   * Export notification history as JSON
   */
  public exportHistory(): string {
    return JSON.stringify(
      this.history.map((entry) => ({
        timestamp: entry.timestamp.toISOString(),
        level: entry.level,
        message: entry.message,
        context: entry.context,
        correlationId: entry.correlationId,
        action: entry.action,
      })),
      null,
      2
    );
  }

  /**
   * Show a progress notification
   */
  public async showProgress<T>(
    title: string,
    task: (progress: vscode.Progress<{ message?: string; increment?: number }>) => Promise<T>,
    options?: { location?: vscode.ProgressLocation; cancellable?: boolean }
  ): Promise<T> {
    return vscode.window.withProgress(
      {
        location: options?.location || vscode.ProgressLocation.Notification,
        title,
        cancellable: options?.cancellable || false,
      },
      task
    );
  }

  /**
   * Show a quick pick notification
   */
  public async showQuickPick(
    items: string[],
    options?: vscode.QuickPickOptions
  ): Promise<string | undefined> {
    return vscode.window.showQuickPick(items, options);
  }

  /**
   * Show an input box notification
   */
  public async showInputBox(options?: vscode.InputBoxOptions): Promise<string | undefined> {
    return vscode.window.showInputBox(options);
  }

  /**
   * Get notification statistics
   */
  public getStatistics(): {
    total: number;
    byLevel: Record<NotificationLevel, number>;
    withActions: number;
    recentCount: number;
  } {
    const byLevel: Record<NotificationLevel, number> = {
      [NotificationLevel.INFO]: 0,
      [NotificationLevel.WARNING]: 0,
      [NotificationLevel.ERROR]: 0,
      [NotificationLevel.SUCCESS]: 0,
    };

    let withActions = 0;
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    let recentCount = 0;

    for (const entry of this.history) {
      byLevel[entry.level]++;
      
      if (entry.action) {
        withActions++;
      }
      
      if (entry.timestamp > oneHourAgo) {
        recentCount++;
      }
    }

    return {
      total: this.history.length,
      byLevel,
      withActions,
      recentCount,
    };
  }

  /**
   * Set maximum history size
   */
  public setMaxHistorySize(size: number): void {
    this.maxHistorySize = size;
    
    // Trim history if needed
    if (this.history.length > this.maxHistorySize) {
      this.history = this.history.slice(-this.maxHistorySize);
    }
    
    this.logger.info(`Notification history max size set to ${size}`);
  }

  /**
   * Dispose of resources
   */
  public dispose(): void {
    this.clearHistory();
    this.templates.clear();
  }
}
