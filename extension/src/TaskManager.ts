import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { Task, TaskStatus, SubTask } from './models';
import { ChangeDetector, ChangeDetectionResult } from './ChangeDetector';
import { PerformanceOptimizer } from './PerformanceOptimizer';

/**
 * TaskManager class
 * Handles task discovery, parsing, and management
 */
export class TaskManager {
  private tasks: Map<string, Task> = new Map();
  private watchers: vscode.FileSystemWatcher[] = [];
  private workspaceRoot: string;
  private debounceTimers: Map<string, NodeJS.Timeout> = new Map();
  private readonly DEBOUNCE_DELAY = 500; // milliseconds
  private onTasksChangedCallback?: (changes: ChangeDetectionResult) => void;
  private changeDetector: ChangeDetector;
  private fileContentCache: Map<string, string> = new Map();
  private performanceOptimizer: PerformanceOptimizer;

  constructor(workspaceRoot: string) {
    this.workspaceRoot = workspaceRoot;
    this.changeDetector = new ChangeDetector();
    this.performanceOptimizer = new PerformanceOptimizer();
  }

  /**
   * Discovers all task files in the workspace
   * Scans .kiro/specs/STAR/tasks.md files recursively (STAR = wildcard)
   * @returns Array of discovered task file paths
   */
  async discoverTaskFiles(): Promise<string[]> {
    const taskFiles: string[] = [];
    const specsPath = path.join(this.workspaceRoot, '.kiro', 'specs');

    // Check if .kiro/specs directory exists
    if (!fs.existsSync(specsPath)) {
      console.log('No .kiro/specs directory found');
      return taskFiles;
    }

    try {
      // Read all spec directories
      const specDirs = await this.readDirectory(specsPath);

      for (const specDir of specDirs) {
        const specPath = path.join(specsPath, specDir);
        const stats = await this.getFileStats(specPath);

        if (stats?.isDirectory()) {
          const tasksFilePath = path.join(specPath, 'tasks.md');

          // Check if tasks.md exists
          if (await this.fileExists(tasksFilePath)) {
            taskFiles.push(tasksFilePath);
          }
        }
      }
    } catch (error) {
      console.error('Error discovering task files:', error);
      throw new Error(`Failed to discover task files: ${error}`);
    }

    return taskFiles;
  }

  /**
   * Discovers all tasks from task files
   * @returns Array of discovered tasks
   */
  async discoverTasks(): Promise<Task[]> {
    const taskFiles = await this.discoverTaskFiles();
    const allTasks: Task[] = [];

    for (const taskFile of taskFiles) {
      try {
        const tasks = await this.parseTaskFile(taskFile);
        allTasks.push(...tasks);

        // Store tasks in the map
        tasks.forEach((task) => {
          this.tasks.set(task.id, task);
        });
      } catch (error) {
        console.error(`Error parsing task file ${taskFile}:`, error);
      }
    }

    return allTasks;
  }

