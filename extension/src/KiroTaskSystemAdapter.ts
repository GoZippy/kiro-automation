import * as vscode from 'vscode';
import { Task, TaskStatus } from './models/Task';
import { KiroInterface } from './KiroInterface';
import { Logger } from './Logger';

/**
 * Kiro task system API interface
 * Represents Kiro's native task management capabilities
 */
export interface KiroTaskSystemAPI {
  /** Update task status in Kiro's system */
  updateTaskStatus?(taskId: string, status: string): Promise<void>;

  /** Get task information from Kiro */
  getTask?(taskId: string): Promise<any>;

  /** Register task change listener */
  onTaskChanged?(callback: (taskId: string, status: string) => void): vscode.Disposable;

  /** Check if task system is available */
  isAvailable?(): boolean;
}

/**
 * Task format compatibility checker
 */
export interface TaskFormatCompatibility {
  /** Whether the task format is compatible */
  isCompatible: boolean;

  /** Kiro's expected format version */
  expectedFormat?: string;

  /** Current format version */
  currentFormat?: string;

  /** Issues found */
  issues: string[];

  /** Suggestions for fixes */
  suggestions: string[];
}

/**
 * Kiro Task System Adapter
 * Integrates with Kiro's native task management system
 * Ensures compatibility with Kiro's task format and conventions
 */
export class KiroTaskSystemAdapter {
  private logger: Logger;
  private taskSystemAPI?: KiroTaskSystemAPI;
  private isIntegrated: boolean = false;
  private manualExecutionMode: boolean = false;
  private disposables: vscode.Disposable[] = [];

  constructor(_kiroInterface: KiroInterface, logger: Logger) {
    this.logger = logger;
  }

  /**
   * Initializes integration with Kiro's task system
   * @returns Whether integration was successful
   */
  async initialize(): Promise<boolean> {
    try {
      this.logger.info('Initializing Kiro task system integration', {
        component: 'KiroTaskSystemAdapter',
      });

      // Discover Kiro's task system API
      const discovered = await this.discoverTaskSystemAPI();

      if (discovered) {
        this.isIntegrated = true;
        this.logger.info('Successfully integrated with Kiro task system', {
          component: 'KiroTaskSystemAdapter',
        });
      } else {
        this.logger.warning('Kiro task system API not available, using fallback mode', {
          component: 'KiroTaskSystemAdapter',
        });
      }

      return this.isIntegrated;
    } catch (error) {
      this.logger.error('Failed to initialize Kiro task system integration', {
        component: 'KiroTaskSystemAdapter',
        error: (error as Error).message,
      });
      return false;
    }
  }

  /**
   * Updates task status using Kiro's native API if available
   * Falls back to direct file updates if not
   * @param task Task to update
   * @param status New status
   */
  async updateTaskStatus(task: Task, status: TaskStatus): Promise<void> {
    try {
      // Try using Kiro's native API first
      if (this.isIntegrated && this.taskSystemAPI?.updateTaskStatus) {
        await this.taskSystemAPI.updateTaskStatus(task.id, this.mapStatusToKiro(status));
        this.logger.debug('Updated task status via Kiro API', {
          component: 'KiroTaskSystemAdapter',
          taskId: task.id,
          status,
        });
      } else {
        // Fallback to direct file update
        this.logger.debug('Using fallback task status update', {
          component: 'KiroTaskSystemAdapter',
          taskId: task.id,
          status,
        });
        // The TaskManager will handle the file update
      }
    } catch (error) {
      this.logger.error('Failed to update task status', {
        component: 'KiroTaskSystemAdapter',
        taskId: task.id,
        error: (error as Error).message,
      });
      throw error;
    }
  }

  /**
   * Checks if a task format is compatible with Kiro's conventions
   * @param taskFilePath Path to task file
   * @returns Compatibility check result
   */
  async checkTaskFormatCompatibility(taskFilePath: string): Promise<TaskFormatCompatibility> {
    try {
      const document = await vscode.workspace.openTextDocument(taskFilePath);
      const content = document.getText();

      const issues: string[] = [];
      const suggestions: string[] = [];

      // Check for required format elements
      if (!content.includes('# Implementation Plan')) {
        issues.push('Missing "# Implementation Plan" header');
        suggestions.push('Add "# Implementation Plan" as the main header');
      }

      // Check task format: - [ ] or - [x] or - [~]
      const taskPattern = /^-\s+\[([ x~])\]\s+\d+\./gm;
      const tasks = content.match(taskPattern);

      if (!tasks || tasks.length === 0) {
        issues.push('No tasks found in expected format');
        suggestions.push('Use format: - [ ] 1. Task title');
      }

      // Check for requirements references
      const requirementPattern = /_Requirements:\s*[\d.,\s]+_/g;
      const hasRequirements = requirementPattern.test(content);

      if (!hasRequirements) {
        issues.push('Tasks missing requirements references');
        suggestions.push('Add requirements references: _Requirements: 1.1, 1.2_');
      }

      // Check for subtask format (validation for future use)
      // const subtaskPattern = /^-\s+\[([ x~])\]\s+\d+\.\d+\s+/gm;

      const result: TaskFormatCompatibility = {
        isCompatible: issues.length === 0,
        expectedFormat: 'Kiro Spec v1.0',
        currentFormat: 'Detected',
        issues,
        suggestions,
      };

      if (!result.isCompatible) {
        this.logger.warning('Task format compatibility issues found', {
          component: 'KiroTaskSystemAdapter',
          taskFilePath,
          issueCount: issues.length,
        });
      }

      return result;
    } catch (error) {
      this.logger.error('Failed to check task format compatibility', {
        component: 'KiroTaskSystemAdapter',
        taskFilePath,
        error: (error as Error).message,
      });

      return {
        isCompatible: false,
        issues: ['Failed to read task file'],
        suggestions: ['Ensure task file exists and is readable'],
      };
    }
  }

