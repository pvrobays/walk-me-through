# Implementation handoff

This document preserves product decisions, current implementation contracts, and follow-ups. Read it with [README.md](README.md) (problem and quick start) and [how-it-works.md](how-it-works.md) (user-facing mechanics). The authoring/publishing/current-window playback slice is implemented and accepted on Windows; the owner also reports a successful manual VS Code integration test on a native Linux host. The VS Code extension is published on the Marketplace as [`pvrobays.walk-me-through`](https://marketplace.visualstudio.com/items?itemName=pvrobays.walk-me-through) (owner report, 2026-10-22), and the Rider plugin was submitted to JetBrains Marketplace as [plugin 35375](https://plugins.jetbrains.com/plugin/35375-walk-me-through). Version 0.2.0 of both (`prepare-store-publication`) makes them store-ready.

## Status, scope, and development (moved from README, 2026-10-22)

### Current status

- Requirements: Node 20+ and local desktop VS Code or Rider on native Windows, Linux or macOS, outside WSL, SSH, containers, remote IDE hosts and headless IDEs. Windows is the maintainers' acceptance platform; Linux and macOS are supported but not verified by the maintainers (CI runs the TypeScript checks on Ubuntu and macOS).
- VS Code: Windows automated verification (VS Code 1.90.2), manual desktop acceptance (VS Code 1.138.0), and restarted-OpenCode authoring/recovery/playback checks passed. The owner also reports a successful manual VS Code integration test on a native Linux host; automated Linux results are not recorded here. Published on the VS Code Marketplace (owner report, 2026-10-22); GitHub Release `.vsix` files are not yet provided.
- Rider: a Kotlin plugin plays the same v1 artifacts in local desktop Rider from build 262 (Rider 2026.2) on, with no upper bound: docked Markdown explanation/outline, precise current-buffer highlights, Next/Previous/Skip Details/Return, and explicit artifact selection. The integrated player is owner-accepted on native Windows Rider 2026.2.3.1 (RD-262.10968.170); explicit offline verification is pending. Plugin Verifier passes against the installed Rider and the latest released Rider. Linux and macOS Rider are accepted but have no maintainer or CI verification. See [packages/rider/README.md](packages/rider/README.md).
- Skill onboarding: both IDEs ship the project skill and offer **Walk Me Through: Install Skill into Project**, a missing-skill notification (**Install**, **Not for This Project**, **Don't Ask Again**) and a view banner while the skill is missing; see the README.
- Links: the shared publisher and skill return a replayable HTTPS launch link. Each IDE plays it only in a window/project that already has the recorded checkout open. Correct-window routing and closed-IDE startup are the next routing milestone.

**Current scope:** shared core, project skill and generated script, immutable artifacts, VS Code and Rider players, replayable HTTPS launch links through the live launcher page (playing only in a window/project that already has the checkout open), sample, native-platform CI (Windows, Ubuntu, macOS), Pages deployment, in-IDE skill installation and offers, and store packages for both IDEs. Correct-window routing, skill update detection, GitHub Release `.vsix` files, and release automation remain follow-ups.

### Develop from source

```sh
npm install
npm run build
npm run typecheck
npm test
npm run test:extension
```

`npm test` runs core/script/Markdown/launcher tests, the committed-bundle and launcher-asset checks, fixture drift checks, and workflow structure checks. Extension tests download VS Code 1.90.2 on first use. On native Linux, use `xvfb-run -a npm run test:extension`. CI repeats checks on Windows, Ubuntu and macOS with Node 20 (extension-host tests under Xvfb on Ubuntu); native Linux and macOS need no override. `npm run package:vsix` builds a local VSIX.

### Try the sample in an Extension Development Host

```sh
npm install
npm run build
node packages/skill/scripts/publish-walkthrough.mjs examples/sample-project/walkthrough-input.json --root examples/sample-project
```

Open this repository in desktop VS Code. After building, press **F5** and select **Walk Me Through sample** to open `examples/sample-project` in an Extension Development Host. Run **Walk Me Through: Open Walkthrough** in the new window, then choose **Why retries never back off** using the ID printed by the publisher. F5 does not build the extension automatically; if you change its source, run `npm run build` again and restart the F5 session.

Detailed playback semantics: **Skip Details** is available in the Step view, a code comment's header, and the Command Palette. From a final nested branch it exits to the next branch of an ancestor; from the overview it enters the first top-level step. It is unavailable at the final branch even when **Next** can still enter children. **Previous** immediately after skipping returns to the preceding depth-first step, not the skip origin. **Return to Current Step** re-resolves against unsaved buffers; anchors refresh when a step becomes current, not continuously during edits. A VS Code link activates the extension on demand; a link that targets a step opens there, an unknown step opens the overview with a notice, and re-opening the active walkthrough reloads it in place.

Uncertainty notices say explicitly that the original location is unconfirmed and the closest identical code is shown, including the earlier-candidate choice for ties. The Step view uses compact, moderately smaller warning text with theme-aware color and a warning indicator. Source comments use ordinary paragraph formatting with a warning icon; VS Code controls their font size. The red stale presentation and the informational relocation notice remain distinct.

### Skill installation details

`npm run skill:install -- <projectDir>` requires an existing directory and copies the four-file bundle into `.agents/skills/walk-me-through/`. It refuses differing files unless `--force` is supplied. Commit the bundle yourself, then quit and restart OpenCode in that project to discover it. Walkthrough authors make the top-level steps a concise, complete account, including consequences, essential caveats, and whether a proposed repair is untested. Optional children add evidence and deeper detail rather than repeating the parent. Simple explanations can stay flat; nested leaves still need precise source locations.

### Preview the launcher locally

The launcher source is `packages/launcher/src/`. `npm run build` regenerates the committed `launcher/launcher.js`, and `npm test` fails if that file is stale. `launcher/index.html` and `launcher/styles.css` are hand-written. To try links against the local page:

```sh
npm run build
npm run launcher:serve
node packages/skill/scripts/publish-walkthrough.mjs examples/sample-project/walkthrough-input.json --root examples/sample-project --launcher-url http://localhost:8123/
```

`launcher:serve` (`scripts/serve-launcher.mjs`, no dependencies) serves only the three launcher files on `127.0.0.1:8123`. Pass `--port <n>` to use another port. `--launcher-url` is a development-only publisher option. It accepts `https://` URLs, or `http://localhost` / `http://127.0.0.1` URLs, and the skill never uses it.

Launcher install-help targets live in `packages/launcher/src/config.ts` and point at the README headings `#install-the-vs-code-extension` and `#install-the-rider-plugin`; a launcher test fails if those headings disappear.

### Pages deployment

The launcher is live at `https://pvrobays.github.io/walk-me-through/`. The Pages source is **GitHub Actions**. The `Deploy launcher to Pages` workflow runs on pushes to `main` that change `launcher/**` or the workflow itself, and it uploads only `launcher/`. On 2026-10-21 the deployed `index.html`, `styles.css`, and `launcher.js` matched the committed files, and repository files such as `README.md` returned 404. The owner confirmed that a published link renders there.

### Intended complete experience

1. Install the Walk Me Through extension from the VS Code Marketplace, or install a `.vsix` release from GitHub.
2. When opening a Git workspace without the skill, accept an offer to install it into `.agents/skills/walk-me-through/`. The offer appears once per workspace, with workspace-specific and global dismissal options.
3. Commit the versioned skill and bundled publishing script so teammates' compatible agents can discover them too.
4. Ask your coding agent to explain a mechanism or investigate a bug.
5. The agent writes a JSON file with concise Markdown explanations, nested steps, line ranges, and optional exact-text snippets. The bundled script resolves precise selections, captures code anchors, saves a local artifact, and generates a replayable link.
6. Click the link in the terminal or agent chat. A static landing page offers **Open in VS Code**, plugin installation instructions, and retry controls.
7. Open the walkthrough in the correct checkout and step through the explanation beside the actual code.

Teammates can generate walkthroughs using the repository skill before installing the viewer. The link helps them install the extension and try opening the walkthrough again.

### Design principles

- **Frictionless hand-off:** get the agent's context to the human as quickly as possible, with one click from the reply to the highlighted code.
- **Lightweight installation:** an IDE extension and a project-local skill/script bundle; no companion application, daemon, or required MCP server.
- **Evidence-backed explanations:** curated findings, assumptions, and code references—not a transcript of a model's private internal reasoning.
- **Useful output:** lead with walkthrough availability and opening details, then preserve the normal answer at the requested depth while referencing local source rather than repeating large excerpts. Generated files and tool arguments still consume model output tokens.
- **Local playback:** navigating a walkthrough does not call a model.
- **Precise references:** expression, single-line, and multiline ranges, with captured hashes to relocate unchanged code after surrounding edits.
- **Visible uncertainty:** when original context cannot be recovered confidently, show a warning beside the nearest identical-code match; mark missing matches stale.
- **Progressive detail:** a self-contained concise top-level path, with optional additive child evidence and at most four levels including the top level.
- **Team-shared setup:** the skill always lives in the current project and is versioned through Git.
- **Correct workspace:** identify the exact checkout, including worktrees and execution environment, rather than just the repository name or remote URL.

### MVP

The first implementation targets **desktop VS Code on native Windows and native Linux, with our own simple player**. It uses VS Code comments, a nested outline, a Step view, and precise highlight decorations. CodeTour is not a dependency.

Build a thin vertical slice first: agent input -> publishing script -> saved artifact -> **Open Walkthrough** in the current window. Then improve the launcher, window routing, onboarding, and updates incrementally.

The MVP includes:

- Project-local, versioned skill and publishing script installation and update offers.
- Explanation-only walkthroughs for exploration and bug investigations.
- Stable walkthrough/step identities, Markdown descriptions, and up to four levels of steps. Top-level narrative steps and parent/grouping steps may omit a code location.
- Precise highlights, Previous/Next navigation, captured-context relocation, and explicitly warned nearest-identical-match fallback.
- Durable, replayable links to a specific walkthrough and optionally a step.
- A static HTTPS launcher suitable for GitHub Pages, with launch data in the URL fragment.
- Local artifacts in `.walk-me-through/`, ignored through that directory's own `.gitignore`; the project skill/script bundle remains versioned.
- Opening the correct workspace, including when VS Code is closed or another repository is active, with subfolder and multi-root workspace support. If the same checkout is open twice, use the most recently focused matching window.
- VS Code Marketplace distribution and downloadable `.vsix` files on GitHub Releases.

### What comes next

1. **Rider playback parity**, starting with a Rider-native explanation/highlight prototype and sharing the existing artifact format and repository skill.
2. **Shared HTTPS launcher**, with explicit VS Code and Rider choices, installation help, and retry.
3. **Correct-window routing for each IDE**, targeting the exact checkout without replacing unrelated workspaces.
4. **Project onboarding, customization-aware bundle updates, and distribution**: VS Code is on the Marketplace; GitHub Release `.vsix` files and Rider distribution remain to be defined.

Items 1 and 2 are implemented (see the status above). Later: portable export/sharing, optional MCP delivery, broader agent/remote compatibility, and richer investigation or change-review navigation. See [the agreed delivery sequence](#updated-delivery-sequence--owner-agreed-2026-10-21).

### Related work

[Agent CodeWalk](https://github.com/andylin-hao/agent-codewalk) already provides agent-authored explanations, nested steps, dependency views, change coverage, and hash-based relocation. Its architecture uses a bundled Rust MCP companion and a VS Code frontend. Our emphasis is project-shared setup, link-first delivery, precise expression ranges, and JetBrains playback without a companion application.

[CodeTour](https://github.com/microsoft/codetour) was considered as a playback foundation, but its limited maintenance led us to choose our own player. Both related projects are MIT-licensed; any source reuse should preserve applicable notices. Details are in [§10](#10-existing-projects-and-research).

## Vertical-slice contracts and verification (2026-10-21)

### Rider playback development status

`add-rider-playback` now has an owner-accepted docked prototype and integrated Kotlin player for native Windows Rider 2026.2.3.1 / RD-262.10968.170 / JBR 25.0.4+1-b508.27. Shared v1 fixtures verify validation, UTF-16/text/resolution and real-session traversal semantics across TypeScript/Kotlin. Current-buffer display, project-local loading, outline/actions and owned cleanup have automated coverage. The real Rider solution-backed harness passes; `test buildPlugin verifyPlugin` passes with 32 tests and exact-target compatibility, retaining advisory deprecated/experimental usages. Shared publisher/skill wording supports both IDEs. See `packages/rider/README.md` and the change's `verification.md` for exact commands/results. Final offline/integrated owner acceptance remains pending. (Superseded for distribution and compatibility by `prepare-store-publication`: store listing, build 262+ compatibility, and Linux/macOS acceptance; see Current status.)

- npm workspaces: editor-independent `packages/core`, canonical `packages/skill`, and `packages/vscode`. Rebuild after source edits. `npm test` checks the committed script and manifest against a fresh build.
- Node 20+ is required. Native Windows is verified, and the owner reports a successful native Linux manual VS Code integration test. Since `prepare-store-publication`, native macOS is accepted too (not verified by the maintainers). WSL, SSH, containers, remote extension hosts, and other platforms are rejected. The explicit development override never bypasses Node requirements. Local automated checks use Windows/Node 24.16.0; Node 20/Linux verification remains configured in CI.
- `engines.vscode` is `^1.90.0`. Automated Development Host tests pass with VS Code 1.90.2 on Windows, verifying the 1.90 API line. The exact 1.90.0 binary has not been exercised; detailed Linux visual checks have not been recorded.
- Input/artifact/manifest are v1. The [format reference](packages/skill/references/walkthrough-format.md) documents fields, limits, exit codes, and recovery. Artifacts use flat depth-first steps and immutable timestamp/base32 IDs. Positions are zero-based UTF-16 with exclusive ends. Strict UTF-8 decoding rejects binary files; BOM is stripped and CRLF/lone CR normalize to LF.
- Context widens up to ten lines above/below. Resolution prefers exact context, then unique relocation, then warned nearest identical context/selection. Distance compares lines, then characters; ties choose the earlier offset and remain uncertain. No fuzzy or old-line fallback exists. Playback uses unsaved buffers and refreshes on step entry/Return to Current Step.
- Delivery (superseded by `add-shared-launcher`): successful replies lead with **Walkthrough available**: the title, the publisher's replayable HTTPS `url` copied verbatim, the ID/path, and the picker fallback. They then keep the normal answer's requested findings, evidence, rationale, and uncertainty. Window routing is a later change.
- Comments use untrusted Markdown. The Step view renders overview/narrative/stale explanations with a strict CSP and HTTP(S)-only links. Highlight colors and fenced-code rendering still require manual visual acceptance. Nested artifact discovery supplements `findFiles` with direct directory reads because ignored dot-folders may be excluded.
- Windows full automated run on 2026-10-21 passed: `npm install`, `npm run build`, README sample publishing, `npm run typecheck`, `npm test` (45 tests across 16 files, bundle reproducibility and workflow checks), and `npm run test:extension` (7 tests on VS Code 1.90.2). Publishing ran without an environment override. The sample artifact is Git-ignored. Native Linux/Node 20 CI results remain unavailable; CI configuration is not proof of a hosted run.
- Pages (updated by `add-shared-launcher`): the source is GitHub Actions, and the gated workflow deploys only `launcher/` to `https://pvrobays.github.io/walk-me-through/`. That deployment was live and verified on 2026-10-21.
- Acceptance is complete for this slice. Per owner decision on 2026-10-21, native Linux automated verification is not an acceptance blocker. The owner subsequently reported a successful manual VS Code integration test on a native Linux host; no Linux CI or detailed visual-check results are claimed. Windows manual Development Host Markdown/highlight/navigation checks, including fenced-code syntax coloring, and the restarted OpenCode discovery/authoring/recovery/playback run passed; details below.

### Manual acceptance session (2026-10-21, complete)

- Host: native Windows, installed VS Code 1.138.0, Extension Development Host launched with **Walk Me Through sample**. Sample artifact: `20261021T095239797Z-6cucvh`.
- Task 12.3, scenario 1 — user reports all checks passed: Open Walkthrough waits for an explicit picker choice; the overview renders its summary with bold emphasis; Step-view Next enters **Follow the delay** and displays its narrative; the existing `retry.ts` editor remains open without a source comment or highlight for these location-less entries; current-entry marking, text, and controls are readable.
- Task 12.3, scenario 2 — user reports both parts passed: **Retry loop** highlights exactly lines 3–14 and shows a read-only comment with bold, inline code, a bullet list, and a formatted fenced TypeScript block; the fenced block has syntax coloring. Direct tree selection of **Attempt zero every time** highlights only `retryDelay(0)` on line 9, removes the previous multiline highlight/comment, renders italic emphasis and inline code, and marks the selected step current.
- Task 12.3, scenario 3 — user reports all four navigation checks passed: comment-header Next/Previous navigate between the expression and timing-helper steps; Command Palette Previous/Next traverse the location-less grouping step and expression; Step-view Next enters a collapsed parent's child and reveals it; Return to Current Step restores the expression's source and comment after browsing another file.
- Task 12.3, scenario 4 — user reports all uncertain-state checks passed after appending an unsaved comment to the expression's line: only `retryDelay(0)` remains highlighted, its dashed warning border is distinct, both explanation surfaces warn about uncertain nearest-identical selection, and the tree shows a warning. UX feedback: the warning is very easy to spot, possibly too prominent; consider smaller warning text where the rendering surface allows it.
- Task 12.3, scenario 5 — user reports all stale-state checks passed after changing the unsaved expression to `retryDelay(1)`: no highlight/comment remains, the Step view retains the explanation and original path/line with a stale banner, the tree marks the step stale, and playback does not navigate to the old position. Requested refinement implemented, pending visual recheck: error-themed stale banner and tree icon, with concise wording that the original code was not found and may have changed since generation.
- Task 12.3, scenario 6 — user approves the updated stale presentation after reload: error-themed banner/tree icon, condensed missing-original-code explanation, and no source highlight/comment. Build, typecheck, and all 7 Windows extension-host tests passed after this refinement. Task 12.3 manual acceptance is complete on Windows/VS Code 1.138.0.
- Task 12.4, scenario 7 — installed the canonical bundle with `npm run skill:install -- <scratch project>` into `C:\Users\pvrobays\AppData\Local\Temp\opencode\wmt-agent-acceptance-20261021`. User reports a fresh OpenCode process discovered/loaded the skill from an explanation request that did not name it, wrote a draft, and published successfully. Its supplied final reply preserves a detailed source-referenced explanation, reports assertions against unchanged source and their timer-measurement limits, distinguishes the unexecuted proposed fix, and appends title, ID `20261021T110546176Z-k6v55p`, artifact path, and picker instructions. Assertions are reported by the scratch agent, not independently rerun in this session. Playback and intentional recovery/blocker scenarios remain pending.
- Task 12.4, scenario 8 — user reports the real-agent artifact plays correctly in the scratch-project Development Host and its sequence makes sense. UX feedback: the explanation is too verbose for this reader. Proposed follow-up: use hierarchy for progressive disclosure, with a complete concise account at the top level and optional detailed evidence/deep dives in children. Consider explicit navigation for skipping details; current depth-first Next intentionally visits children even when collapsed. This authoring/navigation refinement is not yet implemented. Intentional recovery/blocker scenarios remain pending.
- Task 12.4, scenario 9 — user reports intentional empty-selection recovery succeeded. The agent's supplied reply identifies `EMPTY_SELECTION` at `steps[0].location`, `fix-input` recovery, the original blank `src/retry.ts:2–2` selection, and the repair guidance. It reports inspecting source and changing the location to line 9 with `match: "retryDelay(0)"` before retrying. The corrected publish produced four steps without warnings, ID `20261021T112027988Z-kdbjkr`; source was unchanged. User additionally requests walkthrough availability/opening details at the beginning of successful final replies; skill and contracts updated, pending fresh-process verification. Publishing-blocker scenario remains pending.
- Task 12.4, scenario 10 — user confirms the updated skill leads a fresh-process final reply with **Walkthrough available**, title/opening instructions, ID `20261021T112519967Z-txci7p`, and artifact path. Build, all 45 unit/script tests, bundle/workflow checks, and strict OpenSpec validation passed after the delivery-order update. Publishing-blocker scenario remains pending.
- Task 12.4, scenario 11 — supplied agent reply confirms the simulated child-only SSH environment returned `ENVIRONMENT_UNSUPPORTED` with `fix-environment` and native Windows/Linux/Node 20+ setup guidance. It explicitly stopped without override/retry, left the parent environment unchanged, and reported no new published walkthrough (only the draft). User additionally confirms the reply preserved the normal explanation. Blocker handling passes; task 12.4 is complete.
- Task 12.2 Windows verification passed. Its native Linux acceptance blocker was removed by owner decision (2026-10-21); the owner later reported a successful native Linux manual VS Code integration test, with automated Linux results still unrecorded.

## 1. Problem, audience, and product

The owner uses OpenCode in a terminal extensively, especially to explore code and investigate bugs. Agent answers often contain a sequence of insightful references to small source ranges. Following those references requires the human to build context across several files. Large quoted excerpts help comprehension but cost output tokens and repeat locally available code.

**Walk Me Through** presents a curated explanation trail in the IDE: ordered steps, highlighted source, and a description of why each location matters and how it supports the finding. It should help the reader verify claims and make informed decisions.

The README must stay short (most readers read at most two paragraphs), place this quote above its problem summary, and stress getting the context to the human as quickly and frictionlessly as possible. Details belong in `how-it-works.md` and this file.

> **“Moving the code context out of the model’s output and into the IDE, where it already exists.”**

The artifact is an evidence-backed explanation, not private chain-of-thought. Useful content includes observations, hypotheses, conclusions, uncertainty, and connections between code locations. Avoid turning ordinary source navigation into a claim that an agent's explanation has been proven correct.

The owner primarily uses JetBrains Rider, but chose **desktop VS Code on native Windows and native Linux with our own simple player for the first implementation**, followed by Rider after UX validation. CodeTour was rejected because of its limited maintenance. OpenCode is the first authoring client; other-agent compatibility remains desirable.

## 2. Agreed requirements

### Installation and distribution

- No separate companion application, daemon, background service, or required MCP server.
- A small script bundled beside the skill is explicitly acceptable. It is invoked on demand and exits.
- Install the authoring skill **only in the current project**, at `.agents/skills/walk-me-through/`.
- When the IDE plugin sees the skill is absent in a Git workspace, offer to install it once per workspace. Provide "Not for this workspace" and "Never" dismissal options and respect them. Keep an explicit installation command available.
- The developer commits the bundle so teammates receive it through Git. Do not commit automatically.
- Teammates' compatible agents can discover the skill without installing the IDE viewer.
- A viewer-less teammate should be able to follow the generated link to installation instructions and retry playback after installing.
- Skill, script, and support files must be versioned together. The plugin must inspect that version and offer updates when necessary.
- Preserve local customization and never silently downgrade a newer project bundle.
- Distribute the extension through the VS Code Marketplace and also support downloadable `.vsix` files on GitHub Releases. The extension is published on the Marketplace as `pvrobays.walk-me-through` (owner report, 2026-10-22); GitHub Release `.vsix` files are not yet provided.

### Walkthrough experience

- Each code step has a source range and a concise explanation of its significance and connection to the finding.
- Preserve Markdown formatting in explanations, including emphasis and inline code. Use VS Code comments with `MarkdownString` as the initial rich-text surface; verify rendering in the first vertical slice.
- Top-level narrative steps may omit a code location. Parent/grouping steps may also omit a location; nested leaf steps require one.
- Support character/expression selections, single lines, methods or other multiline blocks. Prefer the smallest useful range rather than arbitrary large excerpts.
- Steps can have children: **at most four levels total**, with top-level steps at level 1.
- Provide backward/forward navigation and direct selection of a step.
- Navigation and replay are local; they do not require model calls.
- Capture original code anchors during generation, validate on playback, and relocate an unchanged block if surrounding edits shifted it.
- Prefer the captured original context. If several identical matches exist, choose the one nearest the original position and visibly warn that the original location could not be identified confidently. If the context no longer matches, an identical selection may be used with the same warning. If no identical selection remains, mark stale; do not invent a fuzzy or semantic match.
- Begin successful replies with walkthrough availability, title, ID/path, and picker instructions; include a replayable link there when the launcher exists. Follow with the normal agent answer at the requested depth, including evidence, rationale, and uncertainty. Do not require duplication of every step.

### Delivery and workspace identity

- Start with structured files and clickable links, not MCP publication.
- Links identify a specific walkthrough; optional step targeting should be supported. Do not use a mutable “latest” target for historical links.
- Support several open IDE windows on different repositories.
- Match the **exact checkout/worktree and execution environment**. A Git remote, repository name, or currently active window alone is insufficient.
- Open/focus the matching workspace and play the specified walkthrough. If the IDE is closed, launch it into that workspace.
- For VS Code, open a folder or `.code-workspace`; a `.sln` is optional solution context, not a substitute for opening a workspace.
- A static HTTPS landing page provides explicit IDE-open buttons and installation instructions. GitHub Pages is an accepted hosting option.
- Carry launch data in the URL fragment (`#...`), not query parameters or server-side storage.
- The page must not claim it can reliably detect extension installation from a timeout. Provide install/help and retry controls explicitly.
- Rider support and optional MCP automatic opening are follow-up features.

## 3. Proposed architecture

```text
Project-local skill
      |
      v
Existing coding agent --writes--> Walkthrough input
      |
      +--invokes bundled script--> Validate / capture anchors / persist artifact
                                        |
                                        v
                               Replayable HTTPS link
                                        |
                                        v
                           Static GitHub Pages launcher
                           Open IDE / install / retry
                                        |
                                        v
                              Walk Me Through extension
                              - Resolve workspace
                              - Validate artifact
                              - Check/relocate anchors
                              - Render Markdown explanations
                              - Own highlights and nested navigation
```

Keep the walkthrough contract editor-independent. Rider and future MCP delivery should use the same artifacts, not require regenerating explanations.

### Proposed project bundle

```text
.agents/skills/walk-me-through/
  SKILL.md
  manifest.json
  references/
    walkthrough-format.md
  scripts/
    publish-walkthrough.mjs
```

This is the directory installed into a consuming project. Keep a single canonical bundle source in `packages/skill` and package it into each IDE extension.

### Source layout and shared implementation

Use a TypeScript monorepo with `packages/core`, `packages/skill`, and `packages/vscode`; add `launcher/` in the follow-up. Share schema validation, coordinates, hashing, and resolution through core. Bundle with esbuild into the extension and committed script. Launch-envelope logic is follow-up work. Consuming projects need no build tools or package installation.

### Runtime: recommendation, not yet a compatibility promise

Ship a dependency-free JavaScript bundle using Node built-ins. TypeScript and esbuild are development-time tools only. Document a minimum Node version after choosing and testing it. Do not assume VS Code's internal Node runtime makes a `node` executable available to OpenCode or another external agent. No `npm install`, network downloads, or native compilation should be needed to run the publishing script.

If a required runtime is missing, provide an actionable message. Do not let the model fabricate hashes. Additional-runtime-free fallback using short exact-text anchors was discussed but not selected or designed.

### Observed development environment

The review session on 2026-10-21 ran OpenCode on native Windows, PowerShell 7.6, Node v24.16.0, with `code.cmd` available. WSL was not used. The selected runtime contract is Node 20+ on native Windows/Linux; WSL, SSH, containers, and other unsupported environments receive actionable errors.

## 4. Versioning and update contract

The following is a **proposed shape**, not a shipped schema:

```json
{
  "manifestVersion": 1,
  "bundleVersion": "0.1.0",
  "walkthroughSchemaVersion": 1,
  "files": {
    "SKILL.md": "<sha256>",
    "references/walkthrough-format.md": "<sha256>",
    "scripts/publish-walkthrough.mjs": "<sha256>"
  }
}
```

- `bundleVersion`: semantic version of skill, script, and support files as one release.
- `manifestVersion`: installation metadata format.
- `walkthroughSchemaVersion`: artifact format compatibility. Define a supported range/capability contract if one value becomes insufficient.
- The plugin includes its own known bundle manifest and compares it with the project's installation.
- Record generator bundle and artifact schema versions in generated walkthroughs.
- Published-file hashes allow customization detection. Hash UTF-8 text after stripping a leading BOM and normalizing CRLF to LF, so Git CRLF conversion does not look like a user customization. Preserve all other whitespace.
- Do not include a recursively self-hashing manifest entry.
- Missing bundle: offer installation. Older unchanged bundle: offer update. Modified bundle: show differences and preserve edits unless the user chooses replacement. Newer bundle: do not downgrade it.
- Keep project updates atomic enough to avoid a skill/script version mismatch after interruption.
- Changes remain ordinary working-tree changes for review and commit.
- Both VS Code and Rider plugins must obey the same ownership/version contract.
- An extension uninstall should not remove a team-owned committed project skill. If offering removal, make it an explicit project operation.

## 5. Artifact and publishing script

Design a small validated schema rather than asking the agent to write internal player state. Suggested conceptual fields:

- Artifact schema version, generator bundle version, stable walkthrough ID.
- Title and concise summary.
- Creation time and source revision when available; a commit alone is insufficient for dirty working-tree state.
- Exact local checkout identity and execution-environment information for launch/routing, separated from portable source references.
- Steps with stable IDs, optional `parentId`, title, Markdown explanation, and optional project-relative source path/range under the narrative/grouping rules above.
- Captured anchor metadata and optional observation/hypothesis/conclusion classification. Accept and preserve these optional labels now; displaying them is a later enhancement.

### Agent-authored input

Keep authoring input separate from the stored artifact. The agent writes a JSON file with title, summary, and nested steps using `children` arrays. For code references it supplies a project-relative path, a line range, and optionally an exact-text `match` snippet. It does not calculate UTF-16 columns, hashes, IDs, timestamps, or URL encoding.

Use human-facing 1-based inclusive start/end lines in input; the script converts these into the stored coordinate convention below. A supplied snippet must match exactly and uniquely within the supplied line range after the documented line-ending normalization; reject missing or ambiguous snippets so the agent can refine the input. Without a snippet, select the supplied whole-line span. Narrative top-level steps and grouping parents can omit a reference; nested leaves cannot.

The script generates walkthrough/step IDs and flattens `children` into stored `parentId` relationships. This avoids asking the agent to reference IDs it cannot know yet. Imported flat artifacts still require parent/cycle/depth validation.

The script should:

1. Read an agent-authored JSON file with `node <bundle>/scripts/publish-walkthrough.mjs <input.json>`. File input is the MVP interface; avoid shell-dependent stdin quoting.
2. Resolve the project root from the installed script's location under `.agents/skills/walk-me-through/`, even if invoked from a subdirectory. Git is not required to find the root; record revision/dirty-state metadata when available.
3. Validate paths, ranges, IDs, parent relationships, cycles, and maximum hierarchy depth.
4. Read the referenced source as it exists at generation and capture original anchors.
5. Generate IDs/timestamps/encoding itself rather than spending model output on mechanical metadata.
6. Write an immutable, versioned artifact atomically.
7. Return the artifact ID/path and instructions to choose its title/ID through Open Walkthrough. Add the required HTTPS launch URL in the launcher follow-up.

The script does not launch or focus the IDE. The current slice uses an explicit picker; clicking the HTTPS link becomes the primary interaction in the delivery follow-up.

### Coordinates

Stored ranges use **0-based lines and 0-based UTF-16 character offsets, with an exclusive end**. Tabs count as their underlying character, not expanded display columns. Normalize CRLF to LF and strip a leading BOM for anchor comparisons, retaining mappings to document positions where needed. Convert the agent's 1-based inclusive line ranges and optional snippet into this convention in the script; agents never count columns. Convert explicitly at editor boundaries, including future Rider support.

### Hash anchors

Capture anchors **when generating the artifact**, not only on first playback. Otherwise edits made before the first click destroy the original reference.

Agreed algorithm:

1. Starting with the selected span, widen the surrounding context by whole lines until it is unique in the file or a documented context cap is reached. Hash the normalized block with SHA-256 and store its original range, length, and the selection's relative offsets.
2. Also retain enough exact selection text/metadata to find the identical selected code when its surrounding context changes. SHA-256 alone does not enable variable-context selection recovery.
3. On playback, compare the current original context range against its hash. If it matches, retain the original selection.
4. Otherwise search the same file for identical normalized context blocks. A unique context match relocates the selection using its relative offsets.
5. If multiple context matches exist, choose the one closest to the original selection position and show an explicit uncertain-location warning. If no context matches, search for the identical normalized selection and use the closest candidate with the warning, even if only one selection match exists: the captured context was lost.
6. If no identical selection remains, show stale state without a source highlight. Do not fall back to the old line number or fuzzy similarity. Equal-distance candidate handling and the exact distance metric must be specified and tested during implementation; do not present such a tie as confident.

Normalize line endings consistently and strip a leading BOM. Do not introduce broad whitespace normalization. A tiny expression alone may occur many times; context-first matching reduces uncertainty, and nearest-identical fallback must remain visibly distinct from a confident match. Keep captured source text bounded to what the resolver needs rather than duplicating whole files.

This survives changes above/below an unchanged block and can offer warned navigation when context changes but the selected code remains identical. It does not establish semantic equivalence, and an identical match near the original position is not proof of identity. An optional symbol label is not a semantic resolver.

Account explicitly for unsaved IDE buffers: the script normally sees disk contents, while the plugin may see a newer buffer. Compare against the current document before highlighting.

### Storage and sharing

Store generated artifacts in `<project-root>/.walk-me-through/`. Create that directory's own `.gitignore` containing `*`; do not edit the project's top-level `.gitignore`. Keep immutable artifacts addressable by stable IDs; retain them by default so older links remain replayable. Explicit export/sharing is later work.

Distinguish:

- **Local replay:** durable link refers to a retained local artifact; no expiration by default. Deleting artifacts breaks those links.
- **Team skill sharing:** commit the skill/script bundle; each teammate generates artifacts against their own checkout.
- **Sharing one walkthrough across machines:** requires an embedded/exported artifact or committed artifact plus checkout mapping. An author's absolute path is not portable.

The selected launch envelope identifies the saved local artifact, checkout, environment, and optional step. Start with this self-describing URL even if it is long; do not introduce a per-user short-link index or URL-shortening service to solve terminal wrapping upfront. Fully embedded artifact URLs are not required for the MVP. A local artifact reference is not automatically cross-machine shareable.

## 6. Launcher and IDE routing

Host static HTML/CSS/JavaScript on GitHub Pages, potentially at:

```text
https://pvrobays.github.io/walk-me-through/#<encoded-launch-data>
```

The launcher is live at this address. Pages deploys from GitHub Actions and publishes only `launcher/`.

The fragment is a **base64url-encoded JSON** v1 envelope with the root, environment, artifact ID, an optional step, and a display-only title, at most 1,536 characters. Its fields, limits, and validation are specified in `add-shared-launcher` and shared through `tests/conformance/launch-v1.json`. Links were clickable in Windows Terminal during owner acceptance. Models never encode launch data.

Fragments are not sent in the HTTP request. They remain visible to page JavaScript, browser history, copied links, and the receiving IDE. Keep the launcher self-contained with no analytics or third-party scripts. A hosted page cannot read arbitrary local files; it passes a reference to the IDE, which reads the artifact locally.

Provide explicit Open buttons, plugin Marketplace links, installation instructions, and retry. Do not silently install software. Re-clicking the original link must still work after installing the plugin.

Local HTML next to the skill was considered, but `file://` handling is less reliable across terminals/browsers. Use HTTPS as the primary route; offline support is a later option.

### Routing plan: verify after the first vertical slice

VS Code supports opening folders with URLs and extension URI handlers, but an extension URL does **not** inherently target the window with the requested repository. Implement and verify routing after the current-window playback slice, rather than blocking the first demonstration on a routing spike.

The proposed mechanism is for the receiving extension window to persist a pending playback request in shared extension storage, then forward it to the matching instance or open/focus its folder/workspace. The target instance consumes the request after activation/open/reload; startup activation and request watching may be needed. Try `vscode.openFolder` with appropriate new-window options without replacing unrelated windows. **Do not assume `forceNewWindow` focuses an existing instance**: verify the actual behavior and adapt discovery/forwarding as necessary. Shared request persistence is part of the extension, not a companion daemon.

Requirements:

- Compare canonical checkout paths, not just remote URLs.
- Distinguish worktrees/clones and local/WSL/SSH/container environments.
- Reuse a matching window when the checkout is within a larger workspace, opened through a subfolder, or present in a multi-root workspace. Resolve source paths against the artifact's project root, not an arbitrary workspace folder.
- Preserve pending playback across workspace opening, extension activation, reload, or a newly opened window.
- Do not replace an unrelated window's workspace just because it was last active.
- If necessary, add instance discovery/forwarding inside the extension architecture; do not introduce a companion daemon as a shortcut.
- If the same checkout is available in two windows, route to the most recently focused matching window; track focus changes rather than letting the first claimant win.

The MVP supports desktop VS Code on native Windows and native Linux. Reject WSL/SSH/container/remote execution; a matching path in another environment is not the same checkout.

## 7. Custom playback UI

Build our own simple player; do not depend on or fork CodeTour. Start with VS Code's Comments API for explanations beside source, a Tree View for the nested outline, and editor decorations/selections for precise source highlights. Keep agent chat available alongside playback.

The VS Code API defines `Comment.body` as `string | MarkdownString`, so comments support rich Markdown rather than plain text only. Preserve agent-authored bold/italic emphasis, inline code, lists, and code blocks through `MarkdownString`. Verify actual rendering, including code-block highlighting, in the first vertical slice. Arbitrary HTML/CSS styling or custom text background colors are not promised. If the comment surface cannot preserve the required Markdown experience, adapt our own UI (for example, a small webview) rather than returning to CodeTour.

Top-level narrative steps and parent/grouping steps without source locations still need an explanation surface; do not attach them to fabricated source positions. The player must show them in its walkthrough view while leaving the current editor context available. Preserve the four-level hierarchy in the canonical artifact and outline.

Proposed navigation semantics:

- Next enters children in depth-first order; Previous reverses that order.
- Collapsing is a presentation operation, not accidental permanent loss of access to child steps.
- Provide an explicit skip-subtree action if needed.
- Deep links to a child reveal its ancestors.
- Provide return-to-current-step after the reader explores other code.
- Playback should not steal focus merely because another artifact is generated.

The player owns context validation, relocation, and stale-state handling. Make original/confidently relocated, uncertain-nearest-match, and stale states visibly distinct. An uncertain match must say that the original location could not be recovered confidently and that the closest identical code is being shown.

Keep Markdown command links disabled (`MarkdownString.isTrusted` unset/false). Custom links between walkthrough steps or source files are a later enhancement. Optional evidence labels can be accepted and retained in artifacts before the UI displays them.

## 8. MVP scope and acceptance criteria

### Updated delivery sequence — owner agreed 2026-10-21

After the accepted VS Code vertical slice and progressive-depth UX refinement, prioritize:

1. **Rider playback parity**, beginning with a Rider-native explanation/highlight prototype. Reuse the existing project skill and v1 artifacts. Target the same reading/navigation semantics: nested outline, overview/narrative/stale explanations, Markdown beside precise source highlights, Next/Previous/Skip Details, direct selection, Return to Current Step, current-buffer anchor resolution, and replacement/close cleanup. Validate the explanation surface before committing to its full implementation.
2. **Shared HTTPS launcher**, offering explicit VS Code and Rider choices, installation help, and retry through a versioned launch envelope.
3. **Correct-window routing for each IDE**, including exact checkout identity, closed-editor startup, unrelated active windows, duplicate windows, subfolder projects, and multi-root equivalents where applicable.
4. **Project onboarding, bundle updates, and distribution**, preserving project-local ownership and customizations.

This sequence supersedes the earlier VS Code-first milestone ordering below and Rider's previous placement after the complete VS Code feature set. Rider is the owner's primary IDE; validating it now should inform the shared delivery design. Same UX means equivalent reading and navigation behavior using appropriate Rider-native surfaces; an equivalent of VS Code comments has not yet been established. Rider version/build compatibility and the concrete explanation surface must be settled in the Rider change.

The `refine-progressive-depth-ux` change has 11/11 tracked tasks complete. Manual acceptance and the owner's explicit closure of fresh-agent acceptance are recorded in that change's `verification.md`; no additional scratch-agent run is claimed.

### Milestone A: first vertical slice

- Build shared TypeScript core, generated dependency-free script, and a minimal VS Code extension.
- Demonstrate agent-authored JSON -> script invocation -> captured anchors and immutable local artifact -> **Open Walkthrough** command in the current window.
- Show Markdown-rich explanations, precise expression/multiline selections, a nested outline, and local Previous/Next in our own player.
- Include a small sample walkthrough so the owner can try the flow before investing in routing or onboarding polish.
- Keep a manually installed development bundle sufficient for this slice; complete installation/update UX later.

### Milestone B: link delivery and workspace routing

- Add the HTTPS launcher and versioned base64url launch envelope, explicit Open/Install/Retry controls, and extension URI handling.
- Verify OpenCode/Windows Terminal hyperlink behavior with the initial self-describing URL, accepting long URLs before optimizing.
- Implement pending-request handoff and correct-window routing; exercise closed-editor, wrong-active-window, duplicate-window, subfolder, and multi-root cases.
- Improve anchor recovery and warned-nearest-match/stale presentation using the first-slice feedback.

### Milestone C: project onboarding, updates, and distribution

- Plugin offers project-only installation at `.agents/skills/walk-me-through/`.
- Bundle manifest, reproducible file hashes, customization-aware update offers.
- Skill defines concise explanations and one script invocation.
- Script validates input, captures anchors, writes an artifact, and emits a replay link.
- A second checkout containing the committed skill can generate a walkthrough without its viewer installed.
- Support Marketplace packaging and downloadable GitHub Release `.vsix` artifacts; actual publication is a separate action.
- Complete input/import validation, update handling, and end-to-end acceptance checks.
- Lead with replay instructions/link, followed by the requested normal explanation, without requiring duplication of every walkthrough step.

### Required acceptance scenarios

1. VS Code closed: link opens the intended workspace and walkthrough.
2. Repo A and Repo B open, B active: A's link plays in A without replacing B.
3. No viewer installed: landing page offers installation and retry; the original link works afterward.
4. Re-click an older link: opens the same artifact, not the newest one.
5. Insert lines above a target before the first click: captured hash relocates it correctly.
6. Multiple identical relocation candidates: choose the closest to the original position with a visible uncertainty warning. Changed context but unchanged selection: nearest-identical-selection fallback with a warning. Edited selection with no identical match: stale state and no highlight.
7. Expression and multiline selections show the intended source span.
8. Four-level hierarchy works; a fifth level and parent cycles are rejected.
9. Missing/older/customized/newer bundles produce the correct installation/update behavior.
10. Playback requires no model calls, companion app, MCP registration, or package download.
11. Markdown emphasis, inline code, lists, and code blocks survive authoring and playback. Top-level narrative steps and location-less grouping parents display without fabricated code references; nested leaves without locations are rejected.
12. Same checkout in two windows: use the most recently focused matching one. Subfolder and multi-root workspaces are reused without replacing unrelated workspaces.
13. The script works from a subdirectory using its installation to find the project root, produces artifacts under a self-ignored `.walk-me-through/`, and requires no git command to resolve that root.
14. Missing-skill prompts appear once per Git workspace and respect both workspace and global dismissal. WSL/remote execution produces an actionable unsupported-environment message.

Use meaningful unit tests for schema, anchors (including context expansion, nearest-candidate distance/ties, and uncertainty states), coordinate conversion, version/update decisions, hierarchy, and launch parsing. Use extension-host/manual integration tests for Markdown comments, our player, and window routing. Documentation-only work does not need application tests. Do not claim runtime scenarios passed without exercising them.

### Out of MVP

- Rider frontend.
- MCP automatic delivery/opening.
- Git baseline capture, complete diff coverage enforcement, and before/after review.
- Dependency graph visualization beyond the required child hierarchy.
- Hosted artifact storage, accounts, or model API integration.
- Guaranteed support for all agents, browsers, terminals, or remote environments.
- Custom description links between steps/files and displaying optional evidence classifications.

## 9. Follow-up roadmap

1. **Rider / IntelliJ frontend:** Kotlin tool window, source highlighting, anchor resolution, same artifact and project bundle. No C# semantic backend is required for plain-text ranges; symbol-aware features may require Rider/ReSharper integration.
2. **Portable export/sharing:** checkout-independent references, mapping on import, and optional self-contained small links. Preserve original anchors.
3. **Optional MCP transport:** automatic publication/notification/opening, reusing the publishing and playback contracts. Explore IDE-hosted MCP support rather than adding a mandatory companion.
4. **Agent compatibility:** test Copilot in VS Code and JetBrains, Claude Code, Codex, and additional clients. Coexist with their chat UI; embedded UI inside Copilot chat is not established.
5. **Remote environments:** WSL, SSH, containers, remote IDE hosts, path mapping, and correct skill/script execution location.
6. **Richer explanation tools:** evidence labels, related-step links, investigation branches, and navigation refinements based on actual use.
7. **Optional change walkthroughs:** focused diffs/baselines only if user demand justifies the extra complexity and footprint.

## 10. Existing projects and research

Research was performed during the design conversation on 2026-10-21. Recheck external APIs and releases before depending on them.

### Agent CodeWalk

- Repository: https://github.com/andylin-hao/agent-codewalk
- Inspected revision: `b5cf9df0a1bc197a60b9520fa369d2bca55da900`; latest release then: `v0.8.0`.
- MIT-licensed; source and documentation reviewed, not installed/runtime-tested.
- Own VS Code player and Rust stdio MCP companion. Extension bundles the binary; explicit setup copies it into user application data and modifies agent integrations. No Rust toolchain is needed by supported-platform users, but there is a separate process/configuration footprint.
- Explanation-only `publish_explanation` and change-oriented `begin_task`/`publish_walkthrough` workflows.
- Extra capabilities: hierarchical steps, sibling dependency graphs, file order, real diff-hunk coverage checks, focused before/after views, CodeLens, local session history, and unique hash relocation.
- Current anchors/selection are whole-line based, not character-level.
- No JetBrains frontend or replayable external URI handler was found in the inspected tree/activation implementation.
- It discovers the correct sessions for each open workspace via canonical root fingerprints. It does not route a link to the correct IDE instance or launch a closed editor.
- Useful reference implementation, but the owner explicitly prefers avoiding its companion architecture. Do not introduce that architecture merely to reuse its code.

Relevant source:

- https://github.com/andylin-hao/agent-codewalk/blob/main/extension/src/storage.ts
- https://github.com/andylin-hao/agent-codewalk/blob/main/extension/src/player.ts
- https://github.com/andylin-hao/agent-codewalk/blob/main/extension/src/installer.ts
- https://github.com/andylin-hao/agent-codewalk/blob/main/protocol/walkthrough-v1.schema.json

### CodeTour and other related work

CodeTour is historical research only, **not an implementation dependency**. Its latest observed release was v0.0.59 (March 2023); the reviewed main-branch history showed one later fix merged in August 2025. The owner rejected it because of its limited maintenance and selected our own simple player.

- https://github.com/microsoft/codetour (MIT)
- https://github.com/microsoft/codetour/blob/main/src/api.ts
- https://github.com/microsoft/codetour/blob/main/src/extension.ts
- https://github.com/microsoft/codetour/blob/main/src/store/index.ts
- https://github.com/puyopop/codetour-mcp (MIT; creates/manages CodeTour files through MCP)
- https://github.com/saurabh-yergattikar/codetour_ai (MIT; separate model-driven onboarding-tour generation)

CodeTour's URI handler selects an already discovered tour but does not solve workspace routing or arbitrary artifact import. Its linear format also does not model our required hierarchy. These observations are background, not tasks to integrate its API.

### Platform documentation

- OpenCode skill discovery: https://opencode.ai/docs/skills/
- VS Code agent skills: https://code.visualstudio.com/docs/agent-customization/agent-skills
- VS Code extension URI handlers: https://code.visualstudio.com/api/references/vscode-api#UriHandler
- VS Code folder URLs: https://code.visualstudio.com/docs/configure/command-line#_opening-vs-code-with-urls
- VS Code Markdown comments: https://code.visualstudio.com/api/references/vscode-api#Comment
- VS Code Markdown formatting: https://code.visualstudio.com/api/references/vscode-api#MarkdownString
- Rider plugin architecture: https://plugins.jetbrains.com/docs/intellij/rider.html
- Rider MCP support (future transport): https://www.jetbrains.com/help/rider/mcp-server.html
- JetBrains tool extension documentation: https://github.com/JetBrains/intellij-community/blob/master/plugins/mcp-server/README.md

OpenCode and current VS Code Copilot docs support `.agents/skills/`. Other clients' discovery rules and version requirements still need verification. Adding a skill makes it available, not guaranteed to be invoked. Quit and restart OpenCode after installation/update to pick up config-time changes.

## 11. Remaining implementation details

The product choices above are agreed. Resolve these smaller details while building the vertical slice and record the concrete contracts:

- Minimum supported Node and VS Code versions, tested rather than inferred from the development environment.
- Exact input/artifact/manifest/envelope schemas, validation/size limits, anchor context cap, nearest-candidate distance metric, and equal-distance tie behavior. Ties must remain visibly uncertain.
- The explanation surface for location-less steps and any Markdown rendering gaps in editor comments.
- Actual cross-window focus/forwarding behavior, shared-request lifecycle, and path canonicalization. The routing proposal is not runtime-verified.
- Release/deployment setup for GitHub Release `.vsix` files, and whether to add VS Code Insiders or Open VSX later. The Marketplace ID `pvrobays.walk-me-through` is settled and published; Insiders/Open VSX were not decided.
- Final HTTPS launcher address and hosting configuration. Long URLs are accepted initially; terminal clickability still needs to be exercised.

## 12. Start the next implementation session here

1. Inspect repository instructions and current state; do not assume only these files exist by then.
2. Read this handoff and preserve agreed requirements versus provisional choices.
3. Use the observed native-Windows/Windows Terminal/Node environment as the starting point; recheck availability when implementing rather than reopening settled product choices.
4. Build Milestone A first: one small agent-input/script/artifact/current-window-playback flow with our own Markdown-capable player. Do not front-load CodeTour or routing spikes.
5. Finalize concrete schema field names and remaining implementation details within the agreed input, coordinate, storage, runtime-bundling, and launch contracts.
6. Extend the slice with launcher/routing, then onboarding/updates/distribution, adapting each part after trying the preceding end-to-end flow. Keep README status and setup instructions accurate.
7. Do not configure GitHub Pages, publish marketplace extensions, or change global agent configuration implicitly. Those are separate explicit deployment/configuration actions.

The desired outcome is a working, lightweight explanation tool—not a reimplementation of all Agent CodeWalk features.
