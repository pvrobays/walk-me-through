import * as assert from 'node:assert/strict';
import * as vscode from 'vscode';

suite('Activation', () => {
  test('activates the development extension', async () => {
    const extension = vscode.extensions.getExtension('pvrobays.walk-me-through');
    assert.ok(extension);
    await extension.activate();
    assert.equal(extension.isActive, true);
  });
});
