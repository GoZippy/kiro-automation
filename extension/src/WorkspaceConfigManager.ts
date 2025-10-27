import * as vscode from 'vscode';
import {
  AutomationConfig,
  ConfigurationSchema,
  DEFAULT_CONFIGURATION,
  ValidationResult,
} from './models/Configuration';

/**
 * Configuration scope
 */
export enum ConfigScope {
  DEFAULT = 'default',
  GLOBAL = 'global',
  WORKSPACE = 'workspace',
  WORKSPACE_FOLDER = 'workspaceFolder',
}

/**
 * Configuration with scope information
 */
export interface ScopedConfig {
  /** Configuration values */
  config: AutomationConfig;

  /** Scope where each value is defined */
  scopes: Map<keyof AutomationConfig, ConfigScope>;
}

/**
 * WorkspaceConfigManager class
 * Manages workspace-specific configuration with inheritance from global settings
 * Supports configuration overrides at workspace folder level
 */
export class WorkspaceConfigManager {
  private static readonly CONFIG_SECTION = 'kiro-automation';
  private disposables: vscode.Disposable[] = [];
  private changeListeners: Map<string, Array<(config: AutomationConfig) => void>> = new Map();

  constructor() {
    this.setupConfigurationChangeListener();
  }

  /**
   * Sets up a listener for configuration changes
   */
  private setupConfigurationChangeListener(): void {
    const disposable = vscode.workspace.onDidChangeConfiguration((event) => {
      if (event.affectsConfiguration(WorkspaceConfigManager.CONFIG_SECTION)) {
        // Notify all workspace listeners
        for (const [workspaceUri, listeners] of this.changeListeners.entries()) {
          const config = this.getWorkspaceConfig(workspaceUri);
          listeners.forEach((listener) => {
            try {
              listener(config);
            } catch (error) {
              console.error(`[WorkspaceConfigManager] Error in configuration change listener:`, error);
            }
          });
        }
      }
    });
    this.disposables.push(disposable);
  }

  /**
   * Gets configuration for a specific workspace with inheritance
   * @param workspaceUri Workspace URI
   * @returns Complete configuration with inheritance applied
   */
  getWorkspaceConfig(workspaceUri: string): AutomationConfig {
    const uri = vscode.Uri.parse(workspaceUri);
    const config = vscode.workspace.getConfiguration(
      WorkspaceConfigManager.CONFIG_SECTION,
      uri
    );

    const result: Partial<AutomationConfig> = {};

    // Build configuration with inheritance: default -> global -> workspace
    for (const key of Object.keys(DEFAULT_CONFIGURATION) as Array<keyof AutomationConfig>) {
      const value = config.get<AutomationConfig[typeof key]>(key);
      (result as any)[key] = value !== undefined ? value : DEFAULT_CONFIGURATION[key];
    }

    return result as AutomationConfig;
  }

  /**
   * Gets configuration with scope information
   * @param workspaceUri Workspace URI
   * @returns Configuration with scope information for each value
   */
  getScopedConfig(workspaceUri: string): ScopedConfig {
    const uri = vscode.Uri.parse(workspaceUri);
    const config = vscode.workspace.getConfiguration(
      WorkspaceConfigManager.CONFIG_SECTION,
      uri
    );

    const result: Partial<AutomationConfig> = {};
    const scopes = new Map<keyof AutomationConfig, ConfigScope>();

    for (const key of Object.keys(DEFAULT_CONFIGURATION) as Array<keyof AutomationConfig>) {
      const inspect = config.inspect<AutomationConfig[typeof key]>(key);
      
      // Determine scope and value
      if (inspect?.workspaceFolderValue !== undefined) {
        (result as any)[key] = inspect.workspaceFolderValue;
        scopes.set(key, ConfigScope.WORKSPACE_FOLDER);
      } else if (inspect?.workspaceValue !== undefined) {
        (result as any)[key] = inspect.workspaceValue;
        scopes.set(key, ConfigScope.WORKSPACE);
      } else if (inspect?.globalValue !== undefined) {
        (result as any)[key] = inspect.globalValue;
        scopes.set(key, ConfigScope.GLOBAL);
      } else {
        (result as any)[key] = DEFAULT_CONFIGURATION[key];
        scopes.set(key, ConfigScope.DEFAULT);
      }
    }

    return {
      config: result as AutomationConfig,
      scopes,
    };
  }

