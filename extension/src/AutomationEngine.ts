import * as vscode from 'vscode';
import { Task, TaskStatus } from './models/Task';
import { ExecutionContext, AutomationSession, createAutomationSession } from './models/ExecutionContext';
import { TaskManager } from './TaskManager';
import { KiroInterface } from './KiroInterface';
import { SessionPersistence } from './SessionPersistence';
import { NotificationService } from './NotificationService';
import { PerformanceMonitor } from './PerformanceMonitor';
import { ResourceManager } from './ResourceManager';
import { KiroTaskSystemAdapter } from './KiroTaskSystemAdapter';
import { HookSystemIntegration } from './HookSystemIntegration';
import { VersionCompatibility } from './VersionCompatibility';
import { Logger } from './Logger';
import { EventEmitter } from 'events';

/**
 * Error types for classification
 */
export enum ErrorType {
  NETWORK_ERROR = 'network_error',
  TIMEOUT_ERROR = 'timeout_error',
  KIRO_API_ERROR = 'kiro_api_error',
  TASK_VALIDATION_ERROR = 'task_validation_error',
  DEPENDENCY_ERROR = 'dependency_error',
  CONFIGURATION_ERROR = 'configuration_error',
  UNKNOWN_ERROR = 'unknown_error',
}

/**
 * Automation error class
 */
export class AutomationError extends Error {
  constructor(
    public type: ErrorType,
    message: string,
    public task?: Task,
    public retryable: boolean = true,
    public originalError?: Error
  ) {
    super(message);
    this.name = 'AutomationError';
  }
}

/**
 * Retry strategy
 */
export interface RetryStrategy {
  /** Maximum number of retry attempts */
  maxAttempts: number;
  
  /** Base delay in milliseconds */
  baseDelay: number;
  
  /** Maximum delay in milliseconds */
  maxDelay: number;
  
  /** Backoff multiplier */
  backoffMultiplier: number;
  
  /** Whether to use exponential backoff */
  exponentialBackoff: boolean;
}

/**
 * Default retry strategy
 */
const DEFAULT_RETRY_STRATEGY: RetryStrategy = {
  maxAttempts: 3,
  baseDelay: 1000,
  maxDelay: 30000,
  backoffMultiplier: 2,
  exponentialBackoff: true,
};

/**
 * Automation engine state
 */
export enum EngineState {
  IDLE = 'idle',
  RUNNING = 'running',
  PAUSED = 'paused',
  STOPPING = 'stopping',
  STOPPED = 'stopped',
  ERROR = 'error',
}

/**
 * Automation event types
 */
export enum AutomationEvent {
  STATE_CHANGED = 'stateChanged',
  TASK_STARTED = 'taskStarted',
  TASK_COMPLETED = 'taskCompleted',
  TASK_FAILED = 'taskFailed',
  TASK_SKIPPED = 'taskSkipped',
  SESSION_STARTED = 'sessionStarted',
  SESSION_COMPLETED = 'sessionCompleted',
  SESSION_FAILED = 'sessionFailed',
  SESSION_PAUSED = 'sessionPaused',
  SESSION_RESUMED = 'sessionResumed',
  ERROR_OCCURRED = 'errorOccurred',
}

/**
 * Automation engine configuration
 */
export interface AutomationEngineConfig {
  /** Maximum number of retry attempts for failed tasks */
  maxRetries: number;

  /** Timeout for task execution in milliseconds */
  taskTimeout: number;

  /** Delay between tasks in milliseconds */
  taskDelay: number;

  /** Whether to skip optional tasks */
  skipOptionalTasks: boolean;

  /** Whether to continue on task failure */
  continueOnFailure: boolean;

  /** Whether to enable verbose logging */
  verboseLogging: boolean;
  /** Maximum concurrency - number of tasks to run concurrently */
  concurrency?: number;
}

/**
 * Default automation engine configuration
 */
const DEFAULT_CONFIG: AutomationEngineConfig = {
  maxRetries: 3,
  taskTimeout: 300000, // 5 minutes
  taskDelay: 1000, // 1 second
  skipOptionalTasks: false,
  continueOnFailure: false,
  verboseLogging: false,
};

/**
 * AutomationEngine class
 * Orchestrates the automation workflow for task execution
 */
