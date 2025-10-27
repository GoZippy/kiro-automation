import * as assert from 'assert';
import { KiroInterface } from '../../src/KiroInterface';
import { MockKiroInterface } from '../fixtures/mocks/MockKiroInterface';
import { delay, waitFor } from '../helpers/testUtils';

suite('Integration: Kiro API', () => {
  let kiroInterface: MockKiroInterface;

  setup(() => {
    kiroInterface = new MockKiroInterface();
  });

  teardown(() => {
    kiroInterface.dispose();
  });

  test('should connect to Kiro API', async () => {
    assert.strictEqual(kiroInterface.isConnected(), false);

    await kiroInterface.connect();

    assert.strictEqual(kiroInterface.isConnected(), true);
  });

  test('should send messages to Kiro chat', async () => {
    await kiroInterface.connect();

    const response = await kiroInterface.sendMessage('Test message');

    assert.strictEqual(response.success, true);
    assert.ok(response.message);
    assert.ok(response.duration !== undefined);
  });

  test('should handle connection failures', async () => {
    try {
      await kiroInterface.sendMessage('Test without connection');
      assert.fail('Should have thrown error');
    } catch (error) {
      assert.ok(error instanceof Error);
      assert.ok(error.message.includes('Not connected'));
    }
  });

  test('should track message history', async () => {
    await kiroInterface.connect();

    await kiroInterface.sendMessage('Message 1');
    await kiroInterface.sendMessage('Message 2');
    await kiroInterface.sendMessage('Message 3');

    const history = kiroInterface.getMessageHistory();
    assert.strictEqual(history.length, 3);
    assert.strictEqual(history[0], 'Message 1');
    assert.strictEqual(history[1], 'Message 2');
    assert.strictEqual(history[2], 'Message 3');
  });

  test('should emit response events', async () => {
    await kiroInterface.connect();

    let responseReceived = false;
    kiroInterface.once('response', (response) => {
      responseReceived = true;
      assert.ok(response.success);
    });

    await kiroInterface.sendMessage('Test message');

    assert.strictEqual(responseReceived, true);
  });

  test('should handle API rate limiting', async function () {
    this.timeout(5000);

    await kiroInterface.connect();
    kiroInterface.setResponseDelay(100);

    const startTime = Date.now();
    const promises = [];

    for (let i = 0; i < 5; i++) {
      promises.push(kiroInterface.sendMessage(`Message ${i}`));
    }

    await Promise.all(promises);
    const duration = Date.now() - startTime;

    // Should take at least 500ms (5 messages * 100ms delay)
    assert.ok(duration >= 400, 'Rate limiting should introduce delays');
  });

  test('should handle disconnection and reconnection', async () => {
    await kiroInterface.connect();
    assert.strictEqual(kiroInterface.isConnected(), true);

    kiroInterface.simulateDisconnect();
    assert.strictEqual(kiroInterface.isConnected(), false);

    kiroInterface.simulateReconnect();
    assert.strictEqual(kiroInterface.isConnected(), true);

    // Should be able to send messages after reconnection
    const response = await kiroInterface.sendMessage('After reconnect');
    assert.strictEqual(response.success, true);
  });

  test('should execute tasks with context', async () => {
    await kiroInterface.connect();

    const prompt = 'Implement feature X according to requirements';
    const response = await kiroInterface.executeTask('task-1', prompt);

    assert.strictEqual(response.success, true);
    assert.strictEqual(response.taskId, 'task-1');
    assert.ok(response.message);
  });

  test('should handle API failures gracefully', async () => {
    await kiroInterface.connect();
    kiroInterface.setFailureRate(1.0); // 100% failure rate

    try {
      await kiroInterface.sendMessage('This will fail');
      assert.fail('Should have thrown error');
    } catch (error) {
      assert.ok(error instanceof Error);
      assert.ok(error.message.includes('Simulated Kiro API failure'));
    }
  });

  test('should clear message history', async () => {
    await kiroInterface.connect();

    await kiroInterface.sendMessage('Message 1');
    await kiroInterface.sendMessage('Message 2');

    assert.strictEqual(kiroInterface.getMessageHistory().length, 2);

    kiroInterface.clearMessageHistory();

    assert.strictEqual(kiroInterface.getMessageHistory().length, 0);
  });
});
