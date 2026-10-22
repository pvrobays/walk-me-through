import * as vscode from 'vscode';
import path from 'node:path';
import { MESSAGES, hasSkill, installSkill, resolveTargets, type InstallOutcome, type SkillTarget } from './skill';

export const OFFER_NEVER_KEY = 'walkMeThrough.skillOffer.never';
export const OFFER_DISMISSED_KEY = 'walkMeThrough.skillOffer.dismissedRoots';
export const OFFER_ACTIONS = { install: 'Install', project: 'Not for This Project', never: "Don't Ask Again" } as const;
export const SKILL_BANNER = "The Walk Me Through skill is not installed in this project, so your AI agent can't create walkthroughs here.";
export const SKILL_TREE_MESSAGE = "Project skill not installed: your AI agent can't create walkthroughs here. Use Install Skill in the Step view, or run Walk Me Through: Install Skill into Project.";

export interface SkillHost {
  /** Local (`file:`) workspace folders. */
  folders(): readonly vscode.Uri[];
  isTrusted(): boolean;
  /** Local-desktop refusal, or undefined when installing is allowed. */
  refusal(): string | undefined;
  bundleDir: string;
  /** Application-level state (VS Code `globalState`), never project files. */
  state: vscode.Memento;
  notify(level: 'info' | 'warning' | 'error', message: string, ...actions: string[]): Thenable<string | undefined>;
  pick(targets: readonly SkillTarget[]): Thenable<SkillTarget | undefined>;
}

export type OfferResult =
  | { kind: 'skipped'; reason: 'untrusted' | 'environment' | 'never' | 'no-target' }
  | { kind: 'shown'; root: string; choice: 'install' | 'project' | 'never' | 'dismissed'; install?: InstallOutcome };

const rootKey = (root: string) => process.platform === 'win32' ? root.toLowerCase() : root;

export function defaultSkillHost(context: vscode.ExtensionContext, refusal: () => string | undefined): SkillHost {
  return {
    folders: () => (vscode.workspace.workspaceFolders ?? []).map(folder => folder.uri).filter(uri => uri.scheme === 'file'),
    isTrusted: () => vscode.workspace.isTrusted,
    refusal,
    bundleDir: path.join(context.extensionPath, 'skill'),
    state: context.globalState,
    notify: (level, message, ...actions) => level === 'error' ? vscode.window.showErrorMessage(message, ...actions)
      : level === 'warning' ? vscode.window.showWarningMessage(message, ...actions) : vscode.window.showInformationMessage(message, ...actions),
    pick: async targets => (await vscode.window.showQuickPick(targets.map(target => ({ label: path.basename(target.root) || target.root, description: target.root, target })), {
      title: 'Install Skill into Project', placeHolder: 'Choose the project that receives .agents/skills/walk-me-through/',
    }))?.target,
  };
}

export class SkillOnboarding {
  /** Roots already offered in this session; at most one offer per root per session. */
  private readonly offered = new Set<string>();
  private readonly installed = new vscode.EventEmitter<InstallOutcome>();
  /** Fires after every install attempt that reached the file system, so views can refresh their banner. */
  readonly onDidInstall = this.installed.event;

  constructor(private host: SkillHost) {}

  dispose(): void { this.installed.dispose(); }

  /** First Git target lacking SKILL.md, ignoring offer dismissals; undefined where installing is refused. Drives the view banner. */
  missingTarget(): SkillTarget | undefined {
    if (this.host.refusal()) return undefined;
    return resolveTargets(this.host.folders().map(uri => uri.fsPath)).find(target => target.inGit && !hasSkill(target.root));
  }

  setHost(host: SkillHost): void { this.host = host; this.offered.clear(); }

  private report(outcome: InstallOutcome): void {
    void this.host.notify(outcome.kind === 'refused' ? 'warning' : 'info', outcome.message);
  }

  private run(root: string): InstallOutcome | undefined {
    try { const outcome = installSkill(root, this.host.bundleDir); this.report(outcome); this.installed.fire(outcome); return outcome; }
    catch (error) { void this.host.notify('error', `Cannot install the Walk Me Through skill: ${String(error)}`); return undefined; }
  }

  /** Walk Me Through: Install Skill into Project. Works in Restricted Mode and after any dismissal. */
  async install(): Promise<InstallOutcome | undefined> {
    if (this.host.refusal()) { void this.host.notify('error', MESSAGES.unsupported); return undefined; }
    const targets = resolveTargets(this.host.folders().map(uri => uri.fsPath));
    if (!targets.length) { void this.host.notify('warning', 'Open a local project folder first, then run Install Skill into Project.'); return undefined; }
    const target = targets.length === 1 ? targets[0] : await this.host.pick(targets);
    return target ? this.run(target.root) : undefined;
  }

  dismissedRoots(): string[] { return this.host.state.get<string[]>(OFFER_DISMISSED_KEY, []); }

  /** Shows the missing-skill offer for the first eligible Git root, if any. */
  async offer(): Promise<OfferResult> {
    if (!this.host.isTrusted()) return { kind: 'skipped', reason: 'untrusted' };
    if (this.host.refusal()) return { kind: 'skipped', reason: 'environment' };
    if (this.host.state.get<boolean>(OFFER_NEVER_KEY, false)) return { kind: 'skipped', reason: 'never' };
    const dismissed = new Set(this.dismissedRoots());
    const target = resolveTargets(this.host.folders().map(uri => uri.fsPath))
      .find(candidate => candidate.inGit && !this.offered.has(rootKey(candidate.root)) && !dismissed.has(rootKey(candidate.root)) && !hasSkill(candidate.root));
    if (!target) return { kind: 'skipped', reason: 'no-target' };
    const key = rootKey(target.root);
    this.offered.add(key);
    const choice = await this.host.notify('info',
      `Coding agents need the Walk Me Through project skill to create walkthroughs for ${path.basename(target.root) || target.root}. Install it into .agents/skills/walk-me-through/?`,
      OFFER_ACTIONS.install, OFFER_ACTIONS.project, OFFER_ACTIONS.never);
    if (choice === OFFER_ACTIONS.install) return { kind: 'shown', root: target.root, choice: 'install', install: this.run(target.root) };
    if (choice === OFFER_ACTIONS.project) {
      await this.host.state.update(OFFER_DISMISSED_KEY, [...dismissed, key]);
      return { kind: 'shown', root: target.root, choice: 'project' };
    }
    if (choice === OFFER_ACTIONS.never) {
      await this.host.state.update(OFFER_NEVER_KEY, true);
      return { kind: 'shown', root: target.root, choice: 'never' };
    }
    return { kind: 'shown', root: target.root, choice: 'dismissed' };
  }
}
