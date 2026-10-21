# Implementation verification

## Task 1.1 — Rider delivery spike

### Automated part (2026-10-21)

- Added `LaunchProtocolCommand` (`JBProtocolCommand("walkmethrough")`, public abstract platform class from `intellij.platform.ide.impl.jar`) and registered it in `plugin.xml` as `<jbProtocolCommand implementation="io.github.pvrobays.walkmethrough.LaunchProtocolCommand"/>`, with an application notification group `Walk Me Through`. The spike command opens nothing. It logs `Walk Me Through launch command received: target=…; e=…; e.length=…; parameters=[…]; fragment=…; openProjects=[…]` at INFO and shows the same text in a balloon notification.
- Rider's own `RiderPlugin.xml` declares the `jbProtocolCommand` EP as `dynamic="true"` and registers platform commands (`navigate`, `settings`, `plugin`, `checkout`) the same way.
- `gradlew.bat buildPlugin verifyPlugin --console=plain` (RIDER_HOME = installed Rider 2026.2.3.1, JAVA_HOME = its JBR): BUILD SUCCESSFUL in 38s. Verifier 1.411 against RD-262.10968.170: **Compatible**, 5 deprecated and 6 experimental API usages, all pre-existing `ToolWindowFactory`/`ReadAction.compute` advisories. No internal-API or other finding for the new EP or `JBProtocolCommand`.
- ZIP: `packages/rider/build/distributions/walk-me-through-rider-0.1.0-prototype.zip`.

Sample envelope (168 characters, contains both `-` and `_`; decodes to a v1-shaped JSON with root `C:\Users\Jürgen\项目`, id `probe`):

```text
eyJ2IjoxLCJyb290IjoiQzpcXFVzZXJzXFxKw7xyZ2VuXFzpobnnm64iLCJlbnYiOnsia2luZCI6ImxvY2FsIiwicGxhdGZvcm0iOiJ3aW4zMiJ9LCJpZCI6InByb2JlIiwidGl0bGUiOiJTcGlrZSB-Pz4-ID8_PyDDvyJ9
```

### Owner-run part (2026-10-21)

The owner installed the ZIP into the normal Rider 2026.2.3.1 profile (`%APPDATA%\JetBrains\Rider2026.2\plugins\walk-me-through-rider`) and ran the spike. Owner report: the balloon appeared, `e.length` was 168, Toolbox/jetbrainsd showed **no prompt and no IDE picker**, and with Rider closed the link started Rider on the welcome (project selection) screen and the notification appeared there.

The owner's `%LOCALAPPDATA%\JetBrains\Rider2026.2\log\idea.log` (read-only inspection) confirms five deliveries. Each command log line has `target=open`, an `e` identical to the sample above, `e.length=168`, `parameters=[e]`, and `fragment=null`:

| Time | Rider state (`openProjects`) | Delivery path in log |
| --- | --- | --- |
| 16:55:41 | running, no project (`[]`) | `ApplicationLoader - External instance command received` |
| 16:56:12 | running, one project | external instance command |
| 16:56:46 | running, two projects | external instance command |
| 16:57:32 | running, two projects | external instance command |
| 16:58:35 | cold start (`[]`, uptime 611 ms) | `AppStarter - args: jetbrains://…`, then the command |

The log does not record whether each invocation came from the browser or from `Start-Process`. The owner reported the spike as done, and these entries don't contradict that.

Findings:

- **Delivery:** jetbrainsd delivers the plugin-defined command to the running instance and to a cold-started Rider. The query, including `-` and `_`, arrives unchanged. jetbrainsd adds no extra parameters.
- **Cold start:** the command executes about 0.6 s after startup, before any project is open, on the welcome screen. An application-level notification is visible there. A real launch at cold start therefore always takes the no-matching-project path (open-and-retry notice), consistent with the spec. Waiting for or opening a project belongs to the routing change.
- **Log exposure:** the platform's `CommandLineProcessor` logs `external URI request:` followed by the full URI at INFO, and on cold start `AppStarter` logs it as `args:`. The envelope, including the local root, therefore lands in `idea.log` regardless of plugin logging. The real command should not log the envelope a second time.
- **Multiple projects:** with two projects open, a single application-level command invocation sees both, so the plugin's own project choice (D6 step 4) is required.

