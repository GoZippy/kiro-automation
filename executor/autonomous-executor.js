#!/usr/bin/env node

/**
 * Fully Autonomous Task Executor with Kiro Integration
 * 
 * This service runs completely autonomously, executing tasks without manual intervention.
 * It uses intelligent decision-making to handle common scenarios and only stops for
 * critical decisions that require human judgment.
 */

const fs = require('fs').promises;
const path = require('path');
const { spawn } = require('child_process');
const telemetry = require('./telemetry');

class AutonomousExecutor {
  constructor(config = {}) {
    // Determine workspace root - can be specified or auto-detected
    const workspaceRoot = config.workspaceRoot || 
                         process.env.KIRO_WORKSPACE || 
                         this.findWorkspaceRoot() ||
                         process.cwd();
    
    this.config = {
      // defaults; may be overridden by workspace .kiro/config.json
      specsDir: path.join(workspaceRoot, '.kiro', 'specs'),
      automationPath: '.kiro/automation',
      workspaceRoot: workspaceRoot,
      executionOrder: config.executionOrder || [
        'sentiment-moderation-service',
        'discord-reddit-connector',
        'zippy-trivia-show',
        'match-and-mind-puzzle-suite',
        'community-quest-rpg',
        'matchmaking-friend-finder'
      ],
  // stateFile and logFile are initialized during initialize() to be workspace-specific
  maxRetries: 3,
  dryRun: false,
  verbose: false,
      checkInterval: 5000, // Check task status every 5 seconds
      taskTimeout: 1800000, // 30 minutes per task
      autoDecisions: {
        // Automatically approve these patterns
        testFramework: 'jest',
        database: 'postgresql',
        cache: 'redis',
        authentication: 'jwt',
        logging: 'winston',
        styling: 'tailwind',
        linting: 'eslint',
        formatting: 'prettier',
        // Default responses to common questions
        proceedWithImplementation: 'yes',
        useRecommendedApproach: 'yes',
        followBestPractices: 'yes',
        addErrorHandling: 'yes',
        includeTests: 'yes',
        addDocumentation: 'yes'
      },
      ...config
    };
    
    this.state = {
      currentSpec: null,
      currentTask: null,
      currentSubtask: null,
      completedTasks: [],
      failedTasks: [],
      decisions: [],
      startTime: null,
      logs: []
    };
    
    this.kiroProcess = null;
  }

