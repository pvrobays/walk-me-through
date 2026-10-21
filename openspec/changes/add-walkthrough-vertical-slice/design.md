# Design

## Context

The repository currently contains only documentation (`README.md`, `IMPLEMENTATION.md`) and the OpenSpec/OpenCode setup. There is no application code, root `package.json`, `.gitignore`, or `.gitattributes`. Git runs with `core.autocrlf=true` on the owner's machine. The development environment observed in review was native Windows, PowerShell 7.6 in Windows Terminal, Node v24.16.0, and VS Code with `code.cmd` on the PATH.

Product decisions are recorded in `IMPLEMENTATION.md`; motivation and scope are in `proposal.md`. Behavior contracts are in the specs:
- `walkthrough-artifact`
- `walkthrough-publishing`
- `source-anchoring`
- `walkthrough-playback`
- `skill-bundle`

This design covers how to build them.

## Goals / Non-Goals

**Goals:**
- One shared, editor-independent core. It is bundled into a dependency-free Node script and into the VS Code extension, so publishing and playback cannot diverge.
- Concrete v1 input and artifact shapes that later changes (launcher, routing, Rider) can build on without breaking them.
- Anchor capture and resolution that is cheap enough to run every time a step becomes current.
- A player made from standard VS Code surfaces: Comments, Tree View, Webview View, and decorations.
- Automated tests for all core logic and the main extension behaviors, plus a short manual checklist for visual rendering.

**Non-Goals:**
- Launch URLs, URI handlers, window routing, pending-request persistence, or any prompt to install the skill.
- Bundle update or customization detection. The manifest is produced, but nothing compares against it yet.
- Restoring playback state after a window reload.
- Re-resolving anchors while the user edits the current file. Anchors are resolved when a step becomes current.
- Blocking local macOS/Linux VS Code hosts. Only remote extension hosts are refused; other local platforms are simply untested.

## Decisions

### D1. Monorepo layout and tooling

```text
package.json                 npm workspaces, root scripts
tsconfig.base.json
.gitattributes               * text=auto eol=lf
.gitignore                   node_modules, dist, out, *.vsix, .vscode-test, /.agents/skills/walk-me-through/
scripts/
  build.mjs                  esbuild: skill script + extension; regenerates manifest
  check-bundle.mjs           rebuild to a temp dir; compare (EOL-normalised) to committed files
  install-skill.mjs          dev-only bundle copy (D10)
packages/
  core/                      @walk-me-through/core (TypeScript, no runtime deps, no vscode/fs imports in pure modules)
    src/ text.ts coords.ts input.ts artifact.ts anchor.ts resolve.ts ids.ts limits.ts publish.ts env.ts
    test/                    vitest
  skill/
    src/cli.ts               CLI entry -> bundled into scripts/publish-walkthrough.mjs
    SKILL.md  manifest.json  references/walkthrough-format.md
    scripts/publish-walkthrough.mjs   GENERATED, committed
    test/                    vitest: spawn the generated script against temp fixtures
  vscode/
    src/ extension.ts store.ts session.ts tree.ts comments.ts highlights.ts stepView.ts markdown.ts testApi.ts
    test/                    @vscode/test-cli integration tests
    test-fixtures/workspace/ fixture project (artifacts are generated during test setup)
examples/sample-project/     small TS project + walkthrough-input.json
.vscode/launch.json          Extension Development Host with examples/sample-project
```

- **npm workspaces** rather than pnpm/yarn, because they come with Node and avoid extra tools for contributors.
- **esbuild** for both bundles, because it is fast and produces a single readable file.
  - The script is built as `format: esm`, `platform: node`, `target: node18`, unminified, with a generated-file banner.
  - The extension is built as `format: cjs`, with `vscode` marked external.
- **vitest** for unit tests, because it runs TypeScript directly with no build step. The alternative, `node:test` plus a TypeScript loader, needs more setup.
- **`@vscode/test-cli` + `@vscode/test-electron`** for extension-host tests.
- **`.gitattributes` forcing LF** keeps the committed generated script and manifest hashes stable despite `autocrlf=true`. The bundle check and manifest hashing also normalize line endings, so CRLF checkouts in consuming projects still verify.

