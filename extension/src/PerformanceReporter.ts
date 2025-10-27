import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { PerformanceMonitor, PerformanceStatistics, PerformanceAlert, TaskExecutionMetric } from './PerformanceMonitor';
import { ResourceManager } from './ResourceManager';
import { AutomationSession } from './models/ExecutionContext';

/**
 * Report format types
 */
export enum ReportFormat {
  JSON = 'json',
  HTML = 'html',
  MARKDOWN = 'markdown',
  TEXT = 'text',
}

/**
 * Performance report
 */
export interface PerformanceReport {
  sessionId: string;
  generatedAt: Date;
  duration: number;
  statistics: PerformanceStatistics;
  alerts: PerformanceAlert[];
  taskMetrics: TaskExecutionMetric[];
  resourceStats: Record<string, number>;
  cacheStats: any;
  optimizationSuggestions: string[];
  summary: string;
}

/**
 * Optimization suggestion
 */
export interface OptimizationSuggestion {
  category: 'memory' | 'cpu' | 'cache' | 'resources' | 'tasks';
  priority: 'low' | 'medium' | 'high';
  title: string;
  description: string;
  impact: string;
  action: string;
}

/**
 * PerformanceReporter class
 * Generates performance reports per session
 * Provides optimization suggestions
 * Displays metrics in UI
 */
export class PerformanceReporter {
  private performanceMonitor: PerformanceMonitor;
  private resourceManager?: ResourceManager;
  private outputChannel: vscode.OutputChannel;
  private reportHistory: PerformanceReport[] = [];
  private readonly MAX_REPORT_HISTORY = 50;

  constructor(
    performanceMonitor: PerformanceMonitor,
    resourceManager?: ResourceManager
  ) {
    this.performanceMonitor = performanceMonitor;
    this.resourceManager = resourceManager;
    this.outputChannel = vscode.window.createOutputChannel('Kiro Automation Performance');
  }

  /**
   * Generates a performance report for a session
   */
  generateReport(session: AutomationSession): PerformanceReport {
    const statistics = this.performanceMonitor.getStatistics();
    const alerts = this.performanceMonitor.getAlerts();
    const taskMetrics = this.performanceMonitor.getTaskMetrics();
    
    const resourceStats = this.resourceManager?.getResourceStats() || {};
    const cacheStats = this.resourceManager?.getCacheStats() || {};

    const optimizationSuggestions = this.generateOptimizationSuggestions(
      statistics,
      alerts,
      resourceStats,
      cacheStats
    );

    const summary = this.generateSummary(session, statistics, alerts);

    const report: PerformanceReport = {
      sessionId: session.id,
      generatedAt: new Date(),
      duration: session.endTime 
        ? session.endTime.getTime() - session.startTime.getTime()
        : Date.now() - session.startTime.getTime(),
      statistics,
      alerts,
      taskMetrics,
      resourceStats,
      cacheStats,
      optimizationSuggestions: optimizationSuggestions.map(s => s.title),
      summary,
    };

    // Add to history
    this.reportHistory.push(report);
    if (this.reportHistory.length > this.MAX_REPORT_HISTORY) {
      this.reportHistory.shift();
    }

    return report;
  }

