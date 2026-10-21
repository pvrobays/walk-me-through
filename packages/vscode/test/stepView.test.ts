import * as assert from 'node:assert/strict';
import * as vscode from 'vscode';
import { Session } from '../src/session';
import { StepView } from '../src/stepView';
import { fixture, codeStep } from '../../core/test/fixtures';

suite('Step view', () => {
  test('shares explicit uncertainty and tie notices with comments', async () => {
    const session = new Session(); const provider = new StepView(session);
    const artifact = fixture(); artifact.steps = [codeStep()];
    try {
      await session.open(artifact, vscode.Uri.file('/project')); await session.next();
      for (const tie of [false, true]) {
        session.lastResolution = { state: 'uncertain', tie, candidateCount: 2 };
        const state = provider.getState()!;
        assert.equal(state.bannerKind, 'warning');
        assert.ok(state.banner.startsWith('Uncertain location: Original location unconfirmed; showing the closest identical code.'));
        assert.equal(state.banner.includes('Equally near matches; the earlier one is shown.'), tie);
      }
      session.lastResolution = { state: 'relocated', candidateCount: 1 };
      assert.equal(provider.getState()!.bannerKind, 'info');
      assert.equal(provider.getState()!.banner, 'Code moved: the captured context identifies this location.');
      session.lastResolution = { state: 'stale', reason: 'not-found', candidateCount: 0 };
      assert.equal(provider.getState()!.bannerKind, 'error');
      assert.match(provider.getState()!.banner, /Stale — original code not found.*src\/retry.ts:1. No source highlighted./);
      assert.equal(provider.getState()!.explanation, 'Evidence');
    } finally { provider.dispose(); session.dispose(); }
  });
  test('dispatches Skip Details and disables it at the branch boundary', async () => {
    const session = new Session(); const provider = new StepView(session);
    let receive!: (message: unknown) => Promise<void>;
    const webview = { html: '', options: {}, cspSource: 'test:', onDidReceiveMessage: (callback: typeof receive) => {
      receive = callback; return new vscode.Disposable(() => {});
    } };
    const view = { webview, onDidDispose: () => new vscode.Disposable(() => {}) } as unknown as vscode.WebviewView;
    try {
      provider.resolveWebviewView(view);
      await session.open(fixture(), vscode.Uri.file('/project'));
      assert.equal(provider.getState()?.canSkipDetails, true);
      assert.match(webview.html, /data-action="skipDetails"[^>]*aria-label="Skip Details: Skip nested details/);
      assert.doesNotMatch(webview.html, /data-action="skipDetails"[^>]*disabled/);
      assert.match(webview.html, /flex-wrap:wrap/);
      assert.match(webview.html, /aside.warning\{font-size:\.9em;padding:6px;color:var\(--vscode-editorWarning-foreground\)\}/);
      assert.match(webview.html, /aside.warning::before\{content:"⚠ "\}/);
      assert.match(webview.html, /aside.error\{border-color:var\(--vscode-editorError-foreground\);color:var\(--vscode-errorForeground\)\}/);
      await receive({ type: 'skipDetails' });
      assert.equal(session.current?.id, 's1');
      assert.equal(provider.getState()?.canSkipDetails, false);
      assert.match(webview.html, /data-action="skipDetails"[^>]*disabled/);
      await receive({ type: 'skipDetails' }); assert.equal(session.current?.id, 's1');
      await session.close(); assert.equal(provider.getState(), undefined);
      assert.doesNotMatch(webview.html, /data-action="skipDetails"/);
    } finally { provider.dispose(); session.dispose(); }
  });
});