### D2. Core module boundaries
Each module has one job:
- `text`: decode, normalize, split into lines.
- `coords`: convert between positions and offsets.
- `input`: validate v1 input.
- `artifact`: types and validation for v1 artifacts.
- `anchor`: capture anchors.
- `resolve`: resolve anchors during playback.
- `ids`, `limits`, `env`: identifiers, limits, environment detection.
- `publish`: orchestration.

Only `publish`/`env` and the CLI touch `fs`, `child_process`, or `process`. File reads and git are passed in as functions, so publishing logic can be unit-tested in memory. The extension imports only the pure modules (`artifact`, `resolve`, `text`, `coords`).

### D3. Text normalization and coordinates
- **Decoding:** UTF-8 with `TextDecoder('utf-8', { fatal: true })`. A NUL byte means the file is treated as binary and rejected. A leading U+FEFF is stripped.
- **Line endings:** `\r\n` and lone `\r` become `\n`. VS Code treats both as line breaks, so line numbers agree with the editor. Line breaks are not part of any line, so a normalized offset converts to the same `(line, character)` that VS Code reports for the original CRLF document.
- **Characters:** JavaScript string indices are UTF-16 code units, matching the stored convention directly.
- **Line count** equals `split('\n').length`, including a trailing empty line, which matches `TextDocument.lineCount`.
- **Input conversion:** an input location (1-based inclusive lines) becomes a span from `(startLine-1, 0)` to `(endLine-1, len(line endLine-1))`.
  - With `match`, the agent's snippet is normalized the same way. All occurrences are searched for, including overlapping ones, within the normalized text of those lines. Exactly one occurrence is required. Its offsets are mapped back to positions.
  - A selection that is empty or contains only whitespace is rejected.

### D4. Input v1 shape

```json
{
  "version": 1,
  "title": "Why retries never back off",
  "summary": "Markdown. The retry delay is reset on every attempt…",
  "steps": [
    { "title": "Context", "explanation": "Narrative step, no location." },
    {
      "title": "Retry loop",
      "explanation": "…",
      "evidence": "observation",
      "location": { "path": "src/retry.ts", "startLine": 12, "endLine": 30 },
      "children": [
        {
          "title": "Delay is recomputed",
          "explanation": "…",
          "evidence": "hypothesis",
          "location": { "path": "src/retry.ts", "startLine": 18, "endLine": 18, "match": "delay = baseDelay" }
        }
      ]
    }
  ]
}
```

- Validation uses strict, hand-written checks with no schema library, so the script stays dependency-free. Unknown keys are rejected.
- All errors are collected rather than stopping at the first one. Each error has a JSON path such as `steps[1].children[0].location.match` and a message that says how to fix it.
- **Limits** (constants in `limits.ts`, documented in the format reference):

  | Limit | Value |
  | --- | --- |
  | Input file | 1 MiB |
  | Steps | 200 |
  | Title | 200 chars |
  | Summary | 10,000 chars |
  | Explanation | 20,000 chars |
  | `match` | 2,000 chars |
  | Location span | 300 lines |
  | Referenced source file | 2 MiB |

  These bound captured text and keep resolution fast.

### D5. Artifact v1 shape

```json
{
  "schemaVersion": 1,
  "generator": { "name": "walk-me-through", "bundleVersion": "0.1.0" },
  "id": "20261021T143005123Z-k3f9qa",
  "createdAt": "2026-10-21T14:30:05.123Z",
  "title": "…",
  "summary": "…",
  "project": {
    "root": "C:\\git\\acme\\service",
    "environment": { "kind": "local", "platform": "win32", "unsupportedOverride": false }
  },
  "source": { "git": { "commit": "abc123…", "dirty": true } },
  "steps": [
    {
      "id": "s1",
      "parentId": null,
      "title": "…",
      "explanation": "…",
      "evidence": "observation",
      "location": {
        "path": "src/retry.ts",
        "range": { "start": { "line": 17, "character": 4 }, "end": { "line": 17, "character": 21 } },
        "anchor": {
          "algorithm": "sha256-lf-v1",
          "selectionText": "delay = baseDelay",
          "context": { "startLine": 15, "lineCount": 5, "length": 182, "hash": "<hex sha256>", "unique": true },
          "selectionInContext": { "start": 61, "end": 78 }
        }
      }
    }
  ]
}
```

