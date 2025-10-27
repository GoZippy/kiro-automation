# Quick Start Guide

Get up and running with Kiro Automation in 5 minutes!

## Prerequisites

- Node.js 14.0.0 or higher
- Kiro IDE installed
- A workspace with `.kiro/specs/` directory

## Installation

### Step 1: Get the Project

```bash
# Clone or extract to your preferred location
cd ~/projects
git clone <repository-url> kiro-automation
cd kiro-automation
```

### Step 2: Install Dependencies

```bash
# Install all dependencies (executor + extension)
npm run install:all

# Or install individually
cd executor && npm install
cd ../extension && npm install
```

## Using the Executor

### Option 1: Run from Your Workspace (Easiest)

```bash
cd /path/to/your/workspace
node ~/projects/kiro-automation/executor/autonomous-executor.js
```

### Option 2: Use Environment Variable

```bash
export KIRO_WORKSPACE=/path/to/your/workspace
cd ~/projects/kiro-automation/executor
./Start-Automation.ps1  # Windows PowerShell
# or
./start.sh              # Linux/Mac
```

### Option 3: Use Command-Line Argument

```bash
cd ~/projects/kiro-automation/executor
node autonomous-executor.js --workspace /path/to/your/workspace
```

## Using the VS Code Extension

### Step 1: Build the Extension

```bash
cd ~/projects/kiro-automation/extension
npm run compile
```

### Step 2: Package the Extension

```bash
npm run package
```

### Step 3: Install in VS Code

```bash
code --install-extension kiro-automation-*.vsix
```

### Step 4: Use It

1. Open your workspace in VS Code
2. Press `Cmd/Ctrl + Shift + P`
3. Type "Kiro Automation: Start"
4. Watch it work!

## Common Commands

### Executor

```bash
# Run all specs
node autonomous-executor.js

# Run specific spec
node autonomous-executor.js --spec sentiment-moderation-service

# Resume from last checkpoint
node autonomous-executor.js --resume

# Specify workspace
node autonomous-executor.js --workspace /path/to/workspace

# Get help
node autonomous-executor.js --help
```

### Extension

```bash
# Compile TypeScript
npm run compile

# Watch mode (auto-compile on changes)
npm run watch

# Run tests
npm test

# Package for distribution
npm run package
```

## Verify Installation

### Check Executor

```bash
cd ~/projects/kiro-automation/executor
node autonomous-executor.js --help
```

You should see the help message with all options.

### Check Extension

1. Open VS Code
2. Go to Extensions panel
3. Search for "Kiro Automation"
4. Should show as installed

## Your First Automation

### 1. Prepare Your Workspace

Make sure you have:
```
your-workspace/
└── .kiro/
    └── specs/
        └── your-spec/
            ├── requirements.md
            ├── design.md
            └── tasks.md
```

### 2. Run the Executor

```bash
cd your-workspace
node ~/projects/kiro-automation/executor/autonomous-executor.js
```

### 3. Watch It Work

The executor will:
1. Discover your specs
2. Parse tasks
3. Build context
4. Execute tasks
5. Save progress
6. Continue to next task

### 4. Monitor Progress

```bash
# View logs
tail -f ~/projects/kiro-automation/executor/execution.log

# Check state
cat ~/projects/kiro-automation/executor/execution-state.json

# View task status
cat .kiro/specs/your-spec/tasks.md
```

## Troubleshooting

### "Specs directory not found"

**Solution**: Make sure you're running from a workspace with `.kiro/specs/` or specify the workspace:

```bash
node autonomous-executor.js --workspace /path/to/workspace
```

### "Permission denied" on scripts

**Solution**: Make scripts executable:

```bash
chmod +x ~/projects/kiro-automation/executor/*.sh
```

### Extension not activating

**Solution**: 
1. Check `.kiro/` directory exists in workspace
2. Reload VS Code window
3. Check Output panel for errors

## Next Steps

### Learn More

- [Executor Documentation](executor/README.md)
- [Extension Documentation](extension/README.md)
- [Architecture Overview](docs/ARCHITECTURE.md)
- [Migration Guide](MIGRATION_GUIDE.md)

### Customize

- Edit execution order in executor files
- Configure extension settings in VS Code
- Create custom plugins
- Add your own automation patterns

### Contribute

- Read [CONTRIBUTING.md](CONTRIBUTING.md)
- Check open issues
- Submit pull requests
- Share feedback

## Getting Help

1. Check documentation in `docs/`
2. Read component READMEs
3. Review troubleshooting sections
4. Open an issue on GitHub

## Quick Reference

### File Locations

```
kiro-automation/
├── executor/
│   ├── autonomous-executor.js    # Main executor
│   ├── execution-state.json      # Progress (generated)
│   └── execution.log             # Logs (generated)
├── extension/
│   └── kiro-automation-*.vsix    # Installable extension
└── docs/
    └── *.md                      # Documentation
```

### Environment Variables

```bash
export KIRO_WORKSPACE=/path/to/workspace  # Workspace location
export NODE_ENV=development               # Development mode
```

### VS Code Commands

- `Kiro Automation: Start` - Start automation
- `Kiro Automation: Stop` - Stop automation
- `Kiro Automation: Pause` - Pause automation
- `Kiro Automation: Resume` - Resume automation
- `Kiro Automation: View Progress` - Show progress panel

## Success!

You're now ready to use Kiro Automation! 🚀

Start automating your development workflow and let Kiro handle the repetitive tasks while you focus on the creative work.

Happy automating! 🎉
