const fs = require('fs');
const path = require('path');
const lockfile = require('proper-lockfile');

// Canonical, single implementation of the project registry.
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
  _ensureDir();
  if (!reg || typeof reg !== 'object') throw new Error('registry must be an object');
  if (!Array.isArray(reg.projects)) reg.projects = [];

  // Ensure a target file exists so proper-lockfile can acquire a lock on it
  if (!fs.existsSync(registryPath)) {
    try { fs.writeFileSync(registryPath, JSON.stringify(_defaultRegistry(), null, 2), 'utf8'); } catch (e) { /* ignore */ }
  }

  const lockOpts = { retries: { retries: 5, factor: 1, minTimeout: 50 }, stale: 60 * 1000 };
  let release;
  try {
    release = lockfile.lockSync(registryPath, lockOpts);
  } catch (e) {
    throw new Error('Failed to acquire registry lock: ' + (e.message || e));
  }

  const tmpPath = registryPath + TMP_SUFFIX;
  try {
    fs.writeFileSync(tmpPath, JSON.stringify(reg, null, 2), 'utf8');
    fs.renameSync(tmpPath, registryPath);
  } finally {
    try { if (fs.existsSync(tmpPath)) fs.unlinkSync(tmpPath); } catch (e) { /* ignore */ }
    try { if (release) release(); } catch (e) { /* ignore */ }
  }
}

function listProjects() { const reg = loadRegistry(); return reg.projects || []; }

function addProjectByPath(projectPath, baseCwd) {
  const base = baseCwd || process.cwd();
  const abs = path.resolve(base, projectPath);
  const reg = loadRegistry();
  const exists = reg.projects.find(p => p.path === abs);
  const entry = { name: path.basename(abs), path: abs, configPath: path.join(abs, '.kiro', 'config.json'), lastExecution: null, status: 'registered' };
  if (exists) Object.assign(exists, entry); else reg.projects.push(entry);
  saveRegistry(reg);
  return entry;
}

function addProjectEntry(entry) {
  if (!entry || typeof entry !== 'object') throw new Error('entry must be an object');
  const reg = loadRegistry();
  const normalized = Object.assign({ name: '', path: '', configPath: '', lastExecution: null, status: 'registered' }, entry);
  if (!normalized.path) throw new Error('entry.path is required');
  const exists = reg.projects.find(p => p.path === normalized.path);
  if (exists) Object.assign(exists, normalized); else reg.projects.push(normalized);
  saveRegistry(reg);
  return normalized;
}

function removeProject(arg) {
  const reg = loadRegistry();
  const before = reg.projects.length;
  reg.projects = reg.projects.filter(p => p.path !== arg && p.name !== arg);
  if (reg.projects.length === before) return false; saveRegistry(reg); return true;
}

module.exports = { loadRegistry, saveRegistry, listProjects, addProjectByPath, addProjectEntry, removeProject, registryPath };
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
  _ensureDir();
  if (!reg || typeof reg !== 'object') throw new Error('registry must be an object');
  if (!Array.isArray(reg.projects)) reg.projects = [];
  if (!fs.existsSync(registryPath)) {
    try { fs.writeFileSync(registryPath, JSON.stringify(_defaultRegistry(), null, 2), 'utf8'); } catch (e) { /* ignore */ }
  }

  const lockOpts = { stale: 60 * 1000 };
  let release;
  const start = Date.now();
  const timeoutMs = 2000;
  const intervalMs = 50;
  while (true) {
    try { release = lockfile.lockSync(registryPath, lockOpts); break; }
    catch (e) {
      if (Date.now() - start > timeoutMs) throw new Error('Failed to acquire registry lock: ' + (e.message || e));
      const until = Date.now() + intervalMs; while (Date.now() < until) { /* busy-wait short */ }
    }
  }

  const tmpPath = registryPath + TMP_SUFFIX;
  try { fs.writeFileSync(tmpPath, JSON.stringify(reg, null, 2), 'utf8'); fs.renameSync(tmpPath, registryPath); }
  finally { try { if (fs.existsSync(tmpPath)) fs.unlinkSync(tmpPath); } catch (e) { } try { if (release) release(); } catch (e) { } }
}

function listProjects() { return (loadRegistry().projects || []); }