- **Walkthrough ID:** a UTC timestamp to the millisecond (`YYYYMMDDTHHMMSSmmmZ`), a hyphen, and 6 random lowercase base32 characters from `crypto.randomBytes`. It sorts chronologically, is safe in file names and URLs, and is unique in practice. Alternatives considered: a UUID (does not sort) or a per-project counter (needs a lock and shared state).
- **Step IDs:** `s1…sN` in depth-first pre-order. Artifacts are immutable, so IDs are stable for future deep links.
- **Git metadata:** `source.git` is `null` when `git` is missing, the project is not a repository, or the command times out (2 s each). The values come from `git rev-parse HEAD` and `git status --porcelain`, run with `execFileSync` and `cwd: root`.
- **Project root:** stored as `fs.realpathSync.native(root)`.

### D6. Anchor capture and resolution
The full context text is not stored, only its hash, so the artifact does not duplicate code. Resolution searches from occurrences of the stored `selectionText`, which avoids hashing every possible window of lines.

**Capture**, on normalized disk text:
1. The context starts as the selection's lines (`startLine..endLine`).
2. A context is **unique** if exactly one occurrence of `selectionText` has an identical surrounding context. For each occurrence, the candidate context starts at the occurrence offset minus `selectionInContext.start`. It must begin at a line start and end at a line end, and its text must equal the context.
3. While the context is not unique, widen it by one line above and one line below, where available. The cap is 10 lines on each side beyond the selection lines. At the cap, keep the context and set `unique: false`. The publish result then includes a `non-unique-anchor` warning.
4. Store the SHA-256 hex hash of the context text, its start line, line count, and UTF-16 length, plus the selection offsets within it.

**Resolution**, `resolve(anchor, range, currentText | missing)`, on normalized current text:
1. If the file is missing or unreadable, return **stale** (`file-missing` or `unreadable`).
2. Take the current lines `[context.startLine, +lineCount)`. If they exist and their hash matches, return **exact** with the stored range.
3. Find every occurrence of `selectionText`. Keep those whose candidate context is line-aligned, has the same length, and has a matching hash.
   - Exactly one match: **relocated**.
   - More than one: **uncertain**, reason `multiple-context-matches`.
4. If none matched in step 3 but `selectionText` occurs anywhere: **uncertain**, reason `context-changed`, using the nearest occurrence.
5. Otherwise: **stale**, reason `not-found`.

**Nearness** is the difference in line from the original selection start, then the difference in character. On an exact tie, the earlier offset wins and `tie: true` is set.

The result is `{ state, range?, reason?, tie?, candidateCount }`. In the worst case the cost is the number of selection occurrences multiplied by the context length. That is acceptable at the 2 MiB and 300-line limits.

### D7. Publishing script

**Root resolution:** the script's real path is checked for the segments `<root>/.agents/skills/walk-me-through/scripts/`. These are compared case-insensitively on Windows. `--root` overrides the result.

**Startup order:**
1. Check the Node version. This must run before anything else. The bundle uses `target: node18` syntax, so an older Node can still parse the file far enough to print the "Node 20+ required" message.
2. Detect the environment (`env.ts`):
   - Not `win32`: unsupported. The message names the actual environment:
     - **WSL:** `WSL_DISTRO_NAME`, or `microsoft` in `/proc/version`.
     - **Container:** `/.dockerenv`, or the `container` environment variable.
     - **SSH:** `SSH_CONNECTION`, `SSH_CLIENT`, or `SSH_TTY`.
     - Otherwise, the platform name.
   - `win32` with SSH variables set: unsupported, as a remote session.
   - `WALK_ME_THROUGH_ALLOW_UNSUPPORTED_ENVIRONMENT=1` bypasses the check and records `unsupportedOverride: true`. This exists for CI and tests on Linux and is documented as development-only.
3. Read the input file. The path is relative to the current working directory.
4. Validate the input.
5. Resolve and read source files, checking each realpath stays inside the root.
6. Capture anchors.
7. Build and validate the artifact using the same validator the player uses.
8. Write the artifact.

**Writing:**
- `mkdir -p .walk-me-through/walkthroughs`.
- If `.walk-me-through/.gitignore` is missing, create it containing `*`.
- Write `<id>.json.tmp-<rand>` with flag `wx`, then `renameSync` it to `<id>.json`.
- If `<id>.json` already exists, regenerate the ID. This happens at most a few times; then the script fails.
- Output is `JSON.stringify(result)` followed by `\n` on stdout, so stdout always carries exactly one object. Diagnostics never go to stdout.