  async initialize() {
    this.log('🚀 Initializing Fully Autonomous Task Executor...\n');
    // If a workspace-level config exists, read it and override defaults
    try {
      const workspaceConfigPath = path.join(this.config.workspaceRoot, '.kiro', 'config.json');
      const workspaceConfigRaw = await fs.readFile(workspaceConfigPath, 'utf-8').catch(() => null);
      if (workspaceConfigRaw) {
        try {
          const workspaceConfig = JSON.parse(workspaceConfigRaw);
          if (workspaceConfig.specsPath) {
            this.config.specsDir = path.isAbsolute(workspaceConfig.specsPath)
              ? workspaceConfig.specsPath
              : path.join(this.config.workspaceRoot, workspaceConfig.specsPath);
          }
          if (workspaceConfig.automationPath) {
            this.config.automationPath = workspaceConfig.automationPath;
          }
        } catch (e) {
          this.log('⚠️  Failed to parse workspace config.json, continuing with defaults');
        }
      }

      // Resolve automation directory and state/log file paths
      const automationDir = path.isAbsolute(this.config.automationPath)
        ? this.config.automationPath
        : path.join(this.config.workspaceRoot, this.config.automationPath);

      this.config.stateFile = path.join(automationDir, 'execution-state.json');
      this.config.logFile = path.join(automationDir, 'execution.log');

      if (this.config.verbose) {
        this.log(`Verbose: workspaceRoot=${this.config.workspaceRoot}`);
        this.log(`Verbose: specsDir=${this.config.specsDir}`);
        this.log(`Verbose: automationDir=${automationDir}`);
        this.log(`Verbose: stateFile=${this.config.stateFile}`);
        this.log(`Verbose: logFile=${this.config.logFile}`);
      }

      // Create automation directory
      await fs.mkdir(automationDir, { recursive: true });

      // Acquire a simple lock to prevent concurrent executors for the same workspace
      this._lockFile = path.join(automationDir, 'execution-state.lock');
      const STALE_MS = 1000 * 60 * 60 * 24; // 24 hours considered stale
      try {
        // Try to create lock file exclusively
        await fs.open(this._lockFile, 'wx').then(handle => handle.write(String(process.pid)).then(() => handle.close()));
      } catch (err) {
        // Lock exists - attempt to detect if it's stale or process is gone
        try {
          const lockContents = await fs.readFile(this._lockFile, 'utf-8');
          const existingPid = parseInt(lockContents.trim(), 10);
          let processAlive = false;
          if (!Number.isNaN(existingPid)) {
            try {
              process.kill(existingPid, 0);
              processAlive = true;
            } catch (e) {
              processAlive = false;
            }
          }

          const stat = await fs.stat(this._lockFile).catch(() => null);
          const age = stat ? (Date.now() - stat.mtimeMs) : Infinity;

          if (processAlive && !this.config.force) {
            throw new Error(`Another executor (pid ${existingPid}) appears to be running for this workspace (lock file: ${this._lockFile}). Use --force to override.`);
          }

          if (!processAlive && age < STALE_MS && !this.config.force) {
            // If no process but lock is recent (someone may be starting), be conservative
            throw new Error(`Lock file present but process ${existingPid} not found; lock is recent (${Math.round(age/1000)}s). Use --force to override.`);
          }

          // Otherwise, consider lock stale or force requested => remove and recreate
          await fs.unlink(this._lockFile).catch(() => {});
          await fs.open(this._lockFile, 'wx').then(handle => handle.write(String(process.pid)).then(() => handle.close()));
        } catch (innerErr) {
          // Re-throw helpful message
          throw new Error(innerErr.message || 'Failed to acquire lock');
        }
      }

      // Ensure lock file is removed on exit
      const removeLock = async () => {
        try { await fs.unlink(this._lockFile).catch(() => {}); } catch (_) {}
      };
      process.on('exit', removeLock);
      process.on('SIGINT', () => { removeLock().then(() => process.exit(130)); });
      process.on('SIGTERM', () => { removeLock().then(() => process.exit(143)); });

      // Load previous state
      if (this.config.resume) {
        await this.loadState();
      } else {
        // If not resuming, start fresh and remove previous state file if it exists
        try {
          await fs.unlink(this.config.stateFile).catch(() => {});
        } catch (_) {}
        this.state = {
          currentSpec: null,
          currentTask: null,
          currentSubtask: null,
          completedTasks: [],
          failedTasks: [],
          decisions: [],
          startTime: null,
          logs: []
        };
      }
    } catch (err) {
      this.log(`⚠️  Initialization warning: ${err.message}`);
    }
    
    // Validate environment
    await this.validateEnvironment();
    
    this.log('✅ Initialization complete\n');
    try {
      // Initialize telemetry (opt-in controlled via env or CLI flag)
      await telemetry.init({ workspaceRoot: this.config.workspaceRoot, optIn: this.config.telemetryOptIn });
      telemetry.trackEvent('executor.initialized', { workspaceRoot: this.config.workspaceRoot });
    } catch (e) {
      this.log('⚠️  Telemetry initialization failed: ' + e.message);
    }
  }

  async validateEnvironment() {
    // Check if specs directory exists
    try {
      await fs.access(this.config.specsDir);
    } catch (error) {
      // Try to list nearby spec directories for a helpful message
      const parent = path.join(this.config.workspaceRoot, '.kiro');
      let available = [];
      try {
        const entries = await fs.readdir(parent);
        for (const e of entries) {
          const p = path.join(parent, e);
          try {
            const stat = await fs.stat(p);
            if (stat.isDirectory() && e !== 'automation') available.push(e);
          } catch (_) {}
        }
      } catch (_) {
        // ignore
      }

      let msg = `Specs directory not found: ${this.config.specsDir}`;
      if (available.length > 0) {
        msg += `\nAvailable spec folders under ${parent}: ${available.join(', ')}`;
      } else {
        msg += `\nNo specs found under ${parent}. Create a spec folder or verify your workspace.`;
      }
      throw new Error(msg);
    }
    
    // Check if we're in a valid workspace
    try {
      await fs.access(path.join(this.config.workspaceRoot, 'package.json'));
    } catch (error) {
      this.log('⚠️  No package.json found - will create one if needed');
    }
  }

