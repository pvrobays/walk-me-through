# Rider development

Independent Kotlin/JVM plugin project; npm builds do not build or download Rider.

## Exact target

Inspected on native Windows on 2026-10-21:

- Rider **2026.2.3.1**, product code **RD**, build **262.10968.170** (`product-info.json`).
- Minimum Java **25** in product metadata; bundled **JBR 25.0.4+1-b508.27**, x86_64 Windows (`jbr/release` and `java -version`).
- Gradle **9.1.0**, IntelliJ Platform Gradle plugin **2.19.0**, Kotlin **2.3.21** are pinned. The wrapper checks the distribution SHA-256. Wrapper JAR SHA-256: `76805e32c009c0cf0dd5d206bddc9fb22ea42e84db904b764f3047de095493f3` (Gradle's published checksum).
- The descriptor declares compatibility from build **262** with no upper bound. Compilation and tests use the installed Rider; Plugin Verifier also checks the latest released Rider (see Packaging). Native Linux and macOS are accepted but not verified by the maintainers, and have no Rider CI.

## Windows build, sandbox, and install

From `packages/rider`, set developer-local paths in the current PowerShell session:

```powershell
$env:RIDER_HOME = '<your Rider installation directory>'
$env:JAVA_HOME = Join-Path $env:RIDER_HOME 'jbr'
.\gradlew.bat buildPlugin
.\gradlew.bat test
.\gradlew.bat verifyPlugin
.\gradlew.bat runIde
```

`RIDER_HOME` must contain `product-info.json`. Alternatively pass `-PriderPath="<installation>"` or put `riderPath=C:/path/to/Rider` in ignored `local.properties`. Never commit machine paths. Use the bundled JBR, rather than the shell's default Java. Development dependencies require network access on the first build.

`runIde` uses Gradle's separate sandbox under `.intellijPlatform/sandbox/walk-me-through-rider/RD-2026.2.3.1/` (separate `config_runIde`, `system_runIde`, `plugins_runIde`, and `log_runIde`); it does not install the plugin into the normal Rider profile. Open a project there and select **View → Tool Windows → Walk Me Through**.

If Rider's **Restart** closes the development sandbox without reopening it, rerun `.\gradlew.bat runIde` from the same configured PowerShell session. The sandbox profile, including registry changes, persists between launches.

For a normal-profile manual installation, build the ZIP under `build/distributions/`, then use Rider **Settings → Plugins → gear → Install Plugin from Disk**, select that ZIP, and restart if requested.

## Bootstrap verification

On 2026-10-21, `gradlew.bat buildPlugin --console=plain` passed (11 executed tasks). The first dependency-populating invocation exceeded the terminal timeout; the follow-up completed successfully. `gradlew.bat runIde --console=plain` launched the exact target in the isolated sandbox and exited successfully after Rider closed. Its `idea.log` records build RD-262.10968.170, JRE 25.0.4+1-b508.27, and **Loaded custom plugins: Walk Me Through (0.1.0-prototype)**. Platform startup warnings occurred (module/service overrides and missing optional crossgen cache); no ERROR entries were found in that run's log. This verifies bootstrap/launch, not visual prototype acceptance.

Owner acceptance of the early docked prototype was required before full-player integration; it was given on 2026-10-21 (below).

## Early prototype check (historical owner checkpoint, 2026-10-21)

`gradlew.bat test buildPlugin --console=plain` passes with 6 tests (0 failures/errors): four renderer/policy tests and two registered-handler tests using mocked CEF objects (Mockito 5.20.0, test-only). These check escaped HTML, unsafe URL/image filtering, user-gesture HTTP(S) dispatch, resource/popup cancellation, and packaged highlighting/CSP. Actual rendered appearance and browser interaction require the sandbox check below.

1. In the sandbox open a project and **View → Tool Windows → Walk Me Through**. Confirm the persistent panel shows bold, italic, inline code, lists, and a syntax-colored C# block.
2. Select a source expression, click **Highlight selection**, then click in the editor so ordinary selection coloring no longer masks the prototype highlight. Repeat with a multiline range; exclusive endpoints should match the selection exactly.
3. Click **Next** for the compact uncertainty warning/dotted highlight, then **Next** for red stale context with no highlight. **Previous** cycles back through the samples. These are presentation samples, not artifact navigation or anchor resolution.
4. Browse another source file and try **Return** while a highlight is active. Confirm the explanation stays visible while editing and browsing.
5. Narrow the panel, scroll its content, and use Tab/Shift+Tab, Space/Enter, and button mnemonics. Check light, dark, and an accessible/high-contrast theme.
6. Click the documentation link: it should open in the external browser. **Close** should clear explanation/highlight; **Show sample** restores Markdown. Close the project to exercise owned disposal.

The owner accepted this docked surface on 2026-10-21, reporting that all presented checks worked flawlessly, and subsequently confirmed the unsupported-JCEF message after disabling JCEF and relaunching the sandbox. Observations are recorded in the change's `verification.md`; tasks 1.1–1.3 are complete.

To repeat the unsupported-JCEF check in the isolated sandbox only, use **Find Action → Registry**, turn off `ide.browser.jcef.enabled`, restart the sandbox, then open the tool window. Confirm that it displays the JCEF/runtime guidance without crashing. Restore the registry option and restart afterward. Keep the bundled Web Browser plugin enabled so the required plugin dependency remains satisfied.

## Playback contracts

The project session starts at overview. Next/Previous follow the stored depth-first order, including collapsed children. Skip Details enters the first subsequent step outside the current subtree (or the first step from overview), ascending to an ancestor's following branch as necessary. It never changes traversal history: Previous after skipping enters the preceding stored step, including skipped details. Final branches have no Skip target even when Next can enter their children. Inactive/boundary calls do nothing. Direct selection and Return share the ordinary refresh path. Each project owns a separate session.

Shared fixture commands are documented in `../../tests/conformance/README.md`. `gradlew.bat test` consumes committed fixtures directly without Node.

Platform tests use a real Rider folder solution via `SolutionManager.openSolution`, wait for Rider startup on EDT, attach an existing-project code-insight fixture, and close that project afterward. This test-only backend lifecycle uses the installed Rider distribution and requires its backend runtime; playback remains frontend-only. Gradle resolves platform test framework 262.10968.165 and Rider test framework 262.10968.136 for target RD-262.10968.170. Run just these checks with `gradlew.bat test --tests '*PlayerPlatformTest' --console=plain`. The harness disables `patch.engine.backend.freeze.timeout` inside its test process, as Rider requires for deterministic tests. Nine platform tests passed after synchronization/cleanup repairs; see the change's verification record.

### Open saved artifacts

Use **Find Action → Walk Me Through: Open Walkthrough** and explicitly choose a title/ID. Discovery runs in a cancellable background task under project base/content roots, including nested projects and self-ignored `.walk-me-through/walkthroughs/*.json`. Entries show title, ID, timestamp and containing project, newest first. Dependency/generated directories and directory links are skipped. Browse remains available for external or excluded artifacts and empty discovery. Cancel the picker/Browse to retain the current session.

Browse requires `<project>/.walk-me-through/walkthroughs/*.json`. That containing project is the source root; moved roots generate a warning naming recorded/current roots. Source paths must be relative forward-slash paths without traversal, and resolved links must stay inside the containing root. Invalid artifacts fail with file/field details before replacing a session.

### Reading paths and source states

Use **Skip Details** for the concise complete top-level account; use **Next** for the full depth-first reading path. The outline permits direct selection at any of four levels and reveals current-step ancestors. **Return** reopens/re-resolves the current step after source exploration. Every navigation action is available through Find Action and the native controls above the explanation.

Matching refreshes on step entry and Return, using current unsaved documents without saving. It strips only a leading BOM and normalizes line endings. Identical original context is exact; unique identical context elsewhere is relocated. Lost/ambiguous context uses closest identical code with a visible warning and dotted highlight, with explicit earlier-candidate wording on ties. Distance compares lines, then UTF-16 columns, then earlier offset. There is no fuzzy, semantic or old-line fallback. Missing/changed/unreadable code retains its explanation and original path/line in red stale context, without navigating. Close clears session/highlight and disposes the explanation browser; project disposal also removes listeners/jobs.

## Project skill

The plugin jar ships the four skill files under `skill/` (copied from `../skill` by `processResources`, so build the skill with `npm run build` first).

- **Walk Me Through: Install Skill into Project** (Find Action, action `WalkMeThrough.InstallSkill`) copies them into `.agents/skills/walk-me-through/` under the nearest ancestor of the project's base path or content root that has a `.git` directory or file (or under that folder when there is none). With several targets you choose one. It creates only missing files; if any existing file differs after BOM and line-ending normalization, it writes nothing and names the differing files. Remote and headless IDEs are refused with the local-desktop message.
- **Offer:** after a Git project without `SKILL.md` opens, a `Walk Me Through` notification offers **Install**, **Not for This Project** and **Don't Ask Again**, once per project per session. Choices are stored at application level in `PropertiesComponent` (`walkMeThrough.skillOffer.dismissedRoots`, `walkMeThrough.skillOffer.never`, in the IDE's `options/other.xml`), never in the project.
- **Banner:** whenever the Walk Me Through tool window is shown and the skill is missing, a warning banner at its top says the AI agent can't create walkthroughs there and offers **Install Skill**. It ignores both dismissals, which is how users get back after dismissing the offer; there is no reset action.
- The shared cases in `../../tests/conformance/skill-install.json` keep this installer aligned with VS Code (`SkillInstallerTest`).

