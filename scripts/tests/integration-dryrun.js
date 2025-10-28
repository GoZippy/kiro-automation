const { spawnSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const os = require('os');
const repoRoot = path.resolve(__dirname, '..', '..');
const executor = path.join(repoRoot, 'executor', 'autonomous-executor.js');
const realWorkspace = path.join(repoRoot, '..', 'ZippyGameAdmin');

console.log('Running integration test: executor dry-run against a temp copy of ZippyGameAdmin');

if (!fs.existsSync(realWorkspace)) {
  console.error('Real workspace not found:', realWorkspace);
  process.exit(2);
}

// Create a temp workspace copy so tests don't mutate the real repo workspace
const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'kiro-integration-'));
const workspace = path.join(tmpRoot, 'ZippyGameAdmin');
try {
  // Node 16+ supports fs.cpSync
  fs.cpSync(realWorkspace, workspace, { recursive: true });
} catch (e) {
  console.error('Failed to copy workspace to temp dir:', e && e.message ? e.message : e);
  process.exit(3);
}

const automationDir = path.join(workspace, '.kiro', 'automation');
try { fs.rmSync(automationDir, { recursive: true, force: true }); } catch (e) {}

// Run executor in dry-run and verbose so it prints details and does not wait
const r = spawnSync('node', [executor, '--workspace', workspace, '--dry-run', '--verbose'], { encoding: 'utf8' });
console.log('Executor stdout:\n', r.stdout);
console.error('Executor stderr:\n', r.stderr);

if (r.status !== 0) {
  console.error('Executor returned non-zero exit code:', r.status);
  // Preserve temp workspace for debugging and (if running in CI) copy into repo for artifact upload
  try { preserveTempWorkspace(tmpRoot); } catch (e) { console.error('Failed to preserve temp workspace:', e && e.message ? e.message : e); }
  console.error('Temp workspace preserved at:', tmpRoot);
  // leave temp dir for debugging
  process.exit(4);
}

// Verify automation directory, state and log file exist inside temp workspace
const stateFile = path.join(automationDir, 'execution-state.json');
const logFile = path.join(automationDir, 'execution.log');

if (!fs.existsSync(automationDir)) {
  console.error('Automation directory not created:', automationDir);
  try { preserveTempWorkspace(tmpRoot); } catch (e) { console.error('Failed to preserve temp workspace:', e && e.message ? e.message : e); }
  console.error('Temp workspace preserved at:', tmpRoot);
  process.exit(5);
}
if (!fs.existsSync(stateFile)) {
  console.error('State file not created:', stateFile);
  try { preserveTempWorkspace(tmpRoot); } catch (e) { console.error('Failed to preserve temp workspace:', e && e.message ? e.message : e); }
  console.error('Temp workspace preserved at:', tmpRoot);
  process.exit(6);
}
if (!fs.existsSync(logFile)) {
  console.error('Log file not created:', logFile);
  try { preserveTempWorkspace(tmpRoot); } catch (e) { console.error('Failed to preserve temp workspace:', e && e.message ? e.message : e); }
  console.error('Temp workspace preserved at:', tmpRoot);
  process.exit(7);
}

console.log('Integration dry-run test passed');

// Cleanup temp workspace on success
try {
  // If KEEP_TEST_ARTIFACTS=1 preserve for debugging; otherwise clean up.
  const keep = process.env.KEEP_TEST_ARTIFACTS === '1';
  if (keep) {
    try { preserveTempWorkspace(tmpRoot); } catch (e) { console.error('Failed to preserve temp workspace:', e && e.message ? e.message : e); }
    console.log('Temp workspace preserved due to KEEP_TEST_ARTIFACTS=1 at:', tmpRoot);
  } else {
    fs.rmSync(tmpRoot, { recursive: true, force: true });
  }
} catch (e) {
  console.warn('Failed to clean up temp workspace:', e && e.message ? e.message : e);
}

function preserveTempWorkspace(tmpPath) {
  // If running under GitHub Actions or KEEP_TEST_ARTIFACTS, copy temp workspace into repo for artifact upload
  try {
    const shouldCopy = process.env.GITHUB_ACTIONS === 'true' || process.env.KEEP_TEST_ARTIFACTS === '1';
    if (!shouldCopy) return;
    const destRoot = path.join(repoRoot, 'scripts', 'tests', 'ci-artifacts');
    fs.mkdirSync(destRoot, { recursive: true });
    const ts = new Date().toISOString().replace(/[:.]/g, '-');
    const dest = path.join(destRoot, 'integration-' + ts);
    fs.cpSync(tmpPath, dest, { recursive: true });
    console.log('Copied temp workspace to:', dest);
  } catch (e) {
    console.error('Error copying temp workspace for artifacts:', e && e.message ? e.message : e);
  }
}
