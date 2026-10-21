# Tasks

## 1. Exact-target bootstrap and UI prototype

- [x] 1.1 Inspect the installed Rider 2026.2.3.1 product/build/runtime metadata, bootstrap `packages/rider` with Kotlin/JVM, pinned IntelliJ Platform Gradle 2.x tooling and checksummed Gradle wrapper, and add local-IDE-path configuration without committed machine paths. Verify a minimal plugin builds and launches in a separate Rider sandbox; record actual toolchain/build versions and runnable Windows build/run/install commands in Rider development docs.
- [x] 1.2 Implement the docked explanation/highlight prototype with native controls, persistent Markdown, bundled fenced-code syntax coloring, precise expression/multiline ranges, compact warning and red stale samples, theme refresh, and disposal. Verify renderer tests block raw HTML, command/file/custom links, remote resources and popups while clicked HTTP(S) links open externally; verify the exact-target sandbox displays formatted content and reports unsupported JCEF clearly.
- [x] 1.3 Pause for owner prototype acceptance on Rider 2026.2.3.1/native Windows. Demonstrate adjacency while editing/browsing, Markdown and code coloring, keyboard controls, narrow sizing/scrolling, light/dark/accessibility-theme readability, and cleanup. Record the accepted surface and observations in this change before proceeding to full-player integration; if rejected, revise artifacts with the owner rather than narrowing the specified UX.

## 2. Artifact and navigation conformance

- [x] 2.1 Add deterministic committed JSON conformance fixtures and a TypeScript exporter/drift check for v1 validation, coordinates/normalization, resolution and four-level navigation. Verify the existing TypeScript reference against the cases, including real session Skip Details/Previous semantics; document fixture generation/check commands and keep runtime playback independent of this tooling.
- [x] 2.2 Implement Kotlin v1 models and validation preserving reference acceptance, metadata and evidence labels. Verify shared positive/negative fixtures for IDs, versions, ranges/anchors, unknown fields, parent order/cycles, four-level limit and nested leaves; verify errors identify the artifact and fields before any session replacement.
- [x] 2.3 Implement Kotlin normalization, hashing, UTF-16 coordinate mapping and context-first resolver. Verify shared fixtures and independent edge tests for BOM/CRLF/lone CR, tabs, supplementary Unicode, overlapping matches, multiline ends, exact/relocated/uncertain/tie/stale outcomes and candidate ranking; ordinary Kotlin tests must run without Node.
- [x] 2.4 Implement project-scoped session state and shared availability/target calculations for overview, Next/Previous, Skip Details, direct selection and Return. Verify conformance cases for nested siblings/ancestor exits, final branches, inactive no-ops, and Previous after skipping; document the preserved traversal semantics in Rider usage docs.

## 3. Project loading and current-buffer display

- [x] 3.1 Implement cancellable non-index-dependent discovery under base/content roots and nested projects, canonical deduplication, newest-first picker and Browse. Verify self-ignored artifacts, excluded/dependency-directory behavior, multiple content roots, empty discovery and cancelled choice; document artifact placement and manual selection.
- [x] 3.2 Implement artifact-derived root loading, canonical moved-checkout warnings and safe relative/realpath-contained source access. Verify nested/moved roots, Browse layout rejection, absolute/traversal/link escapes and invalid replacement preservation; include Windows path/case cases and file-specific errors in tests.
- [x] 3.3 Integrate current-document snapshots, strict UTF-8 disk loading, normalization-to-editor offset mapping and source reveal using the accepted prototype surface. Verify exact expression/multiline highlighters and unsaved relocation/uncertainty/stale transitions without saving or changing source; verify narrative/stale steps never navigate to fabricated/old lines.
- [x] 3.4 Add generation/modification-stamp guards, cancellation and owned cleanup for navigation, replacement, close and project disposal. Verify deferred source reads cannot restore obsolete presentation, a changed snapshot cannot install incorrect coordinates, multiple projects remain isolated, and listeners/browser/highlighters are disposed.

## 4. Complete Rider reading experience

- [x] 4.1 Integrate the four-level outline, current marking, ancestor expansion, breadcrumbs, title, position and state icons with the approved explanation panel. Verify overview/narrative/code/stale selection, collapsed-parent Next, return from source exploration, and replacement/close empty states in platform tests; document both concise and full reading paths.
- [x] 4.2 Register Open/Close/Next/Previous/Skip Details/Return actions in Rider Find Action, the tool window and beside the explanation. Verify availability across open/navigation/replace/close, disabled direct no-ops, explanatory Skip Details tooltip/accessibility text and keyboard focus; retain narrow-layout usability from the prototype.
- [x] 4.3 Integrate informational relocation, compact visible uncertainty/tie notices with warning icons and dashed highlights, and red stale markers with original path/line and retained explanation. Verify presentation/cleanup tests for each state, source/deleted/unreadable errors, and unchanged Markdown restrictions; document exact matching limits and refresh-on-entry behavior.
- [ ] 4.4 Enforce local-desktop playback and actionable remote-host refusal, with no runtime Node/model/companion requirement. Verify environment decisions with tests and exercise saved-artifact playback offline in the target Rider sandbox; document the Windows-only acceptance scope and JCEF/runtime prerequisites.

## 5. Shared authoring and developer delivery

- [x] 5.1 Update publisher `open` wording, canonical skill and format reference to offer both Rider and VS Code while preserving title/ID selection, leading Walkthrough available, requested answer depth and progressive authoring guidance. Verify publisher/reference tests and rebuild/check the generated script/manifest with `npm run build` and `npm run check:bundle`; no input/artifact schema changes.
- [x] 5.2 Complete local plugin ZIP packaging and Windows development/install instructions, with pinned dependency/license information and fixture/check commands. Verify the documented build/test/package commands and descriptor/API compatibility against the actual target Rider distribution, recording exact versions and outcomes; update README/handoff status without claiming public publication or wider compatibility.

## 6. Integrated Windows acceptance

- [x] 6.1 Run the documented Rider unit/conformance/platform tests, fixture drift check, plugin packaging and compatibility verification, plus `npm run build`, `npm run typecheck`, `npm test`, `npm run test:extension` and strict OpenSpec validation. Record actual Windows/runtime/IDE versions, commands, counts and results in this change; do not substitute configured CI for observed runs.
- [x] 6.2 Conduct owner acceptance on Rider 2026.2.3.1/native Windows with the same published v1 sample opened in Rider and VS Code plus a scratch C# selection. Verify concise/full paths, all navigation surfaces and boundaries, ancestor reveal, return, unsaved anchor-state/tie transitions, Markdown/code coloring, narrow controls, themes, replacement/close and project isolation. Record observations and owner acceptance before marking complete.

## Workflow follow-up

- Apply this change in a separate implementation request with `/opsx-apply add-rider-playback`. Stop at task 1.3 for owner acceptance before integrating the full player.
- Review and archive completed changes only when requested; no automatic commit, archive, public plugin publication, or deployment is authorized.
- Continue in the agreed order: shared HTTPS launcher with VS Code/Rider choices, correct-window routing for each IDE, then onboarding/customization-aware updates/distribution.