export class AutomationEngine extends EventEmitter {
  private state: EngineState = EngineState.IDLE;
  private currentSession?: AutomationSession;
  private currentTask?: Task;
  private executionQueue: Task[] = [];
  private config: AutomationEngineConfig;
  private taskManager?: TaskManager;
  private kiroInterface?: KiroInterface;
  private notificationService?: NotificationService;
  private kiroTaskAdapter?: KiroTaskSystemAdapter;
  private hookSystem?: HookSystemIntegration;
  private versionCompatibility?: VersionCompatibility;
  private logger?: Logger;
  private disposables: vscode.Disposable[] = [];
  private abortController?: AbortController;
  private retryStrategy: RetryStrategy;
  private taskRetryCount: Map<string, number> = new Map();
  private errorHistory: Array<{ task: Task; error: AutomationError; timestamp: Date }> = [];
  private sessionPersistence?: SessionPersistence;
  private persistenceInterval?: NodeJS.Timeout;
  private performanceMonitor?: PerformanceMonitor;
  private resourceManager?: ResourceManager;

  constructor(config?: Partial<AutomationEngineConfig>, retryStrategy?: Partial<RetryStrategy>) {
    super();
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.retryStrategy = { ...DEFAULT_RETRY_STRATEGY, ...retryStrategy };
  }

  /**
   * Initializes the automation engine
   * @param taskManager Task manager instance
   * @param kiroInterface Kiro interface instance
   * @param notificationService Notification service instance
   * @param context Extension context for persistence
   */
  async initialize(
    taskManager: TaskManager,
    kiroInterface: KiroInterface,
    notificationService?: NotificationService,
    context?: vscode.ExtensionContext
  ): Promise<void> {
    this.log('Initializing AutomationEngine...');

    // Store references
    this.taskManager = taskManager;
    this.kiroInterface = kiroInterface;
    if (notificationService) {
      this.notificationService = notificationService;
    }

    // Initialize logger
    this.logger = Logger.getInstance();

    // Initialize Kiro task system adapter
    this.kiroTaskAdapter = new KiroTaskSystemAdapter(this.kiroInterface, this.logger);
    await this.kiroTaskAdapter.initialize();

    // Initialize hook system
    this.hookSystem = new HookSystemIntegration(this.logger);
    await this.hookSystem.initialize();

    // Initialize version compatibility
    this.versionCompatibility = new VersionCompatibility(this.logger);
    const compatResult = await this.versionCompatibility.initialize();

    if (!compatResult.compatible && this.notificationService) {
      await this.notificationService.showWarning(
        `Version compatibility issues detected: ${compatResult.issues.join(', ')}`,
        {
          log: true,
          context: { recommendations: compatResult.recommendations },
        }
      );
    }

    // Initialize performance monitoring
    this.performanceMonitor = new PerformanceMonitor();
    this.resourceManager = new ResourceManager(this.performanceMonitor);

    // Initialize session persistence if context provided
    if (context) {
      this.sessionPersistence = new SessionPersistence(context);
    }

    // Verify Kiro is available
    if (!this.kiroInterface.isAvailable()) {
      throw new Error('Kiro IDE is not available. Cannot initialize automation engine.');
    }

    // Discover tasks
    await this.taskManager.discoverTasks();

    // Check for persisted session
    if (this.sessionPersistence && (await this.sessionPersistence.hasPersistedSession())) {
      this.log('Found persisted session - recovery available');
      
      // Notify user about session recovery
      if (this.notificationService) {
        await this.notificationService.showFromTemplate('session.recovered', {}, {
          actions: [
            {
              label: 'Resume',
              callback: async () => {
                await this.recoverSession();
                await this.resume();
              },
              primary: true,
            },
            {
              label: 'Start Fresh',
              callback: async () => {
                await this.clearPersistedSession();
              },
            },
          ],
        });
      }
    }

    this.log('AutomationEngine initialized successfully');
    this.setState(EngineState.IDLE);
  }

