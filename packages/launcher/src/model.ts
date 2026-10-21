// Pure fragment -> view model. No DOM access, so it is unit-tested without a browser.
import { decodeEnvelope, riderUri, vscodeUri, type LaunchProblem } from '@walk-me-through/core/launch';
import type { Ide } from './config';

export type LaunchState = 'ready' | 'missing' | 'invalid' | 'too-long' | 'newer';
export interface LaunchView {
  state: LaunchState;
  heading: string;
  message: string;
  /** Display title: the envelope title, or the ID when there is none. Display-only, never authoritative. */
  title?: string;
  id?: string;
  root?: string;
  step?: string;
  hrefs?: Record<Ide, string>;
  problems: LaunchProblem[];
}

const FRESH_LINK = 'Ask your coding agent for a fresh walkthrough link, or open the walkthrough with Walk Me Through: Open Walkthrough in your IDE.';

/** `hash` is `location.hash` (with or without the leading `#`). Query parameters are never consulted. */
export function viewFromFragment(hash: string): LaunchView {
  const encoded = hash.startsWith('#') ? hash.slice(1) : hash;
  if (!encoded) {
    return { state: 'missing', heading: 'No walkthrough in this link', message: `This page opens saved walkthroughs from links that include launch data after "#". ${FRESH_LINK}`, problems: [] };
  }
  const result = decodeEnvelope(encoded);
  if (!result.ok) {
    if (result.category === 'unsupported-version') {
      return { state: 'newer', heading: 'This link needs a newer Walk Me Through', message: 'The link was produced by a newer Walk Me Through version than this page supports. Reload this page to get the latest launcher, or open the walkthrough with Walk Me Through: Open Walkthrough in your IDE.', problems: result.problems };
    }
    if (result.category === 'too-long') {
      return { state: 'too-long', heading: 'This link is too long', message: `The launch data is longer than walkthrough links allow, so it was not read. ${FRESH_LINK}`, problems: result.problems };
    }
    return { state: 'invalid', heading: 'This walkthrough link is damaged', message: `The launch data is incomplete or invalid. The link may have been truncated or edited when it was copied. ${FRESH_LINK}`, problems: result.problems };
  }
  const { envelope } = result;
  return {
    state: 'ready',
    heading: 'Open walkthrough',
    message: 'Choose the IDE that has this project open. Nothing opens until you choose.',
    title: envelope.title?.trim() ? envelope.title : envelope.id,
    id: envelope.id,
    root: envelope.root,
    ...(envelope.step !== undefined ? { step: envelope.step } : {}),
    hrefs: { vscode: vscodeUri(encoded), rider: riderUri(encoded) },
    problems: [],
  };
}

export function parsePreference(value: string | null | undefined): Ide | undefined {
  return value === 'vscode' || value === 'rider' ? value : undefined;
}
