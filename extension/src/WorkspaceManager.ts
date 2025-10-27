import * as vscode from 'vscode';
import { TaskManager } from './TaskManager';
import { AutomationEngine, AutomationEngineConfig } from './AutomationEngine';
import { ChangeDetectionResult } from './ChangeDetector';
import { KiroInterface } from './KiroInterface';
import { NotificationService } from './NotificationService';
import { AutomationSession } from './models/ExecutionContext';

/**
 * Workspace context information with automation support
 */
export interface WorkspaceContext {
  /** Workspace folder URI */
  uri: vscode.Uri;

  /** Workspace folder name */
  name: string;

  /** Workspace folder index */
  index: number;

  /** Task manager for this workspace */
  taskManager: TaskManager;

  /** Automation engine for this workspace */
  automationEngine?: AutomationEngine;

  /** Whether this workspace has a .kiro directory */
  hasKiroDirectory: boolean;

  /** Current automation session for this workspace */
  currentSession?: AutomationSession;

  /** Workspace-specific configuration */
  config?: Partial<AutomationEngineConfig>;

  /** Last activity timestamp */
  lastActivity: Date;

  /** Whether automation is active in this workspace */
  isAutomationActive: boolean;
}

/**
 * Workspace change event
 */
export interface WorkspaceChangeEvent {
  /** Type of change */
  type: 'added' | 'removed' | 'modified';

  /** Workspace context */
  context: WorkspaceContext;

  /** Timestamp of change */
  timestamp: Date;
}

/**
 * WorkspaceManager class
 * Manages multi-root workspaces with per-workspace automation sessions
 */
export class WorkspaceManager {
  private workspaceContexts: Map<string, WorkspaceContext> = new Map();
  private disposables: vscode.Disposable[] = [];
  private onWorkspaceChangedCallback?: (event: WorkspaceChangeEvent) => void;
  private onTasksChangedCallback?: (
    workspaceUri: string,
    changes: ChangeDetectionResult
  ) => void;
  private kiroInterface?: KiroInterface;
  private notificationService?: NotificationService;
  private extensionContext?: vscode.ExtensionContext;
  private activeWorkspaceUri?: string;

  constructor() {
    this.setupWorkspaceMonitoring();
  }

  /**
   * Initializes the workspace manager
   * @param kiroInterface Kiro interface instance
   * @param notificationService Notification service instance
   * @param context Extension context
   */
  async initialize(
    kiroInterface: KiroInterface,
    notificationService: NotificationService,
    context: vscode.ExtensionContext
  ): Promise<void> {
    this.kiroInterface = kiroInterface;
    this.notificationService = notificationService;
    this.extensionContext = context;

    // Initialize existing workspace folders
    await this.initializeWorkspaceFolders();
  }

  /**
   * Sets up workspace monitoring
   */
  private setupWorkspaceMonitoring(): void {
    // Monitor workspace folder changes
    const workspaceFoldersChangeDisposable = vscode.workspace.onDidChangeWorkspaceFolders(
      (event) => {
        this.handleWorkspaceFoldersChange(event);
      }
    );

    this.disposables.push(workspaceFoldersChangeDisposable);
  }

  /**
   * Initializes existing workspace folders
   */
  private async initializeWorkspaceFolders(): Promise<void> {
    const workspaceFolders = vscode.workspace.workspaceFolders;

    if (!workspaceFolders || workspaceFolders.length === 0) {
      console.log('[WorkspaceManager] No workspace folders found');
      return;
    }

    console.log(`[WorkspaceManager] Initializing ${workspaceFolders.length} workspace folder(s)`);

    for (let i = 0; i < workspaceFolders.length; i++) {
      const folder = workspaceFolders[i];
      await this.addWorkspaceFolder(folder, i);
    }
  }