  /**
   * Gets a specific configuration value for a workspace
   * @param workspaceUri Workspace URI
   * @param key Configuration key
   * @returns Configuration value
   */
  getWorkspaceValue<K extends keyof AutomationConfig>(
    workspaceUri: string,
    key: K
  ): AutomationConfig[K] {
    const config = this.getWorkspaceConfig(workspaceUri);
    return config[key];
  }

  /**
   * Updates a configuration value for a specific workspace
   * @param workspaceUri Workspace URI
   * @param key Configuration key
   * @param value New value
   * @param target Configuration target (workspace or workspace folder)
   * @returns Promise that resolves when update is complete
   */
  async updateWorkspaceValue<K extends keyof AutomationConfig>(
    workspaceUri: string,
    key: K,
    value: AutomationConfig[K],
    target: vscode.ConfigurationTarget = vscode.ConfigurationTarget.Workspace
  ): Promise<void> {
    // Validate the value
    const validationResult = this.validateValue(key, value);
    if (!validationResult.valid) {
      throw new Error(`Invalid configuration value for ${key}: ${validationResult.errors.join(', ')}`);
    }

    const uri = vscode.Uri.parse(workspaceUri);
    const config = vscode.workspace.getConfiguration(
      WorkspaceConfigManager.CONFIG_SECTION,
      uri
    );

    await config.update(key, value, target);
  }

  /**
   * Updates multiple configuration values for a workspace
   * @param workspaceUri Workspace URI
   * @param values Object containing key-value pairs to update
   * @param target Configuration target (workspace or workspace folder)
   * @returns Promise that resolves when all updates are complete
   */
  async updateWorkspaceConfig(
    workspaceUri: string,
    values: Partial<AutomationConfig>,
    target: vscode.ConfigurationTarget = vscode.ConfigurationTarget.Workspace
  ): Promise<void> {
    // Validate all values first
    const validationResult = ConfigurationSchema.validate(values);
    if (!validationResult.valid) {
      throw new Error(`Invalid configuration values: ${validationResult.errors.join(', ')}`);
    }

    const uri = vscode.Uri.parse(workspaceUri);
    const config = vscode.workspace.getConfiguration(
      WorkspaceConfigManager.CONFIG_SECTION,
      uri
    );

    // Update all values
    const updatePromises = Object.entries(values).map(([key, value]) =>
      config.update(key, value, target)
    );

    await Promise.all(updatePromises);
  }

  /**
   * Resets a configuration value to its inherited value (or default)
   * @param workspaceUri Workspace URI
   * @param key Configuration key
   * @param target Configuration target to reset
   * @returns Promise that resolves when reset is complete
   */
  async resetWorkspaceValue<K extends keyof AutomationConfig>(
    workspaceUri: string,
    key: K,
    target: vscode.ConfigurationTarget = vscode.ConfigurationTarget.Workspace
  ): Promise<void> {
    const uri = vscode.Uri.parse(workspaceUri);
    const config = vscode.workspace.getConfiguration(
      WorkspaceConfigManager.CONFIG_SECTION,
      uri
    );

    await config.update(key, undefined, target);
  }

  /**
   * Gets configuration overrides for a workspace
   * @param workspaceUri Workspace URI
   * @returns Object containing only overridden values
   */
  getWorkspaceOverrides(workspaceUri: string): Partial<AutomationConfig> {
    const uri = vscode.Uri.parse(workspaceUri);
    const config = vscode.workspace.getConfiguration(
      WorkspaceConfigManager.CONFIG_SECTION,
      uri
    );

    const overrides: Partial<AutomationConfig> = {};

    for (const key of Object.keys(DEFAULT_CONFIGURATION) as Array<keyof AutomationConfig>) {
      const inspect = config.inspect<AutomationConfig[typeof key]>(key);
      
      // Only include workspace-level overrides
      if (inspect?.workspaceValue !== undefined || inspect?.workspaceFolderValue !== undefined) {
        (overrides as any)[key] = inspect.workspaceValue ?? inspect.workspaceFolderValue;
      }
    }

    return overrides;
  }

  /**
   * Checks if a workspace has any configuration overrides
   * @param workspaceUri Workspace URI
   * @returns True if workspace has overrides
   */
  hasWorkspaceOverrides(workspaceUri: string): boolean {
    const overrides = this.getWorkspaceOverrides(workspaceUri);
    return Object.keys(overrides).length > 0;
  }

