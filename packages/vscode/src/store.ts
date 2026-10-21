import * as vscode from 'vscode';
import { realpathSync } from 'node:fs';
import path from 'node:path';
import { validateArtifact, type Artifact } from '@walk-me-through/core/artifact';
import { decodeText } from '@walk-me-through/core/text';

export interface ArtifactHeader { uri: vscode.Uri; root: vscode.Uri; title: string; id: string; createdAt: string }
export function projectRoot(uri: vscode.Uri): vscode.Uri {
  const directory = path.dirname(uri.fsPath);
  if (path.basename(directory) !== 'walkthroughs' || path.basename(path.dirname(directory)) !== '.walk-me-through') throw new Error('Choose an artifact under <project>/.walk-me-through/walkthroughs/.');
  return vscode.Uri.file(path.dirname(path.dirname(directory)));
}

export async function discover(folders = vscode.workspace.workspaceFolders?.map(folder => folder.uri) ?? []): Promise<ArtifactHeader[]> {
  const candidates = new Map<string, vscode.Uri>();
  async function direct(root: vscode.Uri): Promise<void> {
    const directory = vscode.Uri.joinPath(root, '.walk-me-through', 'walkthroughs');
    try {
      for (const [name, type] of await vscode.workspace.fs.readDirectory(directory)) {
        if ((type & vscode.FileType.File) && name.endsWith('.json')) {
          const uri = vscode.Uri.joinPath(directory, name); candidates.set(uri.toString(), uri);
        }
      }
    } catch { /* No artifacts in this folder. */ }
  }
  await Promise.all(folders.map(direct));
  for (const uri of await vscode.workspace.findFiles('**/.walk-me-through/walkthroughs/*.json', '**/node_modules/**')) candidates.set(uri.toString(), uri);
  // Search may exclude self-ignored artifact directories. Discover nested project roots independently.
  async function nested(root: vscode.Uri): Promise<void> {
    let entries: [string, vscode.FileType][];
    try { entries = await vscode.workspace.fs.readDirectory(root); } catch { return; }
    for (const [name, type] of entries) {
      if (!(type & vscode.FileType.Directory) || (type & vscode.FileType.SymbolicLink) || ['node_modules', '.git', '.walk-me-through', '.vscode-test'].includes(name)) continue;
      const child = vscode.Uri.joinPath(root, name);
      await direct(child); await nested(child);
    }
  }
  await Promise.all(folders.map(nested));
  const headers: ArtifactHeader[] = [];
  for (const uri of candidates.values()) {
    try {
      const value = JSON.parse(decodeText(await vscode.workspace.fs.readFile(uri)));
      if (typeof value.title === 'string' && typeof value.id === 'string' && typeof value.createdAt === 'string') headers.push({ uri, root: projectRoot(uri), title: value.title, id: value.id, createdAt: value.createdAt });
    } catch { /* Invalid headers are still available through Browse. */ }
  }
  return headers.sort((a, b) => b.createdAt.localeCompare(a.createdAt) || b.id.localeCompare(a.id));
}

export async function loadArtifact(uri: vscode.Uri): Promise<{ artifact: Artifact; root: vscode.Uri; rootWarning?: string }> {
  let value: unknown;
  try { value = JSON.parse(decodeText(await vscode.workspace.fs.readFile(uri))); }
  catch (error) { throw new Error(`${uri.fsPath}: cannot read walkthrough JSON: ${String(error)}`); }
  const result = validateArtifact(value);
  if (!result.ok) throw new Error(`${uri.fsPath}: ${result.errors.slice(0, 5).map(error => `${error.path}: ${error.message}`).join('\n')}`);
  const root = projectRoot(uri);
  const canonical = (value: string) => {
    let resolved = path.resolve(value);
    try { resolved = realpathSync.native(resolved); } catch { /* A recorded checkout may no longer exist. */ }
    return process.platform === 'win32' ? resolved.toLowerCase() : resolved;
  };
  const rootWarning = canonical(root.fsPath) !== canonical(result.value.project.root)
    ? `Walkthrough checkout moved: recorded root "${result.value.project.root}"; playing from "${root.fsPath}".` : undefined;
  return { artifact: result.value, root, rootWarning };
}
