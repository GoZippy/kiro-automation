import * as vscode from 'vscode';
import { Task, TaskStatus } from '../models/Task';

/**
 * Manages the status bar item for automation status display
 */
export class StatusBarManager {
  private statusBarItem: vscode.StatusBarItem;
  private currentTask: Task | null = null;
  private totalTasks: number = 0;
  private completedTasks: number = 0;
  private isRunning: boolean = false;

  constructor() {
    this.statusBarItem = vscode.window.createStatusBarItem(
      vscode.StatusBarAlignment.Left,
      100
    );
    this.statusBarItem.command = 'kiro-automation.showPanel';
    this.updateDisplay();
    this.statusBarItem.show();
  }

  /**
   * Update status bar when automation starts
   */
  public onAutomationStart(totalTasks: number): void {
    this.isRunning = true;
    this.totalTasks = totalTasks;
    this.completedTasks = 0;
    this.updateDisplay();
  }

  /**
   * Update status bar when automation stops
   */
  public onAutomationStop(): void {
    this.isRunning = false;
    this.currentTask = null;
    this.updateDisplay();
  }

  /**
   * Update status bar with current task information
   */
  public updateTask(task: Task, completed: number, total: number): void {
    this.currentTask = task;
    this.completedTasks = completed;
    this.totalTasks = total;
    this.updateDisplay();
  }

  /**
   * Update status bar display
   */
  private updateDisplay(): void {
    if (!this.isRunning) {
      this.statusBarItem.text = '$(play) Kiro Automation';
      this.statusBarItem.tooltip = 'Click to open automation panel';
      this.statusBarItem.backgroundColor = undefined;
      return;
    }

    if (this.currentTask) {
      const progress = this.totalTasks > 0 
        ? Math.round((this.completedTasks / this.totalTasks) * 100) 
        : 0;
      
      this.statusBarItem.text = `$(sync~spin) Kiro: ${this.currentTask.title} (${progress}%)`;
      this.statusBarItem.tooltip = this.buildTooltip();
      this.statusBarItem.backgroundColor = new vscode.ThemeColor('statusBarItem.warningBackground');
    } else {
      this.statusBarItem.text = '$(sync~spin) Kiro: Starting...';
      this.statusBarItem.tooltip = 'Automation is starting';
      this.statusBarItem.backgroundColor = new vscode.ThemeColor('statusBarItem.warningBackground');
    }
  }

  /**
   * Build detailed tooltip for status bar
   */
  private buildTooltip(): string {
    if (!this.currentTask) {
      return 'No task running';
    }

    const lines = [
      `Current Task: ${this.currentTask.title}`,
      `Progress: ${this.completedTasks}/${this.totalTasks} tasks completed`,
      `Status: ${this.currentTask.status}`,
      '',
      'Click to open automation panel'
    ];

    return lines.join('\n');
  }

  /**
   * Show progress indicator in status bar
   */
  public showProgress(message: string): void {
    this.statusBarItem.text = `$(sync~spin) ${message}`;
  }

  /**
   * Show error state in status bar
   */
  public showError(message: string): void {
    this.statusBarItem.text = `$(error) ${message}`;
    this.statusBarItem.backgroundColor = new vscode.ThemeColor('statusBarItem.errorBackground');
  }

  /**
   * Dispose of the status bar item
   */
  public dispose(): void {
    this.statusBarItem.dispose();
  }
}
