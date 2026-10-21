# How it works

```text
Project-local skill ──> coding agent writes a JSON draft
                              │
                              └─ runs the bundled script ──> validates, captures code anchors,
                                                             saves an artifact, returns a link
                                                                        │
                        static HTTPS launcher page  <───────────────────┘
                        (Open in VS Code / Open in Rider)
                                        │
                                        v
                        IDE extension/plugin plays the walkthrough locally
```

1. **Skill.** The project contains `.agents/skills/walk-me-through/`: `SKILL.md`, `manifest.json`, a format reference, and a dependency-free publishing script. It is versioned with the project, so every teammate's agent can use it. The consuming project needs no package installation.
2. **Draft.** When asked to explain a mechanism or investigate a bug, the agent writes a JSON file containing a title, a summary, and nested steps with Markdown explanations. Code steps give a project-relative path, a line range, and optionally an exact-text `match` snippet for a single expression.
3. **Publish.** The agent runs `node .agents/skills/walk-me-through/scripts/publish-walkthrough.mjs <input.json>`. The script validates the input, resolves precise selections, captures code anchors, and writes an immutable artifact under `.walk-me-through/walkthroughs/` (ignored through `.walk-me-through/.gitignore`). It returns one JSON object with the title, ID, path, and a replayable `url`.
4. **Reply.** The agent's answer starts with **Walkthrough available**: the title, the link, the ID/path, and a picker fallback. The normal answer follows, with its findings, evidence, rationale, and uncertainty.
5. **Play.** Click the link and choose your IDE. The IDE reads the artifact locally. Playback never calls a model.

## Reading a walkthrough

- The **Steps** tree shows the hierarchy (up to four levels). The **Step** view shows the overview, narrative steps, and the current step. Code steps show a read-only Markdown comment beside a precise expression or multiline highlight.
- **Next** and **Previous** always follow full depth-first order, even when tree nodes are collapsed. You can also select any step directly.
- Top-level steps tell the concise, complete story. Children add supporting evidence and detail. **Skip Details** jumps past the current step's children to the next branch, so you can read only the concise path. Skipped details stay reachable through the tree or **Next** from their parent.
- **Return to Current Step** brings you back after you browse other code.
- Without a link, run **Walk Me Through: Open Walkthrough** and pick the walkthrough by title/ID. It never plays the latest artifact automatically.

## When the code has changed

Anchors are captured at publish time and resolved against the current (possibly unsaved) buffer whenever a step becomes current.

- **Exact or confidently relocated:** normal highlight. Edits above or below an unchanged block are handled.
- **Uncertain:** the original location can't be confirmed, so the closest identical code is shown with a warning and a dashed border.
- **Stale:** no identical code remains. The step shows its original path/line and explanation, but doesn't navigate to the old line or guess a fuzzy match.

## Links

A link looks like `https://pvrobays.github.io/walk-me-through/#eyJ2Ijox…`. The part after `#` is a base64url envelope (at most 1,536 characters) with the checkout root, execution environment, artifact ID, and a display-only title. It contains no source text. Browsers never send the fragment to a server, and the page sends nothing anywhere.

The page shows the title, ID, and project and offers **Open in VS Code** and **Open in Rider**. Nothing opens until you click. After a click it shows install help and a **Retry** link, because a web page can't detect whether an IDE or plugin is installed. It remembers only your last IDE choice. **Copy ID** supports the picker fallback. Older links keep opening their own artifact.

Current limits:

- The walkthrough plays only if the receiving window/project already has the recorded checkout open: that exact folder, an opened parent folder, or a multi-root workspace folder. Another clone or worktree doesn't match. Otherwise the IDE asks you to open that checkout and retry. It never replaces your workspace. Opening the right window or starting a closed IDE is planned.
- VS Code delivers the link to the **last focused window**. If that window shows the "open the checkout" notice, focus the right window and click **Retry**.
- On Windows, `vscode://` belongs to whichever VS Code installation started last. Running `npm run test:extension` takes over the handler, so start your normal VS Code again afterwards. VS Code installed from a Linux `.tar.gz` registers no handler.
- The full link, including your local project root, appears in browser history, any IDE confirmation prompt, and Rider's `idea.log`. Links only work on the machine and checkout that published them.
- Rider specifics (Toolbox/jetbrainsd, cold start, logging) are in [the Rider README](packages/rider/README.md#launch-links).

## When publishing fails

The script's JSON result names the problem. `fix-input` errors give the field, source, range, and a repair hint, so the agent inspects the source, corrects the draft, and retries. `fix-environment` and `report` are blockers that the agent reports instead of working around. In every case, the agent still gives its normal answer. See the [format and recovery reference](packages/skill/references/walkthrough-format.md).
