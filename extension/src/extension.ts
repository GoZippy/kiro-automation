import * as vscode from 'vscode';
import { UIController } from './ui';
import { WorkspaceMonitor } from './WorkspaceMonitor';
import { AutomationEngine } from './AutomationEngine';
import { KiroInterface } from './KiroInterface';
import { ConfigManager } from './ConfigManager';
import { Logger } from './Logger';
import { NotificationService } from './NotificationService';
import { TelemetryService } from './TelemetryService';
import { HelpPanel } from './ui/HelpPanel';
import { TutorialPanel } from './ui/TutorialPanel';

// Global instances
let uiController: UIController;
let workspaceMonitor: WorkspaceMonitor;
let automationEngine: AutomationEngine;
let kiroInterface: KiroInterface;
let configManager: ConfigManager;
let logger: Logger;
let notificationService: NotificationService;
let telemetryService: TelemetryService;

/**
 * Extension activation function
 * Called when the extension is activated
 */
export async function activate(context: vscode.ExtensionContext) {
  console.log('Kiro Automation Extension is now active');

  try {
    // Initialize Configuration Manager
    configManager = new ConfigManager();
    const config = configManager.getAll();
    
    // Initialize Logger
    logger = Logger.getInstance({
      minLevel: config.logLevel === 'debug' ? 0 : config.logLevel === 'info' ? 1 : config.logLevel === 'warning' ? 2 : 3,
      enableFileLogging: config.saveLogsToFile,
      maxLogFileSize: config.maxLogFileSize * 1024 * 1024, // Convert MB to bytes
    });
    
    // Initialize Notification Service
    notificationService = NotificationService.getInstance(configManager, logger);
    
    // Initialize Telemetry Service
    telemetryService = new TelemetryService(context);
    await telemetryService.initialize();
    telemetryService.trackFeatureUsed('extension.activated');
    
    // Initialize UI Controller
    uiController = new UIController(context);
    uiController.getLogViewer().info('Initializing Kiro Automation Extension...', 'Extension');

    // Initialize Kiro Interface
    kiroInterface = new KiroInterface();
    const discoveryResult = await kiroInterface.initialize();
    
    if (discoveryResult.found) {
      uiController.getLogViewer().info(
        `Kiro IDE discovered (${discoveryResult.approach}): v${discoveryResult.version || 'unknown'}`,
        'KiroInterface'
      );
    } else {
      uiController.getLogViewer().warning(
        `Kiro IDE not detected: ${discoveryResult.error}`,
        'KiroInterface'
      );
      vscode.window.showWarningMessage(
        'Kiro IDE not detected. Some features may not be available.'
      );
    }

    // Initialize Workspace Monitor
    workspaceMonitor = new WorkspaceMonitor();
    
    // Initialize Automation Engine
    automationEngine = new AutomationEngine({
      maxRetries: config.retryAttempts,
      taskTimeout: config.timeout,
      taskDelay: config.taskDelay,
      skipOptionalTasks: config.skipOptionalTasks,
      continueOnFailure: false,
      verboseLogging: config.logLevel === 'debug',
    });

    // Set up workspace change listener
    workspaceMonitor.onWorkspaceChanged((contexts) => {
      console.log(`Workspace changed: ${contexts.length} workspace(s) active`);
      uiController
        .getLogViewer()
        .info(`Workspace changed: ${contexts.length} workspace(s) active`, 'WorkspaceMonitor');

      // Update UI with workspace information
      contexts.forEach((context) => {
        const taskCount = context.taskManager.getTasks().length;
        uiController
          .getLogViewer()
          .info(
            `Workspace "${context.name}": ${taskCount} task(s) discovered`,
            'WorkspaceMonitor'
          );
      });
    });

    // Set up task change listener
    workspaceMonitor.onTasksChanged((workspaceUri, changes) => {
      const context = workspaceMonitor.getWorkspaceContext(workspaceUri);
      if (context) {
        console.log(`Tasks changed in workspace: ${context.name}`);
        uiController
          .getLogViewer()
          .info(`Tasks changed in workspace: ${context.name}`, 'WorkspaceMonitor');

        // Log change details
        if (changes.addedTasks.length > 0) {
          uiController
            .getLogViewer()
            .info(`  Added tasks: ${changes.addedTasks.map((t) => t.id).join(', ')}`, 'ChangeDetector');
        }
        if (changes.removedTasks.length > 0) {
          uiController
            .getLogViewer()
            .info(`  Removed tasks: ${changes.removedTasks.map((t) => t.id).join(', ')}`, 'ChangeDetector');
        }
        if (changes.statusChanges.length > 0) {
          changes.statusChanges.forEach((change) => {
            const subtaskInfo = change.subtaskId ? ` (subtask ${change.subtaskId})` : '';
            uiController
              .getLogViewer()
              .info(
                `  Task ${change.taskId}${subtaskInfo}: ${change.oldStatus} -> ${change.newStatus}`,
                'ChangeDetector'
              );
          });
        }
      }
    });

    // Register commands
    registerCommands(context);

    // Set up file watchers and event listeners
    setupFileWatchers();

    // Add components to subscriptions for cleanup
    context.subscriptions.push(
      workspaceMonitor,
      configManager,
      kiroInterface,
      automationEngine,
      {
        dispose: () => {
          logger.dispose();
          notificationService.dispose();
        }
      }
    );

    // Check for Kiro IDE compatibility
    checkKiroCompatibility();

    // Log activation
    uiController.getLogViewer().info('Kiro Automation Extension activated successfully', 'Extension');
    
    // Show status bar message
    vscode.window.setStatusBarMessage('Kiro Automation: Ready', 3000);

    // Show tutorial on first run
    if (TutorialPanel.shouldShowTutorial(context)) {
      const response = await vscode.window.showInformationMessage(
        'Welcome to Kiro Automation! Would you like to take a quick tutorial?',
        'Start Tutorial',
        'Skip'
      );
      if (response === 'Start Tutorial') {
        TutorialPanel.show(context.extensionUri, context);
      } else {
        TutorialPanel.markTutorialSeen(context);
      }
    }
  } catch (error) {
    console.error('Error during extension activation:', error);
    vscode.window.showErrorMessage(
      `Failed to activate Kiro Automation Extension: ${error}`
    );
    throw error;
  }
}

