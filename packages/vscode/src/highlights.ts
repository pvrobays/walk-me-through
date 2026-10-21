import * as vscode from 'vscode';

export class Highlights implements vscode.Disposable {
  private readonly confident = vscode.window.createTextEditorDecorationType({ backgroundColor: new vscode.ThemeColor('walkMeThrough.highlightBackground'), rangeBehavior: vscode.DecorationRangeBehavior.ClosedClosed });
  private readonly uncertain = vscode.window.createTextEditorDecorationType({ backgroundColor: new vscode.ThemeColor('walkMeThrough.highlightBackground'), border: '1px dashed', borderColor: new vscode.ThemeColor('walkMeThrough.uncertainBorder'), rangeBehavior: vscode.DecorationRangeBehavior.ClosedClosed });
  private current?: { uri: vscode.Uri; range: vscode.Range; style: 'confident' | 'uncertain' };
  private readonly visibility = vscode.window.onDidChangeVisibleTextEditors(() => this.apply());
  show(uri: vscode.Uri, range: vscode.Range, style: 'confident' | 'uncertain'): void {
    this.clear(); this.current = { uri, range, style }; this.apply();
  }
  private apply(): void {
    if (!this.current) return;
    const decoration = this.current.style === 'uncertain' ? this.uncertain : this.confident;
    for (const editor of vscode.window.visibleTextEditors) {
      if (editor.document.uri.toString() === this.current.uri.toString()) editor.setDecorations(decoration, [this.current.range]);
    }
  }
  getState() { return this.current ? { range: this.current.range, style: this.current.style } : undefined; }
  clear(): void {
    for (const editor of vscode.window.visibleTextEditors) { editor.setDecorations(this.confident, []); editor.setDecorations(this.uncertain, []); }
    this.current = undefined;
  }
  dispose(): void { this.clear(); this.visibility.dispose(); this.confident.dispose(); this.uncertain.dispose(); }
}
