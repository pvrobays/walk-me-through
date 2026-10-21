# Tasks

## 1. Monorepo scaffolding

- [ ] 1.1 Add root `package.json`, `tsconfig.base.json`, `.gitignore`, and `.gitattributes`.
  - `package.json`: npm workspaces `packages/*`, plus scripts `build`, `test`, `typecheck`, `check:bundle`, `skill:install`, and `package:vsix`.
  - `.gitignore`: `node_modules`, `dist`, `out`, `*.vsix`, `.vscode-test`, and `/.agents/skills/walk-me-through/`.
  - `.gitattributes`: `* text=auto eol=lf`.
  - Renormalise the existing files.
  - Verify: `npm install` succeeds.
- [ ] 1.2 Create the workspace packages `packages/core` (`@walk-me-through/core`), `packages/skill`, and `packages/vscode`, each with its own `package.json` and `tsconfig.json`.
  - Dev dependencies: TypeScript, esbuild, vitest, `@types/node`, `@types/vscode`, `@vscode/test-cli`, `@vscode/test-electron`, and `@vscode/vsce`.
  - Runtime dependency: `markdown-it`, extension only.
  - Verify: `npm run typecheck` passes on placeholder entry files.
- [ ] 1.3 Add `scripts/build.mjs`.
  - Build `packages/skill/src/cli.ts` into `packages/skill/scripts/publish-walkthrough.mjs`: ESM, node platform, `target: node18`, unminified, with a generated-file banner giving the bundle version and source path.
  - Build `packages/vscode/src/extension.ts` into `packages/vscode/dist/extension.js`: CJS, with `vscode` external.
  - Verify: `npm run build` produces both files.

## 2. Core text, coordinates, and limits

- [ ] 2.1 Implement `text.ts`.
  - Strict UTF-8 decoding.
  - NUL-byte binary detection.
  - BOM stripping.
  - Normalisation of CRLF and lone CR to LF.
  - Line splitting with a VS Code-compatible line count.
  - Normalised SHA-256 file hashing.
  - Verify: vitest covers CRLF, lone CR, BOM, invalid UTF-8, NUL, and trailing newline.
- [ ] 2.2 Implement `coords.ts`.
  - Convert between offsets and positions.
  - Convert 1-based inclusive lines to whole-line 0-based exclusive spans.
  - Verify: vitest covers surrogate pairs, tabs, CRLF and LF parity, BOM files, and end-of-line ends.
- [ ] 2.3 Implement `limits.ts` with the documented constants from design D4.
  - Verify: the constants are exported and referenced by the tests.

## 3. Core artifact model and validation

- [ ] 3.1 Define the v1 artifact types. Implement `validateArtifact`, which collects every error, each with its path, and checks:
  - `schemaVersion` 1 (other versions get an "update the viewer" message).
  - Required identity fields.
  - Unique step IDs.
  - Each `parentId` refers to an earlier step.
  - No cycles.
  - Depth of at most 4.
  - Location rules (top-level and parent steps may omit a location; nested leaves may not).
  - Relative forward-slash paths with no `..` segment or absolute prefix.
  - Well-ordered ranges.
  - Well-formed anchors.
  - Verify: vitest covers each `walkthrough-artifact` scenario, including four levels accepted, the fifth level rejected, a cycle, a location-less parent, a nested leaf without a location, an escaping path, schemaVersion 2, and a reversed range.
- [ ] 3.2 Implement `ids.ts`.
  - Walkthrough IDs: `YYYYMMDDTHHMMSSmmmZ-` followed by 6 base32 characters.
  - Step IDs: `s1…sN`.
  - Verify: vitest checks the format, file and URL safety, and chronological ordering across successive calls with an injected clock.

## 4. Core input validation

- [ ] 4.1 Implement `validateInput` for v1 input.
  - Reject unknown fields.
  - Check required fields, types, the evidence enum, depth of at most 4, location rules, and the size limits.
  - Collect every error, each with a JSON path such as `steps[1].children[0].location`.
  - Verify: vitest covers each `walkthrough-publishing` input scenario, including unknown fields, a fifth level, too many steps, and a nested leaf without a location.
