import * as vscode from 'vscode';

/**
 * Control panel state
 */
export interface ControlPanelState {
  isRunning: boolean;
  isPaused: boolean;
  canStart: boolean;
  canStop: boolean;
  canPause: boolean;
  canResume: boolean;
}

/**
 * Manages the control panel webview
 */
export class ControlPanel {
  public static currentPanel: ControlPanel | undefined;
  private readonly panel: vscode.WebviewPanel;
  private readonly extensionUri: vscode.Uri;
  private disposables: vscode.Disposable[] = [];
  private state: ControlPanelState;

  private constructor(panel: vscode.WebviewPanel, extensionUri: vscode.Uri) {
    this.panel = panel;
    this.extensionUri = extensionUri;
    this.state = {
      isRunning: false,
      isPaused: false,
      canStart: true,
      canStop: false,
      canPause: false,
      canResume: false
    };

    this.panel.onDidDispose(() => this.dispose(), null, this.disposables);
    this.panel.webview.html = this.getHtmlContent();

    // Handle messages from the webview
    this.panel.webview.onDidReceiveMessage(
      message => {
        switch (message.command) {
          case 'start':
            vscode.commands.executeCommand('kiro-automation.start');
            break;
          case 'stop':
            vscode.commands.executeCommand('kiro-automation.stop');
            break;
          case 'pause':
            vscode.commands.executeCommand('kiro-automation.pause');
            break;
          case 'resume':
            vscode.commands.executeCommand('kiro-automation.resume');
            break;
          case 'openSettings':
            vscode.commands.executeCommand('workbench.action.openSettings', 'kiro-automation');
            break;
          case 'showLogs':
            vscode.commands.executeCommand('kiro-automation.showLogs');
            break;
        }
      },
      null,
      this.disposables
    );
  }

  /**
   * Create or show the control panel
   */
  public static createOrShow(extensionUri: vscode.Uri): ControlPanel {
    const column = vscode.window.activeTextEditor
      ? vscode.window.activeTextEditor.viewColumn
      : undefined;

    if (ControlPanel.currentPanel) {
      ControlPanel.currentPanel.panel.reveal(column);
      return ControlPanel.currentPanel;
    }

    const panel = vscode.window.createWebviewPanel(
      'kiroAutomationControl',
      'Kiro Automation Controls',
      column || vscode.ViewColumn.One,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
        localResourceRoots: [extensionUri]
      }
    );

    ControlPanel.currentPanel = new ControlPanel(panel, extensionUri);
    return ControlPanel.currentPanel;
  }

  /**
   * Update control panel state
   */
  public updateState(state: Partial<ControlPanelState>): void {
    this.state = { ...this.state, ...state };
    this.panel.webview.postMessage({
      command: 'updateState',
      data: this.state
    });
  }

  /**
   * Dispose of the panel
   */
  public dispose(): void {
    ControlPanel.currentPanel = undefined;

    this.panel.dispose();

    while (this.disposables.length) {
      const disposable = this.disposables.pop();
      if (disposable) {
        disposable.dispose();
      }
    }
  }

  /**
   * Get HTML content for the webview
   */
  private getHtmlContent(): string {
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Kiro Automation Controls</title>
  <style>
    body {
      font-family: var(--vscode-font-family);
      color: var(--vscode-foreground);
      background-color: var(--vscode-editor-background);
      padding: 20px;
      margin: 0;
    }

    .container {
      max-width: 600px;
      margin: 0 auto;
    }

    h1 {
      font-size: 24px;
      font-weight: 600;
      margin: 0 0 30px 0;
    }

    .control-section {
      background-color: var(--vscode-editor-inactiveSelectionBackground);
      border-radius: 8px;
      padding: 20px;
      margin-bottom: 20px;
    }

    .control-section h2 {
      font-size: 16px;
      font-weight: 600;
      margin: 0 0 15px 0;
      color: var(--vscode-descriptionForeground);
    }

    .button-grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 10px;
    }

    button {
      background-color: var(--vscode-button-background);
      color: var(--vscode-button-foreground);
      border: none;
      padding: 15px 20px;
      border-radius: 6px;
      cursor: pointer;
      font-size: 14px;
      font-weight: 500;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      transition: background-color 0.2s;
    }

    button:hover:not(:disabled) {
      background-color: var(--vscode-button-hoverBackground);
    }

    button:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }

    button.primary {
      background-color: var(--vscode-button-background);
    }

    button.secondary {
      background-color: var(--vscode-button-secondaryBackground);
      color: var(--vscode-button-secondaryForeground);
    }

    button.secondary:hover:not(:disabled) {
      background-color: var(--vscode-button-secondaryHoverBackground);
    }

    button.danger {
      background-color: var(--vscode-inputValidation-errorBackground);
      color: var(--vscode-inputValidation-errorForeground);
    }

    .icon {
      font-size: 18px;
    }

    .quick-actions {
      display: flex;
      flex-direction: column;
      gap: 10px;
    }

    .quick-action-btn {
      width: 100%;
      justify-content: flex-start;
      padding: 12px 16px;
    }

    .status-indicator {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      padding: 8px 16px;
      border-radius: 16px;
      font-size: 13px;
      font-weight: 600;
      margin-bottom: 20px;
    }

    .status-running {
      background-color: var(--vscode-testing-iconQueued);
      color: var(--vscode-editor-background);
    }

    .status-paused {
      background-color: var(--vscode-editorWarning-foreground);
      color: var(--vscode-editor-background);
    }

    .status-idle {
      background-color: var(--vscode-descriptionForeground);
      color: var(--vscode-editor-background);
    }

    .status-dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background-color: currentColor;
      animation: pulse 2s infinite;
    }

    @keyframes pulse {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.5; }
    }

    .info-box {
      background-color: var(--vscode-input-background);
      border-left: 3px solid var(--vscode-focusBorder);
      padding: 12px 16px;
      border-radius: 4px;
      margin-top: 20px;
      font-size: 13px;
      line-height: 1.6;
    }

    .divider {
      height: 1px;
      background-color: var(--vscode-panel-border);
      margin: 20px 0;
    }
  </style>