/**
 * Registers all extension commands
 * @param context Extension context
 */
function registerCommands(context: vscode.ExtensionContext): void {
  // Start automation command
  const startCommand = vscode.commands.registerCommand('kiro-automation.start', async () => {
    try {
      uiController.showInfo('Starting automation...');
      
      // Get the first workspace context
      const contexts = workspaceMonitor.getWorkspaceContexts();
      if (contexts.length === 0) {
        uiController.showWarning('No workspace found. Please open a workspace with .kiro directory.');
        return;
      }

      const workspaceContext = contexts[0];
      
      // Initialize automation engine with workspace task manager
      await automationEngine.initialize(workspaceContext.taskManager, kiroInterface, notificationService, context);
      
      // Start automation
      await automationEngine.start();
      
      uiController.showInfo('Automation started successfully');
    } catch (error) {
      uiController.showError(`Failed to start automation: ${error}`);
      console.error('Start automation error:', error);
    }
  });

  // Stop automation command
  const stopCommand = vscode.commands.registerCommand('kiro-automation.stop', async () => {
    try {
      uiController.showInfo('Stopping automation...');
      await automationEngine.stop();
      uiController.showInfo('Automation stopped');
    } catch (error) {
      uiController.showError(`Failed to stop automation: ${error}`);
      console.error('Stop automation error:', error);
    }
  });

  // Pause automation command
  const pauseCommand = vscode.commands.registerCommand('kiro-automation.pause', async () => {
    try {
      uiController.showInfo('Pausing automation...');
      await automationEngine.pause();
      uiController.showInfo('Automation paused');
    } catch (error) {
      uiController.showError(`Failed to pause automation: ${error}`);
      console.error('Pause automation error:', error);
    }
  });

  // Resume automation command
  const resumeCommand = vscode.commands.registerCommand('kiro-automation.resume', async () => {
    try {
      uiController.showInfo('Resuming automation...');
      await automationEngine.resume();
      uiController.showInfo('Automation resumed');
    } catch (error) {
      uiController.showError(`Failed to resume automation: ${error}`);
      console.error('Resume automation error:', error);
    }
  });

  // Execute next task command
  const nextTaskCommand = vscode.commands.registerCommand('kiro-automation.nextTask', async () => {
    try {
      const contexts = workspaceMonitor.getWorkspaceContexts();
      if (contexts.length === 0) {
        uiController.showWarning('No workspace found');
        return;
      }

      const nextTask = contexts[0].taskManager.getNextIncompleteTask();
      if (!nextTask) {
        uiController.showInfo('No incomplete tasks found');
        return;
      }

      uiController.showInfo(`Next task: ${nextTask.id} - ${nextTask.title}`);
    } catch (error) {
      uiController.showError(`Failed to get next task: ${error}`);
      console.error('Next task error:', error);
    }
  });

  // Show progress panel and control panel commands are registered in UIController

  // Refresh workspaces command
  const refreshWorkspacesCommand = vscode.commands.registerCommand(
    'kiro-automation.refreshWorkspaces',
    async () => {
      try {
        uiController.showInfo('Refreshing workspaces...');
        await workspaceMonitor.refreshAllWorkspaces();
        uiController.showInfo('Workspaces refreshed');
      } catch (error) {
        uiController.showError(`Failed to refresh workspaces: ${error}`);
        console.error('Refresh workspaces error:', error);
      }
    }
  );

  // Refresh tasks command
  const refreshTasksCommand = vscode.commands.registerCommand(
    'kiro-automation.refreshTasks',
    async () => {
      try {
        uiController.showInfo('Refreshing tasks...');
        await workspaceMonitor.refreshAllWorkspaces();
        uiController.getTaskTreeDataProvider().refresh();
        uiController.showInfo('Tasks refreshed');
      } catch (error) {
        uiController.showError(`Failed to refresh tasks: ${error}`);
        console.error('Refresh tasks error:', error);
      }
    }
  );

  // Show logs and clear logs commands are registered in UIController

  // Export logs and open log file commands are registered in UIController

  // Show help command
  const showHelpCommand = vscode.commands.registerCommand(
    'kiro-automation.showHelp',
    (topic?: string) => {
      HelpPanel.show(context.extensionUri, topic);
    }
  );

  // Show tutorial command
  const showTutorialCommand = vscode.commands.registerCommand(
    'kiro-automation.showTutorial',
    () => {
      TutorialPanel.show(context.extensionUri, context);
    }
  );

  // Telemetry opt-in command
  const telemetryOptInCommand = vscode.commands.registerCommand(
    'kiro-automation.telemetry.optIn',
    async () => {
      await telemetryService.optIn();
    }
  );

  // Telemetry opt-out command
  const telemetryOptOutCommand = vscode.commands.registerCommand(
    'kiro-automation.telemetry.optOut',
    async () => {
      await telemetryService.optOut();
    }
  );

  // Show telemetry summary command
  const showTelemetrySummaryCommand = vscode.commands.registerCommand(
    'kiro-automation.telemetry.showSummary',
    async () => {
      try {
        const summary = await telemetryService.getSummary();
        const message = `Telemetry Summary:\n\nTotal Events: ${summary.totalEvents}\n\nEvents by Type:\n${Object.entries(summary.eventsByType).map(([type, count]) => `  ${type}: ${count}`).join('\n')}`;
        vscode.window.showInformationMessage(message, { modal: true });
      } catch (error) {
        vscode.window.showErrorMessage(`Failed to get telemetry summary: ${error}`);
      }
    }
  );

  // Export telemetry data command
  const exportTelemetryCommand = vscode.commands.registerCommand(
    'kiro-automation.telemetry.export',
    async () => {
      try {
        const data = await telemetryService.exportData();
        const uri = await vscode.window.showSaveDialog({
          defaultUri: vscode.Uri.file('telemetry-data.json'),
          filters: { 'JSON': ['json'] }
        });
        
        if (uri) {
          await vscode.workspace.fs.writeFile(uri, Buffer.from(data, 'utf8'));
          vscode.window.showInformationMessage(`Telemetry data exported to ${uri.fsPath}`);
        }
      } catch (error) {
        vscode.window.showErrorMessage(`Failed to export telemetry data: ${error}`);
      }
    }
  );

  // Add all commands to subscriptions
  context.subscriptions.push(
    startCommand,
    stopCommand,
    pauseCommand,
    resumeCommand,
    nextTaskCommand,
    refreshWorkspacesCommand,
    refreshTasksCommand,
    showHelpCommand,
    showTutorialCommand,
    telemetryOptInCommand,
    telemetryOptOutCommand,
    showTelemetrySummaryCommand,
    exportTelemetryCommand
  );
}

/**
 * Sets up file watchers and event listeners
 */
function setupFileWatchers(): void {
  // File watchers are set up by WorkspaceMonitor and TaskManager
  // This function can be extended to add additional watchers if needed
  uiController.getLogViewer().info('File watchers initialized', 'Extension');
}

/**
 * Get the UI controller instance
 */
export function getUIController(): UIController {
  return uiController;
}

/**
 * Get the workspace monitor instance
 */
export function getWorkspaceMonitor(): WorkspaceMonitor {
  return workspaceMonitor;
}

/**
 * Extension deactivation function
 * Called when the extension is deactivated
 */
export async function deactivate() {
  console.log('Kiro Automation Extension is now deactivated');
  
  // Dispose telemetry service
  if (telemetryService) {
    await telemetryService.dispose();
  }
}

/**
 * Check if Kiro IDE is available and compatible
 */
function checkKiroCompatibility() {
  const kiroExtension = vscode.extensions.getExtension('kiro.kiro');

  if (kiroExtension) {
    console.log('Kiro IDE detected:', kiroExtension.packageJSON.version);
  } else {
    vscode.window.showWarningMessage(
      'Kiro IDE not detected. This extension requires Kiro IDE to function properly.'
    );
  }
}
