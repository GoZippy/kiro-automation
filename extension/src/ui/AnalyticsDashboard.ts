import * as vscode from 'vscode';
import { TelemetryService } from '../TelemetryService';

/**
 * AnalyticsDashboard provides a local analytics view showing
 * personal usage insights and automation efficiency metrics.
 * 
 * Requirements: 15.4
 */
export class AnalyticsDashboard {
  private panel: vscode.WebviewPanel | undefined;
  private telemetryService: TelemetryService;
  private context: vscode.ExtensionContext;
  private refreshInterval?: NodeJS.Timeout;

  constructor(context: vscode.ExtensionContext, telemetryService: TelemetryService) {
    this.context = context;
    this.telemetryService = telemetryService;
  }

  /**
   * Show the analytics dashboard
   */
  async show(): Promise<void> {
    if (this.panel) {
      this.panel.reveal();
      await this.updateContent();
      return;
    }

    this.panel = vscode.window.createWebviewPanel(
      'kiroAnalytics',
      'Kiro Automation Analytics',
      vscode.ViewColumn.One,
      {
        enableScripts: true,
        retainContextWhenHidden: true
      }
    );

    this.panel.onDidDispose(() => {
      this.panel = undefined;
      this.stopAutoRefresh();
    });

    // Handle messages from webview
    this.panel.webview.onDidReceiveMessage(
      async (message) => {
        switch (message.command) {
          case 'refresh':
            await this.updateContent();
            break;
          case 'export':
            await this.exportData();
            break;
          case 'clearData':
            await this.clearData();
            break;
        }
      }
    );

    await this.updateContent();
    this.startAutoRefresh();
  }

  /**
   * Update dashboard content
   */
  private async updateContent(): Promise<void> {
    if (!this.panel) {
      return;
    }

    try {
      const [metrics, taskStats, failurePatterns, summary] = await Promise.all([
        this.telemetryService.getAutomationMetrics(),
        this.telemetryService.getTaskExecutionStats(),
        this.telemetryService.identifyFailurePatterns(),
        this.telemetryService.getSummary()
      ]);

      this.panel.webview.html = this.getHtmlContent(metrics, taskStats, failurePatterns, summary);
    } catch (error) {
      vscode.window.showErrorMessage(`Failed to load analytics: ${error}`);
    }
  }

  /**
   * Generate HTML content for the dashboard
   */
  private getHtmlContent(
    metrics: any,
    taskStats: any,
    failurePatterns: any[],
    summary: any
  ): string {
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Kiro Automation Analytics</title>
  <style>
    body {
      font-family: var(--vscode-font-family);
      color: var(--vscode-foreground);
      background-color: var(--vscode-editor-background);
      padding: 20px;
      margin: 0;
    }
    
    .header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 30px;
      padding-bottom: 20px;
      border-bottom: 1px solid var(--vscode-panel-border);
    }
    
    h1 {
      margin: 0;
      font-size: 24px;
      font-weight: 600;
    }
    
    .actions {
      display: flex;
      gap: 10px;
    }
    
    button {
      background-color: var(--vscode-button-background);
      color: var(--vscode-button-foreground);
      border: none;
      padding: 8px 16px;
      cursor: pointer;
      border-radius: 2px;
      font-size: 13px;
    }
    
    button:hover {
      background-color: var(--vscode-button-hoverBackground);
    }
    
