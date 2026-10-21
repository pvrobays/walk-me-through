# Proposal

## Why

The owner primarily uses Rider and wants the accepted progressive-depth walkthrough experience in that IDE before investing in external delivery. Building a second player now validates the editor-independent artifacts and informs the subsequent shared launcher and IDE-specific routing.

## What Changes

- Add a local Rider plugin targeting JetBrains Rider **2026.2.3.1**, with native Windows as the acceptance platform.
- Begin implementation with an owner-reviewed persistent Markdown/source-highlight prototype; settle the Rider-native explanation surface before building the full player around it.
- Open existing v1 artifacts through an explicit current-project picker/Browse action, without republishing or changing their schema.
- Provide a four-level outline, overview/narrative/stale explanations, precise code highlighting and adjacent Markdown, Next/Previous/Skip Details, direct selection, Return to Current Step, and clean replace/close behavior.
- Match the accepted current-buffer anchor resolution, compact uncertainty/tie notices, and red stale presentation. Verify Kotlin behavior against fixtures produced from the existing TypeScript contracts.
- Update authoring/publisher opening guidance for both IDEs while retaining the shared project-local skill, progressive-depth guidance, and leading walkthrough-delivery section.
- Document local plugin build/run/install and Windows owner acceptance. Keep playback local, independent of Node, a .NET semantic backend, and companion services.

## Capabilities

### New Capabilities

- `rider-playback`: Rider project-local artifact selection, lifecycle, progressive navigation, outline, and explanation/highlight UX.
- `rider-artifact-compatibility`: Existing v1 artifact validation, project-root selection, UTF-16 coordinates, current-buffer resolution, and cross-player conformance.

No main specs currently exist. These capabilities preserve the baseline behavior in the completed, unarchived `add-walkthrough-vertical-slice` and `refine-progressive-depth-ux` changes, adapted to Rider-native surfaces.

### Modified Capabilities

None in the main spec inventory.

## Impact

- New Kotlin/Gradle project under `packages/rider`, with an IntelliJ Platform frontend plugin and locally installable development ZIP.
- Shared test fixtures/export tooling based on `packages/core`, plus Rider unit/platform integration tests.
- Canonical skill/reference, publisher opening wording/tests and generated bundle/manifest, README and implementation handoff.
- New development-time JDK/Gradle/platform and Markdown-rendering dependencies, pinned during bootstrap against the actual target distribution. No change to the consuming project's input/artifact schema or Node 20+ publishing requirement.
- HTTPS launcher, URI handling, cross-window routing, skill onboarding/update prompts, Marketplace/public release, remote hosts, other JetBrains IDEs, and non-Windows acceptance remain subsequent work in the agreed sequence. No deployment or archival is included.
