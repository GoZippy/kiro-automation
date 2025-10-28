const child = require('child_process');
const os = require('os');
const fs = require('fs');
const path = require('path');

console.log('Running concurrent registry write test...');

const repoRoot = path.resolve(__dirname, '..', '..');
const registryPath = path.join(repoRoot, '.kiro', 'projects.json');
const backupPath = registryPath + '.bak';

// backup existing registry
if (fs.existsSync(registryPath)) fs.copyFileSync(registryPath, backupPath);

const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'kiro-reg-test-'));
const workers = 8;
const procs = [];
const dirs = [];

for (let i = 0; i < workers; i++) {
  const d = path.join(tmpRoot, 'proj-' + i);
  fs.mkdirSync(d, { recursive: true });
  dirs.push(d);
}

try {
  for (const d of dirs) {
    const p = child.spawn(process.execPath, [path.join(__dirname, '_concurrent_worker.js'), d], { stdio: ['ignore', 'pipe', 'pipe'] });
    procs.push({ p, d });
  }

  // wait for all
  const results = procs.map(({ p, d }) => new Promise((res) => {
    let out = '';
    p.stdout.on('data', c => out += c.toString());
    p.stderr.on('data', c => out += c.toString());
    p.on('close', (code) => res({ code, out, d }));
  }));

  Promise.all(results).then((rows) => {
    const failed = rows.filter(r => r.code !== 0);
    if (failed.length) {
      console.error('Some workers failed:', failed);
      cleanup(1);
      return;
    }

    // load registry and verify entries
    let reg = { projects: [] };
    try { reg = JSON.parse(fs.readFileSync(registryPath, 'utf8')); } catch (e) { /* ignore */ }
    const paths = (reg.projects || []).map(p => p.path);
    for (const d of dirs) {
      if (!paths.includes(d)) {
        console.error('Missing entry for', d);
        cleanup(1);
        return;
      }
    }
    console.log('Concurrent registry write test passed');
    cleanup(0);
  }).catch((err) => {
    console.error('Error awaiting workers', err);
    cleanup(1);
  });
} catch (e) {
  console.error('Test error', e);
  cleanup(1);
}

function cleanup(code) {
  try {
    // restore backup
    if (fs.existsSync(backupPath)) fs.copyFileSync(backupPath, registryPath);
    else if (fs.existsSync(registryPath)) fs.unlinkSync(registryPath);
  } catch (e) { console.warn('Failed to restore registry backup', e); }
  // remove temp dirs
  try { fs.rmSync(tmpRoot, { recursive: true, force: true }); } catch (e) { /* ignore */ }
  process.exit(code);
}
