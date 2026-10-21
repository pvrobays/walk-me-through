# Walk Me Through

## The problem

Coding agents often provide useful insights by referring to small, scattered parts of a codebase. During exploration and bug investigations, understanding a finding can require following a whole sequence of references across different files.

Concise terminal answers keep model output costs down, but leave the reader opening files, finding the right expressions, and reconstructing the connections. Including large code excerpts makes explanations easier to follow, but costs more tokens and duplicates source code that is already available locally.

Walk Me Through turns these explanations into navigable, code-anchored walkthroughs inside your IDE. Code steps highlight the relevant source range and explain what it demonstrates, why it matters, and how it connects to the finding. Narrative and grouping steps provide context. You can move backward and forward, explore child steps, and verify the evidence before making a decision.

> **“Moving the code context out of the model’s output and into the IDE, where it already exists.”**

## Try the vertical slice

**Status:** the authoring/publishing/current-window playback slice is implemented and accepted on Windows. Requirements: Node 20+ and local desktop VS Code, outside WSL, SSH, containers, and remote extension hosts. Windows automated verification (VS Code 1.90.2), manual desktop acceptance (VS Code 1.138.0), and restarted-OpenCode authoring/recovery/playback checks passed. The owner also reports a successful manual VS Code integration test on a native Linux host; automated Linux results are not recorded here.

From the repository root:

```sh
npm install
npm run build
node packages/skill/scripts/publish-walkthrough.mjs examples/sample-project/walkthrough-input.json --root examples/sample-project
```

Open this repository in desktop VS Code. After building, press **F5** and select **Walk Me Through sample** to open `examples/sample-project` in an Extension Development Host. Run **Walk Me Through: Open Walkthrough** in the new window, then choose **Why retries never back off** using the ID printed by the publisher. F5 does not build the extension automatically; if you change its source, run `npm run build` again and restart the F5 session. Opening waits for your choice; it never automatically plays the latest artifact.

The Steps tree preserves the hierarchy. The Step view shows the overview, narrative explanations, and stale steps. Code steps show read-only Markdown comments and precise expression/multiline highlights. Use **Next**, **Previous**, or direct selection. **Return to Current Step** re-resolves against unsaved buffers. Anchors refresh when a step becomes current, rather than continuously during edits.

Use **Skip Details** in the Step view, a code comment's header, or the Command Palette to bypass the current step's children and continue to the next available branch. From a final nested branch it exits to the next branch of an ancestor; from the overview it enters the first top-level step. It is unavailable at the final branch even when **Next** can still enter children. **Next** and **Previous** always follow full depth-first order, regardless of tree collapse or prior skips: Previous immediately after skipping returns to the preceding depth-first step, not the skip origin. Skipped details remain accessible by tree selection or by returning to their parent and choosing Next.

Exact and confidently relocated code uses the normal highlight. Uncertain nearest-identical matches show a warning and dashed border. Stale steps show their original path/line and explanation without navigating to the old line.

Uncertainty notices explicitly say the original location is unconfirmed and the closest identical code is shown, including the earlier-candidate choice for ties. The Step view uses compact, moderately smaller warning text with theme-aware color and a warning indicator. Source comments use ordinary paragraph formatting with a warning icon; VS Code controls their font size. The red stale presentation and informational relocation notice remain distinct.

### Rider development player

A local Kotlin plugin now plays the same saved v1 artifacts in **native Windows Rider 2026.2.3.1 (RD-262.10968.170)**. It provides a docked Markdown explanation/outline, precise current-buffer highlights, Next/Previous/Skip Details/Return and explicit artifact selection. The prototype and integrated player are owner-accepted in Rider and VS Code; explicit offline verification is pending. Build/test/package and exact-target Plugin Verifier checks pass. See [Rider build/run/install and usage](packages/rider/README.md) for its isolated sandbox and development ZIP. No public plugin publication or wider Rider compatibility is claimed.

