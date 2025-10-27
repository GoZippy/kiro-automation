import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import {
  Plugin,
  PluginMetadata,
  PluginConfiguration,
  PluginError,
  PluginValidationResult,
  PluginFactory,
  TaskProcessor,
  PromptGenerator,
  CompletionDetector,
} from './PluginInterfaces';
import { Logger } from '../Logger';
import { EventEmitter } from 'events';

/**
 * Plugin registry events
 */
export enum PluginRegistryEvent {
  PLUGIN_REGISTERED = 'pluginRegistered',
  PLUGIN_UNREGISTERED = 'pluginUnregistered',
  PLUGIN_ACTIVATED = 'pluginActivated',
  PLUGIN_DEACTIVATED = 'pluginDeactivated',
  PLUGIN_ERROR = 'pluginError',
  PLUGIN_CONFIG_CHANGED = 'pluginConfigChanged',
}

/**
 * Plugin entry
 */
interface PluginEntry {
  /** Plugin instance */
  plugin: Plugin;

  /** Plugin configuration */
  config: PluginConfiguration;

  /** Whether plugin is activated */
  activated: boolean;

  /** Plugin file path (if loaded from file) */
  filePath?: string;

  /** Registration timestamp */
  registeredAt: Date;

  /** Activation timestamp */
  activatedAt?: Date;
}

/**
 * Plugin discovery options
 */
export interface PluginDiscoveryOptions {
  /** Directories to search for plugins */
  searchPaths: string[];

  /** File patterns to match */
  filePatterns: string[];

  /** Whether to search recursively */
  recursive: boolean;

  /** Maximum depth for recursive search */
  maxDepth?: number;
}

/**
 * Default plugin discovery options
 */
const DEFAULT_DISCOVERY_OPTIONS: PluginDiscoveryOptions = {
  searchPaths: ['.kiro/plugins', 'plugins'],
  filePatterns: ['*.plugin.js', '*.plugin.ts'],
  recursive: true,
  maxDepth: 3,
};

/**
 * PluginRegistry class
 * Manages plugin registration, activation, and lifecycle
 */
export class PluginRegistry extends EventEmitter {
  private plugins: Map<string, PluginEntry> = new Map();
  private logger: Logger;
  private workspaceRoot: string;
  private disposables: vscode.Disposable[] = [];

  constructor(workspaceRoot?: string) {
    super();
    this.logger = Logger.getInstance();
    this.workspaceRoot = workspaceRoot || vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || '';
  }

  /**
   * Registers a plugin
   * @param plugin Plugin to register
   * @param config Plugin configuration
   * @returns Plugin ID
   */
  async registerPlugin(plugin: Plugin, config?: Partial<PluginConfiguration>): Promise<string> {
    this.logger.info(`Registering plugin: ${plugin.metadata.id}`);

    // Validate plugin
    const validation = this.validatePlugin(plugin);
    if (!validation.valid) {
      throw new PluginError(
        plugin.metadata.id,
        `Plugin validation failed: ${validation.errors.join(', ')}`
      );
    }

    // Log warnings
    if (validation.warnings.length > 0) {
      validation.warnings.forEach((warning) => {
        this.logger.warning(`[Plugin: ${plugin.metadata.id}] ${warning}`);
      });
    }

    // Check if plugin already registered
    if (this.plugins.has(plugin.metadata.id)) {
      throw new PluginError(plugin.metadata.id, 'Plugin already registered');
    }

    // Check dependencies
    await this.checkDependencies(plugin);

    // Create plugin configuration
    const pluginConfig: PluginConfiguration = {
      pluginId: plugin.metadata.id,
      enabled: config?.enabled ?? true,
      config: config?.config,
      priority: config?.priority ?? 0,
    };

    // Create plugin entry
    const entry: PluginEntry = {
      plugin,
      config: pluginConfig,
      activated: false,
      registeredAt: new Date(),
    };

    // Store plugin
    this.plugins.set(plugin.metadata.id, entry);

    this.logger.info(`Plugin registered: ${plugin.metadata.id}`);
    this.emit(PluginRegistryEvent.PLUGIN_REGISTERED, plugin.metadata.id, plugin);

    // Auto-activate if enabled
    if (pluginConfig.enabled) {
      await this.activatePlugin(plugin.metadata.id);
    }

    return plugin.metadata.id;
  }

