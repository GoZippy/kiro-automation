import * as fs from 'fs';
import * as path from 'path';
import { ProjectRegistry, EMPTY_REGISTRY, normalizeProjectEntry } from '../models/ProjectRegistry';
import { normalizeRegistry } from '../utils/ConfigFileValidator';

const DEFAULT_REGISTRY_FILENAME = 'projects.json';

/**
 * Loads the project registry from a base directory (e.g. extension root or config folder)
 * If the file does not exist it returns an empty registry object.
 */
export function loadRegistry(baseDir: string): ProjectRegistry {
  const filePath = path.join(baseDir, DEFAULT_REGISTRY_FILENAME);
  try {
    if (!fs.existsSync(filePath)) {
      return { ...EMPTY_REGISTRY };
    }

    const raw = JSON.parse(fs.readFileSync(filePath, { encoding: 'utf8' }));
    return normalizeRegistry(raw);
  } catch (err) {
    // If the registry is corrupted, return an empty registry (caller may back up or recover)
    console.error('[ProjectRegistryService] Failed to load registry:', err);
    return { ...EMPTY_REGISTRY };
  }
}

/**
 * Saves the registry to the given base directory (overwrites existing file)
 */
export function saveRegistry(baseDir: string, registry: ProjectRegistry): void {
  const filePath = path.join(baseDir, DEFAULT_REGISTRY_FILENAME);
  try {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, JSON.stringify(registry, null, 2), { encoding: 'utf8' });
  } catch (err) {
    console.error('[ProjectRegistryService] Failed to save registry:', err);
    throw err;
  }
}

/**
 * Registers a project (adds or updates existing by path)
 */
export function registerProject(baseDir: string, entry: Partial<ProjectRegistry['projects'][number]>): ProjectRegistry {
  const registry = loadRegistry(baseDir);
  const normalized = normalizeProjectEntry(entry || {});

  const existingIndex = registry.projects.findIndex((p) => p.path === normalized.path);
  if (existingIndex >= 0) {
    registry.projects[existingIndex] = { ...registry.projects[existingIndex], ...normalized };
  } else {
    registry.projects.push(normalized);
  }

  saveRegistry(baseDir, registry);
  return registry;
}

/**
 * Removes a project by path
 */
export function removeProject(baseDir: string, projectPath: string): ProjectRegistry {
  const registry = loadRegistry(baseDir);
  registry.projects = registry.projects.filter((p) => p.path !== projectPath);
  saveRegistry(baseDir, registry);
  return registry;
}
