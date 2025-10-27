# Plugin System

The Kiro Automation Extension provides a comprehensive plugin system that allows developers to extend and customize automation behavior.

## Overview

The plugin system consists of three main components:

1. **Plugin Interfaces** - Define the contracts for plugins
2. **Plugin Registry** - Manages plugin registration, activation, and lifecycle
3. **Extension Points** - Provides hooks for UI customization and event handling

## Plugin Types

### TaskProcessor

Allows custom processing of tasks before, during, and after execution.

```typescript
interface TaskProcessor {
  preProcess?(context: TaskProcessorContext): Promise<TaskProcessorResult>;
  process?(context: TaskProcessorContext): Promise<TaskProcessorResult>;
  postProcess?(context: TaskProcessorContext): Promise<TaskProcessorResult>;
  onTaskFailed?(context: TaskProcessorContext, error: Error): Promise<TaskProcessorResult>;
  onTaskCompleted?(context: TaskProcessorContext): Promise<TaskProcessorResult>;
}
```

**Use Cases:**
- Custom validation logic
- Task transformation
- Logging and metrics
- Error handling strategies

### PromptGenerator

Allows custom prompt generation logic for task execution.

```typescript
interface PromptGenerator {
  generatePrompt(context: PromptGenerationContext): Promise<PromptGenerationResult>;
  generateSubtaskPrompt?(context: PromptGenerationContext, subtask: SubTask): Promise<PromptGenerationResult>;
  generateRetryPrompt?(context: PromptGenerationContext): Promise<PromptGenerationResult>;
  validatePrompt?(prompt: string): { valid: boolean; errors: string[] };
}
```

**Use Cases:**
- Custom prompt templates
- Context-aware prompt generation
- Language-specific prompts
- Project-specific formatting

### CompletionDetector

Allows custom completion detection logic.

```typescript
interface CompletionDetector {
  detectCompletion(context: CompletionDetectionContext): Promise<CompletionDetectionResult>;
  detectCompletionFromResponse?(context: CompletionDetectionContext): Promise<CompletionDetectionResult>;
  detectCompletionFromFileChanges?(context: CompletionDetectionContext): Promise<CompletionDetectionResult>;
  handleAmbiguousState?(result: CompletionDetectionResult, context: CompletionDetectionContext): Promise<CompletionDetectionResult>;
}
```

**Use Cases:**
- Custom completion indicators
- Project-specific completion criteria
- Integration with external tools
- Advanced heuristics

## Creating a Plugin

### Basic Plugin Structure

```typescript
import { Plugin, PluginMetadata, PluginCapabilities } from './PluginInterfaces';

export class MyPlugin implements Plugin {
  metadata: PluginMetadata = {
    id: 'my-plugin',
    name: 'My Plugin',
    version: '1.0.0',
    description: 'My custom plugin',
  };

  capabilities: PluginCapabilities = {
    taskProcessor: true,
    promptGenerator: false,
    completionDetector: false,
  };

  taskProcessor = new MyTaskProcessor();

  async activate(): Promise<void> {
    console.log('MyPlugin activated');
  }

  async deactivate(): Promise<void> {
    console.log('MyPlugin deactivated');
  }
}

// Export as factory function
export default function createPlugin(): Plugin {
  return new MyPlugin();
}
```

### Plugin Lifecycle

1. **Registration** - Plugin is registered with the registry
2. **Validation** - Plugin is validated for correctness
3. **Activation** - Plugin's `activate()` method is called
4. **Usage** - Plugin is used during automation
5. **Deactivation** - Plugin's `deactivate()` method is called
6. **Unregistration** - Plugin is removed from registry

## Using the Plugin Registry

### Registering a Plugin

```typescript
import { PluginRegistry } from './PluginRegistry';
import { MyPlugin } from './MyPlugin';

const registry = new PluginRegistry();
const plugin = new MyPlugin();

await registry.registerPlugin(plugin, {
  enabled: true,
  priority: 10,
  config: {
    customSetting: 'value',
  },
});
```

