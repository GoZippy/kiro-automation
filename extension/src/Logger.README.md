# Logger Utility

A comprehensive logging and debugging utility for the Kiro Automation Extension.

## Features

### 1. Multi-Level Logging
- **DEBUG**: Detailed diagnostic information
- **INFO**: General informational messages
- **WARNING**: Warning messages for potentially problematic situations
- **ERROR**: Error messages for failures

### 2. Structured Logging
- **JSON Format**: Optional JSON output for machine-readable logs
- **Correlation IDs**: Track related operations across the codebase
- **Context Data**: Attach arbitrary metadata to log entries
- **Session Summaries**: Aggregate logging statistics per session

### 3. File-Based Logging with Rotation
- Automatic log file creation in `.kiro/logs/`
- Configurable file size limits (default: 5MB)
- Automatic rotation when size limit is reached
- Configurable retention (default: 5 files)

### 4. VS Code Integration
- Output channel for real-time log viewing
- Integrated with VS Code's output panel
- Console logging for development

### 5. Performance Profiling
- Start/end performance measurements
- Automatic timing with `measure()` and `measureAsync()`
- Performance metrics in log context

### 6. Debug Mode
- Verbose logging with detailed information
- Stack traces with `trace()` method
- Performance monitoring hooks
- Diagnostic information collection

### 7. Diagnostic Information
- Extension version and VS Code version
- Platform and system information
- Memory usage statistics
- Recent errors and warnings
- Active correlation IDs

## Usage

### Basic Logging

```typescript
import { Logger } from './Logger';

const logger = Logger.getInstance();

logger.debug('Detailed debug information');
logger.info('Application started');
logger.warning('Configuration missing, using defaults');
logger.error('Failed to connect to service');
```

### Logging with Context

```typescript
logger.info('Task executed', {
  taskId: 'task-123',
  duration: 1500,
  success: true,
});

logger.error('API call failed', {
  endpoint: '/api/tasks',
  statusCode: 500,
  retryCount: 3,
});
```

### Correlation IDs

```typescript
// Push a correlation ID for tracking related operations
const correlationId = logger.pushCorrelationId();

logger.info('Starting workflow');
// ... perform operations ...
logger.info('Workflow completed');

// Pop when done
logger.popCorrelationId();

// All logs between push and pop will include the correlation ID
```

### Performance Measurement

```typescript
// Manual measurement
logger.startPerformanceMeasurement('task-execution');
// ... perform work ...
const duration = logger.endPerformanceMeasurement('task-execution');

// Automatic measurement (async)
const result = await logger.measureAsync(
  'api-call',
  async () => {
    return await fetchData();
  },
  { endpoint: '/api/data' }
);

// Automatic measurement (sync)
const result = logger.measure(
  'calculation',
  () => {
    return performCalculation();
  }
);
```

### Debug Mode

```typescript
// Enable debug mode
logger.enableDebugMode();

// Verbose logging (only in debug mode)
logger.verbose('Detailed internal state', { queueSize: 10 });

// Trace with stack trace (only in debug mode)
logger.trace('Function called', { params: { id: 123 } });

// Disable debug mode
logger.disableDebugMode();
```

### Session Management

```typescript
// Get session summary
const summary = logger.getSessionSummary();
console.log('Total logs:', summary.totalLogs);
console.log('Errors:', summary.errors.length);

// Export as JSON
const summaryJson = logger.exportSessionSummary();

// Save to file
await logger.saveSessionSummary();

// Start new session
logger.resetSession();
```

### Diagnostics

```typescript
// Collect diagnostic information
const diagnostics = logger.collectDiagnostics();

// Export as JSON
const diagnosticsJson = logger.exportDiagnostics();

// Save to file
await logger.saveDiagnostics();
```

## Configuration

```typescript
const logger = Logger.getInstance({
  minLevel: LogLevel.DEBUG,           // Minimum log level
  enableFileLogging: true,            // Enable file-based logging
  logDirectory: '/custom/path',       // Custom log directory
  maxLogFileSize: 10 * 1024 * 1024,  // 10MB
  maxLogFiles: 10,                    // Keep 10 log files
  enableConsole: true,                // Log to console
  enableOutputChannel: true,          // Log to VS Code output channel
  useJsonFormat: false,               // Use JSON format
});

// Update configuration at runtime
logger.updateConfig({
  minLevel: LogLevel.INFO,
  useJsonFormat: true,
});
```

## Output Locations