  /**
   * Handles workspace folder changes
   * @param event Workspace folders change event
   */
  private async handleWorkspaceFoldersChange(
    event: vscode.WorkspaceFoldersChangeEvent
  ): Promise<void> {
    console.log(
      `[WorkspaceManager] Workspace folders changed: ${event.added.length} added, ${event.removed.length} removed`
    );

    // Handle removed folders
    for (const folder of event.removed) {
      await this.removeWorkspaceFolder(folder);
    }

    // Handle added folders
    for (const folder of event.added) {
      const index = vscode.workspace.workspaceFolders?.indexOf(folder) ?? 0;
      await this.addWorkspaceFolder(folder, index);
    }
  }

  /**
   * Adds a workspace folder
   * @param folder Workspace folder
   * @param index Folder index
   */
  private async addWorkspaceFolder(
    folder: vscode.WorkspaceFolder,
    index: number
  ): Promise<void> {
    const uri = folder.uri.toString();

    // Check if already exists
    if (this.workspaceContexts.has(uri)) {
      console.log(`[WorkspaceManager] Workspace folder ${folder.name} already exists`);
      return;
    }

    console.log(`[WorkspaceManager] Adding workspace folder: ${folder.name} at ${folder.uri.fsPath}`);

    // Check if workspace has .kiro directory
    const hasKiroDirectory = await this.checkKiroDirectory(folder.uri);

    if (!hasKiroDirectory) {
      console.log(`[WorkspaceManager] Workspace folder ${folder.name} does not have .kiro directory, skipping`);
      return;
    }

    // Create task manager for this workspace
    const taskManager = new TaskManager(folder.uri.fsPath);

    // Set up task change listener
    taskManager.onTasksChanged((changes) => {
      if (this.onTasksChangedCallback) {
        this.onTasksChangedCallback(uri, changes);
      }
    });

    // Discover tasks
    try {
      await taskManager.discoverTasks();
      await taskManager.cacheFileContents();

      // Set up file watchers
      taskManager.setupFileWatchers();

      // Load workspace-specific configuration
      const config = await this.loadWorkspaceConfig(folder.uri);

      // Create workspace context
      const context: WorkspaceContext = {
        uri: folder.uri,
        name: folder.name,
        index,
        taskManager,
        hasKiroDirectory,
        config,
        lastActivity: new Date(),
        isAutomationActive: false,
      };

      this.workspaceContexts.set(uri, context);
      console.log(`[WorkspaceManager] Workspace folder ${folder.name} initialized successfully`);

      // Notify listeners
      this.notifyWorkspaceChanged({
        type: 'added',
        context,
        timestamp: new Date(),
      });

      // Set as active workspace if it's the first one
      if (!this.activeWorkspaceUri) {
        this.activeWorkspaceUri = uri;
      }
    } catch (error) {
      console.error(`[WorkspaceManager] Error initializing workspace folder ${folder.name}:`, error);
    }
  }

  /**
   * Removes a workspace folder
   * @param folder Workspace folder
   */
  private async removeWorkspaceFolder(folder: vscode.WorkspaceFolder): Promise<void> {
    const uri = folder.uri.toString();
    const context = this.workspaceContexts.get(uri);

    if (!context) {
      return;
    }

    console.log(`[WorkspaceManager] Removing workspace folder: ${folder.name}`);

    // Stop automation if running
    if (context.automationEngine && context.automationEngine.isRunning()) {
      await context.automationEngine.stop();
    }

    // Dispose automation engine
    if (context.automationEngine) {
      context.automationEngine.dispose();
    }

    // Dispose task manager
    context.taskManager.dispose();

    // Notify listeners before removal
    this.notifyWorkspaceChanged({
      type: 'removed',
      context,
      timestamp: new Date(),
    });

    // Remove from map
    this.workspaceContexts.delete(uri);

    // Update active workspace if needed
    if (this.activeWorkspaceUri === uri) {
      const remaining = this.getWorkspaceContexts();
      this.activeWorkspaceUri = remaining.length > 0 ? remaining[0].uri.toString() : undefined;
    }
  }