function addProjectByPath(projectPath, baseCwd) {
  const base = baseCwd || process.cwd();
  const abs = path.resolve(base, projectPath);
  const reg = loadRegistry();
  const exists = reg.projects.find(p => p.path === abs);
  const entry = { name: path.basename(abs), path: abs, configPath: path.join(abs, '.kiro', 'config.json'), lastExecution: null, status: 'registered' };
  if (exists) Object.assign(exists, entry); else reg.projects.push(entry);
  saveRegistry(reg);
  return entry;
}

function addProjectEntry(entry) {
  if (!entry || typeof entry !== 'object') throw new Error('entry must be an object');
  const reg = loadRegistry();
  const normalized = Object.assign({ name: '', path: '', configPath: '', lastExecution: null, status: 'registered' }, entry);
  if (!normalized.path) throw new Error('entry.path is required');
  const exists = reg.projects.find(p => p.path === normalized.path);
  if (exists) Object.assign(exists, normalized); else reg.projects.push(normalized);
  saveRegistry(reg);
  return normalized;
}

function removeProject(arg) {
  const reg = loadRegistry();
  const before = reg.projects.length;
  reg.projects = reg.projects.filter(p => p.path !== arg && p.name !== arg);
  if (reg.projects.length === before) return false; saveRegistry(reg); return true;
}

module.exports = { loadRegistry, saveRegistry, listProjects, addProjectByPath, addProjectEntry, removeProject, registryPath };
// Clean, single canonical registry implementation.
const fs = require('fs');
const path = require('path');
const lockfile = require('proper-lockfile');

const repoRoot = path.resolve(__dirname, '..', '..');
const registryPath = path.join(repoRoot, '.kiro', 'projects.json');
const TMP_SUFFIX = '.tmp';

function _defaultRegistry() {
  return { version: '1.0.0', projects: [] };
}

function _ensureDir() {
  fs.mkdirSync(path.dirname(registryPath), { recursive: true });
}

function _readJSON(file) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (e) {
    throw new Error('Failed to parse JSON (' + file + '): ' + (e.message || e));
  }
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
  _ensureDir();
  if (!reg || typeof reg !== 'object') throw new Error('registry must be an object');
  if (!Array.isArray(reg.projects)) reg.projects = [];

  if (!fs.existsSync(registryPath)) {
    try { fs.writeFileSync(registryPath, JSON.stringify(_defaultRegistry(), null, 2), 'utf8'); } catch (e) { /* ignore */ }
  }

  const lockOpts = { stale: 60 * 1000 };
  let release;
  // sync API doesn't support retries option — implement a short retry loop
  const start = Date.now();
  const timeoutMs = 2000;
  const intervalMs = 50;
  while (true) {
    try {
      release = lockfile.lockSync(registryPath, lockOpts);
      break;
    } catch (e) {
      if (Date.now() - start > timeoutMs) {
        throw new Error('Failed to acquire registry lock: ' + (e.message || e));
      }
      const until = Date.now() + intervalMs;
      while (Date.now() < until) { /* busy-wait short */ }
    }
  }

  const tmpPath = registryPath + TMP_SUFFIX;
  try {
    fs.writeFileSync(tmpPath, JSON.stringify(reg, null, 2), 'utf8');
    fs.renameSync(tmpPath, registryPath);
  } finally {
    try { if (fs.existsSync(tmpPath)) fs.unlinkSync(tmpPath); } catch (e) { }
    try { if (release) release(); } catch (e) { }
  }
}

function listProjects() { return (loadRegistry().projects || []); }

function addProjectByPath(projectPath, baseCwd) {
  const base = baseCwd || process.cwd();
  const abs = path.resolve(base, projectPath);
  const reg = loadRegistry();
  const exists = reg.projects.find(p => p.path === abs);
  const entry = { name: path.basename(abs), path: abs, configPath: path.join(abs, '.kiro', 'config.json'), lastExecution: null, status: 'registered' };
  if (exists) Object.assign(exists, entry); else reg.projects.push(entry);
  saveRegistry(reg);
  return entry;
}

function addProjectEntry(entry) {
  if (!entry || typeof entry !== 'object') throw new Error('entry must be an object');
  const reg = loadRegistry();
  const normalized = Object.assign({ name: '', path: '', configPath: '', lastExecution: null, status: 'registered' }, entry);
  if (!normalized.path) throw new Error('entry.path is required');
  const exists = reg.projects.find(p => p.path === normalized.path);
  if (exists) Object.assign(exists, normalized); else reg.projects.push(normalized);
  saveRegistry(reg);
  return normalized;
}