- [ ] 4.2 Implement selection resolution from an input location plus normalised file text.
  - Check line bounds; the error reports the file's actual line count.
  - Select whole lines when there is no `match`.
  - When `match` is given, find exactly one occurrence within the range. The ambiguous-match error lists the occurrence lines.
  - Reject empty and whitespace-only selections.
  - Verify: vitest covers whole-line, expression, multiline match, ambiguous, missing, blank, and out-of-range cases.

## 5. Core anchoring

- [ ] 5.1 Implement anchor capture (design D6).
  - Context widens until it is unique, capped at 10 lines on each side.
  - Store the hash, start line, line count, length, `unique` flag, and selection offsets within the context.
  - Verify: vitest covers a unique selection line, a repeated `return null;` widened until unique, and a non-unique result at the cap.
- [ ] 5.2 Implement anchor resolution.
  - States: exact, relocated, uncertain (`multiple-context-matches`, `context-changed`, `tie`), and stale (`file-missing`, `unreadable`, `not-found`).
  - Choose the nearest candidate by line, then character, preferring the earlier one on a tie.
  - Never fall back to line numbers.
  - Verify: vitest covers every `source-anchoring` scenario, including CRLF parity, edits outside the context, lines inserted above, a pasted duplicate context, an edited context with the selection intact (single occurrence), an equal-distance tie, an edited selection, and a deleted file.

## 6. Publishing pipeline and CLI

- [ ] 6.1 Implement `env.ts`.
  - Node 20 or later check.
  - Detection of WSL, container, SSH, and non-Windows platforms.
  - The `WALK_ME_THROUGH_ALLOW_UNSUPPORTED_ENVIRONMENT=1` override, recorded as `unsupportedOverride`.
  - Environment variables, the filesystem, and the Node version are injectable.
  - Verify: vitest covers the WSL message, the old-Node message, SSH on Windows, and the override.
- [ ] 6.2 Implement `publish.ts` orchestration, with filesystem and git access injected.
  - Resolve the root from the script location, or from `--root`.
  - Resolve each source realpath and keep it inside the root, including symlink escape checks.
  - Read source files within the size limit, then capture anchors.
  - Collect git metadata with timeouts; it becomes null when git is unavailable.
  - Build the artifact and run it through `validateArtifact`.
  - Write it atomically: `.walk-me-through/.gitignore` containing `*`, a `wx` temp file, a rename, and a retry on ID collision.
  - Add `non-unique-anchor` warnings.
  - Verify: vitest covers in-memory publishing, symlink escape, absence of git, immutability across two publishes, and that the top-level `.gitignore` is left untouched.
- [ ] 6.3 Implement `packages/skill/src/cli.ts`.
  - Usage: `<input.json> [--root <dir>]`. The input path resolves against the current working directory.
  - Output: exactly one JSON object on stdout.
  - Exit codes: 0 for success, 1 for validation errors, 2 for usage or environment errors.
  - The success result includes an `open` hint.
  - No IDE, network, or background-process side effects.
  - Verify: `npm run build` regenerates `publish-walkthrough.mjs`.
- [ ] 6.4 Add script integration tests in `packages/skill/test`. They spawn the generated script with `node` against temporary fixture projects that use the installed bundle layout, with the override variable set when not on Windows.
  - Verify: tests cover invocation from a subdirectory, the missing-root usage error, a missing input file (exit 2), two validation errors (exit 1), success output, creation of `.walk-me-through/.gitignore`, both artifacts surviving a second publish, a clean `git status` in a git fixture, and running from a copy that has no `node_modules`.

## 7. Skill bundle

- [ ] 7.1 Write `packages/skill/SKILL.md`.
  - Frontmatter: `name: walk-me-through`, plus a description.
  - Cover when to use the skill, the explanation rules (evidence-backed, smallest ranges, `match` for expressions, no chain-of-thought), writing drafts under `.walk-me-through/drafts/`, the exact `node …/publish-walkthrough.mjs` command, fixing errors, the missing or old Node guidance, and the concise reply format.
  - Verify: review against the `skill-bundle` agent guidance scenarios.
