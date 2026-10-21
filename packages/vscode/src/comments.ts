import * as vscode from 'vscode';
import type { Step } from '@walk-me-through/core/artifact';
import type { Resolution } from '@walk-me-through/core/resolve';

export function resolutionNotice(resolution?: Resolution): string {
  if (resolution?.state === 'relocated') return 'Code moved: the captured context identifies this location.';
  if (resolution?.state === 'uncertain') return `Uncertain location: Original location unconfirmed; showing the closest identical code.${resolution.tie ? ' Equally near matches; the earlier one is shown.' : ''}`;
  return '';
}

export class Comments implements vscode.Disposable {
  readonly controller = vscode.comments.createCommentController('walk-me-through', 'Walk Me Through');
  thread?: vscode.CommentThread;
  show(uri: vscode.Uri, range: vscode.Range, step: Step, position: number, total: number, resolution: Resolution): void {
    this.clear();
    const notice = resolutionNotice(resolution);
    const body = new vscode.MarkdownString(`${notice ? resolution.state === 'uncertain' ? `$(warning) ${notice}\n\n` : `${notice}\n\n---\n\n` : ''}${step.explanation}`);
    body.isTrusted = false; body.supportHtml = false; body.supportThemeIcons = true;
    this.thread = this.controller.createCommentThread(uri, range, [{ body, mode: vscode.CommentMode.Preview, author: { name: step.title } }]);
    this.thread.canReply = false;
    this.thread.collapsibleState = vscode.CommentThreadCollapsibleState.Expanded;
    this.thread.label = `Step ${position} of ${total}`;
  }
  getState() {
    if (!this.thread) return undefined;
    const body = this.thread.comments[0].body as vscode.MarkdownString;
    return { range: this.thread.range, body: body.value, canReply: this.thread.canReply, isTrusted: body.isTrusted, supportHtml: body.supportHtml };
  }
  clear(): void { this.thread?.dispose(); this.thread = undefined; }
  dispose(): void { this.clear(); this.controller.dispose(); }
}
