# Design

## Context

See `proposal.md` for motivation and the two capability specs for behavior. The repository currently has npm/TypeScript core, skill, and VS Code packages, with no JVM project. The accepted baseline lives in the completed changes `add-walkthrough-vertical-slice` and `refine-progressive-depth-ux`; main specs are empty. The owner selected Rider **2026.2.3.1**, native Windows acceptance, and Rider before shared launcher/routing work.

Observed implementation:
- `packages/core/src/artifact.ts` validates v1 objects, depth-first parent links, four levels, UTF-16 selection dimensions, and anchor consistency. `resolve.ts` performs context-first SHA-256 matching with line/character/offset ranking and explicit uncertain ties. `text.ts` normalizes BOM and line endings only.
- `packages/vscode/src/session.ts` has overview index 0, stored depth-first Next/Previous, subtree skipping, and generation guards. `store.ts` derives root from artifact placement and supplements indexed discovery because artifacts ignore themselves.
- `comments.ts`, `stepView.ts`, and `highlights.ts` establish untrusted Markdown, compact warning/tie text, dashed uncertainty, error-themed stale presentation, and owned cleanup.
- `packages/core/src/publish.ts` currently hardcodes VS Code in the returned `open` string. The skill/reference do too; Rider delivery needs a coordinated wording and generated-manifest update without a new artifact format.

## Goals / Non-Goals

**Goals:**
- Preserve artifact and behavioral compatibility across runtimes through executable conformance cases.
- Use a project-scoped IntelliJ frontend for plain-text playback and Rider-native controls.
- Validate the explanation surface early on the exact owner host, with an explicit stop for owner acceptance.

**Non-Goals:**
- .NET semantic integration, ReSharper protocol/backend, PSI-based relocation, or a Node/JavaScript engine to run core during playback.
- Startup/session persistence, external launch links, cross-project/window forwarding, automatic publishing/opening, installation prompts, or public publication.
- Broad JetBrains/OS/version compatibility claims. A local development ZIP is sufficient for this milestone.

## Decisions

### 1. Frontend-only Kotlin plugin with isolated Gradle tooling

Create `packages/rider` as an independent Kotlin/JVM Gradle project, not an npm workspace package. Use the IntelliJ Platform Gradle plugin 2.x, a committed Gradle wrapper with distribution checksum, and pinned dependencies compatible with the target Rider distribution. Record exact Rider product/build and bundled runtime from installed product metadata/Help About; do not infer the platform build or Java level from the marketing version. Support a developer-supplied local Rider installation path without committing machine paths. Select toolchain, Kotlin, Gradle, and plugin versions against that metadata, document them, and constrain the descriptor to the verified target build line. Run compatibility verification against the actual target where tooling supports it; do not substitute an IDEA run for Rider acceptance.

Use IntelliJ project services, actions, tool windows, file/document APIs, and range highlighters. No Rider language backend is needed for a text-range player. Build/run/test/install instructions and a local plugin ZIP are part of this change. Keep existing npm commands functional; add explicit Rider commands rather than making every npm build download a Rider SDK.

Alternative: a combined ReSharper/Rider plugin template introduces an unused .NET backend. A JavaScript bridge would add a runtime/process and complicate offline playback.

### 2. Prototype a persistent docked explanation, with an owner checkpoint

The initial surface is a Rider **Walk Me Through** tool window docked beside the source editor, with a nested outline and a persistent Step/explanation panel. Code-step Markdown appears there alongside the highlighted editor; its local toolbar supplies Previous/Next/Skip Details/Return/Close. This is the proposed Rider-native equivalent of code-adjacent comments, not a claim of a Comments API equivalent. The same panel displays overview, narrative, and stale explanations. No hover-only popup is acceptable.

Start with a minimal real-plugin prototype: highlight an expression and multiline range, show rich Markdown and a compact warning/stale sample, keep it visible during editor interaction, resize/scroll, and dispose cleanly. Have the owner evaluate adjacency, distraction, keyboard use, and theme readability on the exact Windows host. Record accepted surface and observations in this change. **Pause after the prototype until the owner accepts it.** If the docked surface fails the same-UX requirement, discuss an editor-attached surface and update the design/tasks before integrating; do not silently replace the requirement with a tooltip or reduced formatting.