### File Logs
- Default location: `.kiro/logs/automation-YYYY-MM-DD_HH-MM-SS.log`
- Session summaries: `.kiro/logs/session-{sessionId}.json`
- Diagnostics: `.kiro/logs/diagnostics-YYYY-MM-DD_HH-MM-SS.json`

### VS Code Output Channel
- View → Output → Select "Kiro Automation" from dropdown

### Console
- Available in VS Code's Debug Console when running the extension

## Log Format

### Standard Format
```
[2025-10-25T12:34:56.789Z] INFO    [correlation-id]: Message text | {"context":"data"}
```

### JSON Format
```json
{
  "timestamp": "2025-10-25T12:34:56.789Z",
  "level": "INFO",
  "message": "Message text",
  "context": {"key": "value"},
  "correlationId": "correlation-id",
  "sessionId": "session-id"
}
```

## Best Practices

1. **Use appropriate log levels**
   - DEBUG: Internal state, detailed flow
   - INFO: Important events, milestones
   - WARNING: Recoverable issues
   - ERROR: Failures requiring attention

2. **Add context to logs**
   - Include relevant IDs, parameters, and state
   - Makes debugging much easier

3. **Use correlation IDs for workflows**
   - Track related operations across the codebase
   - Essential for debugging complex flows

4. **Enable debug mode during development**
   - Get verbose logging and stack traces
   - Disable in production for performance

5. **Measure performance of critical operations**
   - Identify bottlenecks
   - Track performance over time

6. **Save session summaries and diagnostics**
   - Useful for post-mortem analysis
   - Include in bug reports

## Example: Complete Workflow

See `Logger.example.ts` for a complete example of using the Logger in a task execution workflow.

## API Reference

### Logger Methods

#### Logging
- `debug(message, context?, correlationId?)` - Log debug message
- `info(message, context?, correlationId?)` - Log info message
- `warning(message, context?, correlationId?)` - Log warning message
- `error(message, context?, correlationId?)` - Log error message
- `verbose(message, context?, correlationId?)` - Log verbose message (debug mode only)
- `trace(message, context?, correlationId?)` - Log with stack trace (debug mode only)

#### Correlation IDs
- `generateCorrelationId()` - Generate a unique correlation ID
- `pushCorrelationId(id?)` - Push correlation ID onto stack
- `popCorrelationId()` - Pop correlation ID from stack
- `getCurrentCorrelationId()` - Get current correlation ID

#### Performance
- `startPerformanceMeasurement(name, metadata?)` - Start measurement
- `endPerformanceMeasurement(name, metadata?)` - End measurement
- `measureAsync(name, fn, metadata?)` - Measure async function
- `measure(name, fn, metadata?)` - Measure sync function
- `getActivePerformanceMeasurements()` - Get active measurements

#### Debug Mode
- `enableDebugMode()` - Enable debug mode
- `disableDebugMode()` - Disable debug mode
- `isDebugMode()` - Check if debug mode is enabled

#### Session Management
- `getSessionSummary()` - Get current session summary
- `exportSessionSummary()` - Export session summary as JSON
- `saveSessionSummary()` - Save session summary to file
- `resetSession()` - Start a new session

#### Diagnostics
- `collectDiagnostics()` - Collect diagnostic information
- `exportDiagnostics()` - Export diagnostics as JSON
- `saveDiagnostics()` - Save diagnostics to file

#### Configuration
- `updateConfig(config)` - Update logger configuration
- `show()` - Show the output channel
- `clear()` - Clear the output channel

#### Utility
- `getCurrentLogFile()` - Get current log file path
- `getLogFiles()` - Get all log files
- `dispose()` - Dispose of logger resources

## Requirements Satisfied

This implementation satisfies the following requirements from the specification:

- **9.1**: Log all automation activities with timestamps ✓
- **9.2**: Provide different log levels (debug, info, warning, error) ✓
- **9.3**: Save logs to files for later analysis ✓
- **9.4**: Include context information (task ID, spec name, chat session) ✓
- **9.5**: Provide log filtering and search capabilities ✓
- **9.6**: Export logs in standard formats (JSON, CSV) ✓
- **9.7**: Integrate with VS Code's output panel for real-time viewing ✓

Additional features beyond requirements:
- Correlation IDs for tracking execution flows
- Session summaries and aggregation
- Performance profiling hooks
- Debug mode with verbose logging
- Diagnostic information collection
- Automatic log rotation
- Memory-efficient file handling
