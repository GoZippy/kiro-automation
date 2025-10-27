/**
 * Models module
 * Exports all data models and interfaces for the Kiro Automation Extension
 */

// Task models
export { Task, SubTask, TaskStatus, TaskModel } from './Task';

// Execution context models
export {
  ExecutionContext,
  ExecutionContextModel,
  SpecificationContext,
  WorkspaceContext,
  AutomationSession,
  createAutomationSession,
} from './ExecutionContext';

// Configuration models
export {
  AutomationConfig,
  ConfigurationSchema,
  ValidationResult,
  ConfigFieldSchema,
  DEFAULT_CONFIGURATION,
  mergeWithDefaults,
  createConfiguration,
} from './Configuration';