  /**
   * Checks if workspace has .kiro directory
   * @param workspaceUri Workspace URI
   * @returns True if .kiro directory exists
   */
  private async checkKiroDirectory(workspaceUri: vscode.Uri): Promise<boolean> {
    try {
      const kiroUri = vscode.Uri.joinPath(workspaceUri, '.kiro');
      const stat = await vscode.workspace.fs.stat(kiroUri);
      return stat.type === vscode.FileType.Directory;
    } catch (error) {
      return false;
    }
  }

  /**
   * Loads workspace-specific configuration
   * @param workspaceUri Workspace URI
   * @returns Workspace configuration
   */
  private async loadWorkspaceConfig(
    workspaceUri: vscode.Uri
  ): Promise<Partial<AutomationEngineConfig>> {
    try {
      // Try to load from workspace settings
      const config = vscode.workspace.getConfiguration('kiro-automation', workspaceUri);

      return {
        maxRetries: config.get<number>('retryAttempts'),
        taskTimeout: config.get<number>('timeout'),
        taskDelay: config.get<number>('taskDelay'),
        skipOptionalTasks: config.get<boolean>('skipOptionalTasks'),
        continueOnFailure: config.get<boolean>('continueOnFailure'),
        verboseLogging: config.get<string>('logLevel') === 'debug',
      };
    } catch (error) {
      console.error(`[WorkspaceManager] Error loading workspace config:`, error);
      return {};
    }
  }

  /**
   * Creates an automation engine for a workspace
   * @param workspaceUri Workspace URI
   * @returns Automation engine
   */
  async createAutomationEngine(workspaceUri: string): Promise<AutomationEngine> {
    const context = this.workspaceContexts.get(workspaceUri);
    if (!context) {
      throw new Error(`Workspace ${workspaceUri} not found`);
    }

    if (!this.kiroInterface || !this.notificationService || !this.extensionContext) {
      throw new Error('WorkspaceManager not initialized');
    }

    // Create automation engine with workspace-specific config
    const engine = new AutomationEngine(context.config);

    // Initialize the engine
    await engine.initialize(
      context.taskManager,
      this.kiroInterface,
      this.notificationService,
      this.extensionContext
    );

    // Store in context
    context.automationEngine = engine;
    context.isAutomationActive = false;

    return engine;
  }

  /**
   * Gets automation engine for a workspace
   * @param workspaceUri Workspace URI
   * @returns Automation engine or undefined
   */
  getAutomationEngine(workspaceUri: string): AutomationEngine | undefined {
    const context = this.workspaceContexts.get(workspaceUri);
    return context?.automationEngine;
  }

  /**
   * Starts automation for a workspace
   * @param workspaceUri Workspace URI
   */
  async startAutomation(workspaceUri: string): Promise<void> {
    const context = this.workspaceContexts.get(workspaceUri);
    if (!context) {
      throw new Error(`Workspace ${workspaceUri} not found`);
    }

    // Create engine if it doesn't exist
    if (!context.automationEngine) {
      await this.createAutomationEngine(workspaceUri);
    }

    // Start automation
    if (context.automationEngine) {
      await context.automationEngine.start();
      context.isAutomationActive = true;
      context.lastActivity = new Date();

      // Notify listeners
      this.notifyWorkspaceChanged({
        type: 'modified',
        context,
        timestamp: new Date(),
      });
    }
  }

  /**
   * Stops automation for a workspace
   * @param workspaceUri Workspace URI
   */
  async stopAutomation(workspaceUri: string): Promise<void> {
    const context = this.workspaceContexts.get(workspaceUri);
    if (!context || !context.automationEngine) {
      return;
    }

    await context.automationEngine.stop();
    context.isAutomationActive = false;
    context.lastActivity = new Date();

    // Notify listeners
    this.notifyWorkspaceChanged({
      type: 'modified',
      context,
      timestamp: new Date(),
    });
  }

