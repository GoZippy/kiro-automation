# Kiro Automation

A comprehensive automation toolkit for Kiro IDE, enabling autonomous task execution and intelligent development workflows.

## Overview

Kiro Automation is a standalone project that provides two main components:

1. **Autonomous Task Executor** - Node.js service that executes Kiro spec tasks automatically
2. **VS Code Extension** - Full-featured extension for integrated automation within VS Code

## Project Structure

```
kiro-automation/
├── executor/              # Autonomous task execution service
│   ├── autonomous-executor.js
│   ├── task-executor.js
│   ├── simple-executor.js
│   └── package.json
├── extension/             # VS Code extension
│   ├── src/
│   ├── test/
│   └── package.json
├── docs/                  # Documentation
├── examples/              # Example configurations
└── scripts/               # Utility scripts
```

## Quick Start

### Autonomous Executor

```bash
cd executor
npm install
node autonomous-executor.js
```

### VS Code Extension

```bash
cd extension
npm install
npm run compile
# Press F5 in VS Code to launch extension development host
```

## Documentation

- [Executor Guide](./executor/README.md) - Autonomous task execution
- [Extension Guide](./extension/README.md) - VS Code extension features
- [API Documentation](./docs/API.md) - Integration APIs
- [Contributing](./CONTRIBUTING.md) - Development guidelines

## Features

### Autonomous Executor
- ✅ Fully autonomous task execution
- 🤖 Intelligent decision-making
- 📊 Progress tracking and state management
- 🔄 Automatic retry logic
- 📝 Comprehensive logging

### VS Code Extension
- 🎯 Task discovery and management
- 🔌 Kiro chat integration
- 📈 Real-time progress monitoring
- ⚙️ Configurable automation settings
- 🔧 Plugin architecture for extensibility

## Requirements

- Node.js 14.0.0 or higher
- VS Code 1.60.0 or higher (for extension)
- Kiro IDE installed and configured

## Installation

### From Source

```bash
git clone <repository-url>
cd kiro-automation

# Install executor
cd executor
npm install

# Install extension
cd ../extension
npm install
npm run compile
```

### VS Code Extension (VSIX)

```bash
cd extension
npm run package
code --install-extension kiro-automation-*.vsix
```

## Usage

See individual component READMEs for detailed usage instructions:
- [Executor Usage](./executor/README.md)
- [Extension Usage](./extension/README.md)

## License

MIT

## Support

For issues, questions, or contributions, please visit the project repository.
