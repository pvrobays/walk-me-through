import * as assert from 'node:assert/strict';
import * as vscode from 'vscode';
import { Session } from '../src/session';
import { StepsTree } from '../src/tree';
import { fixture, codeStep } from '../../core/test/fixtures';

suite('Nested outline', () => {
  test('provides parent links, direct level-three navigation and depth-first Next from collapsed parents', async () => {
    // The activated extension owns the real view; exercise another provider without creating a duplicate view.
    const session = new Session(); const artifact = fixture();
    artifact.steps = [codeStep(), codeStep('s2', 's1'), codeStep('s3', 's2'), codeStep('s4')];
    try {
      await session.open(artifact, vscode.Uri.file('/project'));
      await session.goToStep('s3'); assert.equal(session.current!.id, 's3');
      await session.goToStep('s1'); await session.next(); assert.equal(session.current!.id, 's2');
      const provider = Object.create(StepsTree.prototype) as StepsTree;
      Object.assign(provider, { session });
      assert.deepEqual(provider.getChildren(), ['overview', 's1', 's4']);
      assert.deepEqual(provider.getChildren('s1'), ['s2']);
      assert.equal(provider.getParent('s3'), 's2');
      await session.goToStep('s2'); await session.skipDetails();
      assert.equal(session.current?.id, 's4');
      await session.previous(); assert.equal(session.current?.id, 's3');
      assert.equal(provider.getParent(session.current!.id), 's2');
    } finally { session.dispose(); }
  });
});
