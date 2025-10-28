const { spawnSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const repoRoot = path.resolve(__dirname, '..', '..');
const setupScript = path.join(repoRoot, 'scripts', 'setup-project.js');

console.log('Running setup-project tests...');

const tmpDir = path.join(repoRoot, 'scripts', 'tmp-setup-test');
if (fs.existsSync(tmpDir)) fs.rmdirSync(tmpDir, { recursive: true });
fs.mkdirSync(tmpDir, { recursive: true });

try {
  const r = spawnSync('node', [setupScript, tmpDir], { encoding: 'utf8' });
  if (r.status !== 0) {
    console.error('setup-project failed:', r.stderr || r.stdout);
    process.exit(2);
  }

  const configPath = path.join(tmpDir, '.kiro', 'config.json');
  if (!fs.existsSync(configPath)) {
    throw new Error('config.json not created');
  }

  const runCmd = path.join(tmpDir, 'run.cmd');
  if (!fs.existsSync(runCmd)) {
    throw new Error('run.cmd not created');
  }

  console.log('setup-project test passed');
} finally {
  // cleanup
  if (fs.existsSync(tmpDir)) fs.rmdirSync(tmpDir, { recursive: true });
}
