# Proposal

## Why

Walk Me Through currently exists only as design documentation. We need one complete, runnable flow before building link delivery, window routing, and onboarding: a coding agent writes a walkthrough, a bundled script anchors it to source, and VS Code plays it back beside the code. That will validate the authoring format, anchoring, and player UX early. Later work can then improve each part of the slice separately.

## What Changes

- Add a TypeScript npm-workspaces monorepo with these packages:
  - `packages/core`: shared, editor-independent logic.
  - `packages/skill`: the canonical project skill bundle.
  - `packages/vscode`: the VS Code extension.
- Define version 1 of the agent-authored walkthrough input:
  - A JSON file with a title and summary.
  - Nested `children` steps, up to four levels.
  - Markdown explanations.
  - Optional evidence labels.
  - Code locations given as a project-relative path, a 1-based inclusive line range, and an optional exact-text `match`.
- Define version 1 of the stored walkthrough artifact: a flat step list with generated IDs and `parentId` links, precise 0-based UTF-16 ranges, captured anchors, project root and environment, and optional git metadata. Artifacts are immutable files under `<project-root>/.walk-me-through/walkthroughs/`, ignored by Git through that directory's own `.gitignore`.
- Add a dependency-free Node publishing script, `publish-walkthrough.mjs`, bundled from the shared core with esbuild and committed inside the skill bundle. It will:
  - Resolve the project root from its installed location.
  - Reject unsupported environments.
  - Validate the input.
  - Resolve precise selections.
  - Capture anchors.
  - Write the artifact atomically.
  - Print one concise JSON result.
- Add context-first source anchoring. Playback reports one of four states:
  - **Exact**: the code is still at its original position.
  - **Relocated**: the code moved, and its captured context identifies the new position confidently.
  - **Uncertain**: the nearest identical match is used, with a visible warning.
  - **Stale**: there is no identical match, so nothing is highlighted.
- Add a minimal VS Code player that opens a walkthrough in the current window. It includes:
  - A nested steps tree.
  - Markdown comment threads beside code.
  - A sidebar Step view for summary, narrative, and stale steps.
  - Precise highlight decorations.
  - Previous, Next, and direct navigation in depth-first order.
- Add the skill bundle:
  - `SKILL.md`, which tells the agent to write concise, evidence-backed input, run the script once, and reply with only a short summary.
  - A format reference.
  - A manifest with versions and normalized file hashes.
  - A developer-only command that copies the bundle into a project.
- Add a sample project and walkthrough input so the whole flow can be tried locally.

Out of scope, and left for follow-up changes:
- The HTTPS launcher and launch envelope.
- The URI handler and cross-window routing.
- The automatic skill installation prompt and the update/customization flow.
- Marketplace and GitHub Release publishing.
- Links between steps.
- Displaying evidence labels.
- Rider support.

## Capabilities

### New Capabilities

- `walkthrough-artifact`: The stored, editor-independent artifact format (schema v1). Covers its identity, step hierarchy, ranges, anchors, metadata, validation rules, storage location, and immutability.
- `walkthrough-publishing`: The agent-authored input format and the publishing script's command-line behavior. Covers root resolution, environment checks, input validation, conversion of selections into precise ranges, atomic artifact writing, and result/error output.
- `source-anchoring`: The coordinate convention, text normalization, anchor capture with context widening, and anchor resolution into exact, relocated, uncertain, or stale states.
- `walkthrough-playback`: Opening and navigating a walkthrough in VS Code. Covers discovering artifacts, the steps tree, Markdown explanation surfaces, highlights, how anchor states are shown, and unsupported environments.
- `skill-bundle`: The project-local skill bundle. Covers its contents, agent guidance, the generated committed script, the manifest, and the developer installation command.

### Modified Capabilities

None. No specs exist yet.

## Impact

- **New code**:
  - Root `package.json` defining the workspaces.
  - `packages/core`, `packages/skill`, and `packages/vscode`.
  - The sample project under `examples/`.
  - A `.gitattributes` file enforcing LF line endings.
- **New development dependencies**: TypeScript, esbuild, vitest, `@types/node`, `@types/vscode`, `@vscode/test-cli`, `@vscode/test-electron`, and `@vscode/vsce` (packaging only).
- **Extension runtime dependency**: `markdown-it`, bundled into the extension and used to render the Step view. The published script has no runtime dependencies.
- **Runtime requirements**: Node 20 or later, available as `node` to the agent. Desktop VS Code on native Windows. The minimum VS Code engine version is provisional until it has been tested.
- **Documentation**: the README status and development instructions are updated once the slice works.
- **Consuming projects**: get `.agents/skills/walk-me-through/` (committed by the developer) and a `.walk-me-through/` directory that ignores itself.
