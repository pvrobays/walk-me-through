import type * as vscode from 'vscode';

export type OpenOutcome = 'opened' | 'step-missing' | 'superseded';
export interface OpenOptions {
  /** Step to select after opening; unknown steps leave the overview and report `step-missing`. */
  stepId?: string;
  /** Refuse to replace the session when the file's ID differs (launch links). */
  expectedId?: string;
  /** Request generation from the caller; a fresh one is allocated when omitted. */
  request?: number;
}
export type OpenArtifact = (uri: vscode.Uri, options?: OpenOptions) => Promise<OpenOutcome>;
