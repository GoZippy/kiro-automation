import * as vscode from 'vscode';
import { KiroInterface } from './KiroInterface';

/**
 * Message queue item
 */
interface QueuedMessage {
  id: string;
  content: string;
  priority: number;
  timestamp: Date;
  retries: number;
  resolve: (value: string) => void;
  reject: (error: Error) => void;
}

/**
 * Rate limiter configuration
 */
interface RateLimiterConfig {
  /** Maximum messages per time window */
  maxMessages: number;
  
  /** Time window in milliseconds */
  timeWindow: number;
  
  /** Minimum delay between messages in milliseconds */
  minDelay: number;
}

/**
 * ChatMessageSender class
 * Handles sending messages to Kiro chat with queuing, rate limiting, and retry logic
 */
export class ChatMessageSender {
  private kiroInterface: KiroInterface;
  private messageQueue: QueuedMessage[] = [];
  private isProcessing = false;
  private messageHistory: Date[] = [];
  private rateLimiter: RateLimiterConfig;
  private sessionId?: string;
  private disposables: vscode.Disposable[] = [];

  constructor(
    kiroInterface: KiroInterface,
    rateLimiter?: Partial<RateLimiterConfig>
  ) {
    this.kiroInterface = kiroInterface;
    this.rateLimiter = {
      maxMessages: rateLimiter?.maxMessages ?? 10,
      timeWindow: rateLimiter?.timeWindow ?? 60000, // 1 minute
      minDelay: rateLimiter?.minDelay ?? 2000, // 2 seconds
    };
  }

  /**
   * Sends a message to Kiro chat
   * @param content Message content
   * @param priority Priority level (higher = more urgent)
   * @returns Promise that resolves with the response
   */
  async sendMessage(content: string, priority: number = 0): Promise<string> {
    return new Promise((resolve, reject) => {
      const message: QueuedMessage = {
        id: this.generateMessageId(),
        content,
        priority,
        timestamp: new Date(),
        retries: 0,
        resolve,
        reject,
      };

      // Add to queue
      this.messageQueue.push(message);
      
      // Sort by priority (higher priority first)
      this.messageQueue.sort((a, b) => b.priority - a.priority);

      // Start processing if not already running
      if (!this.isProcessing) {
        this.processQueue();
      }
    });
  }

  /**
   * Processes the message queue
   */
  private async processQueue(): Promise<void> {
    if (this.isProcessing || this.messageQueue.length === 0) {
      return;
    }

    this.isProcessing = true;

    while (this.messageQueue.length > 0) {
      // Check rate limit
      if (!this.canSendMessage()) {
        const waitTime = this.getWaitTime();
        await this.delay(waitTime);
        continue;
      }

      // Get next message
      const message = this.messageQueue.shift();
      if (!message) {
        break;
      }

      try {
        // Send the message
        const response = await this.sendMessageInternal(message);
        message.resolve(response);
        
        // Record message timestamp for rate limiting
        this.messageHistory.push(new Date());
        
        // Wait minimum delay before next message
        await this.delay(this.rateLimiter.minDelay);
      } catch (error) {
        // Handle retry logic
        if (message.retries < 3) {
          message.retries++;
          this.messageQueue.unshift(message); // Add back to front of queue
          await this.delay(this.getRetryDelay(message.retries));
        } else {
          message.reject(error as Error);
        }
      }
    }

    this.isProcessing = false;
  }

  /**
   * Sends a message internally using available Kiro API
   */
  private async sendMessageInternal(message: QueuedMessage): Promise<string> {
    if (!this.kiroInterface.isAvailable()) {
      throw new Error('Kiro interface not available');
    }

    // Try different approaches to send the message
    const approaches = [
      () => this.sendViaAPI(message.content),
      () => this.sendViaCommand(message.content),
      () => this.sendViaClipboard(message.content),
    ];

    let lastError: Error | undefined;

    for (const approach of approaches) {
      try {
        return await approach();
      } catch (error) {
        lastError = error as Error;
        console.warn('Send approach failed, trying next:', error);
      }
    }

    throw lastError || new Error('All send approaches failed');
  }

  /**
   * Sends message via Kiro API
   */
  private async sendViaAPI(content: string): Promise<string> {
    const api = this.kiroInterface.getAPI();
    
    if (api?.sendChatMessage) {
      return await api.sendChatMessage(content);
    }

    // Try alternative API methods
    if (this.kiroInterface.hasMethod('chat.send')) {
      return await this.kiroInterface.callAPI('chat.send', content);
    }

    if (this.kiroInterface.hasMethod('sendMessage')) {
      return await this.kiroInterface.callAPI('sendMessage', content);
    }

    throw new Error('No API method available for sending messages');
  }