  /**
   * Validates a file path
   * @param filePath Path to validate
   * @returns True if path is valid
   */
  validateFilePath(filePath: string): boolean {
    try {
      // Check if path is absolute
      if (!path.isAbsolute(filePath)) {
        return false;
      }

      // Check if path is within workspace
      const relativePath = path.relative(this.workspaceRoot, filePath);
      if (relativePath.startsWith('..') || path.isAbsolute(relativePath)) {
        return false;
      }

      // Check if path follows expected pattern
      const expectedPattern = /\.kiro[/\\]specs[/\\][^/\\]+[/\\]tasks\.md$/;
      if (!expectedPattern.test(filePath)) {
        return false;
      }

      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Parses a task file and extracts tasks
   * @param filePath Path to the tasks.md file
   * @returns Array of parsed tasks
   */
  private async parseTaskFile(filePath: string): Promise<Task[]> {
    // Validate file path
    if (!this.validateFilePath(filePath)) {
      throw new Error(`Invalid task file path: ${filePath}`);
    }

    const content = await this.readFileContent(filePath);
    const specName = this.extractSpecName(filePath);

    return this.parseMarkdown(content, filePath, specName);
  }

  /**
   * Extracts spec name from file path
   * @param filePath Path to the tasks.md file
   * @returns Spec name
   */
  private extractSpecName(filePath: string): string {
    const parts = filePath.split(path.sep);
    const specsIndex = parts.indexOf('specs');

    if (specsIndex >= 0 && specsIndex < parts.length - 1) {
      return parts[specsIndex + 1];
    }

    return 'unknown';
  }

  /**
   * Parses markdown content and extracts tasks
   * @param content Markdown content
   * @param filePath File path
   * @param specName Spec name
   * @returns Array of parsed tasks
   */
  private parseMarkdown(content: string, filePath: string, specName: string): Task[] {
    const tasks: Task[] = [];
    const lines = content.split('\n');
    let currentTask: Partial<Task> | null = null;
    let currentSubtask: Partial<SubTask> | null = null;
    let lineNumber = 0;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      lineNumber = i + 1;

      // Parse top-level task
      const taskMatch = line.match(/^-\s*\[([ ~x])\]\s*(\d+)\.\s+(.+)$/);
      if (taskMatch) {
        // Save previous task if exists
        if (currentTask && currentTask.id) {
          tasks.push(this.createTask(currentTask, filePath, specName));
        }

        const status = this.parseTaskStatus(taskMatch[1]);
        const id = taskMatch[2];
        const title = taskMatch[3].trim();

        currentTask = {
          id,
          title,
          status,
          subtasks: [],
          requirements: [],
          lineNumber,
        };
        currentSubtask = null;
        continue;
      }

      // Parse subtask
      const subtaskMatch = line.match(/^  -\s*\[([ ~x])\](\*)?\s*(\d+\.\d+)\s+(.+)$/);
      if (subtaskMatch && currentTask) {
        // Save previous subtask if exists
        if (currentSubtask && currentSubtask.id) {
          currentTask.subtasks!.push(this.createSubtask(currentSubtask));
        }

        const status = this.parseTaskStatus(subtaskMatch[1]);
        const optional = subtaskMatch[2] === '*';
        const id = subtaskMatch[3];
        const title = subtaskMatch[4].trim();

        currentSubtask = {
          id,
          title,
          status,
          optional,
          description: [],
        };
        continue;
      }

      // Parse description lines
      const descMatch = line.match(/^    (.+)$/);
      if (descMatch) {
        const descLine = descMatch[1].trim();

        // Check if it's a requirements line
        if (descLine.startsWith('_Requirements:')) {
          const reqMatch = descLine.match(/_Requirements:\s*(.+)_/);
          if (reqMatch && currentTask) {
            const reqs = reqMatch[1].split(',').map((r) => r.trim());
            currentTask.requirements = reqs;
          }
        } else if (currentSubtask) {
          // Add to subtask description
          currentSubtask.description!.push(descLine);
        }
      }
    }

    // Save last task
    if (currentTask && currentTask.id) {
      if (currentSubtask && currentSubtask.id) {
        currentTask.subtasks!.push(this.createSubtask(currentSubtask));
      }
      tasks.push(this.createTask(currentTask, filePath, specName));
    }

    return tasks;
  }

  /**
   * Parses task status from markdown indicator
   * @param indicator Status indicator character
   * @returns TaskStatus
   */
  private parseTaskStatus(indicator: string): TaskStatus {
    switch (indicator) {
      case 'x':
        return TaskStatus.COMPLETED;
      case '~':
        return TaskStatus.IN_PROGRESS;
      case ' ':
      default:
        return TaskStatus.PENDING;
    }
  }

  /**
   * Creates a Task object from partial data
   * @param partial Partial task data
   * @param filePath File path
   * @param specName Spec name
   * @returns Complete Task object
   */
  private createTask(partial: Partial<Task>, filePath: string, specName: string): Task {
    return {
      id: partial.id || '',
      title: partial.title || '',
      status: partial.status || TaskStatus.PENDING,
      subtasks: partial.subtasks || [],
      requirements: partial.requirements || [],
      specName,
      filePath,
      lineNumber: partial.lineNumber || 0,
    };
  }

  /**
   * Creates a SubTask object from partial data
   * @param partial Partial subtask data
   * @returns Complete SubTask object
   */
  private createSubtask(partial: Partial<SubTask>): SubTask {
    return {
      id: partial.id || '',
      title: partial.title || '',
      status: partial.status || TaskStatus.PENDING,
      optional: partial.optional || false,
      description: partial.description || [],
    };
  }

  /**
   * Reads directory contents
   * @param dirPath Directory path
   * @returns Array of file/directory names
   */
  private async readDirectory(dirPath: string): Promise<string[]> {
    return new Promise((resolve, reject) => {
      fs.readdir(dirPath, (err, files) => {
        if (err) {
          reject(err);
        } else {
          resolve(files);
        }
      });
    });
  }

  /**
   * Gets file stats
   * @param filePath File path
   * @returns File stats or null if error
   */
  private async getFileStats(filePath: string): Promise<fs.Stats | null> {
    return new Promise((resolve) => {
      fs.stat(filePath, (err, stats) => {
        if (err) {
          resolve(null);
        } else {
          resolve(stats);
        }
      });
    });
  }

  /**
   * Checks if file exists
   * @param filePath File path
   * @returns True if file exists
   */
  private async fileExists(filePath: string): Promise<boolean> {
    return new Promise((resolve) => {
      fs.access(filePath, fs.constants.F_OK, (err) => {
        resolve(!err);
      });
    });
  }

  /**
   * Reads file content
   * @param filePath File path
   * @returns File content as string
   */
  private async readFileContent(filePath: string): Promise<string> {
    return new Promise((resolve, reject) => {
      fs.readFile(filePath, 'utf8', (err, data) => {
        if (err) {
          reject(err);
        } else {
          resolve(data);
        }
      });
    });
  }

  /**
   * Gets all discovered tasks
   * @returns Array of all tasks
   */
  getTasks(): Task[] {
    return Array.from(this.tasks.values());
  }

  /**
   * Gets a task by ID
   * @param taskId Task ID
   * @returns Task or undefined
   */
  getTask(taskId: string): Task | undefined {
    // Try cache first
    const cached = this.performanceOptimizer.getCachedTask(taskId);
    if (cached) {
      return cached;
    }

    // Get from map and cache
    const task = this.tasks.get(taskId);
    if (task) {
      this.performanceOptimizer.cacheTask(task);
    }
    return task;
  }

  /**
   * Updates task status in memory
   * @param taskId Task ID
   * @param status New status
   * @returns True if update was successful
   */
  updateTaskStatus(taskId: string, status: TaskStatus): boolean {
    const task = this.tasks.get(taskId);
    if (!task) {
      return false;
    }

    task.status = status;
    this.tasks.set(taskId, task);
    this.emitTaskStatusChange(task);
    return true;
  }

  /**
   * Updates subtask status in memory
   * @param taskId Parent task ID
   * @param subtaskId Subtask ID
   * @param status New status
   * @returns True if update was successful
   */
  updateSubtaskStatus(taskId: string, subtaskId: string, status: TaskStatus): boolean {
    const task = this.tasks.get(taskId);
    if (!task) {
      return false;
    }

    const subtask = task.subtasks.find((st) => st.id === subtaskId);
    if (!subtask) {
      return false;
    }

    subtask.status = status;
    this.tasks.set(taskId, task);
    this.emitTaskStatusChange(task);
    return true;
  }

  /**
   * Updates task status in markdown file
   * @param taskId Task ID
   * @param status New status
   * @returns Promise that resolves when file is updated
   */
  async updateTaskStatusInFile(taskId: string, status: TaskStatus): Promise<void> {
    const task = this.tasks.get(taskId);
    if (!task) {
      throw new Error(`Task ${taskId} not found`);
    }

    await this.updateStatusInMarkdown(task.filePath, task.lineNumber, status, false);
  }

  /**
   * Updates subtask status in markdown file
   * @param taskId Parent task ID
   * @param subtaskId Subtask ID
   * @param status New status
   * @returns Promise that resolves when file is updated
   */
  async updateSubtaskStatusInFile(taskId: string, subtaskId: string, status: TaskStatus): Promise<void> {
    const task = this.tasks.get(taskId);
    if (!task) {
      throw new Error(`Task ${taskId} not found`);
    }

    const subtask = task.subtasks.find((st) => st.id === subtaskId);
    if (!subtask) {
      throw new Error(`Subtask ${subtaskId} not found in task ${taskId}`);
    }

    // Find subtask line number by reading the file
    const content = await this.readFileContent(task.filePath);
    const lines = content.split('\n');
    let subtaskLineNumber = -1;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const subtaskMatch = line.match(/^  -\s*\[([ ~x])\](\*)?\s*(\d+\.\d+)\s+(.+)$/);
      if (subtaskMatch && subtaskMatch[3] === subtaskId) {
        subtaskLineNumber = i + 1;
        break;
      }
    }

    if (subtaskLineNumber === -1) {
      throw new Error(`Subtask ${subtaskId} not found in file`);
    }

    await this.updateStatusInMarkdown(task.filePath, subtaskLineNumber, status, true);
  }

