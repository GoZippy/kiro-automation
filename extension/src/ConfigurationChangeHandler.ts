import * as vscode from 'vscode';
import { ConfigManager } from './ConfigManager';
import { AutomationConfig } from './models/Configuration';

/**
 * Configuration change event
 */
export interface ConfigurationChangeEvent {
  /** The configuration key that changed */
  key: keyof AutomationConfig;
  
  /** The old value */
  oldValue: any;
  
  /** The new value */
  newValue: any;
  
  /** Timestamp of the change */
  timestamp: Date;
}

/**
 * Configuration change handler callback
 */
export type ConfigurationChangeCallback = (event: ConfigurationChangeEvent) => void | Promise<void>;

/**
 * ConfigurationChangeHandler class
 * Manages configuration change listeners with validation and hot-reload support
 */
export class ConfigurationChangeHandler {
  private configManager: ConfigManager;
  private previousConfig: AutomationConfig;
  private changeHandlers: Map<keyof AutomationConfig | '*', ConfigurationChangeCallback[]> = new Map();
  private disposables: vscode.Disposable[] = [];
  private isProcessingChange = false;

  constructor(configManager: ConfigManager) {
    this.configManager = configManager;
    this.previousConfig = configManager.getAll();
    this.setupChangeListener();
  }

  /**
   * Sets up the main configuration change listener
   */
  private setupChangeListener(): void {
    const disposable = this.configManager.onDidChangeConfiguration(async (newConfig) => {
      if (this.isProcessingChange) {
        return; // Prevent recursive change handling
      }

      this.isProcessingChange = true;
      try {
        await this.handleConfigurationChange(newConfig);
      } finally {
        this.isProcessingChange = false;
      }
    });

    this.disposables.push(disposable);
  }

  /**
   * Handles configuration changes by detecting what changed and notifying listeners
   */
  private async handleConfigurationChange(newConfig: AutomationConfig): Promise<void> {
    const changes: ConfigurationChangeEvent[] = [];

    // Detect changes
    for (const key of Object.keys(newConfig) as Array<keyof AutomationConfig>) {
      const oldValue = this.previousConfig[key];
      const newValue = newConfig[key];

      if (!this.areValuesEqual(oldValue, newValue)) {
        changes.push({
          key,
          oldValue,
          newValue,
          timestamp: new Date(),
        });
      }
    }

    // Validate the new configuration
    const validationResult = this.configManager.validateCurrentConfiguration();
    if (!validationResult.valid) {
      vscode.window.showWarningMessage(
        `Configuration validation warnings: ${validationResult.errors.join(', ')}`
      );
    }

    // Notify listeners for each change
    for (const change of changes) {
      await this.notifyListeners(change);
    }

    // Update previous config
    this.previousConfig = newConfig;

    // Show notification if enabled
    if (changes.length > 0 && newConfig.notifications) {
      this.showChangeNotification(changes);
    }
  }

  /**
   * Compares two values for equality (handles arrays and objects)
   */
  private areValuesEqual(value1: any, value2: any): boolean {
    if (value1 === value2) {
      return true;
    }

    if (Array.isArray(value1) && Array.isArray(value2)) {
      if (value1.length !== value2.length) {
        return false;
      }
      return value1.every((item, index) => this.areValuesEqual(item, value2[index]));
    }

    if (typeof value1 === 'object' && typeof value2 === 'object' && value1 !== null && value2 !== null) {
      const keys1 = Object.keys(value1);
      const keys2 = Object.keys(value2);
      
      if (keys1.length !== keys2.length) {
        return false;
      }
      
      return keys1.every((key) => this.areValuesEqual(value1[key], value2[key]));
    }

    return false;
  }

  /**
   * Notifies all registered listeners for a configuration change
   */
  private async notifyListeners(event: ConfigurationChangeEvent): Promise<void> {
    // Notify specific key listeners
    const keyHandlers = this.changeHandlers.get(event.key) || [];
    for (const handler of keyHandlers) {
      try {
        await handler(event);
      } catch (error) {
        console.error(`Error in configuration change handler for ${event.key}:`, error);
        vscode.window.showErrorMessage(
          `Error handling configuration change for ${event.key}: ${error}`
        );
      }
    }

    // Notify wildcard listeners
    const wildcardHandlers = this.changeHandlers.get('*') || [];
    for (const handler of wildcardHandlers) {
      try {
        await handler(event);
      } catch (error) {
        console.error('Error in wildcard configuration change handler:', error);
      }
    }
  }

