# Verification

## Automated acceptance — 2026-10-21

- Platform: native Windows, `win32 x64`, OS release `10.0.26300`.
- Node: `v24.16.0`; npm: `11.13.0`; OpenSpec: `1.14.3`.
- Extension-test host: VS Code `1.90.2`.
- `npm run build`: passed.
- `npm run typecheck`: passed for core, skill, and extension.
- `npm test`: passed, 45 tests in 16 files; bundle reproducibility/manifest and workflow checks passed.
- `npm run test:extension`: passed, 10 tests. Covers four-level branch targets, no-op boundaries, depth-first traversal/Previous after skipping, command lifecycle/replacement/close, Step-view state/message dispatch, unsaved-buffer target resolution, parent links, uncertainty/tie notices, anchor-state presentation, and comment/highlight cleanup.
- `openspec validate "refine-progressive-depth-ux" --strict`: passed.
- Sample publishing: passed, 6 steps, no warnings. Artifact: `examples/sample-project/.walk-me-through/walkthroughs/20261021T115513717Z-i57ytm.json`.
- Existing reference publishing test: passed, 4 steps. Both examples retain v1 schemas. Source/text inspection confirms the two top-level steps communicate retry behavior, fixed delay, consequences, and the untested repair without requiring children.
- The VS Code test launcher emitted an existing-mutex diagnostic, Node DEP0190, and missing artifact-directory diagnostics for empty/removed test roots; the extension host ran all tests and exited 0.
- Native Linux was not run; it remains unofficially supported.

## Owner Development Host acceptance — accepted (task 4.2)

Owner feedback on 2026-10-21: ran walkthrough `20261021T115513717Z-i57ytm` and reported that it “looks a lot better.” Specific navigation/boundary, narrow-layout, theme/uncertainty, and stale-state observations have not yet been confirmed.

Subsequent owner feedback on 2026-10-21: “i've done some manual tests and those seem fine,” with a request to move to the next feature. Recorded as owner manual acceptance. Detailed per-scenario observations, theme names, and host version were not supplied; the checklist below records the intended checks, not independently observed results.

1. From the repository, press F5 and choose **Walk Me Through sample**. Open **Why retries never back off**, ID `20261021T115513717Z-i57ytm`.
2. Follow the concise path using Skip Details: overview → **Retries run, but the delay never grows** → **Use the attempt counter for exponential backoff**. Confirm it stands alone, including the untested-repair caveat.
3. On the last top-level branch, confirm Skip Details is disabled in the Step view and unavailable in the Command Palette/comment header, while Next still enters children.
4. From the overview follow Next through all six steps. Exercise Skip Details from the Step view, Command Palette, and a code comment header where available. From **The loop owns a zero-based counter** or **Default budget allows two waits**, skipping should exit to **Helper defaults and arithmetic** through an ancestor.
5. After a skip, Previous returns to the preceding depth-first step. Return to a parent and use Next with its tree branch collapsed; confirm details remain accessible and ancestors reveal. Check final Next/Skip boundaries and close cleanup.
6. Narrow the sidebar and confirm all three footer buttons wrap readably, with a useful Skip Details tooltip.
7. To inspect uncertainty without changing disk, enter the repair code step, add an unsaved trailing comment in `retry.ts` (captured context changes but the selected call remains), then run Return to Current Step. Inspect the compact warning/icon and dashed highlight in light, dark, and high-contrast themes.
8. Replace the selected `retryDelay(0)` call in the unsaved buffer so it no longer exists, then return to the step. Confirm red stale presentation, original path/line, explanation, and no highlight/comment. Revert edits afterward.

Owner acceptance is recorded above; no additional per-scenario results are claimed.

## Restarted scratch-project agent acceptance — accepted by owner direction (task 4.3)

On 2026-10-21 the owner explicitly directed: “fresh-agent acceptance task can be marked as done. If necessary we'll finegrain it further in next iterations.” Task 4.3 is closed on that acceptance decision. No new scratch-project installation, restart, artifact, or detailed agent-run evidence was supplied or independently observed in this session. Further authoring refinements belong to subsequent iterations.

The planned acceptance procedure was to review/install the bundle in a scratch project, quit/restart OpenCode, ask a natural multi-location question without prescribing an outline, and inspect discovery, publishing, leading walkthrough delivery, the concise top-level path, and additive child evidence. This procedure is retained as context, not a claim of an observed run.
