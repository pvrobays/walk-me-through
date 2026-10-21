# Design

## Context

Motivation and scope are in `proposal.md`. Behavior is defined in the three capability specs. Current state relevant to the approach:

- Core publishes immutable artifacts with `project.root` (absolute realpath) and `project.environment` (`kind`, `platform`, `unsupportedOverride`). `PublishSuccess` has `id`, `artifactPath`, `stepCount`, `warnings`, and `open` (picker wording for both IDEs). `packages/skill/test/cli.test.ts` asserts that no `url` exists, and `reference.test.ts` pins the `open` wording.
- VS Code (`pvrobays.walk-me-through`) has no URI handler. `openWalkthrough` accepts a path or Uri and otherwise shows the picker. `store.loadArtifact` and `session.open`/`goToStep` already exist.
- Rider (`io.github.pvrobays.walkmethrough`, exact target 262.10968.170) opens artifacts only through `OpenWalkthroughAction`/`ArtifactStore`. It does no project-root matching, has no protocol handling, and refuses non-Windows hosts. `add-rider-playback` task 4.4 (offline playback acceptance) is still open.
- The Pages workflow is gated on `launcher/index.html` and uploads only `launcher/`. `scripts/check-workflows.mjs` currently asserts that the launcher does **not** exist. The owner's Pages source is still main/root branch publishing.
- On the development machine, `jetbrains://` is registered to `%LOCALAPPDATA%\JetBrains\Daemon\...\jetbrainsd.exe handleUri "%1"` (Toolbox present). `vscode://` is currently registered to the `.vscode-test` 1.90.2 archive, because Electron re-registers whichever VS Code started last.
- Research (October 2026, upstream source): VS Code delivers extension URIs to the last-focused window. It activates the extension through `onUri` and buffers the URI for up to 5 minutes. It shows its own one-time "Allow extension to open this URI?" confirmation. JetBrains routes `jetbrains://<product>/<command>/<target>?query` to the `com.intellij.jbProtocolCommand` EP (a public abstract `JBProtocolCommand`) at application level, and logs the full URI to `idea.log`. Netty query decoding turns `+` into a space. Older Chromium on Windows silently dropped external-protocol URLs longer than 2,048 characters. Browsers cannot detect whether a handler is missing.

## Goals / Non-Goals

**Goals:**

- One envelope implementation in TypeScript, shared by the publisher and the page, plus a Kotlin port verified against generated fixtures.
- Thin IDE adapters that reuse existing load/validate/open/select paths instead of adding a second open pipeline.
- A launcher that ships as committed static files and can be tested without a browser for its logic.
- Early proof that jetbrainsd/Toolbox delivers a plugin-defined command to installed Rider. This is a gate before investing in the rest of the Rider work.

**Non-Goals:**

- Choosing or focusing a window or project other than the one that receives the URI, beyond Rider's application-level choice among already-open projects.
- Pending-request persistence, opening folders, cold-start project opening, and duplicate-window focus tracking in VS Code. These belong to the routing change.
- DOM-testing dependencies for the page, browser automation, or Insiders/Open VSX URIs.
- Bumping the bundle or artifact schema versions. The input and artifact schemas are unchanged. The skill bundle stays at 0.1.0 because the update contract has not shipped yet.

## Decisions

### D1. Envelope module in core, dependency-free base64url

Add `packages/core/src/launch.ts` with `buildEnvelope(artifact)`, `encodeEnvelope`, `decodeEnvelope(text) → {ok, envelope} | {ok:false, category, problems}`, and the URL builders `launcherUrl(base, encoded)`, `vscodeUri(encoded)`, and `riderUri(encoded)`. Base64url and UTF-8 handling use a small pure-TypeScript codec rather than `Buffer` or `atob`, so the same code runs in Node (publisher) and the browser (page). Decoding uses strict UTF-8 (rejecting malformed sequences) and strict alphabet checks. Error categories: `malformed`, `too-long`, `unsupported-version`, `invalid`, the last with field-level problems.

Members are short (`v`, `root`, `env`, `id`, `step`, `title`) to preserve length budget. `env` copies only `kind` and `platform`. Receivers already reject artifacts published with an unsupported-environment override through their own environment checks.

*Alternatives:* `Uint8Array.toBase64`, which is Baseline only since 2025 and not available in Node 20; `Buffer`, which is Node only; percent-encoded JSON in the query, which is longer and breaks on `+`/`%` through Netty.

### D2. Size budget: 1,536 encoded characters