- [ ] 7.2 Write `packages/skill/references/walkthrough-format.md`.
  - Document every input field, the limits, the exit codes, and the error format.
  - Include one example that uses `examples/sample-project` files and covers nested steps, a narrative step, a whole-line location, a `match` location, and evidence labels.
  - Verify: a vitest test extracts the example JSON and publishes it successfully with `--root examples/sample-project`.
- [ ] 7.3 Generate `manifest.json` in `scripts/build.mjs`.
  - Contents: `manifestVersion` 1, `bundleVersion` 0.1.0, `walkthroughSchemaVersion` 1, and normalised SHA-256 hashes of the other three files. The manifest does not hash itself.
  - Verify: a test confirms the hashes are identical for CRLF-converted copies.
- [ ] 7.4 Add `scripts/check-bundle.mjs` and include it in `npm test`. It rebuilds to a temporary directory and compares the result with the committed script and manifest, ignoring line-ending differences.
  - Verify: `npm run check:bundle` passes after a build, and fails after a deliberate edit to core without a rebuild.
- [ ] 7.5 Add `scripts/install-skill.mjs`, run as `npm run skill:install -- <projectDir> [--force]`.
  - Copy the four bundle files into `<projectDir>/.agents/skills/walk-me-through/`.
  - Without `--force`, refuse when any target file differs (by normalised hash) and list the differing files.
  - Never run git.
  - Verify: tests cover a fresh install, protection of a modified `SKILL.md`, and an overwrite with `--force`.

## 8. Sample project

- [ ] 8.1 Create `examples/sample-project`.
  - A small, deliberately buggy TypeScript retry helper, spread across two or three files.
  - A `walkthrough-input.json` covering a narrative step, three-level nesting, a `match` expression, and a multiline method.
  - Verify: `node packages/skill/scripts/publish-walkthrough.mjs examples/sample-project/walkthrough-input.json --root examples/sample-project` exits 0, and its artifact is Git-ignored.

## 9. VS Code extension: store, session, and commands

- [ ] 9.1 Write the extension manifest (`packages/vscode/package.json`).
  - Identity: name `walk-me-through`, provisional publisher `pvrobays`, `engines.vscode` `^1.90.0`.
  - Activation on commands and views only; untrusted workspaces supported.
  - Contributions:
    - A `walkMeThrough` view container with a Steps tree view and a Step webview view.
    - The commands open, close, next, previous, goToStep, and returnToCurrentStep.
    - `comments/commentThread/title` menus for Previous, Next, and Close.
    - The colours `walkMeThrough.highlightBackground` and `walkMeThrough.uncertainBorder`.
  - Verify: the extension activates in the Extension Development Host via `.vscode/launch.json` without errors.
- [ ] 9.2 Implement `store.ts`.
  - Discover artifacts by reading `<folder>/.walk-me-through/walkthroughs/` directly in each workspace folder, plus a `findFiles` query for nested projects, then deduplicate.
  - Read headers for the picker; run full validation when an artifact is opened.
  - Take the project root from the directory containing `.walk-me-through/`, and warn when it differs from the recorded root (realpath, case-insensitive on Windows).
  - Verify: integration tests cover two artifacts in a subfolder project and a multi-root fixture.
- [ ] 9.3 Implement `session.ts` and the Open/Close commands.
  - Open behaviour:
    - Without an argument: a picker sorted newest first, with a Browse option and an empty-state hint.
    - With a path: open that artifact directly.
  - Error handling: refuse in remote hosts (`env.remoteName`); show an error and start nothing for invalid artifacts.
  - Session rules: one active walkthrough per window, replaced when another opens. The synthetic overview entry comes first, followed by depth-first order with no wrap-around.
  - Context keys: `walkMeThrough.active`, `walkMeThrough.hasNext`, and `walkMeThrough.hasPrevious`.
  - Return the test API (`getState`) in test mode.
  - Verify: integration tests cover open by path, replace, close clearing all state, a fifth-level artifact being refused, and no wrap-around at either end.

## 10. VS Code extension: presentation

- [ ] 10.1 Implement `comments.ts`.
  - A comment controller with no commenting ranges.
  - One read-only expanded thread for the current code step. The label reads "Step N of M", and the author is the step title.
  - The body is an untrusted `MarkdownString`: HTML disabled, theme icons enabled. Relocated and uncertain notices are prepended, and tie wording is included when relevant.
  - Verify: integration tests assert the thread range, `canReply` is false, the body contains the explanation, and `isTrusted` is falsy.