  /**
   * Starts the automation engine
   * Begins executing tasks from the queue
   */
  async start(): Promise<void> {
    this.log('Starting automation engine...');

    // Validate state
    if (this.state === EngineState.RUNNING) {
      throw new Error('Automation engine is already running');
    }

    if (!this.taskManager || !this.kiroInterface) {
      throw new Error('Automation engine not initialized. Call initialize() first.');
    }

    try {
      // Create new session
      const incompleteTasks = this.taskManager.getIncompleteTasks();
      this.currentSession = createAutomationSession(incompleteTasks.length, this.config);
      this.executionQueue = [...incompleteTasks];

      this.log(`Starting session ${this.currentSession.id} with ${this.executionQueue.length} tasks`);

      // Set state to running
      this.setState(EngineState.RUNNING);

      // Start performance monitoring
      if (this.performanceMonitor) {
        this.performanceMonitor.startMonitoring();
      }

      // Emit session started event
      this.emit(AutomationEvent.SESSION_STARTED, this.currentSession);

      // Notify user about automation start
      if (this.notificationService) {
        await this.notificationService.showFromTemplate('automation.started', {
          taskCount: this.executionQueue.length,
        });
      }

      // Create abort controller for cancellation
      this.abortController = new AbortController();

      // Start periodic session persistence
      this.startSessionPersistence();

      // Start execution loop
      await this.executionLoop();

      // Mark session as completed if we finished successfully
      if (this.isRunning()) {
        this.completeSession();
      }
    } catch (error) {
      this.log(`Error during automation: ${error}`, 'error');
      this.failSession(error as Error);
      throw error;
    } finally {
      // Stop session persistence
      this.stopSessionPersistence();
    }
  }

  /**
   * Stops the automation engine
   * Halts execution and cleans up resources
   */
  async stop(): Promise<void> {
    this.log('Stopping automation engine...');

    if (this.state === EngineState.IDLE || this.state === EngineState.STOPPED) {
      this.log('Automation engine is not running');
      return;
    }

    // Set state to stopping
    this.setState(EngineState.STOPPING);

    // Cancel any ongoing operations
    if (this.abortController) {
      this.abortController.abort();
    }

    // Clear execution queue
    this.executionQueue = [];

    // Update session status
    if (this.currentSession) {
      this.currentSession.status = 'stopped';
      this.currentSession.endTime = new Date();
    }

    // Notify user about automation stop
    if (this.notificationService) {
      await this.notificationService.showFromTemplate('automation.stopped', {});
    }

    // Set state to stopped
    this.setState(EngineState.STOPPED);

    this.log('Automation engine stopped');
  }

  /**
   * Pauses the automation engine
   * Suspends execution after the current task completes
   */
  async pause(): Promise<void> {
    this.log('Pausing automation engine...');

    if (this.state !== EngineState.RUNNING) {
      throw new Error('Cannot pause: automation engine is not running');
    }

    // Set state to paused
    this.setState(EngineState.PAUSED);

    // Update session status
    if (this.currentSession) {
      this.currentSession.status = 'paused';
    }

    // Emit paused event
    this.emit(AutomationEvent.SESSION_PAUSED, this.currentSession);

    // Notify user about automation pause
    if (this.notificationService && this.currentTask) {
      await this.notificationService.showFromTemplate('automation.paused', {
        taskTitle: this.currentTask.title,
      });
    }

    this.log('Automation engine paused');
  }

  /**
   * Resumes the automation engine
   * Continues execution from where it was paused
   */
  async resume(): Promise<void> {
    this.log('Resuming automation engine...');

    if (this.state !== EngineState.PAUSED) {
      throw new Error('Cannot resume: automation engine is not paused');
    }

    // Set state to running
    this.setState(EngineState.RUNNING);

    // Update session status
    if (this.currentSession) {
      this.currentSession.status = 'running';
    }

    // Emit resumed event
    this.emit(AutomationEvent.SESSION_RESUMED, this.currentSession);

    // Notify user about automation resume
    if (this.notificationService) {
      const nextTask = this.executionQueue[0] || this.currentTask;
      if (nextTask) {
        await this.notificationService.showFromTemplate('automation.resumed', {
          taskTitle: nextTask.title,
        });
      }
    }

    this.log('Automation engine resumed');

    // Continue execution loop
    try {
      await this.executionLoop();

      // Mark session as completed if we finished successfully
      if (this.isRunning()) {
        this.completeSession();
      }
    } catch (error) {
      this.log(`Error during automation: ${error}`, 'error');
      this.failSession(error as Error);
      throw error;
    }
  }

  /**
   * Main execution loop
   * Processes tasks from the queue
   */
  private async executionLoop(): Promise<void> {
    while (this.executionQueue.length > 0 && this.state === EngineState.RUNNING) {
      // Get next task
      const task = this.executionQueue.shift();
      if (!task) {
        continue;
      }

      // Check if we should skip this task
      if (this.shouldSkipTask(task)) {
        this.log(`Skipping task ${task.id}: ${task.title}`);
        await this.skipTask(task);
        continue;
      }

      // Execute the task
      try {
        await this.executeTask(task);
      } catch (error) {
        this.log(`Task ${task.id} failed: ${error}`, 'error');

        // Handle task failure
        if (!this.config.continueOnFailure) {
          throw error;
        }
      }

      // Add delay between tasks
      if (this.config.taskDelay > 0 && this.executionQueue.length > 0) {
        await this.delay(this.config.taskDelay);
      }
    }
  }

