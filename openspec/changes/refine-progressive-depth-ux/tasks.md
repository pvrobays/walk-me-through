# Tasks

## 1. Explicit branch skipping

- [x] 1.1 Add shared Skip Details target calculation and session navigation, including overview, nested siblings, ancestor exits, final branches, and inactive no-ops; verify with a branched four-level fixture and confirm Next/Previous retain depth-first semantics, including Previous immediately after a skip.
- [x] 1.2 Register `walkMeThrough.skipDetails`, contribute its Command Palette/comment-header controls, and maintain `walkMeThrough.canSkipDetails` across open, navigate, replace, and close; verify extension-host command execution, availability state, and no stale target after replacing or closing a walkthrough.
- [x] 1.3 Add a disabled-at-boundary Skip Details button with explanatory tooltip/accessibility text to the Step view and make its footer wrap in narrow layouts; document branch-skip versus depth-first Previous semantics in README. Verify Step-view state/message dispatch and normal target presentation/cleanup, including unsaved source resolution and ancestor reveal.

## 2. Progressive-depth authoring

- [x] 2.1 Update canonical skill guidance and format reference so top-level steps carry a concise complete account and essential caveats, with optional nonduplicative evidence/deep dives below; verify consistency with existing four-level/location rules and preservation of requested normal-answer depth and the leading Walkthrough available section.
- [x] 2.2 Refresh sample walkthrough input and the reference example to demonstrate both reading paths, precise expression and multiline selections, and an explicitly unverified proposed repair; verify publishing of both examples and manually inspect that the top-level sequence stands alone without requiring children.
- [x] 2.3 Rebuild the bundle/manifest and update README authoring/reading guidance; verify `npm run build` and `npm run check:bundle`, and confirm the existing reference publishing test passes without input/artifact schema changes.

## 3. Quieter uncertainty notices

- [x] 3.1 Compact shared uncertainty/tie wording and remove the bold comment warning lead-in/excessive separator treatment while keeping the warning icon, explicit uncertainty, and closest-identical-code meaning; verify comment/Step-view coverage for ordinary uncertainty and ties, with untrusted Markdown settings unchanged.
- [x] 3.2 Apply moderately smaller theme-aware Step-view uncertainty styling without reducing opacity or changing stale/relocated styling; document the comment-font limitation and preserved warning semantics. Verify view state for uncertain/stale/relocated cases and existing highlight/comment cleanup tests; leave visual sizing acceptance to the manual check below.

## 4. Integrated acceptance

- [x] 4.1 Run `npm run build`, `npm run typecheck`, `npm test`, and `npm run test:extension` on native Windows, plus strict OpenSpec validation; record actual platform/versions/results in this change. Linux remains unofficially supported and is not a required acceptance run.
- [x] 4.2 Drive a manual Development Host check with the owner: concise path via Skip Details, full path via Next, all three skip control surfaces, nested ancestor exits, end boundaries, return to skipped details, and readable narrow-sidebar controls. Compare compact uncertainty in light/dark/high-contrast themes and confirm the accepted red stale presentation remains intact; record observations before marking complete.
- [x] 4.3 Install the updated bundle into a scratch project after reviewing target differences, have the owner quit/restart OpenCode, and request a multi-location explanation without prescribing the outline. Verify skill discovery, successful publishing, leading walkthrough delivery, a self-contained concise top-level path, and genuinely additive child evidence; record the owner’s acceptance of both reading paths before marking complete.

## Workflow follow-up

- Implement in a fresh session with `/opsx-apply refine-progressive-depth-ux` from the repository root. Read the accepted baseline contracts in `add-walkthrough-vertical-slice` (or their main specs/archive if already archived) and preserve existing user changes.
- If the baseline is still unarchived, archive it separately when requested. Archival is not an implementation prerequisite, and no automatic commit/archive is authorized by this plan.
- After implementation and owner acceptance, review and archive this change when requested.
- Continue with HTTPS launcher/launch envelope and correct-window routing in subsequent changes.
