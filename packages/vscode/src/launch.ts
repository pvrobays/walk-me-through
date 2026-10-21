// Launch-link handling for vscode://pvrobays.walk-me-through/open?e=<envelope>.
// Plays only when the receiving window already contains the recorded checkout; otherwise it shows a notice and
// leaves the workspace and session untouched. Opening/focusing other windows belongs to the routing change.
import * as vscode from 'vscode';
import { existsSync, realpathSync } from 'node:fs';
import path from 'node:path';
import { decodeEnvelope, type LaunchEnvelope } from '@walk-me-through/core/launch';
import type { OpenArtifact } from './open';

export type LaunchOutcomeKind =
  | 'opened' | 'step-missing' | 'superseded'
  | 'invalid-link' | 'newer-version' | 'environment' | 'no-match' | 'artifact-removed' | 'artifact-invalid';
export interface LaunchOutcome { kind: LaunchOutcomeKind; message?: string }
export interface LaunchHost {
  openArtifact: OpenArtifact;
  environmentRefusal: () => string | undefined;
  workspaceFolders: () => readonly vscode.Uri[];
  platform: NodeJS.Platform;
  revealPlayer: () => Thenable<unknown>;
  notify: (level: 'info' | 'warning' | 'error', message: string) => void;
}

const FRESH = 'Ask your coding agent for a fresh walkthrough link, or run Walk Me Through: Open Walkthrough.';

/** Canonical comparison key: real path when it exists, separators normalized, case-folded on Windows. */
export function canonicalPath(value: string, platform: NodeJS.Platform = process.platform): string | undefined {
  let resolved: string;
  try { resolved = realpathSync.native(value); } catch { return undefined; }
  const normalized = platform === 'win32' ? path.win32.normalize(resolved.replace(/\//g, '\\')).toLowerCase() : path.posix.normalize(resolved);
  return normalized.replace(/[\\/]+$/, '') || normalized;
}
/** True when `folder` equals `root` or contains it at a separator boundary. */
export function contains(folder: string, root: string, platform: NodeJS.Platform = process.platform): boolean {
  if (folder === root) return true;
  const separator = platform === 'win32' ? '\\' : '/';
  const prefix = folder.endsWith(separator) ? folder : folder + separator;
  return root.startsWith(prefix);
}

export async function handleLaunchUri(uri: vscode.Uri, host: LaunchHost): Promise<LaunchOutcome> {
  const refuse = (kind: LaunchOutcomeKind, message: string, level: 'warning' | 'error' = 'error'): LaunchOutcome => {
    host.notify(level, message);
    return { kind, message };
  };
  if (uri.path !== '/open') return refuse('invalid-link', `This Walk Me Through link is not valid: unknown path "${uri.path}". ${FRESH}`);
  const encoded = new URLSearchParams(uri.query).get('e');
  if (!encoded) return refuse('invalid-link', `This Walk Me Through link is not valid: it has no launch data. ${FRESH}`);
  const decoded = decodeEnvelope(encoded);
  if (!decoded.ok) {
    if (decoded.category === 'unsupported-version') {
      return refuse('newer-version', 'This walkthrough link was produced by a newer Walk Me Through version. Update the Walk Me Through extension, then open the link again.');
    }
    return refuse('invalid-link', `This Walk Me Through link is not valid (${decoded.problems[0].path}: ${decoded.problems[0].message}) ${FRESH}`);
  }
  const envelope: LaunchEnvelope = decoded.envelope;
  const refusal = host.environmentRefusal();
  if (refusal) return refuse('environment', refusal);
  if (envelope.env.kind !== 'local' || envelope.env.platform !== host.platform) {
    return refuse('environment', `This walkthrough was published in a ${envelope.env.kind} ${envelope.env.platform} environment, but this is local desktop VS Code on ${host.platform}. Walk Me Through plays walkthroughs only in local desktop VS Code on the platform that published them, outside WSL, SSH, containers, and remote hosts.`);
  }
  const root = canonicalPath(envelope.root, host.platform);
  const folders = host.workspaceFolders().filter(folder => folder.scheme === 'file')
    .map(folder => canonicalPath(folder.fsPath, host.platform)).filter((folder): folder is string => folder !== undefined);
  if (!root || !folders.some(folder => contains(folder, root, host.platform))) {
    return refuse('no-match', `This walkthrough belongs to ${envelope.root}, which is not open in this VS Code window. Open that folder in this window (File → Open Folder), or focus the window that has it open, then open the link again.`, 'warning');
  }
  // Only the identified artifact in the recorded checkout's walkthrough directory is ever read.
  const file = path.join(realpathSync.native(envelope.root), '.walk-me-through', 'walkthroughs', `${envelope.id}.json`);
  if (!existsSync(file)) {
    return refuse('artifact-removed', `The saved walkthrough ${envelope.id} was removed. Expected ${file}. ${FRESH}`);
  }
  let outcome;
  try { outcome = await host.openArtifact(vscode.Uri.file(file), { expectedId: envelope.id, stepId: envelope.step }); }
  catch (error) { return refuse('artifact-invalid', `Cannot open walkthrough: ${String(error)}`); }
  if (outcome === 'superseded') return { kind: outcome };
  await host.revealPlayer();
  if (outcome === 'step-missing') {
    const message = `Step "${envelope.step}" was not found in this walkthrough, so it opened at the overview.`;
    host.notify('info', message);
    return { kind: outcome, message };
  }
  return { kind: outcome };
}
