import * as assert from 'node:assert/strict';
import * as vscode from 'vscode';
import { Highlights } from '../src/highlights';

suite('Source highlights', () => {
  test('retains exact expression and multiline ranges and uncertain styles, then clears', async () => {
    const highlights = new Highlights();
    try {
      const document = await vscode.workspace.openTextDocument({ content: 'const value = 1;\nrun(value);' });
      await vscode.window.showTextDocument(document);
      for (const [range, style] of [[new vscode.Range(0, 6, 0, 11), 'confident'], [new vscode.Range(0, 6, 1, 3), 'confident'], [new vscode.Range(0, 6, 0, 11), 'uncertain']] as const) {
        highlights.show(document.uri, range, style);
        assert.ok(highlights.getState()!.range.isEqual(range)); assert.equal(highlights.getState()!.style, style);
      }
      highlights.clear(); assert.equal(highlights.getState(), undefined);
    } finally { highlights.dispose(); }
  });
});
