import type * as vscode from 'vscode';
import type { LaunchOutcome } from './launch';
import type { SessionState } from './session';
import type { InstallOutcome } from './skill';
import type { OfferResult, SkillHost } from './skillOnboarding';
export interface TestApi {
  getState(): SessionState;
  /** Runs the registered launch handler, optionally against substitute workspace folders (multi-root cases). */
  launch(uri: vscode.Uri, folders?: readonly vscode.Uri[]): Promise<LaunchOutcome>;
  skill: {
    /** Substitutes parts of the skill host (folders, UI, trust); `undefined` restores the real host. Clears the per-session offer memory. */
    configure(overrides?: Partial<SkillHost>): void;
    /** Runs the missing-skill offer, which is not started automatically in test mode. */
    offer(): Promise<OfferResult>;
    install(): Promise<InstallOutcome | undefined>;
    /** Step-view HTML (undefined until the view is resolved) and the Steps tree message, which carry the missing-skill banner. */
    banner(): { stepView: string | undefined; treeMessage: string | undefined };
    /** Sends the banner's Install Skill button message to the Step view. */
    pressBannerInstall(): Promise<void>;
  };
}
