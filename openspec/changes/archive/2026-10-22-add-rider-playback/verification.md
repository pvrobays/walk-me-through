# Implementation verification

## Task 1.1 — exact-target bootstrap (2026-10-21)

- Native Windows, installed Rider 2026.2.3.1, product RD, build 262.10968.170, minimum Java 25 inspected from installed `product-info.json`.
- Bundled JBR: 25.0.4+1-b508.27, x86_64 Windows, confirmed from `jbr/release` and `java -version`.
- Pinned Gradle 9.1.0, IntelliJ Platform Gradle plugin 2.19.0, Kotlin 2.3.21; wrapper distribution and downloaded wrapper JAR checked against Gradle's published SHA-256 values. Developer path supplied through process-local `RIDER_HOME`; `JAVA_HOME` points to its bundled JBR.
- `gradlew.bat buildPlugin --console=plain`: passed, 11 executed tasks. Initial dependency-populating invocation timed out; follow-up passed in 2m 51s.
- `gradlew.bat runIde --console=plain`: launched a separate sandbox; observed log records exact IDE/JRE and `Loaded custom plugins: Walk Me Through (0.1.0-prototype)`. Gradle reports BUILD SUCCESSFUL after sandbox exit. Startup warnings about platform module/service overrides and optional crossgen cache were logged; no ERROR entries found.
- Build/run/install commands and isolated sandbox locations documented in `packages/rider/README.md`. No owner visual acceptance claimed.

## Task 1.2 — prototype implementation and verification

The prototype source includes the docked browser, bundled highlight.js 11.11.1/license, CommonMark 0.24.0, native sample/selection controls, theme listeners, owned highlight cleanup, and renderer/policy test cases. Verification history follows; task 1.2 is complete after the final owner runtime confirmation below.

`gradlew.bat test buildPlugin --console=plain` failed at `compileKotlin`:

- `ExplanationRenderer.kt:18`: CommonMark `UrlSanitizer` does not accept the supplied lambda.
- `PrototypePanel.kt:56`: the editor's nullable virtual file needs handling before `openFile`.
- `PrototypePanel.kt:111`: range highlighter attributes cannot be assigned through the current property expression.

After owner authorization to repair and continue, implemented the two-method `UrlSanitizer`, handled nullable virtual files, and used `RangeHighlighterEx.setTextAttributes`. The first repair run identified that `setRangeHighlighterAttributes` is not on the base markup interface; corrected against the installed SDK API.

`gradlew.bat test buildPlugin --console=plain`: BUILD SUCCESSFUL in 11s, 16 actionable tasks (12 executed, 4 up-to-date). JUnit XML reports **4 tests, 0 skipped, 0 failures, 0 errors** in `ExplanationRendererTest`. Tests cover Markdown/raw HTML, unsafe link/image filtering, external-navigation user-gesture policy, and packaged highlighting/CSP. They do not prove browser-handler integration or visual rendering.

The owner's successful sandbox checks are recorded below. Browser-handler integration tests and unsupported-JCEF runtime verification remain outstanding for task 1.2.

Relaunched `gradlew.bat runIde --console=plain` in a separate terminal for the owner checkpoint. The new sandbox log at 15:14:08 records `Loaded custom plugins: Walk Me Through (0.1.0-prototype)`.

## Task 1.3 — owner prototype acceptance (2026-10-21)

Owner reports **“this all worked flawlessly”** in response to the sandbox checklist and explicit question whether the docked surface is acceptable. The persistent right-docked Walk Me Through explanation surface is accepted for full-player integration.

The reported successful checklist covers Markdown emphasis/lists/inline code and C# fenced-code coloring; expression/multiline selections; compact uncertainty and red stale presentation; persistent adjacency during browsing and Return; narrow sizing, scrolling, keyboard controls and theme readability; Close cleanup and external documentation links. These are owner-reported observations on the exact-target native-Windows sandbox, not independently automated visual assertions. No rejection or requested surface revision was reported.