  /**
   * Pauses automation for a workspace
   * @param workspaceUri Workspace URI
   */
  async pauseAutomation(workspaceUri: string): Promise<void> {
    const context = this.workspaceContexts.get(workspaceUri);
    if (!context || !context.automationEngine) {
      return;
    }

    await context.automationEngine.pause();
    context.lastActivity = new Date();
  }

  /**
   * Resumes automation for a workspace
   * @param workspaceUri Workspace URI
   */
  async resumeAutomation(workspaceUri: string): Promise<void> {
    const context = this.workspaceContexts.get(workspaceUri);
    if (!context || !context.automationEngine) {
      return;
    }

    await context.automationEngine.resume();
    context.isAutomationActive = true;
    context.lastActivity = new Date();
  }

  /**
   * Gets all workspace contexts
   * @returns Array of workspace contexts
   */
  getWorkspaceContexts(): WorkspaceContext[] {
    return Array.from(this.workspaceContexts.values());
  }

  /**
   * Gets workspace context by URI
   * @param uri Workspace URI
   * @returns Workspace context or undefined
   */
  getWorkspaceContext(uri: string): WorkspaceContext | undefined {
    return this.workspaceContexts.get(uri);
  }

  /**
   * Gets workspace context by name
   * @param name Workspace name
   * @returns Workspace context or undefined
   */
  getWorkspaceContextByName(name: string): WorkspaceContext | undefined {
    for (const context of this.workspaceContexts.values()) {
      if (context.name === name) {
        return context;
      }
    }
    return undefined;
  }

  /**
   * Gets the active workspace context
   * @returns Active workspace context or undefined
   */
  getActiveWorkspaceContext(): WorkspaceContext | undefined {
    if (this.activeWorkspaceUri) {
      return this.workspaceContexts.get(this.activeWorkspaceUri);
    }

    // Fallback to first workspace
    const contexts = this.getWorkspaceContexts();
    return contexts.length > 0 ? contexts[0] : undefined;
  }

  /**
   * Sets the active workspace
   * @param workspaceUri Workspace URI
   */
  setActiveWorkspace(workspaceUri: string): void {
    if (this.workspaceContexts.has(workspaceUri)) {
      this.activeWorkspaceUri = workspaceUri;
      console.log(`[WorkspaceManager] Active workspace set to: ${workspaceUri}`);
    }
  }

  /**
   * Checks if running in multi-root workspace
   * @returns True if multi-root workspace
   */
  isMultiRootWorkspace(): boolean {
    return this.workspaceContexts.size > 1;
  }

  /**
   * Gets task manager for a specific workspace
   * @param workspaceUri Workspace URI
   * @returns Task manager or undefined
   */
  getTaskManager(workspaceUri: string): TaskManager | undefined {
    const context = this.workspaceContexts.get(workspaceUri);
    return context?.taskManager;
  }

  /**
   * Gets all task managers
   * @returns Array of task managers
   */
  getAllTaskManagers(): TaskManager[] {
    return Array.from(this.workspaceContexts.values()).map((context) => context.taskManager);
  }

  /**
   * Gets workspaces with active automation
   * @returns Array of workspace contexts with active automation
   */
  getActiveAutomationWorkspaces(): WorkspaceContext[] {
    return this.getWorkspaceContexts().filter((context) => context.isAutomationActive);
  }

  /**
   * Refreshes all workspaces
   */
  async refreshAllWorkspaces(): Promise<void> {
    console.log('[WorkspaceManager] Refreshing all workspaces');

    for (const context of this.workspaceContexts.values()) {
      try {
        await context.taskManager.discoverTasks();
        await context.taskManager.cacheFileContents();
        console.log(`[WorkspaceManager] Refreshed workspace: ${context.name}`);
      } catch (error) {
        console.error(`[WorkspaceManager] Error refreshing workspace ${context.name}:`, error);
      }
    }
  }