  /**
   * Shows a notification about configuration changes
   */
  private showChangeNotification(changes: ConfigurationChangeEvent[]): void {
    if (changes.length === 1) {
      const change = changes[0];
      vscode.window.showInformationMessage(
        `Configuration updated: ${change.key} = ${JSON.stringify(change.newValue)}`
      );
    } else {
      vscode.window.showInformationMessage(
        `Configuration updated: ${changes.length} settings changed`
      );
    }
  }

  /**
   * Registers a handler for a specific configuration key change
   * @param key Configuration key to watch (use '*' for all changes)
   * @param handler Callback function to invoke on change
   * @returns Disposable to unregister the handler
   */
  on(
    key: keyof AutomationConfig | '*',
    handler: ConfigurationChangeCallback
  ): vscode.Disposable {
    if (!this.changeHandlers.has(key)) {
      this.changeHandlers.set(key, []);
    }

    const handlers = this.changeHandlers.get(key)!;
    handlers.push(handler);

    return new vscode.Disposable(() => {
      const index = handlers.indexOf(handler);
      if (index > -1) {
        handlers.splice(index, 1);
      }
      
      // Clean up empty handler arrays
      if (handlers.length === 0) {
        this.changeHandlers.delete(key);
      }
    });
  }

  /**
   * Registers a handler that fires once for a configuration change
   * @param key Configuration key to watch
   * @param handler Callback function to invoke on change
   * @returns Disposable to unregister the handler
   */
  once(
    key: keyof AutomationConfig | '*',
    handler: ConfigurationChangeCallback
  ): vscode.Disposable {
    let disposable: vscode.Disposable;

    const wrappedHandler: ConfigurationChangeCallback = async (event) => {
      disposable.dispose();
      await handler(event);
    };

    disposable = this.on(key, wrappedHandler);
    return disposable;
  }

  /**
   * Removes all handlers for a specific key
   * @param key Configuration key
   */
  removeAllHandlers(key: keyof AutomationConfig | '*'): void {
    this.changeHandlers.delete(key);
  }

  /**
   * Removes all handlers
   */
  removeAllHandlersForAllKeys(): void {
    this.changeHandlers.clear();
  }

  /**
   * Gets the number of registered handlers for a key
   * @param key Configuration key
   * @returns Number of handlers
   */
  getHandlerCount(key: keyof AutomationConfig | '*'): number {
    return this.changeHandlers.get(key)?.length || 0;
  }

  /**
   * Gets the total number of registered handlers
   * @returns Total number of handlers
   */
  getTotalHandlerCount(): number {
    let count = 0;
    const handlersArray = Array.from(this.changeHandlers.values());
    for (const handlers of handlersArray) {
      count += handlers.length;
    }
    return count;
  }

  /**
   * Manually triggers validation of the current configuration
   * @returns Validation result
   */
  validateConfiguration(): { valid: boolean; errors: string[] } {
    return this.configManager.validateCurrentConfiguration();
  }

  /**
   * Reloads the configuration and triggers change events if needed
   */
  async reloadConfiguration(): Promise<void> {
    const newConfig = this.configManager.getAll();
    await this.handleConfigurationChange(newConfig);
  }

  /**
   * Gets the current configuration
   * @returns Current configuration
   */
  getCurrentConfiguration(): AutomationConfig {
    return this.configManager.getAll();
  }

  /**
   * Gets the previous configuration (before last change)
   * @returns Previous configuration
   */
  getPreviousConfiguration(): AutomationConfig {
    return { ...this.previousConfig };
  }

  /**
   * Disposes of the handler and cleans up resources
   */
  dispose(): void {
    this.disposables.forEach((disposable) => disposable.dispose());
    this.disposables = [];
    this.changeHandlers.clear();
  }
}

/**
 * Creates a configuration change handler with common handlers pre-registered
 * @param configManager Configuration manager instance
 * @returns Configured change handler
 */
export function createConfigurationChangeHandler(
  configManager: ConfigManager
): ConfigurationChangeHandler {
  const handler = new ConfigurationChangeHandler(configManager);

  // Register common handlers
  handler.on('logLevel', (event) => {
    console.log(`Log level changed from ${event.oldValue} to ${event.newValue}`);
  });

  handler.on('enabled', (event) => {
    if (event.newValue === false) {
      vscode.window.showWarningMessage(
        'Kiro Automation has been disabled. Restart to apply changes.'
      );
    } else {
      vscode.window.showInformationMessage(
        'Kiro Automation has been enabled. Restart to apply changes.'
      );
    }
  });

  handler.on('maxMemoryUsage', (event) => {
    console.log(`Memory limit changed from ${event.oldValue}MB to ${event.newValue}MB`);
  });

  return handler;
}
