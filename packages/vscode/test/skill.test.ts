import * as assert from 'node:assert/strict';
import * as vscode from 'vscode';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import type { TestApi } from '../src/testApi';
import type { InstallOutcome } from '../src/skill';
import type { SkillHost } from '../src/skillOnboarding';
import { SKILL_TREE_MESSAGE } from '../src/skillOnboarding';

const SKILL = '.agents/skills/walk-me-through';
const FILES = ['SKILL.md', 'manifest.json', 'references/walkthrough-format.md', 'scripts/publish-walkthrough.mjs'];

class MemoryState implements vscode.Memento {
  readonly values = new Map<string, unknown>();
  keys() { return [...this.values.keys()]; }
  get<T>(key: string, fallback?: T): T { return (this.values.has(key) ? this.values.get(key) : fallback) as T; }
  async update(key: string, value: unknown) { if (value === undefined) this.values.delete(key); else this.values.set(key, value); }
}
interface Shown { level: string; message: string; actions: string[] }

suite('Skill onboarding', () => {
  let api: TestApi;
  let base: string;
  let shown: Shown[];
  let answer: string | undefined;
  let state: MemoryState;
  const repo = (name: string, git = true) => {
    const root = path.join(base, name);
    mkdirSync(git ? path.join(root, '.git') : root, { recursive: true });
    return root;
  };
  const configure = (folders: string[], overrides: Partial<SkillHost> = {}) => api.skill.configure({
    folders: () => folders.map(folder => vscode.Uri.file(folder)),
    isTrusted: () => true, refusal: () => undefined, state,
    notify: async (level, message, ...actions) => { shown.push({ level, message, actions }); return actions.length ? answer : undefined; },
    ...overrides,
  });
  const files = (root: string) => existsSync(path.join(root, SKILL)) ? readdirSync(path.join(root, SKILL), { recursive: true }).map(String).sort() : [];

  suiteSetup(async () => {
    api = await vscode.extensions.getExtension<TestApi>('pvrobays.walk-me-through')!.activate();
  });
  setup(() => {
    base = realpathSync.native(mkdtempSync(path.join(tmpdir(), 'wmt-skill-host-')));
    shown = []; answer = undefined; state = new MemoryState();
  });
  teardown(() => { api.skill.configure(undefined); rmSync(base, { recursive: true, force: true }); });

  test('contributes Install Skill into Project and activates after startup', () => {
    const manifest = vscode.extensions.getExtension('pvrobays.walk-me-through')!.packageJSON;
    assert.ok(manifest.contributes.commands.some((command: { command: string; title: string }) =>
      command.command === 'walkMeThrough.installSkill' && command.title === 'Walk Me Through: Install Skill into Project'));
    assert.ok(manifest.activationEvents.includes('onStartupFinished'));
  });

  test('the command installs, then reports already installed, then refuses a customized SKILL.md without overwriting', async () => {
    const root = repo('repo');
    mkdirSync(path.join(root, 'src', 'app'), { recursive: true });
    configure([path.join(root, 'src', 'app')]);
    const first = await vscode.commands.executeCommand<InstallOutcome>('walkMeThrough.installSkill');
    assert.equal(first.kind, 'installed');
    assert.deepEqual(FILES.map(file => readFileSync(path.join(root, SKILL, file)).equals(readFileSync(path.join(__dirname, '../../skill', file)))), [true, true, true, true]);
    assert.match(shown[0].message, /Commit \.agents\/skills\/walk-me-through\/ and restart your agent/);
    assert.equal((await vscode.commands.executeCommand<InstallOutcome>('walkMeThrough.installSkill')).kind, 'already-installed');
    assert.match(shown[1].message, /already installed/);
    writeFileSync(path.join(root, SKILL, 'SKILL.md'), 'customized\n');
    const refused = await vscode.commands.executeCommand<InstallOutcome>('walkMeThrough.installSkill');
    assert.deepEqual(refused.kind === 'refused' && refused.differing, ['SKILL.md']);
    assert.equal(shown[2].level, 'warning');
    assert.match(shown[2].message, /SKILL\.md/); assert.match(shown[2].message, /left unchanged/);
    assert.equal(readFileSync(path.join(root, SKILL, 'SKILL.md'), 'utf8'), 'customized\n');
  });

  test('the command refuses remote windows, lets the user choose among targets, and works in Restricted Mode', async () => {
    const a = repo('a'); const b = repo('b');
    configure([a], { refusal: () => 'remote' });
    assert.equal(await vscode.commands.executeCommand('walkMeThrough.installSkill'), undefined);
    assert.equal(shown[0].level, 'error'); assert.match(shown[0].message, /local desktop/);
    assert.deepEqual(files(a), []);
    configure([a, b], { isTrusted: () => false, pick: async targets => targets.find(target => target.root === b) });
    assert.equal((await vscode.commands.executeCommand<InstallOutcome>('walkMeThrough.installSkill')).kind, 'installed');
    assert.deepEqual(files(a), []);
    assert.ok(existsSync(path.join(b, SKILL, 'SKILL.md')));
  });

  test('the offer appears once per session for a Git root without the skill, and writes nothing unless Install is chosen', async () => {
    const root = repo('repo');
    configure([root]);
    const result = await api.skill.offer();
    assert.deepEqual(result, { kind: 'shown', root, choice: 'dismissed' });
    assert.deepEqual(shown[0].actions, ['Install', 'Not for This Project', "Don't Ask Again"]);
    assert.equal(shown[0].level, 'info');
    assert.match(shown[0].message, /agents need the Walk Me Through project skill to create walkthroughs/);
    assert.deepEqual(files(root), []);
    assert.deepEqual(await api.skill.offer(), { kind: 'skipped', reason: 'no-target' });
    assert.equal(shown.length, 1);
    assert.deepEqual(state.keys(), []);
    answer = 'Install';
    configure([root]); // A new session may offer again after the notification was closed.
    const installed = await api.skill.offer();
    assert.equal(installed.kind === 'shown' && installed.install?.kind, 'installed');
    assert.ok(existsSync(path.join(root, SKILL, 'SKILL.md')));
  });

  test('no offer outside Git, with an existing (even customized) SKILL.md, or in Restricted Mode', async () => {
    const plain = repo('plain', false);
    configure([plain]);
    assert.deepEqual(await api.skill.offer(), { kind: 'skipped', reason: 'no-target' });
    const customized = repo('customized');
    mkdirSync(path.join(customized, SKILL), { recursive: true });
    writeFileSync(path.join(customized, SKILL, 'SKILL.md'), 'mine\n');
    configure([customized]);
    assert.deepEqual(await api.skill.offer(), { kind: 'skipped', reason: 'no-target' });
    configure([repo('untrusted')], { isTrusted: () => false });
    assert.deepEqual(await api.skill.offer(), { kind: 'skipped', reason: 'untrusted' });
    configure([repo('remote')], { refusal: () => 'remote' });
    assert.deepEqual(await api.skill.offer(), { kind: 'skipped', reason: 'environment' });
    assert.equal(shown.length, 0);
  });

  test('the view banner ignores dismissals, installs from its button, and hides once SKILL.md exists', async () => {
    await vscode.commands.executeCommand('workbench.view.extension.walkMeThrough');
    const deadline = Date.now() + 10000;
    while (api.skill.banner().stepView === undefined && Date.now() < deadline) await new Promise(resolve => setTimeout(resolve, 50));
    const root = repo('repo');
    await state.update('walkMeThrough.skillOffer.never', true);
    await state.update('walkMeThrough.skillOffer.dismissedRoots', [process.platform === 'win32' ? root.toLowerCase() : root]);
    configure([root]);
    let banner = api.skill.banner();
    assert.ok(banner.stepView?.includes('data-action="installSkill"'), 'Step view shows the Install Skill button');
    assert.match(banner.stepView!, /skill is not installed in this project, so your AI agent can(&#39;|')t create walkthroughs here/);
    assert.equal(banner.treeMessage, SKILL_TREE_MESSAGE);
    assert.deepEqual(files(root), []);
    await api.skill.pressBannerInstall();
    assert.ok(existsSync(path.join(root, SKILL, 'SKILL.md')));
    banner = api.skill.banner();
    assert.ok(!banner.stepView?.includes('data-action="installSkill"'));
    assert.notEqual(banner.treeMessage, SKILL_TREE_MESSAGE);
    const customized = repo('customized');
    mkdirSync(path.join(customized, SKILL), { recursive: true });
    writeFileSync(path.join(customized, SKILL, 'SKILL.md'), 'mine\n');
    configure([customized]);
    assert.ok(!api.skill.banner().stepView?.includes('data-action="installSkill"'));
    configure([repo('remote')], { refusal: () => 'remote' });
    assert.notEqual(api.skill.banner().treeMessage, SKILL_TREE_MESSAGE);
    configure([repo('plain', false)]);
    assert.notEqual(api.skill.banner().treeMessage, SKILL_TREE_MESSAGE);
  });

  test('Not for This Project persists for that root only; Don\'t Ask Again suppresses every root; the command still installs', async () => {
    const a = repo('a'); const b = repo('b');
    answer = 'Not for This Project';
    configure([a]);
    assert.deepEqual(await api.skill.offer(), { kind: 'shown', root: a, choice: 'project' });
    configure([a, b]); // Later session, same IDE state.
    answer = undefined;
    assert.deepEqual(await api.skill.offer(), { kind: 'shown', root: b, choice: 'dismissed' });
    configure([a]);
    assert.deepEqual(await api.skill.offer(), { kind: 'skipped', reason: 'no-target' });
    answer = "Don't Ask Again";
    configure([b]);
    assert.deepEqual(await api.skill.offer(), { kind: 'shown', root: b, choice: 'never' });
    assert.equal(state.get('walkMeThrough.skillOffer.never'), true);
    assert.equal((state.get<string[]>('walkMeThrough.skillOffer.dismissedRoots') ?? []).length, 1);
    const c = repo('c');
    configure([c]);
    assert.deepEqual(await api.skill.offer(), { kind: 'skipped', reason: 'never' });
    assert.deepEqual([files(a), files(b), files(c)], [[], [], []]);
    assert.equal((await vscode.commands.executeCommand<InstallOutcome>('walkMeThrough.installSkill')).kind, 'installed');
    assert.ok(existsSync(path.join(c, SKILL, 'SKILL.md')));
  });
});