## Task 1.2 — owner decision (2026-10-21)

The owner reviewed the 1.1 results and chose to **keep the mechanism as designed**: `jetbrains://rider/walkmethrough/open?e=<envelope>`, delivered by jetbrainsd. No artifact revision is needed. Cold start keeps the specified open-and-retry notice, and the full command will not log the envelope again, because the platform already logs the URI.


## Task 2.1 — core launch envelope (2026-10-21)

Added `packages/core/src/launch.ts`. It is pure TypeScript with no Node or DOM imports. `artifactIdPattern` and `absolutePathPattern` were moved into `validation.ts` so the artifact validator and the envelope validator share them. `packages/core/test/launch.test.ts` has 13 tests. The codec is cross-checked against Node `Buffer` base64url and UTF-8, and against fatal `TextDecoder`, on 200 deterministic pseudo-random byte arrays. The tests also cover:

- non-ASCII and supplementary-plane round-trips with a URL-safe alphabet;
- rejection of padding, foreign characters, impossible lengths and non-canonical bits;
- invalid UTF-8;
- distinct malformed messages, with no partial envelope for any truncation;
- unknown members (top-level and `env`), traversal IDs and relative roots;
- step and title limits, and the unsupported version;
- the 1,536 boundary (accepted) and the too-long limit (rejected before decoding);
- builder title shortening, title dropping and `launch-link-too-long`;
- URL builders, and `https`/localhost-only launcher bases.

`npx vitest run packages/core/test/launch.test.ts`: 13 passed. `npm run typecheck`: passed.

## Task 2.2 — launch fixtures (2026-10-21)

`scripts/conformance.ts` now also generates `tests/conformance/launch-v1.json`, with 68 decode cases and 7 build cases, and `scripts/conformance.mjs` writes and checks both fixture files. Each decode case declares its intended category, and generation fails if the category changes. `packages/core/test/conformance.test.ts` replays every launch case and pins independent expectations. The regeneration command is documented in `tests/conformance/README.md`.

- `npm run fixtures:generate`, then `npm run fixtures:check`: both files match, and `v1.json` is unchanged.
- Changing a malformed message temporarily made `fixtures:check` fail with `Conformance fixture drift in tests/conformance/launch-v1.json. Review changes, then run npm run fixtures:generate.`
- Changing the step limit to 199 temporarily made it fail with `Fixture generation failed: Launch fixture valid-step-200: expected ok, got invalid`.
- After both changes were reverted, the check passes again. `npx vitest run packages/core`: 53 tests passed.
- A real envelope cannot be 1,537 characters long, because unpadded base64 never has length ≡ 1 (mod 4). The shortest real over-limit envelope, 1,538 characters, is therefore used, alongside a 1,537-character garbage input.

## Tasks 3.1–3.2 — publisher and skill (2026-10-21)

- After a successful write, `publish` builds the envelope from the saved artifact, using its final ID after any collision retry. It adds `url` (the launcher base plus `#` plus the encoded envelope, inserted before `open`) and link-first `open` wording. When the envelope does not fit, it omits `url`, adds a `launch-link-too-long` warning (`length`, `limit: 1536`), and keeps picker-only `open` text. The CLI accepts `--root` and the development-only `--launcher-url` (validated by `parseLauncherBase`) after the input path, in either order. An invalid base fails with `INVALID_LAUNCHER_URL` (exit 2), and repeated or unknown options fail with `USAGE`. Neither failure writes an artifact. The usage text still names only `--root`.
- `SKILL.md` and `references/walkthrough-format.md` describe the link-first **Walkthrough available** block, verbatim URL copying, the no-link fallback, the `url` field, the warning, and `INVALID_LAUNCHER_URL`. The format reference documents `--launcher-url` as repository-development-only that agents never pass. `SKILL.md` does not mention the option. The bundle version stays 0.1.0, per design.
- Tests:
  - publish: the URL decodes to the saved artifact's envelope; result keys and order are as expected; exact `open` wording; localhost base; an oversized root keeps the artifact, drops `url`, and warns.
  - cli: the installed-layout URL decodes to the saved artifact, `open` is link-first, a newer publish gives a different URL, localhost and https bases work, unsafe bases are rejected, and usage errors are reported.
  - reference: the link-first `open`, plus SKILL and reference wording.