## Optional author signing

`buildPlugin` always produces the unsigned ZIP. `signPlugin` (and `verifyPluginSignature`, which checks its output) run only when all three of `CERTIFICATE_CHAIN`, `PRIVATE_KEY` and `PRIVATE_KEY_PASSWORD` are set, or the Gradle properties `certificateChain`, `privateKey` and `privateKeyPassword`. Otherwise they are skipped.

Create the key and a self-signed certificate **outside this repository**, for example in a folder under your user profile (`*.pem`, `*.crt` and `*.key` under `packages/rider/` are gitignored only as a safety net):

```powershell
openssl genpkey -aes-256-cbc -algorithm RSA -out private_encrypted.pem -pkeyopt rsa_keygen_bits:4096
openssl rsa -in private_encrypted.pem -out private.pem
openssl req -key private.pem -new -x509 -days 365 -out chain.crt
```

Then, in the PowerShell session that builds the plugin (from `packages/rider`, with `RIDER_HOME` and `JAVA_HOME` set as above):

```powershell
$env:CERTIFICATE_CHAIN = Get-Content -Raw '<folder>\chain.crt'
$env:PRIVATE_KEY = Get-Content -Raw '<folder>\private.pem'
$env:PRIVATE_KEY_PASSWORD = '<the password you chose for private_encrypted.pem>'
.\gradlew.bat signPlugin verifyPluginSignature
Remove-Item Env:CERTIFICATE_CHAIN, Env:PRIVATE_KEY, Env:PRIVATE_KEY_PASSWORD
```