  /**
   * Executes a single task
   * @param task Task to execute
   */
  private async executeTask(task: Task): Promise<void> {
    this.log(`Executing task ${task.id}: ${task.title}`);
    this.currentTask = task;

    // Start performance tracking for this task
    if (this.performanceMonitor) {
      this.performanceMonitor.startTaskTracking(task.id, task.title);
    }

    // Emit task started event
    this.emit(AutomationEvent.TASK_STARTED, task);

    let lastError: Error | undefined;
    let shouldRetry = true;

    while (shouldRetry) {
      try {
        // Pre-execution hook
        await this.preExecutionHook(task);

        // Update task status to in-progress
        task.status = TaskStatus.IN_PROGRESS;
        if (this.taskManager) {
          await this.taskManager.updateTaskStatusInFile(task.id, TaskStatus.IN_PROGRESS);
        }

        // Execute the task with timeout
        const timeoutPromise = new Promise<never>((_, reject) => {
          setTimeout(() => reject(new Error('Task execution timeout')), this.config.taskTimeout);
        });

        const executionPromise = this.executeTaskInternal(task);

        await Promise.race([executionPromise, timeoutPromise]);

        // Mark task as completed
        task.status = TaskStatus.COMPLETED;
        if (this.taskManager) {
          await this.taskManager.updateTaskStatusInFile(task.id, TaskStatus.COMPLETED);
        }

        // Add to completed tasks
        if (this.currentSession) {
          this.currentSession.completedTasks.push(task);
        }

        // Reset retry count on success
        this.resetTaskRetryCount(task.id);

        // End performance tracking
        if (this.performanceMonitor) {
          this.performanceMonitor.endTaskTracking(task.id, true);
        }

        // Post-execution hook
        await this.postExecutionHook(task);

        // Emit task completed event
        this.emit(AutomationEvent.TASK_COMPLETED, task);

        // Notify user about task completion
        if (this.notificationService) {
          await this.notificationService.showFromTemplate('task.completed', {
            taskTitle: task.title,
          }, { log: false }); // Don't log since we already log task completion
        }

        this.log(`Task ${task.id} completed successfully`);
        
        // Success - exit retry loop
        shouldRetry = false;
      } catch (error) {
        lastError = error as Error;
        this.log(`Task ${task.id} failed: ${error}`, 'error');

        // Handle task failure with retry logic
        shouldRetry = await this.handleTaskFailure(task, lastError);

        if (!shouldRetry) {
          // Mark task as failed
          task.status = TaskStatus.FAILED;
          if (this.taskManager) {
            await this.taskManager.updateTaskStatusInFile(task.id, TaskStatus.FAILED);
          }

          // End performance tracking with failure
          if (this.performanceMonitor) {
            this.performanceMonitor.endTaskTracking(task.id, false, lastError.message);
          }

          // Add to failed tasks
          if (this.currentSession) {
            this.currentSession.failedTasks.push(task);
          }

          // Emit task failed event
          this.emit(AutomationEvent.TASK_FAILED, task, lastError);

          // Notify user about task failure
          if (this.notificationService) {
            await this.notificationService.showFromTemplate('task.failed', {
              taskTitle: task.title,
              error: lastError.message,
            }, {
              actions: [
                {
                  label: 'View Logs',
                  callback: () => {
                    vscode.commands.executeCommand('kiro-automation.showLogs');
                  },
                },
                {
                  label: 'Skip Task',
                  callback: async () => {
                    await this.skipTask(task);
                  },
                },
              ],
            });
          }

          throw lastError;
        }
      }
    }

    this.currentTask = undefined;
  }

  /**
   * Internal task execution logic
   * @param task Task to execute
   */
  private async executeTaskInternal(task: Task): Promise<void> {
    // This will be implemented with Kiro integration
    // For now, we'll create a placeholder that will be filled in with
    // the actual implementation using PromptGenerator, ChatMessageSender, and ResponseMonitor
    
    this.log(`Internal execution for task ${task.id} - integration pending`);
    
    // TODO: Implement actual execution with:
    // 1. Generate prompt using PromptGenerator
    // 2. Send message using ChatMessageSender
    // 3. Monitor response using ResponseMonitor
    // 4. Handle completion/failure
    
    // For now, simulate execution
    await this.delay(1000);
  }

