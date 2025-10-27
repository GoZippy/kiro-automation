# Kiro Automation Executor

Autonomous task execution system that runs through your spec task lists automatically, making intelligent decisions and only stopping for critical user input.

## Features

- ✅ **Fully Autonomous** - Executes tasks sequentially without manual intervention
- 🤖 **Intelligent Decision-Making** - Auto-approves common patterns and best practices
- 📊 **Progress Tracking** - Maintains state and can resume from interruptions
- 🔄 **Retry Logic** - Automatically retries failed tasks
- 📝 **Comprehensive Logging** - Detailed logs of all actions and decisions
- 🎯 **Context-Aware** - Builds context from requirements, design, and existing code
- 🛡️ **Safe Defaults** - Uses industry best practices for all decisions

## Quick Start

### 1. Install Dependencies

```bash
npm install
```

### 2. Run All Specs in Order

```bash
npm start
```

Or use the platform-specific launchers:

```bash
# Windows PowerShell
.\Start-Automation.ps1

# Linux/Mac
./start.sh

# Windows CMD
start.bat
```

### 3. Run a Single Spec

```bash
node autonomous-executor.js --spec <spec-name>
```

### 4. Resume from Last Checkpoint

```bash
npm run resume
```

## Executors

This package includes three executor variants:

### 1. Autonomous Executor (Recommended)
**File:** `autonomous-executor.js`

Fully autonomous execution with intelligent decision-making, retry logic, and comprehensive state management.

```bash
node autonomous-executor.js
```

### 2. Task Executor
**File:** `task-executor.js`

Semi-automated executor with manual confirmation steps.

```bash
node task-executor.js
```

### 3. Simple Executor
**File:** `simple-executor.js`

Generates prompts for manual execution in Kiro chat.

```bash
npm run simple
```

## Configuration

The executor looks for specs in the target workspace's `.kiro/specs/` directory. You can configure the execution order and other settings by editing the executor files or passing command-line arguments.

### Command-Line Options

```bash
node autonomous-executor.js [options]

Options:
  --spec <name>    Execute only the specified spec
  --resume         Resume from last checkpoint
  --help           Show help message
```

### Environment Variables

```bash
# Set custom specs directory
export KIRO_SPECS_DIR=/path/to/specs

# Set custom workspace root
export KIRO_WORKSPACE=/path/to/workspace
```

## How It Works

### 1. Task Discovery
- Reads task lists from `.kiro/specs/*/tasks.md`
- Parses tasks and subtasks
- Identifies completed vs. pending tasks

### 2. Context Building
- Loads requirements and design documents
- Analyzes existing code and project structure
- Identifies dependencies and patterns
- Builds comprehensive context for each task

### 3. Autonomous Execution
- Generates detailed prompts with all context
- Makes automatic decisions based on best practices
- Executes tasks through Kiro
- Monitors progress and handles errors
- Verifies implementation

### 4. State Management
- Saves progress after each task
- Can resume from any point
- Tracks completed and failed tasks
- Maintains decision log

## Auto-Decision Framework

The system automatically handles:

### ✅ Always Auto-Approve
- Standard CRUD operations
- Common authentication patterns
- Error handling and validation
- Test implementations
- Database migrations
- API endpoints matching design
- UI components following design system
- Configuration updates
- Documentation
- Dependency installations

### ⚠️ Ask for User Input
- Security-critical decisions (encryption, auth strategies)
- Data loss risks (destructive operations)
- External integrations (API keys, third-party services)
- Business logic ambiguity
- Breaking changes to existing APIs
- Budget/resource decisions

### 🎯 Default Technology Choices
- **Language**: TypeScript
- **Testing**: Jest (unit), Playwright (E2E)
- **Database**: PostgreSQL (relational), Redis (cache)
- **API**: RESTful with Express.js
- **Authentication**: JWT tokens
- **Validation**: Zod or Joi
- **Logging**: Winston (JSON format)
- **Styling**: Tailwind CSS
- **Linting**: ESLint
- **Formatting**: Prettier

## File Structure

```
executor/
├── autonomous-executor.js    # Main autonomous executor
├── task-executor.js          # Semi-automated executor
├── simple-executor.js        # Simple prompt generator
├── package.json              # Node.js package config
├── README.md                 # This file
├── Start-Automation.ps1      # Windows PowerShell launcher
├── start.sh                  # Linux/Mac launcher
├── start.bat                 # Windows CMD launcher
├── execution-state.json      # Current execution state (generated)
└── execution.log             # Detailed execution logs (generated)
```

## Monitoring Progress

### View Current State
```bash
cat execution-state.json
```

### View Logs
```bash
tail -f execution.log
```

### Check Task Status
Open any `tasks.md` file in the target workspace to see:
- `[ ]` - Not started
- `[~]` - In progress
- `[x]` - Completed

## Troubleshooting

### Task Failed
1. Check `execution.log` for error details
2. Review the task's implementation directory
3. Fix issues manually if needed
4. Resume with `--resume`

### Execution Stuck
1. Check if waiting for user input
2. Review current task in `execution-state.json`
3. Manually complete the task
4. Resume execution

### Want to Skip a Spec
1. Edit `execution-state.json`
2. Update `currentSpec` to next spec
3. Run with `--resume`

## Integration with Kiro

### Current Implementation
The executor generates detailed prompts and instructions for execution through Kiro chat.

### Future: Full API Integration
When Kiro API is available, the executor will:
- Send prompts directly to Kiro API
- Monitor execution progress automatically
- Handle questions with auto-decisions
- Collect results programmatically
- Verify implementation automatically

## Best Practices

### Before Running
1. Commit your current work
2. Ensure all specs are up to date
3. Review the execution order
4. Check available disk space

### During Execution
1. Monitor logs periodically
2. Don't interrupt unless necessary
3. Let it run overnight for long specs

### After Completion
1. Review generated code
2. Run tests manually to verify
3. Check for any TODO comments
4. Commit completed work

## Examples

### Execute Sentiment Service Only
```bash
node autonomous-executor.js --spec sentiment-moderation-service
```

### Resume After Interruption
```bash
node autonomous-executor.js --resume
```

### View Help
```bash
node autonomous-executor.js --help
```

## Advanced Usage

### Custom Execution Order
Edit the executor file to customize the order:

```javascript
const config = {
  executionOrder: [
    'your-spec-name',
    'another-spec',
    // ...
  ]
};
```

### Parallel Execution (Future)
```bash
# Run multiple specs in parallel
node autonomous-executor.js --spec spec1 &
node autonomous-executor.js --spec spec2 &
```

## Contributing

To improve the automation system:

1. Add new auto-decision patterns
2. Improve context building
3. Add verification checks
4. Enhance error recovery
5. Add Kiro API integration

## License

MIT

## Support

For issues or questions:
1. Check execution logs
2. Review state file
3. Consult task documentation
4. Open an issue in the repository