- `npm run build`; `npx vitest run packages/core packages/skill`: 17 files and 64 tests passed. `npx vitest run packages/skill`: 9 passed. `npm run check:bundle`: the committed script and manifest match a fresh build.

## Tasks 4.1, 4.2 and 4.4 — static launcher (2026-10-21)

- `packages/launcher/src/`:
  - `config.ts`: the single swap point for README help anchors, IDE labels and the preference key.
  - `model.ts`: a pure fragment → view model mapping, with states `ready`, `missing`, `invalid`, `too-long` and `newer`. The IDE hrefs come from the core builders, and query parameters are never read.
  - `main.ts`: textContent-only rendering through a minimal DOM interface, plus `hashchange`, clipboard with a select-text fallback, and the localStorage preference (`"vscode"` or `"rider"` only).
- The hand-written `launcher/index.html` uses the design's CSP and a no-referrer meta, and declares an empty `data:,` icon so browsers do not request `/favicon.ico`. It references only `styles.css` and `launcher.js`, and has no inline script, styles or event handlers. IDE choices and retries are real `<a>` elements whose `href` is set only for a valid envelope. Retry is a second anchor with the identical href, which keeps it a direct user gesture.
- `launcher/styles.css` (hand-written) supports `prefers-color-scheme`, focus-visible outlines, forced colors, and a narrow single-column layout.
- `scripts/build.mjs` (`buildLauncher`) generates the committed `launcher/launcher.js` (esbuild IIFE, ES2020, unminified, with a banner).
- `packages/launcher/test/model.test.ts` has 11 tests:
  - valid, missing, malformed, truncated, invalid, oversized and newer fragments;
  - hrefs equal to `vscodeUri` and `riderUri`;
  - ID fallback for a missing or blank title;
  - preference parsing;
  - fake-DOM rendering: `<img src=x onerror=alert(1)>` stays literal text with no innerHTML writes, links are removed and problems listed when the fragment becomes invalid, the remembered preference is emphasized while both links remain, and the chosen IDE's help is shown;
  - static checks: the exact CSP and referrer metas, same-origin assets only, no markup sinks, timers, script navigation or network APIs in the bundle, and no URL other than the repository;
  - README anchors: both help targets (`#install-the-vs-code-extension-vsix`, `#install-the-rider-plugin-zip`) and every README link to a local or Rider README heading resolve to GitHub-style heading slugs.
- `scripts/check-bundle.mjs` now also compares `launcher/launcher.js` with a fresh build. `scripts/check-workflows.mjs` now asserts that the launcher assets exist, that `launcher/` contains only those three files, that exactly one Pages upload uses `path: launcher/`, and the deploy permissions. A temporary heading change in `model.ts` made `npm test` fail with `Stale launcher asset: launcher/launcher.js does not match packages/launcher/src. Run npm run build.`. After reverting it, `npm test` passes: 75 Vitest tests, then the bundle, launcher, fixture and workflow checks.
- `packages/launcher` was added as a workspace. `npm install` added only its workspace link to `package-lock.json`. `npm run typecheck` now includes `packages/launcher`.

## Tasks 5.1–5.2 — VS Code launch handling (2026-10-21)

- 5.1: the picker and launch links now share one `openArtifact(uri, {stepId, expectedId, request})` path, with the same request-generation guard, moved-root warning and `session.open` replacement. The environment check moved into a shared `environmentRefusal()` with unchanged messages. `npm run test:extension` with VS Code 1.90.2: the 10 existing tests pass.
- 5.2: `"onUri"` activation and `registerUriHandler` call `handleLaunchUri` (`packages/vscode/src/launch.ts`). The handler:
  1. checks the path (`/open`) and the `e` parameter;
  2. runs the core `decodeEnvelope`;
  3. applies the shared environment refusal, then the `env.kind === 'local'` and `env.platform === process.platform` checks;
  4. matches the root against the workspace folders by canonical real path (`realpathSync.native`), separator-normalized and case-folded on win32, accepting equality or a separator-bounded prefix;
  5. loads only `<real root>/.walk-me-through/walkthroughs/<id>.json`, after checking that it exists, through `openArtifact` with `expectedId`;
  6. opens the requested step, or the overview with a notice for an unknown step, and reveals the Walk Me Through view container.

  Every refusal shows a notice and leaves the workspace and session untouched. In test mode, `TestApi.launch(uri, folders?)` runs the same handler, optionally against substitute folders for the multi-root case.
