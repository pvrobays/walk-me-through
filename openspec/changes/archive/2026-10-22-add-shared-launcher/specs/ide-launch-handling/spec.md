# Spec Delta

## Purpose

Specifies how the VS Code extension and the Rider plugin receive launcher URIs, validate them against the local environment and open checkout, and play the identified saved walkthrough. Window routing is out of scope.

## ADDED Requirements

### Requirement: IDE entry points
The VS Code extension SHALL handle `vscode://pvrobays.walk-me-through/open?e=<envelope>` and SHALL activate on demand to do so. The Rider plugin SHALL handle a documented `jetbrains://rider/...` protocol command carrying `e=<envelope>`, delivered by the JetBrains URL handler, and SHALL NOT register operating-system URL schemes itself. Other paths or a missing `e` SHALL produce an invalid-link notice.

#### Scenario: VS Code not yet activated
- **WHEN** VS Code receives a valid launch URI before the extension has activated
- **THEN** the extension activates and handles that URI

#### Scenario: Rider command delivered
- **WHEN** jetbrainsd/Toolbox delivers the documented Rider URI to a running Rider with the plugin installed
- **THEN** the plugin's command receives the envelope unchanged

#### Scenario: Unknown path
- **WHEN** the extension receives `vscode://pvrobays.walk-me-through/other`
- **THEN** it shows an invalid-link notice and changes no session

### Requirement: Envelope and environment validation
Receivers SHALL decode and validate the envelope with the v1 rules. They SHALL refuse it, with an actionable notice, when the receiving IDE is in an unsupported environment, when `env.kind` is not `local`, or when `env.platform` differs from the receiver's platform. Refusal SHALL leave the current session unchanged.

#### Scenario: Malformed link
- **WHEN** the envelope is malformed or has an unsupported version
- **THEN** the IDE shows a notice that the link is invalid or needs a newer viewer, and no session changes

#### Scenario: Remote or mismatched environment
- **WHEN** a valid envelope reaches a remote/WSL VS Code window, or its platform is `linux` while the receiver runs on Windows
- **THEN** playback is refused with the existing unsupported-environment guidance

#### Scenario: Rider on Linux
- **WHEN** a Rider launch command arrives on native Linux
- **THEN** the plugin applies its existing Windows-only refusal

### Requirement: Exact checkout match without routing
A receiver SHALL play only if an open VS Code workspace folder, or a Rider project base path or content root, equals or contains the envelope `root`. Comparison SHALL use canonical real paths, case-insensitively on Windows. Without a match, the receiver SHALL show a notice naming the root and asking the reader to open that checkout and retry, and SHALL NOT open, replace, or reload workspaces or projects.

#### Scenario: Matching window
- **WHEN** VS Code's receiving window has the recorded root open as a folder, as a multi-root folder, or inside a larger opened folder
- **THEN** that window plays the walkthrough

#### Scenario: Wrong window receives the link
- **WHEN** the receiving VS Code window has an unrelated repository open
- **THEN** it shows the open-and-retry notice with the recorded root, and its workspace is unchanged

#### Scenario: Different checkout of the same repository
- **WHEN** the open folder is another clone or worktree with the same remote but a different path
- **THEN** it does not match

#### Scenario: Rider with several projects
- **WHEN** several open Rider projects contain the root
- **THEN** the last-focused matching project plays the walkthrough, or the most recently opened one if none of them was focused

#### Scenario: Rider without a matching project
- **WHEN** no open Rider project contains the root, including when Rider was started by the link with no project open
- **THEN** Rider shows the open-and-retry notice and opens no project

### Requirement: Artifact identification
Receivers SHALL load only `<root>/.walk-me-through/walkthroughs/<id>.json`. They SHALL validate it with the existing v1 artifact rules and the existing safe-source-access rules, and SHALL require that its ID equals the envelope `id`. They SHALL NOT fall back to another or newest artifact.

#### Scenario: Older link
- **WHEN** a link for an older artifact is opened after newer artifacts were published
- **THEN** the older artifact is played

#### Scenario: Deleted artifact
- **WHEN** the artifact file no longer exists
- **THEN** a notice explains that the saved walkthrough was removed and gives its expected path, and the session is unchanged

#### Scenario: Invalid artifact
- **WHEN** the file fails artifact validation or its ID differs from the envelope
- **THEN** the same artifact errors the picker shows are reported, and the session is unchanged

### Requirement: Playback at requested position
A valid launch SHALL replace the active walkthrough in the matching window or project, exactly as an explicit picker open does, and SHALL reveal the player. With a known `step`, it SHALL go to that step and reveal its ancestors. Otherwise it SHALL start at the overview.

#### Scenario: Step-targeted link
- **WHEN** the envelope names a nested step that exists
- **THEN** playback opens at that step, with its ancestors expanded and its source or explanation shown under the normal anchor-state rules

#### Scenario: Unknown step
- **WHEN** the envelope names a step the artifact does not contain
- **THEN** playback opens at the overview with a notice that the requested step was not found

#### Scenario: Same artifact already open
- **WHEN** the link targets the artifact that is already active
- **THEN** the session is reloaded at the requested step or overview, without duplicate panels

### Requirement: Local-only, read-only handling
Launch handling SHALL be read-only toward project files and SHALL require no Node, model call, network access, companion process, or MCP server. It SHALL NOT execute or open anything named by the envelope other than the identified artifact and its validated source paths.

#### Scenario: Offline launch
- **WHEN** the machine is offline after the launcher page has loaded
- **THEN** choosing an IDE still plays a matching saved walkthrough

#### Scenario: Hostile envelope
- **WHEN** a third-party page sends a crafted envelope with an existing root but a forged ID or title
- **THEN** the receiver either plays the artifact that genuinely exists under the open root's walkthrough directory or shows a notice, and it modifies no files
