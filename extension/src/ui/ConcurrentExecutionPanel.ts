import * as vscode from 'vscode';
import { ConcurrentExecutionStatus } from '../ConcurrentWorkspaceExecutor';

/**
 * Concurrent execution panel
 * Displays status of concurrent workspace automation
 */
export class ConcurrentExecutionPanel {
  public static currentPanel: ConcurrentExecutionPanel | undefined;
  private readonly panel: vscode.WebviewPanel;
  private disposables: vscode.Disposable[] = [];
  private currentStatus?: ConcurrentExecutionStatus;

  private constructor(panel: vscode.WebviewPanel, _extensionUri: vscode.Uri) {
    this.panel = panel;

    // Set initial HTML
    this.update();

    // Handle messages from webview
    this.panel.webview.onDidReceiveMessage(
      (message) => {
        switch (message.command) {
          case 'stop':
            vscode.commands.executeCommand('kiro-automation.stopConcurrent');
            break;
          case 'pause':
            vscode.commands.executeCommand('kiro-automation.pauseConcurrent');
            break;
          case 'resume':
            vscode.commands.executeCommand('kiro-automation.resumeConcurrent');
            break;
        }
      },
      null,
      this.disposables
    );

    // Handle panel disposal
    this.panel.onDidDispose(() => this.dispose(), null, this.disposables);
  }

  /**
   * Creates or shows the concurrent execution panel
   * @param extensionUri Extension URI
   * @returns Panel instance
   */
  public static createOrShow(extensionUri: vscode.Uri): ConcurrentExecutionPanel {
    const column = vscode.ViewColumn.Two;

    // If panel already exists, show it
    if (ConcurrentExecutionPanel.currentPanel) {
      ConcurrentExecutionPanel.currentPanel.panel.reveal(column);
      return ConcurrentExecutionPanel.currentPanel;
    }

    // Create new panel
    const panel = vscode.window.createWebviewPanel(
      'kiroAutomationConcurrent',
      'Concurrent Automation',
      column,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
      }
    );