  async loadState() {
    try {
      const stateData = await fs.readFile(this.config.stateFile, 'utf-8');
      const savedState = JSON.parse(stateData);
      this.state = { ...this.state, ...savedState };
      this.log('📂 Loaded previous execution state');
      
      if (this.state.currentTask) {
        this.log(`   Resuming from: ${this.state.currentSpec} / Task ${this.state.currentTask}`);
      }
    } catch (error) {
      this.log('📝 Starting fresh execution');
    }
  }

  async saveState() {
    try {
      // Ensure state directory exists
      await fs.mkdir(path.dirname(this.config.stateFile), { recursive: true });
      await fs.writeFile(this.config.stateFile, JSON.stringify(this.state, null, 2));
    } catch (error) {
      this.log(`⚠️  Failed to save state: ${error.message}`);
    }
  }

  log(message, level = 'info') {
    const timestamp = new Date().toISOString();
    const logEntry = `[${timestamp}] [${level.toUpperCase()}] ${message}`;
    
    // Respect verbose flag: always print errors, print other levels only when verbose
    if (level === 'error' || this.config.verbose) {
      console.log(message);
    }

    // Keep logs in memory for state and always store them
    this.state.logs.push(logEntry);
    // Write to log file asynchronously (best-effort)
    fs.appendFile(this.config.logFile, logEntry + '\n').catch(() => {});
  }

  async run() {
    try {
      await this.initialize();
      
      this.state.startTime = this.state.startTime || new Date().toISOString();
      
      // Determine starting point
      let startIndex = 0;
      if (this.state.currentSpec) {
        startIndex = this.config.executionOrder.indexOf(this.state.currentSpec);
        if (startIndex === -1) startIndex = 0;
      }
      
      // Execute specs in order
      for (let i = startIndex; i < this.config.executionOrder.length; i++) {
        const specName = this.config.executionOrder[i];
        
        this.log(`\n${'='.repeat(80)}`);
        this.log(`📦 Processing Spec: ${specName}`);
        this.log(`${'='.repeat(80)}\n`);
        
        this.state.currentSpec = specName;
        await this.saveState();
        
        const success = await this.executeSpec(specName);
        
        if (!success) {
          this.log(`\n❌ Spec ${specName} failed. Stopping execution.`);
          await this.handleFailure(specName);
          break;
        }
        
        this.log(`\n✅ Spec ${specName} completed successfully!\n`);
      }
      
      await this.printSummary();
      await this.saveState();
      
    } catch (error) {
      this.log(`💥 Fatal error: ${error.message}`, 'error');
      this.log(error.stack, 'error');
      await this.saveState();
      process.exit(1);
    }
  }

  async executeSpec(specName) {
    const specDir = path.join(this.config.specsDir, specName);
    const tasksFile = path.join(specDir, 'tasks.md');
    const requirementsFile = path.join(specDir, 'requirements.md');
    const designFile = path.join(specDir, 'design.md');
    
    // Build comprehensive context
    const context = await this.buildComprehensiveContext(
      specName,
      requirementsFile,
      designFile
    );
    
    // Parse tasks
    const tasks = await this.parseTasks(tasksFile);
    
    this.log(`📋 Found ${tasks.length} top-level tasks\n`);
  try { telemetry.trackEvent('spec.parsed', { specName, taskCount: tasks.length }); } catch (e) {}
    
  // Execute tasks sequentially
    for (const task of tasks) {
      // Skip if already completed
      if (await this.isTaskCompleted(tasksFile, task.id)) {
        this.log(`⏭️  Skipping completed task: ${task.id} ${task.title}`);
        continue;
      }
      
      this.log(`\n${'─'.repeat(80)}`);
      this.log(`🔨 Executing Task: ${task.id} ${task.title}`);
      this.log(`${'─'.repeat(80)}\n`);
      
      this.state.currentTask = task.id;
      await this.saveState();
  try { telemetry.trackEvent('task.started', { specName, taskId: task.id }); } catch (e) {}
      
      const success = await this.executeTaskAutonomously(
        task,
        context,
        tasksFile,
        specDir
      );
      
      if (!success) {
        this.log(`\n❌ Task ${task.id} failed after ${this.config.maxRetries} retries`);
        this.state.failedTasks.push({
          spec: specName,
          task: task.id,
          timestamp: new Date().toISOString()
        });
        await this.saveState();
        try { telemetry.trackEvent('task.failed', { specName, taskId: task.id }); } catch (e) {}
        return false;
      }
      
      this.state.completedTasks.push({
        spec: specName,
        task: task.id,
        timestamp: new Date().toISOString()
      });
      try { telemetry.trackEvent('task.completed', { specName, taskId: task.id }); } catch (e) {}
      
      await this.markTaskComplete(tasksFile, task.id);
      await this.saveState();
      
      this.log(`\n✅ Task ${task.id} completed successfully\n`);
    }
    
    return true;
  }