function removeProject(arg) {
  const reg = loadRegistry();
  const before = reg.projects.length;
  reg.projects = reg.projects.filter(p => p.path !== arg && p.name !== arg);
  if (reg.projects.length === before) return false; saveRegistry(reg); return true;
}

module.exports = { loadRegistry, saveRegistry, listProjects, addProjectByPath, addProjectEntry, removeProject, registryPath };
const fs = require('fs');
const path = require('path');
const lockfile = require('proper-lockfile');

const repoRoot = path.resolve(__dirname, '..', '..');
const registryPath = path.join(repoRoot, '.kiro', 'projects.json');
const TMP_SUFFIX = '.tmp';

function _defaultRegistry() {
  return { version: '1.0.0', projects: [] };
}

function _ensureDir() {
  fs.mkdirSync(path.dirname(registryPath), { recursive: true });
}

function _readJSON(file) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (e) {
    throw new Error('Failed to parse JSON (' + file + '): ' + (e.message || e));
  }
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
  _ensureDir();
  if (!reg || typeof reg !== 'object') throw new Error('registry must be an object');
  if (!Array.isArray(reg.projects)) reg.projects = [];

  // Ensure a target file exists so proper-lockfile can acquire a lock on it
  if (!fs.existsSync(registryPath)) {
    try { fs.writeFileSync(registryPath, JSON.stringify(_defaultRegistry(), null, 2), 'utf8'); } catch (e) { /* ignore */ }
  }

  const lockOpts = { retries: { retries: 5, factor: 1, minTimeout: 50 }, stale: 60 * 1000 };
  let release;
  try {
    release = lockfile.lockSync(registryPath, lockOpts);
  } catch (e) {
    throw new Error('Failed to acquire registry lock: ' + (e.message || e));
  }

  const tmpPath = registryPath + TMP_SUFFIX;
  try {
    fs.writeFileSync(tmpPath, JSON.stringify(reg, null, 2), 'utf8');
    fs.renameSync(tmpPath, registryPath);
  } finally {
    try { if (fs.existsSync(tmpPath)) fs.unlinkSync(tmpPath); } catch (e) { /* ignore */ }
    try { if (release) release(); } catch (e) { /* ignore */ }
  }
}

function listProjects() {
  const reg = loadRegistry();
  return reg.projects || [];
}

function addProjectByPath(projectPath, baseCwd) {
  const base = baseCwd || process.cwd();
  const abs = path.resolve(base, projectPath);
  const reg = loadRegistry();
  const exists = reg.projects.find(p => p.path === abs);
  const entry = { name: path.basename(abs), path: abs, configPath: path.join(abs, '.kiro', 'config.json'), lastExecution: null, status: 'registered' };
  if (exists) Object.assign(exists, entry);
  else reg.projects.push(entry);
  saveRegistry(reg);
  return entry;
}

function addProjectEntry(entry) {
  if (!entry || typeof entry !== 'object') throw new Error('entry must be an object');
  const reg = loadRegistry();
  const normalized = Object.assign({ name: '', path: '', configPath: '', lastExecution: null, status: 'registered' }, entry);
  if (!normalized.path) throw new Error('entry.path is required');
  const exists = reg.projects.find(p => p.path === normalized.path);
  if (exists) Object.assign(exists, normalized);
  else reg.projects.push(normalized);
  saveRegistry(reg);
  return normalized;
}

function removeProject(arg) {
  const reg = loadRegistry();
  const before = reg.projects.length;
  reg.projects = reg.projects.filter(p => p.path !== arg && p.name !== arg);
  if (reg.projects.length === before) return false;
  saveRegistry(reg);
  return true;
}

module.exports = {
  loadRegistry,
  saveRegistry,
  listProjects,
  addProjectByPath,
  addProjectEntry,
  removeProject,
  registryPath,
};
const fs = require('fs');
const path = require('path');
const lockfile = require('proper-lockfile');

const repoRoot = path.resolve(__dirname, '..', '..');
const registryPath = path.join(repoRoot, '.kiro', 'projects.json');
const TMP_SUFFIX = '.tmp';

function _defaultRegistry() {
  return { version: '1.0.0', projects: [] };
}

