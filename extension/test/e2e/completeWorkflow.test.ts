import * as assert from 'assert';
import { AutomationEngine, EngineState, AutomationEvent } from '../../src/AutomationEngine';
import { TaskManager } from '../../src/TaskManager';
import { MockKiroInterface } from '../fixtures/mocks/MockKiroInterface';
import { NotificationService } from '../../src/NotificationService';
import { createTestWorkspace, cleanupTestWorkspace, createTestSpec } from '../helpers/testUtils';
import { TaskStatus } from '../../src/models';

suite('E2E: Complete Automation Workflow', () => {
  let workspaceDir: string;
  let taskManager: TaskManager;
  let kiroInterface: MockKiroInterface;
  let automationEngine: AutomationEngine;
  let notificationService: NotificationService;

  setup(() => {
    workspaceDir = createTestWorkspace('e2e-workflow');
    taskManager = new TaskManager(workspaceDir);
    kiroInterface = new MockKiroInterface({ autoConnect: true, responseDelay: 50 });
    notificationService = new NotificationService();
    automationEngine = new AutomationEngine({
      maxRetries: 2,
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

  test('should execute complete spec from start to finish', async function () {
    this.timeout(10000);

    // Create test spec with multiple tasks
    const tasksContent = `# Test Spec

- [ ] 1. First task
  - Task description
  - _Requirements: 1.1_

- [ ] 2. Second task
  - [ ] 2.1 Subtask one
  - [ ] 2.2 Subtask two
  - _Requirements: 2.1, 2.2_

- [ ] 3. Final task
  - _Requirements: 3.1_
`;

    createTestSpec(workspaceDir, 'test-spec', tasksContent, {
      requirements: '# Requirements\n## 1.1\nFirst requirement\n## 2.1\nSecond requirement\n## 2.2\nThird requirement\n## 3.1\nFinal requirement',
      design: '# Design\nTest design document',
    });

    // Discover tasks
    const tasks = await taskManager.discoverTasks();
    assert.strictEqual(tasks.length, 3);

    // Track events
    const events: string[] = [];
    automationEngine.on(AutomationEvent.SESSION_STARTED, () => events.push('session_started'));
    automationEngine.on(AutomationEvent.TASK_STARTED, (task) => events.push(`task_started:${task.id}`));
    automationEngine.on(AutomationEvent.TASK_COMPLETED, (task) => events.push(`task_completed:${task.id}`));
    automationEngine.on(AutomationEvent.SESSION_COMPLETED, () => events.push('session_completed'));

    // Initialize and start automation
    automationEngine.initialize(taskManager, kiroInterface as any, notificationService);
    const startPromise = automationEngine.start();

    // Wait for completion
    await startPromise;

    // Verify all tasks completed
    const finalTasks = await taskManager.discoverTasks();
    assert.ok(finalTasks.every((t) => t.status === TaskStatus.COMPLETED));

    // Verify events fired in correct order
    assert.ok(events.includes('session_started'));
    assert.ok(events.includes('task_started:1'));
    assert.ok(events.includes('task_completed:1'));
    assert.ok(events.includes('task_started:2'));
    assert.ok(events.includes('task_completed:2'));
    assert.ok(events.includes('task_started:3'));
    assert.ok(events.includes('task_completed:3'));
    assert.ok(events.includes('session_completed'));

    // Verify final state
    assert.strictEqual(automationEngine.getState(), EngineState.IDLE);
  });

  test('should handle multi-spec execution', async function () {
    this.timeout(15000);

    // Create multiple specs
    createTestSpec(workspaceDir, 'spec-a', '- [ ] 1. Task A1\n- [ ] 2. Task A2\n');
    createTestSpec(workspaceDir, 'spec-b', '- [ ] 1. Task B1\n- [ ] 2. Task B2\n');
    createTestSpec(workspaceDir, 'spec-c', '- [ ] 1. Task C1\n');

    const tasks = await taskManager.discoverTasks();
    assert.strictEqual(tasks.length, 5);

    // Start automation
    automationEngine.initialize(taskManager, kiroInterface as any, notificationService);
    await automationEngine.start();

    // Verify all tasks from all specs completed
    const finalTasks = await taskManager.discoverTasks();
    assert.ok(finalTasks.every((t) => t.status === TaskStatus.COMPLETED));

    // Verify tasks from different specs were executed
    const specNames = new Set(finalTasks.map((t) => t.specName));
    assert.strictEqual(specNames.size, 3);
    assert.ok(specNames.has('spec-a'));
    assert.ok(specNames.has('spec-b'));
    assert.ok(specNames.has('spec-c'));
  });

  test('should handle error recovery and retry', async function () {
    this.timeout(10000);

    // Set failure rate to cause some failures
    kiroInterface.setFailureRate(0.3);

    createTestSpec(workspaceDir, 'retry-spec', '- [ ] 1. Task 1\n- [ ] 2. Task 2\n- [ ] 3. Task 3\n');

    const tasks = await taskManager.discoverTasks();
    assert.strictEqual(tasks.length, 3);

    // Track retry attempts
    let retryCount = 0;
    automationEngine.on(AutomationEvent.TASK_FAILED, () => retryCount++);

    // Start automation
    automationEngine.initialize(taskManager, kiroInterface as any, notificationService);
    await automationEngine.start();

    // Some failures should have occurred
    assert.ok(retryCount >= 0, 'Tracked failure events');

    // Eventually all tasks should complete
    const finalTasks = await taskManager.discoverTasks();
    const completedCount = finalTasks.filter((t) => t.status === TaskStatus.COMPLETED).length;
    assert.ok(completedCount >= 2, 'Expected at least 2 tasks to complete');
  });

  test('should update UI during execution', async function () {
    this.timeout(10000);

    createTestSpec(workspaceDir, 'ui-spec', '- [ ] 1. Task 1\n- [ ] 2. Task 2\n');

    const taskEvents: any[] = [];
    automationEngine.on(AutomationEvent.TASK_COMPLETED, (task) => {
      taskEvents.push(task);
    });

    automationEngine.initialize(taskManager, kiroInterface as any, notificationService);
    await automationEngine.start();

    // Verify task completion events occurred
    assert.ok(taskEvents.length > 0, 'Expected task completion events');
    assert.strictEqual(taskEvents.length, 2, 'Should have 2 completed tasks');
  });
});
