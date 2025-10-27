import { Task, TaskStatus, SubTask } from './models';

/**
 * Change detection result
 */
export interface ChangeDetectionResult {
  /** Whether any changes were detected */
  hasChanges: boolean;

  /** Tasks that were added */
  addedTasks: Task[];

  /** Tasks that were removed */
  removedTasks: Task[];

  /** Tasks whose status changed */
  statusChanges: TaskStatusChange[];

  /** Tasks whose content changed (title, description, etc.) */
  contentChanges: Task[];
}

/**
 * Task status change information
 */
export interface TaskStatusChange {
  /** Task ID */
  taskId: string;

  /** Subtask ID (if applicable) */
  subtaskId?: string;

  /** Old status */
  oldStatus: TaskStatus;

  /** New status */
  newStatus: TaskStatus;

  /** Full task object */
  task: Task;
}

/**
 * ChangeDetector class
 * Handles file content diffing and task status change detection
 */
export class ChangeDetector {
  /**
   * Compares two sets of tasks and detects changes
   * @param oldTasks Previous task list
   * @param newTasks New task list
   * @returns Change detection result
   */
  detectChanges(oldTasks: Task[], newTasks: Task[]): ChangeDetectionResult {
    const result: ChangeDetectionResult = {
      hasChanges: false,
      addedTasks: [],
      removedTasks: [],
      statusChanges: [],
      contentChanges: [],
    };

    // Create maps for easier lookup
    const oldTaskMap = new Map<string, Task>();
    const newTaskMap = new Map<string, Task>();

    oldTasks.forEach((task) => oldTaskMap.set(task.id, task));
    newTasks.forEach((task) => newTaskMap.set(task.id, task));

    // Detect added tasks
    for (const [taskId, task] of newTaskMap) {
      if (!oldTaskMap.has(taskId)) {
        result.addedTasks.push(task);
        result.hasChanges = true;
      }
    }

    // Detect removed tasks
    for (const [taskId, task] of oldTaskMap) {
      if (!newTaskMap.has(taskId)) {
        result.removedTasks.push(task);
        result.hasChanges = true;
      }
    }

    // Detect status changes and content changes
    for (const [taskId, newTask] of newTaskMap) {
      const oldTask = oldTaskMap.get(taskId);
      if (oldTask) {
        // Check for status changes
        const statusChanges = this.detectTaskStatusChanges(oldTask, newTask);
        if (statusChanges.length > 0) {
          result.statusChanges.push(...statusChanges);
          result.hasChanges = true;
        }

        // Check for content changes
        if (this.hasContentChanged(oldTask, newTask)) {
          result.contentChanges.push(newTask);
          result.hasChanges = true;
        }
      }
    }

    return result;
  }

  /**
   * Detects status changes in a task and its subtasks
   * @param oldTask Old task
   * @param newTask New task
   * @returns Array of status changes
   */
  private detectTaskStatusChanges(oldTask: Task, newTask: Task): TaskStatusChange[] {
    const changes: TaskStatusChange[] = [];

    // Check main task status
    if (oldTask.status !== newTask.status) {
      changes.push({
        taskId: newTask.id,
        oldStatus: oldTask.status,
        newStatus: newTask.status,
        task: newTask,
      });
    }

    // Check subtask statuses
    const oldSubtaskMap = new Map<string, SubTask>();
    const newSubtaskMap = new Map<string, SubTask>();

    oldTask.subtasks.forEach((st) => oldSubtaskMap.set(st.id, st));
    newTask.subtasks.forEach((st) => newSubtaskMap.set(st.id, st));

    for (const [subtaskId, newSubtask] of newSubtaskMap) {
      const oldSubtask = oldSubtaskMap.get(subtaskId);
      if (oldSubtask && oldSubtask.status !== newSubtask.status) {
        changes.push({
          taskId: newTask.id,
          subtaskId: subtaskId,
          oldStatus: oldSubtask.status,
          newStatus: newSubtask.status,
          task: newTask,
        });
      }
    }

    return changes;
  }