  /**
   * Enables manual execution mode
   * In this mode, automation respects manual task execution in Kiro
   */
  enableManualExecutionMode(): void {
    this.manualExecutionMode = true;
    this.logger.info('Manual execution mode enabled', {
      component: 'KiroTaskSystemAdapter',
    });
  }

  /**
   * Disables manual execution mode
   */
  disableManualExecutionMode(): void {
    this.manualExecutionMode = false;
    this.logger.info('Manual execution mode disabled', {
      component: 'KiroTaskSystemAdapter',
    });
  }

  /**
   * Checks if manual execution mode is enabled
   * @returns Whether manual execution mode is active
   */
  isManualExecutionMode(): boolean {
    return this.manualExecutionMode;
  }

  /**
   * Registers a listener for task changes from Kiro
   * @param callback Callback function
   * @returns Disposable to unregister
   */
  onKiroTaskChanged(callback: (taskId: string, status: string) => void): vscode.Disposable {
    if (this.isIntegrated && this.taskSystemAPI?.onTaskChanged) {
      const disposable = this.taskSystemAPI.onTaskChanged(callback);
      this.disposables.push(disposable);
      return disposable;
    }

    // Return empty disposable if not integrated
    return new vscode.Disposable(() => {});
  }

  /**
   * Checks if Kiro's task system is available
   * @returns Whether task system is available
   */
  isTaskSystemAvailable(): boolean {
    return this.isIntegrated && (this.taskSystemAPI?.isAvailable?.() ?? false);
  }

  /**
   * Discovers Kiro's task system API
   * @returns Whether discovery was successful
   */
  private async discoverTaskSystemAPI(): Promise<boolean> {
    try {
      // Try to get Kiro extension
      const kiroExtension = vscode.extensions.getExtension('kiro.kiro');

      if (!kiroExtension) {
        this.logger.debug('Kiro extension not found', {
          component: 'KiroTaskSystemAdapter',
        });
        return false;
      }

      // Activate if not already active
      if (!kiroExtension.isActive) {
        await kiroExtension.activate();
      }

      // Check if task system API is exposed
      const api = kiroExtension.exports;

      if (api && api.taskSystem) {
        this.taskSystemAPI = api.taskSystem as KiroTaskSystemAPI;
        this.logger.info('Discovered Kiro task system API', {
          component: 'KiroTaskSystemAdapter',
          methods: Object.keys(this.taskSystemAPI),
        });
        return true;
      }

      // Try alternative discovery methods
      return await this.discoverViaCommands();
    } catch (error) {
      this.logger.error('Error discovering Kiro task system API', {
        component: 'KiroTaskSystemAdapter',
        error: (error as Error).message,
      });
      return false;
    }
  }

  /**
   * Discovers task system via VS Code commands
   * @returns Whether discovery was successful
   */
  private async discoverViaCommands(): Promise<boolean> {
    try {
      // Check if Kiro task commands are available
      const commands = await vscode.commands.getCommands();
      const kiroTaskCommands = commands.filter((cmd) => cmd.startsWith('kiro.task'));

      if (kiroTaskCommands.length > 0) {
        this.logger.info('Discovered Kiro task commands', {
          component: 'KiroTaskSystemAdapter',
          commands: kiroTaskCommands,
        });

        // Create a command-based API adapter
        this.taskSystemAPI = this.createCommandBasedAPI(kiroTaskCommands);
        return true;
      }

      return false;
    } catch (error) {
      this.logger.error('Error discovering via commands', {
        component: 'KiroTaskSystemAdapter',
        error: (error as Error).message,
      });
      return false;
    }
  }

  /**
   * Creates a command-based API adapter
   * @param commands Available Kiro task commands
   * @returns Task system API
   */
  private createCommandBasedAPI(commands: string[]): KiroTaskSystemAPI {
    return {
      updateTaskStatus: async (taskId: string, status: string) => {
        if (commands.includes('kiro.task.updateStatus')) {
          await vscode.commands.executeCommand('kiro.task.updateStatus', taskId, status);
        }
      },
      getTask: async (taskId: string) => {
        if (commands.includes('kiro.task.get')) {
          return await vscode.commands.executeCommand('kiro.task.get', taskId);
        }
        return null;
      },
      isAvailable: () => commands.length > 0,
    };
  }

  /**
   * Maps internal task status to Kiro's status format
   * @param status Internal status
   * @returns Kiro status string
   */
  private mapStatusToKiro(status: TaskStatus): string {
    switch (status) {
      case 'pending':
        return 'not_started';
      case 'in_progress':
        return 'in_progress';
      case 'completed':
        return 'completed';
      case 'failed':
        return 'failed';
      case 'skipped':
        return 'skipped';
      default:
        return 'not_started';
    }
  }

  /**
   * Validates task file against Kiro's spec format
   * @param taskFilePath Path to task file
   * @returns Validation result
   */
  async validateTaskFile(taskFilePath: string): Promise<{ valid: boolean; errors: string[] }> {
    const compatibility = await this.checkTaskFormatCompatibility(taskFilePath);

    return {
      valid: compatibility.isCompatible,
      errors: compatibility.issues,
    };
  }

  /**
   * Disposes of resources
   */
  dispose(): void {
    this.disposables.forEach((d) => d.dispose());
    this.disposables = [];
  }
}