    .metrics-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
      gap: 20px;
      margin-bottom: 30px;
    }
    
    .metric-card {
      background-color: var(--vscode-editor-inactiveSelectionBackground);
      border: 1px solid var(--vscode-panel-border);
      border-radius: 4px;
      padding: 20px;
    }
    
    .metric-label {
      font-size: 12px;
      text-transform: uppercase;
      color: var(--vscode-descriptionForeground);
      margin-bottom: 8px;
    }
    
    .metric-value {
      font-size: 32px;
      font-weight: 600;
      margin-bottom: 4px;
    }
    
    .metric-unit {
      font-size: 14px;
      color: var(--vscode-descriptionForeground);
    }
    
    .section {
      margin-bottom: 30px;
    }
    
    .section-title {
      font-size: 18px;
      font-weight: 600;
      margin-bottom: 15px;
    }
    
    .chart-container {
      background-color: var(--vscode-editor-inactiveSelectionBackground);
      border: 1px solid var(--vscode-panel-border);
      border-radius: 4px;
      padding: 20px;
      margin-bottom: 20px;
    }
    
    .progress-bar {
      width: 100%;
      height: 8px;
      background-color: var(--vscode-progressBar-background);
      border-radius: 4px;
      overflow: hidden;
      margin-top: 8px;
    }
    
    .progress-fill {
      height: 100%;
      background-color: var(--vscode-progressBar-background);
      transition: width 0.3s ease;
    }
    
    .progress-fill.success {
      background-color: #4caf50;
    }
    
    .progress-fill.warning {
      background-color: #ff9800;
    }
    
    .progress-fill.error {
      background-color: #f44336;
    }
    
    .failure-list {
      list-style: none;
      padding: 0;
      margin: 0;
    }
    
    .failure-item {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 12px;
      margin-bottom: 8px;
      background-color: var(--vscode-editor-inactiveSelectionBackground);
      border: 1px solid var(--vscode-panel-border);
      border-radius: 4px;
    }
    
    .failure-pattern {
      font-weight: 500;
    }
    
    .failure-count {
      display: flex;
      align-items: center;
      gap: 10px;
    }
    
    .trend-badge {
      padding: 4px 8px;
      border-radius: 3px;
      font-size: 11px;
      font-weight: 600;
      text-transform: uppercase;
    }
    
    .trend-increasing {
      background-color: rgba(244, 67, 54, 0.2);
      color: #f44336;
    }
    
    .trend-decreasing {
      background-color: rgba(76, 175, 80, 0.2);
      color: #4caf50;
    }
    
    .trend-stable {
      background-color: rgba(158, 158, 158, 0.2);
      color: #9e9e9e;
    }
    
    .empty-state {
      text-align: center;
      padding: 60px 20px;
      color: var(--vscode-descriptionForeground);
    }
    
    .empty-state-icon {
      font-size: 48px;
      margin-bottom: 16px;
    }
  </style>
</head>
<body>
  <div class="header">
    <h1>📊 Automation Analytics</h1>
    <div class="actions">
      <button onclick="refresh()">Refresh</button>
      <button onclick="exportData()">Export Data</button>
      <button onclick="clearData()">Clear Data</button>
    </div>
  </div>

  ${summary.totalEvents === 0 ? this.getEmptyState() : this.getAnalyticsContent(metrics, taskStats, failurePatterns, summary)}

  <script>
    const vscode = acquireVsCodeApi();
    
    function refresh() {
      vscode.postMessage({ command: 'refresh' });
    }
    
    function exportData() {
      vscode.postMessage({ command: 'export' });
    }
    
    function clearData() {
      if (confirm('Are you sure you want to clear all analytics data? This cannot be undone.')) {
        vscode.postMessage({ command: 'clearData' });
      }
    }
  </script>