  /**
   * Updates status indicator in markdown file (atomic operation)
   * @param filePath File path
   * @param lineNumber Line number (1-indexed)
   * @param status New status
   * @param isSubtask Whether this is a subtask
   */
  private async updateStatusInMarkdown(filePath: string, lineNumber: number, status: TaskStatus, isSubtask: boolean): Promise<void> {
    try {
      // Read file content
      const content = await this.readFileContent(filePath);
      const lines = content.split('\n');

      // Validate line number
      if (lineNumber < 1 || lineNumber > lines.length) {
        throw new Error(`Invalid line number: ${lineNumber}`);
      }

      // Get the line to update (convert to 0-indexed)
      const lineIndex = lineNumber - 1;
      const line = lines[lineIndex];

      // Determine the status indicator
      const statusIndicator = this.getStatusIndicator(status);

      // Update the line based on whether it's a task or subtask
      let updatedLine: string;
      if (isSubtask) {
        updatedLine = line.replace(/^(  -\s*)\[([ ~x])\]/, `$1[${statusIndicator}]`);
      } else {
        updatedLine = line.replace(/^(-\s*)\[([ ~x])\]/, `$1[${statusIndicator}]`);
      }

      // Update the line
      lines[lineIndex] = updatedLine;

      // Write back to file atomically
      const updatedContent = lines.join('\n');
      await this.writeFileContent(filePath, updatedContent);
    } catch (error) {
      throw new Error(`Failed to update status in file: ${error}`);
    }
  }

