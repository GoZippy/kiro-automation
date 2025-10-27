import * as assert from 'assert';
import { ConfigManager } from '../../src/ConfigManager';

suite('Integration: Configuration Management', () => {
  let configManager: ConfigManager;

  setup(() => {
    configManager = new ConfigManager();
  });

  teardown(() => {
    configManager.dispose();
  });

  test('should get default configuration values', () => {
    const enabled = configManager.get('enabled', true);
    const concurrency = configManager.get('concurrency', 1);
    const retryAttempts = configManager.get('retryAttempts', 3);

    assert.strictEqual(typeof enabled, 'boolean');
    assert.strictEqual(typeof concurrency, 'number');
    assert.strictEqual(typeof retryAttempts, 'number');
  });

  test('should update configuration values', async () => {
    await configManager.update('concurrency', 5);
    const value = configManager.get('concurrency', 1);
    assert.strictEqual(value, 5);
  });

  test('should validate configuration values', () => {
    // Valid values
    assert.strictEqual(configManager.validate('concurrency', 5), true);
    assert.strictEqual(configManager.validate('retryAttempts', 3), true);
    assert.strictEqual(configManager.validate('timeout', 60000), true);

    // Invalid values
    assert.strictEqual(configManager.validate('concurrency', -1), false);
    assert.strictEqual(configManager.validate('concurrency', 100), false);
    assert.strictEqual(configManager.validate('timeout', 100), false);
  });

  test('should emit change events', async () => {
    let changeDetected = false;
    let changedKey = '';

    configManager.on('configChanged', (key, value) => {
      changeDetected = true;
      changedKey = key;
    });

    await configManager.update('taskDelay', 5000);

    assert.strictEqual(changeDetected, true);
    assert.strictEqual(changedKey, 'taskDelay');
  });

  test('should get all configuration', () => {
    const config = configManager.getAll();

    assert.ok(config);
    assert.ok('enabled' in config);
    assert.ok('concurrency' in config);
    assert.ok('retryAttempts' in config);
  });

  test('should reset to defaults', async () => {
    await configManager.update('concurrency', 10);
    assert.strictEqual(configManager.get('concurrency', 1), 10);

    await configManager.reset('concurrency');
    const value = configManager.get('concurrency', 1);
    assert.ok(value !== 10);
  });

  test('should handle workspace-specific configuration', () => {
    const workspaceConfig = configManager.getWorkspaceConfig();
    const globalConfig = configManager.getGlobalConfig();

    assert.ok(workspaceConfig !== undefined);
    assert.ok(globalConfig !== undefined);
  });

  test('should merge workspace and global configuration', () => {
    const merged = configManager.getMergedConfig();

    assert.ok(merged);
    assert.ok(typeof merged.enabled === 'boolean');
    assert.ok(typeof merged.concurrency === 'number');
  });
});
