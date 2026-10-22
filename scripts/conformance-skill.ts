// Generates tests/conformance/skill-install.json by running the real VS Code installer (packages/vscode/src/skill.ts)
// against each case in a temporary directory. Rider's SkillInstallerTest replays the committed cases.
import { mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { SKILL_DIRECTORY, SKILL_FILES, installSkill, resolveTargets } from '../packages/vscode/src/skill';

type Entry =
  | { path: string; type: 'directory' }
  | { path: string; type: 'file'; text: string }
  | { path: string; type: 'bundle'; file: (typeof SKILL_FILES)[number]; variant: 'exact' | 'bom-crlf' };
interface Case { name: string; description: string; setup: Entry[]; folders: string[]; expectOutcome: string }

const skill = (root: string, file: (typeof SKILL_FILES)[number], variant: 'exact' | 'bom-crlf' = 'exact'): Entry => ({ path: `${root}/${SKILL_DIRECTORY}/${file}`, type: 'bundle', file, variant });
const git: Entry = { path: 'repo/.git', type: 'directory' };
const CASES: Case[] = [
  { name: 'fresh', description: 'Repository without the skill: all four files are created.', setup: [git], folders: ['repo'], expectOutcome: 'installed' },
  { name: 'crlf-identical', description: 'All four files present with a BOM and CRLF line endings: identical after normalization.', setup: [git, ...SKILL_FILES.map(file => skill('repo', file, 'bom-crlf'))], folders: ['repo'], expectOutcome: 'already-installed' },
  { name: 'customized-skill', description: 'A customized SKILL.md: nothing is written, including the missing files.', setup: [git, { path: `repo/${SKILL_DIRECTORY}/SKILL.md`, type: 'file', text: '# My customized skill\n' }], folders: ['repo'], expectOutcome: 'refused' },
  { name: 'several-differing', description: 'Differing files are named in bundle order.', setup: [git, { path: `repo/${SKILL_DIRECTORY}/scripts/publish-walkthrough.mjs`, type: 'file', text: '// old\n' }, { path: `repo/${SKILL_DIRECTORY}/SKILL.md`, type: 'file', text: 'old\n' }], folders: ['repo'], expectOutcome: 'refused' },
  { name: 'partial', description: 'Some identical files present: only the missing files are created.', setup: [git, skill('repo', 'SKILL.md'), skill('repo', 'manifest.json', 'bom-crlf')], folders: ['repo'], expectOutcome: 'installed' },
  { name: 'worktree', description: 'A worktree whose .git is a file is its own target.', setup: [git, { path: 'wt/.git', type: 'file', text: 'gitdir: ../repo/.git/worktrees/wt\n' }], folders: ['wt/src'], expectOutcome: 'installed' },
  { name: 'nested-folder', description: 'A subfolder of a repository installs at the repository root.', setup: [git], folders: ['repo/src/app'], expectOutcome: 'installed' },
  { name: 'no-git', description: 'Outside Git, the folder itself is the target (not offered, but the command installs).', setup: [], folders: ['plain'], expectOutcome: 'installed' },
  { name: 'same-repository-folders', description: 'Several folders of one repository resolve to one target.', setup: [git], folders: ['repo/src', 'repo/docs', 'repo'], expectOutcome: 'installed' },
  { name: 'two-repositories', description: 'Folders in different repositories give one target each; the first is installed here.', setup: [{ path: 'a/.git', type: 'directory' }, { path: 'b/.git', type: 'directory' }], folders: ['b', 'a/src'], expectOutcome: 'installed' },
];

const bundleDir = 'packages/skill';
function bundleBytes(file: string, variant: 'exact' | 'bom-crlf'): Buffer {
  const bytes = readFileSync(path.join(bundleDir, file));
  return variant === 'exact' ? bytes : Buffer.from('\uFEFF' + bytes.toString('utf8').replace(/\r\n/g, '\n').replace(/\n/g, '\r\n'), 'utf8');
}
const relative = (base: string, value: string) => path.relative(base, value).split(path.sep).join('/');

export function generateSkillInstallConformance() {
  const cases = CASES.map(testCase => {
    const temporary = mkdtempSync(path.join(tmpdir(), 'wmt-skill-fixture-'));
    try {
      const base = path.resolve(temporary);
      const setupBytes = new Map<string, Buffer>();
      for (const entry of testCase.setup) {
        const target = path.join(base, entry.path);
        if (entry.type === 'directory') { mkdirSync(target, { recursive: true }); continue; }
        const bytes = entry.type === 'file' ? Buffer.from(entry.text, 'utf8') : bundleBytes(entry.file, entry.variant);
        mkdirSync(path.dirname(target), { recursive: true }); writeFileSync(target, bytes); setupBytes.set(entry.path, bytes);
      }
      for (const folder of testCase.folders) mkdirSync(path.join(base, folder), { recursive: true });
      // Compare against the canonical temp path so 8.3 names or symlinked temp folders do not leak into the fixture.
      const real = realpathSync.native(base);
      const targets = resolveTargets(testCase.folders.map(folder => path.join(base, folder)));
      const outcome = installSkill(targets[0].root, bundleDir);
      if (outcome.kind !== testCase.expectOutcome) throw new Error(`skill-install case ${testCase.name}: expected ${testCase.expectOutcome}, got ${outcome.kind}`);
      const targetRoot = relative(real, targets[0].root);
      const after: Record<string, string> = {};
      for (const file of SKILL_FILES) {
        const entryPath = `${targetRoot}/${SKILL_DIRECTORY}/${file}`;
        let bytes: Buffer | undefined;
        try { bytes = readFileSync(path.join(real, entryPath)); } catch { /* missing */ }
        after[file] = !bytes ? 'missing' : setupBytes.get(entryPath)?.equals(bytes) ? 'setup' : bytes.equals(readFileSync(path.join(bundleDir, file))) ? 'bundle' : 'other';
      }
      return {
        name: testCase.name, description: testCase.description, setup: testCase.setup, folders: testCase.folders,
        expected: {
          targets: targets.map(target => ({ root: relative(real, target.root), inGit: target.inGit })),
          outcome: outcome.kind,
          created: outcome.kind === 'installed' ? outcome.created : [],
          differing: outcome.kind === 'refused' ? outcome.differing : [],
          message: outcome.message.split(outcome.skillDir).join('{skillDir}'),
          after,
        },
      };
    } finally { rmSync(temporary, { recursive: true, force: true }); }
  });
  return { skillDirectory: SKILL_DIRECTORY, files: SKILL_FILES, cases };
}