This acceptance does not establish unsupported-JCEF runtime behavior or browser-level malicious-content tests, which were not part of the presented owner checklist. Task 1.2 remains open for those checks.

## Task 1.2 — browser-handler checks (2026-10-21)

Extracted the registered request/popup handlers for direct tests using mocked CEF objects and an intercepted external-browser callback. Added Mockito 5.20.0 as a test-only dependency. Tests invoke the actual handler methods for current-document allowance, remote-resource cancellation, gesture-only HTTP(S) external dispatch, rejected command/file/custom navigation, and popup cancellation. These tests exercise handler callbacks without starting Chromium; owner observations above cover the normal rendered sandbox.

`gradlew.bat test buildPlugin --console=plain`: BUILD SUCCESSFUL in 36s, 16 actionable tasks (12 executed, 4 up-to-date). Six tests pass (four renderer/policy, two handler tests). Unsupported-JCEF runtime verification is the remaining task 1.2 check.

## Task 1.2 — unsupported-JCEF runtime confirmation (2026-10-21)

Following the sandbox-only instruction to disable `ide.browser.jcef.enabled`, the owner reported that Restart closed the sandbox without reopening it. Relaunched the same sandbox with `gradlew.bat runIde --console=plain`. The owner then confirmed seeing **“walk me through requires web browser (jcef)”** in the tool window. This confirms that the unsupported-JCEF branch displays its guidance in the exact-target runtime. Together with the six passing tests and accepted normal rendering/interaction checks, task 1.2 is complete.

The owner has been instructed to re-enable `ide.browser.jcef.enabled` and relaunch the sandbox for normal rendering. Restoration has not yet been reported. Tasks 1.1–1.3 are complete; the prototype acceptance checkpoint is satisfied.

## Task 2.1 — conformance tooling in progress

Added deterministic JSON fixture generation/check commands, committed fixture output under `tests/conformance/v1.json`, validation/text/resolver cases, and navigation traces produced by the real TypeScript Session with only host APIs stubbed. Added documentation and a drift check to `npm test`. Task 2.1 remains unchecked.

Observed commands: `npm run fixtures:generate` and `npm run fixtures:check` passed. `npx vitest run packages/core/test/conformance.test.ts` reported 1 passed and 1 failed test. All generated validation/coordinate/resolution expectations matched the reference. The independent assertion for `line-before-character` failed: its input inadvertently retained a unique identical context on line 1, which correctly outranks the context-lost candidate on line 0. The fixture must remove that context match to actually test distance ranking; preserve context-first reference behavior. Paused on the test failure per the apply workflow.

With owner authorization, changed the distance-ranking case's second line to avoid preserving the original context. Re-ran `npm run fixtures:generate`, `npm run fixtures:check`, and `npx vitest run packages/core/test/conformance.test.ts`: all passed (2 tests). Independent assertions now confirm context-loss uncertainty, earlier-offset ties, line-first ranking, relocation, stale no-range, Previous after Skip, and final-parent availability. Task 2.1 is complete.

## Task 2.2 — Kotlin v1 validation (2026-10-21)

Added typed artifact/step/location/anchor models, complete retained JSON metadata, explicit field validation, and file-named exceptions without partial artifacts. Validation follows TypeScript acceptance including unknown fields, evidence, depth-first hierarchy, four levels, dimensions, limits, ECMAScript whitespace and safe integers. Coordinates/context start lines use Long to retain JavaScript safe-integer positions rather than truncating to JVM Int. Added pinned Gson 2.13.2 (Apache-2.0) for JSON.

`gradlew.bat test --console=plain`: passed in 12s. Nine tests pass: six existing renderer/handler tests plus three artifact tests exercising every committed validation case with exact error objects, metadata/evidence retention, and artifact/field-specific failures. No Node process is used by Gradle tests. Session replacement integration remains in the loading tasks; this reader either returns a fully valid model or throws before any caller can replace a session.

## Task 2.3 — text, coordinates and resolver (2026-10-21)

