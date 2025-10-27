/**
 * Main exports for the Kiro Automation Extension
 */

// Configuration management
export { ConfigManager } from './ConfigManager';
export {
  ConfigurationChangeHandler,
  ConfigurationChangeEvent,
  ConfigurationChangeCallback,
  createConfigurationChangeHandler,
} from './ConfigurationChangeHandler';

// Task management
export { TaskManager } from './TaskManager';

// Change detection
export {
  ChangeDetector,
  ChangeDetectionResult,
  TaskStatusChange,
} from './ChangeDetector';

// Workspace monitoring
export {
  WorkspaceMonitor,
  WorkspaceContext,
} from './WorkspaceMonitor';

// Kiro Interface
export {
  KiroInterface,
  KiroAPI,
  ChatMessage,
  KiroDiscoveryResult,
  createKiroInterface,
} from './KiroInterface';

export {
  ChatMessageSender,
  createChatMessageSender,
} from './ChatMessageSender';

export {
  ResponseMonitor,
  ResponseStatus,
  CompletionIndicators,
  ResponseMonitoringResult,
  createResponseMonitor,
} from './ResponseMonitor';

export {
  PromptGenerator,
  PromptVariables,
  PromptGenerationOptions,
  createPromptGenerator,
} from './PromptGenerator';

// Logging and debugging
export {
  Logger,
  LogLevel,
  LogEntry,
  LoggerConfig,
  SessionSummary,
  PerformanceMeasurement,
  DiagnosticInfo,
} from './Logger';

// Security and validation
export { InputValidator } from './InputValidator';
export {
  PermissionChecker,
  PermissionCheckResult,
} from './PermissionChecker';
export {
  AuditLogger,
  AuditEvent,
  AuditEventType,
} from './AuditLogger';

// Performance monitoring
export {
  PerformanceMonitor,
  MetricType,
  MemorySnapshot,
  CPUSnapshot,
  TaskExecutionMetric,
  PerformanceThresholds,
  PerformanceAlert,
  PerformanceStatistics,
} from './PerformanceMonitor';

export {
  ResourceManager,
  ResourceType,
  ResourceEntry,
  MemoryLeakDetection,
  CleanupResult,
} from './ResourceManager';

export {
  PerformanceReporter,
  ReportFormat,
  PerformanceReport,
  OptimizationSuggestion,
} from './PerformanceReporter';

// Models
export * from './models';
