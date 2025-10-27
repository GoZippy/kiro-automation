# Migration Guide: Moving from Embedded to Standalone

This guide helps you migrate from the embedded `.kiro/automation` setup to the standalone `kiro-automation` project.

## Overview

**Before**: Automation tools nested in `.kiro/automation/` within your project
**After**: Standalone `kiro-automation/` project that can work with any Kiro workspace

## Migration Steps

### Step 1: Backup Current State

```bash
# Backup your execution state
cp .kiro/automation/execution-state.json ~/kiro-automation-backup-state.json

# Backup your logs
cp .kiro/automation/execution.log ~/kiro-automation-backup.log
```

### Step 2: Install Standalone Project

```bash
# Clone or extract kiro-automation to a separate location
cd ~/projects  # or your preferred location
git clone <repository-url> kiro-automation

# Or if you have the extracted files
mv kiro-automation ~/projects/kiro-automation
```

### Step 3: Install Dependencies

```bash
cd ~/projects/kiro-automation

# Install all dependencies
npm run install:all

# Or install individually
cd executor && npm install
cd ../extension && npm install
```

### Step 4: Configure for Your Workspace

The executor now needs to know where your workspace is located.

**Option A: Run from workspace directory**
```bash
cd /path/to/your/workspace
node ~/projects/kiro-automation/executor/autonomous-executor.js
```

**Option B: Set environment variable**
```bash
export KIRO_WORKSPACE=/path/to/your/workspace
cd ~/projects/kiro-automation/executor
node autonomous-executor.js
```

**Option C: Create a workspace-specific launcher**
```bash
# Create a launcher script in your workspace
cat > run-automation.sh << 'EOF'
#!/bin/bash
cd "$(dirname "$0")"
node ~/projects/kiro-automation/executor/autonomous-executor.js "$@"
EOF

chmod +x run-automation.sh
./run-automation.sh
```

### Step 5: Restore State (Optional)

If you want to continue from where you left off:

```bash
cp ~/kiro-automation-backup-state.json ~/projects/kiro-automation/executor/execution-state.json
```

### Step 6: Install VS Code Extension

```bash
cd ~/projects/kiro-automation/extension

# Build the extension
npm run compile

# Package it
npm run package

# Install in VS Code
code --install-extension kiro-automation-*.vsix
```

### Step 7: Clean Up Old Location (Optional)

Once you've verified everything works:

```bash
# Remove old automation directory
rm -rf .kiro/automation

# Or keep it as backup
mv .kiro/automation .kiro/automation.backup
```

## Path Changes

### Executor Paths

The executor now automatically detects the workspace root. It looks for `.kiro/specs/` relative to:

1. Current working directory
2. `KIRO_WORKSPACE` environment variable
3. Parent directories (walks up the tree)

**Old behavior**:
```javascript
// Hardcoded relative path
const specsDir = path.join(__dirname, '..', '..', '.kiro', 'specs');
```

**New behavior**:
```javascript
// Detects workspace automatically
const workspaceRoot = findWorkspaceRoot();
const specsDir = path.join(workspaceRoot, '.kiro', 'specs');
```

### Extension Paths

The extension uses VS Code's workspace API, so no path changes are needed.

## Configuration Changes

### Executor Configuration

**Old**: Configuration embedded in executor files
**New**: Can be configured via:
- Command-line arguments
- Environment variables
- Configuration file (coming soon)

```bash
# Old way
node autonomous-executor.js --spec sentiment-moderation-service

# New way (same, but from anywhere)
cd ~/projects/kiro-automation/executor
KIRO_WORKSPACE=/path/to/workspace node autonomous-executor.js --spec sentiment-moderation-service
```

### Extension Configuration

**Old**: Settings in workspace `.vscode/settings.json`
**New**: Same, but with updated setting names

```json
{
  // Old (still works)
  "kiro-automation.enabled": true,
  
  // New (recommended)
  "kiro-automation.executor.enabled": true,
  "kiro-automation.executor.path": "~/projects/kiro-automation/executor"
}
```

## Usage Changes

### Running the Executor

**Before**:
```bash
cd .kiro/automation
./Start-Automation.ps1
```

