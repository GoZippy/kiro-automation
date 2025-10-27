import * as path from 'path';

/**
 * InputValidator utility class
 * Provides validation and sanitization methods for user inputs
 * Prevents injection attacks and ensures data integrity
 */
export class InputValidator {
  private workspaceRoot: string;

  constructor(workspaceRoot: string) {
    this.workspaceRoot = workspaceRoot;
  }

  /**
   * Validates a task ID
   * Task IDs should be numeric or decimal format (e.g., "1", "2.1", "3.2")
   * @param taskId Task ID to validate
   * @returns True if valid
   */
  validateTaskId(taskId: string): boolean {
    if (!taskId || typeof taskId !== 'string') {
      return false;
    }

    // Task ID should match pattern: digits, optionally followed by dot and more digits
    const taskIdPattern = /^\d+(\.\d+)?$/;
    return taskIdPattern.test(taskId.trim());
  }

  /**
   * Validates a file path
   * Ensures path is within workspace and follows expected patterns
   * @param filePath File path to validate
   * @param allowedExtensions Optional array of allowed file extensions
   * @returns True if valid
   */
  validateFilePath(filePath: string, allowedExtensions?: string[]): boolean {
    if (!filePath || typeof filePath !== 'string') {
      return false;
    }

    try {
      // Normalize the path
      const normalizedPath = path.normalize(filePath);

      // Check for path traversal attempts
      if (normalizedPath.includes('..')) {
        return false;
      }

      // Check if path is absolute
      if (!path.isAbsolute(normalizedPath)) {
        return false;
      }

      // Check if path is within workspace
      const relativePath = path.relative(this.workspaceRoot, normalizedPath);
      if (relativePath.startsWith('..') || path.isAbsolute(relativePath)) {
        return false;
      }

      // Check file extension if specified
      if (allowedExtensions && allowedExtensions.length > 0) {
        const ext = path.extname(normalizedPath).toLowerCase();
        if (!allowedExtensions.includes(ext)) {
          return false;
        }
      }

      // Check for null bytes (security risk)
      if (normalizedPath.includes('\0')) {
        return false;
      }

      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Validates a spec name
   * Spec names should be alphanumeric with hyphens and underscores
   * @param specName Spec name to validate
   * @returns True if valid
   */
  validateSpecName(specName: string): boolean {
    if (!specName || typeof specName !== 'string') {
      return false;
    }

    // Spec name should be alphanumeric with hyphens and underscores
    const specNamePattern = /^[a-zA-Z0-9_-]+$/;
    return specNamePattern.test(specName.trim()) && specName.length <= 100;
  }

  /**
   * Validates configuration values
   * Ensures configuration values are within acceptable ranges
   * @param key Configuration key
   * @param value Configuration value
   * @returns Validation result with error message if invalid
   */
  validateConfigValue(key: string, value: any): { valid: boolean; error?: string } {
    switch (key) {
      case 'kiro-automation.concurrency':
        if (typeof value !== 'number' || value < 1 || value > 10) {
          return { valid: false, error: 'Concurrency must be a number between 1 and 10' };
        }
        break;

      case 'kiro-automation.retryAttempts':
        if (typeof value !== 'number' || value < 0 || value > 10) {
          return { valid: false, error: 'Retry attempts must be a number between 0 and 10' };
        }
        break;

      case 'kiro-automation.timeout':
        if (typeof value !== 'number' || value < 1000 || value > 3600000) {
          return {
            valid: false,
            error: 'Timeout must be a number between 1000 and 3600000 milliseconds',
          };
        }
        break;

      case 'kiro-automation.enabled':
      case 'kiro-automation.notifications':
        if (typeof value !== 'boolean') {
          return { valid: false, error: 'Value must be a boolean' };
        }
        break;

      case 'kiro-automation.logLevel':
        const validLogLevels = ['debug', 'info', 'warning', 'error'];
        if (typeof value !== 'string' || !validLogLevels.includes(value.toLowerCase())) {
          return {
            valid: false,
            error: `Log level must be one of: ${validLogLevels.join(', ')}`,
          };
        }
        break;

      default:
        // Unknown configuration key
        return { valid: false, error: `Unknown configuration key: ${key}` };
    }

    return { valid: true };
  }

  /**
   * Sanitizes user input to prevent injection attacks
   * Removes or escapes potentially harmful characters
   * @param input Input string to sanitize
   * @returns Sanitized string
   */
  sanitizeInput(input: string): string {
    if (!input || typeof input !== 'string') {
      return '';
    }

    // Remove null bytes
    let sanitized = input.replace(/\0/g, '');

    // Remove control characters except newline, tab, and carriage return
    sanitized = sanitized.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');

    // Trim whitespace
    sanitized = sanitized.trim();

    return sanitized;
  }

  /**
   * Sanitizes a prompt for Kiro chat
   * Ensures prompt doesn't contain malicious content
   * @param prompt Prompt to sanitize
   * @returns Sanitized prompt
   */
  sanitizePrompt(prompt: string): string {
    if (!prompt || typeof prompt !== 'string') {
      return '';
    }

    // Basic sanitization
    let sanitized = this.sanitizeInput(prompt);

    // Remove potential command injection patterns
    // Remove backticks that could be used for command substitution
    sanitized = sanitized.replace(/`/g, "'");

    // Remove potential script tags
    sanitized = sanitized.replace(/<script[^>]*>.*?<\/script>/gi, '');

    // Limit length to prevent DoS
    const maxLength = 10000;
    if (sanitized.length > maxLength) {
      sanitized = sanitized.substring(0, maxLength);
    }

    return sanitized;
  }

  /**
   * Validates a URL
   * Ensures URL is well-formed and uses allowed protocols
   * @param url URL to validate
   * @param allowedProtocols Optional array of allowed protocols (default: http, https)
   * @returns True if valid
   */
  validateUrl(url: string, allowedProtocols: string[] = ['http:', 'https:']): boolean {
    if (!url || typeof url !== 'string') {
      return false;
    }

    try {
      const parsedUrl = new URL(url);

      // Check protocol
      if (!allowedProtocols.includes(parsedUrl.protocol)) {
        return false;
      }

      // Check for localhost/private IPs (security risk)
      const hostname = parsedUrl.hostname.toLowerCase();
      if (
        hostname === 'localhost' ||
        hostname === '127.0.0.1' ||
        hostname.startsWith('192.168.') ||
        hostname.startsWith('10.') ||
        hostname.startsWith('172.')
      ) {
        return false;
      }

      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Validates a task status value
   * @param status Status value to validate
   * @returns True if valid
   */
  validateTaskStatus(status: string): boolean {
    const validStatuses = ['pending', 'in_progress', 'completed', 'failed', 'skipped'];
    return typeof status === 'string' && validStatuses.includes(status.toLowerCase());
  }

  /**
   * Validates a line number
   * @param lineNumber Line number to validate
   * @returns True if valid
   */
  validateLineNumber(lineNumber: number): boolean {
    return typeof lineNumber === 'number' && lineNumber >= 1 && Number.isInteger(lineNumber);
  }

  /**
   * Validates an array of requirements
   * @param requirements Requirements array to validate
   * @returns True if valid
   */
  validateRequirements(requirements: string[]): boolean {
    if (!Array.isArray(requirements)) {
      return false;
    }

    // Each requirement should be a non-empty string
    return requirements.every(
      (req) => typeof req === 'string' && req.trim().length > 0 && req.length <= 50
    );
  }

  /**
   * Validates a workspace folder path
   * @param folderPath Folder path to validate
   * @returns True if valid
   */
  validateWorkspaceFolder(folderPath: string): boolean {
    if (!folderPath || typeof folderPath !== 'string') {
      return false;
    }

    try {
      // Check if path is absolute
      if (!path.isAbsolute(folderPath)) {
        return false;
      }

      // Check for path traversal
      const normalizedPath = path.normalize(folderPath);
      if (normalizedPath.includes('..')) {
        return false;
      }

      // Check for null bytes
      if (normalizedPath.includes('\0')) {
        return false;
      }

      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Validates a session ID
   * @param sessionId Session ID to validate
   * @returns True if valid
   */
  validateSessionId(sessionId: string): boolean {
    if (!sessionId || typeof sessionId !== 'string') {
      return false;
    }

    // Session ID should be alphanumeric with hyphens (UUID format)
    const sessionIdPattern = /^[a-zA-Z0-9-]+$/;
    return sessionIdPattern.test(sessionId) && sessionId.length >= 8 && sessionId.length <= 64;
  }

  /**
   * Validates a timestamp
   * @param timestamp Timestamp to validate
   * @returns True if valid
   */
  validateTimestamp(timestamp: number | Date): boolean {
    if (timestamp instanceof Date) {
      return !isNaN(timestamp.getTime());
    }

    if (typeof timestamp === 'number') {
      // Check if timestamp is reasonable (between year 2000 and 2100)
      const minTimestamp = new Date('2000-01-01').getTime();
      const maxTimestamp = new Date('2100-01-01').getTime();
      return timestamp >= minTimestamp && timestamp <= maxTimestamp;
    }

    return false;
  }

  /**
   * Validates a JSON string
   * @param jsonString JSON string to validate
   * @returns Validation result with parsed object if valid
   */
  validateJson(jsonString: string): { valid: boolean; data?: any; error?: string } {
    if (!jsonString || typeof jsonString !== 'string') {
      return { valid: false, error: 'Input is not a string' };
    }

    try {
      const data = JSON.parse(jsonString);
      return { valid: true, data };
    } catch (error) {
      return { valid: false, error: `Invalid JSON: ${error}` };
    }
  }

  /**
   * Validates an object against a schema
   * @param obj Object to validate
   * @param schema Schema definition
   * @returns Validation result with errors if invalid
   */
  validateObject(
    obj: any,
    schema: { [key: string]: { type: string; required?: boolean; pattern?: RegExp } }
  ): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (typeof obj !== 'object' || obj === null) {
      return { valid: false, errors: ['Input is not an object'] };
    }

    // Check required fields
    for (const [key, rules] of Object.entries(schema)) {
      if (rules.required && !(key in obj)) {
        errors.push(`Missing required field: ${key}`);
        continue;
      }

      if (key in obj) {
        const value = obj[key];

        // Check type
        if (typeof value !== rules.type) {
          errors.push(`Field ${key} must be of type ${rules.type}, got ${typeof value}`);
        }

        // Check pattern if specified
        if (rules.pattern && typeof value === 'string' && !rules.pattern.test(value)) {
          errors.push(`Field ${key} does not match required pattern`);
        }
      }
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * Escapes special characters in a string for use in regex
   * @param str String to escape
   * @returns Escaped string
   */
  escapeRegex(str: string): string {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  /**
   * Validates that a string doesn't contain SQL injection patterns
   * @param input Input string to validate
   * @returns True if safe
   */
  validateNoSqlInjection(input: string): boolean {
    if (!input || typeof input !== 'string') {
      return true; // Empty input is safe
    }

    // Check for common SQL injection patterns
    const sqlPatterns = [
      /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|EXEC|EXECUTE)\b)/i,
      /(--|;|\/\*|\*\/)/,
      /(\bOR\b.*=.*)/i,
      /(\bAND\b.*=.*)/i,
      /('|"|\`)/,
    ];

    return !sqlPatterns.some((pattern) => pattern.test(input));
  }

  /**
   * Validates that a string doesn't contain command injection patterns
   * @param input Input string to validate
   * @returns True if safe
   */
  validateNoCommandInjection(input: string): boolean {
    if (!input || typeof input !== 'string') {
      return true; // Empty input is safe
    }

    // Check for command injection patterns
    const commandPatterns = [
      /[;&|`$()]/,
      /\$\{/,
      /\$\(/,
      /<\(/,
      />\(/,
    ];

    return !commandPatterns.some((pattern) => pattern.test(input));
  }
}
