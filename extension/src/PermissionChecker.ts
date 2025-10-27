import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Permission check result
 */
export interface PermissionCheckResult {
  allowed: boolean;
  reason?: string;
}

/**
 * PermissionChecker class
 * Handles permission checks for workspace trust, file system access, and extension APIs
 */
export class PermissionChecker {
  private workspaceRoot: string;
  private context: vscode.ExtensionContext;

  constructor(workspaceRoot: string, context: vscode.ExtensionContext) {
    this.workspaceRoot = workspaceRoot;
    this.context = context;
  }

  /**
   * Checks if the workspace is trusted
   * Automation should only run in trusted workspaces
   * @returns Permission check result
   */
  async checkWorkspaceTrust(): Promise<PermissionCheckResult> {
    try {
      // Check if workspace trust API is available
      if (!vscode.workspace.isTrusted) {
        return {
          allowed: false,
          reason: 'Workspace is not trusted. Automation requires a trusted workspace for security.',
        };
      }

      return { allowed: true };
    } catch (error) {
      // If workspace trust API is not available, assume trusted (older VS Code versions)
      console.warn('Workspace trust API not available, assuming trusted workspace');
      return { allowed: true };
    }
  }

  /**
   * Checks if the extension has permission to read a file
   * @param filePath Path to the file
   * @returns Permission check result
   */
  async checkFileReadPermission(filePath: string): Promise<PermissionCheckResult> {
    try {
      // Check if file is within workspace
      if (!this.isPathWithinWorkspace(filePath)) {
        return {
          allowed: false,
          reason: `File ${filePath} is outside the workspace`,
        };
      }

      // Check if file exists and is readable
      await fs.promises.access(filePath, fs.constants.R_OK);

      return { allowed: true };
    } catch (error) {
      return {
        allowed: false,
        reason: `Cannot read file ${filePath}: ${error}`,
      };
    }
  }

  /**
   * Checks if the extension has permission to write to a file
   * @param filePath Path to the file
   * @returns Permission check result
   */
  async checkFileWritePermission(filePath: string): Promise<PermissionCheckResult> {
    try {
      // Check if file is within workspace
      if (!this.isPathWithinWorkspace(filePath)) {
        return {
          allowed: false,
          reason: `File ${filePath} is outside the workspace`,
        };
      }

      // Check if file exists
      const fileExists = await this.fileExists(filePath);

      if (fileExists) {
        // Check if file is writable
        await fs.promises.access(filePath, fs.constants.W_OK);
      } else {
        // Check if parent directory is writable
        const parentDir = path.dirname(filePath);
        await fs.promises.access(parentDir, fs.constants.W_OK);
      }

      return { allowed: true };
    } catch (error) {
      return {
        allowed: false,
        reason: `Cannot write to file ${filePath}: ${error}`,
      };
    }
  }

  /**
   * Checks if the extension has permission to create a directory
   * @param dirPath Path to the directory
   * @returns Permission check result
   */
  async checkDirectoryCreatePermission(dirPath: string): Promise<PermissionCheckResult> {
    try {
      // Check if directory is within workspace
      if (!this.isPathWithinWorkspace(dirPath)) {
        return {
          allowed: false,
          reason: `Directory ${dirPath} is outside the workspace`,
        };
      }

      // Check if parent directory exists and is writable
      const parentDir = path.dirname(dirPath);
      const parentExists = await this.fileExists(parentDir);

      if (!parentExists) {
        return {
          allowed: false,
          reason: `Parent directory ${parentDir} does not exist`,
        };
      }

      await fs.promises.access(parentDir, fs.constants.W_OK);

      return { allowed: true };
    } catch (error) {
      return {
        allowed: false,
        reason: `Cannot create directory ${dirPath}: ${error}`,
      };
    }
  }

  /**
   * Checks if the extension has permission to delete a file
   * @param filePath Path to the file
   * @returns Permission check result
   */
  async checkFileDeletePermission(filePath: string): Promise<PermissionCheckResult> {
    try {
      // Check if file is within workspace
      if (!this.isPathWithinWorkspace(filePath)) {
        return {
          allowed: false,
          reason: `File ${filePath} is outside the workspace`,
        };
      }

      // Check if file exists
      const fileExists = await this.fileExists(filePath);
      if (!fileExists) {
        return {
          allowed: false,
          reason: `File ${filePath} does not exist`,
        };
      }

      // Check if parent directory is writable (needed for deletion)
      const parentDir = path.dirname(filePath);
      await fs.promises.access(parentDir, fs.constants.W_OK);

      return { allowed: true };
    } catch (error) {
      return {
        allowed: false,
        reason: `Cannot delete file ${filePath}: ${error}`,
      };
    }
  }

