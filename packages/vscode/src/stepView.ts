import * as vscode from 'vscode';
import { randomBytes } from 'node:crypto';
import { Session } from './session';
import { resolutionNotice } from './comments';
import { escapeHtml, renderMarkdown } from './markdown';

export interface StepViewState { title: string; breadcrumb: string; position: string; banner: string; bannerKind: 'error' | 'warning' | 'info'; explanation?: string; hasPrevious: boolean; hasNext: boolean; canSkipDetails: boolean }
export class StepView implements vscode.WebviewViewProvider, vscode.Disposable {
  private view?: vscode.WebviewView;
  private readonly changed: vscode.Disposable;
  private messages?: vscode.Disposable;
  constructor(private readonly session: Session) { this.changed = session.onDidChange(() => this.update()); }
  getState(): StepViewState | undefined {
    const artifact = this.session.artifact;
    if (!artifact) return undefined;
    const step = this.session.current;
    const parents: string[] = [];
    let ancestor = step;
    while (ancestor) {
      parents.unshift(ancestor.title);
      ancestor = artifact.steps.find(candidate => candidate.id === ancestor?.parentId);
    }
    const resolution = this.session.lastResolution;
    const stale = resolution?.state === 'stale';
    return {
      title: step?.title ?? artifact.title,
      breadcrumb: [artifact.title, ...parents].join(' › '),
      position: `Step ${this.session.index} of ${artifact.steps.length}`,
      banner: stale ? `Stale — original code not found; it may have changed since generation. ${step!.location!.path}:${step!.location!.range.start.line + 1}. No source highlighted.`
        : resolutionNotice(resolution) || (step?.location ? 'Exact location' : step ? 'Narrative step' : 'Overview'),
      bannerKind: stale ? 'error' : resolution?.state === 'uncertain' ? 'warning' : 'info',
      explanation: !step ? artifact.summary : !step.location || stale ? step.explanation : undefined,
      hasPrevious: this.session.index > 0, hasNext: this.session.index < artifact.steps.length,
      canSkipDetails: !!this.session.skipDetailsTarget,
    };
  }
  resolveWebviewView(view: vscode.WebviewView): void {
    this.view = view; view.webview.options = { enableScripts: true, localResourceRoots: [] };
    this.messages?.dispose();
    this.messages = view.webview.onDidReceiveMessage(async message => {
      if (!message || typeof message !== 'object') return;
      if (message.type === 'next') await this.session.next();
      else if (message.type === 'previous') await this.session.previous();
      else if (message.type === 'skipDetails') await this.session.skipDetails();
      else if (message.type === 'link' && typeof message.href === 'string') {
        try {
          const uri = vscode.Uri.parse(message.href, true);
          if (uri.scheme === 'http' || uri.scheme === 'https') await vscode.env.openExternal(uri);
        } catch { /* Ignore malformed and unsupported links. */ }
      }
    });
    view.onDidDispose(() => { if (this.view === view) this.view = undefined; this.messages?.dispose(); });
    this.update();
  }
  private update(): void {
    if (!this.view) return;
    const webview = this.view.webview; const state = this.getState();
    const nonce = randomBytes(18).toString('base64');
    const navigationStyle = 'footer{flex-wrap:wrap}aside.warning{font-size:.9em;padding:6px;color:var(--vscode-editorWarning-foreground)}aside.warning::before{content:"⚠ "}';
    const content = state ? `<nav>${escapeHtml(state.breadcrumb)}</nav><h2>${escapeHtml(state.title)}</h2><p>${escapeHtml(state.position)}</p><aside class="${state.bannerKind}" role="status">${escapeHtml(state.banner)}</aside><div>${state.explanation ? renderMarkdown(state.explanation) : '<p>The explanation is beside the highlighted code.</p>'}</div><footer><button data-action="previous" ${state.hasPrevious ? '' : 'disabled'}>Previous</button><button data-action="next" ${state.hasNext ? '' : 'disabled'}>Next</button><button data-action="skipDetails" title="Skip nested details and continue to the next available branch." aria-label="Skip Details: Skip nested details and continue to the next available branch." ${state.canSkipDetails ? '' : 'disabled'}>Skip Details</button></footer>` : '<p>Open a walkthrough to start.</p>';
    webview.html = `<!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource} 'nonce-${nonce}'; script-src 'nonce-${nonce}';"><style nonce="${nonce}">body{font-family:var(--vscode-font-family);color:var(--vscode-foreground);padding:12px}nav{font-size:.85em;color:var(--vscode-descriptionForeground)}aside{padding:8px;border-left:3px solid var(--vscode-editorInfo-foreground);background:var(--vscode-textBlockQuote-background)}aside.warning{border-color:var(--vscode-editorWarning-foreground)}aside.error{border-color:var(--vscode-editorError-foreground);color:var(--vscode-errorForeground)}pre{overflow:auto;padding:8px;background:var(--vscode-textCodeBlock-background)}a{color:var(--vscode-textLink-foreground)}footer{display:flex;gap:8px;margin-top:16px}button{color:var(--vscode-button-foreground);background:var(--vscode-button-background);border:0;padding:6px 12px}button:disabled{opacity:.5}${navigationStyle}</style></head><body>${content}<script nonce="${nonce}">const vscode=acquireVsCodeApi();document.addEventListener('click',event=>{const target=event.target.closest('a,button');if(!target)return;if(target.tagName==='A'){event.preventDefault();vscode.postMessage({type:'link',href:target.getAttribute('href')});}else if(!target.disabled){vscode.postMessage({type:target.dataset.action});}});</script></body></html>`;
  }
  dispose(): void { this.changed.dispose(); this.messages?.dispose(); }
}
