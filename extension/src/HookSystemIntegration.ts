import * as vscode from 'vscode';
import { Task } from './models/Task';
import { Logger } from './Logger';

/**
 * Hook execution context
 */
export interface HookContext {
  /** Task being executed */
  task: Task;

  /** Workspace URI */
  workspaceUri: string;

  /** Spec name */
  specName: string;

  /** Additional metadata */
  metadata?: Record<string, any>;
}

/**
 * Hook execution result
 */
export interface HookResult {
  /** Whether hook execution was successful */
  success: boolean;

  /** Result data from hook */
  data?: any;

  /** Error message if failed */
  error?: string;

  /** Whether to continue execution */
  continue: boolean;
}

/**
 * Hook handler function type
 */
export type HookHandler = (context: HookContext) => Promise<HookResult>;

/**
 * Hook registration
 */
export interface HookRegistration {
  /** Hook name */
  name: string;

  /** Hook type */
  type: 'pre-task' | 'post-task' | 'pre-session' | 'post-session' | 'on-error';

  /** Handler function */
  handler: HookHandler;

  /** Priority (higher runs first) */
  priority: number;

  /** Whether hook is enabled */
  enabled: boolean;
}

/**
 * Kiro hook system API
 */
export interface KiroHookSystemAPI {
  /** Register a hook */
  registerHook?(name: string, handler: Function): vscode.Disposable;

  /** Trigger a hook */
  triggerHook?(name: string, context: any): Promise<any>;

  /** Check if hook system is available */
  isAvailable?(): boolean;
}

/**
 * Hook System Integration
 * Integrates with Kiro's hook system and provides custom hook support
 */
export class HookSystemIntegration {
  private logger: Logger;
  private hooks: Map<string, HookRegistration[]> = new Map();
  private kiroHookAPI?: KiroHookSystemAPI;
  private isIntegrated: boolean = false;
  private disposables: vscode.Disposable[] = [];

  constructor(logger: Logger) {
    this.logger = logger;
  }

  /**
   * Initializes hook system integration
   * @returns Whether integration was successful
   */
  async initialize(): Promise<boolean> {
    try {
      this.logger.info('Initializing hook system integration', {
        component: 'HookSystemIntegration',
      });

      // Discover Kiro's hook system
      const discovered = await this.discoverKiroHookSystem();

      if (discovered) {
        this.isIntegrated = true;
        this.logger.info('Successfully integrated with Kiro hook system', {
          component: 'HookSystemIntegration',
        });
      } else {
        this.logger.info('Kiro hook system not available, using standalone mode', {
          component: 'HookSystemIntegration',
        });
      }

      // Register default hooks
      this.registerDefaultHooks();

      return true;
    } catch (error) {
      this.logger.error('Failed to initialize hook system integration', {
        component: 'HookSystemIntegration',
        error: (error as Error).message,
      });
      return false;
    }
  }

  /**
   * Registers a hook
   * @param registration Hook registration
   * @returns Disposable to unregister
   */
  registerHook(registration: HookRegistration): vscode.Disposable {
    const { type, name } = registration;

    if (!this.hooks.has(type)) {
      this.hooks.set(type, []);
    }

    const hooks = this.hooks.get(type)!;
    hooks.push(registration);

    // Sort by priority (higher first)
    hooks.sort((a, b) => b.priority - a.priority);

    this.logger.debug('Registered hook', {
      component: 'HookSystemIntegration',
      name,
      type,
      priority: registration.priority,
    });

    // Register with Kiro if integrated
    if (this.isIntegrated && this.kiroHookAPI?.registerHook) {
      const kiroDisposable = this.kiroHookAPI.registerHook(name, registration.handler);
      this.disposables.push(kiroDisposable);
    }

    return new vscode.Disposable(() => {
      const index = hooks.indexOf(registration);
      if (index > -1) {
        hooks.splice(index, 1);
      }
    });
  }

  /**
   * Executes pre-task hooks
   * @param context Hook context
   * @returns Whether to continue execution
   */
  async executePreTaskHooks(context: HookContext): Promise<boolean> {
    return await this.executeHooks('pre-task', context);
  }

  /**
   * Executes post-task hooks
   * @param context Hook context
   * @returns Whether execution was successful
   */
  async executePostTaskHooks(context: HookContext): Promise<boolean> {
    return await this.executeHooks('post-task', context);
  }

  /**
   * Executes pre-session hooks
   * @param context Hook context
   * @returns Whether to continue execution
   */
  async executePreSessionHooks(context: HookContext): Promise<boolean> {
    return await this.executeHooks('pre-session', context);
  }

  /**
   * Executes post-session hooks
   * @param context Hook context
   * @returns Whether execution was successful
   */
  async executePostSessionHooks(context: HookContext): Promise<boolean> {
    return await this.executeHooks('post-session', context);
  }

  /**
   * Executes error hooks
   * @param context Hook context
   * @returns Whether to continue execution
   */
  async executeErrorHooks(context: HookContext): Promise<boolean> {
    return await this.executeHooks('on-error', context);
  }

