import * as vscode from 'vscode';
import * as path from 'path';
import { AutomationSession } from './models/ExecutionContext';
import { Task } from './models/Task';

/**
 * Persisted session data
 */
export interface PersistedSession {
  /** Session data */
  session: AutomationSession;

  /** Execution queue (task IDs) */
  executionQueue: string[];

  /** Current task ID */
  currentTaskId?: string;

  /** Timestamp when persisted */
  persistedAt: Date;

  /** Version of the persistence format */
  version: string;
}

/**
 * Session recovery options
 */
export interface SessionRecoveryOptions {
  /** Whether to resume from the last task */
  resumeFromLast: boolean;

  /** Whether to reset failed tasks */
  resetFailedTasks: boolean;

  /** Whether to clear completed tasks */
  clearCompletedTasks: boolean;
}

/**
 * SessionPersistence class
 * Handles session state serialization and recovery
 */
export class SessionPersistence {
  private context: vscode.ExtensionContext;
  private storageKey = 'kiro-automation-session';
  private version = '1.0.0';

  constructor(context: vscode.ExtensionContext) {
    this.context = context;
  }

  /**
   * Persists a session to storage
   * @param session Session to persist
   * @param executionQueue Execution queue
   * @param currentTaskId Current task ID
   */
  async persistSession(
    session: AutomationSession,
    executionQueue: Task[],
    currentTaskId?: string
  ): Promise<void> {
    try {
      const persistedData: PersistedSession = {
        session: this.serializeSession(session),
        executionQueue: executionQueue.map((task) => task.id),
        currentTaskId,
        persistedAt: new Date(),
        version: this.version,
      };

      // Store in workspace state
      await this.context.workspaceState.update(this.storageKey, persistedData);

      // Also store in global state as backup
      await this.context.globalState.update(this.storageKey, persistedData);

      console.log(`Session ${session.id} persisted successfully`);
    } catch (error) {
      console.error('Failed to persist session:', error);
      throw new Error(`Session persistence failed: ${error}`);
    }
  }

  /**
   * Recovers a session from storage
   * @param options Recovery options
   * @returns Recovered session data or undefined
   */
  async recoverSession(options?: SessionRecoveryOptions): Promise<PersistedSession | undefined> {
    try {
      // Try workspace state first
      let persistedData = this.context.workspaceState.get<PersistedSession>(this.storageKey);

      // Fall back to global state
      if (!persistedData) {
        persistedData = this.context.globalState.get<PersistedSession>(this.storageKey);
      }

      if (!persistedData) {
        console.log('No persisted session found');
        return undefined;
      }

      // Validate version
      if (persistedData.version !== this.version) {
        console.warn(`Session version mismatch: ${persistedData.version} vs ${this.version}`);
        // Could implement migration logic here
      }

      // Deserialize session
      persistedData.session = this.deserializeSession(persistedData.session);

      // Apply recovery options
      if (options) {
        persistedData = this.applyRecoveryOptions(persistedData, options);
      }

      console.log(`Session ${persistedData.session.id} recovered successfully`);
      return persistedData;
    } catch (error) {
      console.error('Failed to recover session:', error);
      return undefined;
    }
  }

  /**
   * Checks if a persisted session exists
   * @returns True if session exists
   */
  async hasPersistedSession(): Promise<boolean> {
    const workspaceSession = this.context.workspaceState.get<PersistedSession>(this.storageKey);
    const globalSession = this.context.globalState.get<PersistedSession>(this.storageKey);

    return !!(workspaceSession || globalSession);
  }

  /**
   * Clears persisted session data
   */
  async clearPersistedSession(): Promise<void> {
    await this.context.workspaceState.update(this.storageKey, undefined);
    await this.context.globalState.update(this.storageKey, undefined);
    console.log('Persisted session cleared');
  }

  /**
   * Gets the last persisted session timestamp
   * @returns Timestamp or undefined
   */
  async getLastPersistedTimestamp(): Promise<Date | undefined> {
    const persistedData = this.context.workspaceState.get<PersistedSession>(this.storageKey);
    return persistedData?.persistedAt;
  }

  /**
   * Serializes a session for storage
   * @param session Session to serialize
   * @returns Serialized session
   */
  private serializeSession(session: AutomationSession): AutomationSession {
    // Convert dates to ISO strings for JSON serialization
    return {
      ...session,
      startTime: session.startTime,
      endTime: session.endTime,
      error: session.error
        ? {
            ...session.error,
            timestamp: session.error.timestamp,
          }
        : undefined,
    };
  }

  /**
   * Deserializes a session from storage
   * @param session Serialized session
   * @returns Deserialized session
   */
  private deserializeSession(session: any): AutomationSession {
    // Convert ISO strings back to Date objects
    return {
      ...session,
      startTime: new Date(session.startTime),
      endTime: session.endTime ? new Date(session.endTime) : undefined,
      error: session.error
        ? {
            ...session.error,
            timestamp: new Date(session.error.timestamp),
          }
        : undefined,
    };
  }

  /**
   * Applies recovery options to persisted data
   * @param data Persisted session data
   * @param options Recovery options
   * @returns Modified persisted data
   */
  private applyRecoveryOptions(
    data: PersistedSession,
    options: SessionRecoveryOptions
  ): PersistedSession {
    const modifiedData = { ...data };

    // Reset failed tasks
    if (options.resetFailedTasks) {
      modifiedData.session.failedTasks = [];
    }

    // Clear completed tasks
    if (options.clearCompletedTasks) {
      modifiedData.session.completedTasks = [];
    }

    // Resume from last task
    if (!options.resumeFromLast) {
      modifiedData.currentTaskId = undefined;
    }

    return modifiedData;
  }