- [ ] 10.2 Implement `highlights.ts`.
  - Confident and uncertain decoration types.
  - Exact character ranges.
  - Remove decorations on step change or close; reapply them when visible editors change.
  - Verify: integration tests assert the decorated range and style for an expression, a multiline span, and an uncertain step.
- [ ] 10.3 Implement step display in the session.
  - Open the document through `openTextDocument`, so unsaved buffers are used.
  - Resolve the anchor with core, then reveal the range, decorate it, and add the comment thread.
  - Stale steps: no editor change, highlight, or thread.
  - Location-less steps: the editor is left unchanged.
  - Anchors are re-resolved every time a step becomes current. Return to Current Step re-reveals the step.
  - Verify: integration tests cover exact, relocated after unsaved insertions above, uncertain with a duplicated context, stale after editing the selection, stale for a deleted file, and a narrative step leaving the active editor unchanged.
- [ ] 10.4 Implement `tree.ts`.
  - Show the title, an overview entry, and the nested steps, with `getParent`.
  - Icons: narrative, code, uncertain, stale, and neutral for unvisited steps.
  - Mark the current step and reveal it with its ancestors expanded.
  - Selecting an entry navigates with `goToStep`. Collapsing does not affect Next.
  - Verify: integration tests cover direct selection of a level-3 step and Next from a collapsed parent entering its first child.
- [ ] 10.5 Implement `stepView.ts` and `markdown.ts`.
  - The webview view always shows the breadcrumb, title, "Step N of M", a state banner, and Previous/Next buttons.
  - It shows the explanation only for the overview, location-less steps, and stale steps. Stale steps also show a banner with the original path and line.
  - Markdown is rendered with `markdown-it` (`html: false`).
  - The webview uses a strict CSP and nonce scripts.
  - Link clicks open only `http` and `https` links, via `env.openExternal`.
  - Verify: unit tests cover the Markdown renderer neutralising `<script>`, `<img onerror>`, and `command:` links. An integration test checks that the view state reports the explanation for narrative and stale steps.

## 11. Documentation and end-to-end verification

- [ ] 11.1 Update `README.md`.
  - Status: the vertical slice is implemented, with its scope and limits.
  - Add a "Try the vertical slice" section covering `npm install`, `npm run build`, publishing the sample with `--root`, F5 with `examples/sample-project`, and Open Walkthrough.
  - Add development commands and requirements (Node 20+, desktop VS Code on native Windows).
  - Record the confirmed `engines.vscode` value and any resolved open questions in `IMPLEMENTATION.md`.
  - Verify: follow the README steps verbatim and confirm they work.
- [ ] 11.2 Run the full automated suite: `npm run typecheck`, `npm test` (core, skill, and check:bundle), and the extension-host tests.
  - Verify: everything passes on native Windows.
- [ ] 11.3 Manual UX check in the Extension Development Host, using the sample walkthrough. Record the results in the change or in `IMPLEMENTATION.md`.
  - Markdown in comments renders bold, italic, inline code, lists, and fenced code blocks. Note whether the code blocks are syntax-highlighted.
  - The Step view renders the overview and narrative steps.
  - Expression and multiline highlights are exact.
  - The uncertain style and warning are visibly distinct.
  - The stale banner shows, with no highlight.
  - Previous/Next work from the thread title, the Step view, and the Command Palette.
- [ ] 11.4 Real agent check. Run `npm run skill:install -- <a scratch project>`, restart OpenCode there, and ask it to explain a mechanism.
  - Verify: the skill is discovered; the agent writes a draft and runs the script once (fixing any errors); the reply is concise and gives the open hint without repeating the content; Open Walkthrough plays the result.

## Workflow follow-up

- These are follow-up changes, not part of this one:
  - The HTTPS launcher and launch envelope.
  - The URI handler and window routing.
  - The skill installation prompt and update flow.
  - Marketplace and `.vsix` release publishing.
- Archive this change after the review and the manual checks are complete.
