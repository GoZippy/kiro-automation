import * as assert from 'assert';
import { TaskManager } from '../../src/TaskManager';
import { AutomationEngine } from '../../src/AutomationEngine';
import { MockKiroInterface } from '../fixtures/mocks/MockKiroInterface';
import { createTestWorkspace, cleanupTestWorkspace, createTestSpec } from '../helpers/testUtils';

suite('Performance: Task Processing', () => {
  let workspaceDir: string;
  let taskManager: TaskManager;
  let kiroInterface: MockKiroInterface;
  let automationEngine: AutomationEngine;

  setup(() => {
    workspaceDir = createTestWorkspace('perf-task-processing');
    taskManager = new TaskManager(workspaceDir);
    kiroInterface = new MockKiroInterface({ autoConnect: true, responseDelay: 10 });
    automationEngine = new AutomationEngine({
      maxRetries: 1,
      taskTimeout: 10000,
      taskDelay: 0,
    });
  });

  teardown(() => {
    automationEngine.dispose();
    taskManager.dispose();
    kiroInterface.dispose();
    cleanupTestWorkspace(workspaceDir);
  });

  test('should process 100 tasks within reasonable time', async function () {
    this.timeout(30000);

    // Generate 100 tasks
    let tasksContent = '# Performance Test\n\n';
    for (let i = 1; i <= 100; i++) {
      tasksContent += `- [ ] ${i}. Task ${i}\n`;
    }

    createTestSpec(workspaceDir, 'perf-spec', tasksContent);

    const startTime = Date.now();

    await taskManager.discoverTasks();
    automationEngine.initialize(taskManager, kiroInterface as any);
    await automationEngine.start();

    const duration = Date.now() - startTime;

    // Should complete in under 20 seconds (100 tasks * 10ms + overhead)
    assert.ok(duration < 20000, `Processing took ${duration}ms, expected < 20000ms`);

    console.log(`Processed 100 tasks in ${duration}ms (${(duration / 100).toFixed(2)}ms per task)`);
  });

  test('should handle large spec directories efficiently', async function () {
    this.timeout(30000);

    // Create 50 specs with 10 tasks each
    for (let i = 1; i <= 50; i++) {
      let content = '';
      for (let j = 1; j <= 10; j++) {
        content += `- [ ] ${j}. Task ${j}\n`;
      }
      createTestSpec(workspaceDir, `spec-${i}`, content);
    }

    const startTime = Date.now();
    const tasks = await taskManager.discoverTasks();
    const discoveryTime = Date.now() - startTime;

    assert.strictEqual(tasks.length, 500);
    assert.ok(discoveryTime < 5000, `Discovery took ${discoveryTime}ms, expected < 5000ms`);

    console.log(`Discovered 500 tasks across 50 specs in ${discoveryTime}ms`);
  });

  test('should maintain performance with deep task hierarchies', async function () {
    this.timeout(30000);

    // Create tasks with many subtasks
    let tasksContent = '# Deep Hierarchy\n\n';
    for (let i = 1; i <= 20; i++) {
      tasksContent += `- [ ] ${i}. Parent task ${i}\n`;
      for (let j = 1; j <= 10; j++) {
        tasksContent += `  - [ ] ${i}.${j} Subtask ${j}\n`;
      }
    }

    createTestSpec(workspaceDir, 'deep-spec', tasksContent);

    const startTime = Date.now();
    const tasks = await taskManager.discoverTasks();
    const parseTime = Date.now() - startTime;

    assert.strictEqual(tasks.length, 20);
    assert.ok(tasks.every((t) => t.subtasks.length === 10));
    assert.ok(parseTime < 2000, `Parsing took ${parseTime}ms, expected < 2000ms`);

    console.log(`Parsed 20 tasks with 200 subtasks in ${parseTime}ms`);
  });

  test('should efficiently update task status in large files', async function () {
    this.timeout(30000);

    // Create large task file
    let tasksContent = '# Large File\n\n';
    for (let i = 1; i <= 200; i++) {
      tasksContent += `- [ ] ${i}. Task ${i}\n  - Description for task ${i}\n  - _Requirements: ${i}.1_\n`;
    }

    createTestSpec(workspaceDir, 'large-spec', tasksContent);

    await taskManager.discoverTasks();

    const updateTimes: number[] = [];

    // Update 50 random tasks
    for (let i = 0; i < 50; i++) {
      const taskId = String(Math.floor(Math.random() * 200) + 1);
      const startTime = Date.now();
      taskManager.updateTaskStatus(taskId, 'completed' as any);
      await taskManager.persistTaskStatus(taskId);
      updateTimes.push(Date.now() - startTime);
    }

    const avgUpdateTime = updateTimes.reduce((a, b) => a + b, 0) / updateTimes.length;
    const maxUpdateTime = Math.max(...updateTimes);

    assert.ok(avgUpdateTime < 100, `Average update time ${avgUpdateTime}ms, expected < 100ms`);
    assert.ok(maxUpdateTime < 500, `Max update time ${maxUpdateTime}ms, expected < 500ms`);

    console.log(`Average status update: ${avgUpdateTime.toFixed(2)}ms, Max: ${maxUpdateTime}ms`);
  });

  test('should handle concurrent task execution efficiently', async function () {
    this.timeout(30000);

    // Create multiple specs
    for (let i = 1; i <= 10; i++) {
      let content = '';
      for (let j = 1; j <= 10; j++) {
        content += `- [ ] ${j}. Task ${j}\n`;
      }
      createTestSpec(workspaceDir, `concurrent-spec-${i}`, content);
    }

    await taskManager.discoverTasks();

    const startTime = Date.now();

    automationEngine.updateConfig({ concurrency: 5 });
    automationEngine.initialize(taskManager, kiroInterface as any);
    await automationEngine.start();

    const duration = Date.now() - startTime;

    // With concurrency=5, should be faster than sequential
    assert.ok(duration < 15000, `Concurrent execution took ${duration}ms, expected < 15000ms`);

    console.log(`Processed 100 tasks with concurrency=5 in ${duration}ms`);
  });
});
