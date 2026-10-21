# Spec Delta

## Purpose

Lets readers play progressive, source-backed walkthroughs in a local Rider project with the same reading and navigation semantics as the accepted VS Code player.

## ADDED Requirements

### Requirement: Explicit artifact selection
Rider SHALL offer **Walk Me Through: Open Walkthrough** with a newest-first picker showing title, ID, creation time, and project, plus Browse. It SHALL discover self-ignored artifacts in the current project's content roots and nested projects. Playback SHALL wait for explicit selection, never choose the latest automatically, and start at the overview.

#### Scenario: Choose among saved walkthroughs
- **WHEN** a project contains multiple artifacts, including one under a nested project's self-ignored directory
- **THEN** the picker lists them newest first and only the explicitly chosen artifact opens

#### Scenario: No discovered artifacts
- **WHEN** discovery finds no artifacts
- **THEN** Browse remains available with guidance to publish a walkthrough

### Requirement: Project-scoped session lifecycle
Each Rider project SHALL have at most one active walkthrough. Successful opening SHALL replace its previous presentation. Cancelled or invalid opening SHALL preserve an active session. Close Walkthrough and project disposal SHALL remove owned highlights, explanation surfaces, and session state without changing source files or affecting another project's session.

#### Scenario: Replace and close
- **WHEN** the reader opens a second valid walkthrough and then closes it
- **THEN** the first presentation is replaced and closing leaves no active playback presentation

#### Scenario: Invalid replacement or cancelled selection
- **WHEN** opening is cancelled or a selected artifact is invalid
- **THEN** the current walkthrough remains intact and invalid input produces a file-specific actionable error

#### Scenario: Projects remain independent
- **WHEN** walkthroughs are active in two Rider projects and one project closes
- **THEN** its playback resources are disposed and the other project's session remains intact

### Requirement: Hierarchical outline and step context
A Walk Me Through tool window SHALL show the title, overview, and up to four levels of steps. It SHALL mark the current entry, reveal its ancestors, and distinguish code/narrative and resolved anchor states. Step context SHALL include breadcrumb, title, position, and anchor state. Overview SHALL show the summary; narrative and stale steps SHALL show their explanation without inventing a source location.

#### Scenario: Enter a deep child
- **WHEN** a level-four step is selected
- **THEN** it becomes current, its ancestors expand, and its breadcrumb and position are visible

#### Scenario: Overview or narrative
- **WHEN** the reader enters the overview or a location-less step
- **THEN** its explanation is visible, the previous code presentation clears, and the editor is not navigated to a fabricated location

### Requirement: Stable depth-first traversal
Next and Previous SHALL traverse the stored depth-first sequence with overview before the first step. Collapse and prior skips SHALL NOT change this order. Boundaries and inactive invocation SHALL be no-ops without wrapping. Direct selection and Return to Current Step SHALL use the same normal display and resolution path as navigation.

#### Scenario: Collapsed children
- **WHEN** Next is invoked on a collapsed parent
- **THEN** its first child becomes current and its ancestors are revealed

#### Scenario: Return after browsing
- **WHEN** the reader explores another file and invokes Return to Current Step
- **THEN** the current step is re-resolved and its source and explanation are presented again

### Requirement: Explicit detail skipping
Skip Details SHALL move to the first subsequent step outside the current subtree, ascending to an ancestor's following branch when necessary. From overview it SHALL enter the first top-level step. Without a target it SHALL do nothing. Skipping SHALL NOT remove details, mark them complete, or make Previous history-based.

#### Scenario: Parent and ancestor exits
- **WHEN** A contains A1 with descendants followed by A2, and A is followed by B
- **THEN** Skip Details on A1 enters A2, on A enters B, and on A's final descendant enters B

#### Scenario: Previous after skipping
- **WHEN** the reader skips from A to B and invokes Previous
- **THEN** the final depth-first entry before B becomes current, rather than A