  async buildComprehensiveContext(specName, requirementsFile, designFile) {
    const context = {
      specName,
      requirements: '',
      design: '',
      bestPractices: this.getBestPractices(),
      projectStructure: await this.analyzeProjectStructure(),
      existingCode: await this.analyzeExistingCode(specName),
      dependencies: await this.analyzeDependencies()
    };
    
    try {
      context.requirements = await fs.readFile(requirementsFile, 'utf-8');
    } catch (error) {
      this.log('⚠️  Requirements file not found');
    }
    
    try {
      context.design = await fs.readFile(designFile, 'utf-8');
    } catch (error) {
      this.log('⚠️  Design file not found');
    }
    
    return context;
  }

  async analyzeProjectStructure() {
    const structure = {
      hasPackageJson: false,
      hasSrcDir: false,
      hasTestDir: false,
      hasDocsDir: false,
      directories: []
    };
    
    try {
      const files = await fs.readdir(this.config.workspaceRoot);
      structure.hasPackageJson = files.includes('package.json');
      structure.hasSrcDir = files.includes('src');
      structure.hasTestDir = files.includes('test') || files.includes('tests');
      structure.hasDocsDir = files.includes('docs');

      for (const file of files) {
        try {
          const stat = await fs.stat(path.join(this.config.workspaceRoot, file));
          if (stat.isDirectory()) {
            structure.directories.push(file);
          }
        } catch (_) {
          // ignore
        }
      }
    } catch (error) {
      this.log(`⚠️  Could not analyze project structure: ${error.message}`);
    }
    
    return structure;
  }

  async analyzeExistingCode(specName) {
    const analysis = {
      files: [],
      patterns: [],
      technologies: []
    };
    
    // Look for existing code related to this spec
    const possibleDirs = [
      path.join(this.config.workspaceRoot, 'src', specName),
      path.join(this.config.workspaceRoot, specName),
      path.join(this.config.workspaceRoot, 'services', specName)
    ];
    
    for (const dir of possibleDirs) {
      try {
        const files = await this.getFilesRecursively(dir);
        analysis.files.push(...files);
      } catch (error) {
        // Directory doesn't exist yet
      }
    }
    
    return analysis;
  }

  async getFilesRecursively(dir, fileList = []) {
    try {
      const files = await fs.readdir(dir);
      
      for (const file of files) {
        const filePath = path.join(dir, file);
        const stat = await fs.stat(filePath);
        
        if (stat.isDirectory()) {
          await this.getFilesRecursively(filePath, fileList);
        } else {
          fileList.push(filePath);
        }
      }
    } catch (error) {
      // Ignore errors
    }
    
    return fileList;
  }

  async analyzeDependencies() {
    const deps = {
      production: [],
      development: [],
      missing: []
    };
    
    try {
      const packageJson = JSON.parse(
        await fs.readFile(
          path.join(this.config.workspaceRoot, 'package.json'),
          'utf-8'
        )
      );
      
      deps.production = Object.keys(packageJson.dependencies || {});
      deps.development = Object.keys(packageJson.devDependencies || {});
    } catch (error) {
      this.log('⚠️  No package.json found');
    }
    
    return deps;
  }