  /**
   * Gets status indicator character for markdown
   * @param status Task status
   * @returns Status indicator character
   */
  private getStatusIndicator(status: TaskStatus): string {
    switch (status) {
      case TaskStatus.COMPLETED:
        return 'x';
      case TaskStatus.IN_PROGRESS:
        return '~';
      case TaskStatus.PENDING:
      case TaskStatus.FAILED:
      case TaskStatus.SKIPPED:
      default:
        return ' ';
    }
  }

  /**
   * Writes content to file
   * @param filePath File path
   * @param content Content to write
   */
  private async writeFileContent(filePath: string, content: string): Promise<void> {
    return new Promise((resolve, reject) => {
      fs.writeFile(filePath, content, 'utf8', (err) => {
        if (err) {
          reject(err);
        } else {
          resolve();
        }
      });
    });
  }

  /**
   * Gets tasks ordered by ID sequence
   * @returns Array of tasks in execution order
   */
  getTasksInOrder(): Task[] {
    const tasks = Array.from(this.tasks.values());

    // Sort by spec name first, then by task ID
    return tasks.sort((a, b) => {
      // Compare spec names
      if (a.specName !== b.specName) {
        return a.specName.localeCompare(b.specName);
      }

      // Compare task IDs numerically
      const aId = parseFloat(a.id);
      const bId = parseFloat(b.id);
      return aId - bId;
    });
  }

