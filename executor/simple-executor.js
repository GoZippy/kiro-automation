#!/usr/bin/env node

/**
 * Simple Task Executor - Works with Current Kiro Chat
 * 
 * This script simply reads the next incomplete task and outputs a prompt
 * that you can paste into the current Kiro chat. Much simpler than trying
 * to automate the chat itself.
 */

const fs = require('fs').promises;
const path = require('path');

class SimpleExecutor {
  constructor() {
    const workspaceRoot = path.resolve(__dirname, '..', '..');
    
    this.config = {
      specsDir: path.join(workspaceRoot, '.kiro', 'specs'),
      executionOrder: [
        'sentiment-moderation-service',
        'discord-reddit-connector',
        'zippy-trivia-show',
        'match-and-mind-puzzle-suite',
        'community-quest-rpg',
        'matchmaking-friend-finder'
      ]
    };
  }

  async run() {
    console.log('🔍 Finding next task to execute...\n');
    
    for (const specName of this.config.executionOrder) {
      const tasksFile = path.join(this.config.specsDir, specName, 'tasks.md');
      const requirementsFile = path.join(this.config.specsDir, specName, 'requirements.md');
      const designFile = path.join(this.config.specsDir, specName, 'design.md');
      
      try {
        const content = await fs.readFile(tasksFile, 'utf-8');
        const lines = content.split('\n');
        
        // Find first incomplete task
        for (let i = 0; i < lines.length; i++) {
          const line = lines[i].trim();
          const match = line.match(/^- \[ \] (\d+)\. (.+)$/);
          
          if (match) {
            const taskId = match[1];
            const taskTitle = match[2];
            
            console.log(`📦 Spec: ${specName}`);
            console.log(`🔨 Next Task: ${taskId}. ${taskTitle}\n`);
            console.log('─'.repeat(80));
            console.log('\n📋 COPY THE PROMPT BELOW AND PASTE INTO KIRO CHAT:\n');
            console.log('─'.repeat(80));
            console.log();
            
            // Generate simple prompt
            const prompt = await this.generatePrompt(specName, taskId, taskTitle, requirementsFile, designFile, tasksFile, i);
            console.log(prompt);
            
            console.log();
            console.log('─'.repeat(80));
            console.log('\n✅ After Kiro completes the task, run this script again to get the next task.\n');
            
            return;
          }
        }
        
        console.log(`✅ All tasks complete for ${specName}\n`);
        
      } catch (error) {
        console.error(`⚠️  Could not read ${specName}: ${error.message}`);
      }
    }
    
    console.log('🎉 All specs complete!\n');
  }

  async generatePrompt(specName, taskId, taskTitle, requirementsFile, designFile, tasksFile, lineNumber) {
    let prompt = `Execute Task ${taskId}: ${taskTitle}

Spec: ${specName}

`;

    // Read task details
    try {
      const tasksContent = await fs.readFile(tasksFile, 'utf-8');
      const lines = tasksContent.split('\n');
      
      // Extract subtasks and details
      let subtasks = [];
      let requirements = [];
      
      for (let i = lineNumber + 1; i < lines.length; i++) {
        const line = lines[i];
        
        // Stop at next main task
        if (line.trim().match(/^- \[.\] \d+\./)) {
          break;
        }
        
        // Collect subtasks
        if (line.trim().match(/^- \[ \] \d+\.\d+/)) {
          subtasks.push(line.trim().replace(/^- \[ \] /, ''));
        }
        
        // Collect requirements
        const reqMatch = line.match(/_Requirements?: (.+)_/);
        if (reqMatch) {
          requirements = reqMatch[1].split(',').map(r => r.trim());
        }
      }
      
      if (subtasks.length > 0) {
        prompt += 'Subtasks:\n';
        subtasks.forEach(st => prompt += `- ${st}\n`);
        prompt += '\n';
      }
      
      if (requirements.length > 0) {
        prompt += `Requirements: ${requirements.join(', ')}\n\n`;
      }
      
    } catch (error) {
      // Continue without task details
    }

    // Add context references
    prompt += `Context:
- Requirements: .kiro/specs/${specName}/requirements.md
- Design: .kiro/specs/${specName}/design.md
- Tasks: .kiro/specs/${specName}/tasks.md

Instructions:
1. Review the requirements and design documents
2. Implement all subtasks for Task ${taskId}
3. Write clean, well-documented code
4. Follow best practices from the design document
5. When complete, mark the task as done by changing [ ] to [x] in tasks.md

Begin implementation now.`;

    return prompt;
  }
}

// Run
const executor = new SimpleExecutor();
executor.run().catch(error => {
  console.error('Error:', error);
  process.exit(1);
});
