# Tasks

## 1. Rider delivery gate

- [x] 1.1 Add a minimal `walkmethrough` `jbProtocolCommand` to the Rider plugin that logs and notifies its target and its `e` parameter. Build the ZIP, install it into the owner's real Rider 2026.2.3.1, and invoke `jetbrains://rider/walkmethrough/open?e=<sample base64url>` from Edge/Chrome and from `Start-Process`, both with Rider running (one and two projects) and with Rider closed. Verify `verifyPlugin` reports no internal-API use for the EP. Record in `verification.md`: delivery, unchanged query, Toolbox prompts, cold-start behavior, and `idea.log` exposure.
- [x] 1.2 Pause for owner review of the 1.1 results. If delivery fails or the query is altered, revise the Rider mechanism in the artifacts with the owner before group 6. Record the decision.

## 2. Launch envelope core

- [x] 2.1 Implement `packages/core/src/launch.ts`: the pure base64url/UTF-8 codec, `buildEnvelope` (title shortening and dropping, size limit), `encodeEnvelope`, `decodeEnvelope` with the `malformed`/`too-long`/`unsupported-version`/`invalid` categories and field problems, and the launcher/VS Code/Rider URL builders. Verify with unit tests for each spec scenario: non-ASCII and supplementary-plane round-trip, padding and alphabet rejection, invalid UTF-8, unknown members, traversal ID, relative root, step/title limits, and the 1,536 boundary. `npm run typecheck` passes.
- [x] 2.2 Extend `scripts/conformance.ts` to generate `tests/conformance/launch-v1.json` (decode cases, builder cases, error categories), and document the regeneration command in `tests/conformance/README.md`. Verify that `npm run fixtures:check` passes, and that it fails with a drift message after a deliberate rule change.

## 3. Publisher and skill delivery

- [x] 3.1 Add the optional `url`, the link-first `open` wording, the `launch-link-too-long` warning, and the development-only `--launcher-url` (https or localhost) to the publisher and CLI. Verify with updated `publish`/`cli` tests: the URL decodes to the artifact's envelope, an oversized root keeps the artifact and drops `url`, an invalid `--launcher-url` is rejected, and existing fields are unchanged.
- [x] 3.2 Update `SKILL.md` and `references/walkthrough-format.md` for the link-first **Walkthrough available** block, verbatim URL copying, and the no-link fallback. Document the result field, the warning, and the development option. Run `npm run build`, then verify `reference.test.ts` and `npm run check:bundle` pass with the regenerated script and manifest.

## 4. Static launcher

- [x] 4.1 Create `packages/launcher` (`config.ts`, `model.ts`, `main.ts`) and hand-written `launcher/index.html` and `styles.css` per design D4. Add the esbuild step that generates the committed `launcher/launcher.js`. Verify with Vitest model tests (valid, missing, malformed, newer-version and oversized fragments; hrefs equal to the core builders; markup in the title kept as text), and with a static check for the CSP/referrer metas and same-origin assets only.
- [x] 4.2 Add a fresh-build drift check for `launcher/launcher.js` to `check:bundle`. Replace the no-launcher assertion in `scripts/check-workflows.mjs` with assertions that the launcher exists and that upload is limited to `launcher/`. Verify `npm test` passes, and that it fails when `launcher.js` is stale.
- [x] 4.3 Add `scripts/serve-launcher.mjs` (dependency-free localhost static server), and document local preview plus `--launcher-url` in the README. Manually verify in Edge: the rendered states, keyboard order, labels, light/dark, a narrow window, copy ID, the remembered preference without auto-launch, help/retry panels, and no outbound requests in DevTools. Record the results.
- [x] 4.4 Add README install sections for the VS Code VSIX and the Rider plugin ZIP (with the Toolbox/jetbrainsd prerequisite and the `vscode://` handler note), matching the `config.ts` help anchors. Verify each launcher help link resolves to the right README heading.

## 5. VS Code launch handling

- [x] 5.1 Refactor the picker into a shared `openArtifact(uri, {stepId})` path with no behavior change. Verify the existing extension-host tests pass.
- [x] 5.2 Add `onUri` activation and the URI handler per design D5: path and `e` checks, envelope decode, environment, kind and platform checks, canonical root matching, artifact lookup and ID check, step targeting, and notices. Verify with extension-host tests calling the handler on the fixture workspace: matching root, subfolder and multi-root containment, unrelated root (workspace unchanged), deleted or invalid artifact, ID mismatch, unknown or nested step, same artifact re-launch, malformed and newer-version envelopes, and platform mismatch. `npm run test:extension` passes.
- [x] 5.3 Document VS Code link behavior and limits (last-focused window, VS Code's confirmation prompt, no routing yet) in the README. Verify the documented steps against a manual launch through local preview in the Extension Development Host.

## 6. Rider launch handling

- [x] 6.1 Port the envelope decoder to Kotlin. Verify that Rider unit tests pass all `launch-v1.json` cases without Node.
- [x] 6.2 Refactor Rider opening into a shared open-artifact entry point with step selection. Implement the full protocol command per design D6: environment, kind and platform checks, canonical containment across base path and content roots, last-focused then latest-opened project choice, background load, EDT open/select, tool-window reveal, and project or application notices. Verify with platform tests: matching, no match, two matching projects, unknown step, deleted or invalid artifact, ID mismatch, malformed envelope, and the Linux refusal decision. `test buildPlugin verifyPlugin` passes on the exact target.
- [x] 6.3 Update `packages/rider/README.md` with the URI format, the Toolbox/jetbrainsd prerequisite, the observed cold-start behavior from 1.1, and the log exposure. Verify a manual launch through local preview into the installed real Rider plays a sample at its overview and at a nested step.

## 7. Deployment and integrated acceptance

- [x] 7.1 Run `npm run build`, `npm run typecheck`, `npm test`, `npm run test:extension`, the Rider `test buildPlugin verifyPlugin`, and `openspec validate add-shared-launcher --strict`. Record the actual versions, counts and results in `verification.md`.
- [x] 7.2 Pause for the owner to switch **Settings → Pages → Source → GitHub Actions** and to push or merge the launcher to `main`. Verify the Pages run deployed only `launcher/`, and that the live `https://pvrobays.github.io/walk-me-through/` page renders a published link. Update the README and IMPLEMENTATION.md Pages status.
- [ ] 7.3 Owner acceptance on native Windows: publish from OpenCode in Windows Terminal, click the real link, and open it in installed VS Code and in Rider. Cover: an older link after a newer publish; a wrong active VS Code window (notice, unchanged workspace); Rider with no matching project; uninstalled-viewer help and retry, followed by re-clicking the original link after install; and offline IDE playback. Record terminal clickability, link lengths, prompts and observations in `verification.md`, then update the README and IMPLEMENTATION.md status without claiming routing or publication.

## Workflow follow-up

- Apply in a separate request with `/opsx-apply add-shared-launcher`, and stop at tasks 1.2 and 7.2 for owner action.
- Finish `add-rider-playback` task 4.4 before or alongside group 6, because launch playback relies on its offline local-only behavior.
- Next in the agreed order: correct-window routing for each IDE, consuming the observations from 1.1, 5.3 and 7.3. Then onboarding, updates and distribution.
- Commit, archive, publish, and change settings only when the owner explicitly requests it.