  /**
   * Pre-execution hook
   * Called before task execution begins
   * @param task Task about to be executed
   */
  private async preExecutionHook(task: Task): Promise<void> {
    this.log(`Pre-execution hook for task ${task.id}`);
    
    // Verify dependencies are satisfied
    if (this.taskManager && !this.taskManager.areDependenciesSatisfied(task)) {
      throw new Error(`Task ${task.id} has unsatisfied dependencies`);
    }

    // Check if we should skip optional subtasks
    if (this.config.skipOptionalTasks) {
      task.subtasks = task.subtasks.filter(st => !st.optional);
    }

    // Additional pre-execution logic can be added here
  }

  /**
   * Post-execution hook
   * Called after task execution completes
   * @param task Task that was executed
   */
  private async postExecutionHook(task: Task): Promise<void> {
    this.log(`Post-execution hook for task ${task.id}`);
    
    // Verify all required subtasks are complete
    const incompleteRequired = task.subtasks.filter(
      st => !st.optional && st.status !== TaskStatus.COMPLETED
    );

    if (incompleteRequired.length > 0) {
      this.log(
        `Warning: Task ${task.id} has ${incompleteRequired.length} incomplete required subtasks`,
        'warn'
      );
    }

    // Additional post-execution logic can be added here
  }

  /**
   * Checks if a task should be skipped
   * @param task Task to check
   * @returns True if task should be skipped
   */
  private shouldSkipTask(task: Task): boolean {
    // Skip if task is already completed
    if (task.status === TaskStatus.COMPLETED) {
      return true;
    }

    // Skip if task is already skipped
    if (task.status === TaskStatus.SKIPPED) {
      return true;
    }

    // Skip optional tasks if configured
    if (this.config.skipOptionalTasks && task.subtasks.every((st) => st.optional)) {
      return true;
    }

    return false;
  }

  /**
   * Skips a task
   * @param task Task to skip
   */
  private async skipTask(task: Task): Promise<void> {
    // Update task status
    task.status = TaskStatus.SKIPPED;
    if (this.taskManager) {
      await this.taskManager.updateTaskStatusInFile(task.id, TaskStatus.SKIPPED);
    }

    // Add to skipped tasks
    if (this.currentSession) {
      this.currentSession.skippedTasks.push(task);
    }

    // Emit event
    this.emit(AutomationEvent.TASK_SKIPPED, task);
  }

  /**
   * Completes the current session
   */
  private completeSession(): void {
    if (!this.currentSession) {
      return;
    }

    this.currentSession.status = 'completed';
    this.currentSession.endTime = new Date();

    // Stop performance monitoring
    if (this.performanceMonitor) {
      this.performanceMonitor.stopMonitoring();
    }

    // Cleanup session resources
    if (this.resourceManager) {
      this.resourceManager.cleanupSession(this.currentSession.id).catch(error => {
        this.log(`Failed to cleanup session resources: ${error}`, 'warn');
      });
    }

    this.log(`Session ${this.currentSession.id} completed successfully`);
    this.emit(AutomationEvent.SESSION_COMPLETED, this.currentSession);

    // Notify user about automation completion
    if (this.notificationService) {
      this.notificationService.showFromTemplate('automation.completed', {
        completedCount: this.currentSession.completedTasks.length,
      });
    }

    this.setState(EngineState.IDLE);
  }

  /**
   * Fails the current session
   * @param error Error that caused the failure
   */
  private failSession(error: Error): void {
    if (!this.currentSession) {
      return;
    }

    this.currentSession.status = 'failed';
    this.currentSession.endTime = new Date();
    this.currentSession.error = {
      message: error.message,
      task: this.currentTask,
      timestamp: new Date(),
    };

    this.log(`Session ${this.currentSession.id} failed: ${error.message}`, 'error');
    this.emit(AutomationEvent.SESSION_FAILED, this.currentSession, error);

    // Notify user about automation failure
    if (this.notificationService) {
      this.notificationService.showFromTemplate('automation.failed', {
        error: error.message,
      }, {
        actions: [
          {
            label: 'View Logs',
            callback: () => {
              vscode.commands.executeCommand('kiro-automation.showLogs');
            },
          },
          {
            label: 'Retry',
            callback: async () => {
              await this.start();
            },
          },
        ],
      });
    }

    this.setState(EngineState.ERROR);
  }

