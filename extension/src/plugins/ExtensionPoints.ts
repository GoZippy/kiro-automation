import * as vscode from 'vscode';
import { EventEmitter } from 'events';
import { Logger } from '../Logger';
import { Task } from '../models/Task';
import { ExecutionContext } from '../models/ExecutionContext';

/**
 * Extension point types
 */
export enum ExtensionPointType {
  /** UI customization hooks */
  UI_CUSTOMIZATION = 'ui_customization',

  /** Task execution hooks */
  TASK_EXECUTION = 'task_execution',

  /** Automation lifecycle hooks */
  AUTOMATION_LIFECYCLE = 'automation_lifecycle',

  /** Configuration hooks */
  CONFIGURATION = 'configuration',

  /** Custom view registration */
  CUSTOM_VIEW = 'custom_view',

  /** Command registration */
  COMMAND = 'command',

  /** Event subscription */
  EVENT = 'event',
}

/**
 * Extension point context
 */
export interface ExtensionPointContext {
  /** Extension context */
  extensionContext: vscode.ExtensionContext;

  /** Current task (if applicable) */
  task?: Task;

  /** Execution context (if applicable) */
  execution?: ExecutionContext;

  /** Custom data */
  customData?: Record<string, any>;
}

/**
 * Extension point handler
 */
export type ExtensionPointHandler<T = any> = (
  context: ExtensionPointContext,
  data?: T
) => Promise<void> | void;

/**
 * Extension point definition
 */
export interface ExtensionPoint {
  /** Extension point ID */
  id: string;

  /** Extension point type */
  type: ExtensionPointType;

  /** Extension point name */
  name: string;

  /** Extension point description */
  description?: string;

  /** Plugin ID that registered this extension point */
  pluginId: string;

  /** Handler function */
  handler: ExtensionPointHandler;

  /** Priority (higher = runs first) */
  priority?: number;

  /** Whether this extension point is enabled */
  enabled: boolean;
}

/**
 * UI customization options
 */
export interface UICustomizationOptions {
  /** Custom status bar items */
  statusBarItems?: Array<{
    id: string;
    text: string;
    tooltip?: string;
    command?: string;
    alignment?: vscode.StatusBarAlignment;
    priority?: number;
  }>;

  /** Custom tree view providers */
  treeViewProviders?: Array<{
    id: string;
    name: string;
    provider: vscode.TreeDataProvider<any>;
  }>;

  /** Custom webview panels */
  webviewPanels?: Array<{
    id: string;
    title: string;
    viewColumn?: vscode.ViewColumn;
    options?: vscode.WebviewPanelOptions & vscode.WebviewOptions;
    htmlProvider: () => string;
  }>;

  /** Custom context menu items */
  contextMenuItems?: Array<{
    id: string;
    label: string;
    command: string;
    when?: string;
  }>;
}

/**
 * Custom view registration
 */
export interface CustomViewRegistration {
  /** View ID */
  viewId: string;

  /** View name */
  viewName: string;

  /** View container (e.g., 'explorer', 'scm', 'debug') */
  viewContainer?: string;

  /** Tree data provider */
  treeDataProvider?: vscode.TreeDataProvider<any>;

  /** Webview provider */
  webviewProvider?: vscode.WebviewViewProvider;

  /** View options */
  options?: {
    canSelectMany?: boolean;
    showCollapseAll?: boolean;
    treeDataProvider?: vscode.TreeDataProvider<any>;
  };
}

/**
 * Command registration
 */
export interface CommandRegistration {
  /** Command ID */
  commandId: string;

  /** Command title */
  title: string;

  /** Command handler */
  handler: (...args: any[]) => any;

  /** Command category */
  category?: string;

  /** When clause */
  when?: string;
}

/**
 * Event subscription
 */
export interface EventSubscription {
  /** Event name */
  eventName: string;

  /** Event handler */
  handler: (...args: any[]) => void;

  /** Event filter */
  filter?: (data: any) => boolean;
}

/**
 * ExtensionPointManager class
 * Manages extension points and plugin integrations
 */
export class ExtensionPointManager extends EventEmitter {
  private extensionPoints: Map<string, ExtensionPoint> = new Map();
  private logger: Logger;
  private extensionContext: vscode.ExtensionContext;
  private disposables: Map<string, vscode.Disposable> = new Map();
  private customViews: Map<string, CustomViewRegistration> = new Map();
  private commands: Map<string, CommandRegistration> = new Map();
  private eventSubscriptions: Map<string, EventSubscription[]> = new Map();

