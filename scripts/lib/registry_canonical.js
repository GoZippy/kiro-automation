const fs = require('fs');
const path = require('path');
const lockfile = require('proper-lockfile');

const repoRoot = path.resolve(__dirname, '..', '..');
const registryPath = path.join(repoRoot, '.kiro', 'projects.json');
const TMP_SUFFIX = '.tmp';

function _defaultRegistry() { return { version: '1.0.0', projects: [] }; }
function _ensureDir() { fs.mkdirSync(path.dirname(registryPath), { recursive: true }); }
function _readJSON(file) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); }
  catch (e) { throw new Error('Failed to parse JSON (' + file + '): ' + (e.message || e)); }
}

function loadRegistry() {
  if (!fs.existsSync(registryPath)) return _defaultRegistry();
  const raw = _readJSON(registryPath);
  if (!raw || typeof raw !== 'object') return _defaultRegistry();
  if (!Array.isArray(raw.projects)) raw.projects = [];
  if (!raw.version) raw.version = '1.0.0';
  return raw;
}

function saveRegistry(reg) {
  // Deprecated: saveRegistry is kept for compatibility but callers that modify the
  // registry should use modifyRegistry to ensure read-modify-write occurs under
  // a file lock. Here we perform a direct write (best-effort) to preserve API.
  _ensureDir();
  if (!reg || typeof reg !== 'object') throw new Error('registry must be an object');
  if (!Array.isArray(reg.projects)) reg.projects = [];

  // write directly (no merge) - prefer modifyRegistry for concurrent updates
  const tmpPath = registryPath + TMP_SUFFIX;
  try {
    fs.writeFileSync(tmpPath, JSON.stringify(reg, null, 2), 'utf8');
    fs.renameSync(tmpPath, registryPath);
  } finally {
    try { if (fs.existsSync(tmpPath)) fs.unlinkSync(tmpPath); } catch (e) { /* ignore */ }
  }
}

// Atomic modify under lock to avoid lost updates from concurrent read-modify-write
function modifyRegistry(mutator) {
  if (typeof mutator !== 'function') throw new Error('mutator must be a function');
  _ensureDir();
  if (!fs.existsSync(registryPath)) {
    try { fs.writeFileSync(registryPath, JSON.stringify(_defaultRegistry(), null, 2), 'utf8'); } catch (e) { /* ignore */ }
  }

  const lockOpts = { stale: 60 * 1000 };
  let release;
  const start = Date.now();
  const timeoutMs = 2000;
  const intervalMs = 20;
  while (true) {
    try { release = lockfile.lockSync(registryPath, lockOpts); break; }
    catch (e) {
      if (Date.now() - start > timeoutMs) throw new Error('Failed to acquire registry lock: ' + (e.message || e));
      const until = Date.now() + intervalMs; while (Date.now() < until) { /* busy wait */ }
    }
  }

  const tmpPath = registryPath + TMP_SUFFIX;
  try {
    let reg = _defaultRegistry();
    try { reg = _readJSON(registryPath); } catch (e) { reg = _defaultRegistry(); }
    if (!reg || typeof reg !== 'object') reg = _defaultRegistry();
    if (!Array.isArray(reg.projects)) reg.projects = [];

    // allow mutator to modify in-place
    mutator(reg);

    fs.writeFileSync(tmpPath, JSON.stringify(reg, null, 2), 'utf8');
    fs.renameSync(tmpPath, registryPath);
  } finally {
    try { if (fs.existsSync(tmpPath)) fs.unlinkSync(tmpPath); } catch (e) { /* ignore */ }
    try { if (release) release(); } catch (e) { /* ignore */ }
  }
}

function listProjects() { return (loadRegistry().projects || []); }

function addProjectByPath(projectPath, baseCwd) {
  const base = baseCwd || process.cwd();
  const abs = path.resolve(base, projectPath);
  let entry;
  modifyRegistry((reg) => {
    const exists = reg.projects.find(p => p.path === abs);
    entry = { name: path.basename(abs), path: abs, configPath: path.join(abs, '.kiro', 'config.json'), lastExecution: null, status: 'registered' };
    if (exists) Object.assign(exists, entry); else reg.projects.push(entry);
  });
  return entry;
}

function addProjectEntry(entry) {
  if (!entry || typeof entry !== 'object') throw new Error('entry must be an object');
  let normalized;
  modifyRegistry((reg) => {
    normalized = Object.assign({ name: '', path: '', configPath: '', lastExecution: null, status: 'registered' }, entry);
    if (!normalized.path) throw new Error('entry.path is required');
    const exists = reg.projects.find(p => p.path === normalized.path);
    if (exists) Object.assign(exists, normalized); else reg.projects.push(normalized);
  });
  return normalized;
}

function removeProject(arg) {
  let removed = false;
  modifyRegistry((reg) => {
    const before = reg.projects.length;
    reg.projects = reg.projects.filter(p => p.path !== arg && p.name !== arg);
    removed = reg.projects.length !== before;
  });
  return removed;
}

module.exports = { loadRegistry, saveRegistry, listProjects, addProjectByPath, addProjectEntry, removeProject, registryPath };
