/**
 * Project registry models
 * Represents registered target projects that use the KiroAutomation executor
 */
export interface ProjectEntry {
  /** Human readable name for the project */
  name: string;

  /** Absolute path to the project root */
  path: string;

  /** Relative or absolute path to the generated config.json (optional) */
  configPath?: string;

  /** Last execution timestamp ISO string (optional) */
  lastExecution?: string;

  /** Optional status string for quick UI display */
  status?: 'registered' | 'missing' | 'error' | 'unknown';
}

export interface ProjectRegistry {
  version: string;
  projects: ProjectEntry[];
}

/** Minimal empty registry */
export const EMPTY_REGISTRY: ProjectRegistry = {
  version: '1.0.0',
  projects: [],
};

/**
 * Simple helper to normalize a project entry for storage (keeps only allowed fields)
 */
export function normalizeProjectEntry(entry: Partial<ProjectEntry>): ProjectEntry {
  return {
    name: entry.name || 'unnamed',
    path: entry.path || '',
    configPath: entry.configPath,
    lastExecution: entry.lastExecution,
    status: entry.status || 'registered',
  };
}