Use native Swing tree/toolbars and a bundled JVM Markdown parser with raw HTML escaped and unsafe URLs/images disabled. Prototype the HTML explanation in JCEF for fenced-code syntax coloring using packaged renderer/highlighting assets; no CDN. Declare the JCEF bundled-module dependency required for 2026.2 in build/plugin descriptors and check support before creating browsers. Unsupported JCEF must give a clear runtime message; this milestone does not promise an alternate renderer. Navigation controls stay native and do not require an unrestricted JavaScript-to-IDE bridge. Theme colors/fonts come from the IDE and refresh on theme changes. Constrain browser resources/navigation, block remote image/resource requests and popups, and open only clicked HTTP(S) links externally.

Alternative: declarative inlay hints are designed for small textual hints, not persistent rich paragraphs and fenced blocks. Experimental Code Vision is unnecessary for this plain-text player. A Swing HTML renderer remains an implementation alternative only if it meets the full formatting/accessibility contract and is owner-approved at the same checkpoint.

### 3. Kotlin compatibility layer checked against the TypeScript reference

Implement Kotlin data models, explicit validation, normalization/hashing, coordinate conversion, resolver, and session navigation without Node. Match `validateArtifact` acceptance and the documented limits; preserve optional evidence without adding its display. Use Kotlin UTF-16 indices and UTF-8 SHA-256 bytes to match JavaScript semantics, including overlapping matches and terminal empty lines. Do not accidentally reject a v1 artifact simply because it includes an unknown field that the reference validator accepts.

Add committed language-neutral JSON conformance fixtures under `tests/conformance/` and a deterministic exporter/checker built from the existing TypeScript implementation. Include artifact validation positives/negatives, coordinate cases, original/current text and expected resolutions, and four-level navigation target sequences. Exercise both the TypeScript reference and Kotlin implementation against them; a check fails if generated expectations drift. Keep the generator in development tooling. Plugin tests read committed JSON directly. Supplement with independent invariants/edge assertions so generated fixtures are not the only proof of correctness.

Cases include BOM, CRLF/lone CR, tabs, supplementary Unicode before/inside selections, overlapping selections, multiline exclusive endpoints, exact/unique relocation, multiple contexts, lost context with one match, line-before-character distance, earlier-offset ties, stale reasons, invalid parent order/cycles/depth, empty overview boundaries, and Previous after skip.

Alternative: manually copying only example tests makes unnoticed drift likely. Extracting/rearchitecting all TypeScript session code for JVM reuse adds scope without eliminating runtime differences.

### 4. Root-aware discovery and current-document presentation

Discover from the Rider project's base/content roots, directly traversing for `.walk-me-through/walkthroughs/*.json` independently of index/ignore status. Deduplicate canonical paths, skip directory links and generated/dependency directories, do filesystem work in cancellable background tasks, and retain Browse for external or excluded artifacts. Browse still requires the artifact storage layout. Root comes from the containing directory, not a solution file, current editor, or recorded absolute path. Warn when canonical recorded and actual roots differ.

Validate fully before replacing a session. Enforce relative source paths and realpath containment before opening source. `FileDocumentManager` supplies current unsaved text; strict UTF-8/NUL checks apply to disk loads before using a document. IDE documents normalize line separators; maintain explicit offset mapping if BOM/normalization changes the underlying snapshot. Do not save documents. Missing/unreadable files yield stale results; outside-root paths produce an explicit source error without navigating outside the root.

Session state is a project service with a generation token. Take document snapshots under platform read rules, do expensive matching off EDT, then install presentation on EDT only if project/session generation and document modification stamp are still current. If a buffer changed during resolution, retry against its latest snapshot or abandon obsolete work; never install a result for stale snapshot coordinates. Step entry and Return trigger resolution; continuous edit-time matching is not required.

Use `MarkupModel` range highlighters for precise offsets and an appropriate dashed `TextAttributes` effect for uncertainty. Theme-aware highlight keys, warning indicators/text, and red stale icons preserve semantics. Dispose old highlighters/browser content before new presentation. Returning to a code step uses ordinary editor opening/reveal. Narrative/stale steps do not navigate to invented/old lines. Disposal includes listeners, browser resources, jobs, and project-session state; multiple projects remain independent.