- `packages/vscode/test/launch.test.ts` has 7 tests on the fixture workspace:
  - the `onUri` manifest entry;
  - a matching root, whose artifact title wins over a forged envelope title, and an older link after a newer publish;
  - a case-folded subfolder root with a nested step: ancestors in the breadcrumb, exact resolution, and the editor opened;
  - re-launching the active artifact at a step and then at the overview, with a single thread and the presentation cleared;
  - an unknown step;
  - multi-root containment;
  - refusals that leave the session and workspace byte-for-byte unchanged: an unrelated root, a `workspace-copy` sibling prefix, a nonexistent root, a removed artifact with its expected path, an ID mismatch, an invalid artifact, a platform mismatch, kind `WSL`, a truncated envelope, a traversal ID, a newer version, an unknown path, and a missing `e`.
- `npm run build`, `npm run typecheck`, then `npm run test:extension` (VS Code 1.90.2): 17 passing, run twice. An earlier run hit `EBUSY` while removing a fixture subfolder; the test now uses async `rm` with retries and also clears leftovers in suite setup.

## Task 6.1 — Kotlin envelope decoder (2026-10-21)

`LaunchEnvelope.kt` (`LaunchEnvelopes.decode`) ports the TypeScript decoder:

- the length check before decoding;
- explicit padding and alphabet rejection;
- `Base64.getUrlDecoder()` plus a canonical re-encoding check, because the JDK accepts nonzero trailing bits;
- a strict `CharsetDecoder` (REPORT);
- Gson `JsonReader` with `Strictness.STRICT`, an end-of-document check, and explicit rejection of a leading BOM, which Gson would otherwise skip silently;
- the same validation order, messages, ECMAScript trim and sorted unknown members.

The first run caught the BOM difference (`malformed-json-bom`). After the fix, I added four more TypeScript reference cases to the fixtures (a BOM between tokens, a raw control character, an invalid escape, and multiple top-level values), bringing the total to 72 decode cases. I regenerated the fixtures; `fixtures:check` and the core conformance test pass. `LaunchEnvelopeTest` (3 tests) checks the limits and Rider prefix, matches all 72 decode results exactly (envelope JSON, or category plus problems), and decodes every built envelope to its recorded value and Rider URI. These Gradle tests read `launch-v1.json` from the test classpath and run without Node.

## Task 6.2 — Rider protocol command (2026-10-21)

- `WalkthroughOpening` now has a shared open entry point used by both the picker and the launch command:
  - `load` runs on a background thread, using `ArtifactStore.load`, and refuses an `expectedId` mismatch before the session changes;
  - `apply` runs on the EDT: `session.open`, `select(step)` for a known step, and showing the tool window;
  - `open` wraps both in a `Task.Backgroundable`.

  The picker keeps its original dialogs and wording through `OpenFeedback`.
- `LaunchProtocolCommand.execute` returns `null` after `invokeLater` to `LaunchHandling.handle`, which:
  1. checks the target `open` and `e`;
  2. decodes with the Kotlin port;
  3. applies `PlaybackEnvironment.currentRefusal()` (the Linux and remote refusal), then the kind/platform check, mapping `os.name` to Node platform names;
  4. checks canonical `toRealPath` containment, case-folded and separator-bounded on Windows, across `basePath` and `contentRoots`;
  5. picks the last-focused (`IdeFocusManager.lastFocusedFrame.project`), then the latest-opened candidate;
  6. checks that `<real root>/.walk-me-through/walkthroughs/<id>.json` exists, then calls the shared open with the step and expected ID.

  Notices go to the chosen project, or to the application when there is none. Rider falls back to a modal message only when no frame is visible (not in tests). The command no longer logs the envelope.
