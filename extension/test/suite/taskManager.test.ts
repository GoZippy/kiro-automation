import * as assert from 'assert';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';
import { TaskManager } from '../../src/TaskManager';
import { TaskStatus } from '../../src/models';

suite('TaskManager Test Suite', () => {
  let tempDir: string;
  let taskManager: TaskManager;

  setup(() => {
    // Create temporary directory for tests
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'kiro-test-'));
    taskManager = new TaskManager(tempDir);
  });

  teardown(() => {
    // Clean up
    taskManager.dispose();
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  suite('Task Discovery', () => {
    test('should discover task files in .kiro/specs directory', async () => {
      // Create test structure
      const specsDir = path.join(tempDir, '.kiro', 'specs', 'test-spec');
      fs.mkdirSync(specsDir, { recursive: true });
      fs.writeFileSync(path.join(specsDir, 'tasks.md'), '# Test Tasks\n');

      const taskFiles = await taskManager.discoverTaskFiles();
      assert.strictEqual(taskFiles.length, 1);
      assert.ok(taskFiles[0].endsWith('tasks.md'));
    });

    test('should return empty array when no .kiro/specs directory exists', async () => {
      const taskFiles = await taskManager.discoverTaskFiles();
      assert.strictEqual(taskFiles.length, 0);
    });

    test('should discover multiple spec directories', async () => {
      // Create multiple specs
      const spec1Dir = path.join(tempDir, '.kiro', 'specs', 'spec1');
      const spec2Dir = path.join(tempDir, '.kiro', 'specs', 'spec2');
      fs.mkdirSync(spec1Dir, { recursive: true });
      fs.mkdirSync(spec2Dir, { recursive: true });
      fs.writeFileSync(path.join(spec1Dir, 'tasks.md'), '# Spec 1\n');
      fs.writeFileSync(path.join(spec2Dir, 'tasks.md'), '# Spec 2\n');

      const taskFiles = await taskManager.discoverTaskFiles();
      assert.strictEqual(taskFiles.length, 2);
    });
  });

  suite('File Path Validation', () => {
    test('should validate correct task file path', () => {
      const validPath = path.join(tempDir, '.kiro', 'specs', 'test-spec', 'tasks.md');
      assert.strictEqual(taskManager.validateFilePath(validPath), true);
    });

    test('should reject relative paths', () => {
      const relativePath = '.kiro/specs/test-spec/tasks.md';
      assert.strictEqual(taskManager.validateFilePath(relativePath), false);
    });

    test('should reject paths outside workspace', () => {
      const outsidePath = path.join('/tmp', '.kiro', 'specs', 'test-spec', 'tasks.md');
      assert.strictEqual(taskManager.validateFilePath(outsidePath), false);
    });

    test('should reject paths not matching expected pattern', () => {
      const invalidPath = path.join(tempDir, 'random', 'tasks.md');
      assert.strictEqual(taskManager.validateFilePath(invalidPath), false);
    });
  });

  suite('Markdown Parsing', () => {
    test('should parse simple task', async () => {
      const specsDir = path.join(tempDir, '.kiro', 'specs', 'test-spec');
      fs.mkdirSync(specsDir, { recursive: true });

      const content = `# Tasks

- [ ] 1. First task
    - Task description
    - _Requirements: 1.1, 1.2_
`;
      fs.writeFileSync(path.join(specsDir, 'tasks.md'), content);

      const tasks = await taskManager.discoverTasks();
      assert.strictEqual(tasks.length, 1);
      assert.strictEqual(tasks[0].id, '1');
      assert.strictEqual(tasks[0].title, 'First task');
      assert.strictEqual(tasks[0].status, TaskStatus.PENDING);
      assert.deepStrictEqual(tasks[0].requirements, ['1.1', '1.2']);
    });

    test('should parse task with subtasks', async () => {
      const specsDir = path.join(tempDir, '.kiro', 'specs', 'test-spec');
      fs.mkdirSync(specsDir, { recursive: true });

      const content = `# Tasks

- [ ] 1. Parent task
  - [ ] 1.1 First subtask
    - Subtask description
  - [ ] 1.2 Second subtask
`;
      fs.writeFileSync(path.join(specsDir, 'tasks.md'), content);

      const tasks = await taskManager.discoverTasks();
      assert.strictEqual(tasks.length, 1);
      assert.strictEqual(tasks[0].subtasks.length, 2);
      assert.strictEqual(tasks[0].subtasks[0].id, '1.1');
      assert.strictEqual(tasks[0].subtasks[1].id, '1.2');
    });

    test('should parse optional subtasks', async () => {
      const specsDir = path.join(tempDir, '.kiro', 'specs', 'test-spec');
      fs.mkdirSync(specsDir, { recursive: true });

      const content = `# Tasks

- [ ] 1. Parent task
  - [ ]* 1.1 Optional subtask
  - [ ] 1.2 Required subtask
`;
      fs.writeFileSync(path.join(specsDir, 'tasks.md'), content);

      const tasks = await taskManager.discoverTasks();
      assert.strictEqual(tasks[0].subtasks[0].optional, true);
      assert.strictEqual(tasks[0].subtasks[1].optional, false);
    });

    test('should parse different task statuses', async () => {
      const specsDir = path.join(tempDir, '.kiro', 'specs', 'test-spec');
      fs.mkdirSync(specsDir, { recursive: true });

      const content = `# Tasks

- [ ] 1. Pending task
- [~] 2. In progress task
- [x] 3. Completed task
`;
      fs.writeFileSync(path.join(specsDir, 'tasks.md'), content);

      const tasks = await taskManager.discoverTasks();
      assert.strictEqual(tasks[0].status, TaskStatus.PENDING);
      assert.strictEqual(tasks[1].status, TaskStatus.IN_PROGRESS);
      assert.strictEqual(tasks[2].status, TaskStatus.COMPLETED);
    });
  });

  suite('Task Status Management', () => {
    test('should update task status in memory', async () => {
      const specsDir = path.join(tempDir, '.kiro', 'specs', 'test-spec');
      fs.mkdirSync(specsDir, { recursive: true });
      fs.writeFileSync(
        path.join(specsDir, 'tasks.md'),
        '- [ ] 1. Test task\n'
      );

      await taskManager.discoverTasks();
      const success = taskManager.updateTaskStatus('1', TaskStatus.IN_PROGRESS);

      assert.strictEqual(success, true);
      const task = taskManager.getTask('1');
      assert.strictEqual(task?.status, TaskStatus.IN_PROGRESS);
    });

    test('should return false for non-existent task', () => {
      const success = taskManager.updateTaskStatus('999', TaskStatus.COMPLETED);
      assert.strictEqual(success, false);
    });

    test('should update subtask status in memory', async () => {
      const specsDir = path.join(tempDir, '.kiro', 'specs', 'test-spec');
      fs.mkdirSync(specsDir, { recursive: true });
      fs.writeFileSync(
        path.join(specsDir, 'tasks.md'),
        '- [ ] 1. Test task\n  - [ ] 1.1 Subtask\n'
      );

      await taskManager.discoverTasks();
      const success = taskManager.updateSubtaskStatus('1', '1.1', TaskStatus.COMPLETED);

      assert.strictEqual(success, true);
      const task = taskManager.getTask('1');
      assert.strictEqual(task?.subtasks[0].status, TaskStatus.COMPLETED);
    });
  });

  suite('Task Queue and Dependencies', () => {
    test('should order tasks by ID', async () => {
      const specsDir = path.join(tempDir, '.kiro', 'specs', 'test-spec');
      fs.mkdirSync(specsDir, { recursive: true });
      fs.writeFileSync(
        path.join(specsDir, 'tasks.md'),
        '- [ ] 3. Third\n- [ ] 1. First\n- [ ] 2. Second\n'
      );

      await taskManager.discoverTasks();
      const ordered = taskManager.getTasksInOrder();

      assert.strictEqual(ordered[0].id, '1');
      assert.strictEqual(ordered[1].id, '2');
      assert.strictEqual(ordered[2].id, '3');
    });

    test('should get next incomplete task', async () => {
      const specsDir = path.join(tempDir, '.kiro', 'specs', 'test-spec');
      fs.mkdirSync(specsDir, { recursive: true });
      fs.writeFileSync(
        path.join(specsDir, 'tasks.md'),
        '- [x] 1. Completed\n- [ ] 2. Pending\n- [ ] 3. Also pending\n'
      );

      await taskManager.discoverTasks();
      const nextTask = taskManager.getNextIncompleteTask();

      assert.strictEqual(nextTask?.id, '2');
    });

    test('should return null when all tasks complete', async () => {
      const specsDir = path.join(tempDir, '.kiro', 'specs', 'test-spec');
      fs.mkdirSync(specsDir, { recursive: true });
      fs.writeFileSync(
        path.join(specsDir, 'tasks.md'),
        '- [x] 1. Completed\n- [x] 2. Also completed\n'
      );

      await taskManager.discoverTasks();
      const nextTask = taskManager.getNextIncompleteTask();

      assert.strictEqual(nextTask, null);
    });

    test('should detect circular dependencies', async () => {
      const specsDir = path.join(tempDir, '.kiro', 'specs', 'test-spec');
      fs.mkdirSync(specsDir, { recursive: true });
      fs.writeFileSync(
        path.join(specsDir, 'tasks.md'),
        '- [ ] 1. Task one\n- [ ] 2. Task two\n'
      );

      await taskManager.discoverTasks();

      // Manually add circular dependencies for testing
      const task1 = taskManager.getTask('1');
      const task2 = taskManager.getTask('2');
      if (task1 && task2) {
        task1.dependencies = ['2'];
        task2.dependencies = ['1'];
      }

      const circular = taskManager.detectCircularDependencies();
      assert.ok(circular.length > 0);
    });

    test('should validate dependencies correctly', async () => {
      const specsDir = path.join(tempDir, '.kiro', 'specs', 'test-spec');
      fs.mkdirSync(specsDir, { recursive: true });
      fs.writeFileSync(
        path.join(specsDir, 'tasks.md'),
        '- [ ] 1. Task one\n- [ ] 2. Task two\n'
      );

      await taskManager.discoverTasks();

      const validation = taskManager.validateDependencies();
      assert.strictEqual(validation.valid, true);
      assert.strictEqual(validation.errors.length, 0);
    });
  });
});
