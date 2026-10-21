import type * as vscode from 'vscode';
import type { LaunchOutcome } from './launch';
import type { SessionState } from './session';
export interface TestApi {
  getState(): SessionState;
  /** Runs the registered launch handler, optionally against substitute workspace folders (multi-root cases). */
  launch(uri: vscode.Uri, folders?: readonly vscode.Uri[]): Promise<LaunchOutcome>;
}
