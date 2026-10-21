import * as assert from 'node:assert/strict';
import * as vscode from 'vscode';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fixture, codeStep } from '../../core/test/fixtures';
import type { TestApi } from '../src/testApi';
import { Session } from '../src/session';

suite('Session lifecycle', () => {
  test('skips subtrees at all four levels while Next/Previous remain depth-first', async () => {
    const session = new Session(); const artifact = fixture();
    const branch = (id: string, parentId: string | null = null) => ({ id, parentId, title: id, explanation: id });
    artifact.steps = [branch('A'), branch('A1', 'A'), branch('A1a', 'A1'), branch('A1ai', 'A1a'),
      branch('A1b', 'A1'), branch('A2', 'A'), branch('A2a', 'A2'), branch('A2ai', 'A2a'), branch('B'), branch('B1', 'B')];
    let presentations = 0;
    const targetId = () => session.skipDetailsTarget?.id;
    session.show = async () => { presentations++; };
    try {
      assert.equal(targetId(), undefined); await session.skipDetails(); assert.equal(presentations, 0);
      await session.open(artifact, vscode.Uri.file('/project'));
      for (const [from, target] of [['overview', 'A'], ['A', 'B'], ['A1', 'A2'], ['A1a', 'A1b'],
        ['A1ai', 'A1b'], ['A1b', 'A2'], ['A2', 'B'], ['A2a', 'B'], ['A2ai', 'B'], ['B', undefined], ['B1', undefined]]) {
        await session.goToStep(from!);
        assert.equal(targetId(), target, from);
        const before: number = presentations;
        await session.skipDetails();
        assert.equal(session.current?.id, target ?? from);
        assert.equal(presentations, before + (target ? 1 : 0));
      }
      await session.goToStep('A'); await session.skipDetails(); await session.previous();
      assert.equal(session.current?.id, 'A2ai');
      await session.goToStep('A');
      for (const step of artifact.steps.slice(1)) { await session.next(); assert.equal(session.current?.id, step.id); }
      await session.next(); assert.equal(session.current?.id, 'B1');
      await session.close(); assert.equal(session.skipDetailsTarget, undefined);
      const before = presentations; await session.skipDetails(); assert.equal(presentations, before);
    } finally { session.dispose(); }
  });
  test('opens, waits for explicit picker choice, navigates without wrapping, replaces, rejects invalid artifacts and closes', async () => {
    const extension = vscode.extensions.getExtension<TestApi>('pvrobays.walk-me-through')!;
    const api = await extension.activate();
    const root = mkdtempSync(path.join(tmpdir(), 'wmt-session-'));
    const directory = path.join(root, '.walk-me-through/walkthroughs'); mkdirSync(directory, { recursive: true });
    const file = path.join(directory, 'one.json');
    const command = (name: string, ...args: unknown[]) => vscode.commands.executeCommand(`walkMeThrough.${name}`, ...args);
    try {
      const artifact = fixture(); artifact.project.root = root;
      writeFileSync(file, JSON.stringify(artifact));
      await command('openWalkthrough', file); assert.equal(api.getState().currentStepId, 'overview');
      assert.equal(api.getState().canSkipDetails, true);
      await command('skipDetails'); assert.equal(api.getState().currentStepId, 's1');
      assert.equal(api.getState().canSkipDetails, false);
      await command('skipDetails'); assert.equal(api.getState().currentStepId, 's1');
      await command('previous');
      await command('previous'); assert.equal(api.getState().currentStepId, 'overview');
      await command('next'); assert.equal(api.getState().currentStepId, 's1');
      await command('next'); assert.equal(api.getState().currentStepId, 's1');
      await command('previous'); assert.equal(api.getState().currentStepId, 'overview');
      const replacement = { ...artifact, id: '20261021T143005124Z-abcdef', steps: [
        { id: 'replacement', parentId: null, title: 'Replacement', explanation: 'New branch' },
        codeStep('child', 'replacement'),
      ] };
      writeFileSync(file, JSON.stringify(replacement)); await command('openWalkthrough', file);
      assert.equal(api.getState().activeId, replacement.id);
      assert.equal(api.getState().canSkipDetails, true);
      await command('skipDetails'); assert.equal(api.getState().currentStepId, 'replacement');
      assert.equal(api.getState().canSkipDetails, false);
      await command('skipDetails'); assert.equal(api.getState().currentStepId, 'replacement');
      await command('next'); assert.equal(api.getState().currentStepId, 'child');
      await command('closeWalkthrough'); assert.deepEqual(api.getState(), {});
      await command('skipDetails'); assert.deepEqual(api.getState(), {});
      const picker = command('openWalkthrough');
      await new Promise(resolve => setTimeout(resolve, 200));
      assert.deepEqual(api.getState(), {});
      await vscode.commands.executeCommand('workbench.action.closeQuickOpen'); await picker;
      const invalid = { ...artifact, steps: [codeStep(), codeStep('s2', 's1'), codeStep('s3', 's2'), codeStep('s4', 's3'), codeStep('s5', 's4')] };
      writeFileSync(file, JSON.stringify(invalid)); await command('openWalkthrough', file);
      assert.deepEqual(api.getState(), {});
    } finally { await command('closeWalkthrough'); rmSync(root, { recursive: true, force: true }); }
  });
});