  /**
   * Exports session to a file
   * @param session Session to export
   * @param filePath File path to export to
   */
  async exportSession(session: AutomationSession, filePath: string): Promise<void> {
    try {
      const exportData = {
        session: this.serializeSession(session),
        exportedAt: new Date(),
        version: this.version,
      };

      const content = JSON.stringify(exportData, null, 2);
      const uri = vscode.Uri.file(filePath);

      await vscode.workspace.fs.writeFile(uri, Buffer.from(content, 'utf8'));

      console.log(`Session exported to ${filePath}`);
    } catch (error) {
      console.error('Failed to export session:', error);
      throw new Error(`Session export failed: ${error}`);
    }
  }

  /**
   * Imports session from a file
   * @param filePath File path to import from
   * @returns Imported session
   */
  async importSession(filePath: string): Promise<AutomationSession> {
    try {
      const uri = vscode.Uri.file(filePath);
      const content = await vscode.workspace.fs.readFile(uri);
      const data = JSON.parse(Buffer.from(content).toString('utf8'));

      if (!data.session) {
        throw new Error('Invalid session file format');
      }

      return this.deserializeSession(data.session);
    } catch (error) {
      console.error('Failed to import session:', error);
      throw new Error(`Session import failed: ${error}`);
    }
  }

  /**
   * Creates a session snapshot
   * @param session Session to snapshot
   * @returns Snapshot data
   */
  createSnapshot(session: AutomationSession): string {
    const snapshot = {
      id: session.id,
      status: session.status,
      startTime: session.startTime,
      endTime: session.endTime,
      totalTasks: session.totalTasks,
      completedCount: session.completedTasks.length,
      failedCount: session.failedTasks.length,
      skippedCount: session.skippedTasks.length,
      currentTask: session.currentTask?.id,
      configuration: session.configuration,
    };

    return JSON.stringify(snapshot, null, 2);
  }

  /**
   * Gets session history
   * @returns Array of session IDs
   */
  async getSessionHistory(): Promise<string[]> {
    const historyKey = `${this.storageKey}-history`;
    return this.context.globalState.get<string[]>(historyKey) || [];
  }

  /**
   * Adds session to history
   * @param sessionId Session ID
   */
  async addToHistory(sessionId: string): Promise<void> {
    const historyKey = `${this.storageKey}-history`;
    const history = await this.getSessionHistory();

    // Add to beginning of history
    history.unshift(sessionId);

    // Keep only last 10 sessions
    const trimmedHistory = history.slice(0, 10);

    await this.context.globalState.update(historyKey, trimmedHistory);
  }

  /**
   * Clears session history
   */
  async clearHistory(): Promise<void> {
    const historyKey = `${this.storageKey}-history`;
    await this.context.globalState.update(historyKey, []);
  }

  /**
   * Gets session statistics
   * @param session Session to analyze
   * @returns Session statistics
   */
  getSessionStatistics(session: AutomationSession): {
    duration: number;
    completionRate: number;
    failureRate: number;
    averageTaskTime: number;
  } {
    const endTime = session.endTime || new Date();
    const duration = endTime.getTime() - session.startTime.getTime();

    const totalProcessed = session.completedTasks.length + session.failedTasks.length;
    const completionRate = totalProcessed > 0 ? session.completedTasks.length / totalProcessed : 0;
    const failureRate = totalProcessed > 0 ? session.failedTasks.length / totalProcessed : 0;

    const averageTaskTime = totalProcessed > 0 ? duration / totalProcessed : 0;

    return {
      duration,
      completionRate,
      failureRate,
      averageTaskTime,
    };
  }

  /**
   * Validates persisted session data
   * @param data Persisted session data
   * @returns True if valid
   */
  validatePersistedData(data: PersistedSession): boolean {
    try {
      // Check required fields
      if (!data.session || !data.session.id || !data.version) {
        return false;
      }

      // Check session structure
      if (!data.session.startTime || !data.session.configuration) {
        return false;
      }

      // Check arrays
      if (
        !Array.isArray(data.session.completedTasks) ||
        !Array.isArray(data.session.failedTasks) ||
        !Array.isArray(data.session.skippedTasks) ||
        !Array.isArray(data.executionQueue)
      ) {
        return false;
      }

      return true;
    } catch {
      return false;
    }
  }

  /**
   * Migrates session data from old version
   * @param data Old version data
   * @param fromVersion Source version
   * @returns Migrated data
   */
  private migrateSession(data: any, fromVersion: string): PersistedSession {
    // Implement migration logic for different versions
    // For now, just return as-is
    console.log(`Migrating session from version ${fromVersion} to ${this.version}`);
    return data;
  }

  /**
   * Gets storage size
   * @returns Size in bytes
   */
  async getStorageSize(): Promise<number> {
    const workspaceData = this.context.workspaceState.get<PersistedSession>(this.storageKey);
    const globalData = this.context.globalState.get<PersistedSession>(this.storageKey);

    const workspaceSize = workspaceData ? JSON.stringify(workspaceData).length : 0;
    const globalSize = globalData ? JSON.stringify(globalData).length : 0;

    return workspaceSize + globalSize;
  }

  /**
   * Compacts storage by removing old data
   */
  async compactStorage(): Promise<void> {
    // Remove old history entries
    const history = await this.getSessionHistory();
    const trimmedHistory = history.slice(0, 5);
    await this.context.globalState.update(`${this.storageKey}-history`, trimmedHistory);

    console.log('Storage compacted');
  }
}

/**
 * Creates a SessionPersistence instance
 */
export function createSessionPersistence(context: vscode.ExtensionContext): SessionPersistence {
  return new SessionPersistence(context);
}