  /**
   * Sends message via VS Code command
   */
  private async sendViaCommand(content: string): Promise<string> {
    // Try common Kiro command patterns
    const possibleCommands = [
      'kiro.sendMessage',
      'kiro.chat.send',
      'kiro.sendChatMessage',
      'kiro-chat.send',
    ];

    for (const command of possibleCommands) {
      if (await this.kiroInterface.hasCommand(command)) {
        await this.kiroInterface.executeCommand(command, content);
        return 'Message sent via command';
      }
    }

    throw new Error('No command available for sending messages');
  }

  /**
   * Sends message via clipboard (fallback method)
   * Copies message to clipboard and triggers Kiro chat focus
   */
  private async sendViaClipboard(content: string): Promise<string> {
    // Copy to clipboard
    await vscode.env.clipboard.writeText(content);
    
    // Try to focus Kiro chat
    const focusCommands = [
      'kiro.focusChat',
      'kiro.chat.focus',
      'kiro.showChat',
    ];

    for (const command of focusCommands) {
      if (await this.kiroInterface.hasCommand(command)) {
        await this.kiroInterface.executeCommand(command);
        
        // Show notification to user
        vscode.window.showInformationMessage(
          'Message copied to clipboard. Please paste into Kiro chat.'
        );
        
        return 'Message copied to clipboard';
      }
    }

    throw new Error('Could not focus Kiro chat for clipboard paste');
  }

  /**
   * Checks if a message can be sent based on rate limits
   */
  private canSendMessage(): boolean {
    // Clean up old message timestamps
    const now = new Date();
    this.messageHistory = this.messageHistory.filter(
      timestamp => now.getTime() - timestamp.getTime() < this.rateLimiter.timeWindow
    );

    // Check if under rate limit
    return this.messageHistory.length < this.rateLimiter.maxMessages;
  }

  /**
   * Gets the wait time before next message can be sent
   */
  private getWaitTime(): number {
    if (this.messageHistory.length === 0) {
      return 0;
    }

    const now = new Date();
    const oldestMessage = this.messageHistory[0];
    const timeSinceOldest = now.getTime() - oldestMessage.getTime();
    
    return Math.max(0, this.rateLimiter.timeWindow - timeSinceOldest);
  }

  /**
   * Gets retry delay based on retry count (exponential backoff)
   */
  private getRetryDelay(retryCount: number): number {
    return Math.min(1000 * Math.pow(2, retryCount), 30000); // Max 30 seconds
  }

  /**
   * Delays execution for specified milliseconds
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Generates a unique message ID
   */
  private generateMessageId(): string {
    return `msg-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
  }

  /**
   * Sets the session ID for authentication
   */
  setSessionId(sessionId: string): void {
    this.sessionId = sessionId;
  }

  /**
   * Gets the session ID
   */
  getSessionId(): string | undefined {
    return this.sessionId;
  }

  /**
   * Gets the current queue length
   */
  getQueueLength(): number {
    return this.messageQueue.length;
  }

  /**
   * Checks if the queue is processing
   */
  isQueueProcessing(): boolean {
    return this.isProcessing;
  }

  /**
   * Clears the message queue
   */
  clearQueue(): void {
    // Reject all pending messages
    this.messageQueue.forEach(message => {
      message.reject(new Error('Queue cleared'));
    });
    
    this.messageQueue = [];
  }

  /**
   * Gets rate limiter configuration
   */
  getRateLimiterConfig(): RateLimiterConfig {
    return { ...this.rateLimiter };
  }

  /**
   * Updates rate limiter configuration
   */
  updateRateLimiterConfig(config: Partial<RateLimiterConfig>): void {
    this.rateLimiter = {
      ...this.rateLimiter,
      ...config,
    };
  }

  /**
   * Gets message history count in current time window
   */
  getMessageHistoryCount(): number {
    const now = new Date();
    return this.messageHistory.filter(
      timestamp => now.getTime() - timestamp.getTime() < this.rateLimiter.timeWindow
    ).length;
  }

  /**
   * Checks if rate limit is reached
   */
  isRateLimited(): boolean {
    return !this.canSendMessage();
  }

  /**
   * Gets time until rate limit resets
   */
  getTimeUntilRateLimitReset(): number {
    if (!this.isRateLimited()) {
      return 0;
    }
    return this.getWaitTime();
  }

  /**
   * Disposes of resources
   */
  dispose(): void {
    this.clearQueue();
    this.disposables.forEach(d => d.dispose());
    this.disposables = [];
    this.messageHistory = [];
  }
}

/**
 * Creates a ChatMessageSender instance
 */
export function createChatMessageSender(
  kiroInterface: KiroInterface,
  rateLimiter?: Partial<RateLimiterConfig>
): ChatMessageSender {
  return new ChatMessageSender(kiroInterface, rateLimiter);
}
