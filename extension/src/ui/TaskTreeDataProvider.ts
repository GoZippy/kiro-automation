import * as vscode from 'vscode';
import * as path from 'path';
import { Task, SubTask, TaskStatus } from '../models/Task';

/**
 * Tree item representing a spec or task in the tree view
 */
export class TaskTreeItem extends vscode.TreeItem {
  constructor(
    public readonly label: string,
    public readonly collapsibleState: vscode.TreeItemCollapsibleState,
    public readonly task?: Task | SubTask,
    public readonly isSpec: boolean = false,
    public readonly specName?: string
  ) {
    super(label, collapsibleState);

    if (task) {
      this.tooltip = this.buildTooltip();
      this.iconPath = this.getIconForStatus(task.status);
      this.contextValue = task.hasOwnProperty('subtasks') ? 'task' : 'subtask';
      this.command = {
        command: 'kiro-automation.selectTask',
        title: 'Select Task',
        arguments: [task]
      };
    } else if (isSpec) {
      this.contextValue = 'spec';
      this.iconPath = new vscode.ThemeIcon('folder');
    }
  }

  /**
   * Build tooltip for the tree item
   */
  private buildTooltip(): string {
    if (!this.task) {
      return '';
    }

    const lines = [
      `Status: ${this.task.status}`,
      `ID: ${this.task.id}`
    ];

    if ('requirements' in this.task && this.task.requirements.length > 0) {
      lines.push(`Requirements: ${this.task.requirements.join(', ')}`);
    }

    if ('description' in this.task && this.task.description.length > 0) {
      lines.push('', 'Description:', ...this.task.description);
    }

    return lines.join('\n');
  }

  /**
   * Get icon based on task status
   */
  private getIconForStatus(status: TaskStatus): vscode.ThemeIcon {
    switch (status) {
      case 'completed':
        return new vscode.ThemeIcon('check', new vscode.ThemeColor('testing.iconPassed'));
      case 'in_progress':
        return new vscode.ThemeIcon('sync~spin', new vscode.ThemeColor('testing.iconQueued'));
      case 'failed':
        return new vscode.ThemeIcon('error', new vscode.ThemeColor('testing.iconFailed'));
      case 'skipped':
        return new vscode.ThemeIcon('debug-step-over', new vscode.ThemeColor('testing.iconSkipped'));
      case 'pending':
      default:
        return new vscode.ThemeIcon('circle-outline');
    }
  }
}

/**
 * Data provider for the task tree view
 */
export class TaskTreeDataProvider implements vscode.TreeDataProvider<TaskTreeItem> {
  private _onDidChangeTreeData: vscode.EventEmitter<TaskTreeItem | undefined | null | void> = 
    new vscode.EventEmitter<TaskTreeItem | undefined | null | void>();
  readonly onDidChangeTreeData: vscode.Event<TaskTreeItem | undefined | null | void> = 
    this._onDidChangeTreeData.event;

  private tasksBySpec: Map<string, Task[]> = new Map();

  constructor() {}

  /**
   * Update tasks for a specific spec
   */
  public updateTasks(specName: string, tasks: Task[]): void {
    this.tasksBySpec.set(specName, tasks);
    this.refresh();
  }

  /**
   * Set all tasks grouped by spec
   */
  public setTasks(tasksBySpec: Map<string, Task[]>): void {
    this.tasksBySpec = tasksBySpec;
    this.refresh();
  }

  /**
   * Refresh the tree view
   */
  public refresh(): void {
    this._onDidChangeTreeData.fire();
  }

  /**
   * Get tree item for an element
   */
  getTreeItem(element: TaskTreeItem): vscode.TreeItem {
    return element;
  }

  /**
   * Get children for a tree item
   */
  getChildren(element?: TaskTreeItem): Thenable<TaskTreeItem[]> {
    if (!element) {
      // Root level - return specs
      return Promise.resolve(this.getSpecItems());
    }

    if (element.isSpec && element.specName) {
      // Spec level - return tasks
      const tasks = this.tasksBySpec.get(element.specName) || [];
      return Promise.resolve(this.getTaskItems(tasks));
    }

    if (element.task && 'subtasks' in element.task) {
      // Task level - return subtasks
      const task = element.task as Task;
      return Promise.resolve(this.getSubTaskItems(task.subtasks));
    }

    return Promise.resolve([]);
  }

  /**
   * Get spec items for root level
   */
  private getSpecItems(): TaskTreeItem[] {
    const items: TaskTreeItem[] = [];

    for (const [specName, tasks] of this.tasksBySpec.entries()) {
      const completedCount = tasks.filter(t => t.status === 'completed').length;
      const totalCount = tasks.length;
      const label = `${specName} (${completedCount}/${totalCount})`;

      items.push(
        new TaskTreeItem(
          label,
          vscode.TreeItemCollapsibleState.Expanded,
          undefined,
          true,
          specName
        )
      );
    }

    return items;
  }

  /**
   * Get task items for a spec
   */
  private getTaskItems(tasks: Task[]): TaskTreeItem[] {
    return tasks.map(task => {
      const hasSubtasks = task.subtasks && task.subtasks.length > 0;
      const collapsibleState = hasSubtasks 
        ? vscode.TreeItemCollapsibleState.Collapsed 
        : vscode.TreeItemCollapsibleState.None;

      let label = task.title;
      if (hasSubtasks) {
        const completedSubtasks = task.subtasks.filter(st => st.status === 'completed').length;
        label = `${task.title} (${completedSubtasks}/${task.subtasks.length})`;
      }

      return new TaskTreeItem(label, collapsibleState, task);
    });
  }

  /**
   * Get subtask items for a task
   */
  private getSubTaskItems(subtasks: SubTask[]): TaskTreeItem[] {
    return subtasks.map(subtask => {
      let label = subtask.title;
      if (subtask.optional) {
        label = `${label} (optional)`;
      }

      return new TaskTreeItem(
        label,
        vscode.TreeItemCollapsibleState.None,
        subtask
      );
    });
  }

  /**
   * Get parent of a tree item
   */
  getParent(element: TaskTreeItem): vscode.ProviderResult<TaskTreeItem> {
    // Not implemented for now
    return null;
  }
}