function _ensureDir() {
  fs.mkdirSync(path.dirname(registryPath), { recursive: true });
}

function _readJSON(file) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (e) {
    throw new Error('Failed to parse JSON (' + file + '): ' + (e.message || e));
  }
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
  _ensureDir();
  if (!reg || typeof reg !== 'object') throw new Error('registry must be an object');
  if (!Array.isArray(reg.projects)) reg.projects = [];

  // Ensure a target file exists so proper-lockfile can acquire a lock on it
  if (!fs.existsSync(registryPath)) {
    try { fs.writeFileSync(registryPath, JSON.stringify(_defaultRegistry(), null, 2), 'utf8'); } catch (e) { /* ignore */ }
  }

  const lockOpts = { retries: { retries: 5, factor: 1, minTimeout: 50 }, stale: 60 * 1000 };
  let release;
  try {
    release = lockfile.lockSync(registryPath, lockOpts);
  } catch (e) {
    throw new Error('Failed to acquire registry lock: ' + (e.message || e));
  }

  const tmpPath = registryPath + TMP_SUFFIX;
  try {
    fs.writeFileSync(tmpPath, JSON.stringify(reg, null, 2), 'utf8');
    fs.renameSync(tmpPath, registryPath);
  } finally {
    try { if (fs.existsSync(tmpPath)) fs.unlinkSync(tmpPath); } catch (e) { /* ignore */ }
    try { if (release) release(); } catch (e) { /* ignore */ }
  }
}

function listProjects() {
  const reg = loadRegistry();
  return reg.projects || [];
}

function addProjectByPath(projectPath, baseCwd) {
  const base = baseCwd || process.cwd();
  const abs = path.resolve(base, projectPath);
  const reg = loadRegistry();
  const exists = reg.projects.find(p => p.path === abs);
  const entry = { name: path.basename(abs), path: abs, configPath: path.join(abs, '.kiro', 'config.json'), lastExecution: null, status: 'registered' };
  if (exists) Object.assign(exists, entry);
  else reg.projects.push(entry);
  saveRegistry(reg);
  return entry;
}

function addProjectEntry(entry) {
  if (!entry || typeof entry !== 'object') throw new Error('entry must be an object');
  const reg = loadRegistry();
  const normalized = Object.assign({ name: '', path: '', configPath: '', lastExecution: null, status: 'registered' }, entry);
  if (!normalized.path) throw new Error('entry.path is required');
  const exists = reg.projects.find(p => p.path === normalized.path);
  if (exists) Object.assign(exists, normalized);
  else reg.projects.push(normalized);
  saveRegistry(reg);
  return normalized;
}

function removeProject(arg) {
  const reg = loadRegistry();
  const before = reg.projects.length;
  reg.projects = reg.projects.filter(p => p.path !== arg && p.name !== arg);
  if (reg.projects.length === before) return false;
  saveRegistry(reg);
  return true;
}

module.exports = {
  loadRegistry,
  saveRegistry,
  listProjects,
  addProjectByPath,
  addProjectEntry,
  removeProject,
  registryPath,
};
const fs = require('fs');
const path = require('path');
const lockfile = require('proper-lockfile');

const repoRoot = path.resolve(__dirname, '..', '..');
const registryPath = path.join(repoRoot, '.kiro', 'projects.json');
const TMP_SUFFIX = '.tmp';

function _defaultRegistry() {
  return { version: '1.0.0', projects: [] };
}

function _ensureDir() {
  fs.mkdirSync(path.dirname(registryPath), { recursive: true });
}

function _readJSON(file) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (e) {
    throw new Error('Failed to parse JSON (' + file + '): ' + (e.message || e));
  }
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
  _ensureDir();
  if (!reg || typeof reg !== 'object') throw new Error('registry must be an object');
  if (!Array.isArray(reg.projects)) reg.projects = [];

  // Ensure a target file exists so proper-lockfile can acquire a lock on it
  if (!fs.existsSync(registryPath)) {
    try { fs.writeFileSync(registryPath, JSON.stringify(_defaultRegistry(), null, 2), 'utf8'); } catch (e) { /* ignore */ }
  }

  const lockOpts = { retries: { retries: 5, factor: 1, minTimeout: 50 }, stale: 60 * 1000 };
  let release;
  try {
    release = lockfile.lockSync(registryPath, lockOpts);
  } catch (e) {
    throw new Error('Failed to acquire registry lock: ' + (e.message || e));
  }

  const tmpPath = registryPath + TMP_SUFFIX;
  try {
    fs.writeFileSync(tmpPath, JSON.stringify(reg, null, 2), 'utf8');
    fs.renameSync(tmpPath, registryPath);
  } finally {
    try { if (fs.existsSync(tmpPath)) fs.unlinkSync(tmpPath); } catch (e) { /* ignore */ }
    try { if (release) release(); } catch (e) { /* ignore */ }
  }
}