  constructor(extensionContext: vscode.ExtensionContext) {
    super();
    this.logger = Logger.getInstance();
    this.extensionContext = extensionContext;
  }

  /**
   * Registers an extension point
   * @param extensionPoint Extension point to register
   * @returns Extension point ID
   */
  registerExtensionPoint(extensionPoint: ExtensionPoint): string {
    this.logger.info(`Registering extension point: ${extensionPoint.id} (${extensionPoint.type})`);

    if (this.extensionPoints.has(extensionPoint.id)) {
      throw new Error(`Extension point already registered: ${extensionPoint.id}`);
    }

    this.extensionPoints.set(extensionPoint.id, extensionPoint);

    this.logger.info(`Extension point registered: ${extensionPoint.id}`);
    this.emit('extensionPointRegistered', extensionPoint);

    return extensionPoint.id;
  }

  /**
   * Unregisters an extension point
   * @param extensionPointId Extension point ID
   */
  unregisterExtensionPoint(extensionPointId: string): void {
    this.logger.info(`Unregistering extension point: ${extensionPointId}`);

    const extensionPoint = this.extensionPoints.get(extensionPointId);
    if (!extensionPoint) {
      throw new Error(`Extension point not found: ${extensionPointId}`);
    }

    this.extensionPoints.delete(extensionPointId);

    this.logger.info(`Extension point unregistered: ${extensionPointId}`);
    this.emit('extensionPointUnregistered', extensionPointId);
  }