  /**
   * Sets the engine state and emits state change event
   * @param newState New engine state
   */
  private setState(newState: EngineState): void {
    const oldState = this.state;
    this.state = newState;

    this.log(`State changed: ${oldState} -> ${newState}`);
    this.emit(AutomationEvent.STATE_CHANGED, newState, oldState);
  }

  /**
   * Gets the current engine state
   */
  getState(): EngineState {
    return this.state;
  }

  /**
   * Gets the current session
   */
  getCurrentSession(): AutomationSession | undefined {
    return this.currentSession;
  }

  /**
   * Gets the current task
   */
  getCurrentTask(): Task | undefined {
    return this.currentTask;
  }

  /**
   * Gets the execution queue
   */
  getExecutionQueue(): Task[] {
    return [...this.executionQueue];
  }

  /**
   * Gets the engine configuration
   */
  getConfig(): AutomationEngineConfig {
    return { ...this.config };
  }

  /**
   * Updates the engine configuration
   * @param config Partial configuration to update
   */
  updateConfig(config: Partial<AutomationEngineConfig>): void {
    this.config = { ...this.config, ...config };
    this.log('Configuration updated');
  }

  /**
   * Gets the performance monitor
   */
  getPerformanceMonitor(): PerformanceMonitor | undefined {
    return this.performanceMonitor;
  }

  /**
   * Gets the resource manager
   */
  getResourceManager(): ResourceManager | undefined {
    return this.resourceManager;
  }

  /**
   * Checks if the engine is running
   */
  isRunning(): boolean {
    return this.state === EngineState.RUNNING;
  }

  /**
   * Checks if the engine is paused
   */
  isPaused(): boolean {
    return this.state === EngineState.PAUSED;
  }

  /**
   * Checks if the engine is idle
   */
  isIdle(): boolean {
    return this.state === EngineState.IDLE;
  }

  /**
   * Utility method to delay execution
   * @param ms Milliseconds to delay
   */
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Logs a message
   * @param message Message to log
   * @param level Log level
   */
  private log(message: string, level: 'info' | 'warn' | 'error' = 'info'): void {
    if (!this.config.verboseLogging && level === 'info') {
      return;
    }

    const timestamp = new Date().toISOString();
    const prefix = `[AutomationEngine ${timestamp}]`;

    switch (level) {
      case 'error':
        console.error(`${prefix} ${message}`);
        break;
      case 'warn':
        console.warn(`${prefix} ${message}`);
        break;
      default:
        console.log(`${prefix} ${message}`);
    }
  }

  /**
   * Classifies an error
   * @param error Error to classify
   * @returns Error type
   */
  private classifyError(error: Error): ErrorType {
    const message = error.message.toLowerCase();

    if (message.includes('network') || message.includes('connection')) {
      return ErrorType.NETWORK_ERROR;
    }

    if (message.includes('timeout') || message.includes('timed out')) {
      return ErrorType.TIMEOUT_ERROR;
    }

    if (message.includes('kiro') || message.includes('api')) {
      return ErrorType.KIRO_API_ERROR;
    }

    if (message.includes('validation') || message.includes('invalid')) {
      return ErrorType.TASK_VALIDATION_ERROR;
    }

    if (message.includes('dependency') || message.includes('dependencies')) {
      return ErrorType.DEPENDENCY_ERROR;
    }

    if (message.includes('configuration') || message.includes('config')) {
      return ErrorType.CONFIGURATION_ERROR;
    }

    return ErrorType.UNKNOWN_ERROR;
  }

  /**
   * Determines if an error is retryable
   * @param errorType Error type
   * @returns True if error is retryable
   */
  private isRetryableError(errorType: ErrorType): boolean {
    switch (errorType) {
      case ErrorType.NETWORK_ERROR:
      case ErrorType.TIMEOUT_ERROR:
      case ErrorType.KIRO_API_ERROR:
        return true;
      case ErrorType.TASK_VALIDATION_ERROR:
      case ErrorType.DEPENDENCY_ERROR:
      case ErrorType.CONFIGURATION_ERROR:
        return false;
      default:
        return true; // Retry unknown errors by default
    }
  }

