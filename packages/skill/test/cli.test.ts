import { afterEach, expect, it } from 'vitest';
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';
import type { InputLocation } from '../../core/src/input';

const temporary: string[] = [];
afterEach(() => { for (const directory of temporary.splice(0)) rmSync(directory, { recursive: true, force: true }); });
const input = (location: InputLocation = { path: 'src/source.ts', startLine: 1, endLine: 1 }) => ({ version: 1, title: 'Retry investigation', summary: 'Summary', steps: [{ title: 'Code', explanation: 'Evidence', location }] });
function fixture() {
  const root = mkdtempSync(path.join(tmpdir(), 'wmt-cli-')); temporary.push(root);
  const script = path.join(root, '.agents/skills/walk-me-through/scripts/publish-walkthrough.mjs');
  mkdirSync(path.dirname(script), { recursive: true });
  mkdirSync(path.join(root, 'src/deep'), { recursive: true });
  copyFileSync('packages/skill/scripts/publish-walkthrough.mjs', script);
  writeFileSync(path.join(root, 'src/source.ts'), 'const value = 1;\n\nvalue; value;\n');
  const draft = path.join(root, 'draft.json'); writeFileSync(draft, JSON.stringify(input()));
  function run(args: string[] = [draft], cwd = root, env = process.env) {
    const result = spawnSync(process.execPath, [script, ...args], { cwd, encoding: 'utf8', env });
    expect(result.error).toBeUndefined(); expect(result.stderr).toBe('');
    expect(result.stdout.trim().split('\n')).toHaveLength(1);
    return { ...result, json: JSON.parse(result.stdout) };
  }
  return { root, script, draft, run };
}
it('runs from a subdirectory with no node_modules, publishes twice immutably, and returns picker instructions without a URL', () => {
  const { root, draft, run } = fixture();
  expect(existsSync(path.join(root, 'node_modules'))).toBe(false);
  const first = run([path.relative(path.join(root, 'src/deep'), draft)], path.join(root, 'src/deep'));
  expect(first.status).toBe(0); expect(first.json).toMatchObject({ ok: true, stepCount: 1, open: expect.stringContaining('picker') });
  expect(first.json.open).toContain(first.json.id); expect(first.json.open).toContain('Retry investigation'); expect(first.json.url).toBeUndefined();
  const firstPath = path.join(root, first.json.artifactPath); const content = readFileSync(firstPath, 'utf8');
  const second = run(); expect(second.status).toBe(0); expect(second.json.id).not.toBe(first.json.id);
  expect(readFileSync(firstPath, 'utf8')).toBe(content);
  expect(readdirSync(path.join(root, '.walk-me-through/walkthroughs'))).toHaveLength(2);
  expect(readFileSync(path.join(root, '.walk-me-through/.gitignore'), 'utf8')).toBe('*\n');
});
it('reports a missing root outside installed layout and missing input as usage errors', () => {
  const { root, draft, run } = fixture();
  const result = spawnSync(process.execPath, [path.resolve('packages/skill/scripts/publish-walkthrough.mjs'), draft], { encoding: 'utf8' });
  expect(result.status).toBe(2); expect(JSON.parse(result.stdout)).toMatchObject({ ok: false, errors: [{ code: 'ROOT_NOT_RESOLVED', hint: expect.stringContaining('--root') }] });
  const missing = run([path.join(root, 'missing.json')]); expect(missing.status).toBe(2);
  expect(missing.json).toMatchObject({ ok: false, errors: [{ code: 'INPUT_FILE_NOT_FOUND', recovery: 'fix-input' }] });
});
it('collects independent validation failures and returns source-specific selection recovery', () => {
  const { root, draft, run } = fixture();
  writeFileSync(draft, JSON.stringify({ ...input(), steps: [{ title: '', explanation: '' }] }));
  const invalid = run(); expect(invalid.status).toBe(1); expect(invalid.json.errors).toHaveLength(2);
  for (const [location, code] of [
    [{ path: 'src/source.ts', startLine: 2, endLine: 2 }, 'EMPTY_SELECTION'],
    [{ path: 'src/source.ts', startLine: 1, endLine: 1, match: 'missing' }, 'MATCH_NOT_FOUND'],
    [{ path: 'src/source.ts', startLine: 3, endLine: 3, match: 'value' }, 'MATCH_AMBIGUOUS'],
  ] as const) {
    writeFileSync(draft, JSON.stringify(input(location)));
    const result = run(); expect(result.status).toBe(1);
    expect(result.json.errors[0]).toMatchObject({ code, path: expect.stringContaining('steps[0].location'), recovery: 'fix-input', hint: expect.any(String), details: { sourcePath: location.path, startLine: location.startLine, endLine: location.endLine } });
  }
  expect(existsSync(path.join(root, '.walk-me-through/walkthroughs'))).toBe(false);
});
it('reports environment blockers with setup hints and no published artifact', () => {
  const { root, run } = fixture();
  const result = run(undefined, undefined, { ...process.env, WALK_ME_THROUGH_ALLOW_UNSUPPORTED_ENVIRONMENT: '', SSH_CONNECTION: 'test-session' });
  expect(result.status).toBe(2); expect(result.json).toMatchObject({ ok: false, errors: [{ code: 'ENVIRONMENT_UNSUPPORTED', recovery: 'fix-environment', hint: expect.stringContaining('native Windows') }] });
  expect(existsSync(path.join(root, '.walk-me-through/walkthroughs'))).toBe(false);
});
it('leaves a git fixture clean after publishing', () => {
  const { root, run } = fixture();
  const git = (args: string[]) => execFileSync('git', args, { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  git(['init', '-q']); git(['add', '.']);
  git(['-c', 'user.name=Walkthrough test', '-c', 'user.email=test@example.invalid', 'commit', '-qm', 'Fixture']);
  expect(run().status).toBe(0);
  expect(git(['status', '--porcelain'])).toBe('');
});