  /**
   * Unregisters a plugin
   * @param pluginId Plugin ID
   */
  async unregisterPlugin(pluginId: string): Promise<void> {
    this.logger.info(`Unregistering plugin: ${pluginId}`);

    const entry = this.plugins.get(pluginId);
    if (!entry) {
      throw new PluginError(pluginId, 'Plugin not found');
    }

    // Deactivate if activated
    if (entry.activated) {
      await this.deactivatePlugin(pluginId);
    }

    // Remove from registry
    this.plugins.delete(pluginId);

    this.logger.info(`Plugin unregistered: ${pluginId}`);
    this.emit(PluginRegistryEvent.PLUGIN_UNREGISTERED, pluginId);
  }

  /**
   * Activates a plugin
   * @param pluginId Plugin ID
   */
  async activatePlugin(pluginId: string): Promise<void> {
    this.logger.info(`Activating plugin: ${pluginId}`);

    const entry = this.plugins.get(pluginId);
    if (!entry) {
      throw new PluginError(pluginId, 'Plugin not found');
    }

    if (entry.activated) {
  this.logger.warning(`Plugin already activated: ${pluginId}`);
      return;
    }

    try {
      // Call plugin activate hook
      if (entry.plugin.activate) {
        await entry.plugin.activate();
      }

      // Activate sub-components
      if (entry.plugin.taskProcessor?.activate) {
        await entry.plugin.taskProcessor.activate();
      }
      if (entry.plugin.promptGenerator?.activate) {
        await entry.plugin.promptGenerator.activate();
      }
      if (entry.plugin.completionDetector?.activate) {
        await entry.plugin.completionDetector.activate();
      }

      // Mark as activated
      entry.activated = true;
      entry.activatedAt = new Date();

      this.logger.info(`Plugin activated: ${pluginId}`);
      this.emit(PluginRegistryEvent.PLUGIN_ACTIVATED, pluginId, entry.plugin);
    } catch (error) {
      const pluginError = new PluginError(pluginId, `Activation failed: ${error}`, error as Error);
      this.logger.error(`Failed to activate plugin ${pluginId}: ${error}`);
      this.emit(PluginRegistryEvent.PLUGIN_ERROR, pluginError);
      throw pluginError;
    }
  }

  /**
   * Deactivates a plugin
   * @param pluginId Plugin ID
   */
  async deactivatePlugin(pluginId: string): Promise<void> {
    this.logger.info(`Deactivating plugin: ${pluginId}`);

    const entry = this.plugins.get(pluginId);
    if (!entry) {
      throw new PluginError(pluginId, 'Plugin not found');
    }

    if (!entry.activated) {
  this.logger.warning(`Plugin not activated: ${pluginId}`);
      return;
    }

    try {
      // Deactivate sub-components
      if (entry.plugin.completionDetector?.deactivate) {
        await entry.plugin.completionDetector.deactivate();
      }
      if (entry.plugin.promptGenerator?.deactivate) {
        await entry.plugin.promptGenerator.deactivate();
      }
      if (entry.plugin.taskProcessor?.deactivate) {
        await entry.plugin.taskProcessor.deactivate();
      }

      // Call plugin deactivate hook
      if (entry.plugin.deactivate) {
        await entry.plugin.deactivate();
      }

      // Mark as deactivated
      entry.activated = false;
      entry.activatedAt = undefined;

      this.logger.info(`Plugin deactivated: ${pluginId}`);
      this.emit(PluginRegistryEvent.PLUGIN_DEACTIVATED, pluginId, entry.plugin);
    } catch (error) {
      const pluginError = new PluginError(pluginId, `Deactivation failed: ${error}`, error as Error);
      this.logger.error(`Failed to deactivate plugin ${pluginId}: ${error}`);
      this.emit(PluginRegistryEvent.PLUGIN_ERROR, pluginError);
      throw pluginError;
    }
  }

  /**
   * Gets a plugin by ID
   * @param pluginId Plugin ID
   * @returns Plugin or undefined
   */
  getPlugin(pluginId: string): Plugin | undefined {
    return this.plugins.get(pluginId)?.plugin;
  }

  /**
   * Gets all registered plugins
   * @returns Array of plugins
   */
  getAllPlugins(): Plugin[] {
    return Array.from(this.plugins.values()).map((entry) => entry.plugin);
  }

  /**
   * Gets all activated plugins
   * @returns Array of plugins
   */
  getActivatedPlugins(): Plugin[] {
    return Array.from(this.plugins.values())
      .filter((entry) => entry.activated)
      .map((entry) => entry.plugin);
  }