function listProjects() {
  const reg = loadRegistry();
  return reg.projects || [];
}

function addProjectByPath(projectPath, baseCwd) {
  const base = baseCwd || process.cwd();
  const abs = path.resolve(base, projectPath);
  const reg = loadRegistry();
  const exists = reg.projects.find(p => p.path === abs);
  const entry = { name: path.basename(abs), path: abs, configPath: path.join(abs, '.kiro', 'config.json'), lastExecution: null, status: 'registered' };
  if (exists) Object.assign(exists, entry);
  else reg.projects.push(entry);
  saveRegistry(reg);
  return entry;
}

function addProjectEntry(entry) {
  if (!entry || typeof entry !== 'object') throw new Error('entry must be an object');
  const reg = loadRegistry();
  const normalized = Object.assign({ name: '', path: '', configPath: '', lastExecution: null, status: 'registered' }, entry);
  if (!normalized.path) throw new Error('entry.path is required');
  const exists = reg.projects.find(p => p.path === normalized.path);
  if (exists) Object.assign(exists, normalized);
  else reg.projects.push(normalized);
  saveRegistry(reg);
  return normalized;
}

function removeProject(arg) {
  const reg = loadRegistry();
  const before = reg.projects.length;
  reg.projects = reg.projects.filter(p => p.path !== arg && p.name !== arg);
  if (reg.projects.length === before) return false;
  saveRegistry(reg);
  return true;
}

module.exports = {
  loadRegistry,
  saveRegistry,
  listProjects,
  addProjectByPath,
  addProjectEntry,
  removeProject,
  registryPath,
};
const fs = require('fs');
const path = require('path');

const repoRoot = path.resolve(__dirname, '..', '..');
const registryPath = path.join(repoRoot, '.kiro', 'projects.json');

function loadRegistry() {
  if (!fs.existsSync(registryPath)) return { version: '1.0.0', projects: [] };
  try {
    return JSON.parse(fs.readFileSync(registryPath, 'utf8'));
  } catch (e) {
    throw new Error('Failed to read registry: ' + (e.message || e));
  }
}

function saveRegistry(reg) {
  try {
    fs.mkdirSync(path.dirname(registryPath), { recursive: true });
    fs.writeFileSync(registryPath, JSON.stringify(reg, null, 2), 'utf8');
  } catch (e) {
    throw new Error('Failed to write registry: ' + (e.message || e));
  }
}

function listProjects() {
  const reg = loadRegistry();
  return reg.projects || [];
}

function addProjectByPath(projectPath) {
  const abs = path.resolve(process.cwd(), projectPath);
  const reg = loadRegistry();
  const exists = reg.projects.find(p => p.path === abs);
  const entry = { name: path.basename(abs), path: abs, configPath: path.join(abs, '.kiro', 'config.json'), lastExecution: null, status: 'registered' };
  if (exists) Object.assign(exists, entry);
  else reg.projects.push(entry);
  saveRegistry(reg);
  return entry;
}

function addProjectEntry(entry) {
  const reg = loadRegistry();
  const normalized = Object.assign({ name: '', path: '', configPath: '', lastExecution: null, status: 'registered' }, entry);
  const exists = reg.projects.find(p => p.path === normalized.path);
  if (exists) Object.assign(exists, normalized);
  else reg.projects.push(normalized);
  saveRegistry(reg);
  return normalized;
}

function removeProject(arg) {
  const reg = loadRegistry();
  const before = reg.projects.length;
  reg.projects = reg.projects.filter(p => p.path !== arg && p.name !== arg);
  if (reg.projects.length === before) return false;
  saveRegistry(reg);
  return true;
}

const fs = require('fs');
const path = require('path');

const repoRoot = path.resolve(__dirname, '..', '..');
const registryPath = path.join(repoRoot, '.kiro', 'projects.json');
const lockPath = registryPath + '.lock';
const TMP_SUFFIX = '.tmp';

