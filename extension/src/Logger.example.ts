/**
 * Example usage of the Logger utility
 * This file demonstrates the various features of the Logger class
 */

import { Logger, LogLevel } from './Logger';

// ============================================================================
// Basic Usage
// ============================================================================

export function basicLoggingExample() {
  const logger = Logger.getInstance();

  // Simple logging at different levels
  logger.debug('This is a debug message');
  logger.info('Application started successfully');
  logger.warning('Configuration file not found, using defaults');
  logger.error('Failed to connect to service');
}

// ============================================================================
// Logging with Context
// ============================================================================

export function contextLoggingExample() {
  const logger = Logger.getInstance();

  // Add context information to logs
  logger.info('User action performed', {
    userId: 'user123',
    action: 'file_save',
    fileName: 'example.ts',
  });

  logger.error('API request failed', {
    endpoint: '/api/tasks',
    statusCode: 500,
    retryCount: 3,
  });
}

// ============================================================================
// Correlation IDs for Tracking Execution Flows
// ============================================================================

export async function correlationIdExample() {
  const logger = Logger.getInstance();

  // Generate and push a correlation ID for tracking related operations
  const correlationId = logger.pushCorrelationId();
  
  logger.info('Starting task execution', { taskId: 'task-1' });
  
  // All logs within this scope will automatically use the correlation ID
  await performSubOperation();
  
  logger.info('Task execution completed', { taskId: 'task-1' });
  
  // Pop the correlation ID when done
  logger.popCorrelationId();
}

async function performSubOperation() {
  const logger = Logger.getInstance();
  // This log will automatically include the parent's correlation ID
  logger.debug('Performing sub-operation');
}

// ============================================================================
// Performance Measurement
// ============================================================================

export async function performanceMeasurementExample() {
  const logger = Logger.getInstance();

  // Manual performance measurement
  logger.startPerformanceMeasurement('task-execution', { taskId: 'task-1' });
  
  // Perform some work
  await new Promise(resolve => setTimeout(resolve, 100));
  
  logger.endPerformanceMeasurement('task-execution', { success: true });

  // Automatic performance measurement with async function
  const result = await logger.measureAsync(
    'api-call',
    async () => {
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 50));
      return { data: 'response' };
    },
    { endpoint: '/api/tasks' }
  );

  // Automatic performance measurement with sync function
  const syncResult = logger.measure(
    'calculation',
    () => {
      return Array.from({ length: 1000 }, (_, i) => i).reduce((a, b) => a + b, 0);
    },
    { operation: 'sum' }
  );
}

// ============================================================================
// Debug Mode and Verbose Logging
// ============================================================================

export function debugModeExample() {
  const logger = Logger.getInstance();

  // Enable debug mode for verbose logging
  logger.enableDebugMode();

  // Verbose logs only appear in debug mode
  logger.verbose('Detailed internal state', {
    queueSize: 10,
    activeWorkers: 3,
  });

  // Trace logs include stack traces
  logger.trace('Function called', { params: { id: 123 } });

  // Disable debug mode
  logger.disableDebugMode();
}

// ============================================================================
// Session Management and Summaries
// ============================================================================

export function sessionManagementExample() {
  const logger = Logger.getInstance();

  // Get current session summary
  const summary = logger.getSessionSummary();
  console.log('Total logs:', summary.totalLogs);
  console.log('Errors:', summary.logsByLevel[LogLevel.ERROR]);
  console.log('Warnings:', summary.logsByLevel[LogLevel.WARNING]);

  // Export session summary as JSON
  const summaryJson = logger.exportSessionSummary();
  console.log(summaryJson);

  // Save session summary to file
  logger.saveSessionSummary();

  // Start a new session
  logger.resetSession();
}

// ============================================================================
// Diagnostic Information
// ============================================================================

export function diagnosticsExample() {
  const logger = Logger.getInstance();

  // Collect diagnostic information
  const diagnostics = logger.collectDiagnostics();
  console.log('Extension version:', diagnostics.extensionVersion);
  console.log('Memory usage:', diagnostics.memoryUsage);
  console.log('Active correlation IDs:', diagnostics.activeCorrelationIds);

  // Export diagnostics as JSON
  const diagnosticsJson = logger.exportDiagnostics();
  console.log(diagnosticsJson);

  // Save diagnostics to file
  logger.saveDiagnostics();
}

// ============================================================================
// Configuration
// ============================================================================

export function configurationExample() {
  const logger = Logger.getInstance({
    minLevel: LogLevel.DEBUG,
    enableFileLogging: true,
    maxLogFileSize: 10 * 1024 * 1024, // 10MB
    maxLogFiles: 10,
    useJsonFormat: true, // Enable JSON format for structured logging
  });

  // Update configuration at runtime
  logger.updateConfig({
    minLevel: LogLevel.INFO,
    useJsonFormat: false,
  });

  // Show the output channel
  logger.show();

  // Clear the output channel
  logger.clear();
}

// ============================================================================
// Complete Example: Task Execution with Full Logging
// ============================================================================

export async function completeTaskExecutionExample() {
  const logger = Logger.getInstance();
  
  // Enable debug mode for detailed logging
  logger.enableDebugMode();
  
  // Start a new session
  logger.resetSession();
  
  // Create correlation ID for this execution
  const executionId = logger.pushCorrelationId();
  
  logger.info('Starting automation session', {
    sessionId: executionId,
    timestamp: new Date().toISOString(),
  });

  try {
    // Measure overall execution time
    await logger.measureAsync(
      'full-automation',
      async () => {
        // Execute multiple tasks
        for (let i = 1; i <= 3; i++) {
          const taskId = logger.pushCorrelationId();
          
          logger.info(`Executing task ${i}`, { taskId });
          
          await logger.measureAsync(
            `task-${i}`,
            async () => {
              // Simulate task execution
              await new Promise(resolve => setTimeout(resolve, 100));
              
              if (i === 2) {
                logger.warning('Task took longer than expected', {
                  taskId,
                  expectedDuration: 50,
                  actualDuration: 100,
                });
              }
            },
            { taskNumber: i }
          );
          
          logger.info(`Task ${i} completed`, { taskId });
          logger.popCorrelationId();
        }
      },
      { totalTasks: 3 }
    );

    logger.info('Automation session completed successfully');
  } catch (error) {
    logger.error('Automation session failed', {
      error: String(error),
      executionId,
    });
  } finally {
    // Pop the execution correlation ID
    logger.popCorrelationId();
    
    // Save session summary and diagnostics
    await logger.saveSessionSummary();
    await logger.saveDiagnostics();
    
    // Get final summary
    const summary = logger.getSessionSummary();
    logger.info('Session summary', {
      totalLogs: summary.totalLogs,
      errors: summary.errors.length,
      warnings: summary.warnings.length,
      duration: summary.endTime && summary.startTime 
        ? summary.endTime.getTime() - summary.startTime.getTime() 
        : 0,
    });
  }
}