  /**
   * Refreshes a specific workspace
   * @param workspaceUri Workspace URI
   */
  async refreshWorkspace(workspaceUri: string): Promise<void> {
    const context = this.workspaceContexts.get(workspaceUri);
    if (!context) {
      throw new Error(`Workspace ${workspaceUri} not found`);
    }

    await context.taskManager.discoverTasks();
    await context.taskManager.cacheFileContents();
    context.lastActivity = new Date();

    console.log(`[WorkspaceManager] Refreshed workspace: ${context.name}`);
  }

  /**
   * Updates workspace configuration
   * @param workspaceUri Workspace URI
   * @param config Configuration to update
   */
  async updateWorkspaceConfig(
    workspaceUri: string,
    config: Partial<AutomationEngineConfig>
  ): Promise<void> {
    const context = this.workspaceContexts.get(workspaceUri);
    if (!context) {
      throw new Error(`Workspace ${workspaceUri} not found`);
    }

    // Update context config
    context.config = { ...context.config, ...config };

    // Update automation engine config if it exists
    if (context.automationEngine) {
      context.automationEngine.updateConfig(config);
    }

    console.log(`[WorkspaceManager] Updated config for workspace: ${context.name}`);
  }

  /**
   * Registers a callback for workspace changes
   * @param callback Callback function
   */
  onWorkspaceChanged(callback: (event: WorkspaceChangeEvent) => void): void {
    this.onWorkspaceChangedCallback = callback;
  }

  /**
   * Registers a callback for task changes
   * @param callback Callback function
   */
  onTasksChanged(
    callback: (workspaceUri: string, changes: ChangeDetectionResult) => void
  ): void {
    this.onTasksChangedCallback = callback;
  }

  /**
   * Notifies listeners of workspace changes
   */
  private notifyWorkspaceChanged(event: WorkspaceChangeEvent): void {
    if (this.onWorkspaceChangedCallback) {
      this.onWorkspaceChangedCallback(event);
    }
  }

  /**
   * Gets workspace statistics
   * @param workspaceUri Workspace URI
   * @returns Workspace statistics
   */
  getWorkspaceStatistics(workspaceUri: string): any {
    const context = this.workspaceContexts.get(workspaceUri);
    if (!context) {
      return null;
    }

    const tasks = context.taskManager.getTasks();
    const completedTasks = tasks.filter((t) => t.status === 'completed').length;
    const pendingTasks = tasks.filter((t) => t.status === 'pending').length;
    const inProgressTasks = tasks.filter((t) => t.status === 'in_progress').length;

    return {
      name: context.name,
      uri: context.uri.toString(),
      totalTasks: tasks.length,
      completedTasks,
      pendingTasks,
      inProgressTasks,
      isAutomationActive: context.isAutomationActive,
      lastActivity: context.lastActivity,
      currentSession: context.currentSession,
    };
  }

  /**
   * Gets statistics for all workspaces
   * @returns Array of workspace statistics
   */
  getAllWorkspaceStatistics(): any[] {
    return this.getWorkspaceContexts().map((context) =>
      this.getWorkspaceStatistics(context.uri.toString())
    );
  }

  /**
   * Disposes all resources
   */
  dispose(): void {
    console.log('[WorkspaceManager] Disposing...');

    // Dispose all automation engines and task managers
    for (const context of this.workspaceContexts.values()) {
      if (context.automationEngine) {
        context.automationEngine.dispose();
      }
      context.taskManager.dispose();
    }

    // Clear contexts
    this.workspaceContexts.clear();

    // Dispose event listeners
    this.disposables.forEach((disposable) => disposable.dispose());
    this.disposables = [];

    // Clear callbacks
    this.onWorkspaceChangedCallback = undefined;
    this.onTasksChangedCallback = undefined;

    console.log('[WorkspaceManager] Disposed');
  }
}
