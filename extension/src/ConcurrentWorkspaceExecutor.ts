import * as vscode from 'vscode';
import { WorkspaceManager } from './WorkspaceManager';
import { Logger } from './Logger';

/**
 * Resource allocation for a workspace
 */
export interface WorkspaceResourceAllocation {
  /** Workspace URI */
  workspaceUri: string;

  /** Maximum memory allocation in MB */
  maxMemoryMB: number;

  /** Maximum CPU percentage (0-100) */
  maxCpuPercent: number;

  /** Priority level (1-10, higher is more important) */
  priority: number;

  /** Current memory usage in MB */
  currentMemoryMB: number;

  /** Current CPU usage percentage */
  currentCpuPercent: number;
}

/**
 * Concurrent execution status
 */
export interface ConcurrentExecutionStatus {
  /** Total workspaces being automated */
  totalWorkspaces: number;

  /** Currently running workspaces */
  runningWorkspaces: number;

  /** Queued workspaces waiting to start */
  queuedWorkspaces: number;

  /** Completed workspaces */
  completedWorkspaces: number;

  /** Failed workspaces */
  failedWorkspaces: number;

  /** Resource allocations per workspace */
  resourceAllocations: Map<string, WorkspaceResourceAllocation>;

  /** Start time */
  startTime: Date;

  /** Estimated completion time */
  estimatedCompletionTime?: Date;
}

/**
 * Concurrent workspace executor
 * Manages running automation on multiple workspaces simultaneously
 * with resource allocation and priority management
 */
export class ConcurrentWorkspaceExecutor {
  private workspaceManager: WorkspaceManager;
  private logger: Logger;
  private maxConcurrentWorkspaces: number;
  private runningWorkspaces: Set<string> = new Set();
  private queuedWorkspaces: string[] = [];
  private completedWorkspaces: Set<string> = new Set();
  private failedWorkspaces: Map<string, Error> = new Map();
  private resourceAllocations: Map<string, WorkspaceResourceAllocation> = new Map();
  private isExecuting: boolean = false;
  private startTime?: Date;
  private disposables: vscode.Disposable[] = [];
  private onStatusChangedCallback?: (status: ConcurrentExecutionStatus) => void;

  constructor(
    workspaceManager: WorkspaceManager,
    logger: Logger,
    maxConcurrentWorkspaces: number = 2
  ) {
    this.workspaceManager = workspaceManager;
    this.logger = logger;
    this.maxConcurrentWorkspaces = maxConcurrentWorkspaces;
  }

  /**
   * Starts concurrent automation on multiple workspaces
   * @param workspaceUris Array of workspace URIs to automate
   * @param options Execution options
   */
  async startConcurrentAutomation(
    workspaceUris: string[],
    options?: {
      priorities?: Map<string, number>;
      resourceLimits?: Map<string, { maxMemoryMB: number; maxCpuPercent: number }>;
    }
  ): Promise<void> {
    if (this.isExecuting) {
      throw new Error('Concurrent automation is already running');
    }

    this.logger.info(
      `Starting concurrent automation on ${workspaceUris.length} workspace(s)`,
      { component: 'ConcurrentWorkspaceExecutor', workspaceCount: workspaceUris.length }
    );

    // Reset state
    this.runningWorkspaces.clear();
    this.queuedWorkspaces = [...workspaceUris];
    this.completedWorkspaces.clear();
    this.failedWorkspaces.clear();
    this.resourceAllocations.clear();
    this.isExecuting = true;
    this.startTime = new Date();

    // Initialize resource allocations
    this.initializeResourceAllocations(workspaceUris, options);

    // Sort queue by priority
    this.sortQueueByPriority();

    // Start execution
    await this.processQueue();
  }

  /**
   * Stops all concurrent automation
   */
  async stopConcurrentAutomation(): Promise<void> {
    if (!this.isExecuting) {
      return;
    }

    this.logger.info('Stopping concurrent automation', { component: 'ConcurrentWorkspaceExecutor' });

    // Stop all running workspaces
    const stopPromises: Promise<void>[] = [];
    for (const workspaceUri of this.runningWorkspaces) {
      stopPromises.push(this.stopWorkspace(workspaceUri));
    }

    await Promise.all(stopPromises);

    // Clear queue
    this.queuedWorkspaces = [];
    this.isExecuting = false;

    this.notifyStatusChanged();
  }

  /**
   * Pauses concurrent automation
   */
  async pauseConcurrentAutomation(): Promise<void> {
    if (!this.isExecuting) {
      return;
    }

    this.logger.info('Pausing concurrent automation', { component: 'ConcurrentWorkspaceExecutor' });

    // Pause all running workspaces
    const pausePromises: Promise<void>[] = [];
    for (const workspaceUri of this.runningWorkspaces) {
      pausePromises.push(this.pauseWorkspace(workspaceUri));
    }

    await Promise.all(pausePromises);
  }

