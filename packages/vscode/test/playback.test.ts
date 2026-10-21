import * as assert from 'node:assert/strict';
import * as vscode from 'vscode';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { rm } from 'node:fs/promises';
import { fixture } from '../../core/test/fixtures';
import { captureAnchor } from '../../core/src/anchor';
import type { TestApi } from '../src/testApi';

suite('Source playback', () => {
  test('resolves unsaved edits, uncertainty, stale/deleted sources and narrative without changing editor', async () => {
    const api = await vscode.extensions.getExtension<TestApi>('pvrobays.walk-me-through')!.activate();
    const root = mkdtempSync(path.join(tmpdir(), 'wmt-playback-'));
    const directory = path.join(root, '.walk-me-through/walkthroughs'); mkdirSync(directory, { recursive: true });
    const source = path.join(root, 'source.ts'); const file = path.join(directory, 'test.json');
    const text = 'before\nconst result = run();\nafter';
    const range = { start: { line: 1, character: 15 }, end: { line: 1, character: 20 } };
    const artifact = fixture(); artifact.project.root = root;
    artifact.steps.push({ id: 's2', parentId: null, title: 'Expression', explanation: 'Calls **run**.', location: { path: 'source.ts', range, anchor: captureAnchor(text, range) } });
    writeFileSync(source, text); writeFileSync(file, JSON.stringify(artifact));
    const command = (name: string, ...args: unknown[]) => vscode.commands.executeCommand(`walkMeThrough.${name}`, ...args);
    const replace = async (document: vscode.TextDocument, value: string) => {
      const edit = new vscode.WorkspaceEdit(); edit.replace(document.uri, new vscode.Range(document.positionAt(0), document.positionAt(document.getText().length)), value);
      assert.equal(await vscode.workspace.applyEdit(edit), true);
    };
    try {
      await command('openWalkthrough', file); await command('goToStep', 's2');
      assert.equal(api.getState().lastResolution?.state, 'exact');
      assert.ok((api.getState().thread as { body: string }).body.includes('Calls **run**.'));
      const document = vscode.window.activeTextEditor!.document;
      await replace(document, 'inserted\n' + text);
      await command('goToStep', 's1');
      assert.equal(api.getState().thread, undefined); assert.equal(api.getState().decoration, undefined);
      await command('skipDetails'); assert.equal(api.getState().currentStepId, 's2');
      assert.equal(api.getState().lastResolution?.state, 'relocated'); assert.equal(document.isDirty, true);
      assert.equal((api.getState().view as { bannerKind: string }).bannerKind, 'info');
      await replace(document, 'inserted\n' + text + '\n' + text); await command('returnToCurrentStep');
      assert.equal(api.getState().lastResolution?.state, 'uncertain');
      assert.equal((api.getState().view as { bannerKind: string }).bannerKind, 'warning');
      assert.equal((api.getState().decoration as { style: string }).style, 'uncertain');
      await replace(document, 'edited selection'); await command('returnToCurrentStep');
      assert.equal(api.getState().lastResolution?.state, 'stale'); assert.equal(api.getState().decoration, undefined); assert.equal(api.getState().thread, undefined);
      assert.equal((api.getState().view as { bannerKind: string }).bannerKind, 'error');
      assert.equal((api.getState().view as { explanation: string }).explanation, 'Calls **run**.');
      assert.ok((api.getState().view as { banner: string }).banner.includes('source.ts:2'));
      const editor = vscode.window.activeTextEditor;
      await command('goToStep', 's1'); assert.equal(vscode.window.activeTextEditor, editor);
      assert.equal((api.getState().view as { explanation: string }).explanation, 'Narrative');
      await vscode.commands.executeCommand('workbench.action.revertAndCloseActiveEditor');
      rmSync(source); await command('goToStep', 's2');
      assert.equal(api.getState().lastResolution?.reason, 'file-missing'); assert.equal(api.getState().decoration, undefined);
    } finally { await command('closeWalkthrough'); await rm(root, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 }); }
  });
});
