import * as vscode from 'vscode';

/**
 * Tutorial step interface
 */
interface TutorialStep {
  id: string;
  title: string;
  description: string;
  action?: {
    type: 'command' | 'setting' | 'file';
    value: string;
  };
  validation?: () => Promise<boolean>;
}

/**
 * Tutorial progress tracking
 */
interface TutorialProgress {
  currentStep: number;
  completedSteps: string[];
  startedAt: Date;
  lastUpdated: Date;
}

/**
 * Interactive tutorial panel for first-time users
 */
export class TutorialPanel {
  private static currentPanel: TutorialPanel | undefined;
  private readonly panel: vscode.WebviewPanel;
  private disposables: vscode.Disposable[] = [];
  private progress: TutorialProgress;
  private steps: TutorialStep[];

  private constructor(
    panel: vscode.WebviewPanel,
    extensionUri: vscode.Uri,
    context: vscode.ExtensionContext
  ) {
    this.panel = panel;
    this.steps = this.getTutorialSteps();
    
    // Load or initialize progress
    this.progress = context.globalState.get('tutorialProgress') || {
      currentStep: 0,
      completedSteps: [],
      startedAt: new Date(),
      lastUpdated: new Date(),
    };

    // Set the webview's initial html content
    this.panel.webview.html = this.getHtmlContent(this.panel.webview, extensionUri);

    // Listen for when the panel is disposed
    this.panel.onDidDispose(() => this.dispose(), null, this.disposables);

    // Handle messages from the webview
    this.panel.webview.onDidReceiveMessage(
      async (message) => {
        switch (message.command) {
          case 'nextStep':
            await this.nextStep(context);
            break;
          case 'previousStep':
            this.previousStep();
            break;
          case 'skipTutorial':
            this.skipTutorial(context);
            break;
          case 'restartTutorial':
            this.restartTutorial(context);
            break;
          case 'executeAction':
            await this.executeStepAction(message.stepId);
            break;
          case 'getProgress':
            this.sendProgress();
            break;
        }
      },
      null,
      this.disposables
    );

    // Send initial progress
    this.sendProgress();
  }

  /**
   * Show the tutorial panel
   */
  public static show(extensionUri: vscode.Uri, context: vscode.ExtensionContext) {
    const column = vscode.ViewColumn.One;

    // If we already have a panel, show it
    if (TutorialPanel.currentPanel) {
      TutorialPanel.currentPanel.panel.reveal(column);
      return;
    }

    // Otherwise, create a new panel
    const panel = vscode.window.createWebviewPanel(
      'kiroAutomationTutorial',
      'Kiro Automation Tutorial',
      column,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
        localResourceRoots: [extensionUri],
      }
    );

