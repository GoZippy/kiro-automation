# Plugin System Integration Guide

This guide explains how to integrate the plugin system with the existing Kiro Automation Extension components.

## Integration with AutomationEngine

The AutomationEngine should be modified to use plugins for task processing:

```typescript
import { PluginRegistry } from './plugins';

class AutomationEngine {
  private pluginRegistry?: PluginRegistry;

  async initialize(
    taskManager: TaskManager,
    kiroInterface: KiroInterface,
    notificationService: NotificationService,
    context?: vscode.ExtensionContext
  ): Promise<void> {
    // ... existing initialization ...

    // Initialize plugin registry
    if (context) {
      this.pluginRegistry = new PluginRegistry();
      
      // Discover and load plugins
      const pluginPaths = await this.pluginRegistry.discoverPlugins();
      await this.pluginRegistry.loadPlugins(pluginPaths);
    }
  }

  private async executeTask(task: Task): Promise<void> {
    // Get task processors from plugin registry
    const taskProcessors = this.pluginRegistry?.getTaskProcessors() || [];

    // Pre-process task
    for (const processor of taskProcessors) {
      if (processor.preProcess) {
        const result = await processor.preProcess({
          task,
          spec: this.currentSpec,
          execution: this.currentExecution,
        });

        if (!result.continue) {
          throw new Error('Task processing cancelled by plugin');
        }
      }
    }

    // ... existing task execution logic ...

    // Post-process task
    for (const processor of taskProcessors) {
      if (processor.postProcess) {
        await processor.postProcess({
          task,
          spec: this.currentSpec,
          execution: this.currentExecution,
        });
      }
    }
  }
}
```

## Integration with PromptGenerator

Enhance the existing PromptGenerator to use plugin prompt generators:

```typescript
import { PluginRegistry } from './plugins';

class PromptGenerator {
  private pluginRegistry?: PluginRegistry;

  setPluginRegistry(registry: PluginRegistry): void {
    this.pluginRegistry = registry;
  }

  async generatePrompt(
    task: Task,
    spec: SpecificationContext,
    options?: PromptGenerationOptions
  ): Promise<string> {
    // Try plugin prompt generators first
    const pluginGenerators = this.pluginRegistry?.getPromptGenerators() || [];

    for (const generator of pluginGenerators) {
      try {
        const result = await generator.generatePrompt({
          task,
          spec,
          execution: this.currentExecution,
          requirementsContent: await this.readSpecFile(spec, 'requirements.md'),
          designContent: await this.readSpecFile(spec, 'design.md'),
        });

        if (result.success) {
          return result.prompt;
        }
      } catch (error) {
        console.warn(`Plugin prompt generator failed: ${error}`);
      }
    }

    // Fall back to default prompt generation
    return this.generateDefaultPrompt(task, spec, options);
  }
}
```

## Integration with CompletionDetector

Enhance the existing CompletionDetector to use plugin completion detectors:

```typescript
import { PluginRegistry } from './plugins';

class CompletionDetector {
  private pluginRegistry?: PluginRegistry;

  setPluginRegistry(registry: PluginRegistry): void {
    this.pluginRegistry = registry;
  }

  async monitorCompletion(task: Task, timeout: number = 300000): Promise<CompletionDetectionResult> {
    return new Promise((resolve) => {
      const checkInterval = 1000;

      const intervalHandle = setInterval(async () => {
        const result = await this.checkCompletion(task);

        if (result.completed) {
          clearInterval(intervalHandle);
          resolve(result);
        }
      }, checkInterval);
    });
  }

  private async checkCompletion(task: Task): Promise<CompletionDetectionResult> {
    // Get plugin completion detectors
    const pluginDetectors = this.pluginRegistry?.getCompletionDetectors() || [];

    const results: CompletionDetectionResult[] = [];

    // Try plugin detectors
    for (const detector of pluginDetectors) {
      try {
        const result = await detector.detectCompletion({
          task,
          spec: this.currentSpec,
          execution: this.currentExecution,
          response: this.lastResponse,
          fileChanges: this.fileChanges,
          elapsedTime: Date.now() - this.startTime,
        });

        results.push(result);
      } catch (error) {
        console.warn(`Plugin completion detector failed: ${error}`);
      }
    }

    // Add default detection
    results.push(this.detectCompletionDefault(task));

    // Combine results
    return this.combineDetectionResults(results);
  }
}
```

## Integration with Extension Entry Point

Update the extension.ts to initialize the plugin system:

