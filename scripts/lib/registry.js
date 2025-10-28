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

module.exports = {
  loadRegistry,
  saveRegistry,
  listProjects,
  addProjectByPath,
  addProjectEntry,
  removeProject,
  registryPath,
};
