#!/usr/bin/env node

/**
 * Autonomous Task Execution Service
 * 
 * This service automatically executes tasks from spec task lists in sequential order,
 * monitors for completion, and continues to the next task without manual intervention.
 * 
 * Features:
 * - Sequential task execution across multiple specs
 * - Automatic context building from requirements and design docs
 * - Smart decision-making for common feedback scenarios
 * - Progress tracking and state persistence
 * - Error handling and retry logic
 */

const fs = require('fs').promises;
const path = require('path');
const { spawn } = require('child_process');

class TaskExecutor {
  constructor(config = {}) {
    // Determine workspace root (go up two levels from .kiro/automation)
    const workspaceRoot = path.resolve(__dirname, '..', '..');
    
    this.config = {
      specsDir: path.join(workspaceRoot, '.kiro/specs'),
      executionOrder: config.executionOrder || [
        'sentiment-moderation-service',
        'discord-reddit-connector',
        'zippy-trivia-show',
        'match-and-mind-puzzle-suite',
        'community-quest-rpg',
        'matchmaking-friend-finder'
      ],
      stateFile: path.join(__dirname, 'execution-state.json'),
      maxRetries: 3,
      autoApprovePatterns: config.autoApprovePatterns || [
        'looks good',
        'proceed',
        'continue',
        'yes',
        'approved'
      ],
      ...config
    };
    
    this.state = {
      currentSpec: null,
      currentTask: null,
      completedTasks: [],
      failedTasks: [],
      startTime: null,
      lastCheckpoint: null
    };
  }

  async initialize() {
    console.log('🚀 Initializing Autonomous Task Executor...\n');
    
    // Load previous state if exists
    await this.loadState();
    
    // Validate specs directory
    try {
      await fs.access(this.config.specsDir);
    } catch (error) {
      throw new Error(`Specs directory not found: ${this.config.specsDir}`);
    }
    
    console.log('✅ Initialization complete\n');
  }

  async loadState() {
    try {
      const stateData = await fs.readFile(this.config.stateFile, 'utf-8');
      this.state = { ...this.state, ...JSON.parse(stateData) };
      console.log('📂 Loaded previous execution state');
    } catch (error) {
      console.log('📝 Starting fresh execution (no previous state found)');
    }
  }

  async saveState() {
    try {
      await fs.mkdir(path.dirname(this.config.stateFile), { recursive: true });
      await fs.writeFile(
        this.config.stateFile,
        JSON.stringify(this.state, null, 2)
      );
    } catch (error) {
      console.error('⚠️  Failed to save state:', error.message);
    }
  }

  async run() {
    try {
      await this.initialize();
      
      this.state.startTime = this.state.startTime || new Date().toISOString();
      
      for (const specName of this.config.executionOrder) {
        console.log(`\n${'='.repeat(80)}`);
        console.log(`📦 Processing Spec: ${specName}`);
        console.log(`${'='.repeat(80)}\n`);
        
        this.state.currentSpec = specName;
        await this.saveState();
        
        const success = await this.executeSpec(specName);
        
        if (!success) {
          console.error(`\n❌ Spec ${specName} failed. Stopping execution.`);
          break;
        }
        
        console.log(`\n✅ Spec ${specName} completed successfully!\n`);
      }
      
      await this.printSummary();
      
    } catch (error) {
      console.error('\n💥 Fatal error:', error.message);
      console.error(error.stack);
      await this.saveState();
      process.exit(1);
    }
  }

  async executeSpec(specName) {
    const specDir = path.join(this.config.specsDir, specName);
    const tasksFile = path.join(specDir, 'tasks.md');
    const requirementsFile = path.join(specDir, 'requirements.md');
    const designFile = path.join(specDir, 'design.md');
    
    // Load context documents
    const context = await this.buildContext(requirementsFile, designFile);
    
    // Parse tasks
    const tasks = await this.parseTasks(tasksFile);
    
    console.log(`📋 Found ${tasks.length} tasks to execute\n`);
    
    // Execute tasks sequentially
    for (const task of tasks) {
      if (this.isTaskCompleted(task)) {
        console.log(`⏭️  Skipping completed task: ${task.id} ${task.title}`);
        continue;
      }
      
      console.log(`\n${'─'.repeat(80)}`);
      console.log(`🔨 Executing Task: ${task.id} ${task.title}`);
      console.log(`${'─'.repeat(80)}\n`);
      
      this.state.currentTask = task.id;
      await this.saveState();
      
      const success = await this.executeTask(task, context, tasksFile);
      
      if (!success) {
        console.error(`\n❌ Task ${task.id} failed after ${this.config.maxRetries} retries`);
        this.state.failedTasks.push({ spec: specName, task: task.id });
        await this.saveState();
        return false;
      }
      
      this.state.completedTasks.push({ spec: specName, task: task.id });
      await this.markTaskComplete(tasksFile, task.id);
      await this.saveState();
      
      console.log(`\n✅ Task ${task.id} completed successfully\n`);
    }
    
    return true;
  }

