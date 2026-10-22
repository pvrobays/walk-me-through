// Node-only skill installer shared by the Install Skill command and the missing-skill offer.
// It must not import `vscode`, so Vitest and the conformance generator can drive it directly.
// Rider's SkillInstaller.kt implements the same algorithm; tests/conformance/skill-install.json keeps them aligned.
import { existsSync, mkdirSync, readFileSync, realpathSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { hashFile } from '@walk-me-through/core/text';

export const SKILL_DIRECTORY = '.agents/skills/walk-me-through';
export const SKILL_FILES = ['SKILL.md', 'manifest.json', 'references/walkthrough-format.md', 'scripts/publish-walkthrough.mjs'] as const;

export interface SkillTarget {
  /** Directory that receives `.agents/skills/walk-me-through/`. */
  root: string;
  /** True when `root` holds a `.git` directory or file (a repository or worktree root). */
  inGit: boolean;
}

export type InstallOutcome =
  | { kind: 'installed'; skillDir: string; created: string[]; message: string }
  | { kind: 'already-installed'; skillDir: string; message: string }
  | { kind: 'refused'; skillDir: string; differing: string[]; message: string };

export const MESSAGES = {
  installed: 'Installed the Walk Me Through skill in {skillDir}. Commit .agents/skills/walk-me-through/ and restart your agent so it discovers the skill.',
  alreadyInstalled: 'The Walk Me Through skill is already installed in {skillDir}. Nothing was changed.',
  refused: 'The Walk Me Through skill in {skillDir} was left unchanged because these files differ from the bundled version: {files}. Review or remove them, then run Install Skill into Project again.',
  unsupported: 'Install Skill into Project needs a local desktop window on native Windows, Linux or macOS. Remote hosts, SSH, WSL and containers are unsupported.',
} as const;

const format = (template: string, values: Record<string, string>) => template.replace(/\{(\w+)\}/g, (_, key: string) => values[key]);

function canonical(folder: string): string {
  try { return realpathSync.native(folder); } catch { return path.resolve(folder); }
}
const key = (folder: string, platform: NodeJS.Platform) => platform === 'win32' ? folder.toLowerCase() : folder;

/** Nearest ancestor (or the folder itself) holding a `.git` directory or file; otherwise the folder itself. */
export function resolveTarget(folder: string): SkillTarget {
  const start = canonical(folder);
  for (let current = start; ; current = path.dirname(current)) {
    if (existsSync(path.join(current, '.git'))) return { root: current, inGit: true };
    if (path.dirname(current) === current) return { root: start, inGit: false };
  }
}

/** One target per distinct canonical root, in folder order. */
export function resolveTargets(folders: readonly string[], platform: NodeJS.Platform = process.platform): SkillTarget[] {
  const seen = new Set<string>();
  const targets: SkillTarget[] = [];
  for (const folder of folders) {
    const target = resolveTarget(folder);
    const id = key(target.root, platform);
    if (!seen.has(id)) { seen.add(id); targets.push(target); }
  }
  return targets;
}

export function skillDirectory(root: string): string {
  return path.join(root, ...SKILL_DIRECTORY.split('/'));
}

export function hasSkill(root: string): boolean {
  return existsSync(path.join(skillDirectory(root), 'SKILL.md'));
}

function sameText(existing: Buffer, bundled: Buffer): boolean {
  try { return hashFile(existing) === hashFile(bundled); } catch { return false; }
}

/** Reads the bundle from `bundleDir`; writes only missing files, and nothing at all if any existing file differs. */
export function installSkill(root: string, bundleDir: string): InstallOutcome {
  const skillDir = skillDirectory(root);
  const bundle = SKILL_FILES.map(file => ({ file, bytes: readFileSync(path.join(bundleDir, ...file.split('/'))) }));
  const missing: typeof bundle = [];
  const differing: string[] = [];
  for (const entry of bundle) {
    const destination = path.join(skillDir, ...entry.file.split('/'));
    let existing: Buffer | undefined;
    try { existing = readFileSync(destination); } catch (error) {
      const code = (error as NodeJS.ErrnoException).code;
      if (code === 'ENOENT') { missing.push(entry); continue; }
      if (code === 'EISDIR') { differing.push(entry.file); continue; }
      throw error;
    }
    if (!sameText(existing, entry.bytes)) differing.push(entry.file);
  }
  if (differing.length) return { kind: 'refused', skillDir, differing, message: format(MESSAGES.refused, { skillDir, files: differing.join(', ') }) };
  if (!missing.length) return { kind: 'already-installed', skillDir, message: format(MESSAGES.alreadyInstalled, { skillDir }) };
  for (const entry of missing) {
    const destination = path.join(skillDir, ...entry.file.split('/'));
    mkdirSync(path.dirname(destination), { recursive: true });
    writeFileSync(destination, entry.bytes, { flag: 'wx' });
  }
  return { kind: 'installed', skillDir, created: missing.map(entry => entry.file), message: format(MESSAGES.installed, { skillDir }) };
}
