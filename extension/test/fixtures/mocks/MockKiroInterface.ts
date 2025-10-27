import { EventEmitter } from 'events';

export interface MockKiroResponse {
  success: boolean;
  message: string;
  taskId?: string;
  duration?: number;
}

export class MockKiroInterface extends EventEmitter {
  private connected: boolean = false;
  private responseDelay: number = 100;
  private failureRate: number = 0;
  private messageHistory: string[] = [];

  constructor(options?: {
    responseDelay?: number;
    failureRate?: number;
    autoConnect?: boolean;
  }) {
    super();
    if (options?.responseDelay !== undefined) {
      this.responseDelay = options.responseDelay;
    }
    if (options?.failureRate !== undefined) {
      this.failureRate = options.failureRate;
    }
    if (options?.autoConnect) {
      this.connected = true;
    }
  }

  async connect(): Promise<void> {
    await this.delay(50);
    this.connected = true;
    this.emit('connected');
  }

  async disconnect(): Promise<void> {
    await this.delay(50);
    this.connected = false;
    this.emit('disconnected');
  }

  isConnected(): boolean {
    return this.connected;
  }

  async sendMessage(message: string): Promise<MockKiroResponse> {
    if (!this.connected) {
      throw new Error('Not connected to Kiro');
    }

    this.messageHistory.push(message);
    await this.delay(this.responseDelay);

    // Simulate random failures based on failure rate
    if (Math.random() < this.failureRate) {
      throw new Error('Simulated Kiro API failure');
    }

    const response: MockKiroResponse = {
      success: true,
      message: `Processed: ${message.substring(0, 50)}...`,
      duration: this.responseDelay,
    };

    this.emit('response', response);
    return response;
  }

  async executeTask(taskId: string, prompt: string): Promise<MockKiroResponse> {
    const response = await this.sendMessage(prompt);
    return {
      ...response,
      taskId,
    };
  }

  getMessageHistory(): string[] {
    return [...this.messageHistory];
  }

  clearMessageHistory(): void {
    this.messageHistory = [];
  }

  setResponseDelay(delay: number): void {
    this.responseDelay = delay;
  }

  setFailureRate(rate: number): void {
    this.failureRate = Math.max(0, Math.min(1, rate));
  }

  simulateDisconnect(): void {
    this.connected = false;
    this.emit('disconnected');
  }

  simulateReconnect(): void {
    this.connected = true;
    this.emit('connected');
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  dispose(): void {
    this.removeAllListeners();
    this.messageHistory = [];
    this.connected = false;
  }
}
