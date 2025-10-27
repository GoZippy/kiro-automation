import * as assert from 'assert';
import { AutomationEngine, EngineState, AutomationEvent } from '../../src/AutomationEngine';
import { TaskManager } from '../../src/TaskManager';
import { MockKiroInterface } from '../fixtures/mocks/MockKiroInterface';
import { createTestWorkspace, cleanupTestWorkspace, createTestSpec, delay } from '../helpers/testUtils';
import { TaskStatus } from '../../src/models';

suite('E2E: Pause and Resume Functionality', () => {
  let workspaceDir: string;
  let taskManager: TaskManager;
  let kiroInterface: MockKiroInterface;
  let automationEngine: AutomationEngine;

  setup(() => {
    workspaceDir = createTestWorkspace('e2e-pause-resume');
    taskManager = new TaskManager(workspaceDir);
    kiroInterface = new MockKiroInterface({ autoConnect: true, responseDelay: 200 });
    automationEngine = new AutomationEngine({
      maxRetries: 1,
      taskTimeout: 5000,
      taskDelay: 100,
    });
  });

  teardown(() => {
    automationEngine.dispose();
    taskManager.dispose();
    kiroInterface.dispose();
    cleanupTestWorkspace(workspaceDir);
  });

  test('should pause automation mid-execution', async function () {
    this.timeout(10000);

    createTestSpec(
      workspaceDir,
      'pause-spec',
      '- [ ] 1. Task 1\n- [ ] 2. Task 2\n- [ ] 3. Task 3\n- [ ] 4. Task 4\n- [ ] 5. Task 5\n'
    );

    await taskManager.discoverTasks();

    let taskStartedCount = 0;
    automationEngine.on(AutomationEvent.TASK_STARTED, () => taskStartedCount++);

    automationEngine.initialize(taskManager, kiroInterface as any);
    const startPromise = automationEngine.start();

    // Wait for first task to start
    await delay(300);

    // Pause automation
    await automationEngine.pause();

    assert.strictEqual(automationEngine.getState(), EngineState.PAUSED);
    const pausedCount = taskStartedCount;

    // Wait a bit to ensure no more tasks start
    await delay(500);

    assert.strictEqual(taskStartedCount, pausedCount, 'No new tasks should start while paused');

    // Resume automation
    await automationEngine.resume();

    // Wait for completion
    await startPromise;

    // Verify all tasks completed
    const finalTasks = await taskManager.discoverTasks();
    assert.ok(finalTasks.every((t) => t.status === TaskStatus.COMPLETED));
  });

  test('should maintain state across pause/resume cycles', async function () {
    this.timeout(10000);

    createTestSpec(workspaceDir, 'state-spec', '- [ ] 1. Task 1\n- [ ] 2. Task 2\n- [ ] 3. Task 3\n');

    await taskManager.discoverTasks();

    automationEngine.initialize(taskManager, kiroInterface as any);
    const startPromise = automationEngine.start();

    // Pause after first task
    await delay(400);
    await automationEngine.pause();

    const session1 = automationEngine.getCurrentSession();
    assert.ok(session1);
    const completed1 = session1!.completedTasks.length;

    // Resume
    await automationEngine.resume();

    // Pause again
    await delay(400);
    await automationEngine.pause();

    const session2 = automationEngine.getCurrentSession();
    assert.ok(session2);
    const completed2 = session2!.completedTasks.length;

    assert.ok(completed2 > completed1, 'More tasks should be completed after resume');

    // Final resume
    await automationEngine.resume();
    await startPromise;

    // Verify all completed
    const finalTasks = await taskManager.discoverTasks();
    assert.ok(finalTasks.every((t) => t.status === TaskStatus.COMPLETED));
  });

  test('should handle stop command during execution', async function () {
    this.timeout(10000);

    createTestSpec(workspaceDir, 'stop-spec', '- [ ] 1. Task 1\n- [ ] 2. Task 2\n- [ ] 3. Task 3\n- [ ] 4. Task 4\n');

    await taskManager.discoverTasks();

    automationEngine.initialize(taskManager, kiroInterface as any);
    const startPromise = automationEngine.start();

    // Wait for some tasks to start
    await delay(400);

    // Stop automation
    await automationEngine.stop();

    assert.strictEqual(automationEngine.getState(), EngineState.STOPPED);

    // Verify not all tasks completed
    const finalTasks = await taskManager.discoverTasks();
    const completedCount = finalTasks.filter((t) => t.status === TaskStatus.COMPLETED).length;
    assert.ok(completedCount < 4, 'Not all tasks should be completed after stop');
    assert.ok(completedCount > 0, 'Some tasks should have completed before stop');
  });
});
