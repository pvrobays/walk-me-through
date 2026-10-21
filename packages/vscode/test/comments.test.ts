import * as assert from 'node:assert/strict';
import * as vscode from 'vscode';
import { Comments } from '../src/comments';
import { codeStep } from '../../core/test/fixtures';

suite('Markdown comments', () => {
  test('creates read-only untrusted threads with exact ranges and uncertainty notices', async () => {
    const comments = new Comments();
    try {
      const document = await vscode.workspace.openTextDocument({ content: 'const value = 1;', language: 'typescript' });
      const range = new vscode.Range(0, 6, 0, 11); const step = codeStep(); step.explanation = '**bold** and `code`';
      comments.show(document.uri, range, step, 1, 3, { state: 'uncertain', tie: true, candidateCount: 2 });
      assert.equal(comments.thread!.canReply, false);
      assert.equal(comments.thread!.label, 'Step 1 of 3');
      assert.ok(comments.thread!.range!.isEqual(range));
      const body = comments.thread!.comments[0].body as vscode.MarkdownString;
      assert.equal(body.isTrusted, false); assert.equal(body.supportHtml, false); assert.equal(body.supportThemeIcons, true);
      assert.ok(body.value.includes(step.explanation)); assert.ok(body.value.includes('Equally near matches; the earlier one is shown.'));
      assert.ok(body.value.startsWith('$(warning) Uncertain location: Original location unconfirmed; showing the closest identical code.'));
      assert.doesNotMatch(body.value, /\*\*Uncertain|\n---\n/);
      comments.show(document.uri, range, step, 1, 3, { state: 'uncertain', tie: false, candidateCount: 1 });
      const ordinary = comments.thread!.comments[0].body as vscode.MarkdownString;
      assert.ok(ordinary.value.startsWith('$(warning) Uncertain location:'));
      assert.ok(ordinary.value.endsWith(`\n\n${step.explanation}`));
      assert.doesNotMatch(ordinary.value, /Equally near|\*\*Uncertain|\n---\n/);
      assert.equal(ordinary.isTrusted, false); assert.equal(ordinary.supportHtml, false);
      comments.clear(); assert.equal(comments.getState(), undefined);
    } finally { comments.dispose(); }
  });
});