### 5. Shared authoring and delivery wording

Keep one canonical `.agents/skills/walk-me-through` bundle and the existing v1 input/artifact formats. Update the `open` text to say the reader can run **Walk Me Through: Open Walkthrough** in VS Code or Rider and choose title/ID. Update skill/reference/README and publisher tests, then rebuild/check the manifest. Preserve leading **Walkthrough available**, normal-answer depth, honest evidence, concise complete top level, additive children, and the no-launch-URL contract. No separate Rider authoring skill or IDE-specific draft field is needed.

### 6. Verification and owner acceptance

Run Kotlin unit/conformance tests and platform tests for document snapshots, unsaved edits, precise highlighters, cancellation, project isolation, discovery, actions, and renderer restrictions. Build the plugin ZIP and verify descriptor/API compatibility. Re-run npm build/typecheck/test/bundle/VS Code extension tests when changing delivery or shared fixtures. Record actual commands, runtime/build versions, counts, and outcomes in this change.

Final owner acceptance uses Rider 2026.2.3.1 on native Windows: install/run the plugin, publish the shared sample, open the same artifact in both IDEs, inspect both reading paths and all surfaces, test narrow controls, explore code and return, edit unsaved text through relocated/uncertain/tied/stale cases, and replace/close. Include one C# source selection in a temporary/scratch project so acceptance covers Rider's primary editing context, not only TypeScript. Verify offline playback without Node launching, remote-mode refusal where available, light/dark/high-contrast readability (or record the actual accessible theme equivalent), and no stale presentation after pending work. Owner observations are required before marking acceptance complete.

## Risks / Trade-offs

- [Docked panel may feel less local than VS Code comments] → Owner prototype checkpoint before integration; amend artifacts if a different surface is required.
- [Runtime/SDK documentation can be inconsistent with installed patch builds] → Use actual Rider product/build metadata and pinned toolchain, not an inferred Java/build-number mapping.
- [JCEF packaging changed in 2026.2] → Explicit dependency/support checks, packaged assets, real-target prototype, and full disposal.
- [Kotlin port drifts from TypeScript] → Shared deterministic conformance checks plus independent edge/integration tests.
- [Background matching competes with document edits/disposal] → Read snapshots, modification stamps, generation guards, cancellable jobs, EDT-only installation.
- [Ignored nested artifact discovery scans large trees] → Background cancellation, deduplication and directory exclusions; Browse remains available without indexing.
- [Rider scope grows toward delivery or semantic features] → Keep current-project manual playback and plain-text anchors as the milestone boundary.

## Migration Plan

1. Bootstrap the exact-target development plugin and prototype, then stop for owner approval.
2. Add conformance-backed Kotlin playback, project services, discovery and UI integration using the approved surface.
3. Update shared delivery wording and generated bundle; existing saved artifacts remain untouched and valid.
4. Run automated checks, build a local ZIP, and conduct owner Windows acceptance with the same artifacts.
5. Rollback is uninstalling the development plugin and reverting code/bundle wording; no saved-artifact migration is needed.
6. Continue later with shared launcher, per-IDE routing, then onboarding/updates/distribution. No archive, commit, Marketplace publication, or Pages setting changes are implicit.

## Sources inspected during planning

- https://plugins.jetbrains.com/docs/intellij/rider.html — IntelliJ frontend versus ReSharper language backend.
- https://plugins.jetbrains.com/docs/intellij/tool-windows.html — Swing tool-window lifecycle, actions and disposal.
- https://plugins.jetbrains.com/docs/intellij/inlay-hints.html — small/declarative hints and experimental Code Vision trade-offs.
- https://plugins.jetbrains.com/docs/intellij/documents.html — LF-normalized current documents and read/write rules.
- https://plugins.jetbrains.com/docs/intellij/embedded-browser-jcef.html — JCEF dependency change in 2026.2, support checks, handlers and disposal.
- https://plugins.jetbrains.com/docs/intellij/tools-intellij-platform-gradle-plugin.html — 2.x tooling and local IDE dependencies.
- https://plugins.jetbrains.com/docs/intellij/build-number-ranges.html — actual build constraints; exact owner runtime/build still requires local inspection during bootstrap.

These are design references, not evidence that the planned plugin has run or that its UI has been accepted.
