import * as assert from 'assert';
import { TaskManager } from '../../src/TaskManager';
import { AutomationEngine } from '../../src/AutomationEngine';
import { MockKiroInterface } from '../fixtures/mocks/MockKiroInterface';
import { createTestWorkspace, cleanupTestWorkspace, createTestSpec } from '../helpers/testUtils';

suite('Performance: Memory Usage', () => {
  let workspaceDir: string;

  setup(() => {
    workspaceDir = createTestWorkspace('perf-memory');
  });

  teardown(() => {
    cleanupTestWorkspace(workspaceDir);
  });

  function getMemoryUsage(): number {
    const usage = process.memoryUsage();
    return usage.heapUsed / 1024 / 1024; // Convert to MB
  }

  function forceGC(): void {
    if (global.gc) {
      global.gc();
    }
  }

  test('should not leak memory during task discovery', async function () {
    this.timeout(30000);

    // Create many specs
    for (let i = 1; i <= 100; i++) {
      createTestSpec(workspaceDir, `spec-${i}`, `- [ ] 1. Task 1\n- [ ] 2. Task 2\n`);
    }

    forceGC();
    const initialMemory = getMemoryUsage();

    // Discover tasks multiple times
    for (let i = 0; i < 10; i++) {
      const taskManager = new TaskManager(workspaceDir);
      await taskManager.discoverTasks();
      taskManager.dispose();
    }

    forceGC();
    const finalMemory = getMemoryUsage();
    const memoryIncrease = finalMemory - initialMemory;

    console.log(`Memory: Initial ${initialMemory.toFixed(2)}MB, Final ${finalMemory.toFixed(2)}MB, Increase ${memoryIncrease.toFixed(2)}MB`);

    // Memory increase should be minimal (< 50MB)
    assert.ok(memoryIncrease < 50, `Memory increased by ${memoryIncrease.toFixed(2)}MB, expected < 50MB`);
  });

  test('should maintain reasonable memory usage under load', async function () {
    this.timeout(30000);

    // Create large spec
    let tasksContent = '';
    for (let i = 1; i <= 500; i++) {
      tasksContent += `- [ ] ${i}. Task ${i}\n  - Description\n  - _Requirements: ${i}.1_\n`;
    }
    createTestSpec(workspaceDir, 'large-spec', tasksContent);

    forceGC();
    const initialMemory = getMemoryUsage();

    const taskManager = new TaskManager(workspaceDir);
    const kiroInterface = new MockKiroInterface({ autoConnect: true, responseDelay: 1 });
    const automationEngine = new AutomationEngine({ taskDelay: 0 });

    await taskManager.discoverTasks();
    automationEngine.initialize(taskManager, kiroInterface as any);

    const memoryDuringSetup = getMemoryUsage();

    await automationEngine.start();

    const memoryAfterExecution = getMemoryUsage();

    automationEngine.dispose();
    taskManager.dispose();
    kiroInterface.dispose();

    forceGC();
    const finalMemory = getMemoryUsage();

    console.log(`Memory usage: Initial ${initialMemory.toFixed(2)}MB, Setup ${memoryDuringSetup.toFixed(2)}MB, After ${memoryAfterExecution.toFixed(2)}MB, Final ${finalMemory.toFixed(2)}MB`);

    // Memory should not exceed 100MB during execution
    assert.ok(memoryAfterExecution < 100, `Memory usage ${memoryAfterExecution.toFixed(2)}MB, expected < 100MB`);

    // Memory should be released after disposal
    const memoryRetained = finalMemory - initialMemory;
    assert.ok(memoryRetained < 20, `Memory retained ${memoryRetained.toFixed(2)}MB, expected < 20MB`);
  });

  test('should handle memory efficiently with file watching', async function () {
    this.timeout(30000);

    // Create multiple specs
    for (let i = 1; i <= 50; i++) {
      createTestSpec(workspaceDir, `watch-spec-${i}`, `- [ ] 1. Task 1\n`);
    }

    forceGC();
    const initialMemory = getMemoryUsage();

    const taskManager = new TaskManager(workspaceDir);
    await taskManager.discoverTasks();
    await taskManager.startWatching();

    const memoryWithWatchers = getMemoryUsage();

    await taskManager.stopWatching();
    taskManager.dispose();

    forceGC();
    const finalMemory = getMemoryUsage();

    const watcherOverhead = memoryWithWatchers - initialMemory;
    const memoryReleased = memoryWithWatchers - finalMemory;

    console.log(`Watcher overhead: ${watcherOverhead.toFixed(2)}MB, Released: ${memoryReleased.toFixed(2)}MB`);

    // Watcher overhead should be reasonable
    assert.ok(watcherOverhead < 30, `Watcher overhead ${watcherOverhead.toFixed(2)}MB, expected < 30MB`);

    // Most memory should be released
    assert.ok(memoryReleased > watcherOverhead * 0.7, 'At least 70% of watcher memory should be released');
  });

  test('should not accumulate memory with repeated automation cycles', async function () {
    this.timeout(30000);

    createTestSpec(workspaceDir, 'cycle-spec', '- [ ] 1. Task 1\n- [ ] 2. Task 2\n- [ ] 3. Task 3\n');

    forceGC();
    const initialMemory = getMemoryUsage();

    const memoryReadings: number[] = [];

    // Run 10 automation cycles
    for (let i = 0; i < 10; i++) {
      const taskManager = new TaskManager(workspaceDir);
      const kiroInterface = new MockKiroInterface({ autoConnect: true, responseDelay: 1 });
      const automationEngine = new AutomationEngine({ taskDelay: 0 });

      await taskManager.discoverTasks();
      automationEngine.initialize(taskManager, kiroInterface as any);
      await automationEngine.start();

      automationEngine.dispose();
      taskManager.dispose();
      kiroInterface.dispose();

      forceGC();
      memoryReadings.push(getMemoryUsage());
    }

    const finalMemory = memoryReadings[memoryReadings.length - 1];
    const memoryGrowth = finalMemory - initialMemory;

    console.log(`Memory after 10 cycles: ${finalMemory.toFixed(2)}MB (growth: ${memoryGrowth.toFixed(2)}MB)`);
    console.log(`Memory readings:`, memoryReadings.map((m) => m.toFixed(2)).join(', '));

    // Memory growth should be minimal
    assert.ok(memoryGrowth < 30, `Memory grew by ${memoryGrowth.toFixed(2)}MB, expected < 30MB`);

    // Memory should stabilize (last 3 readings should be similar)
    const lastThree = memoryReadings.slice(-3);
    const variance = Math.max(...lastThree) - Math.min(...lastThree);
    assert.ok(variance < 10, `Memory variance ${variance.toFixed(2)}MB, expected < 10MB (stable)`);
  });
});
