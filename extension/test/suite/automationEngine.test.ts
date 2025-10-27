import * as assert from 'assert';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';
import { AutomationEngine, EngineState, AutomationEvent, ErrorType } from '../../src/AutomationEngine';
import { TaskManager } from '../../src/TaskManager';
import { KiroInterface } from '../../src/KiroInterface';
import { Task, TaskStatus } from '../../src/models';

suite('AutomationEngine Test Suite', () => {
  let tempDir: string;
  let taskManager: TaskManager;
  let kiroInterface: KiroInterface;
  let automationEngine: AutomationEngine;

  setup(() => {
    // Create temporary directory for tests
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'kiro-test-'));
    taskManager = new TaskManager(tempDir);
    kiroInterface = new KiroInterface();
    automationEngine = new AutomationEngine();
  });

  teardown(() => {
    // Clean up
    automationEngine.dispose();
    taskManager.dispose();
    kiroInterface.dispose();
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  suite('Initialization', () => {
    test('should initialize with default state', () => {
      assert.strictEqual(automationEngine.getState(), EngineState.IDLE);
      assert.strictEqual(automationEngine.getCurrentSession(), undefined);
      assert.strictEqual(automationEngine.getCurrentTask(), undefined);
    });

    test('should initialize with custom configuration', () => {
      const customEngine = new AutomationEngine({
        maxRetries: 5,
        taskTimeout: 60000,
        verboseLogging: true,
      });

      const config = customEngine.getConfig();
      assert.strictEqual(config.maxRetries, 5);
      assert.strictEqual(config.taskTimeout, 60000);
      assert.strictEqual(config.verboseLogging, true);

      customEngine.dispose();
    });

    test('should update configuration', () => {
      automationEngine.updateConfig({ maxRetries: 10 });
      const config = automationEngine.getConfig();
      assert.strictEqual(config.maxRetries, 10);
    });
  });

  suite('State Management', () => {
    test('should emit state change events', (done) => {
      automationEngine.once(AutomationEvent.STATE_CHANGED, (newState, oldState) => {
        assert.strictEqual(oldState, EngineState.IDLE);
        assert.strictEqual(newState, EngineState.RUNNING);
        done();
      });

      // Manually trigger state change for testing
      automationEngine['setState'](EngineState.RUNNING);
    });

    test('should track state transitions', () => {
      assert.strictEqual(automationEngine.isIdle(), true);
      assert.strictEqual(automationEngine.isRunning(), false);
      assert.strictEqual(automationEngine.isPaused(), false);

      automationEngine['setState'](EngineState.RUNNING);
      assert.strictEqual(automationEngine.isRunning(), true);
      assert.strictEqual(automationEngine.isIdle(), false);

      automationEngine['setState'](EngineState.PAUSED);
      assert.strictEqual(automationEngine.isPaused(), true);
      assert.strictEqual(automationEngine.isRunning(), false);
    });
  });

  suite('Error Handling', () => {
    test('should classify network errors', () => {
      const error = new Error('Network connection failed');
      const errorType = automationEngine['classifyError'](error);
      assert.strictEqual(errorType, ErrorType.NETWORK_ERROR);
    });

    test('should classify timeout errors', () => {
      const error = new Error('Operation timed out');
      const errorType = automationEngine['classifyError'](error);
      assert.strictEqual(errorType, ErrorType.TIMEOUT_ERROR);
    });

    test('should classify Kiro API errors', () => {
      const error = new Error('Kiro API call failed');
      const errorType = automationEngine['classifyError'](error);
      assert.strictEqual(errorType, ErrorType.KIRO_API_ERROR);
    });

    test('should determine retryable errors', () => {
      assert.strictEqual(automationEngine['isRetryableError'](ErrorType.NETWORK_ERROR), true);
      assert.strictEqual(automationEngine['isRetryableError'](ErrorType.TIMEOUT_ERROR), true);
      assert.strictEqual(automationEngine['isRetryableError'](ErrorType.DEPENDENCY_ERROR), false);
      assert.strictEqual(automationEngine['isRetryableError'](ErrorType.CONFIGURATION_ERROR), false);
    });

    test('should track error history', async () => {
      const task: Task = {
        id: '1',
        title: 'Test Task',
        status: TaskStatus.PENDING,
        subtasks: [],
        requirements: [],
        specName: 'test',
        filePath: '/test/tasks.md',
        lineNumber: 1,
      };

      const error = new Error('Test error');
      await automationEngine['handleTaskFailure'](task, error);

      const errorHistory = automationEngine.getErrorHistory();
      assert.strictEqual(errorHistory.length, 1);
      assert.strictEqual(errorHistory[0].task.id, '1');
    });

    test('should clear error history', async () => {
      const task: Task = {
        id: '1',
        title: 'Test Task',
        status: TaskStatus.PENDING,
        subtasks: [],
        requirements: [],
        specName: 'test',
        filePath: '/test/tasks.md',
        lineNumber: 1,
      };

      const error = new Error('Test error');
      await automationEngine['handleTaskFailure'](task, error);

      automationEngine.clearErrorHistory();
      const errorHistory = automationEngine.getErrorHistory();
      assert.strictEqual(errorHistory.length, 0);
    });
  });

  suite('Retry Logic', () => {
    test('should calculate exponential backoff delay', () => {
      const delay0 = automationEngine['calculateRetryDelay'](0);
      const delay1 = automationEngine['calculateRetryDelay'](1);
      const delay2 = automationEngine['calculateRetryDelay'](2);

      assert.ok(delay1 > delay0);
      assert.ok(delay2 > delay1);
    });

    test('should respect maximum delay', () => {
      automationEngine.updateRetryStrategy({ maxDelay: 5000 });
      const delay = automationEngine['calculateRetryDelay'](10);
      assert.ok(delay <= 5000);
    });

    test('should track retry count per task', () => {
      automationEngine['taskRetryCount'].set('task1', 2);
      assert.strictEqual(automationEngine.getTaskRetryCount('task1'), 2);
      assert.strictEqual(automationEngine.getTaskRetryCount('task2'), 0);
    });

    test('should reset retry count', () => {
      automationEngine['taskRetryCount'].set('task1', 3);
      automationEngine.resetTaskRetryCount('task1');
      assert.strictEqual(automationEngine.getTaskRetryCount('task1'), 0);
    });

    test('should update retry strategy', () => {
      automationEngine.updateRetryStrategy({
        maxAttempts: 5,
        baseDelay: 2000,
      });

      const strategy = automationEngine.getRetryStrategy();
      assert.strictEqual(strategy.maxAttempts, 5);
      assert.strictEqual(strategy.baseDelay, 2000);
    });
  });

  suite('Task Execution', () => {
    test('should skip completed tasks', () => {
      const task: Task = {
        id: '1',
        title: 'Test Task',
        status: TaskStatus.COMPLETED,
        subtasks: [],
        requirements: [],
        specName: 'test',
        filePath: '/test/tasks.md',
        lineNumber: 1,
      };

      const shouldSkip = automationEngine['shouldSkipTask'](task);
      assert.strictEqual(shouldSkip, true);
    });

    test('should not skip pending tasks', () => {
      const task: Task = {
        id: '1',
        title: 'Test Task',
        status: TaskStatus.PENDING,
        subtasks: [],
        requirements: [],
        specName: 'test',
        filePath: '/test/tasks.md',
        lineNumber: 1,
      };

      const shouldSkip = automationEngine['shouldSkipTask'](task);
      assert.strictEqual(shouldSkip, false);
    });

    test('should skip optional tasks when configured', () => {
      automationEngine.updateConfig({ skipOptionalTasks: true });

      const task: Task = {
        id: '1',
        title: 'Test Task',
        status: TaskStatus.PENDING,
        subtasks: [
          {
            id: '1.1',
            title: 'Optional Subtask',
            status: TaskStatus.PENDING,
            optional: true,
            description: [],
          },
        ],
        requirements: [],
        specName: 'test',
        filePath: '/test/tasks.md',
        lineNumber: 1,
      };

      const shouldSkip = automationEngine['shouldSkipTask'](task);
      assert.strictEqual(shouldSkip, true);
    });
  });

  suite('Session Management', () => {
    test('should track execution queue', () => {
      const queue = automationEngine.getExecutionQueue();
      assert.ok(Array.isArray(queue));
      assert.strictEqual(queue.length, 0);
    });

    test('should emit session events', (done) => {
      automationEngine.once(AutomationEvent.SESSION_STARTED, (session) => {
        assert.ok(session);
        assert.ok(session.id);
        done();
      });

      // Manually trigger session start for testing
      const session = {
        id: 'test-session',
        startTime: new Date(),
        completedTasks: [],
        failedTasks: [],
        skippedTasks: [],
        configuration: {},
        status: 'running' as const,
        totalTasks: 0,
      };

      automationEngine['currentSession'] = session;
      automationEngine.emit(AutomationEvent.SESSION_STARTED, session);
    });
  });

  suite('Pause and Resume', () => {
    test('should throw error when pausing non-running engine', async () => {
      try {
        await automationEngine.pause();
        assert.fail('Should have thrown error');
      } catch (error) {
        assert.ok(error instanceof Error);
        assert.ok(error.message.includes('not running'));
      }
    });

    test('should throw error when resuming non-paused engine', async () => {
      try {
        await automationEngine.resume();
        assert.fail('Should have thrown error');
      } catch (error) {
        assert.ok(error instanceof Error);
        assert.ok(error.message.includes('not paused'));
      }
    });

    test('should transition to paused state', async () => {
      automationEngine['setState'](EngineState.RUNNING);
      await automationEngine.pause();
      assert.strictEqual(automationEngine.getState(), EngineState.PAUSED);
    });
  });

  suite('Configuration', () => {
    test('should get default configuration', () => {
      const config = automationEngine.getConfig();
      assert.ok(config.maxRetries > 0);
      assert.ok(config.taskTimeout > 0);
      assert.ok(config.taskDelay >= 0);
    });

    test('should update partial configuration', () => {
      const originalTimeout = automationEngine.getConfig().taskTimeout;
      automationEngine.updateConfig({ taskTimeout: 60000 });
      
      const config = automationEngine.getConfig();
      assert.strictEqual(config.taskTimeout, 60000);
      assert.notStrictEqual(config.taskTimeout, originalTimeout);
    });
  });

  suite('Cleanup', () => {
    test('should dispose resources', () => {
      const engine = new AutomationEngine();
      engine.dispose();
      
      // Verify state after disposal
      assert.strictEqual(engine.getState(), EngineState.STOPPED);
    });

    test('should clear all data on dispose', () => {
      automationEngine['taskRetryCount'].set('task1', 3);
      automationEngine['errorHistory'].push({
        task: {
          id: '1',
          title: 'Test',
          status: TaskStatus.FAILED,
          subtasks: [],
          requirements: [],
          specName: 'test',
          filePath: '/test',
          lineNumber: 1,
        },
        error: {
          type: ErrorType.UNKNOWN_ERROR,
          message: 'Test error',
          name: 'AutomationError',
          retryable: true,
        },
        timestamp: new Date(),
      });

      automationEngine.dispose();

      assert.strictEqual(automationEngine.getTaskRetryCount('task1'), 0);
      assert.strictEqual(automationEngine.getErrorHistory().length, 0);
    });
  });
});