    ConcurrentExecutionPanel.currentPanel = new ConcurrentExecutionPanel(panel, extensionUri);
    return ConcurrentExecutionPanel.currentPanel;
  }

  /**
   * Updates the panel with new status
   * @param status Concurrent execution status
   */
  public updateStatus(status: ConcurrentExecutionStatus): void {
    this.currentStatus = status;
    this.update();
  }

  /**
   * Updates the webview HTML
   */
  private update(): void {
    this.panel.webview.html = this.getHtmlContent();
  }

  /**
   * Generates HTML content for the webview
   * @returns HTML string
   */
  private getHtmlContent(): string {
    const status = this.currentStatus;

    if (!status) {
      return this.getEmptyStateHtml();
    }

    const workspaceRows = this.generateWorkspaceRows(status);
    const progressPercent = this.calculateProgress(status);

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Concurrent Automation</title>
  <style>
    body {
      font-family: var(--vscode-font-family);
      color: var(--vscode-foreground);
      background-color: var(--vscode-editor-background);
      padding: 20px;
      margin: 0;
    }
    .header {
      margin-bottom: 20px;
    }
    h1 {
      font-size: 24px;
      margin: 0 0 10px 0;
    }
    .controls {
      margin: 20px 0;
    }
    button {
      background-color: var(--vscode-button-background);
      color: var(--vscode-button-foreground);
      border: none;
      padding: 8px 16px;
      margin-right: 10px;
      cursor: pointer;
      border-radius: 2px;
    }
    button:hover {
      background-color: var(--vscode-button-hoverBackground);
    }
    .stats {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 15px;
      margin: 20px 0;
    }
    .stat-card {
      background-color: var(--vscode-editor-inactiveSelectionBackground);
      padding: 15px;
      border-radius: 4px;
    }
    .stat-label {
      font-size: 12px;
      opacity: 0.8;
      margin-bottom: 5px;
    }
    .stat-value {
      font-size: 24px;
      font-weight: bold;
    }
    .progress-bar {
      width: 100%;
      height: 30px;
      background-color: var(--vscode-editor-inactiveSelectionBackground);
      border-radius: 4px;
      overflow: hidden;
      margin: 20px 0;
    }
    .progress-fill {
      height: 100%;
      background-color: var(--vscode-progressBar-background);
      transition: width 0.3s ease;
      display: flex;
      align-items: center;
      justify-content: center;
      color: white;
      font-weight: bold;
    }
    .workspace-table {
      width: 100%;
      border-collapse: collapse;
      margin: 20px 0;
    }
    .workspace-table th,
    .workspace-table td {
      padding: 10px;
      text-align: left;
      border-bottom: 1px solid var(--vscode-panel-border);
    }
    .workspace-table th {
      background-color: var(--vscode-editor-inactiveSelectionBackground);
      font-weight: bold;
    }
    .status-badge {
      display: inline-block;
      padding: 4px 8px;
      border-radius: 3px;
      font-size: 11px;
      font-weight: bold;
    }
    .status-running {
      background-color: #4CAF50;
      color: white;
    }
    .status-queued {
      background-color: #FF9800;
      color: white;
    }
    .status-completed {
      background-color: #2196F3;
      color: white;
    }
    .status-failed {
      background-color: #F44336;
      color: white;
    }
    .resource-bar {
      width: 100%;
      height: 8px;
      background-color: var(--vscode-editor-inactiveSelectionBackground);
      border-radius: 4px;
      overflow: hidden;
      margin-top: 4px;
    }
    .resource-fill {
      height: 100%;
      background-color: var(--vscode-progressBar-background);
    }
  </style>
</head>
<body>
  <div class="header">
    <h1>Concurrent Workspace Automation</h1>
    <p>Managing automation across multiple workspaces</p>
  </div>

  <div class="controls">
    <button onclick="sendCommand('pause')">⏸ Pause All</button>
    <button onclick="sendCommand('resume')">▶ Resume All</button>
    <button onclick="sendCommand('stop')">⏹ Stop All</button>
  </div>

  <div class="progress-bar">
    <div class="progress-fill" style="width: ${progressPercent}%">
      ${progressPercent.toFixed(0)}%
    </div>
  </div>

  <div class="stats">
    <div class="stat-card">
      <div class="stat-label">Total Workspaces</div>
      <div class="stat-value">${status.totalWorkspaces}</div>
    </div>
    <div class="stat-card">
      <div class="stat-label">Running</div>
      <div class="stat-value">${status.runningWorkspaces}</div>
    </div>
    <div class="stat-card">
      <div class="stat-label">Queued</div>
      <div class="stat-value">${status.queuedWorkspaces}</div>
    </div>
    <div class="stat-card">
      <div class="stat-label">Completed</div>
      <div class="stat-value">${status.completedWorkspaces}</div>
    </div>
    <div class="stat-card">
      <div class="stat-label">Failed</div>
      <div class="stat-value">${status.failedWorkspaces}</div>
    </div>
    <div class="stat-card">
      <div class="stat-label">Estimated Completion</div>
      <div class="stat-value" style="font-size: 14px;">
        ${status.estimatedCompletionTime ? new Date(status.estimatedCompletionTime).toLocaleTimeString() : 'N/A'}
      </div>
    </div>
  </div>

  <h2>Workspace Details</h2>
  <table class="workspace-table">
    <thead>
      <tr>
        <th>Workspace</th>
        <th>Status</th>
        <th>Priority</th>
        <th>Memory</th>
        <th>CPU</th>
      </tr>
    </thead>
    <tbody>
      ${workspaceRows}
    </tbody>
  </table>

  <script>
    const vscode = acquireVsCodeApi();

    function sendCommand(command) {
      vscode.postMessage({ command });
    }
  </script>
</body>
</html>`;
  }

  /**
   * Generates HTML for empty state
   * @returns HTML string
   */
  private getEmptyStateHtml(): string {
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Concurrent Automation</title>
  <style>
    body {
      font-family: var(--vscode-font-family);
      color: var(--vscode-foreground);
      background-color: var(--vscode-editor-background);
      padding: 20px;
      margin: 0;
      display: flex;
      align-items: center;
      justify-content: center;
      height: 100vh;
    }
    .empty-state {
      text-align: center;
      max-width: 400px;
    }
    h1 {
      font-size: 24px;
      margin-bottom: 10px;
    }
    p {
      opacity: 0.8;
      margin-bottom: 20px;
    }
  </style>
</head>
<body>
  <div class="empty-state">
    <h1>No Concurrent Automation Running</h1>
    <p>Start concurrent automation to see workspace status and progress here.</p>
  </div>
</body>
</html>`;
  }

  /**
   * Generates workspace table rows
   * @param status Concurrent execution status
   * @returns HTML string
   */
  private generateWorkspaceRows(status: ConcurrentExecutionStatus): string {
    const rows: string[] = [];

    for (const [workspaceUri, allocation] of status.resourceAllocations) {
      const workspaceName = this.getWorkspaceName(workspaceUri);
      const statusBadge = this.getStatusBadge(workspaceUri, status);
      const memoryPercent = (allocation.currentMemoryMB / allocation.maxMemoryMB) * 100;
      const cpuPercent = (allocation.currentCpuPercent / allocation.maxCpuPercent) * 100;

      rows.push(`
        <tr>
          <td>${workspaceName}</td>
          <td>${statusBadge}</td>
          <td>${allocation.priority}</td>
          <td>
            ${allocation.currentMemoryMB.toFixed(0)} / ${allocation.maxMemoryMB} MB
            <div class="resource-bar">
              <div class="resource-fill" style="width: ${memoryPercent}%"></div>
            </div>
          </td>
          <td>
            ${allocation.currentCpuPercent.toFixed(0)} / ${allocation.maxCpuPercent}%
            <div class="resource-bar">
              <div class="resource-fill" style="width: ${cpuPercent}%"></div>
            </div>
          </td>
        </tr>
      `);
    }

    return rows.join('');
  }

  /**
   * Gets workspace name from URI
   * @param workspaceUri Workspace URI
   * @returns Workspace name
   */
  private getWorkspaceName(workspaceUri: string): string {
    try {
      const uri = vscode.Uri.parse(workspaceUri);
      const folders = vscode.workspace.workspaceFolders;
      const folder = folders?.find((f) => f.uri.toString() === workspaceUri);
      return folder?.name || uri.fsPath.split(/[/\\]/).pop() || workspaceUri;
    } catch {
      return workspaceUri;
    }
  }

  /**
   * Gets status badge HTML
   * @param workspaceUri Workspace URI
   * @param status Concurrent execution status
   * @returns HTML string
   */
  private getStatusBadge(workspaceUri: string, status: ConcurrentExecutionStatus): string {
    // Determine status
    let statusClass = 'status-queued';
    let statusText = 'Queued';

    // Check if running
    const allocations = Array.from(status.resourceAllocations.keys());
    const runningIndex = allocations.indexOf(workspaceUri);
    
    if (runningIndex < status.runningWorkspaces) {
      statusClass = 'status-running';
      statusText = 'Running';
    } else if (runningIndex < status.runningWorkspaces + status.completedWorkspaces) {
      statusClass = 'status-completed';
      statusText = 'Completed';
    } else if (runningIndex < status.runningWorkspaces + status.completedWorkspaces + status.failedWorkspaces) {
      statusClass = 'status-failed';
      statusText = 'Failed';
    }

    return `<span class="status-badge ${statusClass}">${statusText}</span>`;
  }

  /**
   * Calculates overall progress percentage
   * @param status Concurrent execution status
   * @returns Progress percentage
   */
  private calculateProgress(status: ConcurrentExecutionStatus): number {
    if (status.totalWorkspaces === 0) {
      return 0;
    }

    const completed = status.completedWorkspaces + status.failedWorkspaces;
    return (completed / status.totalWorkspaces) * 100;
  }

  /**
   * Disposes of the panel
   */
  public dispose(): void {
    ConcurrentExecutionPanel.currentPanel = undefined;

    this.panel.dispose();

    while (this.disposables.length) {
      const disposable = this.disposables.pop();
      if (disposable) {
        disposable.dispose();
      }
    }
  }
}
