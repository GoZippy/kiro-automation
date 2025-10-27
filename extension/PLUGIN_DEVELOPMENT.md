# Plugin Development Guide

This guide will help you create plugins for the Kiro Automation Extension.

## Table of Contents

- [Getting Started](#getting-started)
- [Plugin Types](#plugin-types)
- [Development Setup](#development-setup)
- [Creating Your First Plugin](#creating-your-first-plugin)
- [Testing Plugins](#testing-plugins)
- [Publishing Plugins](#publishing-plugins)
- [Best Practices](#best-practices)

## Getting Started

### Prerequisites

- Node.js 18.0 or higher
- VS Code 1.85.0 or higher
- TypeScript 5.0 or higher
- Kiro Automation Extension installed

### What You Can Build

Plugins can extend the Kiro Automation Extension in several ways:

1. **Task Processors**: Custom logic for executing specific types of tasks
2. **Prompt Generators**: Custom prompt templates and generation logic
3. **Completion Detectors**: Custom logic for detecting task completion
4. **UI Extensions**: Custom panels, views, and visualizations
5. **Event Handlers**: React to automation events

## Plugin Types

### 1. Task Processor Plugin

Process tasks with custom logic:

```typescript
interface TaskProcessor {
  readonly id: string;
  readonly name: string;
  canProcess(task: Task, context: ExecutionContext): boolean;
  process(task: Task, context: ExecutionContext): Promise<ExecutionResult>;
}
```

**Use Cases:**
- Running tests
- Building projects
- Deploying applications
- Custom validation
- Integration with external tools

### 2. Prompt Generator Plugin

Generate custom prompts for tasks:

```typescript
interface PromptGenerator {
  readonly id: string;
  readonly name: string;
  canGenerate(task: Task, context: ExecutionContext): boolean;
  generate(task: Task, context: ExecutionContext): Promise<string>;
}
```

**Use Cases:**
- Domain-specific prompt templates
- Multi-language prompts
- Context-aware prompt generation
- Integration with prompt libraries

### 3. Completion Detector Plugin

Detect when tasks are complete:

```typescript
interface CompletionDetector {
  readonly id: string;
  readonly name: string;
  canDetect(task: Task, context: ExecutionContext): boolean;
  detect(task: Task, context: ExecutionContext): Promise<CompletionResult>;
}
```

**Use Cases:**
- File-based completion detection
- Test result verification
- Build status checking
- Custom validation rules

## Development Setup

### 1. Create a New Extension

```bash
# Install Yeoman and VS Code Extension generator
npm install -g yo generator-code

# Generate a new extension
yo code

# Choose "New Extension (TypeScript)"
# Name: kiro-automation-my-plugin
```

### 2. Install Dependencies

```bash
cd kiro-automation-my-plugin
npm install

# Add Kiro Automation Extension types (if available)
npm install --save-dev @types/kiro-automation-extension
```

### 3. Configure package.json

```json
{
  "name": "kiro-automation-my-plugin",
  "displayName": "My Kiro Automation Plugin",
  "description": "Custom plugin for Kiro Automation",
  "version": "0.1.0",
  "engines": {
    "vscode": "^1.85.0"
  },
  "extensionDependencies": [
    "kiro.kiro-automation-extension"
  ],
  "activationEvents": [
    "onStartupFinished"
  ],
  "main": "./out/extension.js"
}
```

## Creating Your First Plugin

### Example: Test Runner Plugin

Let's create a plugin that automatically runs tests for test-related tasks.

#### 1. Create the Task Processor

```typescript
// src/TestRunnerProcessor.ts
import * as vscode from 'vscode';
import { Task, ExecutionContext, ExecutionResult, TaskProcessor } from 'kiro-automation-extension';

export class TestRunnerProcessor implements TaskProcessor {
  readonly id = 'test-runner-processor';
  readonly name = 'Test Runner Processor';

  canProcess(task: Task, context: ExecutionContext): boolean {
    // Handle tasks with "test" in the title
    const isTestTask = task.title.toLowerCase().includes('test');
    const hasTestCommand = task.description.some(line => 
      line.includes('npm test') || line.includes('yarn test')
    );
    return isTestTask || hasTestCommand;
  }

  async process(task: Task, context: ExecutionContext): Promise<ExecutionResult> {
    const startTime = Date.now();

    try {
      // Determine test command
      const testCommand = this.getTestCommand(task);
      
      // Create terminal and run tests
      const terminal = vscode.window.createTerminal({
        name: `Test: ${task.title}`,
        cwd: context.workspace.uri.fsPath,
      });

      terminal.show();
      terminal.sendText(testCommand);

      // Wait for tests to complete
      const success = await this.waitForTestCompletion(terminal, 60000);

      const duration = Date.now() - startTime;

      if (success) {
        return {
          success: true,
          message: 'Tests passed successfully',
          duration,
          data: { testCommand },
        };
      } else {
        return {
          success: false,
          message: 'Tests failed',
          duration,
          data: { testCommand },
        };
      }
    } catch (error) {
      return {
        success: false,
        message: `Test execution error: ${error}`,
        error: error as Error,
        duration: Date.now() - startTime,
      };
    }
  }

  private getTestCommand(task: Task): string {
    // Extract test command from task description
    for (const line of task.description) {
      if (line.includes('npm test') || line.includes('yarn test')) {
        return line.trim();
      }
    }
    return 'npm test'; // Default
  }

  private async waitForTestCompletion(
    terminal: vscode.Terminal,
    timeout: number
  ): Promise<boolean> {
    // Simplified: In real implementation, monitor terminal output
    return new Promise((resolve) => {
      setTimeout(() => resolve(true), timeout);
    });
  }
}
```

#### 2. Register the Plugin

```typescript
// src/extension.ts
import * as vscode from 'vscode';
import { TestRunnerProcessor } from './TestRunnerProcessor';

export function activate(context: vscode.ExtensionContext) {
  console.log('Test Runner Plugin activated');

  // Get Kiro Automation Extension API
  const kiroAutomation = vscode.extensions.getExtension('kiro.kiro-automation-extension');

  if (!kiroAutomation) {
    vscode.window.showErrorMessage('Kiro Automation Extension not found');
    return;
  }

  if (!kiroAutomation.isActive) {
    // Wait for activation
    kiroAutomation.activate().then(() => {
      registerPlugin(context, kiroAutomation.exports);
    });
  } else {
    registerPlugin(context, kiroAutomation.exports);
  }
}

function registerPlugin(context: vscode.ExtensionContext, api: any) {
  // Register the test runner processor
  const processor = new TestRunnerProcessor();
  const disposable = api.registerTaskProcessor(processor);
  
  context.subscriptions.push(disposable);

  vscode.window.showInformationMessage('Test Runner Plugin registered successfully');
}

export function deactivate() {
  console.log('Test Runner Plugin deactivated');
}
```

#### 3. Build and Test

```bash
# Compile TypeScript
npm run compile

# Launch Extension Development Host
# Press F5 in VS Code
```

## Testing Plugins

### Unit Tests

```typescript
// src/test/TestRunnerProcessor.test.ts
import * as assert from 'assert';
import { TestRunnerProcessor } from '../TestRunnerProcessor';
import { Task, ExecutionContext } from 'kiro-automation-extension';

suite('TestRunnerProcessor', () => {
  test('canProcess returns true for test tasks', () => {
    const processor = new TestRunnerProcessor();
    const task: Task = {
      id: '1.1',
      title: 'Write unit tests',
      description: ['Create unit tests for the feature'],
      status: 'pending',
      subtasks: [],
      requirements: [],
      specName: 'test-spec',
      filePath: '/path/to/tasks.md',
      lineNumber: 10,
      optional: false,
    };

    const context: ExecutionContext = {
      // Mock context
    } as any;

    assert.strictEqual(processor.canProcess(task, context), true);
  });

  test('canProcess returns false for non-test tasks', () => {
    const processor = new TestRunnerProcessor();
    const task: Task = {
      id: '1.1',
      title: 'Implement feature',
      description: ['Implement the new feature'],
      status: 'pending',
      subtasks: [],
      requirements: [],
      specName: 'test-spec',
      filePath: '/path/to/tasks.md',
      lineNumber: 10,
      optional: false,
    };

    const context: ExecutionContext = {} as any;

    assert.strictEqual(processor.canProcess(task, context), false);
  });
});
```

### Integration Tests

```typescript
// src/test/integration.test.ts
import * as vscode from 'vscode';
import * as assert from 'assert';

suite('Plugin Integration Tests', () => {
  test('Plugin registers successfully', async () => {
    const kiroAutomation = vscode.extensions.getExtension('kiro.kiro-automation-extension');
    assert.ok(kiroAutomation, 'Kiro Automation Extension should be available');

    if (!kiroAutomation.isActive) {
      await kiroAutomation.activate();
    }

    assert.ok(kiroAutomation.isActive, 'Kiro Automation Extension should be active');
  });
});
```

## Publishing Plugins

### 1. Prepare for Publishing

```bash
# Install vsce (VS Code Extension Manager)
npm install -g @vscode/vsce

# Update version
npm version patch

# Create package
vsce package
```

### 2. Publish to Marketplace

```bash
# Create publisher account at https://marketplace.visualstudio.com/

# Login
vsce login <publisher-name>

# Publish
vsce publish
```

### 3. Update README

Include clear documentation:

```markdown
# My Kiro Automation Plugin

## Features

- Automatically runs tests for test-related tasks
- Supports npm and yarn test commands
- Provides detailed test results

## Installation

1. Install Kiro Automation Extension
2. Install this plugin from VS Code Marketplace
3. Reload VS Code

## Usage

Tasks with "test" in the title will automatically use this plugin.

## Configuration

No configuration required.
```

## Best Practices

### 1. Error Handling

Always handle errors gracefully:

```typescript
async process(task: Task, context: ExecutionContext): Promise<ExecutionResult> {
  try {
    // Your logic
    return { success: true, message: 'Success' };
  } catch (error) {
    console.error('Processing error:', error);
    return {
      success: false,
      message: `Error: ${error}`,
      error: error as Error,
    };
  }
}
```

### 2. Logging

Use proper logging for debugging:

```typescript
import * as vscode from 'vscode';

const outputChannel = vscode.window.createOutputChannel('My Plugin');

outputChannel.appendLine(`Processing task: ${task.title}`);
outputChannel.show();
```

### 3. Configuration

Allow users to configure your plugin:

```json
// package.json
{
  "contributes": {
    "configuration": {
      "title": "My Plugin",
      "properties": {
        "myPlugin.testCommand": {
          "type": "string",
          "default": "npm test",
          "description": "Command to run tests"
        }
      }
    }
  }
}
```

```typescript
// Access configuration
const config = vscode.workspace.getConfiguration('myPlugin');
const testCommand = config.get<string>('testCommand', 'npm test');
```

### 4. Performance

Optimize for performance:

```typescript
// Cache expensive operations
private cache = new Map<string, any>();

async process(task: Task, context: ExecutionContext): Promise<ExecutionResult> {
  const cacheKey = `${task.id}-${task.specName}`;
  
  if (this.cache.has(cacheKey)) {
    return this.cache.get(cacheKey);
  }

  const result = await this.doExpensiveOperation(task, context);
  this.cache.set(cacheKey, result);
  
  return result;
}
```

### 5. Resource Cleanup

Clean up resources properly:

```typescript
export function deactivate() {
  // Clean up resources
  if (terminal) {
    terminal.dispose();
  }
  
  if (outputChannel) {
    outputChannel.dispose();
  }
  
  cache.clear();
}
```

### 6. User Feedback

Provide clear feedback to users:

```typescript
async process(task: Task, context: ExecutionContext): Promise<ExecutionResult> {
  // Show progress
  await vscode.window.withProgress(
    {
      location: vscode.ProgressLocation.Notification,
      title: `Processing: ${task.title}`,
      cancellable: false,
    },
    async (progress) => {
      progress.report({ increment: 0, message: 'Starting...' });
      
      // Do work
      await this.doWork(task, context);
      
      progress.report({ increment: 100, message: 'Complete!' });
    }
  );

  return { success: true, message: 'Task completed' };
}
```

### 7. Documentation

Document your code thoroughly:

```typescript
/**
 * Test Runner Processor
 * 
 * Automatically runs tests for tasks that include "test" in their title
 * or have test commands in their description.
 * 
 * @example
 * ```typescript
 * const processor = new TestRunnerProcessor();
 * const result = await processor.process(task, context);
 * ```
 */
export class TestRunnerProcessor implements TaskProcessor {
  /**
   * Unique identifier for this processor
   */
  readonly id = 'test-runner-processor';

  /**
   * Display name shown in UI
   */
  readonly name = 'Test Runner Processor';

  /**
   * Determines if this processor can handle the given task
   * 
   * @param task - The task to check
   * @param context - Execution context
   * @returns true if this processor should handle the task
   */
  canProcess(task: Task, context: ExecutionContext): boolean {
    // Implementation
  }
}
```

## Common Use Cases

### 1. Database Migration Plugin

```typescript
class DatabaseMigrationProcessor implements TaskProcessor {
  readonly id = 'db-migration-processor';
  readonly name = 'Database Migration Processor';

  canProcess(task: Task, context: ExecutionContext): boolean {
    return task.title.toLowerCase().includes('migration');
  }

  async process(task: Task, context: ExecutionContext): Promise<ExecutionResult> {
    // Run database migrations
    const terminal = vscode.window.createTerminal('DB Migration');
    terminal.sendText('npm run migrate');
    
    // Wait and verify
    await this.waitForMigration();
    
    return { success: true, message: 'Migration completed' };
  }
}
```

### 2. Code Quality Plugin

```typescript
class CodeQualityProcessor implements TaskProcessor {
  readonly id = 'code-quality-processor';
  readonly name = 'Code Quality Processor';

  canProcess(task: Task, context: ExecutionContext): boolean {
    return task.title.toLowerCase().includes('lint') || 
           task.title.toLowerCase().includes('format');
  }

  async process(task: Task, context: ExecutionContext): Promise<ExecutionResult> {
    // Run linter and formatter
    const terminal = vscode.window.createTerminal('Code Quality');
    terminal.sendText('npm run lint && npm run format');
    
    return { success: true, message: 'Code quality checks passed' };
  }
}
```

### 3. Documentation Generator Plugin

```typescript
class DocumentationGenerator implements TaskProcessor {
  readonly id = 'doc-generator';
  readonly name = 'Documentation Generator';

  canProcess(task: Task, context: ExecutionContext): boolean {
    return task.title.toLowerCase().includes('documentation');
  }

  async process(task: Task, context: ExecutionContext): Promise<ExecutionResult> {
    // Generate documentation
    const terminal = vscode.window.createTerminal('Doc Generator');
    terminal.sendText('npm run docs');
    
    return { success: true, message: 'Documentation generated' };
  }
}
```

## Support and Resources

- **API Documentation**: [API.md](./API.md)
- **Examples**: [examples/](./examples/)
- **GitHub Issues**: [Report issues](https://github.com/your-org/kiro-automation-extension/issues)
- **Discussions**: [Join discussions](https://github.com/your-org/kiro-automation-extension/discussions)

## Contributing

We welcome plugin contributions! Please see our [Contributing Guide](CONTRIBUTING.md) for details.

## License

MIT License - see [LICENSE](LICENSE) file for details.
