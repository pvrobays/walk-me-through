# Walk Me Through

## The problem

Coding agents often provide useful insights by referring to small, scattered parts of a codebase. During exploration and bug investigations, understanding a finding can require following a whole sequence of references across different files.

Concise terminal answers keep model output costs down, but leave the reader opening files, finding the right expressions, and reconstructing the connections. Including large code excerpts makes explanations easier to follow, but costs more tokens and duplicates source code that is already available locally.

Walk Me Through turns these explanations into navigable, code-anchored walkthroughs inside your IDE. Each step highlights the relevant source range and explains what it demonstrates, why it matters, and how it connects to the finding. You can move backward and forward, explore child steps, and verify the evidence before making a decision.

> **“Moving the code context out of the model’s output and into the IDE, where it already exists.”**

## Intended experience

1. Install the Walk Me Through IDE extension.
2. When opening a project without the skill, accept an offer to install it into `.agents/skills/walk-me-through/`.
3. Commit the versioned skill and bundled publishing script so teammates' compatible agents can discover them too.
4. Ask your coding agent to explain a mechanism or investigate a bug.
5. The agent writes concise steps; the bundled script validates them, captures code anchors, and generates a replayable link.
6. Click the link in the terminal or agent chat. A static landing page offers **Open in VS Code**, supported IDE choices, and plugin installation instructions.
7. Open the walkthrough in the correct checkout and step through the explanation beside the actual code.

Teammates can generate walkthroughs using the repository skill before installing the viewer. The link helps them install the extension and try opening the walkthrough again.

## Design principles

- **Lightweight installation:** an IDE extension and a project-local skill/script bundle; no companion application, daemon, or required MCP server.
- **Evidence-backed explanations:** curated findings, assumptions, and code references—not a transcript of a model's private internal reasoning.
- **Small output:** reference local source rather than repeating it; keep the terminal summary short. Generated files and tool arguments still consume model output tokens.
- **Local playback:** navigating a walkthrough does not call a model.
- **Precise references:** expression, single-line, and multiline ranges, with captured hashes to relocate unchanged code after surrounding edits.
- **Progressive detail:** child steps, with at most four levels including the top level.
- **Team-shared setup:** the skill always lives in the current project and is versioned through Git.
- **Correct workspace:** identify the exact checkout, including worktrees and execution environment, rather than just the repository name or remote URL.

## MVP

The first implementation targets **VS Code, reusing [CodeTour](https://github.com/microsoft/codetour) playback where practical**. A small Walk Me Through extension adds project setup, importing, link handling, workspace routing, and anchor validation. CodeTour's linear format requires an early spike for the nested-step experience.

The MVP includes:

- Project-local, versioned skill and publishing script installation and update offers.
- Explanation-only walkthroughs for exploration and bug investigations.
- Stable walkthrough/step identities, descriptions, and up to four levels of steps.
- Precise highlights, Previous/Next navigation, and stale-reference detection with unique hash-based relocation.
- Durable, replayable links to a specific walkthrough and optionally a step.
- A static HTTPS launcher suitable for GitHub Pages, with launch data in the URL fragment.
- Opening the correct workspace, including when VS Code is closed or another repository is active.

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

[CodeTour](https://github.com/microsoft/codetour) supplies an existing VS Code guided-tour UI and extension API. Both projects are MIT-licensed. Reuse should preserve applicable notices.

## License

[MIT](LICENSE).
