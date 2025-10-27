import { Task, SubTask } from '../models/Task';
import { SpecificationContext, ExecutionContext } from '../models/ExecutionContext';
import { CompletionDetectionResult } from '../CompletionDetector';

/**
 * Plugin metadata
 */
export interface PluginMetadata {
  /** Unique identifier for the plugin */
  id: string;

  /** Display name of the plugin */
  name: string;

  /** Plugin version */
  version: string;

  /** Plugin description */
  description: string;

  /** Plugin author */
  author?: string;

  /** Plugin homepage URL */
  homepage?: string;

  /** Plugin dependencies */
  dependencies?: string[];

  /** Minimum extension version required */
  minExtensionVersion?: string;
}

/**
 * Plugin lifecycle hooks
 */
export interface PluginLifecycle {
  /** Called when the plugin is activated */
  activate?(): Promise<void> | void;

  /** Called when the plugin is deactivated */
  deactivate?(): Promise<void> | void;

  /** Called when the plugin configuration changes */
  onConfigurationChanged?(config: any): Promise<void> | void;
}

/**
 * Task processor context
 */
export interface TaskProcessorContext {
  /** Task being processed */
  task: Task;

  /** Specification context */
  spec: SpecificationContext;

  /** Execution context */
  execution: ExecutionContext;

  /** Custom data that can be passed between processors */
  customData?: Record<string, any>;
}

/**
 * Task processor result
 */
export interface TaskProcessorResult {
  /** Whether processing was successful */
  success: boolean;

  /** Whether to continue to next processor */
  continue: boolean;

  /** Modified task (if any) */
  task?: Task;

  /** Error message (if failed) */
  error?: string;

  /** Custom data to pass to next processor */
  customData?: Record<string, any>;
}

/**
 * TaskProcessor interface
 * Allows custom processing of tasks before, during, or after execution
 */
export interface TaskProcessor extends PluginLifecycle {
  /** Plugin metadata */
  metadata: PluginMetadata;

  /**
   * Processes a task before execution
   * @param context Task processor context
   * @returns Processing result
   */
  preProcess?(context: TaskProcessorContext): Promise<TaskProcessorResult> | TaskProcessorResult;

  /**
   * Processes a task during execution
   * @param context Task processor context
   * @returns Processing result
   */
  process?(context: TaskProcessorContext): Promise<TaskProcessorResult> | TaskProcessorResult;

  /**
   * Processes a task after execution
   * @param context Task processor context
   * @returns Processing result
   */
  postProcess?(context: TaskProcessorContext): Promise<TaskProcessorResult> | TaskProcessorResult;

  /**
   * Handles task failure
   * @param context Task processor context
   * @param error Error that occurred
   * @returns Processing result
   */
  onTaskFailed?(
    context: TaskProcessorContext,
    error: Error
  ): Promise<TaskProcessorResult> | TaskProcessorResult;

  /**
   * Handles task completion
   * @param context Task processor context
   * @returns Processing result
   */
  onTaskCompleted?(context: TaskProcessorContext): Promise<TaskProcessorResult> | TaskProcessorResult;
}

/**
 * Prompt generation context
 */
export interface PromptGenerationContext {
  /** Task to generate prompt for */
  task: Task;

  /** Specification context */
  spec: SpecificationContext;

  /** Execution context */
  execution: ExecutionContext;

  /** Requirements content */
  requirementsContent?: string;

  /** Design content */
  designContent?: string;

  /** Previous prompts for this task */
  previousPrompts?: string[];

  /** Retry count */
  retryCount?: number;

  /** Previous error (if retrying) */
  previousError?: string;

  /** Custom context data */
  customData?: Record<string, any>;
}

/**
 * Prompt generation result
 */
export interface PromptGenerationResult {
  /** Generated prompt */
  prompt: string;

  /** Whether generation was successful */
  success: boolean;

  /** Error message (if failed) */
  error?: string;

  /** Metadata about the generated prompt */
  metadata?: {
    /** Prompt length */
    length: number;

    /** Template used */
    template?: string;

    /** Variables used */
    variables?: Record<string, any>;

    /** Custom metadata */
    [key: string]: any;
  };
}

/**
 * PromptGenerator interface
 * Allows custom prompt generation logic
 */
export interface PromptGenerator extends PluginLifecycle {
  /** Plugin metadata */
  metadata: PluginMetadata;

  /**
   * Generates a prompt for a task
   * @param context Prompt generation context
   * @returns Generated prompt result
   */
  generatePrompt(context: PromptGenerationContext): Promise<PromptGenerationResult> | PromptGenerationResult;

  /**
   * Generates a prompt for a subtask
   * @param context Prompt generation context
   * @param subtask Subtask to generate prompt for
   * @returns Generated prompt result
   */
  generateSubtaskPrompt?(
    context: PromptGenerationContext,
    subtask: SubTask
  ): Promise<PromptGenerationResult> | PromptGenerationResult;

  /**
   * Generates a retry prompt
   * @param context Prompt generation context
   * @returns Generated prompt result
   */
  generateRetryPrompt?(context: PromptGenerationContext): Promise<PromptGenerationResult> | PromptGenerationResult;

  /**
   * Generates a continuation prompt
   * @param context Prompt generation context
   * @param previousWork Previous work done
   * @returns Generated prompt result
   */
  generateContinuationPrompt?(
    context: PromptGenerationContext,
    previousWork: string
  ): Promise<PromptGenerationResult> | PromptGenerationResult;

  /**
   * Validates a prompt
   * @param prompt Prompt to validate
   * @returns Validation result
   */
  validatePrompt?(prompt: string): { valid: boolean; errors: string[] };

