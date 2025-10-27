import * as vscode from 'vscode';
import { StatusBarManager } from './StatusBarManager';
import { TaskTreeDataProvider, TaskTreeItem } from './TaskTreeDataProvider';
import { ProgressPanel, ProgressInfo } from './ProgressPanel';
import { ControlPanel, ControlPanelState } from './ControlPanel';
import { LogViewer } from './LogViewer';
import { WorkspaceSelectorProvider, WorkspaceSelectorItem } from './WorkspaceSelectorProvider';
import { ConcurrentExecutionPanel } from './ConcurrentExecutionPanel';
import { AnalyticsDashboard } from './AnalyticsDashboard';
import { Task } from '../models/Task';
import { ConcurrentExecutionStatus } from '../ConcurrentWorkspaceExecutor';
import { TelemetryService } from '../TelemetryService';

/**
 * Main UI Controller that manages all UI components
 */
export class UIController {
  private statusBarManager: StatusBarManager;
  private taskTreeDataProvider: TaskTreeDataProvider;
  private workspaceSelectorProvider: WorkspaceSelectorProvider;
  private logViewer: LogViewer;
  private analyticsDashboard?: AnalyticsDashboard;
  private treeView: vscode.TreeView<TaskTreeItem>;
  private workspaceSelectorView: vscode.TreeView<WorkspaceSelectorItem>;
  private onWorkspaceSelectedCallback?: (workspaceUri: string) => void;

  constructor(private context: vscode.ExtensionContext, private telemetryService?: TelemetryService) {
    // Initialize UI components
    this.statusBarManager = new StatusBarManager();
    this.taskTreeDataProvider = new TaskTreeDataProvider();
    this.workspaceSelectorProvider = new WorkspaceSelectorProvider();
    this.logViewer = new LogViewer(context);
    
    // Initialize analytics dashboard if telemetry is available
    if (telemetryService) {
      this.analyticsDashboard = new AnalyticsDashboard(context, telemetryService);
    }

    // Register tree views
    this.treeView = vscode.window.createTreeView('kiro-automation-tasks', {
      treeDataProvider: this.taskTreeDataProvider,
      showCollapseAll: true
    });

    this.workspaceSelectorView = vscode.window.createTreeView('kiro-automation-workspaces', {
      treeDataProvider: this.workspaceSelectorProvider,
      showCollapseAll: false
    });

    // Register commands
    this.registerCommands();

    // Add to subscriptions
    context.subscriptions.push(
      this.statusBarManager,
      this.treeView,
      this.workspaceSelectorView,
      this.logViewer
    );
  }

  /**
   * Register UI-related commands
   */
  private registerCommands(): void {
    // Show progress panel
    this.context.subscriptions.push(
      vscode.commands.registerCommand('kiro-automation.showPanel', () => {
        ProgressPanel.createOrShow(this.context.extensionUri);
      })
    );

    // Show control panel
    this.context.subscriptions.push(
      vscode.commands.registerCommand('kiro-automation.showControls', () => {
        ControlPanel.createOrShow(this.context.extensionUri);
      })
    );

    // Show logs
    this.context.subscriptions.push(
      vscode.commands.registerCommand('kiro-automation.showLogs', () => {
        this.logViewer.show();
      })
    );

    // Clear logs
    this.context.subscriptions.push(
      vscode.commands.registerCommand('kiro-automation.clearLogs', () => {
        this.logViewer.clear();
        vscode.window.showInformationMessage('Logs cleared');
      })
    );

    // Export logs
    this.context.subscriptions.push(
      vscode.commands.registerCommand('kiro-automation.exportLogs', async () => {
        const format = await vscode.window.showQuickPick(
          ['txt', 'json', 'csv'],
          { placeHolder: 'Select export format' }
        );
        if (format) {
          await this.logViewer.exportLogs(format as 'txt' | 'json' | 'csv');
        }
      })
    );

    // Open log file
    this.context.subscriptions.push(
      vscode.commands.registerCommand('kiro-automation.openLogFile', async () => {
        await this.logViewer.openLogFile();
      })
    );

    // Refresh tree view
    this.context.subscriptions.push(
      vscode.commands.registerCommand('kiro-automation.refreshTasks', () => {
        this.taskTreeDataProvider.refresh();
      })
    );

    // Select task (from tree view)
    this.context.subscriptions.push(
      vscode.commands.registerCommand('kiro-automation.selectTask', (task: Task) => {
        vscode.window.showInformationMessage(`Selected task: ${task.title}`);
      })
    );

    // Switch workspace
    this.context.subscriptions.push(
      vscode.commands.registerCommand('kiro-automation.switchWorkspace', async () => {
        await this.showWorkspaceSwitcher();
      })
    );

    // Show workspace configuration
    this.context.subscriptions.push(
      vscode.commands.registerCommand('kiro-automation.showWorkspaceConfig', async () => {
        await this.showWorkspaceConfiguration();
      })
    );

    // Select workspace (from tree view)
    this.context.subscriptions.push(
      vscode.commands.registerCommand('kiro-automation.selectWorkspace', (workspaceUri: string) => {
        this.logViewer.info(`Workspace selected: ${workspaceUri}`, 'UIController');
        if (this.onWorkspaceSelectedCallback) {
          this.onWorkspaceSelectedCallback(workspaceUri);
        }
      })
    );

    // Edit workspace configuration
    this.context.subscriptions.push(
      vscode.commands.registerCommand('kiro-automation.editWorkspaceConfig', async () => {
        await this.editWorkspaceConfiguration();
      })
    );

    // Reset workspace configuration
    this.context.subscriptions.push(
      vscode.commands.registerCommand('kiro-automation.resetWorkspaceConfig', async () => {
        await this.resetWorkspaceConfiguration();
      })
    );

    // Show concurrent execution panel
    this.context.subscriptions.push(
      vscode.commands.registerCommand('kiro-automation.showConcurrentPanel', () => {
        ConcurrentExecutionPanel.createOrShow(this.context.extensionUri);
      })
    );

    // Show analytics dashboard
    this.context.subscriptions.push(
      vscode.commands.registerCommand('kiro-automation.showAnalytics', async () => {
        if (this.analyticsDashboard) {
          await this.analyticsDashboard.show();
        } else {
          vscode.window.showWarningMessage('Analytics dashboard is not available. Telemetry may be disabled.');
        }
      })
    );
  }