  /**
   * Generates optimization suggestions
   */
  generateOptimizationSuggestions(
    statistics: PerformanceStatistics,
    alerts: PerformanceAlert[],
    resourceStats: Record<string, number>,
    cacheStats: any
  ): OptimizationSuggestion[] {
    const suggestions: OptimizationSuggestion[] = [];

    // Memory optimization suggestions
    if (statistics.peakMemoryUsage > 80) {
      suggestions.push({
        category: 'memory',
        priority: 'high',
        title: 'High memory usage detected',
        description: `Peak memory usage reached ${statistics.peakMemoryUsage.toFixed(2)} MB`,
        impact: 'May cause performance degradation or crashes',
        action: 'Consider clearing cache, reducing concurrent operations, or increasing memory limits',
      });
    }

    if (statistics.suspectedMemoryLeaks > 0) {
      suggestions.push({
        category: 'memory',
        priority: 'high',
        title: 'Potential memory leaks detected',
        description: `${statistics.suspectedMemoryLeaks} suspected memory leak(s) found`,
        impact: 'Memory usage will grow over time, eventually causing crashes',
        action: 'Review resource cleanup, ensure all event listeners are removed, and check for circular references',
      });
    }

    // CPU optimization suggestions
    if (statistics.averageCPUUsage > 60) {
      suggestions.push({
        category: 'cpu',
        priority: 'medium',
        title: 'High CPU usage detected',
        description: `Average CPU usage was ${statistics.averageCPUUsage.toFixed(2)}%`,
        impact: 'May slow down other applications and VS Code responsiveness',
        action: 'Consider reducing polling frequency, optimizing algorithms, or adding delays between operations',
      });
    }

    // Cache optimization suggestions
    if (cacheStats.sizeMB > 40) {
      suggestions.push({
        category: 'cache',
        priority: 'medium',
        title: 'Cache size is large',
        description: `Cache is using ${cacheStats.sizeMB.toFixed(2)} MB`,
        impact: 'Large cache increases memory pressure',
        action: 'Consider reducing cache TTL or implementing more aggressive eviction policies',
      });
    }

    if (cacheStats.hitRate < 0.5 && cacheStats.entries > 10) {
      suggestions.push({
        category: 'cache',
        priority: 'low',
        title: 'Low cache hit rate',
        description: `Cache hit rate is ${(cacheStats.hitRate * 100).toFixed(1)}%`,
        impact: 'Cache is not being utilized effectively',
        action: 'Review caching strategy and consider caching more frequently accessed data',
      });
    }

    // Resource optimization suggestions
    const totalResources = Object.values(resourceStats).reduce((sum: number, count) => sum + (count as number), 0);
    
    if (totalResources > 100) {
      suggestions.push({
        category: 'resources',
        priority: 'medium',
        title: 'Many resources are active',
        description: `${totalResources} resources are currently tracked`,
        impact: 'High resource count can lead to memory leaks and performance issues',
        action: 'Review and cleanup unused resources, consolidate file watchers, and remove stale event listeners',
      });
    }

    // Task optimization suggestions
    if (statistics.averageTaskDuration > 60000) {
      suggestions.push({
        category: 'tasks',
        priority: 'medium',
        title: 'Tasks are taking a long time',
        description: `Average task duration is ${(statistics.averageTaskDuration / 1000).toFixed(2)} seconds`,
        impact: 'Long task durations slow down overall automation',
        action: 'Consider breaking down complex tasks, optimizing task logic, or increasing timeout values',
      });
    }

    if (statistics.maxTaskDuration > 300000) {
      suggestions.push({
        category: 'tasks',
        priority: 'high',
        title: 'Some tasks are extremely slow',
        description: `Longest task took ${(statistics.maxTaskDuration / 1000 / 60).toFixed(2)} minutes`,
        impact: 'Very long tasks can cause timeouts and block automation',
        action: 'Investigate the slowest tasks and optimize their implementation',
      });
    }

    // Alert-based suggestions
    const criticalAlerts = alerts.filter(a => a.severity === 'critical');
    if (criticalAlerts.length > 0) {
      suggestions.push({
        category: 'memory',
        priority: 'high',
        title: 'Critical performance alerts detected',
        description: `${criticalAlerts.length} critical alert(s) were triggered`,
        impact: 'Critical issues may cause automation failures',
        action: 'Review alerts and address critical issues immediately',
      });
    }

    // Sort by priority
    const priorityOrder = { high: 0, medium: 1, low: 2 };
    suggestions.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);