**After**:
```bash
# Option 1: From workspace
cd /path/to/workspace
node ~/projects/kiro-automation/executor/autonomous-executor.js

# Option 2: With environment variable
export KIRO_WORKSPACE=/path/to/workspace
cd ~/projects/kiro-automation/executor
./Start-Automation.ps1

# Option 3: Global installation (future)
npm install -g @kiro-automation/executor
kiro-execute --workspace /path/to/workspace
```

### Using the Extension

**Before**: Extension was part of the workspace
**After**: Extension is installed globally in VS Code

1. Open your workspace in VS Code
2. Extension automatically detects `.kiro/specs/`
3. Use Command Palette: "Kiro Automation: Start"

## Troubleshooting

### Executor Can't Find Specs

**Problem**: `Specs directory not found: undefined/.kiro/specs`

**Solution**:
```bash
# Make sure you're in the workspace directory
cd /path/to/your/workspace

# Or set the environment variable
export KIRO_WORKSPACE=/path/to/your/workspace

# Or pass it as an argument (future feature)
node autonomous-executor.js --workspace /path/to/workspace
```

### Extension Not Activating

**Problem**: Extension doesn't activate when opening workspace

**Solution**:
1. Check that `.kiro/` directory exists in workspace
2. Reload VS Code window (Cmd/Ctrl + Shift + P → "Reload Window")
3. Check extension is enabled in Extensions panel
4. Check Output panel for errors (View → Output → Kiro Automation)

### State File Not Found

**Problem**: Can't resume from previous state

**Solution**:
```bash
# Copy state file to new location
cp /old/location/execution-state.json ~/projects/kiro-automation/executor/execution-state.json

# Or start fresh
rm ~/projects/kiro-automation/executor/execution-state.json
```

### Permission Errors

**Problem**: Permission denied when running scripts

**Solution**:
```bash
# Make scripts executable
chmod +x ~/projects/kiro-automation/executor/*.sh

# Or run with node directly
node ~/projects/kiro-automation/executor/autonomous-executor.js
```

## Benefits of Standalone Setup

### ✅ Advantages

1. **Reusability** - Use with multiple workspaces
2. **Updates** - Update once, use everywhere
3. **Cleaner Workspaces** - No automation code in project
4. **Version Control** - Separate git history
5. **Distribution** - Easier to share and install
6. **Development** - Easier to develop and test

### ⚠️ Considerations

1. **Path Management** - Need to specify workspace location
2. **Initial Setup** - Slightly more setup required
3. **Updates** - Need to update separately from workspace

## Multiple Workspaces

The standalone setup makes it easy to work with multiple workspaces:

```bash
# Workspace 1
cd ~/projects/workspace1
node ~/projects/kiro-automation/executor/autonomous-executor.js

# Workspace 2
cd ~/projects/workspace2
node ~/projects/kiro-automation/executor/autonomous-executor.js

# Or use environment variables
export KIRO_WORKSPACE=~/projects/workspace1
cd ~/projects/kiro-automation/executor
node autonomous-executor.js

export KIRO_WORKSPACE=~/projects/workspace2
node autonomous-executor.js
```

## Rollback Plan

If you need to rollback to the embedded setup:

```bash
# 1. Copy files back
cp -r ~/projects/kiro-automation/executor/* /path/to/workspace/.kiro/automation/

# 2. Restore state
cp ~/kiro-automation-backup-state.json /path/to/workspace/.kiro/automation/execution-state.json

# 3. Run from old location
cd /path/to/workspace/.kiro/automation
./Start-Automation.ps1
```

## Next Steps

After migration:

1. ✅ Test executor with your workspace
2. ✅ Install and test VS Code extension
3. ✅ Update any scripts or documentation
4. ✅ Share the standalone setup with your team
5. ✅ Consider contributing improvements back to the project

## Getting Help

If you encounter issues during migration:

1. Check this guide's troubleshooting section
2. Review the [README.md](README.md)
3. Check the [executor README](executor/README.md)
4. Check the [extension README](extension/README.md)
5. Open an issue on GitHub

## Feedback

We'd love to hear about your migration experience! Please share:
- What went well
- What was confusing
- Suggestions for improvement
- Additional documentation needs

Thank you for migrating to the standalone Kiro Automation! 🚀
