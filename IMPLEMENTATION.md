# Implementation handoff

This document preserves the product discussion and decisions for the next coding session. Read it together with [README.md](README.md) before implementing. The repository currently contains documentation and its original MIT license; the application is not implemented.

## 1. Problem, audience, and product

The owner uses OpenCode in a terminal extensively, especially to explore code and investigate bugs. Agent answers often contain a sequence of insightful references to small source ranges. Following those references requires the human to build context across several files. Large quoted excerpts help comprehension but cost output tokens and repeat locally available code.

**Walk Me Through** presents a curated explanation trail in the IDE: ordered steps, highlighted source, and a description of why each location matters and how it supports the finding. It should help the reader verify claims and make informed decisions.

The README must begin with a summary of this problem and retain this quote:

> **“Moving the code context out of the model’s output and into the IDE, where it already exists.”**

The artifact is an evidence-backed explanation, not private chain-of-thought. Useful content includes observations, hypotheses, conclusions, uncertainty, and connections between code locations. Avoid turning ordinary source navigation into a claim that an agent's explanation has been proven correct.

The owner primarily uses JetBrains Rider, but explicitly chose **VS Code + CodeTour for the first implementation**, followed by Rider after UX validation. OpenCode is the first authoring client. Compatibility with other agents, especially Copilot in IDEs, is desirable.

## 2. Agreed requirements

### Installation and distribution

- No separate companion application, daemon, background service, or required MCP server.
- A small script bundled beside the skill is explicitly acceptable. It is invoked on demand and exits.
- Install the authoring skill **only in the current project**, at `.agents/skills/walk-me-through/`.
- When the IDE plugin sees the skill is absent, offer to install it in that project. Respect dismissal; do not prompt repeatedly.
- The developer commits the bundle so teammates receive it through Git. Do not commit automatically.
- Teammates' compatible agents can discover the skill without installing the IDE viewer.
- A viewer-less teammate should be able to follow the generated link to installation instructions and retry playback after installing.
- Skill, script, and support files must be versioned together. The plugin must inspect that version and offer updates when necessary.
- Preserve local customization and never silently downgrade a newer project bundle.

### Walkthrough experience

- Each code step has a source range and a concise explanation of its significance and connection to the finding.
- Support character/expression selections, single lines, methods or other multiline blocks. Prefer the smallest useful range rather than arbitrary large excerpts.
- Steps can have children: **at most four levels total**, with top-level steps at level 1.
- Provide backward/forward navigation and direct selection of a step.
- Navigation and replay are local; they do not require model calls.
- Capture original code anchors during generation, validate on playback, and relocate an unchanged block if surrounding edits shifted it.
- If no unique trustworthy match exists, show the reference as stale rather than highlighting a guessed location.
- Keep a short summary and replayable link in the agent conversation; avoid duplicating the full walkthrough there.

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
                              - Adapt to CodeTour playback
                              - Own missing navigation UI
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

This is the directory installed into a consuming project. Where its canonical source lives in this application's repository is an implementation choice. Keep a single canonical source and package it into each IDE extension.

### Runtime: recommendation, not yet a compatibility promise

Use dependency-free JavaScript with Node built-ins if practical. Document a minimum Node version after choosing and testing it. Do not assume VS Code's internal Node runtime makes a `node` executable available to OpenCode or another external agent. No `npm install`, network downloads, or native compilation should be needed to run the publishing script.

If a required runtime is missing, provide an actionable message. Do not let the model fabricate hashes. Additional-runtime-free fallback using short exact-text anchors was discussed but not selected or designed.

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
- Published-file hashes allow customization detection. Define reproducible encoding/line-ending handling so Git CRLF conversion does not look like a user customization.
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
- Steps with stable IDs, optional `parentId`, title, explanation, project-relative source path, and range.
- Captured anchor metadata and optional observation/hypothesis/conclusion classification.

The script should:

1. Read agent-authored input from a file or stdin; choose a documented CLI.
2. Resolve the checkout root even if invoked from a subdirectory.
3. Validate paths, ranges, IDs, parent relationships, cycles, and maximum hierarchy depth.
4. Read the referenced source as it exists at generation and capture original anchors.
5. Generate IDs/timestamps/encoding itself rather than spending model output on mechanical metadata.
6. Write an immutable, versioned artifact atomically.
7. Return a small result containing the artifact location and ready-to-print launch URL.

The script does not launch or focus the IDE by default. Clicking the link is the primary interaction.

### Coordinates

Choose and document exactly one convention, covering line/column bases, UTF-16 versus code points, tabs, inclusive/exclusive ends, and CRLF/LF handling. A prior proposal used 1-based lines and UTF-16 columns with an exclusive end, but this has not been finalized. Convert explicitly at CodeTour/VS Code and future Rider boundaries.

### Hash anchors

Capture anchors **when generating the artifact**, not only on first playback. Otherwise edits made before the first click destroy the original reference.

