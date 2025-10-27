import * as vscode from 'vscode';

/**
 * Help panel for displaying in-editor documentation and assistance
 */
export class HelpPanel {
  private static currentPanel: HelpPanel | undefined;
  private readonly panel: vscode.WebviewPanel;
  private disposables: vscode.Disposable[] = [];

  private constructor(panel: vscode.WebviewPanel, extensionUri: vscode.Uri) {
    this.panel = panel;

    // Set the webview's initial html content
    this.panel.webview.html = this.getHtmlContent(this.panel.webview, extensionUri);

    // Listen for when the panel is disposed
    this.panel.onDidDispose(() => this.dispose(), null, this.disposables);

    // Handle messages from the webview
    this.panel.webview.onDidReceiveMessage(
      (message) => {
        switch (message.command) {
          case 'openSettings':
            vscode.commands.executeCommand('workbench.action.openSettings', 'kiro-automation');
            break;
          case 'openCommand':
            vscode.commands.executeCommand(message.commandId);
            break;
          case 'openExternal':
            vscode.env.openExternal(vscode.Uri.parse(message.url));
            break;
        }
      },
      null,
      this.disposables
    );
  }

  /**
   * Show the help panel
   */
  public static show(extensionUri: vscode.Uri, topic?: string) {
    const column = vscode.window.activeTextEditor
      ? vscode.window.activeTextEditor.viewColumn
      : undefined;

    // If we already have a panel, show it
    if (HelpPanel.currentPanel) {
      HelpPanel.currentPanel.panel.reveal(column);
      if (topic) {
        HelpPanel.currentPanel.showTopic(topic);
      }
      return;
    }

    // Otherwise, create a new panel
    const panel = vscode.window.createWebviewPanel(
      'kiroAutomationHelp',
      'Kiro Automation Help',
      column || vscode.ViewColumn.One,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
        localResourceRoots: [extensionUri],
      }
    );

    HelpPanel.currentPanel = new HelpPanel(panel, extensionUri);
    
