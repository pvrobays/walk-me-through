import * as vscode from 'vscode';
import { existsSync, readFileSync } from 'node:fs';
import { checkEnvironment } from '@walk-me-through/core/env';
import { discover, loadArtifact } from './store';
import { Session } from './session';
import type { TestApi } from './testApi';
import { resolve } from '@walk-me-through/core/resolve';
import { Comments } from './comments';
import { Highlights } from './highlights';
import { StepsTree } from './tree';
import { StepView } from './stepView';

export function activate(context: vscode.ExtensionContext): TestApi | undefined {
  const session = new Session();
  const comments = new Comments();
  const highlights = new Highlights();
  const tree = new StepsTree(session);
  const stepView = new StepView(session);
  context.subscriptions.push(vscode.window.registerWebviewViewProvider('walkMeThrough.step', stepView));
  session.clearPresentation = () => { comments.clear(); highlights.clear(); };
  session.show = async (step, generation) => {
    if (!step?.location || !session.root) return;
    const location = step.location;
    const uri = vscode.Uri.joinPath(session.root, ...location.path.split('/'));
    if (!existsSync(uri.fsPath)) {
      session.lastResolution = resolve(location.anchor, location.range, null);
      return;
    }
    let document: vscode.TextDocument;
    try { document = await vscode.workspace.openTextDocument(uri); }
    catch (error) {
      if (session.isCurrent(generation)) session.lastResolution = resolve(location.anchor, location.range,
        (error as { code?: string }).code === 'FileNotFound' || !existsSync(uri.fsPath) ? null : { unreadable: true });
      return;
    }
    if (!session.isCurrent(generation)) return;
    const result = resolve(location.anchor, location.range, document.getText());
    session.lastResolution = result;
    if (!result.range || result.state === 'stale') return;
    const range = new vscode.Range(result.range.start.line, result.range.start.character, result.range.end.line, result.range.end.character);
    const editor = await vscode.window.showTextDocument(document, { preview: true, preserveFocus: false });
    if (!session.isCurrent(generation)) return;
    editor.revealRange(range, vscode.TextEditorRevealType.InCenterIfOutsideViewport);
    highlights.show(uri, range, result.state === 'uncertain' ? 'uncertain' : 'confident');
    comments.show(uri, range, step, session.index, session.artifact!.steps.length, result);
  };
  let openRequest = 0;
  const register = (name: string, callback: (...args: any[]) => unknown) => context.subscriptions.push(vscode.commands.registerCommand(`walkMeThrough.${name}`, callback));
  register('openWalkthrough', async (value?: string | vscode.Uri) => {
    const request = ++openRequest;
    const environment = checkEnvironment({ nodeVersion: process.versions.node, platform: process.platform, env: process.env, exists: existsSync, readText: name => readFileSync(name, 'utf8') });
    if (vscode.env.remoteName || !environment.ok) {
      void vscode.window.showErrorMessage(vscode.env.remoteName
        ? 'Walk Me Through supports local desktop VS Code on native Windows and native Linux; remote hosts are unsupported.'
        : environment.errors.map(error => error.message).join('\n'));
      return;
    }
    try {
      let uri = typeof value === 'string' ? vscode.Uri.file(value) : value;
      if (!uri) {
        const headers = await discover();
        const choices = headers.map(header => ({ label: header.title, description: header.id, detail: `${header.createdAt} · ${header.root.fsPath}`, uri: header.uri }));
        const picked = await vscode.window.showQuickPick([...choices, { label: 'Browse…', description: 'Choose a walkthrough JSON file', detail: '', uri: undefined }], {
          title: 'Open Walkthrough', placeHolder: headers.length ? 'Choose the title and ID supplied by your agent' : 'No walkthroughs found. Publish one with the project skill, or Browse…',
        });
        if (!picked) return;
        uri = picked.uri;
        if (!uri) uri = (await vscode.window.showOpenDialog({ canSelectMany: false, filters: { Walkthrough: ['json'] }, openLabel: 'Open Walkthrough' }))?.[0];
      }
      if (!uri || request !== openRequest) return;
      const loaded = await loadArtifact(uri);
      if (request !== openRequest) return;
      if (loaded.rootWarning) void vscode.window.showWarningMessage(loaded.rootWarning);
      await session.open(loaded.artifact, loaded.root);
    } catch (error) { void vscode.window.showErrorMessage(`Cannot open walkthrough: ${String(error)}`); }
  });
  register('closeWalkthrough', async () => { openRequest++; await session.close(); });
  register('next', () => session.next());
  register('previous', () => session.previous());
  register('skipDetails', () => session.skipDetails());
  register('goToStep', (id: string) => session.goToStep(id));
  register('returnToCurrentStep', () => session.refresh());
  context.subscriptions.push(session, comments, highlights, tree, stepView);
  return context.extensionMode === vscode.ExtensionMode.Test ? { getState: () => ({ ...session.getState(), ...(session.isActive ? { thread: comments.getState(), decoration: highlights.getState(), view: stepView.getState() } : {}) }) } : undefined;
}
