import * as vscode from 'vscode';
import * as path from 'path';
import { Task, SubTask } from './models/Task';
import { SpecificationContext } from './models/ExecutionContext';

/**
 * Prompt template variables
 */
export interface PromptVariables {
  taskId: string;
  taskTitle: string;
  taskDescription: string[];
  subtasks: SubTask[];
  requirements: string[];
  specName: string;
  requirementsContent: string;
  designContent: string;
  customContext?: string;
}

/**
 * Prompt generation options
 */
export interface PromptGenerationOptions {
  /** Include requirements document */
  includeRequirements?: boolean;
  
  /** Include design document */
  includeDesign?: boolean;
  
  /** Include subtasks */
  includeSubtasks?: boolean;
  
  /** Include custom context */
  customContext?: string;
  
  /** Custom template */
  customTemplate?: string;
  
  /** Maximum prompt length */
  maxLength?: number;
}

/**
 * PromptGenerator class
 * Generates contextual prompts for task execution
 */
export class PromptGenerator {
  private defaultTemplate: string;
  private workspaceRoot: string;

  constructor(workspaceRoot?: string) {
    this.workspaceRoot = workspaceRoot || vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || '';
    this.defaultTemplate = this.buildDefaultTemplate();
  }

  /**
   * Generates a prompt for a task
   * @param task Task to generate prompt for
   * @param spec Specification context
   * @param options Prompt generation options
   * @returns Generated prompt
   */
  async generatePrompt(
    task: Task,
    spec: SpecificationContext,
    options?: PromptGenerationOptions
  ): Promise<string> {
    const opts = {
      includeRequirements: options?.includeRequirements ?? true,
      includeDesign: options?.includeDesign ?? true,
      includeSubtasks: options?.includeSubtasks ?? true,
      customContext: options?.customContext,
      customTemplate: options?.customTemplate,
      maxLength: options?.maxLength ?? 10000,
    };

    // Read requirements and design if needed
    let requirementsContent = '';
    let designContent = '';

    if (opts.includeRequirements) {
      requirementsContent = await this.readSpecFile(spec, 'requirements.md');
    }

    if (opts.includeDesign) {
      designContent = await this.readSpecFile(spec, 'design.md');
    }

    // Prepare variables
    const variables: PromptVariables = {
      taskId: task.id,
      taskTitle: task.title,
      taskDescription: [], // Tasks typically don't have descriptions in the current model
      subtasks: task.subtasks,
      requirements: task.requirements,
      specName: spec.name,
      requirementsContent,
      designContent,
      customContext: opts.customContext,
    };

    // Generate prompt from template
    const template = opts.customTemplate || this.defaultTemplate;
    let prompt = this.fillTemplate(template, variables, opts);

    // Truncate if needed
    if (prompt.length > opts.maxLength) {
      prompt = this.truncatePrompt(prompt, opts.maxLength);
    }

    return prompt;
  }

  /**
   * Reads a spec file (requirements.md or design.md)
   */
  private async readSpecFile(spec: SpecificationContext, filename: string): Promise<string> {
    try {
      const filePath = path.join(spec.basePath, filename);
      const uri = vscode.Uri.file(filePath);
      const content = await vscode.workspace.fs.readFile(uri);
      return Buffer.from(content).toString('utf8');
    } catch (error) {
      console.warn(`Could not read ${filename}:`, error);
      return '';
    }
  }

  /**
   * Fills a template with variables
   */
  private fillTemplate(
    template: string,
    variables: PromptVariables,
    options: PromptGenerationOptions
  ): string {
    let prompt = template;

    // Replace basic variables
    prompt = prompt.replace(/\{taskId\}/g, variables.taskId);
    prompt = prompt.replace(/\{taskTitle\}/g, variables.taskTitle);
    prompt = prompt.replace(/\{specName\}/g, variables.specName);

    // Replace subtasks
    if (options.includeSubtasks && variables.subtasks.length > 0) {
      const subtasksText = this.formatSubtasks(variables.subtasks);
      prompt = prompt.replace(/\{subtasks\}/g, subtasksText);
    } else {
      prompt = prompt.replace(/\{subtasks\}/g, '');
    }

    // Replace requirements
    if (variables.requirements.length > 0) {
      const requirementsText = variables.requirements.join(', ');
      prompt = prompt.replace(/\{requirements\}/g, requirementsText);
    } else {
      prompt = prompt.replace(/\{requirements\}/g, 'None specified');
    }

    // Replace requirements content
    if (options.includeRequirements && variables.requirementsContent) {
      prompt = prompt.replace(/\{requirementsContent\}/g, variables.requirementsContent);
    } else {
      prompt = prompt.replace(/\{requirementsContent\}/g, '');
    }

    // Replace design content
    if (options.includeDesign && variables.designContent) {
      prompt = prompt.replace(/\{designContent\}/g, variables.designContent);
    } else {
      prompt = prompt.replace(/\{designContent\}/g, '');
    }

    // Replace custom context
    if (variables.customContext) {
      prompt = prompt.replace(/\{customContext\}/g, variables.customContext);
    } else {
      prompt = prompt.replace(/\{customContext\}/g, '');
    }

    return prompt;
  }

