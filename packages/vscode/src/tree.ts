import * as vscode from 'vscode';
import type { Step } from '@walk-me-through/core/artifact';
import type { Resolution } from '@walk-me-through/core/resolve';
import { Session } from './session';
import { SKILL_TREE_MESSAGE } from './skillOnboarding';

export class StepsTree implements vscode.TreeDataProvider<string>, vscode.Disposable {
  private readonly changed = new vscode.EventEmitter<string | undefined>();
  readonly onDidChangeTreeData = this.changed.event;
  private readonly states = new Map<string, Resolution['state']>();
  private activeId?: string;
  readonly view: vscode.TreeView<string>;
  private readonly subscription: vscode.Disposable;
  constructor(private readonly session: Session, private readonly skillMissing: () => boolean = () => false) {
    this.view = vscode.window.createTreeView('walkMeThrough.steps', { treeDataProvider: this, showCollapseAll: true });
    this.refreshMessage();
    const subscription = session.onDidChange(() => {
      if (this.activeId !== session.artifact?.id) { this.states.clear(); this.activeId = session.artifact?.id; }
      if (session.current && session.lastResolution) this.states.set(session.current.id, session.lastResolution.state);
      this.view.title = session.artifact?.title ?? 'Steps';
      this.refreshMessage();
      this.changed.fire(undefined);
      if (session.isActive) void this.view.reveal(session.current?.id ?? 'overview', { select: true, focus: false, expand: true }).then(undefined, () => {});
    });
    this.subscription = vscode.Disposable.from(subscription, this.view.onDidChangeVisibility(event => { if (event.visible) this.refreshMessage(); }));
  }
  /** The top message carries the missing-skill banner; otherwise the empty-state hint. */
  refreshMessage(): void {
    this.view.message = this.skillMissing() ? SKILL_TREE_MESSAGE : this.session.isActive ? undefined : 'Open a walkthrough to start.';
  }
  getChildren(id?: string): string[] {
    if (!this.session.artifact) return [];
    const steps = this.session.artifact.steps;
    if (!id) return ['overview', ...steps.filter(step => !step.parentId).map(step => step.id)];
    return steps.filter(step => step.parentId === id).map(step => step.id);
  }
  getParent(id: string): string | undefined { return this.step(id)?.parentId ?? undefined; }
  private step(id: string): Step | undefined { return this.session.artifact?.steps.find(step => step.id === id); }
  getTreeItem(id: string): vscode.TreeItem {
    const step = this.step(id);
    const item = new vscode.TreeItem(id === 'overview' ? 'Overview' : step?.title ?? id,
      this.getChildren(id).length ? vscode.TreeItemCollapsibleState.Collapsed : vscode.TreeItemCollapsibleState.None);
    item.id = id; item.command = { command: 'walkMeThrough.goToStep', title: 'Go to Step', arguments: [id] };
    const current = (this.session.current?.id ?? 'overview') === id;
    const state = this.states.get(id);
    const icon = state === 'stale' ? 'error' : state === 'uncertain' ? 'warning' : step?.location ? 'code' : 'note';
    item.iconPath = new vscode.ThemeIcon(icon, state === 'stale' ? new vscode.ThemeColor('errorForeground') : undefined);
    item.description = [state, current ? '$(debug-stackframe) current' : undefined].filter(Boolean).join(' · ');
    item.tooltip = `${item.label}${state ? ` — ${state}` : ''}${current ? ' — current step' : ''}`;
    return item;
  }
  dispose(): void { this.subscription.dispose(); this.view.dispose(); this.changed.dispose(); }
}