Proposed algorithm:

1. Hash a normalized original code block with SHA-256 and store its original range and length.
2. On playback, hash the current original range and compare.
3. If mismatched, search the same file for an identical normalized block.
4. Relocate only on exactly one match; otherwise mark stale.

Normalize line endings consistently. Do not introduce broad whitespace normalization without evaluating false matches. For precise expression highlights, capture a surrounding anchor block and the selection's relative offsets within it. A tiny expression alone may occur many times.

This survives changes above/below an unchanged block. It does not establish semantic equivalence after editing the block itself. An optional symbol label is not a semantic resolver.

Account explicitly for unsaved IDE buffers: the script normally sees disk contents, while the plugin may see a newer buffer. Compare against the current document before highlighting.

### Storage and sharing: still to finalize

The latest recommendation was a Git-ignored `.walk-me-through/` directory in the consuming project for generated artifacts, with explicit export later. This was not separately confirmed as a final storage specification.

Distinguish:

- **Local replay:** durable link refers to a retained local artifact; no expiration by default. Deleting artifacts breaks those links.
- **Team skill sharing:** commit the skill/script bundle; each teammate generates artifacts against their own checkout.
- **Sharing one walkthrough across machines:** requires an embedded/exported artifact or committed artifact plus checkout mapping. An author's absolute path is not portable.

The initial preference is compact file-backed links. Fully embedded URLs were discussed as an option for small artifacts, not a requirement to embed every walkthrough. Avoid claiming a file-backed local link is automatically cross-machine shareable.

## 6. Launcher and IDE routing

Host static HTML/CSS/JavaScript on GitHub Pages, potentially at:

```text
https://pvrobays.github.io/walk-me-through/#<encoded-launch-data>
```

This is a proposed address. Hosting is not configured, and no deployment has been requested yet.

The fragment can contain a versioned launch envelope with the artifact reference, target workspace/environment, and optional step ID. Define encoding, size limits, and validation. The script performs encoding; the model should not manually generate base64 or URL escapes.

Fragments are not sent in the HTTP request. They remain visible to page JavaScript, browser history, copied links, and the receiving IDE. Keep the launcher self-contained with no analytics or third-party scripts. A hosted page cannot read arbitrary local files; it passes a reference to the IDE, which reads the artifact locally.

Provide explicit Open buttons, plugin Marketplace links, installation instructions, and retry. Do not silently install software. Re-clicking the original link must still work after installing the plugin.

Local HTML next to the skill was considered, but `file://` handling is less reliable across terminals/browsers. Use HTTPS as the primary route; offline support is a later option.

### Routing is an early technical spike

VS Code supports opening folders with URLs and extension URI handlers, but an extension URL does **not** inherently target the window with the requested repository. Verify actual behavior before choosing the routing implementation.

Requirements:

- Compare canonical checkout paths, not just remote URLs.
- Distinguish worktrees/clones and local/WSL/SSH/container environments.
- Handle a checkout opened as a subfolder and multi-root workspaces deliberately.
- Preserve pending playback across workspace opening, extension activation, reload, or a newly opened window.
- Do not replace an unrelated window's workspace just because it was last active.
- If necessary, add instance discovery/forwarding inside the extension architecture; do not introduce a companion daemon as a shortcut.
- Define behavior for the same checkout open in two windows.