  async buildContext(requirementsFile, designFile) {
    const context = {
      requirements: '',
      design: '',
      bestPractices: this.getBestPractices()
    };
    
    try {
      context.requirements = await fs.readFile(requirementsFile, 'utf-8');
    } catch (error) {
      console.warn('⚠️  Requirements file not found');
    }
    
    try {
      context.design = await fs.readFile(designFile, 'utf-8');
    } catch (error) {
      console.warn('⚠️  Design file not found');
    }
    
    return context;
  }

  getBestPractices() {
    return `
# Best Practices and Default Decisions

## Code Quality
- Use TypeScript for type safety
- Follow ESLint and Prettier configurations
- Write clean, self-documenting code with meaningful variable names
- Keep functions small and focused (single responsibility)
- Use async/await over callbacks

## Testing
- Write tests alongside implementation (TDD approach)
- Aim for 80%+ code coverage
- Test edge cases and error conditions
- Use descriptive test names that explain the scenario

## Error Handling
- Always handle errors gracefully
- Provide meaningful error messages
- Log errors with context for debugging
- Implement retry logic for transient failures
- Use try-catch blocks for async operations

## Security
- Validate all user inputs
- Sanitize data to prevent XSS and injection attacks
- Use parameterized queries for database operations
- Encrypt sensitive data at rest and in transit
- Implement rate limiting on all public endpoints

## Performance
- Cache frequently accessed data
- Use database indexes appropriately
- Implement pagination for large datasets
- Optimize bundle sizes (code splitting, lazy loading)
- Use connection pooling for databases

## API Design
- Follow RESTful conventions
- Use proper HTTP status codes
- Version APIs (v1, v2)
- Provide clear error responses
- Document all endpoints

## Default Choices When Ambiguous
- Database: PostgreSQL for relational data, Redis for caching
- Authentication: JWT tokens with 1-hour expiration
- Logging: Structured JSON logs with Winston or Pino
- Testing: Jest for unit tests, Playwright for E2E
- Styling: Tailwind CSS for consistent design
- State Management: React hooks for local state, Context for global
- Error Responses: { error: string, code: string, details?: any }
- Date/Time: Always use UTC, store as ISO 8601 strings
- IDs: Use UUIDs for public IDs, auto-increment for internal
- Pagination: Limit/offset with default limit of 50, max 100

## When to Ask for User Input
- Major architectural decisions affecting multiple components
- Breaking changes to existing APIs
- Security-sensitive implementations
- Business logic that requires domain knowledge
- Trade-offs between conflicting requirements

## When to Proceed Automatically
- Standard CRUD operations
- Common patterns (authentication, validation, error handling)
- Test implementations following established patterns
- Documentation and comments
- Refactoring for code quality
- Performance optimizations with clear benefits
`;
  }

  async parseTasks(tasksFile) {
    const content = await fs.readFile(tasksFile, 'utf-8');
    const tasks = [];
    const lines = content.split('\n');
    
    let currentTask = null;
    let currentSubtasks = [];
    
    for (const line of lines) {
      // Match main tasks: - [ ] 1. Task title
      const mainTaskMatch = line.match(/^- \[ \] (\d+)\. (.+)$/);
      if (mainTaskMatch) {
        if (currentTask) {
          currentTask.subtasks = currentSubtasks;
          tasks.push(currentTask);
        }
        currentTask = {
          id: mainTaskMatch[1],
          title: mainTaskMatch[2],
          description: [],
          subtasks: [],
          requirements: []
        };
        currentSubtasks = [];
        continue;
      }
      
      // Match subtasks: - [ ] 1.1 Subtask title
      const subtaskMatch = line.match(/^  - \[ \] (\d+\.\d+) (.+)$/);
      if (subtaskMatch && currentTask) {
        currentSubtasks.push({
          id: subtaskMatch[1],
          title: subtaskMatch[2],
          description: []
        });
        continue;
      }
      
      // Collect description lines
      if (currentTask && line.trim().startsWith('-') && !line.includes('[ ]')) {
        if (currentSubtasks.length > 0) {
          currentSubtasks[currentSubtasks.length - 1].description.push(line.trim());
        } else {
          currentTask.description.push(line.trim());
        }
      }
      
      // Extract requirements
      const reqMatch = line.match(/_Requirements?: (.+)_/);
      if (reqMatch && currentTask) {
        currentTask.requirements = reqMatch[1].split(',').map(r => r.trim());
      }
    }
    
    if (currentTask) {
      currentTask.subtasks = currentSubtasks;
      tasks.push(currentTask);
    }
    
    return tasks;
  }

