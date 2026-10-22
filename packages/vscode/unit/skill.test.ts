import { afterEach, expect, it } from 'vitest';
import { mkdirSync, mkdtempSync, readFileSync, readdirSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { MESSAGES, SKILL_DIRECTORY, SKILL_FILES, hasSkill, installSkill, resolveTargets } from '../src/skill';

interface Entry { path: string; type: 'directory' | 'file' | 'bundle'; text?: string; file?: string; variant?: 'exact' | 'bom-crlf' }
interface Case {
  name: string; setup: Entry[]; folders: string[];
  expected: { targets: { root: string; inGit: boolean }[]; outcome: string; created: string[]; differing: string[]; message: string; after: Record<string, string> };
}
const fixture = JSON.parse(readFileSync('tests/conformance/skill-install.json', 'utf8')) as { skillDirectory: string; files: string[]; cases: Case[] };
const temporary: string[] = [];
afterEach(() => { for (const directory of temporary.splice(0)) rmSync(directory, { recursive: true, force: true }); });

function bundle(file: string, variant: 'exact' | 'bom-crlf' = 'exact') {
  const bytes = readFileSync(`packages/skill/${file}`);
  return variant === 'exact' ? bytes : Buffer.from('\uFEFF' + bytes.toString('utf8').replace(/\n/g, '\r\n'), 'utf8');
}
function build(setup: Entry[], folders: string[]) {
  const base = realpathSync.native(mkdtempSync(path.join(tmpdir(), 'wmt-skill-'))); temporary.push(base);
  const written = new Map<string, Buffer>();
  for (const entry of setup) {
    const target = path.join(base, entry.path);
    if (entry.type === 'directory') { mkdirSync(target, { recursive: true }); continue; }
    const bytes = entry.type === 'file' ? Buffer.from(entry.text!, 'utf8') : bundle(entry.file!, entry.variant);
    mkdirSync(path.dirname(target), { recursive: true }); writeFileSync(target, bytes); written.set(entry.path, bytes);
  }
  for (const folder of folders) mkdirSync(path.join(base, folder), { recursive: true });
  return { base, written };
}

it('uses the shared skill directory and file list', () => {
  expect(fixture.skillDirectory).toBe(SKILL_DIRECTORY);
  expect(fixture.files).toEqual([...SKILL_FILES]);
  expect(fixture.cases.map(testCase => testCase.name)).toEqual(expect.arrayContaining(['fresh', 'crlf-identical', 'customized-skill', 'partial', 'worktree', 'nested-folder', 'no-git']));
});

for (const testCase of fixture.cases) {
  it(`matches the shared fixture: ${testCase.name}`, () => {
    const { base, written } = build(testCase.setup, testCase.folders);
    const targets = resolveTargets(testCase.folders.map(folder => path.join(base, folder)));
    expect(targets.map(target => ({ root: path.relative(base, target.root).split(path.sep).join('/'), inGit: target.inGit }))).toEqual(testCase.expected.targets);
    const outcome = installSkill(targets[0].root, 'packages/skill');
    expect(outcome.kind).toBe(testCase.expected.outcome);
    expect(outcome.kind === 'installed' ? outcome.created : []).toEqual(testCase.expected.created);
    expect(outcome.kind === 'refused' ? outcome.differing : []).toEqual(testCase.expected.differing);
    expect(outcome.message).toBe(testCase.expected.message.replace('{skillDir}', path.join(targets[0].root, ...SKILL_DIRECTORY.split('/'))));
    for (const file of SKILL_FILES) {
      const relative = `${testCase.expected.targets[0].root}/${SKILL_DIRECTORY}/${file}`;
      const state = testCase.expected.after[file];
      let bytes: Buffer | undefined;
      try { bytes = readFileSync(path.join(base, relative)); } catch { bytes = undefined; }
      if (state === 'missing') expect(bytes, file).toBeUndefined();
      else if (state === 'setup') expect(bytes?.equals(written.get(relative)!), file).toBe(true);
      else expect(bytes?.equals(bundle(file)), file).toBe(true);
    }
  });
}

it('tells the user to commit and restart, names differing files, and never overwrites', () => {
  const { base } = build([{ path: 'repo/.git', type: 'directory' }], ['repo']);
  const root = path.join(base, 'repo');
  expect(hasSkill(root)).toBe(false);
  const first = installSkill(root, 'packages/skill');
  expect(first.message).toContain('Commit .agents/skills/walk-me-through/ and restart your agent');
  expect(hasSkill(root)).toBe(true);
  expect(installSkill(root, 'packages/skill').kind).toBe('already-installed');
  const skillFile = path.join(root, SKILL_DIRECTORY, 'SKILL.md');
  writeFileSync(skillFile, 'customized\n');
  const refused = installSkill(root, 'packages/skill');
  expect(refused).toMatchObject({ kind: 'refused', differing: ['SKILL.md'] });
  expect(refused.message).toContain('SKILL.md'); expect(refused.message).toContain('left unchanged');
  expect(readFileSync(skillFile, 'utf8')).toBe('customized\n');
  // A directory where a file is expected also counts as differing; nothing is written.
  rmSync(path.join(root, SKILL_DIRECTORY), { recursive: true });
  mkdirSync(path.join(root, SKILL_DIRECTORY, 'manifest.json'), { recursive: true });
  expect(installSkill(root, 'packages/skill')).toMatchObject({ kind: 'refused', differing: ['manifest.json'] });
  expect(readdirSync(path.join(root, SKILL_DIRECTORY))).toEqual(['manifest.json']);
  expect(MESSAGES.unsupported).toContain('local desktop');
});