The launcher prefix (`https://pvrobays.github.io/walk-me-through/#`, about 44 characters) and the IDE prefixes (`vscode://pvrobays.walk-me-through/open?e=`, about 41 characters, and `jetbrains://rider/walkmethrough/open?e=`, about 40 characters) all stay under 1,600 characters. That leaves margin under the historical 2,046-character Chromium Windows cap. The builder shortens the title to 120 characters with an ellipsis, then drops it, then gives up with `launch-link-too-long`. The publisher still writes the artifact in that case. Typical envelopes (root of 60 to 100 characters, 60-character title) are about 300 characters.

### D3. Publisher and skill output

`PublishSuccess` gains an optional `url`. `open` becomes link-first: "Open <url> and choose VS Code or Rider, or run Walk Me Through: Open Walkthrough and choose …". The publisher gets a development-only `--launcher-url <base>` option, accepting `https://` or `http://localhost`/`127.0.0.1` and normalized to end in `/`. It is used for local page previews, and the skill never mentions it. The warning code is `launch-link-too-long`. The skill and format reference describe the link-first **Walkthrough available** block, that the URL must be copied verbatim, and the no-link fallback. Then `npm run build` regenerates the script and manifest.

### D4. Launcher source and assets

```text
packages/launcher/src/
  config.ts   help targets (README anchors), IDE labels — the single swap point
  model.ts    fragment → view model {state, title, id, root, step, hrefs, problems}; pure, unit-tested
  main.ts     DOM rendering with textContent only, hashchange, clipboard, localStorage preference
launcher/
  index.html  hand-written; CSP meta + referrer meta; links styles.css and launcher.js
  styles.css  hand-written; prefers-color-scheme, focus styles, narrow layout
  launcher.js generated by scripts/build.mjs (esbuild IIFE, ES2020), committed
```

IDE choices are real `<a href>` elements whose `href` is set only after validation. This keeps launches inside a direct user gesture and needs no script-driven navigation. Retry re-activates the same anchor. Clicking a choice reveals that IDE's help panel (install, Toolbox/jetbrainsd prerequisite for Rider, VS Code's own confirmation prompt, retry). localStorage stores only `"vscode"` or `"rider"`.

CSP: `default-src 'none'; script-src 'self'; style-src 'self'; base-uri 'none'; form-action 'none'`. GitHub Pages cannot set headers, so `frame-ancestors` is not available, and the page has no actions worth clickjacking beyond opening an IDE. `scripts/check-bundle.mjs` gains a fresh-build comparison for `launcher/launcher.js`. A small static check asserts that `index.html` references only same-origin relative assets and contains the CSP and referrer metas.

*Alternative:* source directly in `launcher/`. Rejected because Pages uploads that directory as-is and TypeScript sources would be published.

### D5. VS Code handler

Add `"onUri"` to `activationEvents`, and register `window.registerUriHandler` in `activate`. A new module (`launch.ts`) does the following:

1. Check that the path is `/open`.
2. Read `e` with `URLSearchParams(uri.query)`.
3. Run `decodeEnvelope`.
4. Check the environment: the existing `checkEnvironment` and `remoteName`, `env.kind === 'local'`, and `env.platform === process.platform`.
5. Find a match: `fs.realpathSync.native` on the root and on each `workspaceFolders` entry. Normalize separators and compare case-insensitively on win32. Accept equality or a separator-bounded prefix.
6. Load `<root>/.walk-me-through/walkthroughs/<id>.json` through the existing `loadArtifact`, then assert the ID.
7. Call the existing `openRequest`-guarded open path, then `goToStep(step)`, or show the overview plus a not-found notice.

Notices use `showWarningMessage`/`showErrorMessage`. `openWalkthrough` is refactored so the picker and the launch share one `openArtifact(uri, {stepId})` function.

### D6. Rider protocol command

Register `<jbProtocolCommand implementation="…LaunchProtocolCommand"/>` with command name `walkmethrough`. The URI is `jetbrains://rider/walkmethrough/open?e=<envelope>`: `rider` is the Toolbox/jetbrainsd product tag, `walkmethrough` is the command, and `open` is the target. `execute(target, parameters, fragment)` does the following:

1. Validate `target == "open"` and `parameters["e"]`.
2. Decode with a Kotlin `LaunchEnvelope` port, using `Base64.getUrlDecoder()` with explicit rejection of padding and invalid characters, and a strict `CharsetDecoder`.
3. Apply `PlaybackEnvironment.currentRefusal()` plus the kind and platform checks.
4. Pick the project. Candidates are open projects whose `basePath` or content roots contain the root, using `toRealPath` and case-insensitive comparison on Windows. Prefer the last-focused frame's project (`IdeFocusManager`/`WindowManager`) if it is a candidate, otherwise the latest-opened candidate.
5. Load with `ArtifactStore.load(path)` on a background thread, then call `WalkthroughSession.open` and `select(step)` on the EDT, and show the tool window.