- Platform tests in `PlayerPlatformTest` use real Rider solutions:
  - Matching, nested step `a111`, re-launch at `b`, and an unknown step (overview plus an INFORMATION notice). The forged envelope title is ignored.
  - Refusals with no session change: unrelated root, nonexistent root, removed artifact (project-scoped notice), platform mismatch, Linux refusal (exact `PlaybackEnvironment.refusal("Linux", …)` text), malformed and truncated envelopes, newer version, unknown target, and missing `e`.
  - Asynchronous ID-mismatch and invalid-artifact errors, with the session unchanged and source files untouched.
  - Two matching projects: an `inner` solution opened inside the fixture solution. The last-focused project wins; otherwise the latest-opened one plays, and the other session stays inactive.
- `LaunchPathTest` (a unit test) covers separator-bounded containment, `repo` versus `repo-copy`, case folding, missing paths, and platform names.
- `gradlew.bat test buildPlugin verifyPlugin --console=plain` (Rider 2026.2.3.1, JBR 25): BUILD SUCCESSFUL in 1m 3s. That run had 38 tests and 0 failures: ArtifactStore 5, Artifact 3, ExplanationBrowserHandler 2, ExplanationRenderer 4, LaunchEnvelope 3, LaunchPath 1, PlayerPlatform 11 (9 existing + 2 launch), Presentation 2, Session 2, SourceText 5. Verifier 1.411 against RD-262.10968.170 reports Compatible with the same 5 deprecated and 6 experimental advisories as before, and no new or internal-API findings.

## Task 7.1 — integrated automated verification (2026-10-21, native Windows)

Toolchain: Node 24.16.0 locally (CI pins Node 20), npm 11.13.0, VS Code test build 1.90.2, Rider 2026.2.3.1 (RD-262.10968.170) with its bundled JBR 25, Gradle 9.1.0, IntelliJ Platform Gradle plugin 2.19.0, Plugin Verifier 1.411, OpenSpec CLI 1.14.3.

| Command | Result |
| --- | --- |
| `npm run build` | passed (skill script and manifest, extension and tests, `launcher/launcher.js`) |
| `npm run typecheck` | passed (core, skill, vscode, launcher) |
| `npm test` | 19 Vitest files, 76 tests passed; committed skill script, manifest and `launcher/launcher.js` match fresh builds; `v1.json` and `launch-v1.json` fixtures match; CI and Pages workflow checks pass (gate ready, upload limited to `launcher/`) |
| `npm run test:extension` | 17 passing (10 existing + 7 launch) |
| `gradlew.bat test buildPlugin verifyPlugin --console=plain` | BUILD SUCCESSFUL; 38 tests, 0 failures; verifier Compatible (5 deprecated / 6 experimental advisories, all pre-existing) |
| `openspec validate add-shared-launcher --strict` | `Change 'add-shared-launcher' is valid` |

Running `npm run test:extension` re-registers `vscode://` to the downloaded test build. Start the normal VS Code installation once before manual link checks.

## Tasks 4.3, 5.3, 6.3 — owner manual checks (2026-10-21)

Local preview used `npm run launcher:serve` (`scripts/serve-launcher.mjs`). A smoke test with `Invoke-WebRequest` returned 200 for `/`, `/styles.css` and `/launcher.js` with the expected content types, 404 for `/../package.json` and `/favicon.ico`, and ignored the query on `/index.html?x=1`. The sample was published with `--launcher-url http://localhost:8123/` (ID `20261021T153043621Z-b5xg2g`). The owner received links for the overview, the nested step `s4`, an unknown step, a markup title, a newer version, a damaged envelope and a missing envelope, together with the 4.3, 5.3 and 6.3 checklists:

- Edge launcher: page states, keyboard order, labels, light and dark themes, a narrow window, Copy ID, the remembered preference without auto-launch, help and retry panels, and DevTools network requests.
- VS Code: launches through local preview in the Extension Development Host, at the overview, a nested step and an unknown step, plus a wrong-window notice that leaves the workspace unchanged.
- Rider: launches through local preview into the installed real Rider 2026.2.3.1, with the reinstalled full plugin ZIP, at the overview and a nested step, plus the no-matching-project notice.

Owner report: **"all verified, they work like a charm."** These results come from the owner, not from automated checks. The owner did not separately report the exact wording of VS Code's confirmation prompt or any console CSP messages. The README therefore describes the prompt without quoting it.
