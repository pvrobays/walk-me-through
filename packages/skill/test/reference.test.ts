import { expect, it } from 'vitest';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

it('publishes the reference example against the sample source files', () => {
  const reference = readFileSync('packages/skill/references/walkthrough-format.md', 'utf8');
  const example = reference.match(/```json\n([\s\S]*?)\n```/)![1];
  const directory = mkdtempSync(path.join(tmpdir(), 'wmt-reference-'));
  try {
    const draft = path.join(directory, 'input.json'); writeFileSync(draft, example);
    const result = spawnSync(process.execPath, ['packages/skill/scripts/publish-walkthrough.mjs', draft, '--root', 'examples/sample-project'], { encoding: 'utf8' });
    expect(result.status).toBe(0); expect(JSON.parse(result.stdout)).toMatchObject({ ok: true, stepCount: 4 });
  } finally { rmSync(directory, { recursive: true, force: true }); }
});
