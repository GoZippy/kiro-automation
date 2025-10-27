# Kiro Automation Extension

A powerful VS Code extension that enables fully autonomous task execution within the Kiro IDE environment. Automate your development workflow by programmatically executing tasks from Kiro spec files, with intelligent error handling, progress monitoring, and multi-workspace support.

## Table of Contents

- [Features](#features)
- [Requirements](#requirements)
- [Installation](#installation)
- [Quick Start](#quick-start)
- [Usage](#usage)
- [Configuration](#configuration)
- [Troubleshooting](#troubleshooting)
- [Advanced Features](#advanced-features)
- [Development](#development)
- [Contributing](#contributing)
- [License](#license)

## Features

### Core Capabilities

- **Autonomous Task Execution**: Automatically execute tasks from `.kiro/specs/*/tasks.md` files without manual intervention
- **Intelligent Progress Monitoring**: Real-time progress tracking with detailed status updates and completion detection
- **Robust Error Handling**: Exponential backoff retry logic with configurable attempts and automatic error recovery
- **Multi-Workspace Support**: Execute automation across multiple workspace folders simultaneously with independent sessions
- **Task Dependency Resolution**: Automatically determine task execution order based on dependencies and IDs
- **Session Persistence**: Resume automation sessions after VS Code restarts with full state recovery
- **Performance Monitoring**: Track memory usage, CPU utilization, and execution metrics in real-time
- **Comprehensive Logging**: Multi-level logging (debug, info, warning, error) with file export and search capabilities
- **Flexible Configuration**: Workspace-specific and global settings with hot-reload support

### User Interface

- **Task Tree View**: Visual representation of all specs and tasks with status indicators
- **Progress Panel**: Real-time webview panel showing current task, completion percentage, and estimated time
- **Control Panel**: Start, stop, pause, and resume automation with intuitive controls
- **Status Bar Integration**: Quick access to automation status and controls from the VS Code status bar
- **Log Viewer**: Integrated output channel with filtering, search, and export functionality
- **Workspace Selector**: Easy switching between multiple workspace automation sessions

### Integration

- **Kiro IDE Integration**: Seamless communication with Kiro's chat system and task management
- **File System Monitoring**: Automatic detection of task file changes with debounced updates
- **Notification System**: Configurable notifications for task completion, errors, and important events
- **Plugin Architecture**: Extensible design with support for custom task processors and prompt generators

## Requirements

- **VS Code**: Version 1.85.0 or higher
- **Kiro IDE**: Kiro extension must be installed and active
- **Node.js**: Version 18.0 or higher (for development)
- **Operating System**: Windows, macOS, or Linux

## Installation

### From VS Code Marketplace (Recommended)

1. Open VS Code
2. Go to Extensions view (`Ctrl+Shift+X` or `Cmd+Shift+X` on macOS)
3. Search for "Kiro Automation Extension"
4. Click **Install**
5. Reload VS Code when prompted

### From VSIX File

1. Download the latest `.vsix` file from the [releases page](https://github.com/your-org/kiro-automation-extension/releases)
2. Open VS Code
3. Go to Extensions view (`Ctrl+Shift+X`)
4. Click the `...` menu at the top-right
5. Select **Install from VSIX...**
6. Navigate to and select the downloaded `.vsix` file
7. Reload VS Code when prompted

### From Source (Development)

```bash
# Clone the repository
git clone https://github.com/your-org/kiro-automation-extension.git
cd kiro-automation-extension

# Install dependencies
npm install

# Compile TypeScript
npm run compile

# Launch extension in debug mode
# Press F5 in VS Code or run:
code --extensionDevelopmentPath=.
```

## Quick Start

### 1. Verify Installation

After installation, verify the extension is active:

1. Open Command Palette (`Ctrl+Shift+P` or `Cmd+Shift+P`)
2. Type "Kiro Automation" - you should see available commands
3. Check the status bar for the Kiro Automation indicator

### 2. Prepare Your Workspace

Ensure your workspace has the required structure:

```
your-project/
└── .kiro/
    └── specs/
        └── your-feature/
            ├── requirements.md
            ├── design.md
            └── tasks.md
```

### 3. Start Automation

**Method 1: Command Palette**
1. Open Command Palette (`Ctrl+Shift+P`)
2. Run: `Kiro Automation: Start`
3. Select the spec to automate (or choose "All Specs")

**Method 2: Task Tree View**
1. Open the Explorer sidebar
2. Find "Kiro Automation Tasks" view
3. Click the play icon (▶) in the view title

**Method 3: Status Bar**
1. Click the Kiro Automation status bar item
2. Select "Start Automation"

### 4. Monitor Progress

- **Progress Panel**: View real-time progress in the webview panel
- **Task Tree**: Watch task status indicators update (`[ ]` → `[~]` → `[x]`)
- **Log Viewer**: Open with `Kiro Automation: Show Logs` to see detailed execution logs
- **Status Bar**: Shows current task and overall progress

## Usage

### Available Commands

Access all commands via Command Palette (`Ctrl+Shift+P`):

#### Automation Control
- **Kiro Automation: Start** - Start automation session for current workspace
- **Kiro Automation: Stop** - Stop running automation session
- **Kiro Automation: Pause** - Pause automation (can be resumed later)
- **Kiro Automation: Resume** - Resume paused automation session
- **Kiro Automation: Execute Next Task** - Execute only the next pending task

#### Multi-Workspace
- **Kiro Automation: Start Concurrent Automation** - Run automation on multiple workspaces
- **Kiro Automation: Stop Concurrent Automation** - Stop all concurrent sessions
- **Kiro Automation: Switch Workspace** - Switch between workspace automation sessions
- **Kiro Automation: Select Workspace** - Choose active workspace for automation

#### UI and Monitoring
- **Kiro Automation: Show Progress Panel** - Open progress monitoring webview
- **Kiro Automation: Show Control Panel** - Open automation control panel
- **Kiro Automation: Show Logs** - Display automation logs in output channel
- **Kiro Automation: Refresh Tasks** - Manually refresh task list from files

#### Logging
- **Kiro Automation: Clear Logs** - Clear all logs from output channel
- **Kiro Automation: Export Logs** - Export logs to JSON or CSV file
- **Kiro Automation: Open Log File** - Open log file in editor

#### Configuration
- **Kiro Automation: Show Workspace Configuration** - View workspace-specific settings
- **Kiro Automation: Edit Workspace Configuration** - Edit workspace settings
- **Kiro Automation: Reset Workspace Configuration** - Reset to default settings

### Task File Format

Tasks are defined in `.kiro/specs/*/tasks.md` files using markdown format:

```markdown
# Implementation Plan

- [ ] 1. First task
  - Task description and details
  - _Requirements: 1.1, 1.2_

- [ ] 2. Second task with subtasks
  - [ ] 2.1 First subtask
    - Subtask details
    - _Requirements: 2.1_
  
  - [ ]* 2.2 Optional subtask
    - Optional tasks are marked with asterisk
    - _Requirements: 2.2_

- [x] 3. Completed task
  - Already completed tasks are skipped
```

**Status Indicators:**
- `[ ]` - Pending task
- `[~]` - In progress
- `[x]` - Completed
- `[-]` - Skipped
- `*` suffix - Optional task (can be skipped)

### Automation Workflow

1. **Discovery**: Extension scans `.kiro/specs/*/tasks.md` files
2. **Parsing**: Tasks are parsed with status, dependencies, and requirements
3. **Queue Building**: Tasks are ordered based on IDs and dependencies
4. **Execution Loop**:
   - Mark task as in-progress (`[~]`)
   - Generate contextual prompt with requirements and design
   - Send prompt to Kiro chat
   - Monitor for completion
   - Verify completion and update status (`[x]`)
   - Move to next task
5. **Completion**: All tasks executed, session summary generated

### Working with Multiple Workspaces

When working with multi-root workspaces:

1. **View Workspaces**: Check "Kiro Workspaces" view in Explorer
2. **Select Active Workspace**: Use `Switch Workspace` command
3. **Concurrent Execution**: Use `Start Concurrent Automation` to run multiple workspaces
4. **Resource Allocation**: Configure per-workspace resource limits in settings

## Configuration

### Accessing Settings

**Method 1: Settings UI**
1. Open Settings (`Ctrl+,` or `Cmd+,`)
2. Search for "Kiro Automation"
3. Modify settings as needed

**Method 2: settings.json**
1. Open Command Palette
2. Run: `Preferences: Open Settings (JSON)`
3. Add configuration:

```json
{
  "kiro-automation.enabled": true,
  "kiro-automation.concurrency": 1,
  "kiro-automation.retryAttempts": 3,
  "kiro-automation.timeout": 300000,
  "kiro-automation.taskDelay": 2000,
  "kiro-automation.notifications": true,
  "kiro-automation.notificationLevel": "all",
  "kiro-automation.logLevel": "info",
  "kiro-automation.saveLogsToFile": true,
  "kiro-automation.maxLogFileSize": 10,
  "kiro-automation.autoResume": false,
  "kiro-automation.skipOptionalTasks": false,
  "kiro-automation.verifyCompletion": true,
  "kiro-automation.performanceMonitoring": true,
  "kiro-automation.maxMemoryUsage": 100,
  "kiro-automation.maxConcurrentWorkspaces": 2
}
```

### Configuration Reference

#### Core Settings

| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| `enabled` | boolean | `true` | Enable or disable automation |
| `concurrency` | number | `1` | Number of concurrent tasks (1-10) |
| `retryAttempts` | number | `3` | Retry attempts for failed tasks (0-10) |
| `timeout` | number | `300000` | Task timeout in milliseconds (1000-3600000) |
| `taskDelay` | number | `2000` | Delay between tasks in milliseconds |

#### Notifications

| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| `notifications` | boolean | `true` | Show completion notifications |
| `notificationLevel` | string | `"all"` | Notification level: `all`, `errors`, `none` |

#### Logging

| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| `logLevel` | string | `"info"` | Log level: `debug`, `info`, `warning`, `error` |
| `saveLogsToFile` | boolean | `true` | Save logs to file |
| `maxLogFileSize` | number | `10` | Maximum log file size in MB (1-1000) |

#### Automation Behavior

| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| `autoResume` | boolean | `false` | Auto-resume on VS Code restart |
| `skipOptionalTasks` | boolean | `false` | Skip tasks marked with `*` |
| `verifyCompletion` | boolean | `true` | Verify task completion before proceeding |
| `completionVerificationTimeout` | number | `30000` | Completion verification timeout (ms) |

#### Advanced Settings

| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| `customPromptTemplate` | string | `""` | Custom prompt template (empty = default) |
| `excludedSpecs` | array | `[]` | Spec names to exclude from automation |
| `excludedTasks` | array | `[]` | Task IDs to exclude from automation |
| `performanceMonitoring` | boolean | `true` | Enable performance monitoring |
| `maxMemoryUsage` | number | `100` | Maximum memory usage in MB (50-2000) |
| `maxConcurrentWorkspaces` | number | `2` | Max concurrent workspaces (1-10) |

### Workspace-Specific Configuration

Override global settings per workspace:

1. Create `.vscode/settings.json` in workspace root
2. Add workspace-specific overrides:

```json
{
  "kiro-automation.retryAttempts": 5,
  "kiro-automation.timeout": 600000,
  "kiro-automation.excludedTasks": ["17.3", "18.1"]
}
```

## Troubleshooting

### Common Issues

#### Extension Not Activating

**Symptoms**: No Kiro Automation commands appear in Command Palette

**Solutions**:
1. Verify `.kiro` directory exists in workspace root
2. Check VS Code version (must be 1.85.0+)
3. Reload VS Code window (`Developer: Reload Window`)
4. Check extension is enabled in Extensions view
5. Review Output panel (`Kiro Automation`) for errors

#### Kiro IDE Not Detected

**Symptoms**: Warning message "Kiro IDE not detected"

**Solutions**:
1. Ensure Kiro IDE extension is installed and active
2. Check Kiro extension version compatibility
3. Restart VS Code
4. Verify Kiro extension ID in Extensions view
5. Check logs: `Kiro Automation: Show Logs`

#### Tasks Not Discovered

**Symptoms**: Task tree view is empty or shows no tasks

**Solutions**:
1. Verify task files exist at `.kiro/specs/*/tasks.md`
2. Check task file format (must be valid markdown)
3. Run `Kiro Automation: Refresh Tasks`
4. Check file permissions (must be readable)
5. Review logs for parsing errors

#### Automation Stuck or Hanging

**Symptoms**: Task shows in-progress but never completes

**Solutions**:
1. Check `timeout` setting (increase if needed)
2. Verify Kiro chat is responding
3. Check for file system permission issues
4. Review task logs for errors
5. Stop and restart automation
6. Increase `completionVerificationTimeout` setting

#### High Memory Usage

**Symptoms**: VS Code becomes slow or unresponsive

**Solutions**:
1. Reduce `concurrency` setting to 1
2. Lower `maxMemoryUsage` setting
3. Disable `performanceMonitoring` temporarily
4. Clear logs: `Kiro Automation: Clear Logs`
5. Restart VS Code
6. Check for memory leaks in logs

#### Tasks Failing Repeatedly

**Symptoms**: Tasks fail even after retries

**Solutions**:
1. Check task requirements and design documents exist
2. Verify Kiro chat API is accessible
3. Increase `retryAttempts` setting
4. Review error messages in logs
5. Try executing task manually first
6. Check network connectivity

### Debug Mode

Enable detailed logging for troubleshooting:

1. Set `"kiro-automation.logLevel": "debug"` in settings
2. Restart automation session
3. Open logs: `Kiro Automation: Show Logs`
4. Review detailed execution information
5. Export logs: `Kiro Automation: Export Logs`

### Getting Help

If issues persist:

1. **Check Logs**: Export and review detailed logs
2. **GitHub Issues**: [Report an issue](https://github.com/your-org/kiro-automation-extension/issues)
3. **Documentation**: Review [full documentation](https://github.com/your-org/kiro-automation-extension/wiki)
4. **Community**: Join discussions in [GitHub Discussions](https://github.com/your-org/kiro-automation-extension/discussions)

## Advanced Features

### Custom Prompt Templates

Create custom prompts for task execution:

```json
{
  "kiro-automation.customPromptTemplate": "Execute task: {{taskTitle}}\n\nContext:\n{{requirements}}\n\nDesign:\n{{design}}\n\nInstructions:\n{{instructions}}"
}
```

Available variables:
- `{{taskTitle}}` - Task title
- `{{taskId}}` - Task ID
- `{{requirements}}` - Requirements document content
- `{{design}}` - Design document content
- `{{instructions}}` - Task-specific instructions
- `{{subtasks}}` - List of subtasks

### Plugin System

Extend functionality with custom plugins:

```typescript
import { TaskProcessor, PromptGenerator } from 'kiro-automation-extension';

// Custom task processor
class MyTaskProcessor implements TaskProcessor {
  async process(task: Task): Promise<ExecutionResult> {
    // Custom processing logic
  }
}

// Register plugin
vscode.extensions.getExtension('kiro-automation-extension')
  .exports.registerPlugin(new MyTaskProcessor());
```

See [Plugin Development Guide](./PLUGIN_SYSTEM.md) for details.

### Performance Monitoring

View performance metrics:

1. Enable: `"kiro-automation.performanceMonitoring": true`
2. Run automation session
3. View metrics in Progress Panel
4. Export performance report

Metrics tracked:
- Memory usage (current, peak, average)
- CPU utilization
- Task execution time
- API call latency
- File system operations

### Performance Optimizations

The extension includes several performance optimizations:

- **Task Caching**: Frequently accessed tasks are cached with LRU eviction
- **Memoization**: Function results are cached to avoid redundant computations
- **Batch Processing**: File operations are batched for better throughput
- **Debouncing**: File system events are debounced to reduce overhead
- **Lazy Loading**: Task specifications are loaded on-demand
- **Memory Management**: Automatic cleanup of completed sessions and old metrics

### Session Persistence

Automation sessions are automatically saved and can be resumed:

1. **Auto-save**: Sessions saved every 30 seconds
2. **Resume on Restart**: Enable `autoResume` setting
3. **Manual Resume**: Use `Resume` command
4. **Session History**: View past sessions in logs

## Development

### Building from Source

```bash
# Clone repository
git clone https://github.com/your-org/kiro-automation-extension.git
cd kiro-automation-extension

# Install dependencies
npm install

# Compile TypeScript
npm run compile

# Watch mode (auto-recompile on changes)
npm run watch
```

### Running Tests

```bash
# Run all tests
npm test

# Run specific test suite
npm test -- --grep "TaskManager"

# Run with coverage
npm test -- --coverage
```

### Code Quality

```bash
# Lint code
npm run lint

# Fix linting issues
npm run lint -- --fix

# Format code
npm run format

# Type check
npm run compile -- --noEmit
```

### Debugging

1. Open project in VS Code
2. Set breakpoints in source code
3. Press `F5` to launch Extension Development Host
4. Extension runs in debug mode with breakpoints active

### Project Structure

```
kiro-automation-extension/
├── src/                          # Source code
│   ├── extension.ts              # Extension entry point
│   ├── AutomationEngine.ts       # Core automation logic
│   ├── TaskManager.ts            # Task discovery and management
│   ├── KiroInterface.ts          # Kiro IDE integration
│   ├── ConfigManager.ts          # Configuration handling
│   ├── Logger.ts                 # Logging system
│   ├── NotificationService.ts    # Notification management
│   ├── PerformanceMonitor.ts     # Performance tracking
│   ├── SessionPersistence.ts     # Session state management
│   ├── models/                   # Data models
│   │   ├── Task.ts              # Task model
│   │   └── ExecutionContext.ts  # Execution context
│   ├── ui/                       # UI components
│   │   ├── ProgressPanel.ts     # Progress webview
│   │   ├── TaskTreeView.ts      # Task tree provider
│   │   └── LogViewer.ts         # Log output channel
│   └── plugins/                  # Plugin system
│       └── PluginRegistry.ts    # Plugin management
├── test/                         # Tests
│   ├── runTest.ts               # Test runner
│   └── suite/                   # Test suites
│       ├── taskManager.test.ts
│       ├── automationEngine.test.ts
│       └── kiroInterface.test.ts
├── resources/                    # Static resources
│   ├── icons/                   # Extension icons
│   └── templates/               # Prompt templates
├── out/                          # Compiled JavaScript
├── .vscode/                      # VS Code configuration
│   ├── launch.json              # Debug configuration
│   └── tasks.json               # Build tasks
├── package.json                  # Extension manifest
├── tsconfig.json                 # TypeScript configuration
├── .eslintrc.json               # ESLint configuration
├── .prettierrc.json             # Prettier configuration
├── README.md                     # This file
├── CHANGELOG.md                  # Version history
├── SECURITY.md                   # Security documentation
└── LICENSE                       # License file
```

## Contributing

We welcome contributions! Please follow these guidelines:

### Getting Started

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/my-feature`
3. Make your changes
4. Write or update tests
5. Run tests and linting: `npm test && npm run lint`
6. Commit changes: `git commit -m "Add my feature"`
7. Push to branch: `git push origin feature/my-feature`
8. Open a Pull Request

### Code Style

- Follow TypeScript best practices
- Use ESLint and Prettier configurations
- Write JSDoc comments for public APIs
- Include unit tests for new features
- Update documentation as needed

### Pull Request Process

1. Ensure all tests pass
2. Update README.md with any new features
3. Update CHANGELOG.md with changes
4. Request review from maintainers
5. Address review feedback
6. Squash commits before merge

## License

MIT License - see [LICENSE](LICENSE) file for details

## Acknowledgments

- Built for the Kiro IDE ecosystem
- Inspired by VS Code extension best practices
- Thanks to all contributors and users

## Support

- **Documentation**: [GitHub Wiki](https://github.com/your-org/kiro-automation-extension/wiki)
- **Issues**: [GitHub Issues](https://github.com/your-org/kiro-automation-extension/issues)
- **Discussions**: [GitHub Discussions](https://github.com/your-org/kiro-automation-extension/discussions)
- **Email**: support@your-org.com

---

**Made with ❤️ for the Kiro IDE community**