  async executeTask(task, context, tasksFile) {
    const prompt = this.buildTaskPrompt(task, context);
    
    for (let attempt = 1; attempt <= this.config.maxRetries; attempt++) {
      console.log(`\n🔄 Attempt ${attempt}/${this.config.maxRetries}\n`);
      
      try {
        // Mark task as in progress
        await this.markTaskInProgress(tasksFile, task.id);
        
        // Execute the task via Kiro chat
        const result = await this.executeViaKiro(prompt, task);
        
        if (result.success) {
          return true;
        }
        
        console.warn(`⚠️  Attempt ${attempt} failed: ${result.error}`);
        
        if (attempt < this.config.maxRetries) {
          console.log(`⏳ Retrying in 5 seconds...\n`);
          await this.sleep(5000);
        }
        
      } catch (error) {
        console.error(`❌ Error during attempt ${attempt}:`, error.message);
        
        if (attempt === this.config.maxRetries) {
          return false;
        }
      }
    }
    
    return false;
  }

  buildTaskPrompt(task, context) {
    let prompt = `# Task Execution Request

## Task Details
**ID:** ${task.id}
**Title:** ${task.title}

## Description
${task.description.join('\n')}

## Subtasks
${task.subtasks.map(st => `- ${st.id} ${st.title}\n  ${st.description.join('\n  ')}`).join('\n')}

## Requirements Referenced
${task.requirements.join(', ')}

## Context

### Requirements (Relevant Sections)
\`\`\`
${this.extractRelevantRequirements(context.requirements, task.requirements)}
\`\`\`

### Design (Relevant Sections)
\`\`\`
${this.extractRelevantDesign(context.design, task)}
\`\`\`

## Best Practices
${context.bestPractices}

## Instructions
Please implement this task following these guidelines:

1. **Read the context carefully** - Review the requirements and design sections relevant to this task
2. **Implement all subtasks** - Complete each subtask in order
3. **Follow best practices** - Use the default decisions provided above when choices are ambiguous
4. **Write tests** - Include unit/integration tests as specified in subtasks
5. **Handle errors** - Implement proper error handling and validation
6. **Document code** - Add comments for complex logic
7. **Verify implementation** - Run tests and check for errors before marking complete

## Auto-Approval Criteria
You may proceed automatically with:
- Standard implementations following established patterns
- Common CRUD operations
- Test implementations
- Error handling and validation
- Performance optimizations

## When to Request User Input
Only ask for user input if:
- Major architectural decisions are needed
- Security-sensitive implementations require clarification
- Business logic is ambiguous
- Trade-offs between conflicting requirements exist

Otherwise, use your best judgment and the best practices provided.

**Begin implementation now.**
`;
    
    return prompt;
  }

  extractRelevantRequirements(requirements, reqIds) {
    if (!requirements || !reqIds || reqIds.length === 0) {
      return 'No specific requirements referenced';
    }
    
    // Extract sections matching requirement IDs
    const sections = [];
    for (const reqId of reqIds) {
      const regex = new RegExp(`### Requirement ${reqId}[\\s\\S]*?(?=### Requirement|$)`, 'i');
      const match = requirements.match(regex);
      if (match) {
        sections.push(match[0]);
      }
    }
    
    return sections.length > 0 ? sections.join('\n\n') : 'Requirements not found';
  }