  /**
   * Show workspace switcher quick pick
   */
  private async showWorkspaceSwitcher(): Promise<string | undefined> {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    
    if (!workspaceFolders || workspaceFolders.length === 0) {
      vscode.window.showWarningMessage('No workspace folders found');
      return undefined;
    }

    if (workspaceFolders.length === 1) {
      vscode.window.showInformationMessage('Only one workspace folder available');
      return workspaceFolders[0].uri.toString();
    }

    const items = workspaceFolders.map((folder) => ({
      label: folder.name,
      description: folder.uri.fsPath,
      uri: folder.uri.toString(),
    }));

    const selected = await vscode.window.showQuickPick(items, {
      placeHolder: 'Select workspace to switch to',
      matchOnDescription: true,
    });

    if (selected) {
      this.logViewer.info(`Switched to workspace: ${selected.label}`, 'UIController');
      return selected.uri;
    }

    return undefined;
  }

  /**
   * Show workspace configuration viewer
   */
  private async showWorkspaceConfiguration(): Promise<void> {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    
    if (!workspaceFolders || workspaceFolders.length === 0) {
      vscode.window.showWarningMessage('No workspace folders found');
      return;
    }

    // Let user select workspace
    let selectedUri: string;
    
    if (workspaceFolders.length === 1) {
      selectedUri = workspaceFolders[0].uri.toString();
    } else {
      const items = workspaceFolders.map((folder) => ({
        label: folder.name,
        description: folder.uri.fsPath,
        uri: folder.uri.toString(),
      }));

      const selected = await vscode.window.showQuickPick(items, {
        placeHolder: 'Select workspace to view configuration',
        matchOnDescription: true,
      });

      if (!selected) {
        return;
      }

      selectedUri = selected.uri;
    }

    // Get configuration
    const config = vscode.workspace.getConfiguration('kiro-automation', vscode.Uri.parse(selectedUri));
    const configObj: any = {};

    // Collect all configuration values
    const keys = [
      'enabled',
      'concurrency',
      'retryAttempts',
      'timeout',
      'taskDelay',
      'skipOptionalTasks',
      'continueOnFailure',
      'logLevel',
      'notificationLevel',
      'autoSaveProgress',
      'maxConcurrentWorkspaces',
    ];

    for (const key of keys) {
      const inspect = config.inspect(key);
      if (inspect) {
        configObj[key] = {
          value: config.get(key),
          workspaceValue: inspect.workspaceValue,
          workspaceFolderValue: inspect.workspaceFolderValue,
          globalValue: inspect.globalValue,
          defaultValue: inspect.defaultValue,
        };
      }
    }

    // Show in new document
    const doc = await vscode.workspace.openTextDocument({
      content: JSON.stringify(configObj, null, 2),
      language: 'json',
    });

    await vscode.window.showTextDocument(doc);
  }