Implemented BOM/CRLF/lone-CR normalization, strict UTF-8/NUL rejection, UTF-8 SHA-256, overlapping matches, UTF-16 positions, normalized-to-editor snapshot offsets, and context-first resolution with line/character/offset ranking and explicit ties. Missing/unreadable/no-match outcomes carry no range.

`gradlew.bat test --console=plain`: passed after implementation (4s), then after additional independent semantic assertions (3s). Fourteen tests pass in total, including five text/resolver tests. Shared fixtures cover every coordinate offset/hash/match and resolver result; independent tests verify exact/relocated/context-lost/tie/stale semantics, strict decoding, invalid coordinates, overlaps, and BOM/CRLF/Unicode editor boundaries. Gradle tests consume committed JSON without Node.

## Task 2.4 — project session and traversal (2026-10-21)

Added a project-level service with overview, shared availability/Skip target calculations, stable depth-first Next/Previous, selection/Return refresh, generation state and owned close/disposal callbacks. JSON opening validates before replacing state. Documented traversal contracts in Rider development/usage docs.

`gradlew.bat test --console=plain`: passed in 4s, 16 tests total. Session tests execute all shared real-TypeScript-session traces (including ancestor exits, boundaries, inactive calls, direct selection, final parents, Return and Previous after Skip), plus independent invalid-replacement preservation and separate-session isolation checks. Platform project-service/UI integration remains in tasks 3–4.

## Tasks 3.1–3.2 — discovery and root-safe loading (2026-10-21)

Added cancellable index-independent traversal of project base/content roots, canonical deduplication, generated/dependency/link exclusions, newest-first title/ID/time/project chooser and Browse. Opening is only attached to chosen-item/file callbacks; cancelling either chooser has no state mutation. Discovery alone does not open a session. Browse can load excluded artifacts but requires the storage layout. Loading derives the containing canonical root and warns with both roots after moves. Source access validates relative segments and realpath containment including existing ancestors of missing files.

`gradlew.bat test --console=plain`: passed after implementation (5s), then after actual Windows junction escape/discovery assertions (4s). Twenty-one tests total. Store tests cover ignored/nested/additional roots, dedup/sorting, excluded/Browse, empty discovery, cancellation propagation/no automatic selection, moved roots/layout rejection, Windows path/case behavior, missing leaves, and real Windows junction escape rejection. Session tests also verify invalid replacement preservation. Picker cancellation was verified by callback/control-flow inspection; actual picker UI remains part of integrated owner acceptance.

## Tasks 3.3–4 — integration in progress; platform test blocker

Added the initial integrated player panel (outline/current context/Markdown/native navigation), background document-snapshot presenter with generation/stamp guards and precise highlighters, Find Action registrations, and local-desktop refusal policy. These integrated tasks remain unchecked pending their required tests and runtime verification.

Before adding platform tests, `gradlew.bat test buildPlugin verifyPluginProjectConfiguration --console=plain` passed (4s): 23 unit tests and ZIP packaging. Configuration verification advises removing `until-build`; the exact-build restriction is retained because the approved design explicitly limits verified compatibility to the inspected target. This advisory does not establish API compatibility verification.