</head>
<body>
  <div class="container">
    <h1>Automation Controls</h1>

    <div id="statusIndicator" class="status-indicator status-idle">
      <span class="status-dot"></span>
      <span id="statusText">Idle</span>
    </div>

    <div class="control-section">
      <h2>Main Controls</h2>
      <div class="button-grid">
        <button id="startBtn" class="primary" onclick="sendCommand('start')">
          <span class="icon">▶️</span>
          <span>Start</span>
        </button>
        <button id="stopBtn" class="danger" onclick="sendCommand('stop')" disabled>
          <span class="icon">⏹️</span>
          <span>Stop</span>
        </button>
        <button id="pauseBtn" class="secondary" onclick="sendCommand('pause')" disabled>
          <span class="icon">⏸️</span>
          <span>Pause</span>
        </button>
        <button id="resumeBtn" class="secondary" onclick="sendCommand('resume')" disabled>
          <span class="icon">▶️</span>
          <span>Resume</span>
        </button>
      </div>
    </div>

    <div class="control-section">
      <h2>Quick Actions</h2>
      <div class="quick-actions">
        <button class="quick-action-btn secondary" onclick="sendCommand('openSettings')">
          <span class="icon">⚙️</span>
          <span>Open Settings</span>
        </button>
        <button class="quick-action-btn secondary" onclick="sendCommand('showLogs')">
          <span class="icon">📋</span>
          <span>Show Logs</span>
        </button>
      </div>
    </div>

    <div class="info-box">
      <strong>💡 Tip:</strong> Use the command palette (Ctrl+Shift+P / Cmd+Shift+P) to access all Kiro Automation commands quickly.
    </div>
  </div>

  <script>
    const vscode = acquireVsCodeApi();

    function sendCommand(command) {
      vscode.postMessage({ command });
    }

    function updateState(state) {
      // Update status indicator
      const statusIndicator = document.getElementById('statusIndicator');
      const statusText = document.getElementById('statusText');
      
      if (state.isRunning && !state.isPaused) {
        statusIndicator.className = 'status-indicator status-running';
        statusText.textContent = 'Running';
      } else if (state.isPaused) {
        statusIndicator.className = 'status-indicator status-paused';
        statusText.textContent = 'Paused';
      } else {
        statusIndicator.className = 'status-indicator status-idle';
        statusText.textContent = 'Idle';
      }

      // Update button states
      document.getElementById('startBtn').disabled = !state.canStart;
      document.getElementById('stopBtn').disabled = !state.canStop;
      document.getElementById('pauseBtn').disabled = !state.canPause;
      document.getElementById('resumeBtn').disabled = !state.canResume;
    }

    // Handle messages from extension
    window.addEventListener('message', event => {
      const message = event.data;
      switch (message.command) {
        case 'updateState':
          updateState(message.data);
          break;
      }
    });

    // Initialize with default state
    updateState({
      isRunning: false,
      isPaused: false,
      canStart: true,
      canStop: false,
      canPause: false,
      canResume: false
    });
  </script>
</body>
</html>`;
  }
}