The shared publisher and skill return a replayable launch link along with the title and ID. The link opens a static launcher page where you choose **Open in VS Code** or **Open in Rider** (see [Open walkthrough links](#open-walkthrough-links)). You can also run **Walk Me Through: Open Walkthrough** in either IDE and pick the returned title/ID. Publishing needs Node 20+; Rider playback itself does not need Node.

### Use the skill in a project

```sh
npm run skill:install -- <projectDir>
```

The project directory must exist. The command copies the four-file bundle into `.agents/skills/walk-me-through/`. It refuses differing files unless `--force` is supplied. Commit the bundle yourself, then **quit and restart OpenCode** in that project to discover it.

Ask the agent to explain a mechanism spanning several locations. It writes a draft and runs the bundled script; the consuming project needs no package installation. The reply begins with the walkthrough title, the launch link, ID, path, and picker fallback, followed by the normal answer retaining the requested findings, evidence, rationale, and uncertainty.

Walkthrough authors make the top-level steps a concise complete account, including consequences, essential caveats, and whether a proposed repair is untested. Optional children add supporting evidence and deeper implementation detail rather than repeating the parent. Read the concise path with **Skip Details**, or the full path with **Next**. Simple explanations can stay flat; nesting is limited to four levels and nested leaves still need precise source locations. The sample demonstrates both paths, including expression and multiline selections.

Publishing returns one JSON object. `fix-input` errors identify the field/source/range and repair hint: inspect source and correct the input before retrying. `fix-environment` and `report` indicate blockers to report. If publishing fails, the agent still gives its normal answer and states the blocker. See the [format and recovery reference](packages/skill/references/walkthrough-format.md).

Artifacts live under `.walk-me-through/walkthroughs/`, ignored through `.walk-me-through/.gitignore`. Each publish preserves older artifacts, and each link keeps opening its own artifact.

### Open walkthrough links

A successful publish returns `url`, for example `https://pvrobays.github.io/walk-me-through/#eyJ2Ijox…`. The part after `#` is a base64url envelope of at most 1,536 characters. It contains the recorded checkout root, the execution environment, the artifact ID, and a display-only title. It contains no source text. Browsers never send the fragment to the server, and the page sends nothing anywhere.

The launcher page shows the title, ID, and project root. It offers **Open in VS Code** (`vscode://pvrobays.walk-me-through/open?e=…`) and **Open in Rider** (`jetbrains://rider/walkmethrough/open?e=…`). Nothing opens until you click one. After a click, the page shows that IDE's install help and a **Retry** link. The page cannot detect whether an IDE or plugin is installed. The page remembers only which IDE you chose last, and uses that only to highlight the button. **Copy ID** supports the picker fallback.

Each IDE plays the walkthrough only when the window or project that receives the link already contains the recorded checkout: the exact folder, a subfolder of an opened folder, or a multi-root workspace folder. Another clone or worktree of the same repository does not match. Otherwise the IDE shows a notice that names the root and asks you to open that checkout and retry. It never opens, replaces, or reloads workspaces. Opening and focusing the correct window, and starting a closed IDE into the project, are the next routing milestone.

VS Code link behavior and current limits:

- The link always goes to the **VS Code window you focused last**, even if another window has the checkout open. If that window shows the "open the checkout and retry" notice, focus the window that has the checkout, then click **Retry**.
- The first time, VS Code asks whether the Walk Me Through extension may open the link. Confirm it; the dialog shows the full link, including the local root.
- The extension activates on demand when a link arrives. A link that targets a step opens there; an unknown step opens the overview with a notice. Re-opening the active walkthrough reloads it in place.
- Windows registers `vscode://` to whichever VS Code installation started last. Running `npm run test:extension` registers the downloaded test build (`.vscode-test`). Start your normal VS Code once afterwards to take the handler back.
- VS Code on Linux installed from a `.tar.gz` archive registers no `vscode://` handler.

Rider specifics (JetBrains Toolbox/jetbrainsd, cold start, and logging) are in [the Rider README](packages/rider/README.md#launch-links).

The full URI, including the local project root, appears in browser history, in VS Code's confirmation dialog, and in Rider's `idea.log`. Links work only on the machine and checkout that published them.

### Install the VS Code extension (VSIX)

The extension is not on the Marketplace yet. Build and install a local package:

```sh
npm install
npm run package:vsix
code --install-extension packages/vscode/walk-me-through-0.1.0.vsix
```

Alternatively, in VS Code open **Extensions → … → Install from VSIX…** and select that file. Reload VS Code if it asks. Use the desktop VS Code installation that you start normally, so it owns the `vscode://` handler (see the notes above). Then return to the launcher page and click **Retry**, or click the original link again.

### Install the Rider plugin (ZIP)

The Rider plugin is a local development build for native Windows Rider 2026.2.3.1 only.

1. Build `packages/rider/build/distributions/walk-me-through-rider-0.1.0-prototype.zip` as described in [Rider development](packages/rider/README.md#windows-build-sandbox-and-install).
2. In Rider, open **Settings → Plugins → gear → Install Plugin from Disk…**, select the ZIP, and restart Rider.
3. `jetbrains://` links are delivered by **JetBrains Toolbox** (its `jetbrainsd` URL handler). Install Toolbox if it is not already installed. The plugin registers no URL scheme of its own.
4. Open the recorded project in Rider, then retry from the launcher page, or click the original link again.

### Development

```sh
npm run build
npm run typecheck
npm test
npm run test:extension
```

`npm test` runs core/script/Markdown/launcher tests, the committed-bundle and launcher-asset checks, fixture drift checks, and workflow structure checks. Extension tests download VS Code 1.90.2 on first use. On native Linux, use `xvfb-run -a npm run test:extension`. CI repeats checks on Windows/Linux with Node 20; native Linux needs no override. `npm run package:vsix` builds a local package; public distribution is a follow-up.

### Preview the launcher locally

The launcher source is `packages/launcher/src/`. `npm run build` regenerates the committed `launcher/launcher.js`, and `npm test` fails if that file is stale. `launcher/index.html` and `launcher/styles.css` are hand-written. To try links against the local page:

```sh
npm run build
npm run launcher:serve
node packages/skill/scripts/publish-walkthrough.mjs examples/sample-project/walkthrough-input.json --root examples/sample-project --launcher-url http://localhost:8123/
```

`launcher:serve` (`scripts/serve-launcher.mjs`, no dependencies) serves only the three launcher files on `127.0.0.1:8123`. Pass `--port <n>` to use another port. `--launcher-url` is a development-only publisher option. It accepts `https://` URLs, or `http://localhost` / `http://127.0.0.1` URLs, and the skill never uses it. Open the returned `url` in the browser.

### Pages preparation

The Pages workflow skips deployment until `launcher/index.html` exists and uploads only `launcher/`. The owner's reported current setting is **main/root branch publishing**. Before future launcher deployment, set **Settings → Pages → Source → GitHub Actions**. Repository settings have not been changed. The planned address is `https://pvrobays.github.io/walk-me-through/`; no launch URL exists yet.

## Intended complete experience

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
- **Useful output:** lead with walkthrough availability and opening details, then preserve the normal answer at the requested depth while referencing local source rather than repeating large excerpts. Generated files and tool arguments still consume model output tokens.
- **Local playback:** navigating a walkthrough does not call a model.
- **Precise references:** expression, single-line, and multiline ranges, with captured hashes to relocate unchanged code after surrounding edits.
- **Visible uncertainty:** when original context cannot be recovered confidently, show a warning beside the nearest identical-code match; mark missing matches stale.
- **Progressive detail:** a self-contained concise top-level path, with optional additive child evidence and at most four levels including the top level.
- **Team-shared setup:** the skill always lives in the current project and is versioned through Git.
- **Correct workspace:** identify the exact checkout, including worktrees and execution environment, rather than just the repository name or remote URL.

## MVP

The first implementation targets **desktop VS Code on native Windows and native Linux, with our own simple player**. It uses VS Code comments, a nested outline, a Step view, and precise highlight decorations. CodeTour is not a dependency. Onboarding, links, workspace routing, updates, and public distribution are later milestones.

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

**Current scope:** shared core, project skill and generated script, immutable artifacts, current-window player, sample, native-platform CI, and gated Pages workflow. The launcher, URI/window routing, installation/update prompts, Marketplace/GitHub releases, and Rider remain follow-ups.

## What comes next

1. **Rider playback parity**, starting with a Rider-native explanation/highlight prototype and sharing the existing artifact format and repository skill.
2. **Shared HTTPS launcher**, with explicit VS Code and Rider choices, installation help, and retry.
3. **Correct-window routing for each IDE**, targeting the exact checkout without replacing unrelated workspaces.
4. **Project onboarding, customization-aware bundle updates, and distribution** through the Marketplace and GitHub Releases for VS Code, with Rider distribution to be defined.

Later: portable export/sharing, optional MCP delivery, broader agent/remote compatibility, and richer investigation or change-review navigation. See [the agreed delivery sequence](IMPLEMENTATION.md#updated-delivery-sequence--owner-agreed-2026-10-21).

See [IMPLEMENTATION.md](IMPLEMENTATION.md) for the agreed decisions, proposed architecture, MVP acceptance criteria, unresolved questions, research sources, and instructions for the implementation session.

## Related work

[Agent CodeWalk](https://github.com/andylin-hao/agent-codewalk) already provides agent-authored explanations, nested steps, dependency views, change coverage, and hash-based relocation. Its architecture uses a bundled Rust MCP companion and a VS Code frontend. Our emphasis is project-shared setup, link-first delivery, precise expression ranges, and eventual JetBrains playback without a companion application.

[CodeTour](https://github.com/microsoft/codetour) was considered as a playback foundation, but its limited maintenance led us to choose our own player. Both related projects are MIT-licensed; any source reuse should preserve applicable notices.

## License

[MIT](LICENSE).
