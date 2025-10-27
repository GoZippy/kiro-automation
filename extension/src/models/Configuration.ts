/**
 * AutomationConfig interface
 * Defines all configuration settings for the automation extension
 */
export interface AutomationConfig {
  /** Whether automation is enabled */
  enabled: boolean;

  /** Number of concurrent tasks to execute */
  concurrency: number;

  /** Number of retry attempts for failed tasks */
  retryAttempts: number;

  /** Task timeout in milliseconds */
  timeout: number;

  /** Whether to show completion notifications */
  notifications: boolean;

  /** Notification level: 'all', 'errors', 'none' */
  notificationLevel: 'all' | 'errors' | 'none';

  /** Delay between tasks in milliseconds */
  taskDelay: number;

  /** Whether to auto-resume on VS Code restart */
  autoResume: boolean;

  /** Whether to skip optional tasks by default */
  skipOptionalTasks: boolean;

  /** Log level: 'debug', 'info', 'warning', 'error' */
  logLevel: 'debug' | 'info' | 'warning' | 'error';

  /** Whether to save logs to file */
  saveLogsToFile: boolean;

  /** Maximum log file size in MB */
  maxLogFileSize: number;

  /** Custom prompt template (optional) */
  customPromptTemplate?: string;

  /** Specs to exclude from automation */
  excludedSpecs: string[];

  /** Tasks to exclude from automation */
  excludedTasks: string[];

  /** Whether to verify task completion */
  verifyCompletion: boolean;

  /** Completion verification timeout in milliseconds */
  completionVerificationTimeout: number;

  /** Whether to enable performance monitoring */
  performanceMonitoring: boolean;

  /** Maximum memory usage in MB */
  maxMemoryUsage: number;
}

/**
 * ConfigurationSchema
 * Defines validation rules for configuration values
 */