  getBestPractices() {
    return `
# Autonomous Execution Guidelines

## Decision-Making Framework
When encountering choices during implementation, use this framework:

1. **Check if there's a standard pattern** - Use established patterns from the codebase
2. **Refer to design document** - Follow architectural decisions already made
3. **Apply best practices** - Use industry-standard approaches
4. **Choose simplicity** - Prefer simple, maintainable solutions
5. **Document decisions** - Add comments explaining non-obvious choices

## Auto-Approval Scenarios
Proceed automatically with:
- Standard CRUD operations
- Common authentication/authorization patterns
- Standard error handling (try-catch, validation)
- Test implementations following existing patterns
- Database migrations for new tables/columns
- API endpoint implementations matching design
- UI components following design system
- Configuration file updates
- Documentation and README updates
- Dependency installations for standard libraries

## Default Technology Choices
- **Language**: TypeScript for type safety
- **Testing**: Jest for unit tests, Playwright for E2E
- **Database**: PostgreSQL for relational, Redis for caching
- **API**: RESTful with Express.js
- **Authentication**: JWT tokens
- **Validation**: Zod or Joi
- **Logging**: Winston with JSON format
- **Error Handling**: Custom error classes with proper HTTP codes
- **Date/Time**: UTC timestamps, ISO 8601 format
- **IDs**: UUIDs for public IDs

## Code Quality Standards
- **Coverage**: Aim for 80%+ test coverage
- **Complexity**: Keep cyclomatic complexity under 10
- **Function Length**: Max 50 lines per function
- **File Length**: Max 300 lines per file
- **Naming**: Use descriptive names (no single letters except loops)
- **Comments**: Explain "why", not "what"
- **DRY**: Don't repeat yourself - extract common logic

## Error Handling Pattern
\`\`\`typescript
try {
  // Operation
  const result = await someOperation();
  return { success: true, data: result };
} catch (error) {
  logger.error('Operation failed', { error, context });
  throw new CustomError('User-friendly message', {
    code: 'ERROR_CODE',
    originalError: error
  });
}
\`\`\`

## API Response Pattern
\`\`\`typescript
// Success
{ success: true, data: {...}, meta: { timestamp, requestId } }

// Error
{ success: false, error: { message, code, details }, meta: { timestamp, requestId } }
\`\`\`

## When to Stop and Ask
ONLY stop for user input when:
1. **Security-critical decisions** - Encryption methods, auth strategies
2. **Data loss risk** - Destructive operations, migrations
3. **External integrations** - API keys, third-party services
4. **Business logic ambiguity** - Domain-specific rules unclear
5. **Breaking changes** - Changes affecting existing APIs
6. **Budget/resource decisions** - Paid services, infrastructure choices

For everything else, make the best decision and document it.
`;
  }