</body>
</html>`;
  }

  /**
   * Get empty state HTML
   */
  private getEmptyState(): string {
    return `
      <div class="empty-state">
        <div class="empty-state-icon">📈</div>
        <h2>No Analytics Data Yet</h2>
        <p>Start using the automation extension to see your usage insights and metrics here.</p>
      </div>
    `;
  }

  /**
   * Get analytics content HTML
   */
  private getAnalyticsContent(
    metrics: any,
    taskStats: any,
    failurePatterns: any[],
    summary: any
  ): string {
    const successRate = metrics.successRate.toFixed(1);
    const avgDuration = this.formatDuration(metrics.averageTaskDuration);
    const totalTasks = metrics.totalTasks;
    const totalAutomations = metrics.totalAutomations;

    return `
      <div class="metrics-grid">
        <div class="metric-card">
          <div class="metric-label">Total Automations</div>
          <div class="metric-value">${totalAutomations}</div>
          <div class="metric-unit">sessions</div>
        </div>
        
        <div class="metric-card">
          <div class="metric-label">Total Tasks</div>
          <div class="metric-value">${totalTasks}</div>
          <div class="metric-unit">executed</div>
        </div>
        
        <div class="metric-card">
          <div class="metric-label">Success Rate</div>
          <div class="metric-value">${successRate}%</div>
          <div class="progress-bar">
            <div class="progress-fill ${this.getSuccessClass(metrics.successRate)}" 
                 style="width: ${successRate}%"></div>
          </div>
        </div>
        
        <div class="metric-card">
          <div class="metric-label">Avg Task Duration</div>
          <div class="metric-value">${avgDuration.value}</div>
          <div class="metric-unit">${avgDuration.unit}</div>
        </div>
      </div>

      <div class="section">
        <div class="section-title">Task Execution Statistics</div>
        <div class="chart-container">
          <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 20px;">
            <div>
              <div class="metric-label">Successful</div>
              <div class="metric-value" style="font-size: 24px; color: #4caf50;">
                ${taskStats.successfulExecutions}
              </div>
            </div>
            <div>
              <div class="metric-label">Failed</div>
              <div class="metric-value" style="font-size: 24px; color: #f44336;">
                ${taskStats.failedExecutions}
              </div>
            </div>
            <div>
              <div class="metric-label">Skipped</div>
              <div class="metric-value" style="font-size: 24px; color: #ff9800;">
                ${taskStats.skippedExecutions}
              </div>
            </div>
            <div>
              <div class="metric-label">Median Duration</div>
              <div class="metric-value" style="font-size: 24px;">
                ${this.formatDuration(taskStats.medianDuration).value}
              </div>
              <div class="metric-unit">${this.formatDuration(taskStats.medianDuration).unit}</div>
            </div>
          </div>
        </div>
      </div>

      ${failurePatterns.length > 0 ? this.getFailurePatternsHtml(failurePatterns) : ''}

      ${metrics.performanceMetrics.length > 0 ? this.getPerformanceMetricsHtml(metrics.performanceMetrics) : ''}
    `;
  }

  /**
   * Get failure patterns HTML
   */
  private getFailurePatternsHtml(patterns: any[]): string {
    const topPatterns = patterns.slice(0, 10);
    
    return `
      <div class="section">
        <div class="section-title">Common Failure Patterns</div>
        <ul class="failure-list">
          ${topPatterns.map(pattern => `
            <li class="failure-item">
              <div>
                <div class="failure-pattern">${this.escapeHtml(pattern.pattern)}</div>
                <div class="metric-unit">${pattern.percentage.toFixed(1)}% of failures</div>
              </div>
              <div class="failure-count">
                <span class="trend-badge trend-${pattern.trend}">${pattern.trend}</span>
                <span style="font-weight: 600;">${pattern.occurrences}</span>
              </div>
            </li>
          `).join('')}
        </ul>
      </div>
    `;
  }

  /**
   * Get performance metrics HTML
   */
  private getPerformanceMetricsHtml(metrics: any[]): string {
    return `
      <div class="section">
        <div class="section-title">Performance Metrics</div>
        <div class="chart-container">
          <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px;">
            ${metrics.map(metric => `
              <div>
                <div class="metric-label">${this.escapeHtml(metric.metric)}</div>
                <div class="metric-value" style="font-size: 24px;">
                  ${metric.average.toFixed(2)}
                </div>
                <div class="metric-unit">${this.escapeHtml(metric.unit)}</div>
              </div>
            `).join('')}
          </div>
        </div>
      </div>
    `;
  }

  /**
   * Format duration for display
   */
  private formatDuration(ms: number): { value: string; unit: string } {
    if (ms < 1000) {
      return { value: ms.toFixed(0), unit: 'ms' };
    } else if (ms < 60000) {
      return { value: (ms / 1000).toFixed(1), unit: 'sec' };
    } else if (ms < 3600000) {
      return { value: (ms / 60000).toFixed(1), unit: 'min' };
    } else {
      return { value: (ms / 3600000).toFixed(1), unit: 'hr' };
    }
  }

  /**
   * Get success rate class
   */
  private getSuccessClass(rate: number): string {
    if (rate >= 80) return 'success';
    if (rate >= 50) return 'warning';
    return 'error';
  }

  /**
   * Escape HTML
   */
  private escapeHtml(text: string): string {
    const map: Record<string, string> = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#039;'
    };
    return text.replace(/[&<>"']/g, m => map[m]);
  }

  /**
   * Export analytics data
   */
  private async exportData(): Promise<void> {
    try {
      const data = await this.telemetryService.exportData();
      const uri = await vscode.window.showSaveDialog({
        defaultUri: vscode.Uri.file('kiro-analytics.json'),
        filters: {
          'JSON': ['json']
        }
      });

      if (uri) {
        await vscode.workspace.fs.writeFile(uri, Buffer.from(data, 'utf8'));
        vscode.window.showInformationMessage('Analytics data exported successfully');
      }
    } catch (error) {
      vscode.window.showErrorMessage(`Failed to export data: ${error}`);
    }
  }

  /**
   * Clear analytics data
   */
  private async clearData(): Promise<void> {
    try {
      await this.telemetryService.optOut();
      await this.telemetryService.optIn();
      await this.updateContent();
      vscode.window.showInformationMessage('Analytics data cleared');
    } catch (error) {
      vscode.window.showErrorMessage(`Failed to clear data: ${error}`);
    }
  }

  /**
   * Start auto-refresh
   */
  private startAutoRefresh(): void {
    this.refreshInterval = setInterval(() => {
      this.updateContent();
    }, 30000); // Refresh every 30 seconds
  }

  /**
   * Stop auto-refresh
   */
  private stopAutoRefresh(): void {
    if (this.refreshInterval) {
      clearInterval(this.refreshInterval);
      this.refreshInterval = undefined;
    }
  }

  /**
   * Dispose of the dashboard
   */
  dispose(): void {
    this.stopAutoRefresh();
    if (this.panel) {
      this.panel.dispose();
    }
  }
}