  /**
   * Checks if a path is within the workspace
   * @param filePath Path to check
   * @returns True if path is within workspace
   */
  private isPathWithinWorkspace(filePath: string): boolean {
    try {
      const normalizedPath = path.normalize(filePath);
      const relativePath = path.relative(this.workspaceRoot, normalizedPath);

      // Path is within workspace if relative path doesn't start with '..' and is not absolute
      return !relativePath.startsWith('..') && !path.isAbsolute(relativePath);
    } catch (error) {
      return false;
    }
  }

  /**
   * Checks if a file exists
   * @param filePath Path to the file
   * @returns True if file exists
   */
  private async fileExists(filePath: string): Promise<boolean> {
    try {
      await fs.promises.access(filePath, fs.constants.F_OK);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Checks if the extension has access to Kiro's API
   * @returns Permission check result
   */
  async checkKiroApiAccess(): Promise<PermissionCheckResult> {
    try {
      // Try to get Kiro extension
      const kiroExtension = vscode.extensions.getExtension('kiro.kiro');

      if (!kiroExtension) {
        return {
          allowed: false,
          reason: 'Kiro extension is not installed or not found',
        };
      }

      // Check if Kiro extension is active
      if (!kiroExtension.isActive) {
        // Try to activate it
        try {
          await kiroExtension.activate();
        } catch (error) {
          return {
            allowed: false,
            reason: `Kiro extension is not active and could not be activated: ${error}`,
          };
        }
      }

      return { allowed: true };
    } catch (error) {
      return {
        allowed: false,
        reason: `Cannot access Kiro API: ${error}`,
      };
    }
  }

  /**
   * Checks if the extension has permission to execute commands
   * @param commandId Command ID to check
   * @returns Permission check result
   */
  async checkCommandExecutionPermission(commandId: string): Promise<PermissionCheckResult> {
    try {
      // Get all available commands
      const commands = await vscode.commands.getCommands();

      if (!commands.includes(commandId)) {
        return {
          allowed: false,
          reason: `Command ${commandId} is not available`,
        };
      }

      return { allowed: true };
    } catch (error) {
      return {
        allowed: false,
        reason: `Cannot check command permission: ${error}`,
      };
    }
  }

  /**
   * Checks if the extension has permission to create file watchers
   * @returns Permission check result
   */
  checkFileWatcherPermission(): PermissionCheckResult {
    try {
      // File watchers are generally allowed in VS Code extensions
      // Check if workspace is available
      if (!vscode.workspace.workspaceFolders || vscode.workspace.workspaceFolders.length === 0) {
        return {
          allowed: false,
          reason: 'No workspace folder is open',
        };
      }

      return { allowed: true };
    } catch (error) {
      return {
        allowed: false,
        reason: `Cannot create file watchers: ${error}`,
      };
    }
  }

  /**
   * Checks if the extension has permission to show notifications
   * @returns Permission check result
   */
  checkNotificationPermission(): PermissionCheckResult {
    try {
      // Notifications are generally allowed in VS Code extensions
      return { allowed: true };
    } catch (error) {
      return {
        allowed: false,
        reason: `Cannot show notifications: ${error}`,
      };
    }
  }

  /**
   * Checks if the extension has permission to create webviews
   * @returns Permission check result
   */
  checkWebviewPermission(): PermissionCheckResult {
    try {
      // Webviews require specific permissions in package.json
      // Check if extension context is available
      if (!this.context) {
        return {
          allowed: false,
          reason: 'Extension context is not available',
        };
      }

      return { allowed: true };
    } catch (error) {
      return {
        allowed: false,
        reason: `Cannot create webviews: ${error}`,
      };
    }
  }

  /**
   * Checks if the extension has permission to access workspace configuration
   * @returns Permission check result
   */
  checkConfigurationPermission(): PermissionCheckResult {
    try {
      // Configuration access is generally allowed
      const config = vscode.workspace.getConfiguration('kiro-automation');

      if (!config) {
        return {
          allowed: false,
          reason: 'Cannot access workspace configuration',
        };
      }

      return { allowed: true };
    } catch (error) {
      return {
        allowed: false,
        reason: `Cannot access configuration: ${error}`,
      };
    }
  }

  /**
   * Checks if the extension has permission to create output channels
   * @returns Permission check result
   */
  checkOutputChannelPermission(): PermissionCheckResult {
    try {
      // Output channels are generally allowed
      return { allowed: true };
    } catch (error) {
      return {
        allowed: false,
        reason: `Cannot create output channels: ${error}`,
      };
    }
  }

  /**
   * Checks if the extension has permission to create status bar items
   * @returns Permission check result
   */
  checkStatusBarPermission(): PermissionCheckResult {
    try {
      // Status bar items are generally allowed
      return { allowed: true };
    } catch (error) {
      return {
        allowed: false,
        reason: `Cannot create status bar items: ${error}`,
      };
    }
  }

  /**
   * Checks if the extension has permission to register tree data providers
   * @returns Permission check result
   */
  checkTreeViewPermission(): PermissionCheckResult {
    try {
      // Tree views are generally allowed
      return { allowed: true };
    } catch (error) {
      return {
        allowed: false,
        reason: `Cannot register tree views: ${error}`,
      };
    }
  }

  /**
   * Performs a comprehensive permission check before starting automation
   * @returns Permission check result with detailed information
   */
  async performComprehensiveCheck(): Promise<{
    allowed: boolean;
    checks: { [key: string]: PermissionCheckResult };
  }> {
    const checks: { [key: string]: PermissionCheckResult } = {};

    // Check workspace trust
    checks.workspaceTrust = await this.checkWorkspaceTrust();

    // Check Kiro API access
    checks.kiroApiAccess = await this.checkKiroApiAccess();

    // Check file watcher permission
    checks.fileWatcher = this.checkFileWatcherPermission();

    // Check configuration permission
    checks.configuration = this.checkConfigurationPermission();

    // Check notification permission
    checks.notification = this.checkNotificationPermission();

    // Check output channel permission
    checks.outputChannel = this.checkOutputChannelPermission();

    // Check status bar permission
    checks.statusBar = this.checkStatusBarPermission();

    // Check tree view permission
    checks.treeView = this.checkTreeViewPermission();

    // Check webview permission
    checks.webview = this.checkWebviewPermission();

    // Determine if all critical checks passed
    const criticalChecks = ['workspaceTrust', 'kiroApiAccess', 'fileWatcher', 'configuration'];
    const allCriticalChecksPassed = criticalChecks.every((key) => checks[key].allowed);

    return {
      allowed: allCriticalChecksPassed,
      checks,
    };
  }

  /**
   * Checks if a specific file path is safe to access
   * Validates against common security issues
   * @param filePath Path to check
   * @returns Permission check result
   */
  checkPathSafety(filePath: string): PermissionCheckResult {
    try {
      // Check for null bytes
      if (filePath.includes('\0')) {
        return {
          allowed: false,
          reason: 'Path contains null bytes',
        };
      }

      // Check for path traversal
      const normalizedPath = path.normalize(filePath);
      if (normalizedPath.includes('..')) {
        return {
          allowed: false,
          reason: 'Path contains directory traversal sequences',
        };
      }

      // Check if path is within workspace
      if (!this.isPathWithinWorkspace(filePath)) {
        return {
          allowed: false,
          reason: 'Path is outside the workspace',
        };
      }

      // Check for suspicious patterns
      const suspiciousPatterns = [
        /\/etc\//i,
        /\/sys\//i,
        /\/proc\//i,
        /\/dev\//i,
        /C:\\Windows\\/i,
        /C:\\Program Files\\/i,
      ];

      if (suspiciousPatterns.some((pattern) => pattern.test(normalizedPath))) {
        return {
          allowed: false,
          reason: 'Path points to a system directory',
        };
      }

      return { allowed: true };
    } catch (error) {
      return {
        allowed: false,
        reason: `Path safety check failed: ${error}`,
      };
    }
  }

  /**
   * Checks if the extension has permission to modify a specific file
   * @param filePath Path to the file
   * @returns Permission check result
   */
  async checkFileModificationPermission(filePath: string): Promise<PermissionCheckResult> {
    // First check path safety
    const safetyCheck = this.checkPathSafety(filePath);
    if (!safetyCheck.allowed) {
      return safetyCheck;
    }

    // Check write permission
    return await this.checkFileWritePermission(filePath);
  }

  /**
   * Checks if automation is allowed to run
   * Combines workspace trust and configuration checks
   * @returns Permission check result
   */
  async checkAutomationPermission(): Promise<PermissionCheckResult> {
    // Check workspace trust
    const trustCheck = await this.checkWorkspaceTrust();
    if (!trustCheck.allowed) {
      return trustCheck;
    }

    // Check if automation is enabled in configuration
    const config = vscode.workspace.getConfiguration('kiro-automation');
    const enabled = config.get<boolean>('enabled', true);

    if (!enabled) {
      return {
        allowed: false,
        reason: 'Automation is disabled in configuration',
      };
    }

    return { allowed: true };
  }
}