  async parseTasks(tasksFile) {
    const content = await fs.readFile(tasksFile, 'utf-8');
    const tasks = [];
    const lines = content.split('\n');
    
    let currentTask = null;
    let currentSubtasks = [];
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      
      // Match main tasks: - [ ] 1. Task or - [x] 1. Task or - [~] 1. Task
      // Trim the line first to handle Windows line endings
      const trimmedLine = line.trim();
      const mainTaskMatch = trimmedLine.match(/^- \[(.)\] (\d+)\. (.+)$/);
      if (mainTaskMatch) {

        if (currentTask) {
          currentTask.subtasks = currentSubtasks;
          tasks.push(currentTask);
        }
        currentTask = {
          id: mainTaskMatch[2],
          title: mainTaskMatch[3],
          status: mainTaskMatch[1] === 'x' ? 'completed' : mainTaskMatch[1] === '~' ? 'in-progress' : 'not-started',
          description: [],
          subtasks: [],
          requirements: []
        };
        currentSubtasks = [];
        continue;
      }
      
      // Match subtasks
      const subtaskMatch = trimmedLine.match(/^- \[(.)\] (\d+\.\d+) (.+)$/);
      if (subtaskMatch && currentTask) {
        currentSubtasks.push({
          id: subtaskMatch[2],
          title: subtaskMatch[3],
          status: subtaskMatch[1] === 'x' ? 'completed' : subtaskMatch[1] === '~' ? 'in-progress' : 'not-started',
          description: []
        });
        continue;
      }
      
      // Collect description
      if (currentTask && line.trim().startsWith('-') && !line.includes('[')) {
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

  async executeTaskAutonomously(task, context, tasksFile, specDir) {
    // Mark task as in progress
    await this.markTaskInProgress(tasksFile, task.id);
    
    // Build comprehensive prompt
    const prompt = this.buildAutonomousPrompt(task, context);
    
    // Create a dedicated file for this task's implementation
    const taskWorkDir = path.join(specDir, 'implementation', `task-${task.id}`);
    await fs.mkdir(taskWorkDir, { recursive: true });
    
    const promptFile = path.join(taskWorkDir, 'prompt.md');
    await fs.writeFile(promptFile, prompt);
    
    this.log(`📝 Task prompt saved to: ${promptFile}`);
    
    // Execute with retries
    for (let attempt = 1; attempt <= this.config.maxRetries; attempt++) {
      this.log(`\n🔄 Attempt ${attempt}/${this.config.maxRetries}\n`);
      
      try {
        let result;
        if (this.config.dryRun) {
          this.log('🟡 Dry-run enabled: simulating execution and verification');
          result = { success: true };
        } else {
          result = await this.executeWithKiro(prompt, task, taskWorkDir);
        }
        
        if (result.success) {
          // Verify implementation
          const verification = this.config.dryRun ? { success: true } : await this.verifyImplementation(task, taskWorkDir);
          
          if (verification.success) {
            this.log(`✅ Implementation verified successfully`);
            return true;
          } else {
            this.log(`⚠️  Verification failed: ${verification.error}`);
            if (attempt < this.config.maxRetries) {
              this.log(`🔧 Attempting to fix issues...`);
              // Add fix instructions to prompt
              prompt += `\n\n## Issues Found\n${verification.error}\n\nPlease fix these issues.`;
              continue;
            }
          }
        }
        
        this.log(`⚠️  Attempt ${attempt} failed: ${result.error}`);
        
      } catch (error) {
        this.log(`❌ Error during attempt ${attempt}: ${error.message}`, 'error');
      }
      
      if (attempt < this.config.maxRetries) {
        this.log(`⏳ Waiting before retry...\n`);
        await this.sleep(5000);
      }
    }
    
    return false;
  }

  buildAutonomousPrompt(task, context) {
    return `# Autonomous Task Execution

## Task: ${task.id} - ${task.title}

${task.description.join('\n')}

## Subtasks
${task.subtasks.map(st => `### ${st.id} ${st.title}\n${st.description.join('\n')}`).join('\n\n')}

## Requirements
${task.requirements.map(req => `- ${req}`).join('\n')}

## Context

### Project Structure
\`\`\`
${JSON.stringify(context.projectStructure, null, 2)}
\`\`\`

### Existing Code
${context.existingCode.files.length > 0 ? `Found ${context.existingCode.files.length} existing files` : 'No existing code for this module'}

### Dependencies
Production: ${context.dependencies.production.join(', ') || 'None'}
Development: ${context.dependencies.development.join(', ') || 'None'}

### Relevant Requirements
${this.extractRelevantSections(context.requirements, task.requirements)}

### Relevant Design
${this.extractRelevantDesign(context.design, task.title)}

## Execution Guidelines

${context.bestPractices}

## Instructions

**IMPORTANT: Execute this task completely autonomously.**

1. **Analyze** - Review all context and requirements
2. **Plan** - Determine the implementation approach
3. **Implement** - Write all code for this task and subtasks
4. **Test** - Write and run tests
5. **Verify** - Check for errors and validate functionality
6. **Document** - Add necessary comments and documentation

**Make decisions automatically** using the guidelines above. Only ask for input if you encounter a security-critical decision or data loss risk.

**Begin implementation now. Complete all subtasks.**
`;
  }

  extractRelevantSections(content, reqIds) {
    if (!content || !reqIds || reqIds.length === 0) {
      return 'No specific requirements referenced';
    }
    
    const sections = [];
    for (const reqId of reqIds) {
      const regex = new RegExp(`### Requirement ${reqId}[\\s\\S]*?(?=### Requirement|$)`, 'i');
      const match = content.match(regex);
      if (match) {
        sections.push(match[0]);
      }
    }
    
    return sections.length > 0 ? sections.join('\n\n') : 'Requirements sections not found';
  }

  extractRelevantDesign(design, taskTitle) {
    if (!design) return 'No design document available';
    
    const keywords = taskTitle.toLowerCase().split(' ').filter(w => w.length > 3);
    const sections = [];
    const lines = design.split('\n');
    let currentSection = [];
    let isRelevant = false;
    
    for (const line of lines) {
      if (line.startsWith('##')) {
        if (isRelevant && currentSection.length > 0) {
          sections.push(currentSection.join('\n'));
        }
        currentSection = [line];
        isRelevant = keywords.some(kw => line.toLowerCase().includes(kw));
      } else {
        currentSection.push(line);
      }
    }
    
    if (isRelevant && currentSection.length > 0) {
      sections.push(currentSection.join('\n'));
    }
    
    return sections.length > 0 ? sections.join('\n\n') : 'Review full design document for context';
  }

  async executeWithKiro(prompt, task, workDir) {
    // This would integrate with Kiro's actual API/CLI
    // For now, we'll simulate the execution
    
  this.log('🤖 Executing task with Kiro...');
    
    // In a real implementation, this would:
    // 1. Send prompt to Kiro API
    // 2. Monitor execution progress
    // 3. Handle any questions with auto-decisions
    // 4. Wait for completion
    // 5. Collect results
    
    // Placeholder: Write instructions for manual execution
    const instructionsFile = path.join(workDir, 'EXECUTE.md');
    await fs.writeFile(instructionsFile, `
# Task Execution Instructions

This task is ready for autonomous execution.

## Option 1: Kiro Chat (Manual)
1. Open Kiro chat
2. Copy the prompt from \`prompt.md\`
3. Paste and let Kiro execute
4. Kiro will complete all subtasks automatically

## Option 2: Kiro API (Automated - Coming Soon)
\`\`\`bash
kiro execute --prompt prompt.md --auto-approve
\`\`\`

## Expected Outputs
- All code files for this task
- Test files
- Updated documentation
- No errors or warnings

## Auto-Decisions Enabled
The prompt includes guidelines for automatic decision-making.
Kiro will proceed without asking for common choices.
`);
    
    this.log(`📋 Execution instructions: ${instructionsFile}`);
    this.log('\n⚠️  INTEGRATION POINT: This is where Kiro API would be called');
    this.log('   For now, execute manually and press Enter when complete...\n');
    
    // Wait for completion (in real version, this would poll Kiro API)
    if (this.config.dryRun) {
      // Don't wait for interactive completion during dry-run
      return { success: true };
    }
    await this.waitForCompletion();
    
    return { success: true };
  }

  async waitForCompletion() {
    return new Promise((resolve) => {
      const readline = require('readline').createInterface({
        input: process.stdin,
        output: process.stdout
      });
      
      readline.question('Press Enter when task is complete: ', () => {
        readline.close();
        resolve();
      });
    });
  }

  async verifyImplementation(task, workDir) {
    this.log('🔍 Verifying implementation...');
    
    // Check for common issues
    const issues = [];
    
    // Check if files were created
    const files = await this.getFilesRecursively(workDir);
    if (files.length === 0) {
      issues.push('No files were created');
    }
    
    // Check for test files if task includes testing
    const hasTestSubtask = task.subtasks.some(st => 
      st.title.toLowerCase().includes('test')
    );
    
    if (hasTestSubtask) {
      const hasTestFiles = files.some(f => 
        f.includes('.test.') || f.includes('.spec.')
      );
      if (!hasTestFiles) {
        issues.push('Test files are missing');
      }
    }
    
    if (issues.length > 0) {
      return {
        success: false,
        error: issues.join('; ')
      };
    }
    
    return { success: true };
  }

  async isTaskCompleted(tasksFile, taskId) {
    const content = await fs.readFile(tasksFile, 'utf-8');
    const regex = new RegExp(`^- \\[x\\] ${taskId}\\.`, 'm');
    return regex.test(content);
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

  async handleFailure(specName) {
    this.log('\n🔧 Failure Recovery Options:\n');
    this.log('1. Review logs: .kiro/automation/execution.log');
    this.log('2. Check state: .kiro/automation/execution-state.json');
    this.log('3. Resume with: node autonomous-executor.js --resume');
    this.log('4. Skip failed spec and continue: node autonomous-executor.js --skip-failed\n');
  }

  async printSummary() {
    const duration = Date.now() - new Date(this.state.startTime).getTime();
    const hours = Math.floor(duration / 3600000);
    const minutes = Math.floor((duration % 3600000) / 60000);
    
    this.log('\n' + '='.repeat(80));
    this.log('📊 EXECUTION SUMMARY');
    this.log('='.repeat(80) + '\n');
    
    this.log(`⏱️  Duration: ${hours}h ${minutes}m`);
    this.log(`✅ Completed: ${this.state.completedTasks.length} tasks`);
    this.log(`❌ Failed: ${this.state.failedTasks.length} tasks`);
    this.log(`🤖 Decisions: ${this.state.decisions.length} auto-decisions made\n`);
    
    if (this.state.failedTasks.length > 0) {
      this.log('Failed Tasks:');
      this.state.failedTasks.forEach(ft => {
        this.log(`  - ${ft.spec} / Task ${ft.task} (${ft.timestamp})`);
      });
      this.log();
    }
    
    this.log('📁 Logs saved to: ' + this.config.logFile);
    this.log('💾 State saved to: ' + this.config.stateFile);
    this.log('\n' + '='.repeat(80) + '\n');
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  findWorkspaceRoot(startDir = process.cwd()) {
    let currentDir = startDir;
    const root = path.parse(currentDir).root;
    
    while (currentDir !== root) {
      const kiroDir = path.join(currentDir, '.kiro');
      try {
        if (require('fs').existsSync(kiroDir)) {
          return currentDir;
        }
      } catch (error) {
        // Continue searching
      }
      currentDir = path.dirname(currentDir);
    }
    
    return null;
  }
}

// CLI
if (require.main === module) {
  const args = process.argv.slice(2);
  const config = {};
  // telemetry opt-in via env var (KIRO_TELEMETRY=1) or CLI flag
  config.telemetryOptIn = process.env.KIRO_TELEMETRY === '1' || process.env.KIRO_TELEMETRY === 'true';
  
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--spec' && args[i + 1]) {
      config.executionOrder = [args[i + 1]];
      i++;
    } else if (args[i] === '--dry-run') {
      config.dryRun = true;
    } else if (args[i] === '--verbose') {
      config.verbose = true;
    } else if (args[i] === '--force') {
      config.force = true;
    } else if (args[i] === '--workspace' && args[i + 1]) {
      config.workspaceRoot = path.resolve(args[i + 1]);
      i++;
    } else if (args[i] === '--resume') {
      config.resume = true;
    } else if (args[i] === '--help') {
      console.log(`
Fully Autonomous Task Executor

Usage:
  node autonomous-executor.js [options]

Options:
  --spec <name>       Execute only the specified spec
  --workspace <path>  Path to workspace (default: auto-detect or current directory)
  --resume            Resume from last checkpoint
  --help              Show this help

Environment Variables:
  KIRO_WORKSPACE      Path to workspace (alternative to --workspace)

Examples:
  node autonomous-executor.js
  node autonomous-executor.js --spec sentiment-moderation-service
  node autonomous-executor.js --workspace /path/to/workspace
  node autonomous-executor.js --resume
  
  # With environment variable
  export KIRO_WORKSPACE=/path/to/workspace
  node autonomous-executor.js
      `);
      process.exit(0);
    }
  }
  // also allow explicit telemetry flags
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--telemetry-opt-in') config.telemetryOptIn = true;
    if (args[i] === '--telemetry-opt-out') config.telemetryOptIn = false;
  }
  // Early action: list available specs and exit
  if (args.includes('--list-specs')) {
    // Determine workspace root (flag overrides env)
    let ws = process.env.KIRO_WORKSPACE || null;
    const wsIndex = args.indexOf('--workspace');
    if (wsIndex !== -1 && args[wsIndex + 1]) ws = path.resolve(args[wsIndex + 1]);
    if (!ws) ws = (new AutonomousExecutor({})).findWorkspaceRoot() || process.cwd();

    const specsDir = path.join(ws, '.kiro', 'specs');
    try {
      const entries = require('fs').readdirSync(specsDir, { withFileTypes: true });
      const specs = entries.filter(e => e.isDirectory()).map(d => d.name);
      if (specs.length === 0) {
        console.log(`No specs found in ${specsDir}`);
      } else {
        console.log(`Specs in ${specsDir}:\n` + specs.join('\n'));
      }
    } catch (e) {
      console.error(`Failed to list specs at ${specsDir}: ${e.message}`);
      process.exit(2);
    }
    process.exit(0);
  }
  
  const executor = new AutonomousExecutor(config);
  executor.run().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}

module.exports = AutonomousExecutor;