#### Scenario: Last branch with children
- **WHEN** the current top-level branch is last but contains children
- **THEN** Skip Details is unavailable while Next can still enter its first child

### Requirement: Discoverable accessible controls
Navigation SHALL be available through Rider Find Action, the walkthrough tool window, and controls beside the code explanation. Next, Previous, and Skip Details SHALL reflect target availability. Skip Details SHALL explain “Skip nested details and continue to the next available branch.” Controls SHALL remain keyboard accessible and usable in narrow layouts.

#### Scenario: Surface consistency
- **WHEN** the current step changes, playback is replaced, or playback closes
- **THEN** action and button availability updates without stale targets, and disabled direct invocation does not navigate

### Requirement: Persistent Markdown beside code
Exact, relocated, and uncertain code steps SHALL reveal and precisely highlight their resolved range with a persistent, read-only adjacent Markdown explanation and step controls. The explanation SHALL NOT require hover or a transient popup. Bold, italic, inline code, lists, and fenced code blocks SHALL render, including fenced-code syntax coloring. The Rider-native surface SHALL receive owner acceptance before full-player integration proceeds.

#### Scenario: Prototype acceptance
- **WHEN** the prototype is run on Rider 2026.2.3.1 on native Windows
- **THEN** the owner can inspect expression/multiline highlighting, rich Markdown, persistent adjacency, controls, scrolling, theme readability, and cleanup, and acceptance is recorded before integration

#### Scenario: Browse source while reading
- **WHEN** the reader interacts with the source editor
- **THEN** the explanation remains accessible without requiring hover and does not modify the source or provide a reply editor

### Requirement: Untrusted explanations
Author Markdown SHALL NOT execute scripts, IDE commands, or raw HTML, or load embedded remote resources. Only user-activated HTTP(S) links SHALL open through normal external-browser handling. The explanation SHALL NOT initiate network requests merely by being displayed.

#### Scenario: Active Markdown content
- **WHEN** an explanation contains HTML, script, a command/file/custom-scheme link, or a remote image
- **THEN** none executes, opens a local resource, or fetches remote content; ordinary emphasis and code still render

### Requirement: Anchor-state presentation
Exact and relocated steps SHALL use confident highlights, with relocation explained informationally. Uncertain steps SHALL use a dashed highlight and compact visible warning/icon explaining unconfirmed original location and closest identical code, including earlier-candidate choice for ties. Stale steps SHALL show red error-themed markers, missing-original-code wording, and original path/line, with no source highlight or adjacent code attachment.

#### Scenario: Uncertain tie
- **WHEN** resolution chooses an earlier equally near candidate
- **THEN** the explanation and step context visibly communicate uncertainty, nearest-identical fallback, and the tie, without relying solely on color or hover

#### Scenario: Stale transition
- **WHEN** the selected code no longer exists
- **THEN** the previous code attachment/highlight clears, the explanation remains in the tool window with stale context, and the editor is not navigated to the old line

### Requirement: Local Windows acceptance
The player SHALL run in local desktop Rider 2026.2.3.1 on native Windows without a model call, Node process, package download, companion service, or semantic backend during playback. Remote development hosts SHALL receive an actionable unsupported-environment message without starting playback. Non-Windows runtime acceptance is outside this change.

#### Scenario: Offline playback
- **WHEN** Rider has the development plugin installed and a saved artifact but no network or Node executable available
- **THEN** opening and navigating the walkthrough work locally

### Requirement: Shared authoring delivery
The shared skill and publisher SHALL explain how to open the returned title/ID in either Rider or VS Code. Successful replies SHALL retain the leading Walkthrough available section, ID/path, and normal answer at requested depth. Progressive top-level completeness and additive child evidence SHALL remain unchanged.

#### Scenario: Publish for either IDE
- **WHEN** the shared publisher saves a walkthrough
- **THEN** its opening guidance supports both players without requiring an IDE-specific artifact or manual encoding
