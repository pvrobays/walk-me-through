import * as assert from 'node:assert/strict';
import * as vscode from 'vscode';
import { mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { rm } from 'node:fs/promises';
import path from 'node:path';
import { fixture } from '../../core/test/fixtures';
import { captureAnchor } from '../../core/src/anchor';
import type { Artifact } from '../../core/src/artifact';
import { base64urlEncode, encodeEnvelope, utf8Encode, type LaunchEnvelope } from '../../core/src/launch';
import type { TestApi } from '../src/testApi';

const text = 'alpha\nbeta\ngamma\n';
const range = (line: number) => ({ start: { line, character: 0 }, end: { line, character: 4 } });
function artifactAt(root: string, id: string, title: string): Artifact {
  const artifact = fixture();
  artifact.id = id; artifact.title = title; artifact.project.root = root;
  artifact.project.environment = { kind: 'local', platform: process.platform, unsupportedOverride: false };
  artifact.steps = [
    { id: 's1', parentId: null, title: 'Context', explanation: 'Narrative' },
    { id: 's2', parentId: null, title: 'Alpha', explanation: 'Top code', location: { path: 'launch-source.ts', range: range(0), anchor: captureAnchor(text, range(0)) } },
    { id: 's3', parentId: 's2', title: 'Beta', explanation: 'Nested code', location: { path: 'launch-source.ts', range: range(1), anchor: captureAnchor(text, range(1)) } },
  ];
  return artifact;
}
function publish(root: string, id: string, title: string, content: unknown = artifactAt(root, id, title)): string {
  const directory = path.join(root, '.walk-me-through', 'walkthroughs');
  mkdirSync(directory, { recursive: true });
  writeFileSync(path.join(root, 'launch-source.ts'), text);
  const file = path.join(directory, `${id}.json`);
  writeFileSync(file, typeof content === 'string' ? content : JSON.stringify(content));
  return file;
}
const envelope = (root: string, id: string, extra: Partial<LaunchEnvelope> = {}): LaunchEnvelope =>
  ({ v: 1, root, env: { kind: 'local', platform: process.platform }, id, ...extra });
const link = (encoded: string, route = '/open') => vscode.Uri.parse(`vscode://pvrobays.walk-me-through${route}?e=${encoded}`);
const launchUri = (value: LaunchEnvelope) => link(encodeEnvelope(value));

suite('Launch links', () => {
  const ids = { a: '20261021T150000001Z-aaaaaa', b: '20261021T150000002Z-bbbbbb', c: '20261021T150000003Z-cccccc', old: '20261021T140000000Z-oooooo' };
  let api: TestApi;
  let workspace: string;
  const cleanup: string[] = [];
  suiteSetup(async () => {
    api = await vscode.extensions.getExtension<TestApi>('pvrobays.walk-me-through')!.activate();
    workspace = vscode.workspace.workspaceFolders![0].uri.fsPath;
    cleanup.push(path.join(workspace, '.walk-me-through'), path.join(workspace, 'launch-source.ts'), path.join(workspace, 'nested'), `${workspace}-copy`);
    // Remove leftovers from an interrupted run so they cannot leak into this or other suites.
    for (const entry of cleanup) await rm(entry, { recursive: true, force: true, maxRetries: 20, retryDelay: 200 });
  });
  suiteTeardown(async () => {
    await vscode.commands.executeCommand('walkMeThrough.closeWalkthrough');
    await vscode.commands.executeCommand('workbench.action.closeAllEditors');
    for (const entry of cleanup) await rm(entry, { recursive: true, force: true, maxRetries: 20, retryDelay: 200 });
  });

  test('declares on-demand URI activation', () => {
    const manifest = vscode.extensions.getExtension('pvrobays.walk-me-through')!.packageJSON;
    assert.ok(manifest.activationEvents.includes('onUri'));
  });

  test('plays a matching root at the overview with the artifact title, even with a forged envelope title', async () => {
    publish(workspace, ids.a, 'Launch A');
    publish(workspace, ids.old, 'Older walkthrough');
    const outcome = await api.launch(launchUri(envelope(workspace, ids.a, { title: '<b>Forged</b>' })));
    assert.deepEqual(outcome, { kind: 'opened' });
    assert.equal(api.getState().activeId, ids.a);
    assert.equal(api.getState().currentStepId, 'overview');
    assert.equal((api.getState().view as { title: string }).title, 'Launch A');
    // An older link still plays its own artifact after a newer one exists.
    assert.deepEqual(await api.launch(launchUri(envelope(workspace, ids.old))), { kind: 'opened' });
    assert.equal(api.getState().activeId, ids.old);
  });

  test('matches case-insensitively on Windows and inside subfolders, and opens nested steps with ancestors', async () => {
    const nested = path.join(workspace, 'nested', 'project');
    publish(nested, ids.b, 'Launch B');
    const root = process.platform === 'win32' ? nested.toUpperCase() : nested;
    const outcome = await api.launch(launchUri(envelope(root, ids.b, { step: 's3' })));
    assert.deepEqual(outcome, { kind: 'opened' });
    assert.equal(api.getState().activeId, ids.b);
    assert.equal(api.getState().currentStepId, 's3');
    assert.equal((api.getState().view as { breadcrumb: string }).breadcrumb, 'Launch B › Alpha › Beta');
    assert.equal(api.getState().lastResolution?.state, 'exact');
    assert.ok(vscode.window.activeTextEditor?.document.uri.fsPath.toLowerCase().endsWith(path.join('project', 'launch-source.ts').toLowerCase()));
  });

  test('re-launching the active artifact reloads it at the requested step without duplicate presentation', async () => {
    assert.equal(api.getState().activeId, ids.b);
    assert.deepEqual(await api.launch(launchUri(envelope(path.join(workspace, 'nested', 'project'), ids.b, { step: 's2' }))), { kind: 'opened' });
    assert.equal(api.getState().currentStepId, 's2');
    const thread = api.getState().thread as { body: string } | undefined;
    assert.ok(thread?.body.includes('Top code'));
    assert.deepEqual(await api.launch(launchUri(envelope(path.join(workspace, 'nested', 'project'), ids.b))), { kind: 'opened' });
    assert.equal(api.getState().currentStepId, 'overview');
    assert.equal(api.getState().thread, undefined);
    assert.equal(api.getState().decoration, undefined);
  });

  test('opens the overview with a notice for an unknown step', async () => {
    const outcome = await api.launch(launchUri(envelope(workspace, ids.a, { step: 'missing-step' })));
    assert.equal(outcome.kind, 'step-missing');
    assert.match(outcome.message!, /missing-step/);
    assert.equal(api.getState().activeId, ids.a);
    assert.equal(api.getState().currentStepId, 'overview');
  });

  test('matches a root contained by any folder of a multi-root workspace', async () => {
    const other = realpathSync.native(mkdtempSync(path.join(tmpdir(), 'wmt-launch-multi-')));
    cleanup.push(other);
    publish(other, ids.c, 'Launch C');
    const folders = [vscode.Uri.file(workspace), vscode.Uri.file(path.dirname(other))];
    assert.deepEqual(await api.launch(launchUri(envelope(other, ids.c)), folders), { kind: 'opened' });
    assert.equal(api.getState().activeId, ids.c);
  });

  test('refuses an unrelated root, another checkout, and every invalid case without changing the session or workspace', async () => {
    assert.deepEqual(await api.launch(launchUri(envelope(workspace, ids.a))), { kind: 'opened' });
    const before = JSON.stringify(api.getState());
    const folders = vscode.workspace.workspaceFolders!.map(folder => folder.uri.toString());
    const unrelated = realpathSync.native(mkdtempSync(path.join(tmpdir(), 'wmt-launch-unrelated-')));
    cleanup.push(unrelated);
    publish(unrelated, ids.c, 'Unrelated');
    // A sibling whose name extends the workspace folder name must not count as contained.
    const sibling = `${workspace}-copy`;
    mkdirSync(sibling, { recursive: true });
    publish(sibling, ids.c, 'Sibling checkout');
    const removed = publish(workspace, ids.b, 'Removed'); rmSync(removed);
    publish(path.join(workspace, 'nested', 'mismatch'), ids.c, 'Mismatch', artifactAt(path.join(workspace, 'nested', 'mismatch'), ids.a, 'Wrong ID'));
    publish(path.join(workspace, 'nested', 'invalid'), ids.c, 'Invalid', '{"schemaVersion": 2}');
    const other = process.platform === 'win32' ? 'linux' : 'win32';
    const cases: [vscode.Uri, string, RegExp][] = [
      [launchUri(envelope(unrelated, ids.c)), 'no-match', /not open in this VS Code window/],
      [launchUri(envelope(sibling, ids.c)), 'no-match', /not open in this VS Code window/],
      [launchUri(envelope(path.join(workspace, 'does-not-exist'), ids.c)), 'no-match', /not open/],
      [launchUri(envelope(workspace, ids.b)), 'artifact-removed', /was removed\. Expected .*20261021T150000002Z-bbbbbb\.json/],
      [launchUri(envelope(path.join(workspace, 'nested', 'mismatch'), ids.c)), 'artifact-invalid', /expected walkthrough ID 20261021T150000003Z-cccccc/],
      [launchUri(envelope(path.join(workspace, 'nested', 'invalid'), ids.c)), 'artifact-invalid', /schemaVersion/],
      [launchUri({ ...envelope(workspace, ids.a), env: { kind: 'local', platform: other } }), 'environment', /published in a local/],
      [launchUri({ ...envelope(workspace, ids.a), env: { kind: 'WSL', platform: process.platform } }), 'environment', /WSL/],
      [link(encodeEnvelope(envelope(workspace, ids.a)).slice(0, 25)), 'invalid-link', /not valid/],
      [link(base64urlEncode(utf8Encode(JSON.stringify({ ...envelope(workspace, ids.a), id: '../../etc/passwd' })))), 'invalid-link', /id:/],
      [link(base64urlEncode(utf8Encode(JSON.stringify({ v: 2, future: true })))), 'newer-version', /newer Walk Me Through/],
      [link(encodeEnvelope(envelope(workspace, ids.a)), '/other'), 'invalid-link', /unknown path "\/other"/],
      [vscode.Uri.parse('vscode://pvrobays.walk-me-through/open'), 'invalid-link', /no launch data/],
    ];
    for (const [uri, kind, message] of cases) {
      const outcome = await api.launch(uri);
      assert.equal(outcome.kind, kind, uri.toString(true));
      assert.match(outcome.message ?? '', message, kind);
      assert.equal(JSON.stringify(api.getState()), before, kind);
    }
    assert.deepEqual(vscode.workspace.workspaceFolders!.map(folder => folder.uri.toString()), folders);
  });
});