    TutorialPanel.currentPanel = new TutorialPanel(panel, extensionUri, context);
  }

  /**
   * Check if user should see tutorial on first run
   */
  public static shouldShowTutorial(context: vscode.ExtensionContext): boolean {
    const hasSeenTutorial = context.globalState.get('hasSeenTutorial', false);
    const skipTutorial = context.globalState.get('skipTutorial', false);
    return !hasSeenTutorial && !skipTutorial;
  }

  /**
   * Mark tutorial as seen
   */
  public static markTutorialSeen(context: vscode.ExtensionContext) {
    context.globalState.update('hasSeenTutorial', true);
  }

  /**
   * Get tutorial steps
   */
  private getTutorialSteps(): TutorialStep[] {
    return [
      {
        id: 'welcome',
        title: 'Welcome to Kiro Automation',
        description: `
          <p>Welcome! This tutorial will guide you through setting up and using the Kiro Automation Extension.</p>
          <p>Kiro Automation enables fully autonomous task execution within your Kiro IDE environment, allowing you to automate development workflows overnight.</p>
          <h4>What you'll learn:</h4>
          <ul>
            <li>How to verify your workspace is ready</li>
            <li>How to configure automation settings</li>
            <li>How to start and monitor automation</li>
            <li>How to troubleshoot common issues</li>
          </ul>
          <p>This tutorial takes about 5 minutes to complete.</p>
        `,
      },
      {
        id: 'workspace-check',
        title: 'Step 1: Verify Workspace Structure',
        description: `
          <p>First, let's make sure your workspace is set up correctly for automation.</p>
          <h4>Required Structure:</h4>
          <pre><code>your-project/
└── .kiro/
    └── specs/
        └── your-feature/
            ├── requirements.md
            ├── design.md
            └── tasks.md</code></pre>
          <p>The extension automatically discovers task files in <code>.kiro/specs/*/tasks.md</code>.</p>
          <div class="info-box">
            <strong>💡 Tip:</strong> If you don't have a .kiro directory yet, create one with the structure above.
          </div>
          <p>Click "Check Workspace" to verify your setup.</p>
        `,
        action: {
          type: 'command',
          value: 'kiro-automation.refreshTasks',
        },
      },
      {
        id: 'view-tasks',
        title: 'Step 2: View Your Tasks',
        description: `
          <p>Now let's explore the Task Tree View where you can see all your tasks.</p>
          <h4>Task Tree View Features:</h4>
          <ul>
            <li><strong>Status Indicators:</strong> See which tasks are pending, in progress, or completed</li>
            <li><strong>Hierarchical View:</strong> Tasks are organized by spec with subtasks nested</li>
            <li><strong>Quick Actions:</strong> Right-click tasks for options like skip or retry</li>
          </ul>
          <p>Look for the "Kiro Automation Tasks" view in your Explorer sidebar.</p>
          <div class="info-box">
            <strong>📋 Task Status:</strong><br>
            ⭕ Pending &nbsp; 🔄 In Progress &nbsp; ✅ Completed &nbsp; ❌ Failed &nbsp; ⏭️ Skipped
          </div>
        `,
      },
      {
        id: 'configure-settings',
        title: 'Step 3: Configure Settings',
        description: `
          <p>Let's customize the automation behavior to match your needs.</p>
          <h4>Key Settings:</h4>
          <ul>
            <li><strong>Retry Attempts:</strong> How many times to retry failed tasks (default: 3)</li>
            <li><strong>Timeout:</strong> Maximum time per task in milliseconds (default: 300000)</li>
            <li><strong>Log Level:</strong> Amount of detail in logs (debug, info, warning, error)</li>
            <li><strong>Notifications:</strong> When to show notifications (all, errors, none)</li>
          </ul>
          <p>Click "Open Settings" to configure these options.</p>
          <div class="warning-box">
            <strong>⚠️ Important:</strong> Start with default settings and adjust based on your needs.
          </div>
        `,
        action: {
          type: 'setting',
          value: 'kiro-automation',
        },
      },
      {
        id: 'start-automation',
        title: 'Step 4: Start Your First Automation',
        description: `
          <p>You're ready to start automation! Here's how:</p>
          <h4>Three Ways to Start:</h4>
          <ol>
            <li><strong>Command Palette:</strong> Press <kbd>Ctrl+Shift+P</kbd> and run "Kiro Automation: Start"</li>
            <li><strong>Task Tree View:</strong> Click the play button (▶) in the view title</li>
            <li><strong>Status Bar:</strong> Click the Kiro Automation status bar item</li>
          </ol>
          <p>The automation will:</p>
          <ul>
            <li>Read your task specifications</li>
            <li>Generate contextual prompts with requirements and design</li>
            <li>Send prompts to Kiro chat</li>
            <li>Monitor for completion</li>
            <li>Update task status and move to the next task</li>
          </ul>
          <p>Click "Start Automation" to begin!</p>
        `,
        action: {
          type: 'command',
          value: 'kiro-automation.start',
        },
      },
      {
        id: 'monitor-progress',
        title: 'Step 5: Monitor Progress',
        description: `
          <p>While automation runs, you can monitor progress in several ways:</p>
          <h4>Monitoring Tools:</h4>
          <ul>
            <li><strong>Progress Panel:</strong> Real-time webview showing current task and completion percentage</li>
            <li><strong>Task Tree View:</strong> Watch status indicators update as tasks complete</li>
            <li><strong>Log Viewer:</strong> Detailed execution logs with timestamps and context</li>
            <li><strong>Status Bar:</strong> Quick glance at current task and progress</li>
          </ul>
          <p>Open the Progress Panel to see detailed information.</p>
          <div class="info-box">
            <strong>💡 Tip:</strong> Enable debug logging for more detailed information during troubleshooting.
          </div>
        `,
        action: {
          type: 'command',
          value: 'kiro-automation.showPanel',
        },
      },
      {
        id: 'control-automation',
        title: 'Step 6: Control Automation',
        description: `
          <p>You have full control over the automation process:</p>
          <h4>Control Commands:</h4>
          <ul>
            <li><strong>Pause:</strong> Temporarily pause automation (can be resumed)</li>
            <li><strong>Resume:</strong> Continue from where you paused</li>
            <li><strong>Stop:</strong> Stop automation completely</li>
            <li><strong>Execute Next Task:</strong> Run only the next pending task</li>
          </ul>
          <h4>Session Persistence:</h4>
          <p>Automation sessions are automatically saved every 30 seconds. If VS Code restarts, you can resume from where you left off.</p>
          <div class="info-box">
            <strong>🔄 Auto-Resume:</strong> Enable the "autoResume" setting to automatically continue after VS Code restarts.
          </div>
        `,
      },
      {
        id: 'troubleshooting',
        title: 'Step 7: Troubleshooting Tips',
        description: `
          <p>If you encounter issues, here are quick solutions:</p>
          <h4>Common Issues:</h4>
          <ul>
            <li><strong>Tasks not discovered:</strong> Run "Refresh Tasks" command</li>
            <li><strong>Automation stuck:</strong> Increase timeout setting or check Kiro chat</li>
            <li><strong>High memory usage:</strong> Reduce concurrency to 1</li>
            <li><strong>Tasks failing:</strong> Check logs for error details</li>
          </ul>
          <h4>Debug Mode:</h4>
          <p>Set <code>"kiro-automation.logLevel": "debug"</code> for detailed troubleshooting information.</p>
          <p>Click "Show Logs" to view detailed execution logs.</p>
        `,
        action: {
          type: 'command',
          value: 'kiro-automation.showLogs',
        },
      },
      {
        id: 'completion',
        title: 'Tutorial Complete! 🎉',
        description: `
          <p>Congratulations! You've completed the Kiro Automation tutorial.</p>
          <h4>What's Next:</h4>
          <ul>
            <li>Start automating your first task list</li>
            <li>Explore advanced features like custom prompts and plugins</li>
            <li>Check out the full documentation for more details</li>
            <li>Join the community for tips and support</li>
          </ul>
          <h4>Quick Reference:</h4>
          <ul>
            <li>Press <kbd>Ctrl+Shift+P</kbd> and type "Kiro Automation" to see all commands</li>
            <li>Run "Kiro Automation: Show Help" for in-editor documentation</li>
            <li>Check the README for comprehensive guides</li>
          </ul>
          <p>You can restart this tutorial anytime from the Help panel.</p>
          <div class="success-box">
            <strong>✨ Ready to automate!</strong> Click "Finish" to close this tutorial.
          </div>
        `,
      },
    ];
  }

  /**
   * Move to next step
   */
  private async nextStep(context: vscode.ExtensionContext) {
    const currentStep = this.steps[this.progress.currentStep];
    
    // Mark current step as completed
    if (!this.progress.completedSteps.includes(currentStep.id)) {
      this.progress.completedSteps.push(currentStep.id);
    }

    // Move to next step
    if (this.progress.currentStep < this.steps.length - 1) {
      this.progress.currentStep++;
      this.progress.lastUpdated = new Date();
      await context.globalState.update('tutorialProgress', this.progress);
      this.sendProgress();
    } else {
      // Tutorial completed
      await this.completeTutorial(context);
    }
  }

  /**
   * Move to previous step
   */
  private previousStep() {
    if (this.progress.currentStep > 0) {
      this.progress.currentStep--;
      this.sendProgress();
    }
  }

  /**
   * Skip tutorial
   */
  private async skipTutorial(context: vscode.ExtensionContext) {
    await context.globalState.update('skipTutorial', true);
    await context.globalState.update('hasSeenTutorial', true);
    vscode.window.showInformationMessage('Tutorial skipped. You can restart it anytime from the Help panel.');
    this.dispose();
  }

  /**
   * Restart tutorial
   */
  private async restartTutorial(context: vscode.ExtensionContext) {
    this.progress = {
      currentStep: 0,
      completedSteps: [],
      startedAt: new Date(),
      lastUpdated: new Date(),
    };
    await context.globalState.update('tutorialProgress', this.progress);
    this.sendProgress();
  }

  /**
   * Complete tutorial
   */
  private async completeTutorial(context: vscode.ExtensionContext) {
    await context.globalState.update('hasSeenTutorial', true);
    vscode.window.showInformationMessage(
      'Tutorial completed! 🎉 You\'re ready to use Kiro Automation.',
      'Open Help',
      'Start Automation'
    ).then(selection => {
      if (selection === 'Open Help') {
        vscode.commands.executeCommand('kiro-automation.showHelp');
      } else if (selection === 'Start Automation') {
        vscode.commands.executeCommand('kiro-automation.start');
      }
    });
    this.dispose();
  }

  /**
   * Execute step action
   */
  private async executeStepAction(stepId: string) {
    const step = this.steps.find(s => s.id === stepId);
    if (!step || !step.action) {
      return;
    }

    switch (step.action.type) {
      case 'command':
        await vscode.commands.executeCommand(step.action.value);
        break;
      case 'setting':
        await vscode.commands.executeCommand('workbench.action.openSettings', step.action.value);
        break;
      case 'file':
        const uri = vscode.Uri.file(step.action.value);
        await vscode.window.showTextDocument(uri);
        break;
    }
  }

  /**
   * Send progress to webview
   */
  private sendProgress() {
    const currentStep = this.steps[this.progress.currentStep];
    this.panel.webview.postMessage({
      command: 'updateProgress',
      progress: {
        ...this.progress,
        totalSteps: this.steps.length,
        currentStepData: currentStep,
      },
    });
  }

  /**
   * Dispose of the panel
   */
  public dispose() {
    TutorialPanel.currentPanel = undefined;

    this.panel.dispose();

    while (this.disposables.length) {
      const disposable = this.disposables.pop();
      if (disposable) {
        disposable.dispose();
      }
    }
  }

  /**
   * Get the HTML content for the webview
   */
  private getHtmlContent(webview: vscode.Webview, extensionUri: vscode.Uri): string {
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Kiro Automation Tutorial</title>
  <style>
    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }

    body {
      font-family: var(--vscode-font-family);
      font-size: var(--vscode-font-size);
      color: var(--vscode-foreground);
      background-color: var(--vscode-editor-background);
      padding: 0;
      line-height: 1.6;
      overflow: hidden;
      height: 100vh;
      display: flex;
      flex-direction: column;
    }

    .tutorial-container {
      display: flex;
      flex-direction: column;
      height: 100%;
    }

    .progress-bar-container {
      background-color: var(--vscode-editorWidget-background);
      padding: 15px 30px;
      border-bottom: 1px solid var(--vscode-panel-border);
    }

    .progress-info {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 10px;
    }

    .step-counter {
      font-size: 14px;
      color: var(--vscode-descriptionForeground);
    }

    .progress-bar {
      width: 100%;
      height: 6px;
      background-color: var(--vscode-progressBar-background);
      border-radius: 3px;
      overflow: hidden;
    }

    .progress-fill {
      height: 100%;
      background-color: var(--vscode-progressBar-background);
      transition: width 0.3s ease;
    }

    .content-area {
      flex: 1;
      overflow-y: auto;
      padding: 40px;
    }

    .step-content {
      max-width: 800px;
      margin: 0 auto;
    }

    h2 {
      font-size: 28px;
      font-weight: 600;
      margin-bottom: 20px;
      color: var(--vscode-foreground);
    }

    h4 {
      font-size: 16px;
      font-weight: 600;
      margin-top: 20px;
      margin-bottom: 10px;
      color: var(--vscode-foreground);
    }

    p {
      margin-bottom: 15px;
    }

    ul, ol {
      margin-left: 25px;
      margin-bottom: 15px;
    }

    li {
      margin-bottom: 8px;
    }

    code {
      background-color: var(--vscode-textCodeBlock-background);
      padding: 2px 6px;
      border-radius: 3px;
      font-family: var(--vscode-editor-font-family);
      font-size: 13px;
    }

    pre {
      background-color: var(--vscode-textCodeBlock-background);
      padding: 15px;
      border-radius: 4px;
      overflow-x: auto;
      margin: 15px 0;
    }

    pre code {
      background: none;
      padding: 0;
    }

    kbd {
      display: inline-block;
      padding: 3px 8px;
      background-color: var(--vscode-keybindingLabel-background);
      color: var(--vscode-keybindingLabel-foreground);
      border: 1px solid var(--vscode-keybindingLabel-border);
      border-radius: 3px;
      font-family: var(--vscode-editor-font-family);
      font-size: 12px;
      margin: 0 2px;
    }

    .info-box, .warning-box, .success-box {
      padding: 15px;
      border-radius: 4px;
      margin: 15px 0;
      border-left: 3px solid;
    }

    .info-box {
      background-color: var(--vscode-inputValidation-infoBackground);
      border-left-color: var(--vscode-inputValidation-infoBorder);
    }

    .warning-box {
      background-color: var(--vscode-inputValidation-warningBackground);
      border-left-color: var(--vscode-inputValidation-warningBorder);
    }

    .success-box {
      background-color: rgba(0, 255, 0, 0.1);
      border-left-color: #00ff00;
    }

    .controls {
      background-color: var(--vscode-editorWidget-background);
      padding: 20px 30px;
      border-top: 1px solid var(--vscode-panel-border);
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    .btn-group {
      display: flex;
      gap: 10px;
    }

    .btn {
      padding: 10px 20px;
      background-color: var(--vscode-button-background);
      color: var(--vscode-button-foreground);
      border: none;
      border-radius: 4px;
      cursor: pointer;
      font-size: 14px;
      transition: background-color 0.2s;
    }

    .btn:hover:not(:disabled) {
      background-color: var(--vscode-button-hoverBackground);
    }

    .btn:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }

    .btn-secondary {
      background-color: var(--vscode-button-secondaryBackground);
      color: var(--vscode-button-secondaryForeground);
    }

    .btn-secondary:hover:not(:disabled) {
      background-color: var(--vscode-button-secondaryHoverBackground);
    }

    .btn-action {
      background-color: var(--vscode-focusBorder);
      color: white;
      margin-top: 15px;
    }

    .skip-link {
      color: var(--vscode-textLink-foreground);
      text-decoration: none;
      font-size: 13px;
      cursor: pointer;
    }

    .skip-link:hover {
      text-decoration: underline;
    }
  </style>