The signed ZIP is `build/distributions/walk-me-through-rider-<version>-signed.zip`. Keep the key and password private; JetBrains Marketplace also signs uploaded plugins itself.

## Launch links

The plugin handles the launcher page's **Open in Rider** choice through the platform's `com.intellij.jbProtocolCommand` extension point (`LaunchProtocolCommand`, command `walkmethrough`):

```text
jetbrains://rider/walkmethrough/open?e=<envelope>
```

`rider` is the Toolbox/jetbrainsd product tag, `walkmethrough` is the command, and `open` is the target. `e` is the unpadded base64url v1 launch envelope, at most 1,536 characters (see `../../tests/conformance/README.md`).

- **Prerequisite:** `jetbrains://` URLs are delivered by **JetBrains Toolbox** through its `jetbrainsd` handler (registered on Windows as `%LOCALAPPDATA%\JetBrains\Daemon\…\jetbrainsd.exe handleUri "%1"`). The plugin registers no OS URL scheme of its own. Without Toolbox, the browser has nothing to open.
- **Matching:** the command plays the walkthrough only in an already-open project whose base path or content root equals or contains the envelope root. Paths are compared as canonical real paths, case-insensitively on Windows. If several projects match, it uses the last-focused one, or else the most recently opened one. Without a match, an application notification names the root and asks you to open that checkout and retry. The command never opens a project.
- **Playback:** the plugin loads only `<root>/.walk-me-through/walkthroughs/<id>.json`, validates it with the normal artifact rules, and requires the IDs to match. It then replaces the active walkthrough exactly as **Open Walkthrough** would, reveals the tool window, and goes to the requested step (or shows the overview with a notice when the step is unknown). Invalid links, unsupported environments (remote, headless, SSH, WSL) and links published on another platform get notices and leave the session unchanged.
- **Cold start (observed 2026-10-21 with Rider 2026.2.3.1 and Toolbox):** with Rider closed, the link starts Rider on the welcome/project-selection screen. The command runs about 0.6 s after startup, before any project is open, so it shows the open-and-retry notice there. jetbrainsd showed no prompt or IDE picker. With Rider running, the link reached the running instance unchanged, with one or two projects open.
- **Log exposure:** the platform logs every external URI at INFO level, including the envelope and therefore the local project root. In `idea.log` it appears as `CommandLineProcessor - external URI request:`, and at cold start also as `AppStarter - args:`. The plugin does not log the envelope again.

