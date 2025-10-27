import * as vscode from 'vscode';
import { KiroInterface, ChatMessage } from './KiroInterface';

/**
 * Response status
 */
export enum ResponseStatus {
  PENDING = 'pending',
  IN_PROGRESS = 'in_progress',
  COMPLETED = 'completed',
  FAILED = 'failed',
  TIMEOUT = 'timeout',
}

/**
 * Completion indicators
 */
export interface CompletionIndicators {
  /** Success indicators in response */
  success: string[];
  
  /** Failure indicators in response */
  failure: string[];
  
  /** In-progress indicators */
  inProgress: string[];
  
  /** Request for input indicators */
  needsInput: string[];
}

/**
 * Response monitoring result
 */
export interface ResponseMonitoringResult {
  /** Status of the response */
  status: ResponseStatus;
  
  /** Response content */
  content: string;
  
  /** Whether completion was detected */
  completed: boolean;
  
  /** Whether the task succeeded */
  success: boolean;
  
  /** Whether user input is needed */
  needsInput: boolean;
  
  /** Detected indicators */
  detectedIndicators: string[];
  
  /** Timestamp when monitoring started */
  startTime: Date;
  
  /** Timestamp when monitoring ended */
  endTime?: Date;
  
  /** Duration in milliseconds */
  duration?: number;
}

/**
 * ResponseMonitor class
 * Monitors Kiro chat responses for completion indicators
 */
export class ResponseMonitor {
  private kiroInterface: KiroInterface;
  private completionIndicators: CompletionIndicators;
  private activeMonitors: Map<string, ResponseMonitoringResult> = new Map();
  private responseListeners: Array<(response: ChatMessage) => void> = [];
  private disposables: vscode.Disposable[] = [];
  private defaultTimeout: number;

  constructor(
    kiroInterface: KiroInterface,
    completionIndicators?: Partial<CompletionIndicators>,
    defaultTimeout: number = 300000 // 5 minutes
  ) {
    this.kiroInterface = kiroInterface;
    this.defaultTimeout = defaultTimeout;
    
    this.completionIndicators = {
      success: completionIndicators?.success ?? [
        'completed',
        'done',
        'finished',
        'success',
        'implemented',
        'created',
        'updated',
        'fixed',
        'resolved',
        'task complete',
        'all set',
      ],
      failure: completionIndicators?.failure ?? [
        'error',
        'failed',
        'cannot',
        'unable to',
        'could not',
        'exception',
        'crashed',
        'broken',
      ],
      inProgress: completionIndicators?.inProgress ?? [
        'working on',
        'processing',
        'in progress',
        'starting',
        'executing',
        'running',
      ],
      needsInput: completionIndicators?.needsInput ?? [
        'need more information',
        'please provide',
        'can you clarify',
        'which',
        'what',
        'how should',
        'do you want',
        'would you like',
      ],
    };

    this.setupResponseListener();
  }

  /**
   * Sets up listener for Kiro responses
   */
  private setupResponseListener(): void {
    const api = this.kiroInterface.getAPI();
    
    if (api?.onResponse) {
      const disposable = api.onResponse((response: string) => {
        this.handleResponse({
          id: this.generateResponseId(),
          content: response,
          timestamp: new Date(),
          role: 'assistant',
        });
      });
      
      if (disposable) {
        this.disposables.push(disposable);
      }
    }
  }