  /**
   * Checks if task content has changed (excluding status)
   * @param oldTask Old task
   * @param newTask New task
   * @returns True if content changed
   */
  private hasContentChanged(oldTask: Task, newTask: Task): boolean {
    // Check title
    if (oldTask.title !== newTask.title) {
      return true;
    }

    // Check requirements
    if (!this.arraysEqual(oldTask.requirements, newTask.requirements)) {
      return true;
    }

    // Check dependencies
    if (!this.arraysEqual(oldTask.dependencies || [], newTask.dependencies || [])) {
      return true;
    }

    // Check subtasks (excluding status)
    if (oldTask.subtasks.length !== newTask.subtasks.length) {
      return true;
    }

    for (let i = 0; i < oldTask.subtasks.length; i++) {
      const oldSubtask = oldTask.subtasks[i];
      const newSubtask = newTask.subtasks[i];

      if (
        oldSubtask.id !== newSubtask.id ||
        oldSubtask.title !== newSubtask.title ||
        oldSubtask.optional !== newSubtask.optional ||
        !this.arraysEqual(oldSubtask.description, newSubtask.description)
      ) {
        return true;
      }
    }

    return false;
  }

  /**
   * Compares two arrays for equality
   * @param arr1 First array
   * @param arr2 Second array
   * @returns True if arrays are equal
   */
  private arraysEqual(arr1: string[], arr2: string[]): boolean {
    if (arr1.length !== arr2.length) {
      return false;
    }

    for (let i = 0; i < arr1.length; i++) {
      if (arr1[i] !== arr2[i]) {
        return false;
      }
    }

    return true;
  }

  /**
   * Compares file content and detects changes
   * @param oldContent Old file content
   * @param newContent New file content
   * @returns Diff information
   */
  detectFileContentChanges(
    oldContent: string,
    newContent: string
  ): { hasChanges: boolean; addedLines: number; removedLines: number; modifiedLines: number } {
    const oldLines = oldContent.split('\n');
    const newLines = newContent.split('\n');

    let addedLines = 0;
    let removedLines = 0;
    let modifiedLines = 0;

    // Simple line-by-line comparison
    const maxLength = Math.max(oldLines.length, newLines.length);

    for (let i = 0; i < maxLength; i++) {
      const oldLine = oldLines[i];
      const newLine = newLines[i];

      if (oldLine === undefined && newLine !== undefined) {
        addedLines++;
      } else if (oldLine !== undefined && newLine === undefined) {
        removedLines++;
      } else if (oldLine !== newLine) {
        modifiedLines++;
      }
    }

    return {
      hasChanges: addedLines > 0 || removedLines > 0 || modifiedLines > 0,
      addedLines,
      removedLines,
      modifiedLines,
    };
  }

  /**
   * Detects task status changes in markdown content
   * @param oldContent Old markdown content
   * @param newContent New markdown content
   * @returns Array of detected status changes
   */
  detectMarkdownStatusChanges(
    oldContent: string,
    newContent: string
  ): Array<{ lineNumber: number; taskId: string; oldStatus: string; newStatus: string }> {
    const changes: Array<{
      lineNumber: number;
      taskId: string;
      oldStatus: string;
      newStatus: string;
    }> = [];

    const oldLines = oldContent.split('\n');
    const newLines = newContent.split('\n');

    const maxLength = Math.max(oldLines.length, newLines.length);

    for (let i = 0; i < maxLength; i++) {
      const oldLine = oldLines[i] || '';
      const newLine = newLines[i] || '';

      // Check for task status changes
      const oldTaskMatch = oldLine.match(/^-\s*\[([ ~x])\]\s*(\d+)\.\s+(.+)$/);
      const newTaskMatch = newLine.match(/^-\s*\[([ ~x])\]\s*(\d+)\.\s+(.+)$/);

      if (oldTaskMatch && newTaskMatch && oldTaskMatch[2] === newTaskMatch[2]) {
        const oldStatus = oldTaskMatch[1];
        const newStatus = newTaskMatch[1];
        const taskId = oldTaskMatch[2];

        if (oldStatus !== newStatus) {
          changes.push({
            lineNumber: i + 1,
            taskId,
            oldStatus,
            newStatus,
          });
        }
      }

      // Check for subtask status changes
      const oldSubtaskMatch = oldLine.match(/^  -\s*\[([ ~x])\](\*)?\s*(\d+\.\d+)\s+(.+)$/);
      const newSubtaskMatch = newLine.match(/^  -\s*\[([ ~x])\](\*)?\s*(\d+\.\d+)\s+(.+)$/);

      if (oldSubtaskMatch && newSubtaskMatch && oldSubtaskMatch[3] === newSubtaskMatch[3]) {
        const oldStatus = oldSubtaskMatch[1];
        const newStatus = newSubtaskMatch[1];
        const subtaskId = oldSubtaskMatch[3];

        if (oldStatus !== newStatus) {
          changes.push({
            lineNumber: i + 1,
            taskId: subtaskId,
            oldStatus,
            newStatus,
          });
        }
      }
    }

    return changes;
  }
}