**Exit codes:** 0 for success, 1 for validation errors, 2 for usage and environment errors (unsupported environment, old Node, missing input, unresolvable root). Unexpected internal errors also exit with 2 and `ok: false`.

### D8. Extension architecture
- **Activation:** on commands and views only (no `*` or startup activation).
- **Workspace trust:** `capabilities.untrustedWorkspaces.supported: true`, because the extension only reads files and renders untrusted Markdown safely.
- **`engines.vscode`:** `^1.90.0`, provisional (see Open Questions).
- **Remote hosts:** if `vscode.env.remoteName` is defined, Open Walkthrough shows the unsupported message.

**Store:**
- For each workspace folder, `<folder>/.walk-me-through/walkthroughs/*.json` is read directly through `workspace.fs`.
- `workspace.findFiles('**/.walk-me-through/walkthroughs/*.json', '**/node_modules/**')` is also queried, to find nested projects. Results are deduplicated.
- Reading the folder directly means discovery works even if `findFiles` skips dot-folders or ignored paths.
- The picker reads only the header fields of each artifact. Full validation runs when one is opened.
- The project root used for playback is the directory containing `.walk-me-through/`. It is compared with `project.root` (realpath, case-insensitive on Windows), and a warning is shown if they differ.

**Session:**
- Holds the validated artifact, the project root URI, the depth-first order with a synthetic overview entry at index 0, and the current index.
- Next and Previous move the index within bounds.
- `goToStep(id)` jumps directly to a step.
- Context keys: `walkMeThrough.active`, `walkMeThrough.hasNext`, `walkMeThrough.hasPrevious`.

**Showing a step:**
1. Dispose the previous thread and decorations.
2. If the step has a location:
   - `openTextDocument(uri)`, which returns the dirty buffer if the file is open.
   - Resolve against `document.getText()`, normalized by core. Positions map 1:1 to `vscode.Position`, as described in D3.
   - If the result is not stale: `showTextDocument`, `revealRange(InCenterIfOutsideViewport)`, apply the decoration, and create the comment thread.
   - A missing file is caught and treated as stale.
3. Update the tree and the Step view.

**Comments:**
- One `CommentController('walk-me-through', 'Walk Me Through')` with no commenting range provider, so users cannot add comments.
- The thread is read-only: `canReply = false`, `collapsibleState = Expanded`, `label = "Step 3 of 9"`.
- The comment has `mode: Preview` and the step title as `author.name`. Its body is a `MarkdownString` with `isTrusted: false`, `supportHtml: false`, and `supportThemeIcons: true`. The relocated or uncertain notice is prepended; the uncertain one uses `$(warning)`.
- Thread title actions use `comments/commentThread/title` menus, with `when: commentController == walk-me-through`, to offer Previous, Next, and Close.

**Highlights:**
- Two `TextEditorDecorationType`s. The colors are contributed so themes can override them:
  - **Confident:** background `walkMeThrough.highlightBackground`.
  - **Uncertain:** the same background plus a dashed border, `walkMeThrough.uncertainBorder`, which defaults to the warning color.
- The decoration is reapplied on `onDidChangeVisibleTextEditors` while the current document is visible.

**Tree:**
- `TreeDataProvider` with `getParent`, so `TreeView.reveal` can expand ancestors.
- Codicons:
  - `note` for narrative steps.
  - `code` for code steps.
  - `warning` for uncertain steps.
  - `error` for stale steps.
- The current step is marked with a description suffix and the `debug-stackframe` icon decoration.
- States show only after a step has been resolved; unvisited code steps show a neutral icon.

**Step view:**
- A `WebviewView` in the same `walkMeThrough` view container in the Activity Bar.
- Markdown is rendered in the extension host with `markdown-it` (`html: false`, `linkify: true`), and the HTML is posted to the webview.
- Content Security Policy: `default-src 'none'`, styles from `cspSource`, scripts by nonce only.
- Clicking a link sends a message to the extension. The extension opens only `http`/`https` links through `env.openExternal` and ignores every other scheme.
- Styling uses VS Code theme CSS variables.
- Content:
  - Always: the breadcrumb, title, "Step N of M", an anchor-state banner, and Previous/Next buttons.
  - The explanation is included for the overview, location-less steps, and stale steps. Code steps already show it in the editor comment.