Added the target's platform test framework and two `BasePlatformTestCase` tests for actual editor/document/highlighter behavior and project service navigation. `gradlew.bat test --console=plain` then failed: **25 tests, 2 failures**. Both platform tests fail during Rider fixture/service initialization with `PluginException: solution can't be null [Plugin: com.intellij]`, caused by `SolutionHostExtensionsKt.getSolution` before the test bodies execute. The 23 unit tests pass. No platform behavior pass is claimed. Need Rider-aware test project/fixture initialization rather than the generic platform fixture; pause here per apply instructions.

### Platform fixture investigation after owner authorization

- Added `TestFrameworkType.Plugin.Rider`; Gradle resolves Rider test framework **262.10968.136** and platform framework **262.10968.165** as the available matching artifacts for installed RD-262.10968.170. `compileTestKotlin` passed. The Rider framework exposes scripting/facade support rather than a drop-in solution-backed `BasePlatformTestCase` replacement.
- Changed the two tests to a directory-backed heavy code-insight fixture and EDT execution. Corrected an EDT helper generic compilation issue. `gradlew.bat test --tests '*PlayerPlatformTest' --console=plain` still fails both tests before their bodies with the same missing-solution exception (33s). Directory-backed project creation alone does not initialize Rider's solution.
- Inspected installed SDK bytecode: project client-session registration eagerly requests `RiderDefaultBackend`, which requires `project.solution`; `RiderSolutionOpenStrategyProvider` returns no strategy for ordinary generic fixture projects. Rider's normal `SolutionManager` opening path supplies solution initialization explicitly.
- Corroborating public example: `reqnroll/Reqnroll.IdeSupport`, `src/Rider/src/test/kotlin/net/reqnroll/idesupport/rider/ReqnrollFeatureFileTypeRegistrationTest.kt`, found via GitHub code search, documents the identical generic-fixture failure. This is supporting evidence, not proof of a fix.

Remaining decision: add a solution-backed Rider integration harness (development/test-only backend lifecycle), or approve a test-only service replacement for unrelated Rider backend initialization while retaining real IntelliJ documents/editors. The latter narrows integration coverage and requires an explicit owner choice; neither approach has been silently substituted. Current tests remain failing and tasks 3.3 onward unchecked.

### Solution-backed harness selected and exercised

Owner selected option 1: a solution-backed Rider integration harness. Tests now initialize the test application, create a temporary directory, call Rider's normal `SolutionManager.openSolution` with `RdOpenSolution`/`RdVirtualSolution`, and attach the code-insight fixture to the resulting existing project. The installed SDK lacks discoverable Kotlin metadata for its path conversion helper; test-only reflection calls the inspected public JVM `PathExtKt.toRd(Path)` API. Teardown closes the project through ProjectManagerEx. No backend service replacement is used.

`gradlew.bat test --tests '*PlayerPlatformTest' --console=plain` passed in 17s for the original two tests: real document/highlighter editing and project-service navigation/close. The original missing-solution initialization blocker is resolved.

Expanded the same suite with actual presenter unsaved-state transitions, snapshot-stamp retry, and integrated outline/control checks. Added a deterministic snapshot callback seam and internal presentation accessors, and corrected breadcrumb position-string precedence. The expanded command then ran **5 tests: 2 passed, 3 failed** (16s). Two new tests access FileDocumentManager from the test worker without a read action; the panel test encounters Rider backend `There is no text control with id KernelAwareTextControlId` while asynchronous editor/document events drain. Logs also show Rider's `patch.engine.backend.freeze.timeout` test-registry assertion. These failures are visible and unsuppressed. Tasks 3.3 onward remain unchecked; pause to repair read-action usage and solution/editor backend readiness in this harness. No full-suite pass claimed for this revision.

### Harness synchronization repaired

After owner authorization, protected test document acquisition with read actions, disabled Rider's test-inappropriate `patch.engine.backend.freeze.timeout` in the test process, and invoked the supplied Rider `waitForFullStartup` helper on EDT before fixture attachment. The initial helper invocation on the worker failed its EDT assertion; moving it to EDT resolved startup/editor readiness. Five platform tests passed in 15s.

Added real registered-action availability/no-op checks and a deferred snapshot that completes despite cancellation after Close. `gradlew.bat test buildPlugin --console=plain` passed in 20s (30 tests: 23 unit, 7 platform). Added multiline/deleted/invalid-UTF8 presentation checks; corrected test use of an unavailable `closeAllFiles` helper to close each open file through the supported API. `gradlew.bat test --tests '*PlayerPlatformTest' --console=plain` then passed in 20s: **8 platform tests, zero failures**. Tests verify source disk contents remain unchanged during unsaved transitions, precise expression/multiline ranges, no fabricated source reveal for stale/missing/unreadable steps, stamp retry, obsolete result suppression after Close, outline ancestor expansion and native controls/actions. Added owned editor-listener disposal through the presenter Disposable.

### Task 3.4 — owned lifecycle checks

The explanation browser now has its own Disposable under the panel and is released on Close; reopening creates fresh resources. Presenter cancellation/generation/stamp guards suppress obsolete work, including callbacks deliberately made non-cancellable in tests. Added two-real-project disposal/isolation assertions and navigation-to-overview suppression. `gradlew.bat test --tests '*PlayerPlatformTest' --console=plain` passed in 25s: **9 platform tests**. Project disposal releases panel children/message-bus listeners/browser/presenter, closes its service, and leaves the other project's active session intact. Task 3.4 is complete.

### Task 4.1 — outline/explanation integration

Integrated title, four-level outline/current marker, expanded ancestors, breadcrumbs, position/state icons and the accepted Markdown panel. Added platform assertions for collapsed-parent Next, deep selection, overview/stale/narrative context, replacement and Close empty-state availability. `gradlew.bat test --tests '*PlayerPlatformTest' --console=plain` passed in 27s (9 platform tests). Concise/full reading paths and Return are documented in Rider usage docs. Task 4.1 is complete.

### Task 4.2 — actions and controls

All six actions are registered in plugin.xml for Find Action and exposed in the native tool-window controls beside the explanation. Buttons use a two-column narrow layout, focusable native controls/mnemonics, accessible descriptions and the specified Skip tooltip. The passing nine-test platform run includes real registered action update/direct invocation at inactive/boundary states and integrated button availability across Open/navigation/replacement/Close. Prototype keyboard/narrow-layout owner acceptance is retained; final integrated visual acceptance remains task 6.2. Task 4.2 is complete.

### Task 4.3 — source-state presentation

Integrated informational relocation, visible warning/tie text and warning icons, dotted uncertain highlighters, and red stale status/icons with retained explanation/original path/line. Added platform assertions for the uncertain effect type and explicit unsafe-source errors with no outside navigation. Existing tests cover deleted/invalid UTF-8 and unsaved state transitions/cleanup; renderer restrictions remain exercised by the same unit/handler tests. Matching limits and refresh-on-entry behavior are documented.

`gradlew.bat test buildPlugin --console=plain`: passed in 27s, **32 tests (23 unit, 9 platform)** and plugin ZIP packaging. Task 4.3 is complete. Task 4.4 still needs observed offline sandbox playback; environment refusal decisions already have unit coverage.

### Task 5.1 — shared delivery wording

Publisher opening text, canonical skill and format reference now offer VS Code or Rider with the same title/ID picker and unchanged schema. Leading Walkthrough available, normal answer depth and progressive authoring requirements are retained. Rebuilt generated publisher script and manifest; reference publication test asserts both IDEs and the returned ID/picker wording.

`npm run build`, `npm run check:bundle`, `npm run typecheck`, and `npm test` all passed. Vitest: **47 tests, 17 files**; bundle reproducibility, conformance fixture drift and workflow checks passed. Task 5.1 is complete.

### Task 5.2 — exact-target verifier blocker

Configured plugin verification against the developer-selected local Rider path. `gradlew.bat verifyPlugin --console=plain` ran IntelliJ Plugin Verifier **1.411** against actual **RD-262.10968.170**. Binary compatibility is reported compatible, but the task correctly **failed** its override-only API check: the Open button in `PlayerPanel` directly invokes `AnAction.actionPerformed`, which is an override-only method. Replace this dispatch with supported ActionManager invocation or a shared opening operation. Do not suppress the verifier failure.

The verifier also reports deprecated/experimental default interface bridges on the Kotlin ToolWindowFactory, deprecated ReadAction.compute, and scheduled-for-removal AnActionEvent.createFromAnAction. Those are advisory in this run; the blocking result is the single override-only violation. Installed IDE layout warnings were printed for optional/missing bundled module paths. Task 5.2 remains unchecked, as do 4.4 (offline sandbox run), 6.1 (integrated checks), and 6.2 (owner acceptance). Apply paused on this error.

### Task 5.2 completed — shared opening and packaging verification

With owner authorization, extracted `WalkthroughOpening.choose(project)` and called it from both action and panel, removing direct override-only invocation and scheduled-for-removal event construction from production. `gradlew.bat test buildPlugin verifyPlugin --console=plain` passed in 57s: **32 tests**, ZIP packaging, and exact-target Plugin Verifier compatibility. Pinned verifier **1.411** explicitly and reran `verifyPlugin`: passed in 35s. Five deprecated and six experimental usages remain advisory; no failure-level suppression was added.

Documented Windows build/test/package/run/install, exact versions, dependency/license information, fixture commands, prerequisites and runtime scope in Rider README. Updated root README/handoff with pending final acceptance status. Local ZIP: `packages/rider/build/distributions/walk-me-through-rider-0.1.0-prototype.zip`. No publication or wider compatibility claim. Task 5.2 is complete.

### Task 6.1 — integrated automated verification (2026-10-21)

Host: native Windows; Rider 2026.2.3.1 / RD-262.10968.170, JBR 25.0.4+1-b508.27; Gradle 9.1.0, Kotlin 2.3.21, IntelliJ Platform Gradle 2.19.0; Node 24.16.0 as previously observed in this workspace. Commands observed this implementation session:
Host versions rechecked: Windows NT **10.0.26300.0**, PowerShell **7.6.6**, Node **v24.16.0**.

- `gradlew.bat test buildPlugin verifyPlugin --console=plain`: pass, 32 tests (23 unit, 9 platform), ZIP and exact-target verifier; pinned verifier rerun passes.
- `npm run build`, `npm run typecheck`, `npm test`: pass; 47 tests/17 files, generated bundle, fixture drift and workflow checks pass.
- `npm run check:bundle`: pass.
- `npm run test:extension`: pass, **10 tests** on VS Code **1.90.2**; host printed non-fatal mutex/deprecation and missing-discovery-directory messages.
- `openspec validate add-rider-playback --strict`: pass.
- `git diff --check`: pass.
- Published shared sample: **Why retries never back off**, ID **20261021T141226127Z-7z5zuu**, 6 steps, no warnings, under `examples/sample-project/.walk-me-through/walkthroughs/`. Both IDEs can select the same retained artifact.

Task 6.1 is complete. Task 4.4 requires owner-observed offline sandbox playback; task 6.2 requires final integrated owner acceptance including scratch C#. Neither is inferred from the automated runs.

### Owner acceptance preparation

Prepared scratch C# source/draft under the approved temporary work directory `wmt-rider-acceptance`. The first publish reported missing input version; added `version: 1` and publication passed: **Rider C# acceptance**, ID **20261021T141446452Z-ullh7n**, 2 steps, no warnings. This provides a multiline C# method and precise cap-expression selection without modifying repository source. Relaunched `gradlew.bat runIde --console=plain` for integrated owner checks. Offline and final acceptance results remain pending.

### Task 6.2 — integrated owner acceptance (2026-10-21)

In response to the integrated checklist and explicit acceptance request, the owner reports **“all looks good in rider and vscode”**. Record this as acceptance of the integrated player and the presented sample/C# and interaction checks, with no issues or requested revisions reported. The checklist covered both reading paths/navigation surfaces, source-state transitions, Markdown/code coloring, narrow controls/themes, replacement/Close and project isolation. These are owner-reported results; no additional visual automation or per-scenario measurements are claimed. Task 6.2 is complete.

The response names successful Rider/VS Code playback but does not explicitly confirm network disconnection. Task 4.4 remains unchecked pending confirmation that a saved walkthrough opens/navigates in Rider with the network disconnected. Overall progress: 18/19 tasks complete.

### Offline check deferred by owner

The owner explicitly reports not performing the disconnected-network check and chooses not to run it now, considering it an edge case. Offline runtime verification is deferred; no offline pass is claimed and task 4.4 remains unchecked. The integrated player acceptance stands. Overall tracked progress remains 18/19; the owner asks to move the discussion to the agreed next work.

## Archived with an open task (2026-10-22)

On the owner's instruction this change was archived with its one open task unchecked. Later behavior and distribution are covered by `prepare-store-publication`.
