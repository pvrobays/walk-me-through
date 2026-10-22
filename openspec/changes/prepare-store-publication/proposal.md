# Proposal

## Why

The owner has already uploaded first versions of both viewers. The VS Code Marketplace lists `pvrobays.walk-me-through` 0.1.0, and that listing has no README, icon or categories. JetBrains Marketplace plugin 35375 (`io.github.pvrobays.walkmethrough`, `0.1.0-prototype`) is awaiting review. That build describes itself as a "Development prototype" and is restricted to the single build 262.10968.170.

Store users currently get a viewer that refuses macOS, and in Rider also Linux. They also have no way to obtain the project skill without cloning this repository. Before the next store versions, both packages need to be complete, honest listings that a fresh user can install from the store and start using.

## What Changes

- **Store-ready listings for version 0.2.0 of both viewers.**
  - VS Code: a Marketplace README and CHANGELOG, a PNG icon, a display name, categories, keywords, homepage and bugs links, and bundled third-party notices.
  - Rider: a plugin description and change notes, `pluginIcon.svg` (light and dark), vendor URL, open-ended compatibility from build 262, third-party notices, and optional author signing configured through local secrets.
- **Shared icon artwork** generated from one dependency-free script, derived from the current walkthrough mark and committed for owner review.
- **Native macOS is allowed everywhere, unverified.** The shared environment check, the publisher script, the VS Code extension and the Rider plugin accept native Windows, Linux and macOS. They keep refusing WSL, SSH, containers, remote hosts and headless environments. **BREAKING (behavior):** Rider no longer refuses Linux and macOS hosts. Linux and macOS are documented as not verified by the maintainers, with automated macOS CI as the only macOS evidence.
- **Skill onboarding in both IDEs.**
  - A **Walk Me Through: Install Skill into Project** command copies the skill bundle shipped inside the extension or plugin into the project's Git root, at `.agents/skills/walk-me-through/`. It never overwrites differing files.
  - When a Git project without the skill is opened, the IDE shows a notification with three buttons: **Install**, **Not for This Project** (remembered per project) and **Don't Ask Again** (remembered globally).
- **Help and docs point to the stores.** The launcher's install help targets and the README install sections lead to the Marketplace pages. The local VSIX and ZIP builds stay documented as a development path.
- **Owner pauses for manual store uploads.** Release automation is explicitly deferred.

## Capabilities

### New Capabilities

- `store-listings`: what each published viewer package contains and declares: identity, version, listing content, icons, compatibility, third-party notices and signing. Also where install help points.
- `skill-onboarding`: installing the bundled project skill from inside either IDE, and the dismissible missing-skill offer.
- `platform-support`: which host environments the publisher, the VS Code extension and the Rider plugin accept or refuse, and how unverified platforms are communicated.

### Modified Capabilities

None in `openspec/specs/`, which is still empty. Behavior this change supersedes lives in unarchived changes:

- `add-walkthrough-vertical-slice`: native Windows and Linux only for the publisher and VS Code.
- `add-rider-playback`: the Windows-only Rider refusal.
- `add-shared-launcher` (`ide-launch-handling`, scenario "Rider on Linux"; `launcher-page`, scenario "Initial targets"): the Linux refusal, and help targets that point to README sections.

The new capability specs state the replacement behavior explicitly. `add-shared-launcher` task 7.3 is still open; archive that change before this one so the archived specs apply in order.

## Impact

- `packages/core/src/env.ts`, its tests and fixtures: `darwin` is accepted. The skill's `SKILL.md`, format reference, regenerated script and manifest change, and the bundle version moves to 0.2.0.
- `packages/vscode`:
  - `package.json`: version, icon, categories, keywords, links, and the `onStartupFinished` activation event;
  - the new install-skill command and onboarding notification;
  - the skill bundle copied into the VSIX at build time;
  - `README.md`, `CHANGELOG.md`, `ThirdPartyNotices.txt` and `.vscodeignore`;
  - extension-host tests.
- `packages/rider`:
  - `PlaybackEnvironment` and the launch-refusal tests;
  - `plugin.xml`: description, vendor, icons, the install action and a startup activity;
  - `build.gradle.kts`: version, `sinceBuild` 262 with no `untilBuild`, multi-IDE verification, the change-notes source, the bundled skill resources, and optional signing;
  - the notices file and platform tests.
- `packages/launcher` (`config.ts`, the help text in `index.html`, the regenerated `launcher.js`) and a Pages redeploy on push.
- `scripts/`: a new icon generator; `build.mjs` copies the skill into the VS Code package; `.github/workflows/ci.yml` gains a macOS matrix entry.
- README, IMPLEMENTATION.md and `packages/rider/README.md`.
- Owner actions: review the icons, optionally create a JetBrains signing certificate, upload VSIX 0.2.0 and the Rider ZIP 0.2.0 by hand, then install both from the stores for acceptance.
- Out of scope: automated releases and CI publishing, Entra ID/PAT setup, GitHub Releases, skill update or upgrade detection, correct-window routing, Open VSX, screenshots and marketing material, verified-publisher domains, and maintainer verification on Linux or macOS beyond CI.
