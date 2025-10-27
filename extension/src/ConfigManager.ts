import * as vscode from 'vscode';
import {
  AutomationConfig,
  ConfigurationSchema,
  DEFAULT_CONFIGURATION,
  mergeWithDefaults,
  ValidationResult,
} from './models/Configuration';

/**
 * ConfigManager class
 * Manages configuration settings for the Kiro Automation Extension
 * Handles both workspace and global configuration with validation
 */
export class ConfigManager {
  private static readonly CONFIG_SECTION = 'kiro-automation';
  private config: vscode.WorkspaceConfiguration;
  private changeListeners: Array<(config: AutomationConfig) => void> = [];
  private disposables: vscode.Disposable[] = [];

  constructor() {
    this.config = vscode.workspace.getConfiguration(ConfigManager.CONFIG_SECTION);
    this.setupConfigurationChangeListener();
  }

  /**
   * Compatibility shim: validate a single key/value pair (tests expect this API)
   */
  validate(key: keyof AutomationConfig, value: any): boolean {
    const result = this.validateValue(key as any, value);
    return result.valid;
  }

  /**
   * Compatibility shim: simple event subscription similar to older API
   */
  on(eventName: string, callback: (key: any, value: any) => void): vscode.Disposable {
    // Map 'configChanged' to onDidChangeConfiguration
    if (eventName === 'configChanged') {
      return this.onDidChangeConfiguration((config) => callback('configChanged', config));
    }
    // Return a noop disposable for unsupported events
    return new vscode.Disposable(() => {});
  }

  /**
   * Compatibility shim: returns workspace configuration object
   */
  getWorkspaceConfig(): AutomationConfig {
    return this.getAll();
  }

  /**
   * Compatibility shim: returns global configuration object
   */
  getGlobalConfig(): AutomationConfig {
    return this.getAll();
  }

  /**
   * Compatibility shim: returns merged configuration
   */
  getMergedConfig(): AutomationConfig {
    return this.getAll();
  }

  /**
   * Sets up a listener for configuration changes
   */
  private setupConfigurationChangeListener(): void {
    const disposable = vscode.workspace.onDidChangeConfiguration((event) => {
      if (event.affectsConfiguration(ConfigManager.CONFIG_SECTION)) {
        this.config = vscode.workspace.getConfiguration(ConfigManager.CONFIG_SECTION);
        this.notifyListeners();
      }
    });
    this.disposables.push(disposable);
  }

  /**
   * Gets a configuration value with type safety
   * @param key Configuration key
   * @param defaultValue Default value if not set
   * @returns Configuration value
   */
  get<K extends keyof AutomationConfig>(
    key: K,
    defaultValue?: AutomationConfig[K]
  ): AutomationConfig[K] {
    const value = this.config.get<AutomationConfig[K]>(key);
    if (value !== undefined) {
      return value;
    }
    return defaultValue !== undefined ? defaultValue : DEFAULT_CONFIGURATION[key];
  }

  /**
   * Gets all configuration values as a complete AutomationConfig object
   * @returns Complete configuration object
   */
  getAll(): AutomationConfig {
    const config: Partial<AutomationConfig> = {};
    
    for (const key of Object.keys(DEFAULT_CONFIGURATION) as Array<keyof AutomationConfig>) {
      (config as any)[key] = this.get(key);
    }
    
    return config as AutomationConfig;
  }

  /**
   * Updates a configuration value
   * @param key Configuration key
   * @param value New value
   * @param target Configuration target (workspace or global)
   * @returns Promise that resolves when update is complete
   */
  async update<K extends keyof AutomationConfig>(
    key: K,
    value: AutomationConfig[K],
    target: vscode.ConfigurationTarget = vscode.ConfigurationTarget.Workspace
  ): Promise<void> {
    // Validate the value before updating
    const validationResult = this.validateValue(key, value);
    if (!validationResult.valid) {
      throw new Error(`Invalid configuration value for ${key}: ${validationResult.errors.join(', ')}`);
    }

    await this.config.update(key, value, target);
  }

  /**
   * Updates multiple configuration values at once
   * @param values Object containing key-value pairs to update
   * @param target Configuration target (workspace or global)
   * @returns Promise that resolves when all updates are complete
   */
  async updateMultiple(
    values: Partial<AutomationConfig>,
    target: vscode.ConfigurationTarget = vscode.ConfigurationTarget.Workspace
  ): Promise<void> {
    // Validate all values first
    const validationResult = ConfigurationSchema.validate(values);
    if (!validationResult.valid) {
      throw new Error(`Invalid configuration values: ${validationResult.errors.join(', ')}`);
    }

    // Update all values
    const updatePromises = Object.entries(values).map(([key, value]) =>
      this.config.update(key, value, target)
    );

    await Promise.all(updatePromises);
  }