export class ConfigurationSchema {
  /**
   * Validates a configuration object
   * @param config Configuration to validate
   * @returns Validation result with errors if any
   */
  static validate(config: Partial<AutomationConfig>): ValidationResult {
    const errors: string[] = [];

    // Validate concurrency
    if (config.concurrency !== undefined) {
      if (!Number.isInteger(config.concurrency) || config.concurrency < 1) {
        errors.push('Concurrency must be a positive integer');
      }
      if (config.concurrency > 10) {
        errors.push('Concurrency cannot exceed 10');
      }
    }

    // Validate retry attempts
    if (config.retryAttempts !== undefined) {
      if (!Number.isInteger(config.retryAttempts) || config.retryAttempts < 0) {
        errors.push('Retry attempts must be a non-negative integer');
      }
      if (config.retryAttempts > 10) {
        errors.push('Retry attempts cannot exceed 10');
      }
    }

    // Validate timeout
    if (config.timeout !== undefined) {
      if (!Number.isInteger(config.timeout) || config.timeout < 1000) {
        errors.push('Timeout must be at least 1000ms (1 second)');
      }
      if (config.timeout > 3600000) {
        errors.push('Timeout cannot exceed 3600000ms (1 hour)');
      }
    }

    // Validate task delay
    if (config.taskDelay !== undefined) {
      if (!Number.isInteger(config.taskDelay) || config.taskDelay < 0) {
        errors.push('Task delay must be a non-negative integer');
      }
    }

    // Validate notification level
    if (config.notificationLevel !== undefined) {
      const validLevels = ['all', 'errors', 'none'];
      if (!validLevels.includes(config.notificationLevel)) {
        errors.push(`Notification level must be one of: ${validLevels.join(', ')}`);
      }
    }

    // Validate log level
    if (config.logLevel !== undefined) {
      const validLevels = ['debug', 'info', 'warning', 'error'];
      if (!validLevels.includes(config.logLevel)) {
        errors.push(`Log level must be one of: ${validLevels.join(', ')}`);
      }
    }

    // Validate max log file size
    if (config.maxLogFileSize !== undefined) {
      if (!Number.isInteger(config.maxLogFileSize) || config.maxLogFileSize < 1) {
        errors.push('Max log file size must be at least 1 MB');
      }
      if (config.maxLogFileSize > 1000) {
        errors.push('Max log file size cannot exceed 1000 MB');
      }
    }

    // Validate completion verification timeout
    if (config.completionVerificationTimeout !== undefined) {
      if (
        !Number.isInteger(config.completionVerificationTimeout) ||
        config.completionVerificationTimeout < 1000
      ) {
        errors.push('Completion verification timeout must be at least 1000ms');
      }
    }

    // Validate max memory usage
    if (config.maxMemoryUsage !== undefined) {
      if (!Number.isInteger(config.maxMemoryUsage) || config.maxMemoryUsage < 50) {
        errors.push('Max memory usage must be at least 50 MB');
      }
      if (config.maxMemoryUsage > 2000) {
        errors.push('Max memory usage cannot exceed 2000 MB');
      }
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * Gets the schema definition for a configuration key
   */
  static getSchema(key: keyof AutomationConfig): ConfigFieldSchema | undefined {
    return CONFIGURATION_SCHEMA[key];
  }

  /**
   * Gets all schema definitions
   */
  static getAllSchemas(): Record<keyof AutomationConfig, ConfigFieldSchema> {
    return CONFIGURATION_SCHEMA;
  }
}

/**
 * Validation result interface
 */
export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

/**
 * Configuration field schema
 */
export interface ConfigFieldSchema {
  type: 'boolean' | 'number' | 'string' | 'array';
  default: any;
  description: string;
  min?: number;
  max?: number;
  enum?: string[];
}

/**
 * Default configuration values
 */
export const DEFAULT_CONFIGURATION: AutomationConfig = {
  enabled: true,
  concurrency: 1,
  retryAttempts: 3,
  timeout: 300000, // 5 minutes
  notifications: true,
  notificationLevel: 'all',
  taskDelay: 2000, // 2 seconds
  autoResume: false,
  skipOptionalTasks: false,
  logLevel: 'info',
  saveLogsToFile: true,
  maxLogFileSize: 10, // 10 MB
  excludedSpecs: [],
  excludedTasks: [],
  verifyCompletion: true,
  completionVerificationTimeout: 30000, // 30 seconds
  performanceMonitoring: true,
  maxMemoryUsage: 100, // 100 MB
};

/**
 * Configuration schema definitions
 */
const CONFIGURATION_SCHEMA: Record<keyof AutomationConfig, ConfigFieldSchema> = {
  enabled: {
    type: 'boolean',
    default: true,
    description: 'Enable or disable Kiro automation',
  },
  concurrency: {
    type: 'number',
    default: 1,
    description: 'Number of concurrent tasks to execute',
    min: 1,
    max: 10,
  },
  retryAttempts: {
    type: 'number',
    default: 3,
    description: 'Number of retry attempts for failed tasks',
    min: 0,
    max: 10,
  },
  timeout: {
    type: 'number',
    default: 300000,
    description: 'Task timeout in milliseconds',
    min: 1000,
    max: 3600000,
  },
  notifications: {
    type: 'boolean',
    default: true,
    description: 'Show completion notifications',
  },
  notificationLevel: {
    type: 'string',
    default: 'all',
    description: 'Notification level',
    enum: ['all', 'errors', 'none'],
  },
  taskDelay: {
    type: 'number',
    default: 2000,
    description: 'Delay between tasks in milliseconds',
    min: 0,
  },
  autoResume: {
    type: 'boolean',
    default: false,
    description: 'Auto-resume automation on VS Code restart',
  },
  skipOptionalTasks: {
    type: 'boolean',
    default: false,
    description: 'Skip optional tasks by default',
  },
  logLevel: {
    type: 'string',
    default: 'info',
    description: 'Log level',
    enum: ['debug', 'info', 'warning', 'error'],
  },
  saveLogsToFile: {
    type: 'boolean',
    default: true,
    description: 'Save logs to file',
  },
  maxLogFileSize: {
    type: 'number',
    default: 10,
    description: 'Maximum log file size in MB',
    min: 1,
    max: 1000,
  },
  customPromptTemplate: {
    type: 'string',
    default: '',
    description: 'Custom prompt template for task execution',
  },
  excludedSpecs: {
    type: 'array',
    default: [],
    description: 'Specs to exclude from automation',
  },
  excludedTasks: {
    type: 'array',
    default: [],
    description: 'Tasks to exclude from automation',
  },
  verifyCompletion: {
    type: 'boolean',
    default: true,
    description: 'Verify task completion before proceeding',
  },
  completionVerificationTimeout: {
    type: 'number',
    default: 30000,
    description: 'Completion verification timeout in milliseconds',
    min: 1000,
  },
  performanceMonitoring: {
    type: 'boolean',
    default: true,
    description: 'Enable performance monitoring',
  },
  maxMemoryUsage: {
    type: 'number',
    default: 100,
    description: 'Maximum memory usage in MB',
    min: 50,
    max: 2000,
  },
};

/**
 * Merges partial configuration with defaults
 */
export function mergeWithDefaults(
  partial: Partial<AutomationConfig>
): AutomationConfig {
  return {
    ...DEFAULT_CONFIGURATION,
    ...partial,
  };
}

/**
 * Creates a configuration object from key-value pairs
 */
export function createConfiguration(
  values: Record<string, any>
): AutomationConfig {
  const config: Partial<AutomationConfig> = {};

  for (const [key, value] of Object.entries(values)) {
    if (key in DEFAULT_CONFIGURATION) {
      (config as any)[key] = value;
    }
  }

  return mergeWithDefaults(config);
}
