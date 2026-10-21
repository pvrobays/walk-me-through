import * as vscode from 'vscode';
import type { Artifact, Step } from '@walk-me-through/core/artifact';
import type { Resolution } from '@walk-me-through/core/resolve';

export interface SessionState {
  activeId?: string;
  currentStepId?: string;
  index?: number;
  canSkipDetails?: boolean;
  lastResolution?: Resolution;
  thread?: unknown;
  decoration?: unknown;
  view?: unknown;
}
export class Session implements vscode.Disposable {
  artifact?: Artifact;
  root?: vscode.Uri;
  index = 0;
  lastResolution?: Resolution;
  private generation = 0;
  private readonly changed = new vscode.EventEmitter<void>();
  readonly onDidChange = this.changed.event;
  show: (step: Step | undefined, generation: number) => Promise<void> = async () => {};
  clearPresentation: () => void = () => {};
  get current(): Step | undefined { return this.artifact?.steps[this.index - 1]; }
  get isActive(): boolean { return !!this.artifact; }
  get skipDetailsTarget(): Step | undefined {
    const steps = this.artifact?.steps;
    if (!steps) return undefined;
    const current = this.current;
    if (!current) return steps[0];
    const subtree = new Set([current.id]);
    for (const step of steps.slice(this.index)) {
      if (!step.parentId || !subtree.has(step.parentId)) return step;
      subtree.add(step.id);
    }
    return undefined;
  }
  isCurrent(generation: number): boolean { return generation === this.generation; }

  async open(artifact: Artifact, root: vscode.Uri): Promise<void> {
    this.clearPresentation(); this.artifact = artifact; this.root = root; this.index = 0;
    await this.refresh();
  }
  async close(): Promise<void> {
    this.generation++; this.clearPresentation(); this.artifact = undefined; this.root = undefined;
    this.index = 0; this.lastResolution = undefined;
    await this.context(); this.changed.fire();
  }
  async next(): Promise<void> {
    if (this.artifact && this.index < this.artifact.steps.length) { this.index++; await this.refresh(); }
  }
  async previous(): Promise<void> {
    if (this.artifact && this.index > 0) { this.index--; await this.refresh(); }
  }
  async skipDetails(): Promise<void> {
    const target = this.skipDetailsTarget;
    if (target) await this.goToStep(target.id);
  }
  async goToStep(id: string): Promise<void> {
    if (!this.artifact) return;
    const index = id === 'overview' ? 0 : this.artifact.steps.findIndex(step => step.id === id) + 1;
    if (index === 0 && id !== 'overview') return;
    this.index = index; await this.refresh();
  }
  async refresh(): Promise<void> {
    if (!this.artifact) return;
    const generation = ++this.generation;
    this.clearPresentation(); this.lastResolution = undefined;
    await this.show(this.current, generation);
    if (!this.isCurrent(generation)) return;
    await this.context(); this.changed.fire();
  }
  private async context(): Promise<void> {
    await Promise.all([
      vscode.commands.executeCommand('setContext', 'walkMeThrough.active', this.isActive),
      vscode.commands.executeCommand('setContext', 'walkMeThrough.hasPrevious', this.isActive && this.index > 0),
      vscode.commands.executeCommand('setContext', 'walkMeThrough.hasNext', !!this.artifact && this.index < this.artifact.steps.length),
      vscode.commands.executeCommand('setContext', 'walkMeThrough.canSkipDetails', !!this.skipDetailsTarget),
    ]);
  }
  getState(): SessionState {
    return this.artifact ? { activeId: this.artifact.id, currentStepId: this.current?.id ?? 'overview', index: this.index, canSkipDetails: !!this.skipDetailsTarget, lastResolution: this.lastResolution } : {};
  }
  dispose(): void { this.generation++; this.clearPresentation(); this.changed.dispose(); }
}