  /**
   * Monitors a response for completion
   * @param messageId Message ID to monitor
   * @param timeout Timeout in milliseconds
   * @returns Promise that resolves with monitoring result
   */
  async monitorResponse(
    messageId: string,
    timeout: number = this.defaultTimeout
  ): Promise<ResponseMonitoringResult> {
    const result: ResponseMonitoringResult = {
      status: ResponseStatus.PENDING,
      content: '',
      completed: false,
      success: false,
      needsInput: false,
      detectedIndicators: [],
      startTime: new Date(),
    };

    this.activeMonitors.set(messageId, result);

    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        result.status = ResponseStatus.TIMEOUT;
        result.endTime = new Date();
        result.duration = result.endTime.getTime() - result.startTime.getTime();
        this.activeMonitors.delete(messageId);
        reject(new Error(`Response monitoring timed out after ${timeout}ms`));
      }, timeout);

      // Set up response listener
      const listener = (response: ChatMessage) => {
        if (this.isResponseForMessage(response, messageId)) {
          result.content += response.content;
          
          // Check for completion
          const analysis = this.analyzeResponse(response.content);
          result.detectedIndicators.push(...analysis.indicators);
          
          if (analysis.completed) {
            result.status = analysis.success ? ResponseStatus.COMPLETED : ResponseStatus.FAILED;
            result.completed = true;
            result.success = analysis.success;
            result.needsInput = analysis.needsInput;
            result.endTime = new Date();
            result.duration = result.endTime.getTime() - result.startTime.getTime();
            
            clearTimeout(timeoutId);
            this.activeMonitors.delete(messageId);
            this.removeResponseListener(listener);
            resolve(result);
          } else if (analysis.inProgress) {
            result.status = ResponseStatus.IN_PROGRESS;
          }
        }
      };

      this.addResponseListener(listener);
    });
  }

  /**
   * Analyzes a response for completion indicators
   */
  private analyzeResponse(content: string): {
    completed: boolean;
    success: boolean;
    inProgress: boolean;
    needsInput: boolean;
    indicators: string[];
  } {
    const lowerContent = content.toLowerCase();
    const indicators: string[] = [];
    
    // Check for success indicators
    const successMatches = this.completionIndicators.success.filter(indicator =>
      lowerContent.includes(indicator.toLowerCase())
    );
    
    // Check for failure indicators
    const failureMatches = this.completionIndicators.failure.filter(indicator =>
      lowerContent.includes(indicator.toLowerCase())
    );
    
    // Check for in-progress indicators
    const inProgressMatches = this.completionIndicators.inProgress.filter(indicator =>
      lowerContent.includes(indicator.toLowerCase())
    );
    
    // Check for needs-input indicators
    const needsInputMatches = this.completionIndicators.needsInput.filter(indicator =>
      lowerContent.includes(indicator.toLowerCase())
    );

    indicators.push(...successMatches, ...failureMatches, ...inProgressMatches, ...needsInputMatches);

    // Determine completion status
    const completed = successMatches.length > 0 || failureMatches.length > 0;
    const success = successMatches.length > 0 && failureMatches.length === 0;
    const inProgress = inProgressMatches.length > 0;
    const needsInput = needsInputMatches.length > 0;

    return {
      completed,
      success,
      inProgress,
      needsInput,
      indicators,
    };
  }

  /**
   * Checks if a response is for a specific message
   */
  private isResponseForMessage(response: ChatMessage, messageId: string): boolean {
    // Simple implementation - in real scenario, would need better correlation
    // Could use message IDs, timestamps, or other correlation mechanisms
    return true; // For now, assume all responses are relevant
  }

  /**
   * Handles incoming responses
   */
  private handleResponse(response: ChatMessage): void {
    this.responseListeners.forEach(listener => {
      try {
        listener(response);
      } catch (error) {
        console.error('Error in response listener:', error);
      }
    });
  }

  /**
   * Adds a response listener
   */
  private addResponseListener(listener: (response: ChatMessage) => void): void {
    this.responseListeners.push(listener);
  }

  /**
   * Removes a response listener
   */
  private removeResponseListener(listener: (response: ChatMessage) => void): void {
    const index = this.responseListeners.indexOf(listener);
    if (index > -1) {
      this.responseListeners.splice(index, 1);
    }
  }

  /**
   * Generates a unique response ID
   */
  private generateResponseId(): string {
    return `resp-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
  }

  /**
   * Gets active monitors
   */
  getActiveMonitors(): Map<string, ResponseMonitoringResult> {
    return new Map(this.activeMonitors);
  }

  /**
   * Gets a specific monitor result
   */
  getMonitorResult(messageId: string): ResponseMonitoringResult | undefined {
    return this.activeMonitors.get(messageId);
  }

  /**
   * Cancels monitoring for a message
   */
  cancelMonitoring(messageId: string): void {
    this.activeMonitors.delete(messageId);
  }

  /**
   * Cancels all active monitoring
   */
  cancelAllMonitoring(): void {
    this.activeMonitors.clear();
  }

  /**
   * Updates completion indicators
   */
  updateCompletionIndicators(indicators: Partial<CompletionIndicators>): void {
    this.completionIndicators = {
      ...this.completionIndicators,
      ...indicators,
    };
  }

  /**
   * Gets current completion indicators
   */
  getCompletionIndicators(): CompletionIndicators {
    return { ...this.completionIndicators };
  }

  /**
   * Adds custom completion indicators
   */
  addCompletionIndicators(type: keyof CompletionIndicators, indicators: string[]): void {
    this.completionIndicators[type].push(...indicators);
  }

  /**
   * Removes completion indicators
   */
  removeCompletionIndicators(type: keyof CompletionIndicators, indicators: string[]): void {
    this.completionIndicators[type] = this.completionIndicators[type].filter(
      indicator => !indicators.includes(indicator)
    );
  }

  /**
   * Sets default timeout
   */
  setDefaultTimeout(timeout: number): void {
    this.defaultTimeout = timeout;
  }

  /**
   * Gets default timeout
   */
  getDefaultTimeout(): number {
    return this.defaultTimeout;
  }

  /**
   * Polls for response completion (alternative to event-based monitoring)
   * @param messageId Message ID to poll for
   * @param pollInterval Interval between polls in milliseconds
   * @param timeout Total timeout in milliseconds
   * @returns Promise that resolves with monitoring result
   */
  async pollForCompletion(
    messageId: string,
    pollInterval: number = 2000,
    timeout: number = this.defaultTimeout
  ): Promise<ResponseMonitoringResult> {
    const result: ResponseMonitoringResult = {
      status: ResponseStatus.PENDING,
      content: '',
      completed: false,
      success: false,
      needsInput: false,
      detectedIndicators: [],
      startTime: new Date(),
    };

    const startTime = Date.now();

    while (Date.now() - startTime < timeout) {
      try {
        // Try to get chat history
        const api = this.kiroInterface.getAPI();
        if (api?.getChatHistory) {
          const history = await api.getChatHistory();
          
          // Get latest response
          const latestResponse = history[history.length - 1];
          if (latestResponse && latestResponse.role === 'assistant') {
            result.content = latestResponse.content;
            
            // Analyze response
            const analysis = this.analyzeResponse(latestResponse.content);
            result.detectedIndicators = analysis.indicators;
            
            if (analysis.completed) {
              result.status = analysis.success ? ResponseStatus.COMPLETED : ResponseStatus.FAILED;
              result.completed = true;
              result.success = analysis.success;
              result.needsInput = analysis.needsInput;
              result.endTime = new Date();
              result.duration = result.endTime.getTime() - result.startTime.getTime();
              return result;
            } else if (analysis.inProgress) {
              result.status = ResponseStatus.IN_PROGRESS;
            }
          }
        }
      } catch (error) {
        console.warn('Error polling for completion:', error);
      }

      // Wait before next poll
      await new Promise(resolve => setTimeout(resolve, pollInterval));
    }

    // Timeout reached
    result.status = ResponseStatus.TIMEOUT;
    result.endTime = new Date();
    result.duration = result.endTime.getTime() - result.startTime.getTime();
    throw new Error(`Polling timed out after ${timeout}ms`);
  }

  /**
   * Disposes of resources
   */
  dispose(): void {
    this.cancelAllMonitoring();
    this.disposables.forEach(d => d.dispose());
    this.disposables = [];
    this.responseListeners = [];
  }
}

/**
 * Creates a ResponseMonitor instance
 */
export function createResponseMonitor(
  kiroInterface: KiroInterface,
  completionIndicators?: Partial<CompletionIndicators>,
  defaultTimeout?: number
): ResponseMonitor {
  return new ResponseMonitor(kiroInterface, completionIndicators, defaultTimeout);
}