  /**
   * Edit workspace configuration
   */
  private async editWorkspaceConfiguration(): Promise<void> {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    
    if (!workspaceFolders || workspaceFolders.length === 0) {
      vscode.window.showWarningMessage('No workspace folders found');
      return;
    }

    // Let user select workspace if multiple
    if (workspaceFolders.length > 1) {
      const items = workspaceFolders.map((folder) => ({
        label: folder.name,
        description: folder.uri.fsPath,
        uri: folder.uri,
      }));

      const selected = await vscode.window.showQuickPick(items, {
        placeHolder: 'Select workspace to edit configuration',
        matchOnDescription: true,
      });

      if (!selected) {
        return;
      }
    }

    // Open workspace settings
    await vscode.commands.executeCommand('workbench.action.openWorkspaceSettings', {
      query: 'kiro-automation',
      openToSide: false,
    });
  }

  /**
   * Reset workspace configuration
   */
  private async resetWorkspaceConfiguration(): Promise<void> {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    
    if (!workspaceFolders || workspaceFolders.length === 0) {
      vscode.window.showWarningMessage('No workspace folders found');
      return;
    }

    // Let user select workspace
    let selectedUri: vscode.Uri;
    let selectedName: string;
    
    if (workspaceFolders.length === 1) {
      selectedUri = workspaceFolders[0].uri;
      selectedName = workspaceFolders[0].name;
    } else {
      const items = workspaceFolders.map((folder) => ({
        label: folder.name,
        description: folder.uri.fsPath,
        uri: folder.uri,
      }));

      const selected = await vscode.window.showQuickPick(items, {
        placeHolder: 'Select workspace to reset configuration',
        matchOnDescription: true,
      });

      if (!selected) {
        return;
      }

      selectedUri = selected.uri;
      selectedName = selected.label;
    }

    // Confirm reset
    const confirm = await vscode.window.showWarningMessage(
      `Reset all Kiro Automation configuration for workspace "${selectedName}" to defaults?`,
      { modal: true },
      'Reset'
    );

    if (confirm !== 'Reset') {
      return;
    }

    // Reset all configuration values
    const config = vscode.workspace.getConfiguration('kiro-automation', selectedUri);
    const keys = [
      'enabled',
      'concurrency',
      'retryAttempts',
      'timeout',
      'taskDelay',
      'skipOptionalTasks',
      'continueOnFailure',
      'logLevel',
      'notificationLevel',
      'autoSaveProgress',
      'maxConcurrentWorkspaces',
    ];

    try {
      for (const key of keys) {
        await config.update(key, undefined, vscode.ConfigurationTarget.Workspace);
      }

      vscode.window.showInformationMessage(
        `Configuration reset for workspace "${selectedName}"`
      );
      this.logViewer.info(`Configuration reset for workspace: ${selectedName}`, 'UIController');
    } catch (error) {
      vscode.window.showErrorMessage(`Failed to reset configuration: ${error}`);
      this.logViewer.error(`Failed to reset configuration: ${error}`, 'UIController');
    }
  }

  /**
   * Update UI when automation starts
   */
  public onAutomationStart(totalTasks: number): void {
    this.statusBarManager.onAutomationStart(totalTasks);
    this.logViewer.info('Automation started', 'UIController');

    // Update progress panel
    const progressPanel = ProgressPanel.currentPanel;
    if (progressPanel) {
      progressPanel.updateProgress({
        isRunning: true,
        totalCount: totalTasks,
        completedCount: 0,
        failedCount: 0,
        skippedCount: 0,
        startTime: new Date(),
        estimatedTimeRemaining: null
      });
    }

    // Update control panel
    const controlPanel = ControlPanel.currentPanel;
    if (controlPanel) {
      controlPanel.updateState({
        isRunning: true,
        isPaused: false,
        canStart: false,
        canStop: true,
        canPause: true,
        canResume: false
      });
    }
  }

  /**
   * Update UI when automation stops
   */
  public onAutomationStop(): void {
    this.statusBarManager.onAutomationStop();
    this.logViewer.info('Automation stopped', 'UIController');

    // Update progress panel
    const progressPanel = ProgressPanel.currentPanel;
    if (progressPanel) {
      progressPanel.updateProgress({
        isRunning: false
      });
    }

    // Update control panel
    const controlPanel = ControlPanel.currentPanel;
    if (controlPanel) {
      controlPanel.updateState({
        isRunning: false,
        isPaused: false,
        canStart: true,
        canStop: false,
        canPause: false,
        canResume: false
      });
    }
  }

