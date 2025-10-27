import * as assert from 'assert';
import * as vscode from 'vscode';
import { KiroInterface, KiroAPI, ChatMessage } from '../../src/KiroInterface';
import { ChatMessageSender } from '../../src/ChatMessageSender';
import { ResponseMonitor, ResponseStatus } from '../../src/ResponseMonitor';
import { PromptGenerator } from '../../src/PromptGenerator';
import { Task, TaskStatus } from '../../src/models/Task';
import { SpecificationContext } from '../../src/models/ExecutionContext';

/**
 * Mock Kiro API for testing
 */
class MockKiroAPI implements KiroAPI {
  private messages: ChatMessage[] = [];
  private responseCallbacks: Array<(response: string) => void> = [];
  public connected = true;

  async sendChatMessage(message: string): Promise<string> {
    const chatMessage: ChatMessage = {
      id: `msg-${Date.now()}`,
      content: message,
      timestamp: new Date(),
      role: 'user',
    };
    
    this.messages.push(chatMessage);
    
    // Simulate response
    const response = `Received: ${message}`;
    const responseMessage: ChatMessage = {
      id: `resp-${Date.now()}`,
      content: response,
      timestamp: new Date(),
      role: 'assistant',
    };
    
    this.messages.push(responseMessage);
    
    // Notify callbacks
    this.responseCallbacks.forEach(cb => cb(response));
    
    return response;
  }

  async getChatHistory(): Promise<ChatMessage[]> {
    return [...this.messages];
  }

  isConnected(): boolean {
    return this.connected;
  }

  onResponse(callback: (response: string) => void): vscode.Disposable {
    this.responseCallbacks.push(callback);
    return new vscode.Disposable(() => {
      const index = this.responseCallbacks.indexOf(callback);
      if (index > -1) {
        this.responseCallbacks.splice(index, 1);
      }
    });
  }

  simulateResponse(content: string): void {
    const message: ChatMessage = {
      id: `sim-${Date.now()}`,
      content,
      timestamp: new Date(),
      role: 'assistant',
    };
    
    this.messages.push(message);
    this.responseCallbacks.forEach(cb => cb(content));
  }

  clearHistory(): void {
    this.messages = [];
  }
}

suite('KiroInterface Test Suite', () => {
  let kiroInterface: KiroInterface;

  setup(() => {
    kiroInterface = new KiroInterface();
  });

  teardown(() => {
    kiroInterface.dispose();
  });

  test('Should initialize and discover Kiro', async () => {
    const result = await kiroInterface.initialize();
    
    assert.ok(result);
    assert.ok(typeof result.found === 'boolean');
    assert.ok(Array.isArray(result.availableMethods));
  });

  test('Should check if Kiro is available', async () => {
    await kiroInterface.initialize();
    const isAvailable = kiroInterface.isAvailable();
    
    assert.ok(typeof isAvailable === 'boolean');
  });

  test('Should get available methods', async () => {
    await kiroInterface.initialize();
    const methods = kiroInterface.getAvailableMethods();
    
    assert.ok(Array.isArray(methods));
  });

  test('Should get discovery approach', async () => {
    await kiroInterface.initialize();
    const approach = kiroInterface.getDiscoveryApproach();
    
    if (approach) {
      assert.ok(['extension-api', 'commands', 'webview', 'filesystem'].includes(approach));
    }
  });
});

