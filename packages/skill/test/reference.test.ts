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
    expect(result.status).toBe(0);
    const output = JSON.parse(result.stdout);
    expect(output).toMatchObject({ ok: true, stepCount: 4 });
    expect(output.open).toContain('VS Code or Rider');
    expect(output.open).toContain(output.id);
    expect(output.open).toContain('in the picker');
    expect(output.url.startsWith('https://pvrobays.github.io/walk-me-through/#')).toBe(true);
    expect(output.open.startsWith(`Open ${output.url} and choose VS Code or Rider, or run Walk Me Through: Open Walkthrough`)).toBe(true);
    expect(reference).toContain('VS Code or Rider');
    expect(reference).toContain('launch-link-too-long');
    expect(reference).toContain('Copy it verbatim');
    const skill = readFileSync('packages/skill/SKILL.md', 'utf8');
    expect(skill).toContain('**Walkthrough available**');
    expect(skill).toContain('copied verbatim');
    expect(skill).toContain('do not offer or fabricate a link');
    expect(skill).not.toContain('--launcher-url');
  } finally { rmSync(directory, { recursive: true, force: true }); }
});