  /**
   * Gets plugins by capability
   * @param capability Capability name
   * @returns Array of plugins
   */
  getPluginsByCapability(capability: keyof Plugin['capabilities']): Plugin[] {
    return this.getActivatedPlugins().filter((plugin) => plugin.capabilities[capability]);
  }

  /**
   * Gets all task processors
   * @returns Array of task processors
   */
  getTaskProcessors(): TaskProcessor[] {
    return this.getActivatedPlugins()
      .filter((plugin) => plugin.taskProcessor)
      .map((plugin) => plugin.taskProcessor!)
      .sort((a, b) => {
        const priorityA = this.plugins.get(a.metadata.id)?.config.priority ?? 0;
        const priorityB = this.plugins.get(b.metadata.id)?.config.priority ?? 0;
        return priorityB - priorityA; // Higher priority first
      });
  }

  /**
   * Gets all prompt generators
   * @returns Array of prompt generators
   */
  getPromptGenerators(): PromptGenerator[] {
    return this.getActivatedPlugins()
      .filter((plugin) => plugin.promptGenerator)
      .map((plugin) => plugin.promptGenerator!)
      .sort((a, b) => {
        const priorityA = this.plugins.get(a.metadata.id)?.config.priority ?? 0;
        const priorityB = this.plugins.get(b.metadata.id)?.config.priority ?? 0;
        return priorityB - priorityA;
      });
  }

  /**
   * Gets all completion detectors
   * @returns Array of completion detectors
   */
  getCompletionDetectors(): CompletionDetector[] {
    return this.getActivatedPlugins()
      .filter((plugin) => plugin.completionDetector)
      .map((plugin) => plugin.completionDetector!)
      .sort((a, b) => {
        const priorityA = this.plugins.get(a.metadata.id)?.config.priority ?? 0;
        const priorityB = this.plugins.get(b.metadata.id)?.config.priority ?? 0;
        return priorityB - priorityA;
      });
  }

  /**
   * Checks if a plugin is registered
   * @param pluginId Plugin ID
   * @returns True if registered
   */
  isPluginRegistered(pluginId: string): boolean {
    return this.plugins.has(pluginId);
  }

  /**
   * Checks if a plugin is activated
   * @param pluginId Plugin ID
   * @returns True if activated
   */
  isPluginActivated(pluginId: string): boolean {
    return this.plugins.get(pluginId)?.activated ?? false;
  }

  /**
   * Gets plugin configuration
   * @param pluginId Plugin ID
   * @returns Plugin configuration or undefined
   */
  getPluginConfiguration(pluginId: string): PluginConfiguration | undefined {
    return this.plugins.get(pluginId)?.config;
  }

  /**
   * Updates plugin configuration
   * @param pluginId Plugin ID
   * @param config Partial configuration to update
   */
  async updatePluginConfiguration(
    pluginId: string,
    config: Partial<PluginConfiguration>
  ): Promise<void> {
    this.logger.info(`Updating configuration for plugin: ${pluginId}`);

    const entry = this.plugins.get(pluginId);
    if (!entry) {
      throw new PluginError(pluginId, 'Plugin not found');
    }

    // Update configuration
    entry.config = { ...entry.config, ...config };

    // Handle enabled state change
    if (config.enabled !== undefined) {
      if (config.enabled && !entry.activated) {
        await this.activatePlugin(pluginId);
      } else if (!config.enabled && entry.activated) {
        await this.deactivatePlugin(pluginId);
      }
    }

    // Notify plugin of configuration change
    try {
      if (entry.plugin.onConfigurationChanged) {
        await entry.plugin.onConfigurationChanged(entry.config.config);
      }
    } catch (error) {
      this.logger.error(`Plugin ${pluginId} failed to handle configuration change: ${error}`);
    }

    this.emit(PluginRegistryEvent.PLUGIN_CONFIG_CHANGED, pluginId, entry.config);
  }