suite('ChatMessageSender Test Suite', () => {
  let mockAPI: MockKiroAPI;
  let kiroInterface: KiroInterface;
  let messageSender: ChatMessageSender;

  setup(() => {
    mockAPI = new MockKiroAPI();
    kiroInterface = new KiroInterface();
    // Inject mock API
    (kiroInterface as any).kiroAPI = mockAPI;
    (kiroInterface as any).discoveryResult = {
      found: true,
      availableMethods: ['sendChatMessage'],
      approach: 'extension-api',
    };
    
    messageSender = new ChatMessageSender(kiroInterface);
  });

  teardown(() => {
    messageSender.dispose();
    kiroInterface.dispose();
  });

  test('Should send a message', async () => {
    const response = await messageSender.sendMessage('Test message');
    
    assert.ok(response);
    assert.ok(response.includes('Test message'));
  });

  test('Should queue multiple messages', async () => {
    const promises = [
      messageSender.sendMessage('Message 1'),
      messageSender.sendMessage('Message 2'),
      messageSender.sendMessage('Message 3'),
    ];
    
    const responses = await Promise.all(promises);
    
    assert.strictEqual(responses.length, 3);
    responses.forEach(response => assert.ok(response));
  });

  test('Should respect priority in queue', async () => {
    const responses: string[] = [];
    
    // Send low priority message
    messageSender.sendMessage('Low priority', 0).then(r => responses.push(r));
    
    // Send high priority message
    messageSender.sendMessage('High priority', 10).then(r => responses.push(r));
    
    // Wait for processing
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    // High priority should be processed first
    assert.ok(responses[0].includes('High priority'));
  });

  test('Should handle rate limiting', async () => {
    // Update rate limiter to very restrictive
    messageSender.updateRateLimiterConfig({
      maxMessages: 2,
      timeWindow: 10000,
    });
    
    // Send messages
    await messageSender.sendMessage('Message 1');
    await messageSender.sendMessage('Message 2');
    
    // Should be rate limited now
    assert.ok(messageSender.isRateLimited());
  });

  test('Should get queue length', () => {
    messageSender.sendMessage('Message 1');
    messageSender.sendMessage('Message 2');
    
    const queueLength = messageSender.getQueueLength();
    assert.ok(queueLength >= 0);
  });

  test('Should clear queue', () => {
    messageSender.sendMessage('Message 1');
    messageSender.sendMessage('Message 2');
    
    messageSender.clearQueue();
    
    assert.strictEqual(messageSender.getQueueLength(), 0);
  });
});

suite('ResponseMonitor Test Suite', () => {
  let mockAPI: MockKiroAPI;
  let kiroInterface: KiroInterface;
  let responseMonitor: ResponseMonitor;

  setup(() => {
    mockAPI = new MockKiroAPI();
    kiroInterface = new KiroInterface();
    (kiroInterface as any).kiroAPI = mockAPI;
    (kiroInterface as any).discoveryResult = {
      found: true,
      availableMethods: ['sendChatMessage', 'getChatHistory'],
      approach: 'extension-api',
    };
    
    responseMonitor = new ResponseMonitor(kiroInterface, undefined, 5000);
  });

  teardown(() => {
    responseMonitor.dispose();
    kiroInterface.dispose();
  });

  test('Should detect completion indicators', async () => {
    const messageId = 'test-msg-1';
    
    // Start monitoring
    const monitorPromise = responseMonitor.monitorResponse(messageId, 5000);
    
    // Simulate response with completion indicator
    setTimeout(() => {
      mockAPI.simulateResponse('Task completed successfully');
    }, 100);
    
    const result = await monitorPromise;
    
    assert.strictEqual(result.completed, true);
    assert.strictEqual(result.success, true);
  });

  test('Should detect failure indicators', async () => {
    const messageId = 'test-msg-2';
    
    const monitorPromise = responseMonitor.monitorResponse(messageId, 5000);
    
    setTimeout(() => {
      mockAPI.simulateResponse('Error: Task failed to execute');
    }, 100);
    
    const result = await monitorPromise;
    
    assert.strictEqual(result.completed, true);
    assert.strictEqual(result.success, false);
  });

  test('Should timeout if no completion detected', async () => {
    const messageId = 'test-msg-3';
    
    try {
      await responseMonitor.monitorResponse(messageId, 1000);
      assert.fail('Should have timed out');
    } catch (error) {
      assert.ok(error instanceof Error);
      assert.ok((error as Error).message.includes('timed out'));
    }
  });

  test('Should poll for completion', async () => {
    mockAPI.simulateResponse('Task completed');
    
    const result = await responseMonitor.pollForCompletion('test-msg-4', 500, 3000);
    
    assert.strictEqual(result.completed, true);
  });

  test('Should update completion indicators', () => {
    responseMonitor.addCompletionIndicators('success', ['custom-success']);
    
    const indicators = responseMonitor.getCompletionIndicators();
    assert.ok(indicators.success.includes('custom-success'));
  });

  test('Should cancel monitoring', () => {
    const messageId = 'test-msg-5';
    responseMonitor.monitorResponse(messageId, 5000);
    
    responseMonitor.cancelMonitoring(messageId);
    
    const result = responseMonitor.getMonitorResult(messageId);
    assert.strictEqual(result, undefined);
  });
});

