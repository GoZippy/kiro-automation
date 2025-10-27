/**
 * Example plugin demonstrating the plugin system
 * This plugin shows how to implement TaskProcessor, PromptGenerator, and CompletionDetector
 */

import {
  Plugin,
  PluginMetadata,
  PluginCapabilities,
  TaskProcessor,
  TaskProcessorContext,
  TaskProcessorResult,
  PromptGenerator,
  PromptGenerationContext,
  PromptGenerationResult,
  CompletionDetector,
  CompletionDetectionContext,
} from '../PluginInterfaces';
import { CompletionDetectionResult } from '../../CompletionDetector';

/**
 * Example Task Processor
 * Demonstrates pre/post processing of tasks
 */
class ExampleTaskProcessor implements TaskProcessor {
  metadata: PluginMetadata = {
    id: 'example-task-processor',
    name: 'Example Task Processor',
    version: '1.0.0',
    description: 'Example task processor for demonstration',
  };

  async activate(): Promise<void> {
    console.log('ExampleTaskProcessor activated');
  }

  async deactivate(): Promise<void> {
    console.log('ExampleTaskProcessor deactivated');
  }

  async preProcess(context: TaskProcessorContext): Promise<TaskProcessorResult> {
    console.log(`Pre-processing task: ${context.task.id}`);

    // Example: Add custom data to context
    return {
      success: true,
      continue: true,
      customData: {
        preprocessedAt: new Date().toISOString(),
      },
    };
  }

  async postProcess(context: TaskProcessorContext): Promise<TaskProcessorResult> {
    console.log(`Post-processing task: ${context.task.id}`);

    // Example: Validate task completion
    const allSubtasksComplete = context.task.subtasks.every(
      (st) => st.status === 'completed' || st.optional
    );

    return {
      success: allSubtasksComplete,
      continue: true,
      customData: {
        postprocessedAt: new Date().toISOString(),
        allSubtasksComplete,
      },
    };
  }

  async onTaskCompleted(context: TaskProcessorContext): Promise<TaskProcessorResult> {
    console.log(`Task completed: ${context.task.id}`);

    return {
      success: true,
      continue: true,
    };
  }

  async onTaskFailed(context: TaskProcessorContext, error: Error): Promise<TaskProcessorResult> {
    console.log(`Task failed: ${context.task.id} - ${error.message}`);

    // Example: Decide whether to retry based on error
    const shouldRetry = !error.message.includes('validation');

    return {
      success: false,
      continue: shouldRetry,
      error: error.message,
    };
  }
}

/**
 * Example Prompt Generator
 * Demonstrates custom prompt generation
 */
class ExamplePromptGenerator implements PromptGenerator {
  metadata: PluginMetadata = {
    id: 'example-prompt-generator',
    name: 'Example Prompt Generator',
    version: '1.0.0',
    description: 'Example prompt generator for demonstration',
  };

  private templates: Map<string, string> = new Map();

  constructor() {
    // Initialize with default templates
    this.templates.set(
      'default',
      `Task: {taskId} - {taskTitle}

{subtasks}

Requirements: {requirements}

Please implement this task according to the specifications.`
    );

    this.templates.set(
      'detailed',
      `# Task Implementation

## Task Details
- ID: {taskId}
- Title: {taskTitle}
- Spec: {specName}

## Subtasks
{subtasks}

## Requirements
{requirements}

## Context
{requirementsContent}

{designContent}

## Instructions
Please implement this task with careful attention to the requirements and design.`
    );
  }

  async activate(): Promise<void> {
    console.log('ExamplePromptGenerator activated');
  }

  async deactivate(): Promise<void> {
    console.log('ExamplePromptGenerator deactivated');
  }

  generatePrompt(context: PromptGenerationContext): PromptGenerationResult {
    const template = this.templates.get('default') || '';

    // Simple template variable replacement
    let prompt = template
      .replace('{taskId}', context.task.id)
      .replace('{taskTitle}', context.task.title)
      .replace('{specName}', context.spec.name)
      .replace('{requirements}', context.task.requirements.join(', ') || 'None')
      .replace(
        '{subtasks}',
        context.task.subtasks.map((st) => `- ${st.id} ${st.title}`).join('\n') || 'No subtasks'
      )
      .replace('{requirementsContent}', context.requirementsContent || '')
      .replace('{designContent}', context.designContent || '');

    return {
      prompt,
      success: true,
      metadata: {
        length: prompt.length,
        template: 'default',
        variables: {
          taskId: context.task.id,
          taskTitle: context.task.title,
        },
      },
    };
  }

  generateRetryPrompt(context: PromptGenerationContext): PromptGenerationResult {
    const baseResult = this.generatePrompt(context);

    const retryAddition = `

## Retry Information
This is retry attempt #${context.retryCount || 1}.
Previous error: ${context.previousError || 'Unknown error'}

Please address the error and try again.`;

    return {
      prompt: baseResult.prompt + retryAddition,
      success: true,
      metadata: {
        // Ensure metadata.length is present and a number (baseResult.metadata may be undefined)
        length: baseResult.metadata?.length ?? (baseResult.prompt ? baseResult.prompt.length : 0),
        template: baseResult.metadata?.template ?? 'default',
        variables: baseResult.metadata?.variables ?? {},
        retryCount: context.retryCount ?? 0,
      },
    };
  }

  validatePrompt(prompt: string): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (prompt.length === 0) {
      errors.push('Prompt is empty');
    }

