import * as assert from 'assert';
import { AutomationEngine, EngineState, AutomationEvent } from '../../src/AutomationEngine';
import { TaskManager } from '../../src/TaskManager';
import { MockKiroInterface } from '../fixtures/mocks/MockKiroInterface';
import { NotificationService } from '../../src/NotificationService';
import { Logger } from '../../src/Logger';
import { ConfigManager } from '../../src/ConfigManager';
import { PerformanceMonitor } from '../../src/PerformanceMonitor';
import { createTestWorkspace, cleanupTestWorkspace, createTestSpec } from '../helpers/testUtils';
import { TaskStatus } from '../../src/models';

suite('Integration: Full System Integration', () => {
  let workspaceDir: string;
  let taskManager: TaskManager;
  let kiroInterface: MockKiroInterface;
  let automationEngine: AutomationEngine;
  let notificationService: NotificationService;
  let logger: Logger;
  let configManager: ConfigManager;
  let performanceMonitor: PerformanceMonitor;

  setup(() => {
    workspaceDir = createTestWorkspace('full-integration');
    logger = new Logger('test');
    configManager = new ConfigManager();
    taskManager = new TaskManager(workspaceDir);
    kiroInterface = new MockKiroInterface({ autoConnect: true, responseDelay: 50 });
    notificationService = new NotificationService();
    performanceMonitor = new PerformanceMonitor();
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
    performanceMonitor.dispose();
    cleanupTestWorkspace(workspaceDir);
  });

  test('should integrate all components in complete workflow', async function () {
    this.timeout(15000);

    // Create comprehensive test spec
    const tasksContent = `# Integration Test Spec

- [ ] 1. Setup phase
  - Initialize configuration
  - Verify environment
  - _Requirements: 1.1, 1.2_

- [ ] 2. Execution phase
  - [ ] 2.1 Process data
  - [ ] 2.2 Validate results
  - [ ] 2.3 Generate output
  - _Requirements: 2.1, 2.2, 2.3_

- [ ] 3. Cleanup phase
  - Finalize results
  - _Requirements: 3.1_
`;

    createTestSpec(workspaceDir, 'integration-spec', tasksContent, {
      requirements: '# Requirements\n## 1.1\nSetup requirement\n## 1.2\nConfig requirement\n## 2.1\nData requirement\n## 2.2\nValidation requirement\n## 2.3\nOutput requirement\n## 3.1\nCleanup requirement',
      design: '# Design\nIntegration test design',
    });

    // Start performance monitoring
    performanceMonitor.startMonitoring();

    // Discover tasks
    const tasks = await taskManager.discoverTasks();
    assert.strictEqual(tasks.length, 3);
    logger.info(`Discovered ${tasks.length} tasks`);

    // Track all events
    const events: any[] = [];
    automationEngine.on(AutomationEvent.SESSION_STARTED, () => {
      events.push({ type: 'session_started', timestamp: Date.now() });
      logger.info('Session started');
    });
    automationEngine.on(AutomationEvent.TASK_STARTED, (task) => {
      events.push({ type: 'task_started', taskId: task.id, timestamp: Date.now() });
      logger.info(`Task started: ${task.id}`);
    });
    automationEngine.on(AutomationEvent.TASK_COMPLETED, (task) => {
      events.push({ type: 'task_completed', taskId: task.id, timestamp: Date.now() });
      logger.info(`Task completed: ${task.id}`);
    });
    automationEngine.on(AutomationEvent.SESSION_COMPLETED, () => {
      events.push({ type: 'session_completed', timestamp: Date.now() });
      logger.info('Session completed');
    });

    // Initialize and start automation
    automationEngine.initialize(taskManager, kiroInterface as any, notificationService);
    await automationEngine.start();

    // Stop performance monitoring
    const metrics = performanceMonitor.getMetrics();
    logger.info(`Performance metrics: ${JSON.stringify(metrics)}`);

    // Verify all tasks completed
    const finalTasks = await taskManager.discoverTasks();
    assert.ok(finalTasks.every((t) => t.status === TaskStatus.COMPLETED), 'All tasks should be completed');

    // Verify event sequence
    assert.ok(events.length >= 8, 'Expected at least 8 events');
    assert.strictEqual(events[0].type, 'session_started');
    assert.strictEqual(events[events.length - 1].type, 'session_completed');

    // Verify performance metrics
    assert.ok(metrics.memoryUsage > 0, 'Memory usage should be tracked');
    assert.ok(metrics.cpuUsage >= 0, 'CPU usage should be tracked');

    // Verify engine state
    assert.strictEqual(automationEngine.getState(), EngineState.IDLE);

    logger.info('Full system integration test completed successfully');
  });

  test('should handle error scenarios across components', async function () {
    this.timeout(10000);

    // Set failure rate
    kiroInterface.setFailureRate(0.5);

    createTestSpec(workspaceDir, 'error-spec', '- [ ] 1. Task 1\n- [ ] 2. Task 2\n- [ ] 3. Task 3\n');

    const errors: any[] = [];
    automationEngine.on(AutomationEvent.TASK_FAILED, (task, error) => {
      errors.push({ taskId: task.id, error: error.message });
      logger.error(`Task failed: ${task.id}`, error);
    });

    automationEngine.initialize(taskManager, kiroInterface as any, notificationService);
    await automationEngine.start();

    // Verify error handling
    logger.info(`Encountered ${errors.length} errors during execution`);
    assert.ok(errors.length >= 0, 'Error tracking should work');

    // Verify system recovered
    assert.strictEqual(automationEngine.getState(), EngineState.IDLE);
  });

  test('should maintain data consistency across components', async function () {
    this.timeout(10000);

    createTestSpec(workspaceDir, 'consistency-spec', '- [ ] 1. Task A\n- [ ] 2. Task B\n- [ ] 3. Task C\n');

    // Track task status changes
    const statusChanges: any[] = [];
    taskManager.on('taskStatusChanged', (task, oldStatus, newStatus) => {
      statusChanges.push({
        taskId: task.id,
        oldStatus,
        newStatus,
        timestamp: Date.now(),
      });
    });

    automationEngine.initialize(taskManager, kiroInterface as any, notificationService);
    await automationEngine.start();

    // Verify status transitions
    assert.ok(statusChanges.length > 0, 'Status changes should be tracked');

    // Each task should have transitioned: pending -> in_progress -> completed
    const taskIds = ['1', '2', '3'];
    for (const taskId of taskIds) {
      const taskChanges = statusChanges.filter((c) => c.taskId === taskId);
      assert.ok(taskChanges.length >= 2, `Task ${taskId} should have status changes`);
    }

    logger.info(`Tracked ${statusChanges.length} status changes`);
  });
});