  /**
   * Resets a configuration value to its default
   * @param key Configuration key
   * @param target Configuration target (workspace or global)
   * @returns Promise that resolves when reset is complete
   */
  async reset<K extends keyof AutomationConfig>(
    key: K,
    target: vscode.ConfigurationTarget = vscode.ConfigurationTarget.Workspace
  ): Promise<void> {
    await this.config.update(key, undefined, target);
  }

  /**
   * Resets all configuration values to defaults
   * @param target Configuration target (workspace or global)
   * @returns Promise that resolves when all resets are complete
   */
  async resetAll(
    target: vscode.ConfigurationTarget = vscode.ConfigurationTarget.Workspace
  ): Promise<void> {
    const resetPromises = Object.keys(DEFAULT_CONFIGURATION).map((key) =>
      this.config.update(key, undefined, target)
    );

    await Promise.all(resetPromises);
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
   * Checks if a configuration key has been explicitly set (not using default)
   * @param key Configuration key
   * @returns True if the value has been explicitly set
   */
  has<K extends keyof AutomationConfig>(key: K): boolean {
    const inspect = this.config.inspect<AutomationConfig[K]>(key);
    return !!(
      inspect?.workspaceValue !== undefined ||
      inspect?.workspaceFolderValue !== undefined ||
      inspect?.globalValue !== undefined
    );
  }

  /**
   * Gets the configuration target where a value is defined
   * @param key Configuration key
   * @returns Configuration target or undefined if using default
   */
  getConfigurationTarget<K extends keyof AutomationConfig>(
    key: K
  ): vscode.ConfigurationTarget | undefined {
    const inspect = this.config.inspect<AutomationConfig[K]>(key);
    
    if (inspect?.workspaceFolderValue !== undefined) {
      return vscode.ConfigurationTarget.WorkspaceFolder;
    }
    if (inspect?.workspaceValue !== undefined) {
      return vscode.ConfigurationTarget.Workspace;
    }
    if (inspect?.globalValue !== undefined) {
      return vscode.ConfigurationTarget.Global;
    }
    
    return undefined;
  }

  /**
   * Gets workspace-specific configuration value
   * @param key Configuration key
   * @returns Workspace value or undefined
   */
  getWorkspaceValue<K extends keyof AutomationConfig>(
    key: K
  ): AutomationConfig[K] | undefined {
    const inspect = this.config.inspect<AutomationConfig[K]>(key);
    return inspect?.workspaceValue;
  }

  /**
   * Gets global configuration value
   * @param key Configuration key
   * @returns Global value or undefined
   */
  getGlobalValue<K extends keyof AutomationConfig>(
    key: K
  ): AutomationConfig[K] | undefined {
    const inspect = this.config.inspect<AutomationConfig[K]>(key);
    return inspect?.globalValue;
  }

  /**
   * Registers a listener for configuration changes
   * @param listener Callback function to invoke on configuration change
   * @returns Disposable to unregister the listener
   */
  onDidChangeConfiguration(
    listener: (config: AutomationConfig) => void
  ): vscode.Disposable {
    this.changeListeners.push(listener);
    
    return new vscode.Disposable(() => {
      const index = this.changeListeners.indexOf(listener);
      if (index > -1) {
        this.changeListeners.splice(index, 1);
      }
    });
  }

  /**
   * Notifies all registered listeners of configuration changes
   */
  private notifyListeners(): void {
    const config = this.getAll();
    this.changeListeners.forEach((listener) => {
      try {
        listener(config);
      } catch (error) {
        console.error('Error in configuration change listener:', error);
      }
    });
  }

  /**
   * Validates the current configuration
   * @returns Validation result
   */
  validateCurrentConfiguration(): ValidationResult {
    const config = this.getAll();
    return ConfigurationSchema.validate(config);
  }

  /**
   * Exports the current configuration as JSON
   * @returns Configuration as JSON string
   */
  exportConfiguration(): string {
    const config = this.getAll();
    return JSON.stringify(config, null, 2);
  }

  /**
   * Imports configuration from JSON
   * @param json JSON string containing configuration
   * @param target Configuration target (workspace or global)
   * @returns Promise that resolves when import is complete
   */
  async importConfiguration(
    json: string,
    target: vscode.ConfigurationTarget = vscode.ConfigurationTarget.Workspace
  ): Promise<void> {
    try {
      const config = JSON.parse(json) as Partial<AutomationConfig>;
      await this.updateMultiple(config, target);
    } catch (error) {
      throw new Error(`Failed to import configuration: ${error}`);
    }
  }

  /**
   * Disposes of the ConfigManager and cleans up resources
   */
  dispose(): void {
    this.disposables.forEach((disposable) => disposable.dispose());
    this.disposables = [];
    this.changeListeners = [];
  }
}