suite('PromptGenerator Test Suite', () => {
  let promptGenerator: PromptGenerator;
  let mockTask: Task;
  let mockSpec: SpecificationContext;

  setup(() => {
    promptGenerator = new PromptGenerator();
    
    mockTask = {
      id: '1',
      title: 'Test Task',
      status: TaskStatus.PENDING,
      subtasks: [
        {
          id: '1.1',
          title: 'Subtask 1',
          description: ['Do something'],
          status: TaskStatus.PENDING,
          optional: false,
        },
      ],
      requirements: ['Req 1', 'Req 2'],
      specName: 'test-spec',
      filePath: '/path/to/tasks.md',
      lineNumber: 10,
    };
    
    mockSpec = {
      name: 'test-spec',
      requirements: '# Requirements\n\nTest requirements',
      design: '# Design\n\nTest design',
      tasksFile: '/path/to/tasks.md',
      basePath: '/path/to/spec',
    };
  });

  test('Should generate basic prompt', async () => {
    const prompt = await promptGenerator.generatePrompt(mockTask, mockSpec, {
      includeRequirements: false,
      includeDesign: false,
    });
    
    assert.ok(prompt.includes(mockTask.id));
    assert.ok(prompt.includes(mockTask.title));
  });

  test('Should include subtasks in prompt', async () => {
    const prompt = await promptGenerator.generatePrompt(mockTask, mockSpec, {
      includeSubtasks: true,
      includeRequirements: false,
      includeDesign: false,
    });
    
    assert.ok(prompt.includes('1.1'));
    assert.ok(prompt.includes('Subtask 1'));
  });

  test('Should generate minimal prompt', async () => {
    const prompt = await promptGenerator.generateMinimalPrompt(mockTask);
    
    assert.ok(prompt.includes(mockTask.id));
    assert.ok(prompt.includes(mockTask.title));
    assert.ok(prompt.length < 100);
  });

  test('Should generate retry prompt', async () => {
    const prompt = await promptGenerator.generateRetryPrompt(
      mockTask,
      mockSpec,
      'Previous error message',
      2
    );
    
    assert.ok(prompt.includes('retry'));
    assert.ok(prompt.includes('Previous error message'));
  });

  test('Should validate template', () => {
    const validTemplate = 'Task: {taskId} - {taskTitle}';
    const result = promptGenerator.validateTemplate(validTemplate);
    
    assert.strictEqual(result.valid, true);
    assert.strictEqual(result.errors.length, 0);
  });

  test('Should detect invalid template', () => {
    const invalidTemplate = 'Task: {taskId - missing closing brace';
    const result = promptGenerator.validateTemplate(invalidTemplate);
    
    assert.strictEqual(result.valid, false);
    assert.ok(result.errors.length > 0);
  });

  test('Should extract template variables', () => {
    const template = 'Task: {taskId} - {taskTitle} in {specName}';
    const variables = promptGenerator.extractTemplateVariables(template);
    
    assert.ok(variables.includes('taskId'));
    assert.ok(variables.includes('taskTitle'));
    assert.ok(variables.includes('specName'));
  });

  test('Should truncate long prompts', async () => {
    const prompt = await promptGenerator.generatePrompt(mockTask, mockSpec, {
      maxLength: 100,
    });
    
    assert.ok(prompt.length <= 150); // Allow some buffer for truncation message
  });
});
