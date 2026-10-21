# Spec Delta

## Purpose

Defines how the Walk Me Through VS Code extension plays a walkthrough in the current window. Explanations are shown as Markdown beside highlighted source, steps are nested, and each step's anchor state is always visible.

## ADDED Requirements

### Requirement: Open walkthrough command
The extension SHALL provide a **Walk Me Through: Open Walkthrough** command. Without an argument, it SHALL:
- List the artifacts found under any `.walk-me-through/walkthroughs/` directory in the open workspace folders.
- Sort them newest first, each showing its title, creation time, and project.
- Offer an option to browse for an artifact file.

When given an artifact path, the command SHALL open that artifact directly.

#### Scenario: Choose from list
- **WHEN** the user runs the command in a workspace containing two artifacts
- **THEN** a picker lists both, newest first, and selecting one starts playback

#### Scenario: Open by path
- **WHEN** the command is invoked programmatically with an artifact path
- **THEN** playback of that artifact starts without a picker

#### Scenario: No artifacts
- **WHEN** no artifacts exist in the workspace
- **THEN** the picker offers only the browse option and explains how walkthroughs are created

### Requirement: Source paths resolved against artifact project
Source paths SHALL be resolved against the project root that contains the artifact's `.walk-me-through/` directory. If that directory differs from the artifact's recorded project root, the player SHALL show a visible warning naming both paths, and SHALL still play the walkthrough. Project roots that are subfolders of a workspace folder, or that belong to a multi-root workspace, SHALL be supported.

