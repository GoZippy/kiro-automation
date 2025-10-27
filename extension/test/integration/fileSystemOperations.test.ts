import * as assert from 'assert';
import * as fs from 'fs';
import * as path from 'path';
import { TaskManager } from '../../src/TaskManager';
import { createTestWorkspace, cleanupTestWorkspace, createTestSpec, readFile } from '../helpers/testUtils';
import { TaskStatus } from '../../src/models';

suite('Integration: File System Operations', () => {
  let workspaceDir: string;
  let taskManager: TaskManager;

  setup(() => {
    workspaceDir = createTestWorkspace('fs-integration');
    taskManager = new TaskManager(workspaceDir);
  });

  teardown(() => {
    taskManager.dispose();
    cleanupTestWorkspace(workspaceDir);
  });

  test('should read and write task status to files', async () => {
    const tasksContent = '- [ ] 1. Test task\n  - Task description\n';
    const specDir = createTestSpec(workspaceDir, 'test-spec', tasksContent);

    await taskManager.discoverTasks();
    const task = taskManager.getTask('1');
    assert.ok(task);
    assert.strictEqual(task.status, TaskStatus.PENDING);

    // Update status
    taskManager.updateTaskStatus('1', TaskStatus.IN_PROGRESS);
    await taskManager.persistTaskStatus('1');

    // Read file directly
    const fileContent = readFile(path.join(specDir, 'tasks.md'));
    assert.ok(fileContent.includes('[~]'), 'File should contain in-progress marker');
  });

  test('should handle concurrent file operations', async () => {
    createTestSpec(workspaceDir, 'concurrent-spec', '- [ ] 1. Task 1\n- [ ] 2. Task 2\n- [ ] 3. Task 3\n');

    await taskManager.discoverTasks();

    // Update multiple tasks concurrently
    const updates = [
      taskManager.updateTaskStatus('1', TaskStatus.IN_PROGRESS),
      taskManager.updateTaskStatus('2', TaskStatus.IN_PROGRESS),
      taskManager.updateTaskStatus('3', TaskStatus.IN_PROGRESS),
    ];

    await Promise.all([
      taskManager.persistTaskStatus('1'),
      taskManager.persistTaskStatus('2'),
      taskManager.persistTaskStatus('3'),
    ]);

    // Verify all updates persisted
    const tasks = await taskManager.discoverTasks();
    assert.strictEqual(tasks[0].status, TaskStatus.IN_PROGRESS);
    assert.strictEqual(tasks[1].status, TaskStatus.IN_PROGRESS);
    assert.strictEqual(tasks[2].status, TaskStatus.IN_PROGRESS);
  });

  test('should watch for file changes', async function () {
    this.timeout(5000);

    const specDir = createTestSpec(workspaceDir, 'watch-spec', '- [ ] 1. Test task\n');

    await taskManager.discoverTasks();
    await taskManager.startWatching();

    let changeDetected = false;
    taskManager.on('tasksChanged', () => {
      changeDetected = true;
    });

    // Modify file externally
    const tasksFile = path.join(specDir, 'tasks.md');
    fs.writeFileSync(tasksFile, '- [x] 1. Test task\n');

    // Wait for change detection
    await new Promise((resolve) => setTimeout(resolve, 1000));

    assert.strictEqual(changeDetected, true, 'File change should be detected');

    await taskManager.stopWatching();
  });

  test('should handle missing spec directories', async () => {
    const tasks = await taskManager.discoverTasks();
    assert.strictEqual(tasks.length, 0);
  });

  test('should validate file paths', () => {
    const validPath = path.join(workspaceDir, '.kiro', 'specs', 'test', 'tasks.md');
    const invalidPath = '/tmp/tasks.md';

    assert.strictEqual(taskManager.validateFilePath(validPath), true);
    assert.strictEqual(taskManager.validateFilePath(invalidPath), false);
  });

  test('should handle malformed markdown gracefully', async () => {
    const malformedContent = `# Tasks
- [ ] 1. Task without proper format
  - Missing requirements
- [?] 2. Invalid status marker
- [ ] 3. Valid task
  - _Requirements: 3.1_
`;

    createTestSpec(workspaceDir, 'malformed-spec', malformedContent);

    const tasks = await taskManager.discoverTasks();

    // Should parse valid tasks and skip malformed ones
    assert.ok(tasks.length > 0);
    const validTask = tasks.find((t) => t.id === '3');
    assert.ok(validTask);
    assert.deepStrictEqual(validTask.requirements, ['3.1']);
  });

  test('should preserve file formatting when updating status', async () => {
    const originalContent = `# My Tasks

Some description here.

- [ ] 1. First task
  - Important details
  - _Requirements: 1.1_

- [ ] 2. Second task
  - More details
  - _Requirements: 2.1_

## Notes
Some notes at the end.
`;

    const specDir = createTestSpec(workspaceDir, 'format-spec', originalContent);

    await taskManager.discoverTasks();
    taskManager.updateTaskStatus('1', TaskStatus.COMPLETED);
    await taskManager.persistTaskStatus('1');

    const updatedContent = readFile(path.join(specDir, 'tasks.md'));

    // Should preserve structure
    assert.ok(updatedContent.includes('# My Tasks'));
    assert.ok(updatedContent.includes('Some description here'));
    assert.ok(updatedContent.includes('## Notes'));
    assert.ok(updatedContent.includes('[x] 1. First task'));
    assert.ok(updatedContent.includes('[ ] 2. Second task'));
  });

  test('should handle nested spec directories', async () => {
    // Create nested structure
    const nestedDir = path.join(workspaceDir, '.kiro', 'specs', 'parent', 'child');
    fs.mkdirSync(nestedDir, { recursive: true });
    fs.writeFileSync(path.join(nestedDir, 'tasks.md'), '- [ ] 1. Nested task\n');

    const tasks = await taskManager.discoverTasks();

    // Should discover nested specs
    assert.ok(tasks.length > 0);
    const nestedTask = tasks.find((t) => t.specName.includes('child'));
    assert.ok(nestedTask);
  });
});
