# Tasks

## 1. Versions and platform acceptance

- [x] 1.1 Set version 0.2.0 in `packages/skill/package.json`, `packages/vscode/package.json` and `packages/rider/build.gradle.kts`. Inject the bundle version into `cli.ts` with an esbuild `define` instead of the literal (D1). Verify that the regenerated script and manifest report 0.2.0, that the `manifest.test.ts` and `cli.test.ts` expectations are updated and pass, and that `npm run check:bundle` passes.
- [x] 1.2 Accept native `darwin` in `packages/core/src/env.ts` and reword the refusal messages to "local desktop", keeping the WSL, container, SSH and override behavior (D6). Verify with `env.test.ts`, covering accepted Windows, Linux and macOS, still-refused WSL, container and SSH, and the Node check before detection. Update `SKILL.md` and the format reference wording, rebuild, and confirm `reference.test.ts` passes.
- [x] 1.3 Remove the OS clause from Rider's `PlaybackEnvironment.refusal` and keep the remote, headless, SSH and WSL refusals. Replace the Linux-refusal assertions in `PlayerPlatformTest` with remote-host refusals, and add a unit test showing that `refusal("Linux"|"Mac OS X", false, false)` is `null`. Verify with `gradlew.bat test`.
- [x] 1.4 Add `macos-latest` to the `ci.yml` matrix, running build, typecheck, `npm test` and `test:extension` without Xvfb, and update `check-workflows.mjs` to assert the three-OS matrix. Verify `npm test` locally. The hosted macOS run is checked in 7.1.

## 2. Icons

- [x] 2.1 Add `scripts/build-icons.mjs` (D2), generating `packages/vscode/media/icon.png` (256×256) and the Rider `META-INF/pluginIcon.svg` and `pluginIcon_dark.svg` (40×40) from one geometry, using only Node built-ins. Add an `npm test` check that regenerates the icons in memory and fails on drift. Verify that the PNG decodes at 256×256, that the drift check passes and fails after a deliberate edit, and that both SVGs are 40×40.
- [x] 2.2 Pause for owner review of the generated icons in light and dark themes, at Marketplace and IDE plugin-list sizes. Record the approval or the requested adjustments in `verification.md` before groups 4 and 5 reference the icons.

## 3. Skill bundling and installer

- [x] 3.1 Copy the four skill files into `packages/vscode/skill/` on every build (gitignored) and into Rider's `skill/` resources via `processResources` (D7). Verify by listing both packages after a build, and with tests in each IDE asserting that the shipped files hash to the shipped `manifest.json`. On Kotlin this uses `SourceText` hashing; check it against the TypeScript manifest values.
- [x] 3.2 Add the shared fixture `tests/conformance/skill-install.json`, covering fresh, CRLF-identical, customized `SKILL.md`, partial, worktree `.git` file, nested folder and no-Git cases with the expected outcome and files. Generate or check it with `fixtures:generate` and `fixtures:check`. Verify that drift detection fails after a deliberate edit.
- [x] 3.3 Implement the VS Code installer (D8): target resolution, the all-or-nothing difference check, exclusive creation, and the three outcome messages including "commit and restart your agent". Register `walkMeThrough.installSkill` as **Walk Me Through: Install Skill into Project**, refusing in remote windows. Verify with Vitest over the fixture cases and an extension-host test that runs the command on the fixture workspace (fresh install, then already installed, then refusal after a customized `SKILL.md`, with no file overwritten).
- [x] 3.4 Implement `SkillInstaller.kt` and the `WalkMeThrough.InstallSkill` action with the same algorithm and messages, refusing in remote or headless Rider. Verify with Kotlin unit tests over the same fixture, and with a platform test running the action on the fixture solution.

## 4. Missing-skill offer

- [x] 4.1 Add VS Code `onStartupFinished` activation and the offer (D9): trusted, local, Git-root workspaces only; one notification per root per session; **Install**, **Not for This Project** and **Don't Ask Again** stored in `globalState`. Verify with extension-host tests through a test-API hook: offer shown, no offer when `SKILL.md` exists or outside Git, project dismissal persists while other roots are still offered, global dismissal suppresses all, the command still works after dismissal, and no file is written without Install.
- [x] 4.2 Add the Rider `postStartupActivity` offer with three `NotificationAction`s and application-level `PropertiesComponent` state (D9). Verify with platform tests using the same scenarios, and that `verifyPlugin` reports no internal or experimental API use from the new code.
- [x] 4.3 Document the command, the offer, its dismissals and the view banner (the way back after a dismissal; there is no reset command) in the README, `packages/vscode/README.md` and `packages/rider/README.md`. Verify that the documented command names match the contributed titles.
- [x] 4.4 Add the missing-skill banner (owner decision 2026-10-22): VS Code shows it at the top of the Step view with an **Install Skill** button and as the Steps tree message; Rider shows an `EditorNotificationPanel` at the top of the tool window. Both ignore dismissals, refresh when the view is shown, after installs and when folders change, and are hidden in refused environments. Verify with an extension-host test (banner and tree message shown for a Git target without `SKILL.md` after both dismissals, the button runs the install, hidden afterwards and with a customized `SKILL.md`) and a Rider platform test on the tool-window panel.