#### Scenario: Project in a workspace subfolder
- **WHEN** the workspace folder is `C:\repo`, and the artifact lives in `C:\repo\service\.walk-me-through\walkthroughs\`
- **THEN** source paths resolve against `C:\repo\service`

#### Scenario: Moved checkout
- **WHEN** the artifact's recorded root differs from the directory containing it
- **THEN** playback starts and shows a warning naming both paths

### Requirement: Single active walkthrough
At most one walkthrough SHALL be active per window. Opening another walkthrough SHALL replace the active one. A **Close Walkthrough** command SHALL remove all of the player's comment threads, highlights, and view content.

#### Scenario: Replace active
- **WHEN** a second walkthrough is opened while one is playing
- **THEN** only the second walkthrough's threads and highlights remain

#### Scenario: Close
- **WHEN** the user runs Close Walkthrough
- **THEN** no player threads or highlights remain, and the views show an empty state

### Requirement: Nested steps tree
A Steps view SHALL show:
- The walkthrough title.
- An overview entry.
- All steps in their hierarchy, up to four levels.

Each entry SHALL indicate whether the step is a code step or a narrative step, and SHALL show its anchor state once resolved. The current step SHALL be marked and revealed, with its ancestors expanded. Selecting an entry SHALL navigate to that step. Collapsing an entry SHALL NOT remove its steps from Previous/Next order.

#### Scenario: Direct selection
- **WHEN** the user selects a level-3 step in the tree
- **THEN** that step becomes current, and its ancestors are expanded

#### Scenario: Collapsed subtree
- **WHEN** the user collapses a parent and then presses Next from that parent
- **THEN** navigation moves to the parent's first child

### Requirement: Depth-first navigation
Next and Previous SHALL follow the artifact's depth-first pre-order. These commands SHALL be available from:
- The Command Palette.
- The comment thread title.
- The Step view.

Next on the last step and Previous on the first step SHALL do nothing and SHALL NOT wrap around. A **Return to Current Step** command SHALL reveal the current step again.

#### Scenario: Next enters children
- **WHEN** the current step has children and the user presses Next
- **THEN** its first child becomes current

#### Scenario: Previous reverses
- **WHEN** the user presses Next and then Previous
- **THEN** the original step is current again

#### Scenario: Return after exploring
- **WHEN** the user navigates to other files and then runs Return to Current Step
- **THEN** the current step's source and explanation are revealed again

### Requirement: Markdown explanation beside code
For a code step whose state is exact, relocated, or uncertain, the player SHALL:
- Open the file.
- Reveal the resolved range.
- Show a read-only comment thread on that range.

The thread SHALL contain the step title, its position in the walkthrough, and the explanation rendered as Markdown. Bold, italic, inline code, lists, and fenced code blocks SHALL render.

#### Scenario: Rich explanation
- **WHEN** a step explanation contains `**bold**`, `` `code` ``, a bullet list, and a fenced code block
- **THEN** the comment shows bold text, inline code, a list, and a code block rather than raw Markdown symbols

#### Scenario: No reply box
- **WHEN** the thread is shown
- **THEN** the user cannot reply to it or add comments through the player

### Requirement: Untrusted Markdown
Rendered explanations SHALL NOT execute commands or scripts. Command links SHALL be disabled, raw HTML SHALL NOT be rendered, and links SHALL open only through VS Code's normal external link handling.

#### Scenario: Command link in explanation
- **WHEN** an explanation contains a `command:` link
- **THEN** activating it runs no command

#### Scenario: HTML in explanation
- **WHEN** an explanation contains a `<script>` or `<img onerror>` tag
- **THEN** the tag is not rendered or executed

### Requirement: Narrative and stale step surface
A Step view SHALL always show:
- The current step's breadcrumb, title, and position.
- Its anchor state.
- Previous and Next controls.

The Step view SHALL also render the Markdown explanation for:
- The walkthrough overview (the summary).
- Steps without a location.
- Stale code steps.

Narrative steps SHALL NOT be attached to an invented source position.

#### Scenario: Narrative step
- **WHEN** the current step has no location
- **THEN** its explanation appears in the Step view, no comment thread is created, and the active editor is unchanged

#### Scenario: Overview
- **WHEN** a walkthrough is opened
- **THEN** the overview is current, and its summary is shown in the Step view

### Requirement: Precise highlight
The resolved range SHALL be highlighted exactly, from its start character to its end character, using a themeable decoration. Uncertain matches SHALL use a decoration that is visually distinct from exact and relocated ones. Moving to another step, or closing the walkthrough, SHALL remove the previous highlight.

#### Scenario: Expression highlight
- **WHEN** a step's range covers part of a line
- **THEN** only those characters are highlighted, not the whole line

#### Scenario: Multiline highlight
- **WHEN** a step's range spans several lines
- **THEN** the highlight starts and ends at the stored characters on the first and last lines

### Requirement: Visible anchor states
The player SHALL show each step's resolved state:
- **Exact:** no warning.
- **Relocated:** an informational note that the code moved.
- **Uncertain:** a prominent warning that the original location could not be identified confidently and that the closest identical code is shown. If candidates were tied, the warning SHALL say so.

Anchors SHALL be resolved again each time a step becomes current.

#### Scenario: Uncertain warning
- **WHEN** a step resolves as uncertain
- **THEN** both the comment thread and the Step view show the uncertain-location warning, and the highlight uses the uncertain style

#### Scenario: Relocated note
- **WHEN** a step resolves as relocated
- **THEN** the comment thread shows a note that the code moved, and the highlight uses the confident style

### Requirement: Stale step presentation
A stale step SHALL have no highlight and SHALL NOT navigate to its old line. The Step view SHALL show a stale banner with the original path and line for reference, together with the step's explanation.

#### Scenario: Stale step
- **WHEN** a step resolves as stale
- **THEN** no editor is opened at its old line, no highlight or comment is shown, and the Step view shows the stale banner and explanation

### Requirement: Invalid artifact feedback
When an artifact fails validation, the player SHALL show an error naming the file and the first problems found. No partial playback SHALL be started.

#### Scenario: Fifth-level artifact
- **WHEN** the user opens an artifact containing a level-5 step
- **THEN** an error is shown, and no walkthrough becomes active

### Requirement: Unsupported environment notice
When the extension runs in a remote extension host, such as WSL, SSH, or a container, Open Walkthrough SHALL explain that the MVP supports desktop VS Code on native Windows only. It SHALL NOT start playback.

#### Scenario: Remote window
- **WHEN** Open Walkthrough runs in a WSL remote window
- **THEN** an unsupported-environment message is shown, and no walkthrough becomes active

### Requirement: Local playback only
Playback SHALL NOT call any model, network service, companion process, or MCP server, and SHALL NOT require a package download.

#### Scenario: Offline playback
- **WHEN** the machine has no network connection
- **THEN** a walkthrough opens and navigates normally