    return suggestions;
  }

  /**
   * Generates a summary of the session
   */
  private generateSummary(
    session: AutomationSession,
    statistics: PerformanceStatistics,
    alerts: PerformanceAlert[]
  ): string {
    const duration = session.endTime
      ? session.endTime.getTime() - session.startTime.getTime()
      : Date.now() - session.startTime.getTime();

    const durationMin = (duration / 1000 / 60).toFixed(2);
    const avgTaskDuration = (statistics.averageTaskDuration / 1000).toFixed(2);
    const peakMemory = statistics.peakMemoryUsage.toFixed(2);
    const avgCPU = statistics.averageCPUUsage.toFixed(2);

    const criticalAlerts = alerts.filter(a => a.severity === 'critical').length;
    const warningAlerts = alerts.filter(a => a.severity === 'warning').length;

    let summary = `Session ${session.id} completed in ${durationMin} minutes. `;
    summary += `Processed ${statistics.totalTasks} task(s) with an average duration of ${avgTaskDuration}s. `;
    summary += `Peak memory usage: ${peakMemory} MB, Average CPU: ${avgCPU}%. `;

    if (criticalAlerts > 0 || warningAlerts > 0) {
      summary += `Performance alerts: ${criticalAlerts} critical, ${warningAlerts} warning(s). `;
    }

    if (statistics.suspectedMemoryLeaks > 0) {
      summary += `⚠️ ${statistics.suspectedMemoryLeaks} potential memory leak(s) detected. `;
    }

    return summary;
  }

  /**
   * Formats a report in the specified format
   */
  formatReport(report: PerformanceReport, format: ReportFormat): string {
    switch (format) {
      case ReportFormat.JSON:
        return this.formatAsJSON(report);
      case ReportFormat.HTML:
        return this.formatAsHTML(report);
      case ReportFormat.MARKDOWN:
        return this.formatAsMarkdown(report);
      case ReportFormat.TEXT:
        return this.formatAsText(report);
      default:
        return this.formatAsText(report);
    }
  }

  /**
   * Formats report as JSON
   */
  private formatAsJSON(report: PerformanceReport): string {
    return JSON.stringify(report, null, 2);
  }

  /**
   * Formats report as HTML
   */
  private formatAsHTML(report: PerformanceReport): string {
    const suggestions = this.generateOptimizationSuggestions(
      report.statistics,
      report.alerts,
      report.resourceStats,
      report.cacheStats
    );

    return `
<!DOCTYPE html>
<html>
<head>
  <title>Performance Report - ${report.sessionId}</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 20px; background: #f5f5f5; }
    .container { max-width: 1200px; margin: 0 auto; background: white; padding: 20px; border-radius: 8px; }
    h1 { color: #333; border-bottom: 2px solid #007acc; padding-bottom: 10px; }
    h2 { color: #555; margin-top: 30px; }
    .summary { background: #e8f4f8; padding: 15px; border-radius: 5px; margin: 20px 0; }
    .stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px; margin: 20px 0; }
    .stat-card { background: #f9f9f9; padding: 15px; border-radius: 5px; border-left: 4px solid #007acc; }
    .stat-label { font-size: 12px; color: #666; text-transform: uppercase; }
    .stat-value { font-size: 24px; font-weight: bold; color: #333; margin-top: 5px; }
    .alert { padding: 10px; margin: 10px 0; border-radius: 5px; }
    .alert-warning { background: #fff3cd; border-left: 4px solid #ffc107; }
    .alert-critical { background: #f8d7da; border-left: 4px solid #dc3545; }
    .suggestion { background: #f9f9f9; padding: 15px; margin: 10px 0; border-radius: 5px; border-left: 4px solid #28a745; }
    .suggestion.high { border-left-color: #dc3545; }
    .suggestion.medium { border-left-color: #ffc107; }
    .suggestion.low { border-left-color: #28a745; }
    .priority { display: inline-block; padding: 2px 8px; border-radius: 3px; font-size: 11px; font-weight: bold; }
    .priority.high { background: #dc3545; color: white; }
    .priority.medium { background: #ffc107; color: black; }
    .priority.low { background: #28a745; color: white; }
    table { width: 100%; border-collapse: collapse; margin: 20px 0; }
    th, td { padding: 10px; text-align: left; border-bottom: 1px solid #ddd; }
    th { background: #f5f5f5; font-weight: bold; }
  </style>
</head>
<body>
  <div class="container">
    <h1>Performance Report</h1>
    <p><strong>Session ID:</strong> ${report.sessionId}</p>
    <p><strong>Generated:</strong> ${report.generatedAt.toLocaleString()}</p>
    <p><strong>Duration:</strong> ${(report.duration / 1000 / 60).toFixed(2)} minutes</p>

    <div class="summary">
      <h3>Summary</h3>
      <p>${report.summary}</p>
    </div>

    <h2>Statistics</h2>
    <div class="stats">
      <div class="stat-card">
        <div class="stat-label">Total Tasks</div>
        <div class="stat-value">${report.statistics.totalTasks}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Avg Task Duration</div>
        <div class="stat-value">${(report.statistics.averageTaskDuration / 1000).toFixed(2)}s</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Peak Memory</div>
        <div class="stat-value">${report.statistics.peakMemoryUsage.toFixed(2)} MB</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Avg CPU</div>
        <div class="stat-value">${report.statistics.averageCPUUsage.toFixed(2)}%</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Memory Leaks</div>
        <div class="stat-value">${report.statistics.suspectedMemoryLeaks}</div>
      </div>
    </div>

    ${report.alerts.length > 0 ? `
    <h2>Alerts (${report.alerts.length})</h2>
    ${report.alerts.map(alert => `
      <div class="alert alert-${alert.severity}">
        <strong>${alert.type.toUpperCase()}</strong> - ${alert.message}
        <br><small>${alert.timestamp.toLocaleString()}</small>
      </div>
    `).join('')}
    ` : ''}

    <h2>Optimization Suggestions</h2>
    ${suggestions.map(suggestion => `
      <div class="suggestion ${suggestion.priority}">
        <div>
          <span class="priority ${suggestion.priority}">${suggestion.priority.toUpperCase()}</span>
          <strong>${suggestion.title}</strong>
        </div>
        <p>${suggestion.description}</p>
        <p><strong>Impact:</strong> ${suggestion.impact}</p>
        <p><strong>Action:</strong> ${suggestion.action}</p>
      </div>
    `).join('')}

    <h2>Task Metrics</h2>
    <table>
      <thead>
        <tr>
          <th>Task</th>
          <th>Duration</th>
          <th>Memory Delta</th>
          <th>Status</th>
        </tr>
      </thead>
      <tbody>
        ${report.taskMetrics.map(metric => `
          <tr>
            <td>${metric.taskTitle}</td>
            <td>${metric.duration ? (metric.duration / 1000).toFixed(2) + 's' : 'N/A'}</td>
            <td>${metric.memoryDelta ? (metric.memoryDelta / 1024 / 1024).toFixed(2) + ' MB' : 'N/A'}</td>
            <td>${metric.success ? '✓ Success' : '✗ Failed'}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  </div>
</body>
</html>
    `.trim();
  }

  /**
   * Formats report as Markdown
   */
  private formatAsMarkdown(report: PerformanceReport): string {
    const suggestions = this.generateOptimizationSuggestions(
      report.statistics,
      report.alerts,
      report.resourceStats,
      report.cacheStats
    );

    let md = `# Performance Report\n\n`;
    md += `**Session ID:** ${report.sessionId}\n`;
    md += `**Generated:** ${report.generatedAt.toLocaleString()}\n`;
    md += `**Duration:** ${(report.duration / 1000 / 60).toFixed(2)} minutes\n\n`;

    md += `## Summary\n\n${report.summary}\n\n`;

    md += `## Statistics\n\n`;
    md += `- **Total Tasks:** ${report.statistics.totalTasks}\n`;
    md += `- **Average Task Duration:** ${(report.statistics.averageTaskDuration / 1000).toFixed(2)}s\n`;
    md += `- **Min Task Duration:** ${(report.statistics.minTaskDuration / 1000).toFixed(2)}s\n`;
    md += `- **Max Task Duration:** ${(report.statistics.maxTaskDuration / 1000).toFixed(2)}s\n`;
    md += `- **Peak Memory Usage:** ${report.statistics.peakMemoryUsage.toFixed(2)} MB\n`;
    md += `- **Average Memory Usage:** ${report.statistics.averageMemoryUsage.toFixed(2)} MB\n`;
    md += `- **Peak CPU Usage:** ${report.statistics.peakCPUUsage.toFixed(2)}%\n`;
    md += `- **Average CPU Usage:** ${report.statistics.averageCPUUsage.toFixed(2)}%\n`;
    md += `- **Suspected Memory Leaks:** ${report.statistics.suspectedMemoryLeaks}\n\n`;

    if (report.alerts.length > 0) {
      md += `## Alerts (${report.alerts.length})\n\n`;
      report.alerts.forEach(alert => {
        md += `### ${alert.severity.toUpperCase()}: ${alert.type}\n`;
        md += `${alert.message}\n`;
        md += `*${alert.timestamp.toLocaleString()}*\n\n`;
      });
    }

    md += `## Optimization Suggestions\n\n`;
    suggestions.forEach(suggestion => {
      md += `### ${suggestion.priority.toUpperCase()}: ${suggestion.title}\n`;
      md += `**Description:** ${suggestion.description}\n`;
      md += `**Impact:** ${suggestion.impact}\n`;
      md += `**Action:** ${suggestion.action}\n\n`;
    });

    md += `## Task Metrics\n\n`;
    md += `| Task | Duration | Memory Delta | Status |\n`;
    md += `|------|----------|--------------|--------|\n`;
    report.taskMetrics.forEach(metric => {
      const duration = metric.duration ? `${(metric.duration / 1000).toFixed(2)}s` : 'N/A';
      const memoryDelta = metric.memoryDelta ? `${(metric.memoryDelta / 1024 / 1024).toFixed(2)} MB` : 'N/A';
      const status = metric.success ? '✓ Success' : '✗ Failed';
      md += `| ${metric.taskTitle} | ${duration} | ${memoryDelta} | ${status} |\n`;
    });

    return md;
  }

  /**
   * Formats report as plain text
   */
  private formatAsText(report: PerformanceReport): string {
    const suggestions = this.generateOptimizationSuggestions(
      report.statistics,
      report.alerts,
      report.resourceStats,
      report.cacheStats
    );

    let text = `PERFORMANCE REPORT\n`;
    text += `${'='.repeat(80)}\n\n`;
    text += `Session ID: ${report.sessionId}\n`;
    text += `Generated: ${report.generatedAt.toLocaleString()}\n`;
    text += `Duration: ${(report.duration / 1000 / 60).toFixed(2)} minutes\n\n`;

    text += `SUMMARY\n`;
    text += `${'-'.repeat(80)}\n`;
    text += `${report.summary}\n\n`;

    text += `STATISTICS\n`;
    text += `${'-'.repeat(80)}\n`;
    text += `Total Tasks: ${report.statistics.totalTasks}\n`;
    text += `Average Task Duration: ${(report.statistics.averageTaskDuration / 1000).toFixed(2)}s\n`;
    text += `Min Task Duration: ${(report.statistics.minTaskDuration / 1000).toFixed(2)}s\n`;
    text += `Max Task Duration: ${(report.statistics.maxTaskDuration / 1000).toFixed(2)}s\n`;
    text += `Peak Memory Usage: ${report.statistics.peakMemoryUsage.toFixed(2)} MB\n`;
    text += `Average Memory Usage: ${report.statistics.averageMemoryUsage.toFixed(2)} MB\n`;
    text += `Peak CPU Usage: ${report.statistics.peakCPUUsage.toFixed(2)}%\n`;
    text += `Average CPU Usage: ${report.statistics.averageCPUUsage.toFixed(2)}%\n`;
    text += `Suspected Memory Leaks: ${report.statistics.suspectedMemoryLeaks}\n\n`;

    if (report.alerts.length > 0) {
      text += `ALERTS (${report.alerts.length})\n`;
      text += `${'-'.repeat(80)}\n`;
      report.alerts.forEach(alert => {
        text += `[${alert.severity.toUpperCase()}] ${alert.type}: ${alert.message}\n`;
        text += `  ${alert.timestamp.toLocaleString()}\n\n`;
      });
    }

    text += `OPTIMIZATION SUGGESTIONS\n`;
    text += `${'-'.repeat(80)}\n`;
    suggestions.forEach((suggestion, index) => {
      text += `${index + 1}. [${suggestion.priority.toUpperCase()}] ${suggestion.title}\n`;
      text += `   Description: ${suggestion.description}\n`;
      text += `   Impact: ${suggestion.impact}\n`;
      text += `   Action: ${suggestion.action}\n\n`;
    });

    return text;
  }

  /**
   * Displays report in output channel
   */
  displayInOutputChannel(report: PerformanceReport): void {
    this.outputChannel.clear();
    this.outputChannel.appendLine(this.formatReport(report, ReportFormat.TEXT));
    this.outputChannel.show();
  }

  /**
   * Saves report to file
   */
  async saveReport(report: PerformanceReport, format: ReportFormat, filePath?: string): Promise<string> {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    
    if (!workspaceFolders || workspaceFolders.length === 0) {
      throw new Error('No workspace folder open');
    }

    const reportsDir = path.join(workspaceFolders[0].uri.fsPath, '.kiro', 'reports');
    
    // Create reports directory if it doesn't exist
    if (!fs.existsSync(reportsDir)) {
      fs.mkdirSync(reportsDir, { recursive: true });
    }

    const extension = format === ReportFormat.JSON ? 'json' 
      : format === ReportFormat.HTML ? 'html'
      : format === ReportFormat.MARKDOWN ? 'md'
      : 'txt';

    const fileName = filePath || path.join(
      reportsDir,
      `performance-${report.sessionId}-${Date.now()}.${extension}`
    );

    const content = this.formatReport(report, format);
    fs.writeFileSync(fileName, content, 'utf8');

    return fileName;
  }

  /**
   * Shows report in webview
   */
  async showReportInWebview(report: PerformanceReport): Promise<void> {
    const panel = vscode.window.createWebviewPanel(
      'performanceReport',
      `Performance Report - ${report.sessionId}`,
      vscode.ViewColumn.One,
      {
        enableScripts: true,
      }
    );

    panel.webview.html = this.formatReport(report, ReportFormat.HTML);
  }

  /**
   * Gets report history
   */
  getReportHistory(): PerformanceReport[] {
    return [...this.reportHistory];
  }

  /**
   * Clears report history
   */
  clearReportHistory(): void {
    this.reportHistory = [];
  }

  /**
   * Disposes of resources
   */
  dispose(): void {
    this.outputChannel.dispose();
  }
}