## 5. Store listings

- [x] 5.1 VS Code (D3): add the Marketplace `README.md`, `CHANGELOG.md` and `ThirdPartyNotices.txt`, and the `package.json` icon, categories, keywords, homepage, bugs, gallery banner and pricing. Extend `.vscodeignore` to include the new files and `skill/**`. Add the Vitest check comparing the esbuild metafile packages with the notices. Verify `npm run package:vsix` lists exactly `package.json`, `dist/extension.js`, `media/` (including `icon.png`), `skill/` (4 files), `README.md`, `CHANGELOG.md`, `LICENSE.txt` and `ThirdPartyNotices.txt`, with no prompts or warnings other than the bundle-size note.
- [x] 5.2 Rider (D4): add `marketplace/description.html` and `change-notes.html` wired into `pluginConfiguration`; set the vendor `pvrobays` with its URL, `sinceBuild = "262"` and no `untilBuild`, and the icons. Add `LICENSE` and `THIRD-PARTY-NOTICES.txt` to the ZIP root, with the Kotlin test checking notices against the sandbox `lib/` jars. Verify that the built `plugin.xml` inside the jar contains the description, change notes, vendor, version 0.2.0 and `since-build="262"` with no until-build, and that the text contains no "prototype".
- [x] 5.3 Configure verification against the local Rider plus the latest released Rider (`select`), and run `gradlew.bat test buildPlugin verifyPlugin`. Verify both builds report Compatible with no new problems. Record the build numbers, download size and duration in `verification.md`.
- [x] 5.4 Add optional signing (D5): enable `signPlugin` and `verifyPluginSignature` only when `CERTIFICATE_CHAIN`, `PRIVATE_KEY` and `PRIVATE_KEY_PASSWORD` are set, and add `.gitignore` entries for key material. Verify that `buildPlugin` succeeds without the variables, and that `git status` shows no key files. Document the owner's `openssl` steps in `packages/rider/README.md`.
- [x] 5.5 Pause for the owner to decide on author signing. If chosen, the owner creates the certificate outside the repository and runs `gradlew.bat signPlugin verifyPluginSignature`. Record the decision and result.

## 6. Install help and documentation

- [x] 6.1 Point `packages/launcher/src/config.ts` install targets to the two store pages, update the launcher help wording (no Windows-only Rider line; the platform status), and adjust the launcher tests' URL allow-list and README-anchor checks (D10). Verify with `npx vitest run packages/launcher`, `npm run build`, and the `check:bundle` launcher drift check.
- [x] 6.2 Rewrite the README install sections to lead with the stores, add a "Development builds" subsection for the VSIX and ZIP, update the platform statement (Windows tested; Linux and macOS not verified; exclusions), and update IMPLEMENTATION.md and the Rider README current-status text. Verify that every README link checked by the launcher test resolves, and that no text still claims Windows-only Rider support or a prototype status.

## 7. Integration and owner upload

- [x] 7.1 Run `npm run build`, `npm run typecheck`, `npm test`, `npm run test:extension`, `gradlew.bat test buildPlugin verifyPlugin` (and `signPlugin` if configured), `npm run package:vsix`, and `openspec validate prepare-store-publication --strict`. Push to `main`, and confirm that CI passes on Windows, Ubuntu and macOS and that the Pages redeploy serves the store links. Record versions, counts, package file lists and sizes in `verification.md`.
- [ ] 7.2 Pause for the owner to upload `packages/vscode/walk-me-through-0.2.0.vsix` (Marketplace **Update**) and the 0.2.0 Rider ZIP (JetBrains **Upload Update** on plugin 35375). Verify with `vsce show pvrobays.walk-me-through` and the JetBrains plugin API that version 0.2.0 is listed (JetBrains may show it as pending review), and record the results.
- [ ] 7.3 Owner acceptance from the stores on native Windows, with clean profiles or after uninstalling the local builds:
  - install both viewers from the Marketplaces;
  - open a Git repository without the skill and see the offer; install the skill; restart OpenCode and publish a walkthrough;
  - open the walkthrough via the link in both IDEs;
  - confirm the listing pages show the README or description, the icon and the change notes;
  - exercise **Not for This Project** and **Don't Ask Again** in one IDE.

  Record the observations in `verification.md` and update the README and IMPLEMENTATION.md status without claiming Linux or macOS verification.

## Workflow follow-up

- Archive `add-shared-launcher` (complete or explicitly accept its task 7.3) before archiving this change.
- Release automation (CI publishing, Entra ID or token setup, GitHub Releases) is a later change.
- Archive this change with `/opsx-archive` after 7.3.