  /**
   * Resumes concurrent automation
   */
  async resumeConcurrentAutomation(): Promise<void> {
    if (!this.isExecuting) {
      return;
    }

    this.logger.info('Resuming concurrent automation', { component: 'ConcurrentWorkspaceExecutor' });

    // Resume all paused workspaces
    const resumePromises: Promise<void>[] = [];
    for (const workspaceUri of this.runningWorkspaces) {
      resumePromises.push(this.resumeWorkspace(workspaceUri));
    }

    await Promise.all(resumePromises);

    // Continue processing queue
    await this.processQueue();
  }

  /**
   * Gets current execution status
   * @returns Concurrent execution status
   */
  getStatus(): ConcurrentExecutionStatus {
    return {
      totalWorkspaces:
        this.runningWorkspaces.size +
        this.queuedWorkspaces.length +
        this.completedWorkspaces.size +
        this.failedWorkspaces.size,
      runningWorkspaces: this.runningWorkspaces.size,
      queuedWorkspaces: this.queuedWorkspaces.length,
      completedWorkspaces: this.completedWorkspaces.size,
      failedWorkspaces: this.failedWorkspaces.size,
      resourceAllocations: new Map(this.resourceAllocations),
      startTime: this.startTime || new Date(),
      estimatedCompletionTime: this.estimateCompletionTime(),
    };
  }

  /**
   * Gets resource allocation for a workspace
   * @param workspaceUri Workspace URI
   * @returns Resource allocation or undefined
   */
  getResourceAllocation(workspaceUri: string): WorkspaceResourceAllocation | undefined {
    return this.resourceAllocations.get(workspaceUri);
  }

  /**
   * Updates resource allocation for a workspace
   * @param workspaceUri Workspace URI
   * @param allocation New allocation
   */
  updateResourceAllocation(
    workspaceUri: string,
    allocation: Partial<WorkspaceResourceAllocation>
  ): void {
    const current = this.resourceAllocations.get(workspaceUri);
    if (current) {
      this.resourceAllocations.set(workspaceUri, { ...current, ...allocation });
      this.logger.debug(
        `Updated resource allocation for workspace: ${workspaceUri}`,
        { component: 'ConcurrentWorkspaceExecutor', workspaceUri }
      );
    }
  }

  /**
   * Registers a callback for status changes
   * @param callback Callback function
   */
  onStatusChanged(callback: (status: ConcurrentExecutionStatus) => void): void {
    this.onStatusChangedCallback = callback;
  }

  /**
   * Initializes resource allocations for workspaces
   */
  private initializeResourceAllocations(
    workspaceUris: string[],
    options?: {
      priorities?: Map<string, number>;
      resourceLimits?: Map<string, { maxMemoryMB: number; maxCpuPercent: number }>;
    }
  ): void {
    const defaultMemoryPerWorkspace = 100; // MB
    const defaultCpuPerWorkspace = 50; // %
    const defaultPriority = 5;

    for (const workspaceUri of workspaceUris) {
      const priority = options?.priorities?.get(workspaceUri) ?? defaultPriority;
      const limits = options?.resourceLimits?.get(workspaceUri);

      this.resourceAllocations.set(workspaceUri, {
        workspaceUri,
        maxMemoryMB: limits?.maxMemoryMB ?? defaultMemoryPerWorkspace,
        maxCpuPercent: limits?.maxCpuPercent ?? defaultCpuPerWorkspace,
        priority,
        currentMemoryMB: 0,
        currentCpuPercent: 0,
      });
    }
  }

  /**
   * Sorts queue by priority
   */
  private sortQueueByPriority(): void {
    this.queuedWorkspaces.sort((a, b) => {
      const priorityA = this.resourceAllocations.get(a)?.priority ?? 5;
      const priorityB = this.resourceAllocations.get(b)?.priority ?? 5;
      return priorityB - priorityA; // Higher priority first
    });
  }

  /**
   * Processes the workspace queue
   */
  private async processQueue(): Promise<void> {
    while (this.isExecuting && this.queuedWorkspaces.length > 0) {
      // Check if we can start more workspaces
      if (this.runningWorkspaces.size >= this.maxConcurrentWorkspaces) {
        // Wait for a workspace to complete
        await this.waitForWorkspaceSlot();
        continue;
      }

      // Start next workspace
      const workspaceUri = this.queuedWorkspaces.shift();
      if (workspaceUri) {
        await this.startWorkspace(workspaceUri);
      }
    }

    // Check if all workspaces are complete
    if (
      this.queuedWorkspaces.length === 0 &&
      this.runningWorkspaces.size === 0 &&
      this.isExecuting
    ) {
      this.isExecuting = false;
      this.logger.info('Concurrent automation completed', { component: 'ConcurrentWorkspaceExecutor' });
      this.notifyStatusChanged();
    }
  }

  /**
   * Starts automation for a workspace
   * @param workspaceUri Workspace URI
   */
  private async startWorkspace(workspaceUri: string): Promise<void> {
    try {
      this.logger.info(`Starting automation for workspace: ${workspaceUri}`, { component: 'ConcurrentWorkspaceExecutor' });

      this.runningWorkspaces.add(workspaceUri);
      this.notifyStatusChanged();

      // Start automation
      await this.workspaceManager.startAutomation(workspaceUri);

      // Monitor completion
      this.monitorWorkspaceCompletion(workspaceUri);
    } catch (error) {
      this.logger.error(
        `Failed to start automation for workspace: ${workspaceUri}`,
        { component: 'ConcurrentWorkspaceExecutor', workspaceUri, error: (error as Error).message }
      );
      this.handleWorkspaceFailure(workspaceUri, error as Error);
    }
  }