    if (topic) {
      HelpPanel.currentPanel.showTopic(topic);
    }
  }

  /**
   * Show a specific help topic
   */
  private showTopic(topic: string) {
    this.panel.webview.postMessage({ command: 'showTopic', topic });
  }

  /**
   * Dispose of the panel
   */
  public dispose() {
    HelpPanel.currentPanel = undefined;

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
  <title>Kiro Automation Help</title>
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
      padding: 20px;
      line-height: 1.6;
    }

    .container {
      max-width: 900px;
      margin: 0 auto;
    }

    .header {
      border-bottom: 1px solid var(--vscode-panel-border);
      padding-bottom: 20px;
      margin-bottom: 30px;
    }

    h1 {
      font-size: 28px;
      font-weight: 600;
      margin-bottom: 10px;
      color: var(--vscode-foreground);
    }

    h2 {
      font-size: 20px;
      font-weight: 600;
      margin-top: 30px;
      margin-bottom: 15px;
      color: var(--vscode-foreground);
      border-bottom: 1px solid var(--vscode-panel-border);
      padding-bottom: 8px;
    }

    h3 {
      font-size: 16px;
      font-weight: 600;
      margin-top: 20px;
      margin-bottom: 10px;
      color: var(--vscode-foreground);
    }

    p {
      margin-bottom: 15px;
    }

    .subtitle {
      color: var(--vscode-descriptionForeground);
      font-size: 14px;
    }

    .search-box {
      margin-bottom: 30px;
    }

    .search-input {
      width: 100%;
      padding: 10px;
      background-color: var(--vscode-input-background);
      color: var(--vscode-input-foreground);
      border: 1px solid var(--vscode-input-border);
      border-radius: 4px;
      font-size: 14px;
    }

    .search-input:focus {
      outline: 1px solid var(--vscode-focusBorder);
    }

    .nav-tabs {
      display: flex;
      gap: 10px;
      margin-bottom: 20px;
      border-bottom: 1px solid var(--vscode-panel-border);
    }

    .nav-tab {
      padding: 10px 20px;
      background: none;
      border: none;
      color: var(--vscode-foreground);
      cursor: pointer;
      font-size: 14px;
      border-bottom: 2px solid transparent;
      transition: all 0.2s;
    }

    .nav-tab:hover {
      background-color: var(--vscode-list-hoverBackground);
    }

    .nav-tab.active {
      border-bottom-color: var(--vscode-focusBorder);
      color: var(--vscode-focusBorder);
    }

    .tab-content {
      display: none;
    }

    .tab-content.active {
      display: block;
    }

    .command-list {
      list-style: none;
    }

    .command-item {
      padding: 15px;
      margin-bottom: 10px;
      background-color: var(--vscode-editor-inactiveSelectionBackground);
      border-radius: 4px;
      border-left: 3px solid var(--vscode-focusBorder);
    }

    .command-name {
      font-weight: 600;
      color: var(--vscode-textLink-foreground);
      margin-bottom: 5px;
      cursor: pointer;
    }

    .command-name:hover {
      text-decoration: underline;
    }

    .command-desc {
      color: var(--vscode-descriptionForeground);
      font-size: 13px;
    }

    .setting-item {
      padding: 15px;
      margin-bottom: 10px;
      background-color: var(--vscode-editor-inactiveSelectionBackground);
      border-radius: 4px;
    }

    .setting-name {
      font-weight: 600;
      font-family: var(--vscode-editor-font-family);
      color: var(--vscode-symbolIcon-variableForeground);
      margin-bottom: 5px;
    }

    .setting-type {
      display: inline-block;
      padding: 2px 8px;
      background-color: var(--vscode-badge-background);
      color: var(--vscode-badge-foreground);
      border-radius: 3px;
      font-size: 11px;
      margin-left: 10px;
    }

    .setting-desc {
      color: var(--vscode-descriptionForeground);
      font-size: 13px;
      margin-top: 5px;
    }

    .setting-default {
      color: var(--vscode-descriptionForeground);
      font-size: 12px;
      font-style: italic;
      margin-top: 5px;
    }

    .troubleshooting-item {
      margin-bottom: 25px;
    }

    .problem {
      font-weight: 600;
      color: var(--vscode-errorForeground);
      margin-bottom: 8px;
    }

    .solution {
      padding-left: 20px;
    }

    .solution li {
      margin-bottom: 5px;
      color: var(--vscode-descriptionForeground);
    }

    .quick-start-steps {
      counter-reset: step-counter;
      list-style: none;
    }

    .quick-start-steps li {
      counter-increment: step-counter;
      padding: 15px;
      margin-bottom: 15px;
      background-color: var(--vscode-editor-inactiveSelectionBackground);
      border-radius: 4px;
      position: relative;
      padding-left: 50px;
    }

    .quick-start-steps li::before {
      content: counter(step-counter);
      position: absolute;
      left: 15px;
      top: 15px;
      width: 25px;
      height: 25px;
      background-color: var(--vscode-focusBorder);
      color: var(--vscode-editor-background);
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-weight: 600;
      font-size: 14px;
    }

    .btn {
      display: inline-block;
      padding: 8px 16px;
      background-color: var(--vscode-button-background);
      color: var(--vscode-button-foreground);
      border: none;
      border-radius: 4px;
      cursor: pointer;
      font-size: 13px;
      text-decoration: none;
      margin-right: 10px;
      margin-top: 10px;
    }

    .btn:hover {
      background-color: var(--vscode-button-hoverBackground);
    }

    .btn-secondary {
      background-color: var(--vscode-button-secondaryBackground);
      color: var(--vscode-button-secondaryForeground);
    }

    .btn-secondary:hover {
      background-color: var(--vscode-button-secondaryHoverBackground);
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

    .info-box {
      padding: 15px;
      background-color: var(--vscode-inputValidation-infoBackground);
      border-left: 3px solid var(--vscode-inputValidation-infoBorder);
      border-radius: 4px;
      margin: 15px 0;
    }

    .warning-box {
      padding: 15px;
      background-color: var(--vscode-inputValidation-warningBackground);
      border-left: 3px solid var(--vscode-inputValidation-warningBorder);
      border-radius: 4px;
      margin: 15px 0;
    }

    .keyboard-shortcut {
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

    .hidden {
      display: none;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>🤖 Kiro Automation Help</h1>
      <p class="subtitle">Comprehensive guide to autonomous task execution</p>
    </div>

    <div class="search-box">
      <input 
        type="text" 
        class="search-input" 
        id="searchInput" 
        placeholder="Search help topics..."
      />
    </div>

    <div class="nav-tabs">
      <button class="nav-tab active" data-tab="getting-started">Getting Started</button>
      <button class="nav-tab" data-tab="commands">Commands</button>
      <button class="nav-tab" data-tab="settings">Settings</button>
      <button class="nav-tab" data-tab="troubleshooting">Troubleshooting</button>
      <button class="nav-tab" data-tab="advanced">Advanced</button>
    </div>

    <div id="getting-started" class="tab-content active">
      <h2>Quick Start Guide</h2>
      <p>Get up and running with Kiro Automation in minutes.</p>

      <ol class="quick-start-steps">
        <li>
          <strong>Verify Installation</strong><br>
          Open Command Palette (<span class="keyboard-shortcut">Ctrl+Shift+P</span>) and type "Kiro Automation" to see available commands.
        </li>
        <li>
          <strong>Check Workspace Structure</strong><br>
          Ensure your workspace has a <code>.kiro/specs/*/tasks.md</code> file with tasks to execute.
        </li>
        <li>
          <strong>Start Automation</strong><br>
          Run <code>Kiro Automation: Start</code> from Command Palette or click the play button in the Task Tree View.
        </li>
        <li>
          <strong>Monitor Progress</strong><br>
          Watch the Progress Panel and Task Tree View for real-time updates on task execution.
        </li>
      </ol>

      <div class="info-box">
        <strong>💡 Tip:</strong> Enable debug logging in settings to see detailed execution information.
      </div>

      <button class="btn" onclick="openSettings()">Open Settings</button>
      <button class="btn btn-secondary" onclick="openCommand('kiro-automation.start')">Start Automation</button>
    </div>

    <div id="commands" class="tab-content">
      <h2>Available Commands</h2>
      <p>All commands are accessible via Command Palette (<span class="keyboard-shortcut">Ctrl+Shift+P</span>)</p>

      <h3>Automation Control</h3>
      <ul class="command-list">
        <li class="command-item">
          <div class="command-name" onclick="openCommand('kiro-automation.start')">Kiro Automation: Start</div>
          <div class="command-desc">Start automation session for the current workspace</div>
        </li>
        <li class="command-item">
          <div class="command-name" onclick="openCommand('kiro-automation.stop')">Kiro Automation: Stop</div>
          <div class="command-desc">Stop the running automation session</div>
        </li>
        <li class="command-item">
          <div class="command-name" onclick="openCommand('kiro-automation.pause')">Kiro Automation: Pause</div>
          <div class="command-desc">Pause automation (can be resumed later)</div>
        </li>
        <li class="command-item">
          <div class="command-name" onclick="openCommand('kiro-automation.resume')">Kiro Automation: Resume</div>
          <div class="command-desc">Resume a paused automation session</div>
        </li>
        <li class="command-item">
          <div class="command-name" onclick="openCommand('kiro-automation.nextTask')">Kiro Automation: Execute Next Task</div>
          <div class="command-desc">Execute only the next pending task</div>
        </li>
      </ul>

      <h3>UI and Monitoring</h3>
      <ul class="command-list">
        <li class="command-item">
          <div class="command-name" onclick="openCommand('kiro-automation.showPanel')">Kiro Automation: Show Progress Panel</div>
          <div class="command-desc">Open the progress monitoring webview</div>
        </li>
        <li class="command-item">
          <div class="command-name" onclick="openCommand('kiro-automation.showControls')">Kiro Automation: Show Control Panel</div>
          <div class="command-desc">Open the automation control panel</div>
        </li>
        <li class="command-item">
          <div class="command-name" onclick="openCommand('kiro-automation.showLogs')">Kiro Automation: Show Logs</div>
          <div class="command-desc">Display automation logs in output channel</div>
        </li>
        <li class="command-item">
          <div class="command-name" onclick="openCommand('kiro-automation.refreshTasks')">Kiro Automation: Refresh Tasks</div>
          <div class="command-desc">Manually refresh the task list from files</div>
        </li>
      </ul>

      <h3>Multi-Workspace</h3>
      <ul class="command-list">
        <li class="command-item">
          <div class="command-name" onclick="openCommand('kiro-automation.startConcurrent')">Kiro Automation: Start Concurrent Automation</div>
          <div class="command-desc">Run automation on multiple workspaces simultaneously</div>
        </li>
        <li class="command-item">
          <div class="command-name" onclick="openCommand('kiro-automation.switchWorkspace')">Kiro Automation: Switch Workspace</div>
          <div class="command-desc">Switch between workspace automation sessions</div>
        </li>
      </ul>
    </div>

    <div id="settings" class="tab-content">
      <h2>Configuration Settings</h2>
      <p>Customize automation behavior through VS Code settings.</p>

      <h3>Core Settings</h3>
      <div class="setting-item">
        <div class="setting-name">
          kiro-automation.enabled
          <span class="setting-type">boolean</span>
        </div>
        <div class="setting-desc">Enable or disable Kiro automation</div>
        <div class="setting-default">Default: <code>true</code></div>
      </div>

      <div class="setting-item">
        <div class="setting-name">
          kiro-automation.concurrency
          <span class="setting-type">number</span>
        </div>
        <div class="setting-desc">Number of concurrent tasks to execute (1-10)</div>
        <div class="setting-default">Default: <code>1</code></div>
      </div>

      <div class="setting-item">
        <div class="setting-name">
          kiro-automation.retryAttempts
          <span class="setting-type">number</span>
        </div>
        <div class="setting-desc">Number of retry attempts for failed tasks (0-10)</div>
        <div class="setting-default">Default: <code>3</code></div>
      </div>

      <div class="setting-item">
        <div class="setting-name">
          kiro-automation.timeout
          <span class="setting-type">number</span>
        </div>
        <div class="setting-desc">Task timeout in milliseconds (1000-3600000)</div>
        <div class="setting-default">Default: <code>300000</code> (5 minutes)</div>
      </div>

      <h3>Logging</h3>
      <div class="setting-item">
        <div class="setting-name">
          kiro-automation.logLevel
          <span class="setting-type">string</span>
        </div>
        <div class="setting-desc">Logging level: debug, info, warning, error</div>
        <div class="setting-default">Default: <code>"info"</code></div>
      </div>

      <div class="setting-item">
        <div class="setting-name">
          kiro-automation.saveLogsToFile
          <span class="setting-type">boolean</span>
        </div>
        <div class="setting-desc">Save automation logs to file</div>
        <div class="setting-default">Default: <code>true</code></div>
      </div>

      <h3>Automation Behavior</h3>
      <div class="setting-item">
        <div class="setting-name">
          kiro-automation.skipOptionalTasks
          <span class="setting-type">boolean</span>
        </div>
        <div class="setting-desc">Skip tasks marked with * (optional)</div>
        <div class="setting-default">Default: <code>false</code></div>
      </div>

      <div class="setting-item">
        <div class="setting-name">
          kiro-automation.verifyCompletion
          <span class="setting-type">boolean</span>
        </div>
        <div class="setting-desc">Verify task completion before proceeding</div>
        <div class="setting-default">Default: <code>true</code></div>
      </div>

      <button class="btn" onclick="openSettings()">Open All Settings</button>
    </div>

    <div id="troubleshooting" class="tab-content">
      <h2>Troubleshooting Guide</h2>
      <p>Solutions to common issues and problems.</p>

      <div class="troubleshooting-item">
        <div class="problem">❌ Extension Not Activating</div>
        <ul class="solution">
          <li>Verify <code>.kiro</code> directory exists in workspace root</li>
          <li>Check VS Code version (must be 1.85.0+)</li>
          <li>Reload VS Code window: <code>Developer: Reload Window</code></li>
          <li>Check extension is enabled in Extensions view</li>
        </ul>
      </div>

      <div class="troubleshooting-item">
        <div class="problem">⚠️ Kiro IDE Not Detected</div>
        <ul class="solution">
          <li>Ensure Kiro IDE extension is installed and active</li>
          <li>Check Kiro extension version compatibility</li>
          <li>Restart VS Code</li>
          <li>Check logs: <code>Kiro Automation: Show Logs</code></li>
        </ul>
      </div>

      <div class="troubleshooting-item">
        <div class="problem">📋 Tasks Not Discovered</div>
        <ul class="solution">
          <li>Verify task files exist at <code>.kiro/specs/*/tasks.md</code></li>
          <li>Check task file format (must be valid markdown)</li>
          <li>Run <code>Kiro Automation: Refresh Tasks</code></li>
          <li>Review logs for parsing errors</li>
        </ul>
      </div>

      <div class="troubleshooting-item">
        <div class="problem">⏱️ Automation Stuck or Hanging</div>
        <ul class="solution">
          <li>Increase <code>timeout</code> setting</li>
          <li>Verify Kiro chat is responding</li>
          <li>Check for file system permission issues</li>
          <li>Stop and restart automation</li>
          <li>Enable debug logging to see detailed information</li>
        </ul>
      </div>

      <div class="troubleshooting-item">
        <div class="problem">💾 High Memory Usage</div>
        <ul class="solution">
          <li>Reduce <code>concurrency</code> setting to 1</li>
          <li>Lower <code>maxMemoryUsage</code> setting</li>
          <li>Clear logs: <code>Kiro Automation: Clear Logs</code></li>
          <li>Restart VS Code</li>
        </ul>
      </div>

      <div class="warning-box">
        <strong>🔍 Debug Mode:</strong> Set <code>"kiro-automation.logLevel": "debug"</code> in settings for detailed troubleshooting information.
      </div>

      <button class="btn" onclick="openCommand('kiro-automation.showLogs')">View Logs</button>
      <button class="btn btn-secondary" onclick="openExternal('https://github.com/your-org/kiro-automation-extension/issues')">Report Issue</button>
    </div>

    <div id="advanced" class="tab-content">
      <h2>Advanced Features</h2>

      <h3>Custom Prompt Templates</h3>
      <p>Create custom prompts for task execution using template variables:</p>
      <pre><code>{
  "kiro-automation.customPromptTemplate": "Execute: {{taskTitle}}\\n\\nContext:\\n{{requirements}}"
}</code></pre>
      <p>Available variables:</p>
      <ul>
        <li><code>{{taskTitle}}</code> - Task title</li>
        <li><code>{{taskId}}</code> - Task ID</li>
        <li><code>{{requirements}}</code> - Requirements document</li>
        <li><code>{{design}}</code> - Design document</li>
        <li><code>{{subtasks}}</code> - List of subtasks</li>
      </ul>

      <h3>Performance Monitoring</h3>
      <p>Enable performance tracking to monitor resource usage:</p>
      <pre><code>{
  "kiro-automation.performanceMonitoring": true,
  "kiro-automation.maxMemoryUsage": 100
}</code></pre>

      <h3>Workspace-Specific Configuration</h3>
      <p>Override global settings per workspace by creating <code>.vscode/settings.json</code>:</p>
      <pre><code>{
  "kiro-automation.retryAttempts": 5,
  "kiro-automation.timeout": 600000
}</code></pre>

      <h3>Excluding Tasks</h3>
      <p>Exclude specific specs or tasks from automation:</p>
      <pre><code>{
  "kiro-automation.excludedSpecs": ["experimental-feature"],
  "kiro-automation.excludedTasks": ["17.3", "18.1"]
}</code></pre>

      <button class="btn" onclick="openExternal('https://github.com/your-org/kiro-automation-extension/wiki')">Full Documentation</button>
    </div>
  </div>

  <script>
    const vscode = acquireVsCodeApi();

    // Tab switching
    document.querySelectorAll('.nav-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        const targetTab = tab.dataset.tab;
        
        // Update active tab
        document.querySelectorAll('.nav-tab').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        
        // Update active content
        document.querySelectorAll('.tab-content').forEach(content => {
          content.classList.remove('active');
        });
        document.getElementById(targetTab).classList.add('active');
      });
    });

    // Search functionality
    const searchInput = document.getElementById('searchInput');
    searchInput.addEventListener('input', (e) => {
      const searchTerm = e.target.value.toLowerCase();
      
      document.querySelectorAll('.command-item, .setting-item, .troubleshooting-item').forEach(item => {
        const text = item.textContent.toLowerCase();
        if (text.includes(searchTerm)) {
          item.classList.remove('hidden');
        } else {
          item.classList.add('hidden');
        }
      });
    });

    // Helper functions
    function openSettings() {
      vscode.postMessage({ command: 'openSettings' });
    }

    function openCommand(commandId) {
      vscode.postMessage({ command: 'openCommand', commandId });
    }

    function openExternal(url) {
      vscode.postMessage({ command: 'openExternal', url });
    }

    // Listen for messages from extension
    window.addEventListener('message', event => {
      const message = event.data;
      switch (message.command) {
        case 'showTopic':
          const tab = document.querySelector(\`[data-tab="\${message.topic}"]\`);
          if (tab) {
            tab.click();
          }
          break;
      }
    });
  </script>
</body>
</html>`;
  }
}
