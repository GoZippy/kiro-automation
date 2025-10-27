import { Task } from './Task';

/**
 * SpecificationContext interface
 * Contains the context information for a specification
 */
export interface SpecificationContext {
  /** Name of the specification */
  name: string;

  /** Content of the requirements.md file */
  requirements: string;

  /** Content of the design.md file */
  design: string;

  /** Path to the tasks.md file */
  tasksFile: string;

  /** Base directory path for the spec */
  basePath: string;
}

/**
 * WorkspaceContext interface
 * Contains information about the current workspace
 */
export interface WorkspaceContext {
  /** Workspace root path */
  rootPath: string;

  /** Workspace name */
  name: string;

  /** Workspace folders (for multi-root workspaces) */
  folders: string[];

  /** Whether the workspace is trusted */
  isTrusted: boolean;
}

/**
 * AutomationSession interface
 * Tracks the state of an automation session
 */
export interface AutomationSession {
  /** Unique identifier for the session */
  id: string;

  /** Start time of the session */
  startTime: Date;

  /** End time of the session (if completed) */
  endTime?: Date;

  /** Current task being executed */
  currentTask?: Task;

  /** List of completed tasks in this session */
  completedTasks: Task[];

  /** List of failed tasks in this session */
  failedTasks: Task[];

  /** List of skipped tasks in this session */
  skippedTasks: Task[];

  /** Configuration used for this session */
  configuration: Record<string, any>;

  /** Session status */
  status: 'running' | 'paused' | 'completed' | 'failed' | 'stopped';

  /** Total number of tasks in the session */
  totalTasks: number;

  /** Error information if session failed */
  error?: {
    message: string;
    task?: Task;
    timestamp: Date;
  };
}

/**
 * ExecutionContext interface
 * Contains all context information needed for task execution
 */
export interface ExecutionContext {
  /** The task being executed */
  task: Task;

  /** Specification context */
  spec: SpecificationContext;

  /** Workspace context */
  workspace: WorkspaceContext;

  /** Current automation session */
  session: AutomationSession;

  /** Additional metadata */
  metadata?: Record<string, any>;
}

/**
 * ExecutionContext class implementation
 * Provides utility methods for working with execution context
 */
export class ExecutionContextModel implements ExecutionContext {
  task: Task;
  spec: SpecificationContext;
  workspace: WorkspaceContext;
  session: AutomationSession;
  metadata?: Record<string, any>;

  constructor(data: ExecutionContext) {
    this.task = data.task;
    this.spec = data.spec;
    this.workspace = data.workspace;
    this.session = data.session;
    this.metadata = data.metadata;

    this.validate();
  }

  /**
   * Validates the execution context
   * @throws Error if validation fails
   */
  validate(): void {
    if (!this.task) {
      throw new Error('Task is required in execution context');
    }

    if (!this.spec || !this.spec.name) {
      throw new Error('Valid specification context is required');
    }

    if (!this.workspace || !this.workspace.rootPath) {
      throw new Error('Valid workspace context is required');
    }

    if (!this.session || !this.session.id) {
      throw new Error('Valid automation session is required');
    }
  }

  /**
   * Gets the full context as a formatted string for prompts
   */
  getContextString(): string {
    return `
Specification: ${this.spec.name}
Task: ${this.task.id} - ${this.task.title}
Workspace: ${this.workspace.name}
Session: ${this.session.id}
    `.trim();
  }

  /**
   * Checks if the workspace is trusted
   */
  isWorkspaceTrusted(): boolean {
    return this.workspace.isTrusted;
  }

  /**
   * Gets the session duration in milliseconds
   */
  getSessionDuration(): number {
    const endTime = this.session.endTime || new Date();
    return endTime.getTime() - this.session.startTime.getTime();
  }

  /**
   * Gets the session progress percentage
   */
  getSessionProgress(): number {
    if (this.session.totalTasks === 0) {
      return 0;
    }
    return Math.round((this.session.completedTasks.length / this.session.totalTasks) * 100);
  }

  /**
   * Converts to a plain object
   */
  toJSON(): ExecutionContext {
    return {
      task: this.task,
      spec: this.spec,
      workspace: this.workspace,
      session: this.session,
      metadata: this.metadata,
    };
  }
}

/**
 * Factory function to create a new automation session
 */
export function createAutomationSession(
  totalTasks: number,
  configuration: Record<string, any>
): AutomationSession {
  return {
    id: generateSessionId(),
    startTime: new Date(),
    completedTasks: [],
    failedTasks: [],
    skippedTasks: [],
    configuration,
    status: 'running',
    totalTasks,
  };
}

/**
 * Generates a unique session ID
 */
function generateSessionId(): string {
  return `session-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}