function _defaultRegistry() {
  return { version: '1.0.0', projects: [] };
}

function _ensureDir() {
  fs.mkdirSync(path.dirname(registryPath), { recursive: true });
}

function _readJSON(file) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (e) {
    throw new Error('Failed to parse JSON (' + file + '): ' + (e.message || e));
  }
}

function loadRegistry() {
  if (!fs.existsSync(registryPath)) return _defaultRegistry();
  const raw = _readJSON(registryPath);
  // Basic normalization/validation
  if (!raw || typeof raw !== 'object') return _defaultRegistry();
  if (!Array.isArray(raw.projects)) raw.projects = [];
  if (!raw.version) raw.version = '1.0.0';
  return raw;
}

function _acquireLock(timeoutMs = 2000) {
  const start = Date.now();
  while (true) {
    try {
      const info = { pid: process.pid, ts: Date.now() };
      fs.writeFileSync(lockPath, JSON.stringify(info), { flag: 'wx' }); // fail if exists
      return true;
    } catch (err) {
      // if lock exists, check age
      try {
        const st = fs.statSync(lockPath);
        const age = Date.now() - st.mtimeMs;
        // consider stale if older than 60s
        if (age > 60 * 1000) {
          try { fs.unlinkSync(lockPath); } catch (e) { /* ignore */ }
          continue; // retry acquiring
        }
      } catch (e) {
        // couldn't stat lock; continue trying until timeout
      }
      if (Date.now() - start > timeoutMs) return false;
      // small blocking sleep (short, acceptable for quick retries)
      const until = Date.now() + 50;
      while (Date.now() < until) { /* busy-wait */ }
    }
  }
}

function _releaseLock() {
  try { fs.unlinkSync(lockPath); } catch (e) { /* ignore */ }
}

function saveRegistry(reg) {
  try {
    _ensureDir();
    // validation
    if (!reg || typeof reg !== 'object') throw new Error('registry must be an object');
    if (!Array.isArray(reg.projects)) reg.projects = [];

    // acquire a short-lived lock to avoid concurrent writes
    const locked = _acquireLock();
    if (!locked) throw new Error('Failed to acquire registry lock');

    const tmpPath = registryPath + TMP_SUFFIX;
    try {
      fs.writeFileSync(tmpPath, JSON.stringify(reg, null, 2), 'utf8');
      // rename is atomic on same fs
      fs.renameSync(tmpPath, registryPath);
    } finally {
      try { if (fs.existsSync(tmpPath)) fs.unlinkSync(tmpPath); } catch (e) { /* ignore */ }
      _releaseLock();
    }
  } catch (e) {
    throw new Error('Failed to write registry: ' + (e.message || e));
  }
}

function listProjects() {
  const reg = loadRegistry();
  return reg.projects || [];
}

function addProjectByPath(projectPath, baseCwd) {
  const base = baseCwd || process.cwd();
  const abs = path.resolve(base, projectPath);
  const reg = loadRegistry();
  const exists = reg.projects.find(p => p.path === abs);
  const entry = { name: path.basename(abs), path: abs, configPath: path.join(abs, '.kiro', 'config.json'), lastExecution: null, status: 'registered' };
  if (exists) Object.assign(exists, entry);
  else reg.projects.push(entry);
  saveRegistry(reg);
  return entry;
}

function addProjectEntry(entry) {
  if (!entry || typeof entry !== 'object') throw new Error('entry must be an object');
  const reg = loadRegistry();
  const normalized = Object.assign({ name: '', path: '', configPath: '', lastExecution: null, status: 'registered' }, entry);
  if (!normalized.path) throw new Error('entry.path is required');
  const exists = reg.projects.find(p => p.path === normalized.path);
  if (exists) Object.assign(exists, normalized);
  else reg.projects.push(normalized);
  saveRegistry(reg);
  return normalized;
}

function removeProject(arg) {
  const reg = loadRegistry();
  const before = reg.projects.length;
  reg.projects = reg.projects.filter(p => p.path !== arg && p.name !== arg);
  if (reg.projects.length === before) return false;
  saveRegistry(reg);
  return true;
}

module.exports = {
  loadRegistry,
  saveRegistry,
  listProjects,
  addProjectByPath,
  addProjectEntry,
  removeProject,
  registryPath,
};
