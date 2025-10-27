# Quick Start Guide

## 🚀 Get Started in 3 Steps

### Step 1: Navigate to Automation Directory
```bash
cd .kiro/automation
```

### Step 2: Run the Executor

**Option A: Run Everything (Recommended)**
```bash
# Linux/Mac
./start.sh

# Windows PowerShell (Recommended)
.\Start-Automation.ps1

# Windows Command Prompt
start.bat

# Or directly with Node (any platform)
node autonomous-executor.js
```

**Option B: Run Single Spec**
```bash
node autonomous-executor.js --spec sentiment-moderation-service
```

**Option C: Resume from Interruption**
```bash
node autonomous-executor.js --resume
```

### Step 3: Monitor Progress
```bash
# Watch logs in real-time
tail -f execution.log

# Check current state
cat execution-state.json

# View task status
cat ../ specs/*/tasks.md
```

## 📋 What Happens During Execution

1. **Initialization** - Loads specs and builds context
2. **Task Discovery** - Parses all tasks from task lists
3. **Sequential Execution** - Runs tasks one by one
4. **Auto-Decisions** - Makes smart choices automatically
5. **Verification** - Checks implementation quality
6. **State Saving** - Saves progress continuously

## 🤖 Auto-Decision Examples

The system will automatically:
- ✅ Choose TypeScript for new files
- ✅ Use Jest for testing
- ✅ Implement standard error handling
- ✅ Add input validation
- ✅ Create database migrations
- ✅ Write API documentation
- ✅ Follow code style guidelines

The system will ask you for:
- ⚠️ API keys and secrets
- ⚠️ Security-critical decisions
- ⚠️ Business logic clarifications
- ⚠️ Breaking changes

## 📊 Monitoring

### Real-Time Progress
```bash
# Terminal 1: Run executor
node autonomous-executor.js

# Terminal 2: Watch logs
tail -f execution.log
```

### Check What's Done
```bash
# Count completed tasks
grep -c "\[x\]" ../specs/*/tasks.md

# List in-progress tasks
grep "\[~\]" ../specs/*/tasks.md

# List pending tasks
grep "\[ \]" ../specs/*/tasks.md
```

## 🛠️ Common Scenarios

### Scenario 1: First Time Running
```bash
# Start from the beginning
node autonomous-executor.js
```

### Scenario 2: Interrupted Execution
```bash
# Resume where you left off
node autonomous-executor.js --resume
```

### Scenario 3: Focus on One Spec
```bash
# Work on just the trivia game
node autonomous-executor.js --spec zippy-trivia-show
```

### Scenario 4: Task Failed
```bash
# 1. Check the error
cat execution.log | grep ERROR

# 2. Fix manually if needed
cd ../specs/[spec-name]/implementation/task-[id]

# 3. Resume execution
node autonomous-executor.js --resume
```

## 📁 File Locations

```
.kiro/automation/
├── autonomous-executor.js     # Main executor
├── execution-state.json       # Current progress
├── execution.log              # Detailed logs
└── start.sh / start.bat       # Launcher scripts

.kiro/specs/
├── sentiment-moderation-service/
│   ├── requirements.md
│   ├── design.md
│   ├── tasks.md              # ← Task status here
│   └── implementation/       # ← Generated code here
├── discord-reddit-connector/
│   └── ...
└── ...
```

## ⚡ Pro Tips

1. **Run Overnight** - Let it run while you sleep for long specs
2. **Commit Often** - Commit after each completed spec
3. **Review Code** - Always review generated code before deploying
4. **Check Tests** - Run tests manually to verify
5. **Monitor Logs** - Keep an eye on logs for issues
6. **Save State** - The system saves state automatically, but you can also commit `execution-state.json`

## 🔧 Troubleshooting

### Executor Won't Start
```bash
# Check Node.js version (need 14+)
node --version

# Install dependencies if needed
npm install
```

### Task Keeps Failing
```bash
# 1. Check logs for specific error
grep "Task [ID]" execution.log

# 2. Review the task prompt
cat ../specs/[spec]/implementation/task-[id]/prompt.md

# 3. Try manual execution
# Open Kiro chat and paste the prompt
```

### Want to Skip a Task
```bash
# 1. Edit the tasks.md file
# Change [ ] to [x] for the task you want to skip

# 2. Resume execution
node autonomous-executor.js --resume
```

## 📞 Need Help?

1. Read the full [README.md](README.md)
2. Check [execution.log](execution.log) for errors
3. Review [execution-state.json](execution-state.json) for current state
4. Consult the spec documentation in `.kiro/specs/`

## 🎯 Expected Timeline

Based on the recommended order:

| Spec | Estimated Time | Complexity |
|------|---------------|------------|
| Sentiment Service | 2-3 weeks | Medium |
| Connector | 3-4 weeks | High |
| Trivia Game | 3-4 weeks | High |
| Puzzle Suite | 2-3 weeks | Medium |
| Quest RPG | 4-5 weeks | Very High |
| Matchmaking | 2-3 weeks | Medium |
| **Total** | **16-22 weeks** | - |

With autonomous execution and parallel work, this can be compressed significantly.

## ✅ Success Criteria

You'll know it's working when:
- ✅ Tasks are marked as `[x]` in tasks.md files
- ✅ Code files appear in implementation directories
- ✅ Tests are written and passing
- ✅ No errors in execution.log
- ✅ State file shows progress

## 🚦 Ready to Start?

```bash
cd .kiro/automation
./start.sh
```

Let the automation begin! 🎉