```typescript
import { PluginRegistry, ExtensionPointManager } from './plugins';

export async function activate(context: vscode.ExtensionContext) {
  // Initialize plugin system
  const pluginRegistry = new PluginRegistry();
  const extensionPointManager = new ExtensionPointManager(context);

  // Discover and load plugins
  const pluginPaths = await pluginRegistry.discoverPlugins();
  await pluginRegistry.loadPlugins(pluginPaths);

  // Initialize automation engine with plugin support
  const automationEngine = new AutomationEngine();
  const taskManager = new TaskManager();
  const kiroInterface = new KiroInterface();
  const notificationService = new NotificationService();

  await automationEngine.initialize(
    taskManager,
    kiroInterface,
    notificationService,
    context
  );

  // Set plugin registry on components
  automationEngine.setPluginRegistry(pluginRegistry);
  
  const promptGenerator = new PromptGenerator();
  promptGenerator.setPluginRegistry(pluginRegistry);
  
  const completionDetector = new CompletionDetector();
  completionDetector.setPluginRegistry(pluginRegistry);

  // Register commands
  context.subscriptions.push(
    vscode.commands.registerCommand('kiro-automation.start', async () => {
      // Execute pre-start extension points
      await extensionPointManager.executeExtensionPoints(
        ExtensionPointType.AUTOMATION_LIFECYCLE,
        { extensionContext: context },
        { event: 'start' }
      );

      await automationEngine.start();
    }),

    vscode.commands.registerCommand('kiro-automation.listPlugins', async () => {
      const plugins = pluginRegistry.getAllPluginMetadata();
      const stats = pluginRegistry.getStatistics();

      vscode.window.showInformationMessage(
        `Loaded ${stats.total} plugins (${stats.activated} activated)`
      );
    }),

    vscode.commands.registerCommand('kiro-automation.reloadPlugins', async () => {
      // Reload plugins
      await pluginRegistry.dispose();
      const newRegistry = new PluginRegistry();
      const paths = await newRegistry.discoverPlugins();
      await newRegistry.loadPlugins(paths);

      vscode.window.showInformationMessage('Plugins reloaded');
    })
  );

  // Listen to plugin events
  pluginRegistry.on('pluginRegistered', (pluginId, plugin) => {
    console.log(`Plugin registered: ${pluginId}`);
  });

  pluginRegistry.on('pluginError', (error) => {
    console.error(`Plugin error: ${error}`);
  });

  // Cleanup on deactivation
  context.subscriptions.push({
    dispose: async () => {
      await pluginRegistry.dispose();
      extensionPointManager.dispose();
    },
  });
}
```

## Configuration

Add plugin configuration to package.json:

```json
{
  "contributes": {
    "configuration": {
      "properties": {
        "kiro-automation.plugins.enabled": {
          "type": "boolean",
          "default": true,
          "description": "Enable plugin system"
        },
        "kiro-automation.plugins.searchPaths": {
          "type": "array",
          "default": [".kiro/plugins", "plugins"],
          "description": "Directories to search for plugins"
        },
        "kiro-automation.plugins.autoLoad": {
          "type": "boolean",
          "default": true,
          "description": "Automatically load plugins on startup"
        },
        "kiro-automation.plugins.configurations": {
          "type": "object",
          "default": {},
          "description": "Plugin-specific configurations"
        }
      }
    },
    "commands": [
      {
        "command": "kiro-automation.listPlugins",
        "title": "List Plugins",
        "category": "Kiro Automation"
      },
      {
        "command": "kiro-automation.reloadPlugins",
        "title": "Reload Plugins",
        "category": "Kiro Automation"
      }
    ]
  }
}
```

## Testing Integration

Create integration tests to verify plugin system works with existing components:

```typescript
import { describe, it, expect } from 'mocha';
import { PluginRegistry } from './plugins';
import { AutomationEngine } from './AutomationEngine';

describe('Plugin Integration', () => {
  it('should integrate with AutomationEngine', async () => {
    const registry = new PluginRegistry();
    const engine = new AutomationEngine();

    // Load test plugin
    const plugin = createTestPlugin();
    await registry.registerPlugin(plugin);

    // Verify plugin is used during execution
    engine.setPluginRegistry(registry);
    // ... test execution ...
  });

  it('should use plugin prompt generators', async () => {
    const registry = new PluginRegistry();
    const generator = new PromptGenerator();

    // Load test plugin
    const plugin = createTestPlugin();
    await registry.registerPlugin(plugin);

    generator.setPluginRegistry(registry);

    // Verify plugin generator is used
    const prompt = await generator.generatePrompt(testTask, testSpec);
    expect(prompt).to.include('custom plugin prompt');
  });
});
```

## Migration Path

For existing installations:

1. **Phase 1**: Add plugin system alongside existing code (no breaking changes)
2. **Phase 2**: Gradually migrate existing functionality to use plugins
3. **Phase 3**: Deprecate old APIs in favor of plugin-based approach
4. **Phase 4**: Remove deprecated code in major version update

## Best Practices

1. **Graceful Degradation** - System should work without plugins
2. **Error Handling** - Plugin errors shouldn't crash the extension
3. **Performance** - Monitor plugin impact on performance
4. **Security** - Validate plugin code before loading
5. **Documentation** - Document plugin integration points clearly

## Troubleshooting

### Plugins Not Loading

Check:
- Plugin search paths in configuration
- Plugin file naming (*.plugin.js, *.plugin.ts)
- Plugin export format (factory function or instance)
- Console for error messages

### Plugin Errors

Check:
- Plugin validation errors
- Missing dependencies
- Incorrect interface implementation
- Runtime errors in plugin code

### Performance Issues

Check:
- Number of active plugins
- Plugin execution time
- Memory usage
- Event subscription overhead

## Next Steps

1. Implement plugin system integration in AutomationEngine
2. Add plugin configuration UI
3. Create plugin development tools
4. Build plugin marketplace/repository
5. Write comprehensive integration tests
