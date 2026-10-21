# Walk Me Through

## The problem

Coding agents often provide useful insights by referring to small, scattered parts of a codebase. During exploration and bug investigations, understanding a finding can require following a whole sequence of references across different files.

Concise terminal answers keep model output costs down, but leave the reader opening files, finding the right expressions, and reconstructing the connections. Including large code excerpts makes explanations easier to follow, but costs more tokens and duplicates source code that is already available locally.

Walk Me Through turns these explanations into navigable, code-anchored walkthroughs inside your IDE. Code steps highlight the relevant source range and explain what it demonstrates, why it matters, and how it connects to the finding. Narrative and grouping steps provide context. You can move backward and forward, explore child steps, and verify the evidence before making a decision.

> **“Moving the code context out of the model’s output and into the IDE, where it already exists.”**

## Intended experience

1. Install the Walk Me Through extension from the VS Code Marketplace, or install a `.vsix` release from GitHub.
2. When opening a Git workspace without the skill, accept an offer to install it into `.agents/skills/walk-me-through/`. The offer appears once per workspace, with workspace-specific and global dismissal options.
3. Commit the versioned skill and bundled publishing script so teammates' compatible agents can discover them too.
4. Ask your coding agent to explain a mechanism or investigate a bug.
5. The agent writes a JSON file with concise Markdown explanations, nested steps, line ranges, and optional exact-text snippets. The bundled script resolves precise selections, captures code anchors, saves a local artifact, and generates a replayable link.
6. Click the link in the terminal or agent chat. A static landing page offers **Open in VS Code**, plugin installation instructions, and retry controls.
7. Open the walkthrough in the correct checkout and step through the explanation beside the actual code.

Teammates can generate walkthroughs using the repository skill before installing the viewer. The link helps them install the extension and try opening the walkthrough again.

## Design principles

- **Lightweight installation:** an IDE extension and a project-local skill/script bundle; no companion application, daemon, or required MCP server.
- **Evidence-backed explanations:** curated findings, assumptions, and code references—not a transcript of a model's private internal reasoning.
- **Small output:** reference local source rather than repeating it; keep the terminal summary short. Generated files and tool arguments still consume model output tokens.
- **Local playback:** navigating a walkthrough does not call a model.
- **Precise references:** expression, single-line, and multiline ranges, with captured hashes to relocate unchanged code after surrounding edits.
- **Visible uncertainty:** when original context cannot be recovered confidently, show a warning beside the nearest identical-code match; mark missing matches stale.
- **Progressive detail:** child steps, with at most four levels including the top level.
- **Team-shared setup:** the skill always lives in the current project and is versioned through Git.
- **Correct workspace:** identify the exact checkout, including worktrees and execution environment, rather than just the repository name or remote URL.

## MVP

The first implementation targets **desktop VS Code on native Windows, with our own simple player**. It starts with VS Code comments for Markdown-rich explanations, a nested step outline, and editor decorations for precise highlights. CodeTour is no longer selected because of its limited maintenance. The extension also handles project setup, importing, links, workspace routing, and anchor validation.

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

**Status:** design and implementation handoff only. No extension, skill, publishing script, or hosted launcher has been implemented yet.

## What comes next

1. **Rider / JetBrains playback**, sharing the artifact format and repository skill.
2. **Portable export and sharing** across different local checkout paths.
3. **Optional MCP delivery** for automatic publication/opening, using the same artifacts and player.
4. Broader agent, remote-environment, and Copilot workflow compatibility.
5. Richer investigation navigation and, if justified, change-review walkthroughs and focused diffs.

See [IMPLEMENTATION.md](IMPLEMENTATION.md) for the agreed decisions, proposed architecture, MVP acceptance criteria, unresolved questions, research sources, and instructions for the implementation session.

## Related work

[Agent CodeWalk](https://github.com/andylin-hao/agent-codewalk) already provides agent-authored explanations, nested steps, dependency views, change coverage, and hash-based relocation. Its architecture uses a bundled Rust MCP companion and a VS Code frontend. Our emphasis is project-shared setup, link-first delivery, precise expression ranges, and eventual JetBrains playback without a companion application.

[CodeTour](https://github.com/microsoft/codetour) was considered as a playback foundation, but its limited maintenance led us to choose our own player. Both related projects are MIT-licensed; any source reuse should preserve applicable notices.

## License

[MIT](LICENSE).
