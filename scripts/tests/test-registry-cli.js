const { spawnSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const repoRoot = path.resolve(__dirname, '..', '..');
const registryScript = path.join(repoRoot, 'scripts', 'registry.js');

console.log('Running registry CLI tests...');

// Ensure registry file exists and back it up
const registryPath = path.join(repoRoot, '.kiro', 'projects.json');
const backupPath = registryPath + '.bak';
if (fs.existsSync(registryPath)) fs.copyFileSync(registryPath, backupPath);

try {
  // List (should not throw)
  let r = spawnSync('node', [registryScript, 'list'], { encoding: 'utf8' });
  if (r.status !== 0) throw new Error('registry list failed: ' + r.stderr);

  // Add a temp project
  const tmpProj = path.join(repoRoot, 'scripts', 'tmp-test-proj');
  if (!fs.existsSync(tmpProj)) fs.mkdirSync(tmpProj, { recursive: true });
  r = spawnSync('node', [registryScript, 'add', tmpProj], { encoding: 'utf8' });
  if (r.status !== 0) throw new Error('registry add failed: ' + r.stderr);

  // List and check entry present
  r = spawnSync('node', [registryScript, 'list'], { encoding: 'utf8' });
  if (r.stdout.indexOf('tmp-test-proj') === -1 && r.stdout.indexOf('tmp-test-proj'.replace(/\\/g, '/')) === -1) {
    throw new Error('registry list did not show added project');
  }

  // Remove it
  r = spawnSync('node', [registryScript, 'remove', tmpProj], { encoding: 'utf8' });
  if (r.status !== 0) throw new Error('registry remove failed: ' + r.stderr);

  console.log('registry CLI tests passed');
} finally {
  // restore registry
  if (fs.existsSync(backupPath)) fs.copyFileSync(backupPath, registryPath);
  if (fs.existsSync(backupPath)) fs.unlinkSync(backupPath);
}