    if (prompt.length > 10000) {
      errors.push('Prompt exceeds maximum length of 10000 characters');
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  getAvailableTemplates(): string[] {
    return Array.from(this.templates.keys());
  }

  getTemplate(name: string): string | undefined {
    return this.templates.get(name);
  }

  setTemplate(name: string, content: string): void {
    this.templates.set(name, content);
  }
}

/**
 * Example Completion Detector
 * Demonstrates custom completion detection logic
 */
class ExampleCompletionDetector implements CompletionDetector {
  metadata: PluginMetadata = {
    id: 'example-completion-detector',
    name: 'Example Completion Detector',
    version: '1.0.0',
    description: 'Example completion detector for demonstration',
  };

  private completionIndicators = [
    'completed',
    'done',
    'finished',
    'success',
    'implemented',
    'created',
  ];

  private failureIndicators = ['failed', 'error', 'exception', 'cannot', 'unable'];

  async activate(): Promise<void> {
    console.log('ExampleCompletionDetector activated');
  }

  async deactivate(): Promise<void> {
    console.log('ExampleCompletionDetector deactivated');
  }

  detectCompletion(context: CompletionDetectionContext): CompletionDetectionResult {
    let confidence = 0;
    const indicators: string[] = [];

    // Check response text if available
    if (context.response) {
      const lowerResponse = context.response.toLowerCase();

      // Check for completion indicators
      for (const indicator of this.completionIndicators) {
        if (lowerResponse.includes(indicator)) {
          indicators.push(`completion: ${indicator}`);
          confidence += 0.15;
        }
      }

      // Check for failure indicators (negative confidence)
      for (const indicator of this.failureIndicators) {
        if (lowerResponse.includes(indicator)) {
          indicators.push(`failure: ${indicator}`);
          confidence -= 0.2;
        }
      }

      // Check for code blocks
      const codeBlockCount = (context.response.match(/```/g) || []).length / 2;
      if (codeBlockCount > 0) {
        indicators.push(`${codeBlockCount} code blocks`);
        confidence += 0.2;
      }
    }

    // Check file changes
    if (context.fileChanges && context.fileChanges.length > 0) {
      indicators.push(`${context.fileChanges.length} file changes`);
      confidence += 0.3;
    }

    // Check elapsed time
    if (context.elapsedTime > 60000) {
      // More than 1 minute
      indicators.push('significant time elapsed');
      confidence += 0.1;
    }

    // Cap confidence between 0 and 1
    confidence = Math.max(0, Math.min(1, confidence));

    return {
      completed: confidence >= 0.6,
      confidence,
      method: 'heuristic',
      indicators,
      timestamp: new Date(),
      context: {
        elapsedTime: context.elapsedTime,
        fileChangeCount: context.fileChanges?.length || 0,
      },
    };
  }

  detectCompletionFromResponse(context: CompletionDetectionContext): CompletionDetectionResult {
    if (!context.response) {
      return {
        completed: false,
        confidence: 0,
        method: 'response-indicator',
        indicators: ['no response available'],
        timestamp: new Date(),
      };
    }

    return this.detectCompletion(context);
  }

  handleAmbiguousState(
    result: CompletionDetectionResult,
    context: CompletionDetectionContext
  ): CompletionDetectionResult {
    // If confidence is between 0.4 and 0.7, it's ambiguous
    if (result.confidence >= 0.4 && result.confidence < 0.7) {
      return {
        ...result,
        completed: false, // Err on the side of caution
        indicators: [...result.indicators, 'ambiguous state - needs verification'],
      };
    }

    return result;
  }

  getCompletionIndicators(): string[] {
    return [...this.completionIndicators];
  }

  getFailureIndicators(): string[] {
    return [...this.failureIndicators];
  }
}

/**
 * Example Plugin
 * Combines all example components into a single plugin
 */
export class ExamplePlugin implements Plugin {
  metadata: PluginMetadata = {
    id: 'example-plugin',
    name: 'Example Plugin',
    version: '1.0.0',
    description: 'Example plugin demonstrating the plugin system',
    author: 'Kiro Automation Team',
  };

  capabilities: PluginCapabilities = {
    taskProcessor: true,
    promptGenerator: true,
    completionDetector: true,
  };

  taskProcessor: TaskProcessor;
  promptGenerator: PromptGenerator;
  completionDetector: CompletionDetector;

  constructor() {
    this.taskProcessor = new ExampleTaskProcessor();
    this.promptGenerator = new ExamplePromptGenerator();
    this.completionDetector = new ExampleCompletionDetector();
  }

  async activate(): Promise<void> {
    console.log('ExamplePlugin activated');

    // Activate sub-components
    if (this.taskProcessor.activate) {
      await this.taskProcessor.activate();
    }
    if (this.promptGenerator.activate) {
      await this.promptGenerator.activate();
    }
    if (this.completionDetector.activate) {
      await this.completionDetector.activate();
    }
  }

  async deactivate(): Promise<void> {
    console.log('ExamplePlugin deactivated');

    // Deactivate sub-components
    if (this.completionDetector.deactivate) {
      await this.completionDetector.deactivate();
    }
    if (this.promptGenerator.deactivate) {
      await this.promptGenerator.deactivate();
    }
    if (this.taskProcessor.deactivate) {
      await this.taskProcessor.deactivate();
    }
  }

  async onConfigurationChanged(config: any): Promise<void> {
    console.log('ExamplePlugin configuration changed:', config);
  }
}

/**
 * Plugin factory function
 * This is the recommended way to export plugins
 */
export default function createPlugin(): Plugin {
  return new ExamplePlugin();
}