  /**
   * Handles task failure with retry logic
   * @param task Task that failed
   * @param error Error that occurred
   * @returns True if task should be retried
   */
  private async handleTaskFailure(task: Task, error: Error): Promise<boolean> {
    // Classify the error
    const errorType = this.classifyError(error);
    const retryable = this.isRetryableError(errorType);

    // Create automation error
    const automationError = new AutomationError(
      errorType,
      error.message,
      task,
      retryable,
      error
    );

    // Add to error history
    this.errorHistory.push({
      task,
      error: automationError,
      timestamp: new Date(),
    });

    // Emit error event
    this.emit(AutomationEvent.ERROR_OCCURRED, automationError);

    // Check if we should retry
    if (!retryable) {
      this.log(`Error is not retryable: ${errorType}`, 'error');
      
      // Notify user about non-retryable error requiring intervention
      if (this.notificationService) {
        await this.notificationService.showFromTemplate('error.intervention', {
          reason: `${errorType}: ${error.message}`,
        }, {
          modal: true,
          actions: [
            {
              label: 'View Logs',
              callback: () => {
                vscode.commands.executeCommand('kiro-automation.showLogs');
              },
            },
            {
              label: 'Stop Automation',
              callback: async () => {
                await this.stop();
              },
            },
          ],
        });
      }
      
      return false;
    }

    // Get current retry count
    const retryCount = this.taskRetryCount.get(task.id) || 0;

    if (retryCount >= this.retryStrategy.maxAttempts) {
      this.log(`Max retry attempts (${this.retryStrategy.maxAttempts}) reached for task ${task.id}`, 'error');
      return false;
    }

    // Increment retry count
    this.taskRetryCount.set(task.id, retryCount + 1);

    // Calculate retry delay
    const delay = this.calculateRetryDelay(retryCount);

    this.log(`Retrying task ${task.id} in ${delay}ms (attempt ${retryCount + 1}/${this.retryStrategy.maxAttempts})`);

    // Notify user about retry
    if (this.notificationService) {
      await this.notificationService.showFromTemplate('task.retrying', {
        taskTitle: task.title,
        attempt: retryCount + 1,
        maxAttempts: this.retryStrategy.maxAttempts,
      }, { log: false });
    }

    // Wait before retry
    await this.delay(delay);

    return true;
  }

  /**
   * Calculates retry delay with exponential backoff
   * @param retryCount Current retry count
   * @returns Delay in milliseconds
   */
  private calculateRetryDelay(retryCount: number): number {
    if (!this.retryStrategy.exponentialBackoff) {
      return this.retryStrategy.baseDelay;
    }

    const delay = this.retryStrategy.baseDelay * Math.pow(this.retryStrategy.backoffMultiplier, retryCount);
    return Math.min(delay, this.retryStrategy.maxDelay);
  }

  /**
   * Implements error recovery strategy
   * @param task Task that failed
   * @param error Error that occurred
   * @returns Recovery action
   */
  private async recoverFromError(task: Task, error: AutomationError): Promise<'retry' | 'skip' | 'stop'> {
    this.log(`Attempting error recovery for task ${task.id}`);

    switch (error.type) {
      case ErrorType.NETWORK_ERROR:
        // Wait and retry for network errors
        await this.delay(5000);
        return 'retry';

      case ErrorType.TIMEOUT_ERROR:
        // Increase timeout and retry
        this.config.taskTimeout *= 1.5;
        return 'retry';

      case ErrorType.KIRO_API_ERROR:
        // Try to reinitialize Kiro interface
        if (this.kiroInterface) {
          await this.kiroInterface.initialize();
        }
        return 'retry';

      case ErrorType.DEPENDENCY_ERROR:
        // Cannot recover from dependency errors
        return 'stop';

      case ErrorType.CONFIGURATION_ERROR:
        // Cannot recover from configuration errors
        return 'stop';

      case ErrorType.TASK_VALIDATION_ERROR:
        // Skip invalid tasks
        return 'skip';

      default:
        // Retry unknown errors
        return 'retry';
    }
  }

  /**
   * Gets error history
   */
  getErrorHistory(): Array<{ task: Task; error: AutomationError; timestamp: Date }> {
    return [...this.errorHistory];
  }

  /**
   * Gets retry count for a task
   * @param taskId Task ID
   * @returns Retry count
   */
  getTaskRetryCount(taskId: string): number {
    return this.taskRetryCount.get(taskId) || 0;
  }

  /**
   * Resets retry count for a task
   * @param taskId Task ID
   */
  resetTaskRetryCount(taskId: string): void {
    this.taskRetryCount.delete(taskId);
  }