### Discovering and Loading Plugins

```typescript
// Discover plugins in workspace
const pluginPaths = await registry.discoverPlugins({
  searchPaths: ['.kiro/plugins', 'plugins'],
  filePatterns: ['*.plugin.js', '*.plugin.ts'],
  recursive: true,
});

// Load discovered plugins
const loadedPluginIds = await registry.loadPlugins(pluginPaths);
```

### Getting Plugins by Capability

```typescript
// Get all task processors
const taskProcessors = registry.getTaskProcessors();

// Get all prompt generators
const promptGenerators = registry.getPromptGenerators();

// Get all completion detectors
const completionDetectors = registry.getCompletionDetectors();
```

## Extension Points

Extension points allow plugins to hook into various parts of the automation system.

### Registering Extension Points

```typescript
import { ExtensionPointManager, ExtensionPointType } from './ExtensionPoints';

const extensionPointManager = new ExtensionPointManager(extensionContext);

extensionPointManager.registerExtensionPoint({
  id: 'my-extension-point',
  type: ExtensionPointType.TASK_EXECUTION,
  name: 'My Extension Point',
  pluginId: 'my-plugin',
  handler: async (context, data) => {
    console.log('Extension point executed', context, data);
  },
  priority: 10,
  enabled: true,
});
```

### UI Customization

```typescript
extensionPointManager.registerUICustomizations('my-plugin', {
  statusBarItems: [
    {
      id: 'my-status',
      text: '$(check) My Status',
      tooltip: 'My custom status',
      command: 'my-plugin.showStatus',
    },
  ],
  treeViewProviders: [
    {
      id: 'my-tree-view',
      name: 'My Tree View',
      provider: new MyTreeDataProvider(),
    },
  ],
});
```

### Custom Commands

```typescript
extensionPointManager.registerCommand('my-plugin', {
  commandId: 'my-plugin.myCommand',
  title: 'My Command',
  handler: async () => {
    console.log('Command executed');
  },
  category: 'My Plugin',
});
```

### Event Subscriptions

```typescript
extensionPointManager.subscribeToEvent('my-plugin', {
  eventName: 'taskCompleted',
  handler: (task) => {
    console.log('Task completed:', task);
  },
  filter: (task) => task.status === 'completed',
});
```

## Plugin Configuration

Plugins can be configured through VS Code settings:

```json
{
  "kiro-automation.plugins": {
    "my-plugin": {
      "enabled": true,
      "priority": 10,
      "config": {
        "customSetting": "value"
      }
    }
  }
}
```

## Best Practices

1. **Keep plugins focused** - Each plugin should have a single, well-defined purpose
2. **Handle errors gracefully** - Always catch and handle errors in plugin code
3. **Use lifecycle hooks** - Properly implement activate/deactivate for resource management
4. **Document your plugin** - Provide clear documentation for users
5. **Test thoroughly** - Write tests for your plugin functionality
6. **Version carefully** - Use semantic versioning and document breaking changes
7. **Respect priorities** - Use priority values to control execution order
8. **Validate inputs** - Always validate data passed to your plugin

## Example Plugin

See `examples/ExamplePlugin.ts` for a complete example demonstrating all plugin capabilities.

## API Reference

For detailed API documentation, see the TypeScript interfaces in `PluginInterfaces.ts`.

## Troubleshooting

### Plugin Not Loading

- Check that the plugin file exports a factory function or plugin instance
- Verify the plugin metadata is complete and valid
- Check the console for error messages

### Plugin Not Activating

- Ensure the plugin is enabled in configuration
- Check that dependencies are satisfied
- Verify the activate() method doesn't throw errors

### Extension Points Not Working

- Verify the extension point is registered correctly
- Check that the extension point type matches the usage
- Ensure the handler function is properly defined

## Contributing

To contribute a plugin to the official collection:

1. Create your plugin following the guidelines above
2. Add comprehensive tests
3. Document your plugin thoroughly
4. Submit a pull request with your plugin

## License

The plugin system is part of the Kiro Automation Extension and follows the same license.