**Commands:** `walkMeThrough.openWalkthrough [path]`, `.closeWalkthrough`, `.next`, `.previous`, `.goToStep <id>`, `.returnToCurrentStep`. No default keybindings, to avoid conflicts.

**Test API:** when `context.extensionMode === ExtensionMode.Test`, `activate` returns `getState()`. It reports the active walkthrough ID, current step ID, last resolution, the current thread's range and body, and the decorated range and style. This lets integration tests assert on behavior without inspecting VS Code internals.

### D9. Skill bundle content
- **`SKILL.md` frontmatter:**
  - `name: walk-me-through`
  - A `description` saying to use it for explanations and investigations that span several code locations.
- **`SKILL.md` body:**
  - Rules for writing explanations: evidence-backed, minimal ranges, `match` for expressions, honest evidence labels, and no chain-of-thought.
  - The exact command: `node .agents/skills/walk-me-through/scripts/publish-walkthrough.mjs .walk-me-through/drafts/<slug>.json`.
  - How to fix errors and rerun.
  - What to do when Node is missing.
  - The reply format: a 1–3 sentence conclusion plus the `open` hint from the result, with no repeated content.
- **Format reference:** documents every field, the limits, exit codes, and errors. Its example uses files from `examples/sample-project`. A test extracts that JSON block and publishes it with `--root examples/sample-project`.
- **Manifest:** `scripts/build.mjs` writes `manifest.json` with `manifestVersion` 1, `bundleVersion` 0.1.0 (kept equal to the skill package version), and `walkthroughSchemaVersion` 1. File hashes use the shared normalization (strip BOM, CRLF to LF) from core.

### D10. Developer install command and sample
- **Install command:** `npm run skill:install -- <projectDir> [--force]` copies the four bundle files.
  - It compares existing target files using normalized hashes.
  - It refuses on any difference unless `--force` is given, and lists the differing files.
  - It never runs git.
- **Sample project:** `examples/sample-project` holds a small, deliberately buggy TypeScript retry helper and `walkthrough-input.json`. The input covers a narrative step, a nested three-level path, a `match` expression, and a multiline method.
- **Trying the flow:** `.vscode/launch.json` opens the sample project in the Extension Development Host. The README "Try the vertical slice" section lists the steps: build, publish with `--root`, then press F5 and run Open Walkthrough.

## Risks / Trade-offs

- **Comment-thread Markdown may differ from expectations** (code-block highlighting, header styling) → The manual checklist verifies it. The Step view's `markdown-it` renderer is a ready fallback surface if the comment rendering is unacceptable.
- **Two Markdown renderers** (VS Code comments and `markdown-it`) may render slightly differently → Acceptable for the slice. The explanation is shown on only one surface per step, so the reader never compares them.
- **Decorations and comment threads do not follow edits until the step is shown again** → Documented. Return to Current Step re-resolves and refreshes them.
- **The uncertain fallback can highlight the wrong identical code** → It always shows the uncertain style and a warning, never a confident highlight. The fallback is limited to identical text.
- **`selectionText` stores up to 300 lines of code in local artifacts** → The artifacts are Git-ignored and local. The limit bounds the size.
- **Environment detection uses heuristics** (WSL and container markers) → The checks are conservative, and an explicit override exists for development. A wrong rejection produces a clear message rather than corrupt data.
- **Millisecond IDs can collide or misorder within the same millisecond** → A collision is retried. Misordering within one millisecond is negligible for publishing driven by a human or an agent.
- **`.gitattributes` renormalizes the existing docs to LF** → This is a one-time change that is acceptable now, while the repository holds only docs.
- **The generated script is committed and can drift from its source** → `npm run check:bundle` catches drift and runs in the test script.

## Migration Plan

This is a greenfield addition. Nothing needs migrating and no data is converted. Rollback means reverting the change. Consuming projects that already have artifacts keep them because `.walk-me-through/` is self-ignored. Future schema versions must keep reading v1 or explicitly refuse it, as `walkthrough-artifact` requires.

## Open Questions

- **Lowest working `engines.vscode`:** `^1.90.0` is assumed and needs confirming in the extension-host tests. Raising it changes only metadata.
- **Default highlight colors and the uncertain border style:** to be tuned after the first manual run. Colors are contributed and can be changed without affecting behavior.
- **Whether `workspace.findFiles` returns paths inside a self-ignored dot-folder:** to be observed in tests. Discovery already reads workspace folders directly, so only the nested-project path depends on it.
