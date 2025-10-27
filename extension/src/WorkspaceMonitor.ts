import * as vscode from 'vscode';
import { TaskManager } from './TaskManager';
import { ChangeDetectionResult } from './ChangeDetector';

/**
 * Workspace context information
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

  /** Whether this workspace has a .kiro directory */
  hasKiroDirectory: boolean;
}

/**
 * WorkspaceMonitor class
 * Handles workspace folder changes and multi-root workspace scenarios
 */
export class WorkspaceMonitor {
  private workspaceContexts: Map<string, WorkspaceContext> = new Map();
  private disposables: vscode.Disposable[] = [];
  private onWorkspaceChangedCallback?: (contexts: WorkspaceContext[]) => void;
  private onTasksChangedCallback?: (
    workspaceUri: string,
    changes: ChangeDetectionResult
  ) => void;

  constructor() {
    this.setupWorkspaceMonitoring();
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

    // Initialize existing workspace folders
    this.initializeWorkspaceFolders();
  }

  /**
   * Initializes existing workspace folders
   */
  private async initializeWorkspaceFolders(): Promise<void> {
    const workspaceFolders = vscode.workspace.workspaceFolders;

    if (!workspaceFolders || workspaceFolders.length === 0) {
      console.log('No workspace folders found');
      return;
    }

    console.log(`Initializing ${workspaceFolders.length} workspace folder(s)`);

    for (let i = 0; i < workspaceFolders.length; i++) {
      const folder = workspaceFolders[i];
      await this.addWorkspaceFolder(folder, i);
    }

    // Notify listeners
    this.notifyWorkspaceChanged();
  }

  /**
   * Handles workspace folder changes
   * @param event Workspace folders change event
   */
  private async handleWorkspaceFoldersChange(
    event: vscode.WorkspaceFoldersChangeEvent
  ): Promise<void> {
    console.log(
      `Workspace folders changed: ${event.added.length} added, ${event.removed.length} removed`
    );

    // Handle removed folders
    for (const folder of event.removed) {
      this.removeWorkspaceFolder(folder);
    }

    // Handle added folders
    for (const folder of event.added) {
      const index = vscode.workspace.workspaceFolders?.indexOf(folder) ?? 0;
      await this.addWorkspaceFolder(folder, index);
    }

    // Notify listeners
    this.notifyWorkspaceChanged();
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
      console.log(`Workspace folder ${folder.name} already exists`);
      return;
    }

    console.log(`Adding workspace folder: ${folder.name} at ${folder.uri.fsPath}`);

    // Check if workspace has .kiro directory
    const hasKiroDirectory = await this.checkKiroDirectory(folder.uri);

    if (!hasKiroDirectory) {
      console.log(`Workspace folder ${folder.name} does not have .kiro directory, skipping`);
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

      // Create workspace context
      const context: WorkspaceContext = {
        uri: folder.uri,
        name: folder.name,
        index,
        taskManager,
        hasKiroDirectory,
      };

      this.workspaceContexts.set(uri, context);
      console.log(`Workspace folder ${folder.name} initialized successfully`);
    } catch (error) {
      console.error(`Error initializing workspace folder ${folder.name}:`, error);
    }
  }

  /**
   * Removes a workspace folder
   * @param folder Workspace folder
   */
  private removeWorkspaceFolder(folder: vscode.WorkspaceFolder): void {
    const uri = folder.uri.toString();
    const context = this.workspaceContexts.get(uri);

    if (!context) {
      return;
    }

    console.log(`Removing workspace folder: ${folder.name}`);

    // Dispose task manager
    context.taskManager.dispose();

    // Remove from map
    this.workspaceContexts.delete(uri);
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
    const activeEditor = vscode.window.activeTextEditor;
    if (!activeEditor) {
      // Return first workspace if no active editor
      const contexts = this.getWorkspaceContexts();
      return contexts.length > 0 ? contexts[0] : undefined;
    }

    const workspaceFolder = vscode.workspace.getWorkspaceFolder(activeEditor.document.uri);
    if (!workspaceFolder) {
      return undefined;
    }

    return this.workspaceContexts.get(workspaceFolder.uri.toString());
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
   * Refreshes all workspaces
   */
  async refreshAllWorkspaces(): Promise<void> {
    console.log('Refreshing all workspaces');

    for (const context of this.workspaceContexts.values()) {
      try {
        await context.taskManager.discoverTasks();
        await context.taskManager.cacheFileContents();
        console.log(`Refreshed workspace: ${context.name}`);
      } catch (error) {
        console.error(`Error refreshing workspace ${context.name}:`, error);
      }
    }
  }

  /**
   * Registers a callback for workspace changes
   * @param callback Callback function
   */
  onWorkspaceChanged(callback: (contexts: WorkspaceContext[]) => void): void {
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
  private notifyWorkspaceChanged(): void {
    if (this.onWorkspaceChangedCallback) {
      this.onWorkspaceChangedCallback(this.getWorkspaceContexts());
    }
  }

  /**
   * Disposes all resources
   */
  dispose(): void {
    // Dispose all task managers
    for (const context of this.workspaceContexts.values()) {
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
  }
}
