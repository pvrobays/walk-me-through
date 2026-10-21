import * as assert from 'node:assert/strict';
import * as vscode from 'vscode';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { discover, loadArtifact } from '../src/store';
import { fixture } from '../../core/test/fixtures';

suite('Artifact store', () => {
  test('discovers self-ignored artifacts in nested and multiple roots and validates on load', async () => {
    const root = mkdtempSync(path.join(tmpdir(), 'wmt-store-'));
    try {
      for (const [project, suffix] of [['one/nested', 'a'], ['one/nested', 'b'], ['two', 'c']]) {
        const directory = path.join(root, project, '.walk-me-through/walkthroughs'); mkdirSync(directory, { recursive: true });
        writeFileSync(path.join(path.dirname(directory), '.gitignore'), '*\n');
        writeFileSync(path.join(directory, `${suffix}.json`), JSON.stringify({ ...fixture(), id: `20261021T143005123Z-abcde${suffix}` }));
      }
      const artifacts = await discover(['one', 'two'].map(name => vscode.Uri.file(path.join(root, name))));
      assert.equal(artifacts.length, 3);
      assert.equal(new Set(artifacts.map(header => header.uri.toString())).size, 3);
      const loaded = await loadArtifact(artifacts[0].uri);
      assert.ok(loaded.rootWarning?.includes('/project'));
      assert.ok(loaded.rootWarning?.includes(loaded.root.fsPath));
      writeFileSync(artifacts[0].uri.fsPath, JSON.stringify({ ...loaded.artifact, schemaVersion: 2 }));
      await assert.rejects(loadArtifact(artifacts[0].uri), /Update the viewer/);
    } finally { rmSync(root, { recursive: true, force: true }); }
  });
});