The command returns `null` and reports problems through its own notifications: project-scoped when a project is chosen, application-level otherwise. If no frame is visible, it falls back to a modal message. The command must pass Plugin Verifier on the exact target without internal-API findings.

*Alternatives:* a plugin-owned OS scheme, which needs registry and `.desktop` writes and was declined by the owner; and the built-in `:63342` server, which cannot start Rider, has an unknown port, and triggers Local Network Access and trust prompts.

### D7. Shared opening paths and replacement

Both IDEs refactor their picker paths into a single open-artifact entry point, so launch and picker behave identically: replacement, generation guards, moved-root warnings, and cleanup. Re-launching the active artifact goes through the same replace path, so no special duplicate handling is needed.

### D8. Conformance fixtures

`scripts/conformance.ts` additionally writes `tests/conformance/launch-v1.json`. It covers encoded inputs with expected results (decoded envelope, or category plus problem fields), builder cases (title shortening, title dropping, too-long), and non-ASCII and edge alphabet cases. `fixtures:check` covers drift. Rider tests read it from the classpath, as they already do for `v1.json`.

### D9. Delivery verification order

1. **Rider delivery spike first:** a minimal command in the plugin ZIP installed into the owner's real Rider 2026.2.3.1, invoked from a browser and from `Start-Process 'jetbrains://rider/walkmethrough/open?e=test'`, with Rider running and with Rider closed. Record whether jetbrainsd delivers it, whether the query survives, and what happens when Rider is closed. If it fails, pause and revisit the mechanism with the owner before continuing the Rider tasks.
2. Core envelope and fixtures, then publisher and skill, then the page with local preview, then the VS Code and Rider handlers. Local preview uses a small dependency-free Node static server, `scripts/serve-launcher.mjs`, on `http://localhost`.
3. Owner switches Pages to GitHub Actions, then the change is pushed or merged to `main`, then the live site is verified, then end-to-end acceptance from OpenCode in Windows Terminal.

## Risks / Trade-offs

- **jetbrainsd/Toolbox may not route a plugin command, may strip the query, or may pick another installed Rider** → The D9 spike gates the Rider work. The page's Rider help names the Toolbox/jetbrainsd prerequisite, and the picker fallback always remains.
- **Rider cold start may handle the command before any project opens, or Toolbox may show an IDE picker** → The spec accepts an open-and-retry notice. Observed behavior is recorded for the routing change.
- **`vscode://` points to whichever VS Code last registered it (for example the test archive)** → Acceptance starts the installed VS Code first. The README notes that running extension tests can steal the handler.
- **VS Code delivers to the last-focused window, which may be unrelated** → A notice without workspace changes, by spec. Correct routing is the next change.
- **Long URLs wrap in terminals and may not be clickable** → The 1,536-character limit keeps typical links around 350 characters. Acceptance clicks a real link in OpenCode/Windows Terminal and records the result.
- **The full URI, including the local root, appears in `idea.log`, browser history, and the VS Code confirmation dialog** → Documented. The envelope contains no source text, and the page sends nothing to the server (fragment, no-referrer).
- **Any website can trigger these URIs** → Read-only handling, validated IDs, artifact lookup only under an already-open checkout, and existing safe-source rules. The worst case is replacing the active walkthrough with another genuine local one, after the browser's and VS Code's own confirmation prompts.
- **Hand-rolled base64url and UTF-8 codec bugs** → Shared fixtures across TypeScript and Kotlin, including multi-byte, supplementary-plane, and invalid-sequence cases.
- **Linux Rider remains refused, and Linux VS Code `.tar.gz` installs have no URL handler** → Documented in launcher help and the README. Windows is the acceptance platform.

## Migration Plan

- There are no data migrations. Older artifacts work with launch links built for them, because the envelope is derived from existing artifact fields. Older publisher bundles keep producing picker-only output.
- Deployment: the owner switches **Settings → Pages → Source → GitHub Actions** in the designated task. Rollback reverts or removes `launcher/` (the gate then skips deployment) or switches the source back. IDE handlers fail closed with notices.

## Open Questions

- Rider's exact behavior when it is closed or when several Rider installations exist under Toolbox. This is recorded during the spike and acceptance, and feeds the routing change.
- Whether Rider command names allow hyphens. `walkmethrough` avoids the question.
