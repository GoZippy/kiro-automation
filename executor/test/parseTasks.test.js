const assert = require('assert');
const fs = require('fs');
const path = require('path');
const AutonomousExecutor = require('../autonomous-executor');

describe('AutonomousExecutor parseTasks', function() {
  it('parses simple tasks file', async function() {
    const tmpDir = path.join(__dirname, 'tmp-spec');
    fs.mkdirSync(tmpDir, { recursive: true });
    const tasksFile = path.join(tmpDir, 'tasks.md');
    fs.writeFileSync(tasksFile, '- [ ] 1. Do thing\n- [ ] 2. Do other thing\n- [x] 3. Done task\n');

    const exe = new AutonomousExecutor({ workspaceRoot: tmpDir });
    const tasks = await exe.parseTasks(tasksFile);
    assert.strictEqual(tasks.length, 3);
    assert.strictEqual(tasks[0].id, '1');
    assert.strictEqual(tasks[2].status, 'completed');

    // cleanup
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });
});