  /**
   * Compares workspace configuration with global configuration
   * @param workspaceUri Workspace URI
   * @returns Object showing differences between workspace and global config
   */
  compareWithGlobal(workspaceUri: string): {
    key: keyof AutomationConfig;
    workspaceValue: any;
    globalValue: any;
    isDifferent: boolean;
  }[] {
    const uri = vscode.Uri.parse(workspaceUri);
    const config = vscode.workspace.getConfiguration(
      WorkspaceConfigManager.CONFIG_SECTION,
      uri
    );

    const differences: {
      key: keyof AutomationConfig;
      workspaceValue: any;
      globalValue: any;
      isDifferent: boolean;
    }[] = [];

    for (const key of Object.keys(DEFAULT_CONFIGURATION) as Array<keyof AutomationConfig>) {
      const inspect = config.inspect<AutomationConfig[typeof key]>(key);
      const workspaceValue = inspect?.workspaceValue ?? inspect?.workspaceFolderValue;
      const globalValue = inspect?.globalValue;

      differences.push({
        key,
        workspaceValue: workspaceValue ?? DEFAULT_CONFIGURATION[key],
        globalValue: globalValue ?? DEFAULT_CONFIGURATION[key],
        isDifferent: workspaceValue !== undefined && workspaceValue !== globalValue,
      });
    }

    return differences;
  }

  /**
   * Validates a configuration value
   * @param key Configuration key
   * @param value Value to validate
   * @returns Validation result
   */
  private validateValue<K extends keyof AutomationConfig>(
    key: K,
    value: AutomationConfig[K]
  ): ValidationResult {
    const partialConfig: Partial<AutomationConfig> = { [key]: value } as any;
    return ConfigurationSchema.validate(partialConfig);
  }

  /**
   * Registers a listener for configuration changes in a specific workspace
   * @param workspaceUri Workspace URI
   * @param listener Callback function to invoke on configuration change
   * @returns Disposable to unregister the listener
   */
  onDidChangeWorkspaceConfiguration(
    workspaceUri: string,
    listener: (config: AutomationConfig) => void
  ): vscode.Disposable {
    if (!this.changeListeners.has(workspaceUri)) {
      this.changeListeners.set(workspaceUri, []);
    }

    const listeners = this.changeListeners.get(workspaceUri)!;
    listeners.push(listener);

    return new vscode.Disposable(() => {
      const index = listeners.indexOf(listener);
      if (index > -1) {
        listeners.splice(index, 1);
      }
      
      // Clean up empty listener arrays
      if (listeners.length === 0) {
        this.changeListeners.delete(workspaceUri);
      }
    });
  }

  /**
   * Exports workspace configuration as JSON
   * @param workspaceUri Workspace URI
   * @param includeDefaults Whether to include default values
   * @returns Configuration as JSON string
   */
  exportWorkspaceConfig(workspaceUri: string, includeDefaults: boolean = false): string {
    const config = includeDefaults
      ? this.getWorkspaceConfig(workspaceUri)
      : this.getWorkspaceOverrides(workspaceUri);
    
    return JSON.stringify(config, null, 2);
  }

  /**
   * Imports workspace configuration from JSON
   * @param workspaceUri Workspace URI
   * @param json JSON string containing configuration
   * @param target Configuration target (workspace or workspace folder)
   * @returns Promise that resolves when import is complete
   */
  async importWorkspaceConfig(
    workspaceUri: string,
    json: string,
    target: vscode.ConfigurationTarget = vscode.ConfigurationTarget.Workspace
  ): Promise<void> {
    try {
      const config = JSON.parse(json) as Partial<AutomationConfig>;
      await this.updateWorkspaceConfig(workspaceUri, config, target);
    } catch (error) {
      throw new Error(`Failed to import workspace configuration: ${error}`);
    }
  }

  /**
   * Gets all workspaces with configuration overrides
   * @returns Array of workspace URIs with overrides
   */
  getWorkspacesWithOverrides(): string[] {
    const workspaces: string[] = [];
    const workspaceFolders = vscode.workspace.workspaceFolders;

    if (!workspaceFolders) {
      return workspaces;
    }

    for (const folder of workspaceFolders) {
      const uri = folder.uri.toString();
      if (this.hasWorkspaceOverrides(uri)) {
        workspaces.push(uri);
      }
    }

    return workspaces;
  }

  /**
   * Disposes of the WorkspaceConfigManager and cleans up resources
   */
  dispose(): void {
    this.disposables.forEach((disposable) => disposable.dispose());
    this.disposables = [];
    this.changeListeners.clear();
  }}

