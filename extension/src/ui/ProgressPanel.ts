import * as vscode from 'vscode';
import { Task, TaskStatus } from '../models/Task';

/**
 * Progress information for the panel
 */
export interface ProgressInfo {
  currentTask: Task | null;
  completedCount: number;
  totalCount: number;
  failedCount: number;
  skippedCount: number;
  startTime: Date | null;
  estimatedTimeRemaining: number | null;
  isRunning: boolean;
}

/**
 * Manages the progress panel webview
 */
export class ProgressPanel {
  public static currentPanel: ProgressPanel | undefined;
  private readonly panel: vscode.WebviewPanel;
  private readonly extensionUri: vscode.Uri;
  private disposables: vscode.Disposable[] = [];
  private progressInfo: ProgressInfo;

  private constructor(panel: vscode.WebviewPanel, extensionUri: vscode.Uri) {
    this.panel = panel;
    this.extensionUri = extensionUri;
    this.progressInfo = {
      currentTask: null,
      completedCount: 0,
      totalCount: 0,
      failedCount: 0,
      skippedCount: 0,
      startTime: null,
      estimatedTimeRemaining: null,
      isRunning: false
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
        }
      },
      null,
      this.disposables
    );
  }

  /**
   * Create or show the progress panel
   */
  public static createOrShow(extensionUri: vscode.Uri): ProgressPanel {
    const column = vscode.window.activeTextEditor
      ? vscode.window.activeTextEditor.viewColumn
      : undefined;

    if (ProgressPanel.currentPanel) {
      ProgressPanel.currentPanel.panel.reveal(column);
      return ProgressPanel.currentPanel;
    }

    const panel = vscode.window.createWebviewPanel(
      'kiroAutomationProgress',
      'Kiro Automation Progress',
      column || vscode.ViewColumn.One,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
        localResourceRoots: [extensionUri]
      }
    );

    ProgressPanel.currentPanel = new ProgressPanel(panel, extensionUri);
    return ProgressPanel.currentPanel;
  }

  /**
   * Update progress information
   */
  public updateProgress(info: Partial<ProgressInfo>): void {
    this.progressInfo = { ...this.progressInfo, ...info };
    this.panel.webview.postMessage({
      command: 'updateProgress',
      data: this.progressInfo
    });
  }

  /**
   * Update current task
   */
  public updateTask(task: Task): void {
    this.progressInfo.currentTask = task;
    this.panel.webview.postMessage({
      command: 'updateTask',
      data: {
        task: {
          id: task.id,
          title: task.title,
          status: task.status,
          // Task model does not have a description field; synthesize from subtasks
          description: task.subtasks ? task.subtasks.flatMap(st => (st.description && st.description.length > 0) ? st.description : [st.title]) : []
        }
      }
    });
  }

  /**
   * Dispose of the panel
   */
  public dispose(): void {
    ProgressPanel.currentPanel = undefined;

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
  <title>Kiro Automation Progress</title>
  <style>
    body {
      font-family: var(--vscode-font-family);
      color: var(--vscode-foreground);
      background-color: var(--vscode-editor-background);
      padding: 20px;
      margin: 0;
    }

    .container {
      max-width: 800px;
      margin: 0 auto;
    }

    .header {
      margin-bottom: 30px;
    }

    h1 {
      font-size: 24px;
      font-weight: 600;
      margin: 0 0 10px 0;
    }

    .status-badge {
      display: inline-block;
      padding: 4px 12px;
      border-radius: 12px;
      font-size: 12px;
      font-weight: 600;
      text-transform: uppercase;
    }

    .status-running {
      background-color: var(--vscode-testing-iconQueued);
      color: var(--vscode-editor-background);
    }

    .status-idle {
      background-color: var(--vscode-descriptionForeground);
      color: var(--vscode-editor-background);
    }

    .progress-section {
      background-color: var(--vscode-editor-inactiveSelectionBackground);
      border-radius: 8px;
      padding: 20px;
      margin-bottom: 20px;
    }

    .progress-bar-container {
      width: 100%;
      height: 24px;
      background-color: var(--vscode-input-background);
      border-radius: 12px;
      overflow: hidden;
      margin: 15px 0;
    }

    .progress-bar {
      height: 100%;
      background: linear-gradient(90deg, 
        var(--vscode-progressBar-background) 0%, 
        var(--vscode-testing-iconPassed) 100%);
      transition: width 0.3s ease;
      display: flex;
      align-items: center;
      justify-content: center;
      color: white;
      font-weight: 600;
      font-size: 12px;
    }

    .stats-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
      gap: 15px;
      margin-top: 20px;
    }

    .stat-card {
      background-color: var(--vscode-input-background);
      padding: 15px;
      border-radius: 6px;
    }

    .stat-label {
      font-size: 12px;
      color: var(--vscode-descriptionForeground);
      margin-bottom: 5px;
    }

    .stat-value {
      font-size: 24px;
      font-weight: 600;
    }

    .current-task {
      background-color: var(--vscode-editor-inactiveSelectionBackground);
      border-radius: 8px;
      padding: 20px;
      margin-bottom: 20px;
    }

    .current-task h2 {
      font-size: 16px;
      margin: 0 0 10px 0;
      color: var(--vscode-descriptionForeground);
    }

    .task-title {
      font-size: 18px;
      font-weight: 600;
      margin-bottom: 10px;
    }

    .task-description {
      color: var(--vscode-descriptionForeground);
      line-height: 1.6;
    }

    .controls {
      display: flex;
      gap: 10px;
      margin-top: 20px;
    }

    button {
      background-color: var(--vscode-button-background);
      color: var(--vscode-button-foreground);
      border: none;
      padding: 10px 20px;
      border-radius: 4px;
      cursor: pointer;
      font-size: 14px;
      font-weight: 500;
    }

    button:hover {
      background-color: var(--vscode-button-hoverBackground);
    }

    button:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }

    .time-info {
      display: flex;
      justify-content: space-between;
      margin-top: 15px;
      font-size: 13px;
      color: var(--vscode-descriptionForeground);
    }

    .empty-state {
      text-align: center;
      padding: 60px 20px;
      color: var(--vscode-descriptionForeground);
    }

    .empty-state-icon {
      font-size: 48px;
      margin-bottom: 20px;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Automation Progress</h1>
      <span id="statusBadge" class="status-badge status-idle">Idle</span>
    </div>

    <div id="progressSection" class="progress-section" style="display: none;">
      <div class="progress-bar-container">
        <div id="progressBar" class="progress-bar" style="width: 0%;">
          <span id="progressText">0%</span>
        </div>
      </div>

      <div class="stats-grid">
        <div class="stat-card">
          <div class="stat-label">Completed</div>
          <div class="stat-value" id="completedCount">0</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">Total</div>
          <div class="stat-value" id="totalCount">0</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">Failed</div>
          <div class="stat-value" id="failedCount">0</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">Skipped</div>
          <div class="stat-value" id="skippedCount">0</div>
        </div>
      </div>

      <div class="time-info">
        <span id="elapsedTime">Elapsed: --:--:--</span>
        <span id="estimatedTime">Estimated: --:--:--</span>
      </div>
    </div>

    <div id="currentTask" class="current-task" style="display: none;">
      <h2>Current Task</h2>
      <div class="task-title" id="taskTitle">No task running</div>
      <div class="task-description" id="taskDescription"></div>
    </div>

    <div id="emptyState" class="empty-state">
      <div class="empty-state-icon">🤖</div>
      <h2>No Automation Running</h2>
      <p>Start automation to see progress here</p>
    </div>

    <div class="controls">
      <button id="startBtn" onclick="sendCommand('start')">Start</button>
      <button id="stopBtn" onclick="sendCommand('stop')" disabled>Stop</button>
      <button id="pauseBtn" onclick="sendCommand('pause')" disabled>Pause</button>
      <button id="resumeBtn" onclick="sendCommand('resume')" disabled>Resume</button>
    </div>
  </div>

  <script>
    const vscode = acquireVsCodeApi();
    let startTime = null;
    let timerInterval = null;

    function sendCommand(command) {
      vscode.postMessage({ command });
    }

    function updateProgress(data) {
      const isRunning = data.isRunning;
      
      // Update status badge
      const statusBadge = document.getElementById('statusBadge');
      statusBadge.textContent = isRunning ? 'Running' : 'Idle';
      statusBadge.className = 'status-badge ' + (isRunning ? 'status-running' : 'status-idle');

      // Show/hide sections
      document.getElementById('progressSection').style.display = isRunning ? 'block' : 'none';
      document.getElementById('emptyState').style.display = isRunning ? 'none' : 'block';

      // Update progress bar
      const progress = data.totalCount > 0 
        ? Math.round((data.completedCount / data.totalCount) * 100) 
        : 0;
      document.getElementById('progressBar').style.width = progress + '%';
      document.getElementById('progressText').textContent = progress + '%';

      // Update stats
      document.getElementById('completedCount').textContent = data.completedCount;
      document.getElementById('totalCount').textContent = data.totalCount;
      document.getElementById('failedCount').textContent = data.failedCount;
      document.getElementById('skippedCount').textContent = data.skippedCount;

      // Update buttons
      document.getElementById('startBtn').disabled = isRunning;
      document.getElementById('stopBtn').disabled = !isRunning;
      document.getElementById('pauseBtn').disabled = !isRunning;
      document.getElementById('resumeBtn').disabled = !isRunning;

      // Update timer
      if (isRunning && data.startTime) {
        startTime = new Date(data.startTime);
        if (!timerInterval) {
          timerInterval = setInterval(updateTimer, 1000);
        }
      } else {
        if (timerInterval) {
          clearInterval(timerInterval);
          timerInterval = null;
        }
        startTime = null;
      }

      // Update estimated time
      if (data.estimatedTimeRemaining !== null) {
        const hours = Math.floor(data.estimatedTimeRemaining / 3600000);
        const minutes = Math.floor((data.estimatedTimeRemaining % 3600000) / 60000);
        const seconds = Math.floor((data.estimatedTimeRemaining % 60000) / 1000);
        document.getElementById('estimatedTime').textContent = 
          \`Estimated: \${pad(hours)}:\${pad(minutes)}:\${pad(seconds)}\`;
      } else {
        document.getElementById('estimatedTime').textContent = 'Estimated: --:--:--';
      }
    }

    function updateTask(data) {
      const task = data.task;
      if (task) {
        document.getElementById('currentTask').style.display = 'block';
        document.getElementById('taskTitle').textContent = task.title;
        document.getElementById('taskDescription').textContent = 
          task.description ? task.description.join(' ') : '';
      } else {
        document.getElementById('currentTask').style.display = 'none';
      }
    }

    function updateTimer() {
      if (!startTime) return;
      
      const now = new Date();
      const elapsed = now - startTime;
      const hours = Math.floor(elapsed / 3600000);
      const minutes = Math.floor((elapsed % 3600000) / 60000);
      const seconds = Math.floor((elapsed % 60000) / 1000);
      
      document.getElementById('elapsedTime').textContent = 
        \`Elapsed: \${pad(hours)}:\${pad(minutes)}:\${pad(seconds)}\`;
    }

    function pad(num) {
      return num.toString().padStart(2, '0');
    }

    // Handle messages from extension
    window.addEventListener('message', event => {
      const message = event.data;
      switch (message.command) {
        case 'updateProgress':
          updateProgress(message.data);
          break;
        case 'updateTask':
          updateTask(message.data);
          break;
      }
    });
  </script>
</body>
</html>`;
  }
}