  /**
   * Discovers plugins in the workspace
   * @param options Discovery options
   * @returns Array of discovered plugin file paths
   */
  async discoverPlugins(options?: Partial<PluginDiscoveryOptions>): Promise<string[]> {
    const opts = { ...DEFAULT_DISCOVERY_OPTIONS, ...options };
    const discoveredPaths: string[] = [];

    this.logger.info('Discovering plugins...');

    for (const searchPath of opts.searchPaths) {
      const fullPath = path.isAbsolute(searchPath)
        ? searchPath
        : path.join(this.workspaceRoot, searchPath);

      if (!fs.existsSync(fullPath)) {
        this.logger.debug(`Plugin search path does not exist: ${fullPath}`);
        continue;
      }

      const paths = await this.searchDirectory(fullPath, opts.filePatterns, opts.recursive, opts.maxDepth);
      discoveredPaths.push(...paths);
    }

    this.logger.info(`Discovered ${discoveredPaths.length} plugin files`);
    return discoveredPaths;
  }

  /**
   * Loads plugins from discovered paths
   * @param pluginPaths Array of plugin file paths
   * @returns Array of loaded plugin IDs
   */
  async loadPlugins(pluginPaths: string[]): Promise<string[]> {
    const loadedPluginIds: string[] = [];

    for (const pluginPath of pluginPaths) {
      try {
        this.logger.info(`Loading plugin from: ${pluginPath}`);
        const plugin = await this.loadPluginFromFile(pluginPath);
        const pluginId = await this.registerPlugin(plugin);
        loadedPluginIds.push(pluginId);

        // Store file path in entry
        const entry = this.plugins.get(pluginId);
        if (entry) {
          entry.filePath = pluginPath;
        }
      } catch (error) {
        this.logger.error(`Failed to load plugin from ${pluginPath}: ${error}`);
      }
    }

    return loadedPluginIds;
  }

  /**
   * Loads a plugin from a file
   * @param filePath Path to plugin file
   * @returns Loaded plugin
   */
  private async loadPluginFromFile(filePath: string): Promise<Plugin> {
    try {
      // Dynamic import
      const module = await import(filePath);

      // Look for plugin factory or plugin instance
      let plugin: Plugin;

      if (typeof module.default === 'function') {
        // Factory function
        plugin = await (module.default as PluginFactory)();
      } else if (module.default && typeof module.default === 'object') {
        // Plugin instance
        plugin = module.default as Plugin;
      } else if (typeof module.createPlugin === 'function') {
        // Named factory function
        plugin = await module.createPlugin();
      } else {
        throw new Error('Plugin file must export a plugin instance or factory function');
      }

      return plugin;
    } catch (error) {
      throw new Error(`Failed to load plugin from ${filePath}: ${error}`);
    }
  }

  /**
   * Searches a directory for plugin files
   * @param dirPath Directory path
   * @param patterns File patterns to match
   * @param recursive Whether to search recursively
   * @param maxDepth Maximum depth
   * @param currentDepth Current depth
   * @returns Array of matching file paths
   */
  private async searchDirectory(
    dirPath: string,
    patterns: string[],
    recursive: boolean,
    maxDepth: number = 3,
    currentDepth: number = 0
  ): Promise<string[]> {
    const results: string[] = [];

    if (currentDepth >= maxDepth) {
      return results;
    }

    try {
      const entries = fs.readdirSync(dirPath, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = path.join(dirPath, entry.name);

        if (entry.isDirectory() && recursive) {
          const subResults = await this.searchDirectory(
            fullPath,
            patterns,
            recursive,
            maxDepth,
            currentDepth + 1
          );
          results.push(...subResults);
        } else if (entry.isFile()) {
          // Check if file matches any pattern
          const matches = patterns.some((pattern) => {
            const regex = new RegExp(pattern.replace(/\*/g, '.*').replace(/\?/g, '.'));
            return regex.test(entry.name);
          });

          if (matches) {
            results.push(fullPath);
          }
        }
      }
    } catch (error) {
      this.logger.error(`Error searching directory ${dirPath}: ${error}`);
    }

    return results;
  }

  /**
   * Validates a plugin
   * @param plugin Plugin to validate
   * @returns Validation result
   */
  private validatePlugin(plugin: Plugin): PluginValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Validate metadata
    if (!plugin.metadata) {
      errors.push('Plugin metadata is missing');
    } else {
      if (!plugin.metadata.id || plugin.metadata.id.trim() === '') {
        errors.push('Plugin ID is required');
      }
      if (!plugin.metadata.name || plugin.metadata.name.trim() === '') {
        errors.push('Plugin name is required');
      }
      if (!plugin.metadata.version || plugin.metadata.version.trim() === '') {
        errors.push('Plugin version is required');
      }
    }

