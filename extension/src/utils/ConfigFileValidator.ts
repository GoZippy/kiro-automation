import * as fs from 'fs';
import * as path from 'path';

import { ProjectRegistry, normalizeProjectEntry } from '../models/ProjectRegistry';

/** Validation result shape used by extension code */
export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

/**
 * Validates a parsed project config JSON against required fields and basic path checks.
 * This is intentionally lightweight; callers may also validate against the JSON Schema file.
 */
export function validateProjectConfig(obj: any): ValidationResult {
  const errors: string[] = [];

  if (!obj || typeof obj !== 'object') {
    return { valid: false, errors: ['Config must be an object'] };
  }

  if (!obj.version || typeof obj.version !== 'string') {
    errors.push('Missing or invalid "version"');
  }
  if (!obj.projectName || typeof obj.projectName !== 'string') {
    errors.push('Missing or invalid "projectName"');
  }
  if (!obj.executorPath || typeof obj.executorPath !== 'string') {
    errors.push('Missing or invalid "executorPath"');
  }
  if (!obj.workspace || typeof obj.workspace !== 'string') {
    errors.push('Missing or invalid "workspace"');
  }
  if (!obj.specsPath || typeof obj.specsPath !== 'string') {
    errors.push('Missing or invalid "specsPath"');
  }

  // Basic path sanity checks
  if (obj.executorPath && typeof obj.executorPath === 'string') {
    // if absolute, check existence; if relative, caller should resolve
    if (path.isAbsolute(obj.executorPath) && !fs.existsSync(obj.executorPath)) {
      errors.push(`Executor path does not exist: ${obj.executorPath}`);
    }
  }

  if (obj.workspace && typeof obj.workspace === 'string') {
    if (path.isAbsolute(obj.workspace) && !fs.existsSync(obj.workspace)) {
      errors.push(`Workspace path does not exist: ${obj.workspace}`);
    }
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Normalizes a registry object read from disk, ensuring shape and defaults.
 */
export function normalizeRegistry(raw: any): ProjectRegistry {
  if (!raw || typeof raw !== 'object') {
    return { version: '1.0.0', projects: [] };
  }

  const version = typeof raw.version === 'string' ? raw.version : '1.0.0';
  const projects = Array.isArray(raw.projects)
    ? raw.projects.map((p) => normalizeProjectEntry(p || {}))
    : [];

  return { version, projects };
}