Start with desktop VS Code on native Windows (the owner's environment) unless the implementation session agrees otherwise. Document unsupported remote scenarios; do not advertise universal remote routing before testing it.

## 7. Playback and CodeTour

Use CodeTour's public extension API rather than fork it initially. A VS Code extension dependency can give users one installation action while installing both extensions internally.

CodeTour supports source selections, descriptions, local Previous/Next, a step list, and file-based tours. Its UI uses editor comments, leaving agent chat available.

**Known mismatch:** CodeTour's native artifact is linear; it has no native `parentId` hierarchy. Spike a flattened depth-first playback adapter plus a nested outline/controls owned by Walk Me Through. Preserve the four-level hierarchy in our canonical artifact. If UX cannot meet requirements through its public API, report the tradeoff before replacing the selected foundation.

Proposed navigation semantics:

- Next enters children in depth-first order; Previous reverses that order.
- Collapsing is a presentation operation, not accidental permanent loss of access to child steps.
- Provide an explicit skip-subtree action if needed.
- Deep links to a child reveal its ancestors.
- Provide return-to-current-step after the reader explores other code.
- Playback should not steal focus merely because another artifact is generated.

Hash validation and stale-state handling belong to our adapter. Do not silently fall back to CodeTour's nearest/first text match or old line number after our anchor fails.

Only pass the source-navigation and explanation capabilities required by our schema into CodeTour. CodeTour also supports executable commands and trusted command links; do not expose arbitrary command execution through imported walkthrough content.

## 8. MVP scope and acceptance criteria

### Milestone A: integration and UX spikes

- Verify supported CodeTour version/API and expression/multiline selections.
- Prototype nested steps up to four levels while reusing its player.
- Prove the TUI -> HTTPS launcher -> extension URI path, including correct-window routing.
- Inspect actual OpenCode/terminal hyperlink behavior; the owner's terminal host and native-versus-WSL agent execution are still unknown.

### Milestone B: project onboarding and authoring

- Plugin offers project-only installation at `.agents/skills/walk-me-through/`.
- Bundle manifest, reproducible file hashes, customization-aware update offers.
- Skill defines concise explanations and one script invocation.
- Script validates input, captures anchors, writes an artifact, and emits a replay link.
- A second checkout containing the committed skill can generate a walkthrough without its viewer installed.

### Milestone C: end-to-end explanation playback

- Import a stable artifact and navigate source in VS Code.
- Show summary, step titles/descriptions, hierarchy, exact selections, and local Previous/Next.
- Reject malformed references and make stale anchors visible.
- Keep terminal output to a concise conclusion and link.

### Required acceptance scenarios

1. VS Code closed: link opens the intended workspace and walkthrough.
2. Repo A and Repo B open, B active: A's link plays in A without replacing B.
3. No viewer installed: landing page offers installation and retry; the original link works afterward.
4. Re-click an older link: opens the same artifact, not the newest one.
5. Insert lines above a target before the first click: captured hash relocates it correctly.
6. Two matching relocation candidates or an edited target: stale state, no guessed highlight.
7. Expression and multiline selections show the intended source span.
8. Four-level hierarchy works; a fifth level and parent cycles are rejected.
9. Missing/older/customized/newer bundles produce the correct installation/update behavior.
10. Playback requires no model calls, companion app, MCP registration, or package download.

Use meaningful unit tests for schema, anchors, coordinate conversion, version/update decisions, hierarchy, and launch parsing. Use extension-host/manual integration tests for CodeTour and window routing. Documentation-only work does not need application tests. Do not claim runtime scenarios passed without exercising them.

### Out of MVP

- Rider frontend.
- MCP automatic delivery/opening.
- Git baseline capture, complete diff coverage enforcement, and before/after review.
- Dependency graph visualization beyond the required child hierarchy.
- Hosted artifact storage, accounts, or model API integration.
- Guaranteed support for all agents, browsers, terminals, or remote environments.

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

- https://github.com/microsoft/codetour (MIT)
- https://github.com/microsoft/codetour/blob/main/src/api.ts
- https://github.com/microsoft/codetour/blob/main/src/extension.ts
- https://github.com/microsoft/codetour/blob/main/src/store/index.ts
- https://github.com/puyopop/codetour-mcp (MIT; creates/manages CodeTour files through MCP)
- https://github.com/saurabh-yergattikar/codetour_ai (MIT; separate model-driven onboarding-tour generation)

CodeTour has a URI handler selecting an already discovered tour, but that handler alone does not solve workspace routing or arbitrary artifact import. Its selection positions are converted from 1-based values in the inspected player; verify the exact API/version before adapting coordinates.

### Platform documentation

- OpenCode skill discovery: https://opencode.ai/docs/skills/
- VS Code agent skills: https://code.visualstudio.com/docs/agent-customization/agent-skills
- VS Code extension URI handlers: https://code.visualstudio.com/api/references/vscode-api#UriHandler
- VS Code folder URLs: https://code.visualstudio.com/docs/configure/command-line#_opening-vs-code-with-urls
- Rider plugin architecture: https://plugins.jetbrains.com/docs/intellij/rider.html
- Rider MCP support (future transport): https://www.jetbrains.com/help/rider/mcp-server.html
- JetBrains tool extension documentation: https://github.com/JetBrains/intellij-community/blob/master/plugins/mcp-server/README.md

OpenCode and current VS Code Copilot docs support `.agents/skills/`. Other clients' discovery rules and version requirements still need verification. Adding a skill makes it available, not guaranteed to be invoked. Quit and restart OpenCode after installation/update to pick up config-time changes.

## 11. Start the next implementation session here

1. Inspect repository instructions and current state; do not assume only these files exist by then.
2. Read this handoff and preserve agreed requirements versus provisional choices.
3. Confirm the owner's terminal host, agent execution environment, and Node availability. Continue independent platform spikes while clarifying.
4. Start with CodeTour hierarchy and link/window-routing spikes; they are the largest architectural uncertainties.
5. Finalize schema/coordinates, bundle manifest/update rules, runtime, artifact location, and launch envelope based on the spike results.
6. Implement in small end-to-end milestones, keeping README status and setup instructions accurate.
7. Do not configure GitHub Pages, publish marketplace extensions, or change global agent configuration implicitly. Those are separate explicit deployment/configuration actions.

The desired outcome is a working, lightweight explanation tool—not a reimplementation of all Agent CodeWalk features.