    // Validate capabilities
    if (!plugin.capabilities) {
      errors.push('Plugin capabilities are missing');
    } else {
      const hasAnyCapability = Object.values(plugin.capabilities).some((v) => v === true);
      if (!hasAnyCapability) {
        warnings.push('Plugin has no capabilities enabled');
      }

      // Validate capability implementations
      if (plugin.capabilities.taskProcessor && !plugin.taskProcessor) {
        errors.push('Plugin claims taskProcessor capability but does not provide implementation');
      }
      if (plugin.capabilities.promptGenerator && !plugin.promptGenerator) {
        errors.push('Plugin claims promptGenerator capability but does not provide implementation');
      }
      if (plugin.capabilities.completionDetector && !plugin.completionDetector) {
        errors.push('Plugin claims completionDetector capability but does not provide implementation');
      }
    }

    // Validate task processor
    if (plugin.taskProcessor) {
      if (!plugin.taskProcessor.metadata) {
        errors.push('TaskProcessor metadata is missing');
      }
      const hasAnyMethod =
        plugin.taskProcessor.preProcess ||
        plugin.taskProcessor.process ||
        plugin.taskProcessor.postProcess;
      if (!hasAnyMethod) {
        warnings.push('TaskProcessor has no processing methods implemented');
      }
    }

    // Validate prompt generator
    if (plugin.promptGenerator) {
      if (!plugin.promptGenerator.metadata) {
        errors.push('PromptGenerator metadata is missing');
      }
      if (!plugin.promptGenerator.generatePrompt) {
        errors.push('PromptGenerator must implement generatePrompt method');
      }
    }

    // Validate completion detector
    if (plugin.completionDetector) {
      if (!plugin.completionDetector.metadata) {
        errors.push('CompletionDetector metadata is missing');
      }
      if (!plugin.completionDetector.detectCompletion) {
        errors.push('CompletionDetector must implement detectCompletion method');
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    };
  }

  /**
   * Checks plugin dependencies
   * @param plugin Plugin to check
   */
  private async checkDependencies(plugin: Plugin): Promise<void> {
    if (!plugin.metadata.dependencies || plugin.metadata.dependencies.length === 0) {
      return;
    }

    const missingDependencies: string[] = [];

    for (const depId of plugin.metadata.dependencies) {
      if (!this.isPluginRegistered(depId)) {
        missingDependencies.push(depId);
      }
    }

    if (missingDependencies.length > 0) {
      throw new PluginError(
        plugin.metadata.id,
        `Missing dependencies: ${missingDependencies.join(', ')}`
      );
    }
  }

  /**
   * Gets plugin metadata
   * @param pluginId Plugin ID
   * @returns Plugin metadata or undefined
   */
  getPluginMetadata(pluginId: string): PluginMetadata | undefined {
    return this.plugins.get(pluginId)?.plugin.metadata;
  }

  /**
   * Gets all plugin metadata
   * @returns Array of plugin metadata
   */
  getAllPluginMetadata(): PluginMetadata[] {
    return Array.from(this.plugins.values()).map((entry) => entry.plugin.metadata);
  }

  /**
   * Gets plugin statistics
   * @returns Plugin statistics
   */
  getStatistics(): {
    total: number;
    activated: number;
    deactivated: number;
    byCapability: Record<string, number>;
  } {
    const total = this.plugins.size;
    const activated = Array.from(this.plugins.values()).filter((e) => e.activated).length;
    const deactivated = total - activated;

    const byCapability: Record<string, number> = {};
    for (const entry of this.plugins.values()) {
      for (const [capability, enabled] of Object.entries(entry.plugin.capabilities)) {
        if (enabled) {
          byCapability[capability] = (byCapability[capability] || 0) + 1;
        }
      }
    }

    return {
      total,
      activated,
      deactivated,
      byCapability,
    };
  }

  /**
   * Disposes of all plugins and resources
   */
  async dispose(): Promise<void> {
    this.logger.info('Disposing PluginRegistry...');

    // Deactivate and unregister all plugins
    const pluginIds = Array.from(this.plugins.keys());
    for (const pluginId of pluginIds) {
      try {
        await this.unregisterPlugin(pluginId);
      } catch (error) {
        this.logger.error(`Error unregistering plugin ${pluginId}: ${error}`);
      }
    }

    // Dispose of disposables
    this.disposables.forEach((d) => d.dispose());
    this.disposables = [];

    // Clear plugins
    this.plugins.clear();

    // Remove all listeners
    this.removeAllListeners();

    this.logger.info('PluginRegistry disposed');
  }
}