  /**
   * Gets the next incomplete task
   * @returns Next task to execute or null if none
   */
  getNextIncompleteTask(): Task | null {
    const orderedTasks = this.getTasksInOrder();

    for (const task of orderedTasks) {
      if (task.status === TaskStatus.PENDING || task.status === TaskStatus.FAILED) {
        // Check if dependencies are satisfied
        if (this.areDependenciesSatisfied(task)) {
          return task;
        }
      }
    }

    return null;
  }

  /**
   * Gets incomplete tasks
   * @returns Array of incomplete tasks
   */
  getIncompleteTasks(): Task[] {
    return this.getTasksInOrder().filter(
      (task) =>
        task.status === TaskStatus.PENDING ||
        task.status === TaskStatus.IN_PROGRESS ||
        task.status === TaskStatus.FAILED
    );
  }

  /**
   * Builds dependency graph for tasks
   * @returns Map of task ID to dependent task IDs
   */
  buildDependencyGraph(): Map<string, string[]> {
    const graph = new Map<string, string[]>();

    for (const task of this.tasks.values()) {
      if (task.dependencies && task.dependencies.length > 0) {
        graph.set(task.id, task.dependencies);
      } else {
        graph.set(task.id, []);
      }
    }

    return graph;
  }

  /**
   * Checks if task dependencies are satisfied
   * @param task Task to check
   * @returns True if all dependencies are satisfied
   */
  areDependenciesSatisfied(task: Task): boolean {
    if (!task.dependencies || task.dependencies.length === 0) {
      return true;
    }

    for (const depId of task.dependencies) {
      const depTask = this.tasks.get(depId);
      if (!depTask || depTask.status !== TaskStatus.COMPLETED) {
        return false;
      }
    }

    return true;
  }

  /**
   * Detects circular dependencies in task graph
   * @returns Array of task IDs involved in circular dependencies
   */
  detectCircularDependencies(): string[] {
    const graph = this.buildDependencyGraph();
    const visited = new Set<string>();
    const recursionStack = new Set<string>();
    const circularTasks: string[] = [];

    const hasCycle = (taskId: string): boolean => {
      visited.add(taskId);
      recursionStack.add(taskId);

      const dependencies = graph.get(taskId) || [];
      for (const depId of dependencies) {
        if (!visited.has(depId)) {
          if (hasCycle(depId)) {
            circularTasks.push(taskId);
            return true;
          }
        } else if (recursionStack.has(depId)) {
          circularTasks.push(taskId);
          return true;
        }
      }

      recursionStack.delete(taskId);
      return false;
    };

    for (const taskId of graph.keys()) {
      if (!visited.has(taskId)) {
        hasCycle(taskId);
      }
    }

    return circularTasks;
  }

  /**
   * Gets tasks that depend on a given task
   * @param taskId Task ID
   * @returns Array of dependent tasks
   */
  getDependentTasks(taskId: string): Task[] {
    const dependents: Task[] = [];

    for (const task of this.tasks.values()) {
      if (task.dependencies && task.dependencies.includes(taskId)) {
        dependents.push(task);
      }
    }

    return dependents;
  }

  /**
   * Validates task dependencies
   * @returns Validation result with errors
   */
  validateDependencies(): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Check for circular dependencies
    const circularTasks = this.detectCircularDependencies();
    if (circularTasks.length > 0) {
      errors.push(`Circular dependencies detected in tasks: ${circularTasks.join(', ')}`);
    }