## Packaging, prerequisites, and dependencies

The ZIP is `build/distributions/walk-me-through-rider-<version>.zip` (0.2.0 now); it is the JetBrains Marketplace upload for plugin 35375 and contains `LICENSE`, `THIRD-PARTY-NOTICES.txt` and `lib/`. The vendor is `pvrobays`; the description and change notes come from `marketplace/description.html` and `marketplace/change-notes.html`. The integrated player is owner-accepted on native Windows Rider 2026.2.3.1; explicit offline verification is pending. Native Linux and macOS are accepted but not verified by the maintainers. Local desktop playback uses JVM code and bundled renderer assets, with no Node/model/companion or package download. Remote/headless hosts receive local-desktop setup guidance. Enable Rider's bundled **Web Browser (JCEF)** and run its bundled JBR; if the earlier unsupported-renderer test disabled `ide.browser.jcef.enabled`, restore it and relaunch.

| Component | Pinned version | License / role |
| --- | --- | --- |
| Gradle | 9.1.0 | Apache-2.0; development wrapper/distribution |
| IntelliJ Platform Gradle plugin | 2.19.0 | Apache-2.0; development |
| Kotlin JVM plugin | 2.3.21 | Apache-2.0; development, IDE supplies runtime |
| CommonMark Java | 0.24.0 | BSD-2-Clause; bundled Markdown parser |
| Gson | 2.13.2 | Apache-2.0; bundled JSON parser |
| highlight.js | 11.11.1 | BSD-3-Clause; bundled asset/license in `src/main/resources/renderer` |
| JUnit | 4.13.2 | EPL-1.0; tests only |
| Mockito | 5.20.0 | MIT; tests only |
| IntelliJ Plugin Verifier | 1.411 | Apache-2.0; development |

Rider/JBR/JCEF and their bundled dependencies retain JetBrains/upstream licenses in the installed distribution. The plugin uses those IDE APIs without redistributing Rider. Framework builds resolved for tests are recorded above. Maven dependencies include their upstream license metadata/notices.

Observed Windows commands on 2026-10-21: `test buildPlugin verifyPlugin --console=plain` passed, 32 tests (23 unit/conformance/handler, 9 real solution-backed platform). Verifier 1.411 reports compatible against installed RD-262.10968.170 with no blocking problems; five deprecated and six experimental API usages remain advisory, including Kotlin-generated ToolWindowFactory interface bridges and ReadAction.compute. Since 0.2.0 the descriptor is open-ended from build 262, and `verifyPlugin` also checks the latest released Rider (`select`), downloaded into the Gradle cache on first use. Reports: `build/reports/pluginVerifier/RD-262.10968.170/`.

## Integrated owner acceptance

The owner accepted the integrated player on 2026-10-21, reporting “all looks good in rider and vscode” in response to this checklist. Explicit offline-playback confirmation remains pending; see the change's `verification.md`.

Publish the sample from the repository root using the README command. Open the same `examples/sample-project` folder and exact returned title/ID in both Rider sandbox and VS Code Development Host. Confirm overview and both concise/full paths, all Find Action/native navigation controls and boundaries, collapsed-parent child reveal, Return after browsing, precise expression/multiline highlights, persistent rich Markdown/code coloring, narrow controls, themes, replacement/Close and separate-project cleanup. Re-enter or Return after unsaved edits above/around/inside the selection to observe relocated, uncertain/tied and red stale states; discard edits afterward.

Also publish/open a small scratch C# selection with the shared publisher to cover Rider's primary editing context. With a saved artifact available, disconnect network temporarily using your usual controls and open/navigate in Rider; confirm playback works and requires no Node launch. Restore connectivity afterward. Report actual observations and explicit acceptance; these checks are not inferred from automated tests.