  /**
   * Gets available templates
   * @returns Array of template names
   */
  getAvailableTemplates?(): string[];

  /**
   * Gets a template by name
   * @param name Template name
   * @returns Template content
   */
  getTemplate?(name: string): string | undefined;

  /**
   * Sets a custom template
   * @param name Template name
   * @param content Template content
   */
  setTemplate?(name: string, content: string): void;
}

/**
 * Completion detection context
 */
export interface CompletionDetectionContext {
  /** Task being monitored */
  task: Task;

  /** Specification context */
  spec: SpecificationContext;

  /** Execution context */
  execution: ExecutionContext;

  /** Response text from Kiro (if available) */
  response?: string;

  /** File changes detected */
  fileChanges?: Array<{
    uri: string;
    type: 'created' | 'modified' | 'deleted';
    timestamp: Date;
  }>;

  /** Time elapsed since task started (ms) */
  elapsedTime: number;

  /** Previous detection results */
  previousResults?: CompletionDetectionResult[];

  /** Custom context data */
  customData?: Record<string, any>;
}

/**
 * CompletionDetector interface
 * Allows custom completion detection logic
 */
export interface CompletionDetector extends PluginLifecycle {
  /** Plugin metadata */
  metadata: PluginMetadata;

  /**
   * Detects task completion
   * @param context Completion detection context
   * @returns Detection result
   */
  detectCompletion(
    context: CompletionDetectionContext
  ): Promise<CompletionDetectionResult> | CompletionDetectionResult;

  /**
   * Detects completion from response text
   * @param context Completion detection context
   * @returns Detection result
   */
  detectCompletionFromResponse?(
    context: CompletionDetectionContext
  ): Promise<CompletionDetectionResult> | CompletionDetectionResult;

  /**
   * Detects completion from file changes
   * @param context Completion detection context
   * @returns Detection result
   */
  detectCompletionFromFileChanges?(
    context: CompletionDetectionContext
  ): Promise<CompletionDetectionResult> | CompletionDetectionResult;

  /**
   * Detects completion from task status
   * @param context Completion detection context
   * @returns Detection result
   */
  detectCompletionFromTaskStatus?(
    context: CompletionDetectionContext
  ): Promise<CompletionDetectionResult> | CompletionDetectionResult;

  /**
   * Handles ambiguous completion states
   * @param result Detection result
   * @param context Completion detection context
   * @returns Clarified result
   */
  handleAmbiguousState?(
    result: CompletionDetectionResult,
    context: CompletionDetectionContext
  ): Promise<CompletionDetectionResult> | CompletionDetectionResult;

  /**
   * Gets completion indicators to look for
   * @returns Array of indicator patterns
   */
  getCompletionIndicators?(): string[];

  /**
   * Gets failure indicators to look for
   * @returns Array of indicator patterns
   */
  getFailureIndicators?(): string[];
}

/**
 * Plugin capabilities
 */
export interface PluginCapabilities {
  /** Can process tasks */
  taskProcessor?: boolean;

  /** Can generate prompts */
  promptGenerator?: boolean;

  /** Can detect completion */
  completionDetector?: boolean;

  /** Can provide UI extensions */
  uiExtensions?: boolean;

  /** Can handle events */
  eventHandler?: boolean;

  /** Custom capabilities */
  custom?: Record<string, boolean>;
}

/**
 * Plugin interface
 * Base interface that all plugins must implement
 */
export interface Plugin extends PluginLifecycle {
  /** Plugin metadata */
  metadata: PluginMetadata;

  /** Plugin capabilities */
  capabilities: PluginCapabilities;

  /** Task processor (if supported) */
  taskProcessor?: TaskProcessor;

  /** Prompt generator (if supported) */
  promptGenerator?: PromptGenerator;

  /** Completion detector (if supported) */
  completionDetector?: CompletionDetector;
}

/**
 * Plugin factory function type
 */
export type PluginFactory = () => Plugin | Promise<Plugin>;

/**
 * Plugin configuration
 */
export interface PluginConfiguration {
  /** Plugin ID */
  pluginId: string;

  /** Whether plugin is enabled */
  enabled: boolean;

  /** Plugin-specific configuration */
  config?: Record<string, any>;

  /** Plugin priority (higher = runs first) */
  priority?: number;
}

/**
 * Plugin error
 */
export class PluginError extends Error {
  constructor(
    public pluginId: string,
    message: string,
    public originalError?: Error
  ) {
    super(`[Plugin: ${pluginId}] ${message}`);
    this.name = 'PluginError';
  }
}

/**
 * Plugin validation result
 */
export interface PluginValidationResult {
  /** Whether plugin is valid */
  valid: boolean;

  /** Validation errors */
  errors: string[];

  /** Validation warnings */
  warnings: string[];
}

/**
 * Plugin loader interface
 */
export interface PluginLoader {
  /**
   * Loads a plugin from a file path
   * @param filePath Path to plugin file
   * @returns Loaded plugin
   */
  loadPlugin(filePath: string): Promise<Plugin>;

  /**
   * Loads a plugin from a module
   * @param moduleName Module name
   * @returns Loaded plugin
   */
  loadPluginFromModule(moduleName: string): Promise<Plugin>;

  /**
   * Validates a plugin
   * @param plugin Plugin to validate
   * @returns Validation result
   */
  validatePlugin(plugin: Plugin): PluginValidationResult;

  /**
   * Unloads a plugin
   * @param pluginId Plugin ID
   */
  unloadPlugin(pluginId: string): Promise<void>;
}