  /**
   * Executes hooks of a specific type
   * @param type Hook type
   * @param context Hook context
   * @returns Whether to continue execution
   */
  private async executeHooks(
    type: 'pre-task' | 'post-task' | 'pre-session' | 'post-session' | 'on-error',
    context: HookContext
  ): Promise<boolean> {
    const hooks = this.hooks.get(type) || [];
    const enabledHooks = hooks.filter((h) => h.enabled);

    if (enabledHooks.length === 0) {
      return true;
    }

    this.logger.debug(`Executing ${type} hooks`, {
      component: 'HookSystemIntegration',
      hookCount: enabledHooks.length,
      taskId: context.task.id,
    });

    for (const hook of enabledHooks) {
      try {
        const result = await hook.handler(context);

        if (!result.success) {
          this.logger.warning(`Hook ${hook.name} failed`, {
            component: 'HookSystemIntegration',
            hookName: hook.name,
            error: result.error,
          });
        }

        if (!result.continue) {
          this.logger.info(`Hook ${hook.name} requested to stop execution`, {
            component: 'HookSystemIntegration',
            hookName: hook.name,
          });
          return false;
        }
      } catch (error) {
        this.logger.error(`Error executing hook ${hook.name}`, {
          component: 'HookSystemIntegration',
          hookName: hook.name,
          error: (error as Error).message,
        });

        // Continue with other hooks even if one fails
      }
    }

    return true;
  }

  /**
   * Discovers Kiro's hook system
   * @returns Whether discovery was successful
   */
  private async discoverKiroHookSystem(): Promise<boolean> {
    try {
      // Try to get Kiro extension
      const kiroExtension = vscode.extensions.getExtension('kiro.kiro');

      if (!kiroExtension) {
        return false;
      }

      // Activate if not already active
      if (!kiroExtension.isActive) {
        await kiroExtension.activate();
      }

      // Check if hook system API is exposed
      const api = kiroExtension.exports;

      if (api && api.hooks) {
        this.kiroHookAPI = api.hooks as KiroHookSystemAPI;
        this.logger.info('Discovered Kiro hook system API', {
          component: 'HookSystemIntegration',
        });
        return true;
      }

      return false;
    } catch (error) {
      this.logger.error('Error discovering Kiro hook system', {
        component: 'HookSystemIntegration',
        error: (error as Error).message,
      });
      return false;
    }
  }

  /**
   * Registers default hooks
   */
  private registerDefaultHooks(): void {
    // Pre-task validation hook
    this.registerHook({
      name: 'validate-task',
      type: 'pre-task',
      priority: 100,
      enabled: true,
      handler: async (context: HookContext): Promise<HookResult> => {
        // Validate task has required fields
        if (!context.task.id || !context.task.title) {
          return {
            success: false,
            error: 'Task missing required fields',
            continue: false,
          };
        }

        return {
          success: true,
          continue: true,
        };
      },
    });

    // Post-task logging hook
    this.registerHook({
      name: 'log-task-completion',
      type: 'post-task',
      priority: 50,
      enabled: true,
      handler: async (context: HookContext): Promise<HookResult> => {
        this.logger.info(`Task completed: ${context.task.title}`, {
          component: 'HookSystemIntegration',
          taskId: context.task.id,
          specName: context.specName,
        });

        return {
          success: true,
          continue: true,
        };
      },
    });

    // Error notification hook
    this.registerHook({
      name: 'notify-on-error',
      type: 'on-error',
      priority: 100,
      enabled: true,
      handler: async (context: HookContext): Promise<HookResult> => {
        const errorMessage = context.metadata?.error || 'Unknown error';

        vscode.window.showErrorMessage(
          `Task failed: ${context.task.title} - ${errorMessage}`
        );

        return {
          success: true,
          continue: true,
        };
      },
    });
  }

  /**
   * Gets all registered hooks
   * @returns Map of hook type to registrations
   */
  getRegisteredHooks(): Map<string, HookRegistration[]> {
    return new Map(this.hooks);
  }

  /**
   * Enables a hook by name
   * @param name Hook name
   */
  enableHook(name: string): void {
    for (const hooks of this.hooks.values()) {
      const hook = hooks.find((h) => h.name === name);
      if (hook) {
        hook.enabled = true;
        this.logger.debug(`Enabled hook: ${name}`, {
          component: 'HookSystemIntegration',
        });
      }
    }
  }

  /**
   * Disables a hook by name
   * @param name Hook name
   */
  disableHook(name: string): void {
    for (const hooks of this.hooks.values()) {
      const hook = hooks.find((h) => h.name === name);
      if (hook) {
        hook.enabled = false;
        this.logger.debug(`Disabled hook: ${name}`, {
          component: 'HookSystemIntegration',
        });
      }
    }
  }

  /**
   * Checks if hook system is integrated with Kiro
   * @returns Whether integrated
   */
  isKiroIntegrated(): boolean {
    return this.isIntegrated;
  }

  /**
   * Disposes of resources
   */
  dispose(): void {
    this.disposables.forEach((d) => d.dispose());
    this.disposables = [];
    this.hooks.clear();
  }
}
