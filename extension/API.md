# Kiro Automation Extension API Documentation

This document provides comprehensive API documentation for developers who want to extend or integrate with the Kiro Automation Extension.

## Table of Contents

- [Overview](#overview)
- [Extension API](#extension-api)
- [Plugin System](#plugin-system)
- [Core Interfaces](#core-interfaces)
- [Events](#events)
- [Examples](#examples)

## Overview

The Kiro Automation Extension provides a plugin architecture that allows developers to:

- Create custom task processors
- Implement custom prompt generators
- Add custom completion detection logic
- Extend UI components
- Hook into automation events

## Extension API

### Accessing the Extension API

```typescript
import * as vscode from 'vscode';

// Get the Kiro Automation extension
const kiroAutomation = vscode.extensions.getExtension('kiro.kiro-automation-extension');

if (kiroAutomation && kiroAutomation.isActive) {
  const api = kiroAutomation.exports;
  // Use the API
}
```

### Exported API

The extension exports the following API:

```typescript
interface KiroAutomationAPI {
  /**
   * Register a custom task processor
   */
  registerTaskProcessor(processor: TaskProcessor): vscode.Disposable;

  /**
   * Register a custom prompt generator
   */
  registerPromptGenerator(generator: PromptGenerator): vscode.Disposable;

  /**
   * Register a custom completion detector
   */
  registerCompletionDetector(detector: CompletionDetector): vscode.Disposable;

  /**
   * Get the current automation state
   */
  getAutomationState(): AutomationState;

  /**
   * Subscribe to automation events
   */
  onAutomationEvent(
    event: AutomationEventType,
    listener: (data: any) => void
  ): vscode.Disposable;

  /**
   * Get the task manager instance
   */
  getTaskManager(): TaskManager;

  /**
   * Get the configuration manager instance
   */
  getConfigManager(): ConfigManager;
}
```

## Plugin System

### Task Processor

Create custom logic for processing tasks:

```typescript
import { Task, ExecutionResult, ExecutionContext } from 'kiro-automation-extension';

class CustomTaskProcessor implements TaskProcessor {
  /**
   * Unique identifier for this processor
   */
  readonly id: string = 'custom-processor';

  /**
   * Display name for this processor
   */
  readonly name: string = 'Custom Task Processor';

  /**
   * Check if this processor can handle the given task
   */
  canProcess(task: Task, context: ExecutionContext): boolean {
    // Return true if this processor should handle the task
    return task.title.includes('[CUSTOM]');
  }

  /**
   * Process the task
   */
  async process(task: Task, context: ExecutionContext): Promise<ExecutionResult> {
    // Custom processing logic
    console.log(`Processing task: ${task.title}`);

    try {
      // Your custom logic here
      await this.executeCustomLogic(task, context);

      return {
        success: true,
        message: 'Task processed successfully',
        data: {
          // Any additional data
        },
      };
    } catch (error) {
      return {
        success: false,
        message: `Task processing failed: ${error}`,
        error: error as Error,
      };
    }
  }

  private async executeCustomLogic(task: Task, context: ExecutionContext): Promise<void> {
    // Implement your custom logic
  }
}

// Register the processor
const api = kiroAutomation.exports;
const disposable = api.registerTaskProcessor(new CustomTaskProcessor());

// Don't forget to dispose when done
context.subscriptions.push(disposable);
```

### Prompt Generator

Customize how prompts are generated for tasks:

```typescript
import { Task, ExecutionContext } from 'kiro-automation-extension';

class CustomPromptGenerator implements PromptGenerator {
  /**
   * Unique identifier for this generator
   */
  readonly id: string = 'custom-prompt-generator';

  /**
   * Display name for this generator
   */
  readonly name: string = 'Custom Prompt Generator';

  /**
   * Check if this generator should be used for the given task
   */
  canGenerate(task: Task, context: ExecutionContext): boolean {
    // Return true if this generator should be used
    return task.specName === 'my-custom-spec';
  }

  /**
   * Generate a prompt for the task
   */
  async generate(task: Task, context: ExecutionContext): Promise<string> {
    // Build custom prompt
    const prompt = `
# Custom Task Execution

## Task: ${task.title}
ID: ${task.id}

## Requirements
${context.spec.requirements}

## Design
${context.spec.design}

## Instructions
${task.description.join('\n')}

## Subtasks
${task.subtasks.map(st => `- ${st.title}`).join('\n')}

Please execute this task following the requirements and design.
    `.trim();

    return prompt;
  }
}

// Register the generator
const disposable = api.registerPromptGenerator(new CustomPromptGenerator());
context.subscriptions.push(disposable);
```

### Completion Detector

Implement custom logic to detect when a task is complete:

```typescript
import { Task, ExecutionContext } from 'kiro-automation-extension';

class CustomCompletionDetector implements CompletionDetector {
  /**
   * Unique identifier for this detector
   */
  readonly id: string = 'custom-completion-detector';

  /**
   * Display name for this detector
   */
  readonly name: string = 'Custom Completion Detector';

  /**
   * Check if this detector should be used for the given task
   */
  canDetect(task: Task, context: ExecutionContext): boolean {
    // Return true if this detector should be used
    return task.title.includes('[VERIFY]');
  }

  /**
   * Detect if the task is complete
   */
  async detect(task: Task, context: ExecutionContext): Promise<CompletionResult> {
    // Custom completion detection logic
    try {
      const isComplete = await this.checkCompletion(task, context);

      return {
        complete: isComplete,
        confidence: isComplete ? 1.0 : 0.0,
        message: isComplete ? 'Task verified as complete' : 'Task not yet complete',
        evidence: {
          // Any evidence of completion
        },
      };
    } catch (error) {
      return {
        complete: false,
        confidence: 0.0,
        message: `Completion detection failed: ${error}`,
        error: error as Error,
      };
    }
  }

  private async checkCompletion(task: Task, context: ExecutionContext): Promise<boolean> {
    // Implement your custom completion check
    return false;
  }
}

// Register the detector
const disposable = api.registerCompletionDetector(new CustomCompletionDetector());
context.subscriptions.push(disposable);
```

## Core Interfaces

### Task

Represents a task in the automation system:

```typescript
interface Task {
  /** Unique task identifier (e.g., "1.2.3") */
  id: string;

  /** Task title */
  title: string;

  /** Task description lines */
  description: string[];

  /** Current task status */
  status: TaskStatus;

  /** Subtasks */
  subtasks: SubTask[];

  /** Referenced requirements */
  requirements: string[];

  /** Spec name this task belongs to */
  specName: string;

  /** File path where task is defined */
  filePath: string;

  /** Line number in file */
  lineNumber: number;

  /** Whether this is an optional task */
  optional: boolean;

  /** Task dependencies */
  dependencies?: string[];

  /** Estimated duration in milliseconds */
  estimatedDuration?: number;
}

type TaskStatus = 'pending' | 'in_progress' | 'completed' | 'failed' | 'skipped';
```

### SubTask

Represents a subtask:

```typescript
interface SubTask {
  /** Subtask identifier (e.g., "1.2") */
  id: string;

  /** Subtask title */
  title: string;

  /** Subtask description lines */
  description: string[];

  /** Current subtask status */
  status: TaskStatus;

  /** Whether this is an optional subtask */
  optional: boolean;
}
```

### ExecutionContext

Provides context for task execution:

```typescript
interface ExecutionContext {
  /** The task being executed */
  task: Task;

  /** Specification context */
  spec: SpecificationContext;

  /** Workspace context */
  workspace: WorkspaceContext;

  /** Current automation session */
  session: AutomationSession;
}

interface SpecificationContext {
  /** Spec name */
  name: string;

  /** Requirements document content */
  requirements: string;

  /** Design document content */
  design: string;

  /** Tasks file path */
  tasksFile: string;
}

interface WorkspaceContext {
  /** Workspace name */
  name: string;

  /** Workspace URI */
  uri: vscode.Uri;

  /** Task manager for this workspace */
  taskManager: TaskManager;
}

interface AutomationSession {
  /** Unique session identifier */
  id: string;

  /** Session start time */
  startTime: Date;

  /** Current task being executed */
  currentTask?: Task;

  /** Completed tasks in this session */
  completedTasks: Task[];

  /** Failed tasks in this session */
  failedTasks: Task[];

  /** Session configuration */
  configuration: AutomationConfig;
}
```

### ExecutionResult

Result of task execution:

```typescript
interface ExecutionResult {
  /** Whether execution was successful */
  success: boolean;

  /** Result message */
  message: string;

  /** Additional data */
  data?: any;

  /** Error if execution failed */
  error?: Error;

  /** Execution duration in milliseconds */
  duration?: number;
}
```

### CompletionResult

Result of completion detection:

```typescript
interface CompletionResult {
  /** Whether the task is complete */
  complete: boolean;

  /** Confidence level (0.0 to 1.0) */
  confidence: number;

  /** Result message */
  message: string;

  /** Evidence of completion */
  evidence?: any;

  /** Error if detection failed */
  error?: Error;
}
```

## Events

### Automation Events

Subscribe to automation events:

```typescript
// Available event types
type AutomationEventType =
  | 'stateChanged'
  | 'taskStarted'
  | 'taskCompleted'
  | 'taskFailed'
  | 'taskSkipped'
  | 'sessionStarted'
  | 'sessionCompleted'
  | 'sessionFailed'
  | 'sessionPaused'
  | 'sessionResumed'
  | 'errorOccurred';

// Subscribe to events
const api = kiroAutomation.exports;

const disposable = api.onAutomationEvent('taskCompleted', (data) => {
  console.log('Task completed:', data.task.title);
  console.log('Duration:', data.duration, 'ms');
});

context.subscriptions.push(disposable);
```

### Event Data Structures

#### State Changed Event

```typescript
interface StateChangedEvent {
  oldState: EngineState;
  newState: EngineState;
  timestamp: Date;
}

type EngineState = 'idle' | 'running' | 'paused' | 'stopping' | 'stopped' | 'error';
```

#### Task Event

```typescript
interface TaskEvent {
  task: Task;
  timestamp: Date;
  duration?: number;
  error?: Error;
}
```

#### Session Event

```typescript
interface SessionEvent {
  session: AutomationSession;
  timestamp: Date;
  totalTasks: number;
  completedTasks: number;
  failedTasks: number;
}
```

## Examples

### Example 1: Custom Task Processor for Test Tasks

```typescript
import * as vscode from 'vscode';
import { Task, ExecutionResult, ExecutionContext } from 'kiro-automation-extension';

class TestTaskProcessor implements TaskProcessor {
  readonly id = 'test-task-processor';
  readonly name = 'Test Task Processor';

  canProcess(task: Task, context: ExecutionContext): boolean {
    // Handle tasks that contain "test" in the title
    return task.title.toLowerCase().includes('test');
  }

  async process(task: Task, context: ExecutionContext): Promise<ExecutionResult> {
    try {
      // Run tests
      const terminal = vscode.window.createTerminal('Test Runner');
      terminal.show();
      terminal.sendText('npm test');

      // Wait for tests to complete (simplified)
      await new Promise(resolve => setTimeout(resolve, 5000));

      return {
        success: true,
        message: 'Tests executed successfully',
      };
    } catch (error) {
      return {
        success: false,
        message: `Test execution failed: ${error}`,
        error: error as Error,
      };
    }
  }
}

// Register in your extension's activate function
export function activate(context: vscode.ExtensionContext) {
  const kiroAutomation = vscode.extensions.getExtension('kiro.kiro-automation-extension');
  
  if (kiroAutomation && kiroAutomation.isActive) {
    const api = kiroAutomation.exports;
    const processor = new TestTaskProcessor();
    const disposable = api.registerTaskProcessor(processor);
    context.subscriptions.push(disposable);
  }
}
```

### Example 2: Custom Prompt Generator with Templates

```typescript
import { Task, ExecutionContext } from 'kiro-automation-extension';

class TemplatePromptGenerator implements PromptGenerator {
  readonly id = 'template-prompt-generator';
  readonly name = 'Template Prompt Generator';

  private templates: Map<string, string> = new Map([
    ['feature', `
# Feature Implementation

## Task: {{taskTitle}}

### Requirements
{{requirements}}

### Design
{{design}}

### Implementation Steps
{{subtasks}}

Please implement this feature following TDD principles.
    `],
    ['bugfix', `
# Bug Fix

## Issue: {{taskTitle}}

### Description
{{description}}

### Steps to Reproduce
{{requirements}}

### Expected Behavior
{{design}}

Please fix this bug and add regression tests.
    `],
  ]);

  canGenerate(task: Task, context: ExecutionContext): boolean {
    return task.title.startsWith('[FEATURE]') || task.title.startsWith('[BUGFIX]');
  }

  async generate(task: Task, context: ExecutionContext): Promise<string> {
    const templateType = task.title.startsWith('[FEATURE]') ? 'feature' : 'bugfix';
    const template = this.templates.get(templateType) || '';

    // Replace template variables
    return template
      .replace('{{taskTitle}}', task.title)
      .replace('{{requirements}}', context.spec.requirements)
      .replace('{{design}}', context.spec.design)
      .replace('{{description}}', task.description.join('\n'))
      .replace('{{subtasks}}', task.subtasks.map(st => `- ${st.title}`).join('\n'));
  }
}
```

### Example 3: File-Based Completion Detector

```typescript
import * as vscode from 'vscode';
import * as fs from 'fs';
import { Task, ExecutionContext } from 'kiro-automation-extension';

class FileBasedCompletionDetector implements CompletionDetector {
  readonly id = 'file-based-completion-detector';
  readonly name = 'File-Based Completion Detector';

  canDetect(task: Task, context: ExecutionContext): boolean {
    // Use for tasks that specify expected output files
    return task.description.some(line => line.includes('Output:'));
  }

  async detect(task: Task, context: ExecutionContext): Promise<CompletionResult> {
    try {
      // Extract expected files from task description
      const expectedFiles = this.extractExpectedFiles(task);

      // Check if all files exist
      const allFilesExist = await this.checkFilesExist(expectedFiles, context);

      if (allFilesExist) {
        return {
          complete: true,
          confidence: 1.0,
          message: 'All expected files created',
          evidence: { files: expectedFiles },
        };
      } else {
        return {
          complete: false,
          confidence: 0.0,
          message: 'Some expected files are missing',
          evidence: { expectedFiles },
        };
      }
    } catch (error) {
      return {
        complete: false,
        confidence: 0.0,
        message: `Completion detection failed: ${error}`,
        error: error as Error,
      };
    }
  }

  private extractExpectedFiles(task: Task): string[] {
    const files: string[] = [];
    for (const line of task.description) {
      const match = line.match(/Output:\s*(.+)/);
      if (match) {
        files.push(match[1].trim());
      }
    }
    return files;
  }

  private async checkFilesExist(files: string[], context: ExecutionContext): Promise<boolean> {
    for (const file of files) {
      const filePath = vscode.Uri.joinPath(context.workspace.uri, file);
      try {
        await vscode.workspace.fs.stat(filePath);
      } catch {
        return false;
      }
    }
    return true;
  }
}
```

### Example 4: Monitoring Automation Progress

```typescript
import * as vscode from 'vscode';

export function activate(context: vscode.ExtensionContext) {
  const kiroAutomation = vscode.extensions.getExtension('kiro.kiro-automation-extension');
  
  if (kiroAutomation && kiroAutomation.isActive) {
    const api = kiroAutomation.exports;

    // Monitor task completion
    const taskCompletedDisposable = api.onAutomationEvent('taskCompleted', (data) => {
      vscode.window.showInformationMessage(
        `Task completed: ${data.task.title} (${data.duration}ms)`
      );
    });

    // Monitor task failures
    const taskFailedDisposable = api.onAutomationEvent('taskFailed', (data) => {
      vscode.window.showErrorMessage(
        `Task failed: ${data.task.title} - ${data.error?.message}`
      );
    });

    // Monitor session completion
    const sessionCompletedDisposable = api.onAutomationEvent('sessionCompleted', (data) => {
      vscode.window.showInformationMessage(
        `Automation completed: ${data.completedTasks}/${data.totalTasks} tasks successful`
      );
    });

    context.subscriptions.push(
      taskCompletedDisposable,
      taskFailedDisposable,
      sessionCompletedDisposable
    );
  }
}
```

### Example 5: Custom UI Integration

```typescript
import * as vscode from 'vscode';

class CustomAutomationPanel {
  private panel: vscode.WebviewPanel | undefined;

  constructor(private context: vscode.ExtensionContext) {
    this.setupEventListeners();
  }

  private setupEventListeners() {
    const kiroAutomation = vscode.extensions.getExtension('kiro.kiro-automation-extension');
    
    if (kiroAutomation && kiroAutomation.isActive) {
      const api = kiroAutomation.exports;

      // Listen to all automation events
      api.onAutomationEvent('taskStarted', (data) => {
        this.updatePanel(`Task started: ${data.task.title}`);
      });

      api.onAutomationEvent('taskCompleted', (data) => {
        this.updatePanel(`Task completed: ${data.task.title}`);
      });
    }
  }

  public show() {
    if (this.panel) {
      this.panel.reveal();
      return;
    }

    this.panel = vscode.window.createWebviewPanel(
      'customAutomationPanel',
      'Custom Automation Monitor',
      vscode.ViewColumn.Two,
      { enableScripts: true }
    );

    this.panel.webview.html = this.getHtmlContent();

    this.panel.onDidDispose(() => {
      this.panel = undefined;
    });
  }

  private updatePanel(message: string) {
    if (this.panel) {
      this.panel.webview.postMessage({ type: 'update', message });
    }
  }

  private getHtmlContent(): string {
    return `<!DOCTYPE html>
<html>
<head>
  <title>Custom Automation Monitor</title>
</head>
<body>
  <h1>Automation Progress</h1>
  <div id="messages"></div>
  <script>
    window.addEventListener('message', event => {
      const message = event.data;
      if (message.type === 'update') {
        const div = document.getElementById('messages');
        div.innerHTML += '<p>' + message.message + '</p>';
      }
    });
  </script>
</body>
</html>`;
  }
}
```

## Best Practices

### 1. Error Handling

Always handle errors gracefully in your plugins:

```typescript
async process(task: Task, context: ExecutionContext): Promise<ExecutionResult> {
  try {
    // Your logic here
    return { success: true, message: 'Success' };
  } catch (error) {
    console.error('Task processing error:', error);
    return {
      success: false,
      message: `Error: ${error}`,
      error: error as Error,
    };
  }
}
```

### 2. Resource Cleanup

Always dispose of resources properly:

```typescript
export function activate(context: vscode.ExtensionContext) {
  const disposable = api.registerTaskProcessor(processor);
  context.subscriptions.push(disposable); // Ensures cleanup on deactivation
}
```

### 3. Async Operations

Use async/await for asynchronous operations:

```typescript
async generate(task: Task, context: ExecutionContext): Promise<string> {
  const requirements = await this.loadRequirements(context);
  const design = await this.loadDesign(context);
  return this.buildPrompt(task, requirements, design);
}
```

### 4. Type Safety

Use TypeScript types for better IDE support and error checking:

```typescript
import { Task, ExecutionContext, ExecutionResult } from 'kiro-automation-extension';

class MyProcessor implements TaskProcessor {
  // TypeScript will ensure you implement all required methods
}
```

### 5. Testing

Test your plugins thoroughly:

```typescript
import { Task, ExecutionContext } from 'kiro-automation-extension';

describe('CustomTaskProcessor', () => {
  it('should process tasks correctly', async () => {
    const processor = new CustomTaskProcessor();
    const task: Task = { /* mock task */ };
    const context: ExecutionContext = { /* mock context */ };
    
    const result = await processor.process(task, context);
    
    expect(result.success).toBe(true);
  });
});
```

## Support

For questions or issues with the API:

- **GitHub Issues**: [Report an issue](https://github.com/your-org/kiro-automation-extension/issues)
- **Discussions**: [Join the discussion](https://github.com/your-org/kiro-automation-extension/discussions)
- **Documentation**: [Full documentation](https://github.com/your-org/kiro-automation-extension/wiki)

## Contributing

We welcome contributions to the API and plugin system! Please see our [Contributing Guide](CONTRIBUTING.md) for details.

## License

MIT License - see [LICENSE](LICENSE) file for details.