</head>
<body>
  <div class="tutorial-container">
    <div class="progress-bar-container">
      <div class="progress-info">
        <div class="step-counter" id="stepCounter">Step 1 of 9</div>
        <a href="#" class="skip-link" onclick="skipTutorial(); return false;">Skip Tutorial</a>
      </div>
      <div class="progress-bar">
        <div class="progress-fill" id="progressFill" style="width: 11%"></div>
      </div>
    </div>

    <div class="content-area">
      <div class="step-content" id="stepContent">
        <!-- Content will be injected here -->
      </div>
    </div>

    <div class="controls">
      <button class="btn btn-secondary" id="prevBtn" onclick="previousStep()" disabled>
        ← Previous
      </button>
      <div class="btn-group">
        <button class="btn btn-secondary" onclick="restartTutorial()">
          Restart
        </button>
        <button class="btn" id="nextBtn" onclick="nextStep()">
          Next →
        </button>
      </div>
    </div>
  </div>

  <script>
    const vscode = acquireVsCodeApi();
    let currentProgress = null;

    // Request initial progress
    vscode.postMessage({ command: 'getProgress' });

    // Listen for messages from extension
    window.addEventListener('message', event => {
      const message = event.data;
      switch (message.command) {
        case 'updateProgress':
          currentProgress = message.progress;
          updateUI();
          break;
      }
    });

    function updateUI() {
      if (!currentProgress) return;

      const { currentStep, totalSteps, currentStepData } = currentProgress;
      
      // Update progress bar
      const progressPercent = ((currentStep + 1) / totalSteps) * 100;
      document.getElementById('progressFill').style.width = progressPercent + '%';
      
      // Update step counter
      document.getElementById('stepCounter').textContent = 
        \`Step \${currentStep + 1} of \${totalSteps}\`;
      
      // Update content
      const contentDiv = document.getElementById('stepContent');
      contentDiv.innerHTML = \`
        <h2>\${currentStepData.title}</h2>
        \${currentStepData.description}
        \${currentStepData.action ? \`
          <button class="btn btn-action" onclick="executeAction('\${currentStepData.id}')">
            \${getActionButtonText(currentStepData.action.type)}
          </button>
        \` : ''}
      \`;
      
      // Update buttons
      document.getElementById('prevBtn').disabled = currentStep === 0;
      const nextBtn = document.getElementById('nextBtn');
      if (currentStep === totalSteps - 1) {
        nextBtn.textContent = 'Finish';
      } else {
        nextBtn.textContent = 'Next →';
      }
    }

    function getActionButtonText(actionType) {
      switch (actionType) {
        case 'command':
          return '▶ Execute Action';
        case 'setting':
          return '⚙️ Open Settings';
        case 'file':
          return '📄 Open File';
        default:
          return 'Continue';
      }
    }

    function nextStep() {
      vscode.postMessage({ command: 'nextStep' });
    }

    function previousStep() {
      vscode.postMessage({ command: 'previousStep' });
    }

    function skipTutorial() {
      if (confirm('Are you sure you want to skip the tutorial? You can restart it anytime from the Help panel.')) {
        vscode.postMessage({ command: 'skipTutorial' });
      }
    }

    function restartTutorial() {
      if (confirm('Restart the tutorial from the beginning?')) {
        vscode.postMessage({ command: 'restartTutorial' });
      }
    }

    function executeAction(stepId) {
      vscode.postMessage({ command: 'executeAction', stepId });
    }
  </script>
</body>
</html>`;
  }
}
