# Design

## Context

See `proposal.md` for motivation. The accepted implementation already stores v1 steps in depth-first order with `parentId` links and a four-level limit. `packages/vscode/src/session.ts` exposes an overview at index 0 followed by the stored steps. Next/Previous simply adjust that index; `tree.ts` reveals ancestors independently of collapse state. `extension.ts` provides a generation-guarded display path that clears comments/highlights and resolves current buffers.

`stepView.ts` renders narrative explanations and anchor-state banners with theme variables and a strict CSP. `comments.ts` currently adds a warning icon, bold uncertainty label, long notice, and horizontal separator. The Step-view notice currently uses main-size text. Stale error styling and the skill's leading walkthrough-delivery section were accepted during the previous session.

There are no main specs yet: the baseline contracts live in completed change `add-walkthrough-vertical-slice`. This change adds narrowly scoped capability specs without altering that completed change. It can be implemented before or after baseline archival; later archival should retain both sets of contracts. Native Windows is the acceptance platform; Linux is unofficially supported.

## Goals / Non-Goals

**Goals:**
- Reuse parent links for a short reading path and optional depth, without artifact migration.
- Make one explicit skip action predictable at every nesting depth while keeping existing navigation stable.
- Reduce warning visual weight within the typography controls each surface actually exposes.

**Non-Goals:**
- Persistent reading modes, global depth filters, history-based Previous, automatic seniority detection, or new keyboard shortcuts.
- Enforcing semantic writing quality with schema checks or arbitrary word limits.
- Altering anchor matching, the stale error presentation, or successful reply ordering.

## Decisions

### 1. Progressive depth is authoring guidance, not a new data model

Update `packages/skill/SKILL.md` and `references/walkthrough-format.md` to explain a complete concise top-level narrative with essential caveats, supported by optional evidence/deep-dive children. Preserve precise minimal source ranges, nested-leaf location rules, and honest evidence labels. Do not require all explanations to nest. Keep the normal answer at the user's requested depth and its leading opening section.

Restructure `examples/sample-project/walkthrough-input.json` so a reader who bypasses children still understands the retry loop, the constant-zero argument, the consequence, and the untested repair. Children should provide additional helper/call-site evidence, including an expression selection, rather than repeat the parent text. Update the reference example to match real source and retain a multiline selection somewhere in the sample. Regenerate the bundle manifest through the existing build; no schema/version bump is necessary for this unreleased development refinement.

Alternative: a new detail-level field or auto-filtering mode would duplicate the already useful hierarchy and require format/player changes. A fixed sentence limit could hide important caveats; choose concise writing guidance and human acceptance instead.

### 2. One explicit Skip Details action

Use command ID `walkMeThrough.skipDetails`, label **Walk Me Through: Skip Details**. Expose a single session-level target calculation shared by availability and invocation; avoid divergent algorithms in menus and the webview.

For a current step, find the next step after its contiguous subtree in the validated depth-first sequence. That target is its next sibling or the next branch of its closest ancestor that has one. For the overview, target the first top-level step. No target means a no-op. A leaf therefore advances to the following branch; an ancestor's final child can exit to a later top-level step. At the last top-level branch, the action can be unavailable even if ordinary Next still has descendants to visit.

Example order: `A, A1, A1a, A2, B, B1`.

| Current | Skip Details | Next |
| --- | --- | --- |
| Overview | A | A |
| A | B | A1 |
| A1 | A2 | A1a |
| A1a | A2 | A2 |
| A2 | B | B |
| B | no-op | B1 |
| B1 | no-op | no-op |

Use `goToStep`/the established refresh path for the selected target. Recalculate context key `walkMeThrough.canSkipDetails` on open, navigation, replace, and close; add corresponding Step-view state. Comments/Command Palette use availability conditions, and the Step-view button is disabled without a target. An inactive direct command also no-ops. Preserve existing generation guards rather than introducing an independent rendering path.

Expose the action in the Step view footer, comment-thread title menu, and Command Palette, with an explanatory tooltip/accessibility label: “Skip nested details and continue to the next available branch.” Use a wrapping footer so three navigation controls remain usable in a narrow sidebar. Tree collapse remains presentation-only. Previous after a skip still returns to the preceding depth-first step, not the skip origin; document this explicitly.

Alternative: replacing Next or making collapse control traversal would break accepted behavior. A persistent “senior mode” adds state and ambiguity. Separate next-sibling/ascend/skip commands add complexity; one branch-skip operation covers the immediate need.

### 3. Compact uncertainty without concealing uncertainty

Keep `resolutionNotice` as the shared wording source. Suggested base text: “Original location unconfirmed; showing the closest identical code.” For ties append “Equally near matches; the earlier one is shown.” Keep an explicit **Uncertain location** label as plain, normal-weight text in comments, alongside the warning icon. Remove the bold lead-in and excessive separator treatment for uncertain notices. Keep author-provided explanation Markdown unchanged and untrusted.

Apply approximately `.9em` text size to the Step-view warning only, with compact padding and existing warning theme color. Preserve readable contrast and the warning indicator/text; do not reduce opacity or hide notices in hover/collapsed detail. VS Code owns comment font sizing, so use ordinary paragraph formatting there instead of attempting HTML/CSS or changing user editor settings. Keep the dashed uncertain highlight and tree warning icon. Keep stale error theme styling and informational relocation behavior unchanged.

Alternative: shrinking all notices would weaken the accepted stale state. Hiding warnings or relying only on the dashed border would obscure uncertainty. A new webview comment renderer is unnecessary for this polish.

## Risks / Trade-offs

- Authors may still produce verbose or incomplete top levels → verify with a freshly restarted scratch-project agent and have the owner read only the top-level path; semantic quality is a manual acceptance criterion.
- Skip Details can land on an ancestor's following branch, and Previous is not browser history → explicit tooltip, examples, and boundary tests; no wraparound or implicit completion state.
- Smaller warnings could become difficult to read → moderate relative sizing, theme-aware colors, no reduced opacity, and manual light/dark/high-contrast inspection.
- Comment-header actions may become crowded → use a clear icon/tooltip and confirm discoverability in the Development Host without removing existing controls.

## Migration Plan

1. Implement the session action and surfaces, then authoring/examples and notice polish.
2. Build and run typecheck, unit/script/bundle checks, and extension-host tests on Windows. Keep the existing Linux CI configuration; do not claim native Linux verification.
3. Republish the sample rather than mutating old artifacts. Existing saved v1 artifacts remain valid and gain the navigation action, though their prose will not change.
4. Install the regenerated skill into a scratch project after inspecting any target differences; explicitly authorize replacement only for known test-bundle files. Quit/restart OpenCode before testing new guidance. Record owner acceptance in this change.
5. Rollback is removal of the new navigation/formatting and restoration of prior skill/examples; no stored data migration is involved.