  /**
   * Clears error history
   */
  clearErrorHistory(): void {
    this.errorHistory = [];
  }

  /**
   * Gets retry strategy
   */
  getRetryStrategy(): RetryStrategy {
    return { ...this.retryStrategy };
  }

  /**
   * Updates retry strategy
   * @param strategy Partial retry strategy to update
   */
  updateRetryStrategy(strategy: Partial<RetryStrategy>): void {
    this.retryStrategy = { ...this.retryStrategy, ...strategy };
    this.log('Retry strategy updated');
  }

  /**
   * Starts periodic session persistence
   */
  private startSessionPersistence(): void {
    if (!this.sessionPersistence || !this.currentSession) {
      return;
    }

    // Persist every 30 seconds
    this.persistenceInterval = setInterval(async () => {
      await this.persistCurrentSession();
    }, 30000);
  }

  /**
   * Stops periodic session persistence
   */
  private stopSessionPersistence(): void {
    if (this.persistenceInterval) {
      clearInterval(this.persistenceInterval);
      this.persistenceInterval = undefined;
    }
  }

  /**
   * Persists the current session
   */
  private async persistCurrentSession(): Promise<void> {
    if (!this.sessionPersistence || !this.currentSession) {
      return;
    }

    try {
      await this.sessionPersistence.persistSession(
        this.currentSession,
        this.executionQueue,
        this.currentTask?.id
      );
      this.log('Session persisted');
    } catch (error) {
      this.log(`Failed to persist session: ${error}`, 'warn');
    }
  }

  /**
   * Recovers a session from storage
   * @returns True if session was recovered
   */
  async recoverSession(): Promise<boolean> {
    if (!this.sessionPersistence) {
      this.log('Session persistence not available', 'warn');
      return false;
    }

    try {
      const persistedData = await this.sessionPersistence.recoverSession({
        resumeFromLast: true,
        resetFailedTasks: false,
        clearCompletedTasks: false,
      });

      if (!persistedData) {
        this.log('No session to recover');
        return false;
      }

      // Restore session
      this.currentSession = persistedData.session;

      // Restore execution queue
      if (this.taskManager) {
        const allTasks = this.taskManager.getTasks();
        this.executionQueue = persistedData.executionQueue
          .map((taskId) => allTasks.find((t) => t.id === taskId))
          .filter((t): t is Task => t !== undefined);
      }

      // Restore current task
      if (persistedData.currentTaskId && this.taskManager) {
        this.currentTask = this.taskManager.getTask(persistedData.currentTaskId);
      }

      this.log(`Session ${this.currentSession.id} recovered successfully`);
      return true;
    } catch (error) {
      this.log(`Failed to recover session: ${error}`, 'error');
      return false;
    }
  }

  /**
   * Clears persisted session
   */
  async clearPersistedSession(): Promise<void> {
    if (!this.sessionPersistence) {
      return;
    }

    await this.sessionPersistence.clearPersistedSession();
    this.log('Persisted session cleared');
  }

  /**
   * Exports current session to file
   * @param filePath File path to export to
   */
  async exportSession(filePath: string): Promise<void> {
    if (!this.sessionPersistence || !this.currentSession) {
      throw new Error('No session to export');
    }

    await this.sessionPersistence.exportSession(this.currentSession, filePath);
    this.log(`Session exported to ${filePath}`);
  }

  /**
   * Gets session statistics
   */
  getSessionStatistics(): any {
    if (!this.sessionPersistence || !this.currentSession) {
      return null;
    }

    return this.sessionPersistence.getSessionStatistics(this.currentSession);
  }

  /**
   * Disposes of resources
   */
  dispose(): void {
    this.log('Disposing AutomationEngine...');

    // Stop if running
    if (this.state === EngineState.RUNNING || this.state === EngineState.PAUSED) {
      this.stop();
    }

    // Dispose performance monitoring
    if (this.performanceMonitor) {
      this.performanceMonitor.dispose();
    }

    // Dispose resource manager
    if (this.resourceManager) {
      this.resourceManager.dispose();
    }

    // Dispose of all disposables
    this.disposables.forEach((d) => d.dispose());
    this.disposables = [];

    // Clear maps and arrays
    this.taskRetryCount.clear();
    this.errorHistory = [];

    // Remove all listeners
    this.removeAllListeners();

    this.log('AutomationEngine disposed');
  }
}