  /**
   * Update UI with current task
   */
  public updateTask(task: Task, completed: number, total: number): void {
    this.statusBarManager.updateTask(task, completed, total);
    this.logViewer.info(`Executing task: ${task.title}`, 'UIController');

    // Update progress panel
    const progressPanel = ProgressPanel.currentPanel;
    if (progressPanel) {
      progressPanel.updateTask(task);
      progressPanel.updateProgress({
        currentTask: task,
        completedCount: completed,
        totalCount: total
      });
    }

    // Refresh tree view
    this.taskTreeDataProvider.refresh();
  }

  /**
   * Update progress information
   */
  public updateProgress(info: Partial<ProgressInfo>): void {
    const progressPanel = ProgressPanel.currentPanel;
    if (progressPanel) {
      progressPanel.updateProgress(info);
    }
  }

  /**
   * Update control panel state
   */
  public updateControlState(state: Partial<ControlPanelState>): void {
    const controlPanel = ControlPanel.currentPanel;
    if (controlPanel) {
      controlPanel.updateState(state);
    }
  }

  /**
   * Update tasks in tree view
   */
  public updateTasks(tasksBySpec: Map<string, Task[]>): void {
    this.taskTreeDataProvider.setTasks(tasksBySpec);
  }

  /**
   * Show error in UI
   */
  public showError(message: string, context?: string): void {
    this.statusBarManager.showError(message);
    this.logViewer.error(message, context);
    vscode.window.showErrorMessage(`Kiro Automation: ${message}`);
  }

  /**
   * Show warning in UI
   */
  public showWarning(message: string, context?: string): void {
    this.logViewer.warning(message, context);
    vscode.window.showWarningMessage(`Kiro Automation: ${message}`);
  }

  /**
   * Show info message in UI
   */
  public showInfo(message: string, context?: string): void {
    this.logViewer.info(message, context);
    
    const config = vscode.workspace.getConfiguration('kiro-automation');
    const notificationLevel = config.get<string>('notificationLevel', 'all');
    
    if (notificationLevel === 'all') {
      vscode.window.showInformationMessage(`Kiro Automation: ${message}`);
    }
  }

  /**
   * Show progress indicator
   */
  public showProgress(message: string): void {
    this.statusBarManager.showProgress(message);
  }

  /**
   * Get log viewer instance
   */
  public getLogViewer(): LogViewer {
    return this.logViewer;
  }

  /**
   * Get status bar manager instance
   */
  public getStatusBarManager(): StatusBarManager {
    return this.statusBarManager;
  }

  /**
   * Get task tree data provider instance
   */
  public getTaskTreeDataProvider(): TaskTreeDataProvider {
    return this.taskTreeDataProvider;
  }

  /**
   * Get workspace selector provider instance
   */
  public getWorkspaceSelectorProvider(): WorkspaceSelectorProvider {
    return this.workspaceSelectorProvider;
  }

  /**
   * Update active workspace in UI
   * @param workspaceUri Workspace URI
   */
  public setActiveWorkspace(workspaceUri: string): void {
    this.workspaceSelectorProvider.setActiveWorkspace(workspaceUri);
    this.logViewer.info(`Active workspace: ${workspaceUri}`, 'UIController');
  }

  /**
   * Update workspace override status in UI
   * @param workspaceUri Workspace URI
   * @param hasOverrides Whether workspace has configuration overrides
   */
  public setWorkspaceOverrides(workspaceUri: string, hasOverrides: boolean): void {
    this.workspaceSelectorProvider.setWorkspaceOverrides(workspaceUri, hasOverrides);
  }

  /**
   * Update workspace automation status in UI
   * @param workspaceUri Workspace URI
   * @param isActive Whether automation is active
   */
  public setWorkspaceAutomationStatus(workspaceUri: string, isActive: boolean): void {
    this.workspaceSelectorProvider.setAutomationStatus(workspaceUri, isActive);
  }

  /**
   * Refresh workspace selector
   */
  public refreshWorkspaceSelector(): void {
    this.workspaceSelectorProvider.refresh();
  }

  /**
   * Register callback for workspace selection
   * @param callback Callback function
   */
  public onWorkspaceSelected(callback: (workspaceUri: string) => void): void {
    this.onWorkspaceSelectedCallback = callback;
  }

  /**
   * Update concurrent execution status in UI
   * @param status Concurrent execution status
   */
  public updateConcurrentExecutionStatus(status: ConcurrentExecutionStatus): void {
    const panel = ConcurrentExecutionPanel.currentPanel;
    if (panel) {
      panel.updateStatus(status);
    }
  }

  /**
   * Show concurrent execution panel
   */
  public showConcurrentExecutionPanel(): void {
    ConcurrentExecutionPanel.createOrShow(this.context.extensionUri);
  }
}
