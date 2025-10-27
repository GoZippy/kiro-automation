import * as assert from 'assert';
import * as vscode from 'vscode';

suite('Extension Test Suite', () => {
  vscode.window.showInformationMessage('Start all tests.');

  test('Extension should be present', () => {
    assert.ok(vscode.extensions.getExtension('kiro.kiro-automation-extension'));
  });

  test('Commands should be registered', async () => {
    const commands = await vscode.commands.getCommands(true);
    assert.ok(commands.includes('kiro-automation.start'));
    assert.ok(commands.includes('kiro-automation.stop'));
    assert.ok(commands.includes('kiro-automation.pause'));
    assert.ok(commands.includes('kiro-automation.resume'));
    assert.ok(commands.includes('kiro-automation.showPanel'));
    assert.ok(commands.includes('kiro-automation.nextTask'));
  });
});