    // Check for missing dependencies
    for (const task of this.tasks.values()) {
      if (task.dependencies) {
        for (const depId of task.dependencies) {
          if (!this.tasks.has(depId)) {
            errors.push(`Task ${task.id} depends on non-existent task ${depId}`);
          }
        }
      }
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * Emits task status change event
   * @param task Task that changed
   */
  private emitTaskStatusChange(task: Task): void {
    // Event emitter will be implemented later
    // For now, just log
    console.log(`Task status changed: ${task.id} -> ${task.status}`);
  }

  /**
   * Sets up file watchers for tasks.md files
   * Watches for creation, modification, and deletion of task files
   */
  setupFileWatchers(): void {
    // Create a watcher for all tasks.md files in .kiro/specs
    const pattern = new vscode.RelativePattern(
      this.workspaceRoot,
      '.kiro/specs/**/tasks.md'
    );

    const watcher = vscode.workspace.createFileSystemWatcher(pattern);

    // Handle file creation
    watcher.onDidCreate((uri) => {
      this.handleFileChange(uri, 'created');
    });

    // Handle file modification
    watcher.onDidChange((uri) => {
      this.handleFileChange(uri, 'modified');
    });

    // Handle file deletion
    watcher.onDidDelete((uri) => {
      this.handleFileChange(uri, 'deleted');
    });

    this.watchers.push(watcher);
    console.log('File watchers set up for tasks.md files');
  }

  /**
   * Handles file system changes with debouncing
   * @param uri URI of the changed file
   * @param changeType Type of change (created, modified, deleted)
   */
  private handleFileChange(uri: vscode.Uri, changeType: string): void {
    const filePath = uri.fsPath;
    console.log(`File ${changeType}: ${filePath}`);

    // Clear existing debounce timer for this file
    const existingTimer = this.debounceTimers.get(filePath);
    if (existingTimer) {
      clearTimeout(existingTimer);
    }

    // Set up new debounce timer
    const timer = setTimeout(() => {
      this.processFileChange(filePath, changeType);
      this.debounceTimers.delete(filePath);
    }, this.DEBOUNCE_DELAY);

    this.debounceTimers.set(filePath, timer);
  }

  /**
   * Processes file change after debounce period
   * @param filePath Path to the changed file
   * @param changeType Type of change
   */
  private async processFileChange(filePath: string, changeType: string): Promise<void> {
    try {
      if (changeType === 'deleted') {
        // Remove tasks from this file
        this.removeTasksFromFile(filePath);
      } else {
        // Re-parse the file and update tasks
        await this.refreshTasksFromFile(filePath);
      }

      // Notify listeners of task list changes (with empty changes for deletion)
      if (this.onTasksChangedCallback) {
        const emptyChanges: ChangeDetectionResult = {
          hasChanges: true,
          addedTasks: [],
          removedTasks: [],
          statusChanges: [],
          contentChanges: [],
        };
        this.onTasksChangedCallback(emptyChanges);
      }
    } catch (error) {
      console.error(`Error processing file change for ${filePath}:`, error);
    }
  }

  /**
   * Removes all tasks from a specific file
   * @param filePath Path to the file
   */
  private removeTasksFromFile(filePath: string): void {
    const tasksToRemove: string[] = [];

    // Find all tasks from this file
    for (const [taskId, task] of this.tasks.entries()) {
      if (task.filePath === filePath) {
        tasksToRemove.push(taskId);
      }
    }

    // Remove the tasks
    tasksToRemove.forEach((taskId) => {
      this.tasks.delete(taskId);
      console.log(`Removed task ${taskId} from deleted file`);
    });
  }

  /**
   * Refreshes tasks from a specific file
   * @param filePath Path to the file
   */
  private async refreshTasksFromFile(filePath: string): Promise<void> {
    try {
      // Get old tasks from this file
      const oldTasks: Task[] = [];
      for (const task of this.tasks.values()) {
        if (task.filePath === filePath) {
          oldTasks.push(task);
        }
      }

      // Read new file content
      const newContent = await this.readFileContent(filePath);
      const oldContent = this.fileContentCache.get(filePath) || '';

      // Detect file content changes
      const fileChanges = this.changeDetector.detectFileContentChanges(oldContent, newContent);
      console.log(
        `File content changes: ${fileChanges.addedLines} added, ${fileChanges.removedLines} removed, ${fileChanges.modifiedLines} modified`
      );

      // Detect markdown status changes
      const statusChanges = this.changeDetector.detectMarkdownStatusChanges(oldContent, newContent);
      if (statusChanges.length > 0) {
        console.log(`Detected ${statusChanges.length} status changes in markdown`);
        statusChanges.forEach((change) => {
          console.log(
            `  Line ${change.lineNumber}: Task ${change.taskId} status changed from [${change.oldStatus}] to [${change.newStatus}]`
          );
        });
      }

      // Remove existing tasks from this file
      this.removeTasksFromFile(filePath);

      // Parse the file again
      const newTasks = await this.parseTaskFile(filePath);

      // Add the new tasks
      newTasks.forEach((task) => {
        this.tasks.set(task.id, task);
        console.log(`Refreshed task ${task.id} from file`);
      });

      // Detect changes between old and new tasks
      const changes = this.changeDetector.detectChanges(oldTasks, newTasks);

      // Log changes
      if (changes.hasChanges) {
        console.log('Task changes detected:');
        if (changes.addedTasks.length > 0) {
          console.log(`  Added tasks: ${changes.addedTasks.map((t) => t.id).join(', ')}`);
        }
        if (changes.removedTasks.length > 0) {
          console.log(`  Removed tasks: ${changes.removedTasks.map((t) => t.id).join(', ')}`);
        }
        if (changes.statusChanges.length > 0) {
          console.log(`  Status changes: ${changes.statusChanges.length}`);
          changes.statusChanges.forEach((change) => {
            const subtaskInfo = change.subtaskId ? ` (subtask ${change.subtaskId})` : '';
            console.log(
              `    Task ${change.taskId}${subtaskInfo}: ${change.oldStatus} -> ${change.newStatus}`
            );
          });
        }
        if (changes.contentChanges.length > 0) {
          console.log(`  Content changes: ${changes.contentChanges.map((t) => t.id).join(', ')}`);
        }
      }

      // Update file content cache
      this.fileContentCache.set(filePath, newContent);

      // Notify listeners with change details
      if (this.onTasksChangedCallback && changes.hasChanges) {
        this.onTasksChangedCallback(changes);
      }
    } catch (error) {
      console.error(`Error refreshing tasks from ${filePath}:`, error);
      throw error;
    }
  }

  /**
   * Registers a callback to be called when tasks change
   * @param callback Callback function that receives change details
   */
  onTasksChanged(callback: (changes: ChangeDetectionResult) => void): void {
    this.onTasksChangedCallback = callback;
  }

  /**
   * Compatibility shim: persist task status (used by tests)
   */
  async persistTaskStatus(taskId: string): Promise<void> {
    const task = this.tasks.get(taskId);
    if (!task) {
      throw new Error(`Task ${taskId} not found`);
    }
    await this.updateTaskStatusInFile(taskId, task.status);
  }

  /**
   * Compatibility shim: start watching files (alias)
   */
  async startWatching(): Promise<void> {
    this.setupFileWatchers();
    await this.cacheFileContents();
  }

  /**
   * Compatibility shim: stop watching files
   */
  async stopWatching(): Promise<void> {
    this.watchers.forEach(w => w.dispose());
    this.watchers = [];
  }

  /**
   * Compatibility shim: simple event subscription
   */
  on(event: string, callback: (...args: any[]) => void): void {
    // Only support 'tasksChanged' for now
    if (event === 'tasksChanged') {
      this.onTasksChanged(callback as any);
    }
  }

  /**
   * Caches file content for change detection
   * Should be called after initial task discovery
   */
  async cacheFileContents(): Promise<void> {
    const taskFiles = await this.discoverTaskFiles();

    for (const filePath of taskFiles) {
      try {
        const content = await this.readFileContent(filePath);
        this.fileContentCache.set(filePath, content);
      } catch (error) {
        console.error(`Error caching content for ${filePath}:`, error);
      }
    }
  }

  /**
   * Cleans up resources
   */
  dispose(): void {
    // Clear all debounce timers
    this.debounceTimers.forEach((timer) => clearTimeout(timer));
    this.debounceTimers.clear();

    // Dispose file watchers
    this.watchers.forEach((watcher) => watcher.dispose());
    this.watchers = [];

    // Clear tasks
    this.tasks.clear();

    // Clear file content cache
    this.fileContentCache.clear();

    // Dispose performance optimizer
    this.performanceOptimizer.dispose();

    // Clear callback
    this.onTasksChangedCallback = undefined;
  }
}