  /**
   * Formats subtasks for inclusion in prompt
   */
  private formatSubtasks(subtasks: SubTask[]): string {
    if (subtasks.length === 0) {
      return 'No subtasks';
    }

    const lines: string[] = ['Subtasks:'];
    
    for (const subtask of subtasks) {
      lines.push(`- ${subtask.id} ${subtask.title}`);
      
      if (subtask.description && subtask.description.length > 0) {
        subtask.description.forEach(desc => {
          lines.push(`  ${desc}`);
        });
      }
      
      if (subtask.optional) {
        lines.push(`  (Optional)`);
      }
    }

    return lines.join('\n');
  }

  /**
   * Truncates a prompt to fit within max length
   */
  private truncatePrompt(prompt: string, maxLength: number): string {
    if (prompt.length <= maxLength) {
      return prompt;
    }

    // Try to truncate at a sentence boundary
    const truncated = prompt.substring(0, maxLength);
    const lastPeriod = truncated.lastIndexOf('.');
    const lastNewline = truncated.lastIndexOf('\n');
    
    const cutPoint = Math.max(lastPeriod, lastNewline);
    
    if (cutPoint > maxLength * 0.8) {
      return truncated.substring(0, cutPoint + 1) + '\n\n[Content truncated due to length]';
    }

    return truncated + '\n\n[Content truncated due to length]';
  }

  /**
   * Builds the default prompt template
   */
  private buildDefaultTemplate(): string {
    return `Implement the task from the markdown document at {specName}/tasks.md:

Task: {taskId} - {taskTitle}

{subtasks}

Requirements: {requirements}

## Context

### Requirements
{requirementsContent}

### Design
{designContent}

{customContext}

## Instructions
Implement the task according to the requirements and design.
Only focus on ONE task at a time. Do NOT implement functionality for other tasks.
If the task has sub-tasks, implement the sub-tasks first.
Write all required code changes before executing any tests or validation steps.
Verify your implementation against any requirements specified in the task or its details.`;
  }

  /**
   * Sets a custom default template
   */
  setDefaultTemplate(template: string): void {
    this.defaultTemplate = template;
  }

  /**
   * Gets the current default template
   */
  getDefaultTemplate(): string {
    return this.defaultTemplate;
  }

  /**
   * Generates a minimal prompt (without full context)
   */
  async generateMinimalPrompt(task: Task): Promise<string> {
    return `Implement task ${task.id}: ${task.title}`;
  }

  /**
   * Generates a prompt for a specific subtask
   */
  async generateSubtaskPrompt(
    task: Task,
    subtask: SubTask,
    spec: SpecificationContext,
    options?: PromptGenerationOptions
  ): Promise<string> {
    const fullPrompt = await this.generatePrompt(task, spec, options);
    
    // Add subtask-specific focus
    let subtaskFocus = `\n\n## Current Subtask Focus\n\nFocus on implementing subtask ${subtask.id}: ${subtask.title}\n`;

    if (subtask.description && subtask.description.length > 0) {
      // append details if present
      const details = 'Details:\n' + subtask.description.map(d => `- ${d}`).join('\n');
      subtaskFocus += details;
    }

    return fullPrompt + subtaskFocus;
  }

  /**
   * Generates a retry prompt (for failed tasks)
   */
  async generateRetryPrompt(
    task: Task,
    spec: SpecificationContext,
    previousError: string,
    retryCount: number
  ): Promise<string> {
    const basePrompt = await this.generatePrompt(task, spec);
    
    const retryContext = `\n\n## Retry Information\n\nThis is retry attempt #${retryCount}.\n\nPrevious error:\n${previousError}\n\nPlease address the error and try again.`;
    
    return basePrompt + retryContext;
  }

  /**
   * Generates a continuation prompt (for tasks that need more work)
   */
  async generateContinuationPrompt(
    task: Task,
    spec: SpecificationContext,
    previousWork: string
  ): Promise<string> {
    const basePrompt = await this.generatePrompt(task, spec);
    
    const continuationContext = `\n\n## Previous Work\n\n${previousWork}\n\nPlease continue from where you left off.`;
    
    return basePrompt + continuationContext;
  }

  /**
   * Validates a prompt template
   */
  validateTemplate(template: string): { valid: boolean; errors: string[] } {
    const errors: string[] = [];
    
    // Check for required variables
    const requiredVars = ['{taskId}', '{taskTitle}'];
    for (const varName of requiredVars) {
      if (!template.includes(varName)) {
        errors.push(`Template missing required variable: ${varName}`);
      }
    }

    // Check for balanced braces
    const openBraces = (template.match(/\{/g) || []).length;
    const closeBraces = (template.match(/\}/g) || []).length;
    
    if (openBraces !== closeBraces) {
      errors.push('Template has unbalanced braces');
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * Extracts variables from a template
   */
  extractTemplateVariables(template: string): string[] {
    const regex = /\{([^}]+)\}/g;
    const variables: string[] = [];
    let match;

    while ((match = regex.exec(template)) !== null) {
      variables.push(match[1]);
    }

    return [...new Set(variables)]; // Remove duplicates
  }

  /**
   * Creates a template from a task
   */
  createTemplateFromTask(task: Task): string {
    let template = `Task: {taskId} - {taskTitle}\n\n`;
    
    if (task.subtasks.length > 0) {
      template += `{subtasks}\n\n`;
    }
    
    if (task.requirements.length > 0) {
      template += `Requirements: {requirements}\n\n`;
    }
    
    template += `{customContext}`;
    
    return template;
  }
}

/**
 * Creates a PromptGenerator instance
 */
export function createPromptGenerator(workspaceRoot?: string): PromptGenerator {
  return new PromptGenerator(workspaceRoot);
}
