# Proposal

## Why

Today, opening a walkthrough means the reader runs **Open Walkthrough** and picks the title/ID by hand in either IDE. The agreed delivery sequence puts a shared HTTPS launcher next: one clickable, replayable link per walkthrough, from which the reader explicitly opens it in VS Code or Rider, with install help and a retry. Both players now exist, so the editor-independent launch contract can be designed against two real receivers before window routing is added on top of it.

## What Changes

- Define a versioned **v1 launch envelope**. It is base64url JSON carrying the recorded checkout root, execution environment, artifact ID, an optional step ID, and a display-only title. It has strict validation and size limits, and shared conformance fixtures for TypeScript and Kotlin.
- The publisher builds the envelope and returns a replayable HTTPS launch URL (`https://pvrobays.github.io/walk-me-through/#<envelope>`) along with the existing ID/path/picker fallback. Models never encode launch data. If a link would exceed the limit, the publisher omits it with a warning and keeps the picker fallback.
- The skill leads successful replies with the launch link, and keeps the title, ID, path, and picker instructions as the fallback.
- Add a self-contained static launcher under `launcher/`. It has no third-party scripts, analytics, or network requests. It decodes the fragment, shows what will open, and offers explicit **Open in VS Code** and **Open in Rider** buttons, per-IDE install help, and a retry. It never claims to detect whether a plugin is installed and never opens an IDE automatically.
- VS Code: add an `onUri` handler for `vscode://pvrobays.walk-me-through/open?e=<envelope>`.
- Rider: add a `jetbrains://rider/<command>/open?e=<envelope>` protocol command, delivered by jetbrainsd/Toolbox. The plugin makes no OS registration of its own.
- Both handlers validate the envelope and the local environment. They play the identified artifact, at the optional step, **only when the receiving window/project already contains the recorded checkout**. Otherwise they show an actionable notice and leave the window alone. Opening and focusing the correct window, closed-IDE startup, and duplicate-window selection stay with the next routing change.
- Enable the gated Pages deployment. The owner switches Pages to GitHub Actions in an explicit pause, and acceptance uses real links from OpenCode/Windows Terminal against the live site.
- Install help points to repository documentation for the local VSIX and plugin ZIP. The targets live in one configuration block so store/release URLs can replace them later.

## Capabilities

### New Capabilities

- `launch-envelope`: The v1 envelope fields, encoding, limits, and validation. Also covers publisher link generation and fallback, the skill's link-first delivery wording, and cross-language conformance.
- `launcher-page`: The static HTTPS page's decoding, display, explicit IDE choices, install help, retry, privacy constraints, and deployment.
- `ide-launch-handling`: The VS Code URI handler and Rider protocol command: validation, matching against the open checkout, playback at the requested artifact/step, and refusal notices.

No main specs exist yet. The baseline publishing, skill, and playback behavior lives in the completed, unarchived `add-walkthrough-vertical-slice`, `refine-progressive-depth-ux`, and `add-rider-playback` changes. The new capabilities extend that baseline without changing the input or artifact schemas.

### Modified Capabilities

None in the main spec inventory.

## Impact

- `packages/core`: new launch-envelope module (encode, decode, validate, URL builders) and a publisher success result with an optional `url`. Error/warning codes and the format reference gain launch-link entries.
- `packages/skill`: SKILL.md, the format reference, the regenerated script, the manifest, and the publisher/reference tests.
- New `packages/launcher` TypeScript source, bundled into committed static assets under `launcher/` with a drift check. Changes to `scripts/check-workflows.mjs` (the no-launcher assertion is removed) and `scripts/build.mjs`.
- `packages/vscode`: `onUri` activation, a URI handler, and an open-by-ID-and-step entry point. Extension-host tests.
- `packages/rider`: a `com.intellij.jbProtocolCommand` registration, project matching, an open-by-ID-and-step entry point, and platform tests. The plugin verifier must accept the extension point on the 262 target.
- `tests/conformance`: launch-envelope fixtures, consumed by both core and Rider.
- README, IMPLEMENTATION.md, Rider docs, and the live GitHub Pages site. The Pages source setting is changed only by the owner in the designated task.
- Out of scope: correct-window routing and forwarding, launching a closed IDE into a workspace, pending-request handoff, plugin-owned OS URL schemes, the IDE's built-in HTTP server, onboarding/update prompts, Marketplace/JetBrains publication, Insiders/Open VSX, remote environments, Rider on Linux, and portable cross-machine links. Publishing step-specific links from the skill is also out of scope, although the format and handlers accept a step.
