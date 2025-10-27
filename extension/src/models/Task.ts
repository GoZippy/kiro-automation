/**
 * Task status enumeration
 * Represents the current state of a task in the automation workflow
 */
export enum TaskStatus {
  PENDING = 'pending',
  IN_PROGRESS = 'in_progress',
  COMPLETED = 'completed',
  FAILED = 'failed',
  SKIPPED = 'skipped',
}

/**
 * SubTask interface
 * Represents a subtask within a parent task
 */
export interface SubTask {
  /** Unique identifier for the subtask (e.g., "2.1", "3.2") */
  id: string;

  /** Title of the subtask */
  title: string;

  /** Detailed description lines for the subtask */
  description: string[];

  /** Current status of the subtask */
  status: TaskStatus;

  /** Whether this subtask is optional (marked with * in markdown) */
  optional: boolean;
}

/**
 * Task interface
 * Represents a task in the automation workflow
 */
export interface Task {
  /** Unique identifier for the task (e.g., "1", "2", "3") */
  id: string;

  /** Title of the task */
  title: string;

  /** Current status of the task */
  status: TaskStatus;

  /** List of subtasks belonging to this task */
  subtasks: SubTask[];

  /** Requirements referenced by this task */
  requirements: string[];

  /** Name of the spec this task belongs to */
  specName: string;

  /** File path to the tasks.md file */
  filePath: string;

  /** Line number where the task is defined in the file */
  lineNumber: number;

  /** Estimated duration in milliseconds (optional) */
  estimatedDuration?: number;

  /** Task IDs that this task depends on (optional) */
  dependencies?: string[];
}

/**
 * Task class with validation methods
 * Provides utility methods for task management and validation
 */
export class TaskModel implements Task {
  id: string;
  title: string;
  status: TaskStatus;
  subtasks: SubTask[];
  requirements: string[];
  specName: string;
  filePath: string;
  lineNumber: number;
  estimatedDuration?: number;
  dependencies?: string[];

  constructor(data: Task) {
    this.id = data.id;
    this.title = data.title;
    this.status = data.status;
    this.subtasks = data.subtasks;
    this.requirements = data.requirements;
    this.specName = data.specName;
    this.filePath = data.filePath;
    this.lineNumber = data.lineNumber;
    this.estimatedDuration = data.estimatedDuration;
    this.dependencies = data.dependencies;

    this.validate();
  }

  /**
   * Validates the task data
   * @throws Error if validation fails
   */
  validate(): void {
    if (!this.id || this.id.trim() === '') {
      throw new Error('Task ID cannot be empty');
    }

    if (!this.title || this.title.trim() === '') {
      throw new Error('Task title cannot be empty');
    }

    if (!Object.values(TaskStatus).includes(this.status)) {
      throw new Error(`Invalid task status: ${this.status}`);
    }

    if (!this.specName || this.specName.trim() === '') {
      throw new Error('Spec name cannot be empty');
    }

    if (!this.filePath || this.filePath.trim() === '') {
      throw new Error('File path cannot be empty');
    }

    if (this.lineNumber < 0) {
      throw new Error('Line number must be non-negative');
    }

    // Validate subtasks
    this.subtasks.forEach((subtask, index) => {
      if (!subtask.id || subtask.id.trim() === '') {
        throw new Error(`Subtask at index ${index} has empty ID`);
      }
      if (!subtask.title || subtask.title.trim() === '') {
        throw new Error(`Subtask ${subtask.id} has empty title`);
      }
      if (!Object.values(TaskStatus).includes(subtask.status)) {
        throw new Error(`Subtask ${subtask.id} has invalid status: ${subtask.status}`);
      }
    });
  }

  /**
   * Checks if the task is complete
   */
  isComplete(): boolean {
    return this.status === TaskStatus.COMPLETED;
  }

  /**
   * Checks if the task is in progress
   */
  isInProgress(): boolean {
    return this.status === TaskStatus.IN_PROGRESS;
  }

  /**
   * Checks if the task has failed
   */
  hasFailed(): boolean {
    return this.status === TaskStatus.FAILED;
  }

  /**
   * Checks if the task is pending
   */
  isPending(): boolean {
    return this.status === TaskStatus.PENDING;
  }

  /**
   * Checks if the task is skipped
   */
  isSkipped(): boolean {
    return this.status === TaskStatus.SKIPPED;
  }

  /**
   * Checks if all subtasks are complete
   */
  areAllSubtasksComplete(): boolean {
    return this.subtasks.every(
      (subtask) => subtask.status === TaskStatus.COMPLETED || subtask.optional
    );
  }

  /**
   * Gets the count of completed subtasks
   */
  getCompletedSubtasksCount(): number {
    return this.subtasks.filter((subtask) => subtask.status === TaskStatus.COMPLETED).length;
  }

  /**
   * Gets the progress percentage (0-100)
   */
  getProgressPercentage(): number {
    if (this.subtasks.length === 0) {
      return this.isComplete() ? 100 : 0;
    }
    return Math.round((this.getCompletedSubtasksCount() / this.subtasks.length) * 100);
  }

  /**
   * Updates the task status
   */
  updateStatus(newStatus: TaskStatus): void {
    this.status = newStatus;
  }

  /**
   * Updates a subtask status
   */
  updateSubtaskStatus(subtaskId: string, newStatus: TaskStatus): void {
    const subtask = this.subtasks.find((st) => st.id === subtaskId);
    if (subtask) {
      subtask.status = newStatus;
    } else {
      throw new Error(`Subtask with ID ${subtaskId} not found`);
    }
  }

  /**
   * Gets the next incomplete subtask
   */
  getNextIncompleteSubtask(): SubTask | null {
    return (
      this.subtasks.find(
        (subtask) =>
          subtask.status !== TaskStatus.COMPLETED && subtask.status !== TaskStatus.SKIPPED
      ) || null
    );
  }

  /**
   * Converts the task to a plain object
   */
  toJSON(): Task {
    return {
      id: this.id,
      title: this.title,
      status: this.status,
      subtasks: this.subtasks,
      requirements: this.requirements,
      specName: this.specName,
      filePath: this.filePath,
      lineNumber: this.lineNumber,
      estimatedDuration: this.estimatedDuration,
      dependencies: this.dependencies,
    };
  }
}