  /**
   * Executes extension points of a specific type
   * @param type Extension point type
   * @param context Extension point context
   * @param data Optional data to pass to handlers
   */
  async executeExtensionPoints<T = any>(
    type: ExtensionPointType,
    context: ExtensionPointContext,
    data?: T
  ): Promise<void> {
    const points = this.getExtensionPointsByType(type);

    // Sort by priority (higher first)
    points.sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0));

    for (const point of points) {
      if (!point.enabled) {
        continue;
      }

      try {
        this.logger.debug(`Executing extension point: ${point.id}`);
        await point.handler(context, data);
      } catch (error) {
        this.logger.error(`Error executing extension point ${point.id}: ${error}`);
        this.emit('extensionPointError', point.id, error);
      }
    }
  }

  /**
   * Gets extension points by type
   * @param type Extension point type
   * @returns Array of extension points
   */
  getExtensionPointsByType(type: ExtensionPointType): ExtensionPoint[] {
    return Array.from(this.extensionPoints.values()).filter((point) => point.type === type);
  }

  /**
   * Gets extension points by plugin
   * @param pluginId Plugin ID
   * @returns Array of extension points
   */
  getExtensionPointsByPlugin(pluginId: string): ExtensionPoint[] {
    return Array.from(this.extensionPoints.values()).filter((point) => point.pluginId === pluginId);
  }

  /**
   * Registers UI customizations
   * @param pluginId Plugin ID
   * @param options UI customization options
   */
  registerUICustomizations(pluginId: string, options: UICustomizationOptions): void {
    this.logger.info(`Registering UI customizations for plugin: ${pluginId}`);

    // Register status bar items
    if (options.statusBarItems) {
      for (const item of options.statusBarItems) {
        const statusBarItem = vscode.window.createStatusBarItem(
          item.alignment ?? vscode.StatusBarAlignment.Left,
          item.priority
        );
        statusBarItem.text = item.text;
        if (item.tooltip) {
          statusBarItem.tooltip = item.tooltip;
        }
        if (item.command) {
          statusBarItem.command = item.command;
        }
        statusBarItem.show();

        this.disposables.set(`${pluginId}.statusBar.${item.id}`, statusBarItem);
      }
    }

    // Register tree view providers
    if (options.treeViewProviders) {
      for (const treeView of options.treeViewProviders) {
        const view = vscode.window.createTreeView(treeView.id, {
          treeDataProvider: treeView.provider,
        });

        this.disposables.set(`${pluginId}.treeView.${treeView.id}`, view);
      }
    }

    // Register webview panels
    if (options.webviewPanels) {
      for (const panel of options.webviewPanels) {
        const webviewPanel = vscode.window.createWebviewPanel(
          panel.id,
          panel.title,
          panel.viewColumn ?? vscode.ViewColumn.One,
          panel.options
        );
        webviewPanel.webview.html = panel.htmlProvider();

        this.disposables.set(`${pluginId}.webview.${panel.id}`, webviewPanel);
      }
    }

    this.logger.info(`UI customizations registered for plugin: ${pluginId}`);
  }

  /**
   * Registers a custom view
   * @param pluginId Plugin ID
   * @param viewRegistration View registration
   */
  registerCustomView(pluginId: string, viewRegistration: CustomViewRegistration): void {
    this.logger.info(`Registering custom view: ${viewRegistration.viewId} for plugin: ${pluginId}`);

    if (this.customViews.has(viewRegistration.viewId)) {
      throw new Error(`Custom view already registered: ${viewRegistration.viewId}`);
    }

    this.customViews.set(viewRegistration.viewId, viewRegistration);

    // Register tree view if provider is available
    if (viewRegistration.treeDataProvider) {
      const view = vscode.window.createTreeView(viewRegistration.viewId, {
        treeDataProvider: viewRegistration.treeDataProvider,
        ...viewRegistration.options,
      });

      this.disposables.set(`${pluginId}.customView.${viewRegistration.viewId}`, view);
    }

    // Register webview view if provider is available
    if (viewRegistration.webviewProvider) {
      const disposable = vscode.window.registerWebviewViewProvider(
        viewRegistration.viewId,
        viewRegistration.webviewProvider
      );

      this.disposables.set(`${pluginId}.customWebviewView.${viewRegistration.viewId}`, disposable);
    }

    this.logger.info(`Custom view registered: ${viewRegistration.viewId}`);
    this.emit('customViewRegistered', viewRegistration);
  }

  /**
   * Unregisters a custom view
   * @param viewId View ID
   */
  unregisterCustomView(viewId: string): void {
    this.logger.info(`Unregistering custom view: ${viewId}`);

    const view = this.customViews.get(viewId);
    if (!view) {
      throw new Error(`Custom view not found: ${viewId}`);
    }

    this.customViews.delete(viewId);

    // Dispose associated resources
    const keys = Array.from(this.disposables.keys()).filter((key) => key.includes(viewId));
    for (const key of keys) {
      const disposable = this.disposables.get(key);
      if (disposable) {
        disposable.dispose();
        this.disposables.delete(key);
      }
    }

    this.logger.info(`Custom view unregistered: ${viewId}`);
    this.emit('customViewUnregistered', viewId);
  }

  /**
   * Registers a command
   * @param pluginId Plugin ID
   * @param commandRegistration Command registration
   */
  registerCommand(pluginId: string, commandRegistration: CommandRegistration): void {
    this.logger.info(`Registering command: ${commandRegistration.commandId} for plugin: ${pluginId}`);

    if (this.commands.has(commandRegistration.commandId)) {
      throw new Error(`Command already registered: ${commandRegistration.commandId}`);
    }

    this.commands.set(commandRegistration.commandId, commandRegistration);

    // Register command with VS Code
    const disposable = vscode.commands.registerCommand(
      commandRegistration.commandId,
      commandRegistration.handler
    );

    this.disposables.set(`${pluginId}.command.${commandRegistration.commandId}`, disposable);
    this.extensionContext.subscriptions.push(disposable);

    this.logger.info(`Command registered: ${commandRegistration.commandId}`);
    this.emit('commandRegistered', commandRegistration);
  }

  /**
   * Unregisters a command
   * @param commandId Command ID
   */
  unregisterCommand(commandId: string): void {
    this.logger.info(`Unregistering command: ${commandId}`);

    const command = this.commands.get(commandId);
    if (!command) {
      throw new Error(`Command not found: ${commandId}`);
    }

    this.commands.delete(commandId);

    // Dispose associated resources
    const keys = Array.from(this.disposables.keys()).filter((key) => key.includes(commandId));
    for (const key of keys) {
      const disposable = this.disposables.get(key);
      if (disposable) {
        disposable.dispose();
        this.disposables.delete(key);
      }
    }

    this.logger.info(`Command unregistered: ${commandId}`);
    this.emit('commandUnregistered', commandId);
  }

  /**
   * Subscribes to an event
   * @param pluginId Plugin ID
   * @param eventSubscription Event subscription
   */
  subscribeToEvent(pluginId: string, eventSubscription: EventSubscription): void {
    this.logger.info(`Subscribing to event: ${eventSubscription.eventName} for plugin: ${pluginId}`);

    if (!this.eventSubscriptions.has(eventSubscription.eventName)) {
      this.eventSubscriptions.set(eventSubscription.eventName, []);
    }

    this.eventSubscriptions.get(eventSubscription.eventName)!.push(eventSubscription);

    this.logger.info(`Event subscription added: ${eventSubscription.eventName}`);
    this.emit('eventSubscribed', eventSubscription);
  }

  /**
   * Unsubscribes from an event
   * @param eventName Event name
   * @param handler Event handler
   */
  unsubscribeFromEvent(eventName: string, handler: (...args: any[]) => void): void {
    this.logger.info(`Unsubscribing from event: ${eventName}`);

    const subscriptions = this.eventSubscriptions.get(eventName);
    if (!subscriptions) {
      return;
    }

    const index = subscriptions.findIndex((sub) => sub.handler === handler);
    if (index !== -1) {
      subscriptions.splice(index, 1);
    }

    if (subscriptions.length === 0) {
      this.eventSubscriptions.delete(eventName);
    }

    this.logger.info(`Event unsubscribed: ${eventName}`);
    this.emit('eventUnsubscribed', eventName);
  }

  /**
   * Emits an event to subscribers
   * @param eventName Event name
   * @param data Event data
   */
  emitEvent(eventName: string, ...data: any[]): void {
    const subscriptions = this.eventSubscriptions.get(eventName);
    if (!subscriptions) {
      return;
    }

    for (const subscription of subscriptions) {
      try {
        // Apply filter if present
        if (subscription.filter && !subscription.filter(data[0])) {
          continue;
        }

        subscription.handler(...data);
      } catch (error) {
        this.logger.error(`Error in event handler for ${eventName}: ${error}`);
      }
    }
  }

  /**
   * Gets all registered custom views
   * @returns Array of custom view registrations
   */
  getCustomViews(): CustomViewRegistration[] {
    return Array.from(this.customViews.values());
  }

  /**
   * Gets all registered commands
   * @returns Array of command registrations
   */
  getCommands(): CommandRegistration[] {
    return Array.from(this.commands.values());
  }

  /**
   * Gets all event subscriptions
   * @returns Map of event subscriptions
   */
  getEventSubscriptions(): Map<string, EventSubscription[]> {
    return new Map(this.eventSubscriptions);
  }

  /**
   * Clears all extension points for a plugin
   * @param pluginId Plugin ID
   */
  clearPluginExtensionPoints(pluginId: string): void {
    this.logger.info(`Clearing extension points for plugin: ${pluginId}`);

    // Remove extension points
    const extensionPoints = this.getExtensionPointsByPlugin(pluginId);
    for (const point of extensionPoints) {
      this.unregisterExtensionPoint(point.id);
    }

    // Dispose plugin resources
    const keys = Array.from(this.disposables.keys()).filter((key) => key.startsWith(`${pluginId}.`));
    for (const key of keys) {
      const disposable = this.disposables.get(key);
      if (disposable) {
        disposable.dispose();
        this.disposables.delete(key);
      }
    }

    this.logger.info(`Extension points cleared for plugin: ${pluginId}`);
  }

  /**
   * Gets statistics about extension points
   * @returns Extension point statistics
   */
  getStatistics(): {
    totalExtensionPoints: number;
    byType: Record<string, number>;
    customViews: number;
    commands: number;
    eventSubscriptions: number;
  } {
    const byType: Record<string, number> = {};

    for (const point of this.extensionPoints.values()) {
      byType[point.type] = (byType[point.type] || 0) + 1;
    }

    return {
      totalExtensionPoints: this.extensionPoints.size,
      byType,
      customViews: this.customViews.size,
      commands: this.commands.size,
      eventSubscriptions: Array.from(this.eventSubscriptions.values()).reduce(
        (sum, subs) => sum + subs.length,
        0
      ),
    };
  }

  /**
   * Disposes of all resources
   */
  dispose(): void {
    this.logger.info('Disposing ExtensionPointManager...');

    // Dispose all disposables
    for (const disposable of this.disposables.values()) {
      disposable.dispose();
    }
    this.disposables.clear();

    // Clear all maps
    this.extensionPoints.clear();
    this.customViews.clear();
    this.commands.clear();
    this.eventSubscriptions.clear();

    // Remove all listeners
    this.removeAllListeners();

    this.logger.info('ExtensionPointManager disposed');
  }
}
