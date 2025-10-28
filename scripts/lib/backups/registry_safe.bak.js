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
      fs.writeFileSync(lockPath, JSON.stringify(info), { flag: 'wx' });
      return true;
    } catch (err) {
      try {
        const st = fs.statSync(lockPath);
        const age = Date.now() - st.mtimeMs;
        if (age > 60 * 1000) {
          try { fs.unlinkSync(lockPath); } catch (e) { /* ignore */ }
          continue;
        }
      } catch (e) {}
      if (Date.now() - start > timeoutMs) return false;
      const until = Date.now() + 50;
      while (Date.now() < until) { /* busy-wait */ }
    }
  }
}

function _releaseLock() {
  try { fs.unlinkSync(lockPath); } catch (e) { /* ignore */ }
}

function saveRegistry(reg) {
  _ensureDir();
  if (!reg || typeof reg !== 'object') throw new Error('registry must be an object');
  if (!Array.isArray(reg.projects)) reg.projects = [];
  const locked = _acquireLock();
  if (!locked) throw new Error('Failed to acquire registry lock');
  const tmpPath = registryPath + TMP_SUFFIX;
  try {
    fs.writeFileSync(tmpPath, JSON.stringify(reg, null, 2), 'utf8');
    fs.renameSync(tmpPath, registryPath);
  } finally {
    try { if (fs.existsSync(tmpPath)) fs.unlinkSync(tmpPath); } catch (e) {}
    _releaseLock();
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