  /**
   * Stops automation for a workspace
   * @param workspaceUri Workspace URI
   */
  private async stopWorkspace(workspaceUri: string): Promise<void> {
    try {
      await this.workspaceManager.stopAutomation(workspaceUri);
      this.runningWorkspaces.delete(workspaceUri);
      this.notifyStatusChanged();
    } catch (error) {
      this.logger.error(
        `Failed to stop automation for workspace: ${workspaceUri}`,
        { component: 'ConcurrentWorkspaceExecutor', workspaceUri, error: (error as Error).message }
      );
    }
  }

  /**
   * Pauses automation for a workspace
   * @param workspaceUri Workspace URI
   */
  private async pauseWorkspace(workspaceUri: string): Promise<void> {
    try {
      await this.workspaceManager.pauseAutomation(workspaceUri);
    } catch (error) {
      this.logger.error(
        `Failed to pause automation for workspace: ${workspaceUri}`,
        { component: 'ConcurrentWorkspaceExecutor', workspaceUri, error: (error as Error).message }
      );
    }
  }

  /**
   * Resumes automation for a workspace
   * @param workspaceUri Workspace URI
   */
  private async resumeWorkspace(workspaceUri: string): Promise<void> {
    try {
      await this.workspaceManager.resumeAutomation(workspaceUri);
    } catch (error) {
      this.logger.error(
        `Failed to resume automation for workspace: ${workspaceUri}`,
        { component: 'ConcurrentWorkspaceExecutor', workspaceUri, error: (error as Error).message }
      );
    }
  }

  /**
   * Monitors workspace completion
   * @param workspaceUri Workspace URI
   */
  private monitorWorkspaceCompletion(workspaceUri: string): void {
    const engine = this.workspaceManager.getAutomationEngine(workspaceUri);
    if (!engine) {
      return;
    }

    // Listen for completion
    const checkCompletion = setInterval(() => {
      if (!engine.isRunning()) {
        clearInterval(checkCompletion);
        this.handleWorkspaceCompletion(workspaceUri);
      }
    }, 1000);
  }

  /**
   * Handles workspace completion
   * @param workspaceUri Workspace URI
   */
  private handleWorkspaceCompletion(workspaceUri: string): void {
    this.logger.info(`Workspace automation completed: ${workspaceUri}`, { component: 'ConcurrentWorkspaceExecutor' });

    this.runningWorkspaces.delete(workspaceUri);
    this.completedWorkspaces.add(workspaceUri);
    this.notifyStatusChanged();

    // Continue processing queue
    if (this.isExecuting) {
      this.processQueue();
    }
  }

  /**
   * Handles workspace failure
   * @param workspaceUri Workspace URI
   * @param error Error that occurred
   */
  private handleWorkspaceFailure(workspaceUri: string, error: Error): void {
    this.logger.error(
      `Workspace automation failed: ${workspaceUri}`,
      { component: 'ConcurrentWorkspaceExecutor', workspaceUri, error: error.message }
    );

    this.runningWorkspaces.delete(workspaceUri);
    this.failedWorkspaces.set(workspaceUri, error);
    this.notifyStatusChanged();

    // Continue processing queue
    if (this.isExecuting) {
      this.processQueue();
    }
  }

  /**
   * Waits for a workspace slot to become available
   */
  private async waitForWorkspaceSlot(): Promise<void> {
    return new Promise((resolve) => {
      const checkInterval = setInterval(() => {
        if (this.runningWorkspaces.size < this.maxConcurrentWorkspaces || !this.isExecuting) {
          clearInterval(checkInterval);
          resolve();
        }
      }, 500);
    });
  }

  /**
   * Estimates completion time
   * @returns Estimated completion time or undefined
   */
  private estimateCompletionTime(): Date | undefined {
    if (!this.startTime || this.completedWorkspaces.size === 0) {
      return undefined;
    }

    const elapsed = Date.now() - this.startTime.getTime();
    const avgTimePerWorkspace = elapsed / this.completedWorkspaces.size;
    const remainingWorkspaces =
      this.runningWorkspaces.size + this.queuedWorkspaces.length;

    if (remainingWorkspaces === 0) {
      return undefined;
    }

    const estimatedRemainingTime = avgTimePerWorkspace * remainingWorkspaces;
    return new Date(Date.now() + estimatedRemainingTime);
  }

  /**
   * Notifies listeners of status changes
   */
  private notifyStatusChanged(): void {
    if (this.onStatusChangedCallback) {
      this.onStatusChangedCallback(this.getStatus());
    }
  }

  /**
   * Disposes of resources
   */
  dispose(): void {
    this.stopConcurrentAutomation();
    this.disposables.forEach((d) => d.dispose());
    this.disposables = [];
  }
}