  extractRelevantDesign(design, task) {
    if (!design) {
      return 'No design document available';
    }
    
    // Extract sections relevant to the task based on keywords
    const keywords = task.title.toLowerCase().split(' ');
    const lines = design.split('\n');
    const relevantSections = [];
    let currentSection = [];
    let isRelevant = false;
    
    for (const line of lines) {
      if (line.startsWith('##')) {
        if (isRelevant && currentSection.length > 0) {
          relevantSections.push(currentSection.join('\n'));
        }
        currentSection = [line];
        isRelevant = keywords.some(kw => line.toLowerCase().includes(kw));
      } else {
        currentSection.push(line);
      }
    }
    
    if (isRelevant && currentSection.length > 0) {
      relevantSections.push(currentSection.join('\n'));
    }
    
    return relevantSections.length > 0 
      ? relevantSections.join('\n\n') 
      : 'No directly relevant design sections found. Review full design document.';
  }

  async executeViaKiro(prompt, task) {
    // This is a placeholder for the actual Kiro execution
    // In practice, this would interface with Kiro's API or CLI
    
    console.log('📝 Sending task to Kiro for execution...\n');
    
    // Write prompt to a file for Kiro to process
    const promptFile = path.join(
      process.cwd(),
      '.kiro/automation/current-task-prompt.md'
    );
    await fs.writeFile(promptFile, prompt);
    
    console.log(`💾 Task prompt saved to: ${promptFile}`);
    console.log('\n⚠️  MANUAL STEP REQUIRED:');
    console.log('   1. Open Kiro chat');
    console.log('   2. Paste the prompt from the file above');
    console.log('   3. Let Kiro complete the task');
    console.log('   4. Press Enter here when task is complete...\n');
    
    // Wait for user confirmation (in automated version, this would check task status)
    await this.waitForUserConfirmation();
    
    return { success: true };
  }

  async waitForUserConfirmation() {
    return new Promise((resolve) => {
      const readline = require('readline').createInterface({
        input: process.stdin,
        output: process.stdout
      });
      
      readline.question('', () => {
        readline.close();
        resolve();
      });
    });
  }

  async markTaskInProgress(tasksFile, taskId) {
    const content = await fs.readFile(tasksFile, 'utf-8');
    const updated = content.replace(
      new RegExp(`^- \\[ \\] ${taskId}\\.`, 'm'),
      `- [~] ${taskId}.`
    );
    await fs.writeFile(tasksFile, updated);
  }

  async markTaskComplete(tasksFile, taskId) {
    const content = await fs.readFile(tasksFile, 'utf-8');
    const updated = content.replace(
      new RegExp(`^- \\[.\\] ${taskId}\\.`, 'm'),
      `- [x] ${taskId}.`
    );
    await fs.writeFile(tasksFile, updated);
  }

  isTaskCompleted(task) {
    return this.state.completedTasks.some(
      ct => ct.spec === this.state.currentSpec && ct.task === task.id
    );
  }

  async printSummary() {
    console.log('\n' + '='.repeat(80));
    console.log('📊 EXECUTION SUMMARY');
    console.log('='.repeat(80) + '\n');
    
    console.log(`⏱️  Start Time: ${this.state.startTime}`);
    console.log(`⏱️  End Time: ${new Date().toISOString()}`);
    console.log(`\n✅ Completed Tasks: ${this.state.completedTasks.length}`);
    console.log(`❌ Failed Tasks: ${this.state.failedTasks.length}\n`);
    
    if (this.state.failedTasks.length > 0) {
      console.log('Failed Tasks:');
      this.state.failedTasks.forEach(ft => {
        console.log(`  - ${ft.spec} / Task ${ft.task}`);
      });
      console.log();
    }
    
    console.log('='.repeat(80) + '\n');
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// CLI Interface
if (require.main === module) {
  const args = process.argv.slice(2);
  const config = {};
  
  // Parse command line arguments
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--spec' && args[i + 1]) {
      config.executionOrder = [args[i + 1]];
      i++;
    } else if (args[i] === '--resume') {
      config.resume = true;
    } else if (args[i] === '--help') {
      console.log(`
Autonomous Task Executor

Usage:
  node task-executor.js [options]

Options:
  --spec <name>    Execute only the specified spec
  --resume         Resume from last checkpoint
  --help           Show this help message

Examples:
  node task-executor.js
  node task-executor.js --spec sentiment-moderation-service
  node task-executor.js --resume
      `);
      process.exit(0);
    }
  }
  
  const executor = new TaskExecutor(config);
  executor.run().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}

module.exports = TaskExecutor;
