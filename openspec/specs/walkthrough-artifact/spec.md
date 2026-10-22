# walkthrough-artifact Specification

## Purpose
Defines the stored walkthrough artifact. It is an immutable, versioned, editor-independent record of an agent-authored explanation and its captured source anchors. Publishing produces it, and every player consumes it.

## Requirements

### Requirement: Versioned artifact identity
Every artifact SHALL record:
- `schemaVersion` 1.
- The generator name and bundle version.
- A generated walkthrough ID that is unique within the project.
- An ISO-8601 UTC creation timestamp.
- A title and a Markdown summary.

The walkthrough ID SHALL sort chronologically by creation time. It SHALL contain only characters that are safe in file names and URLs.

#### Scenario: Identity fields present
- **WHEN** a walkthrough is published
- **THEN** its artifact contains `schemaVersion` 1, the generator bundle version, a walkthrough ID, a creation timestamp, a title, and a summary

#### Scenario: Chronological identifiers
- **WHEN** two walkthroughs are published one after the other in the same project
- **THEN** the later walkthrough's ID sorts after the earlier one's

### Requirement: Flat step list with parent links
An artifact SHALL store its steps as a flat list in depth-first pre-order. Each step SHALL have:
- An ID that is unique within the artifact.
- An optional `parentId` referring to an earlier step.
- A title.
- A Markdown explanation.
- An optional evidence label: `observation`, `hypothesis`, or `conclusion`.

#### Scenario: Depth-first ordering
- **WHEN** an input contains step A with children A1 and A2, followed by step B
- **THEN** the artifact lists A, A1, A2, B in that order, and A1 and A2 have `parentId` set to A's ID

#### Scenario: Evidence label preserved
- **WHEN** an input step carries the evidence label `hypothesis`
- **THEN** the corresponding artifact step stores `hypothesis`

### Requirement: Hierarchy limits
Artifacts SHALL be limited to four levels, with top-level steps at level 1. Validation SHALL reject any of the following:
- A step deeper than level 4.
- A `parentId` that refers to a missing or later step.
- A cycle.
- A duplicate step ID.

#### Scenario: Four levels accepted
- **WHEN** an artifact contains a chain of steps four levels deep
- **THEN** validation accepts it

#### Scenario: Fifth level rejected
- **WHEN** an artifact contains a step at level 5
- **THEN** validation rejects the artifact and names the offending step

#### Scenario: Cycle rejected
- **WHEN** an artifact's `parentId` relationships form a cycle
- **THEN** validation rejects the artifact

### Requirement: Location rules
Some steps may omit a source location:
- A top-level step.
- A step that has children.

Every other step SHALL have a location. A location SHALL contain:
- A project-relative path with forward slashes, with no `..` segment or absolute prefix.
- A range.
- Captured anchor metadata.

#### Scenario: Narrative top-level step
- **WHEN** a top-level step without children has no location
- **THEN** validation accepts it

#### Scenario: Location-less grouping parent
- **WHEN** a level-2 step that has children has no location
- **THEN** validation accepts it

#### Scenario: Nested leaf without location
- **WHEN** a level-2 step without children has no location
- **THEN** validation rejects the artifact

#### Scenario: Escaping path rejected
- **WHEN** a location path is absolute or contains a `..` segment
- **THEN** validation rejects the artifact

### Requirement: Checkout and environment metadata
An artifact SHALL record the absolute project root and the execution environment it was generated in. The environment includes its kind and platform. Git commit and working-tree dirty state SHALL be recorded when available, and SHALL be null when git or a repository is unavailable.

#### Scenario: Git available
- **WHEN** publishing in a git repository with uncommitted changes
- **THEN** the artifact records the HEAD commit and a dirty state of true

#### Scenario: Git unavailable
- **WHEN** publishing in a project that is not a git repository
- **THEN** publishing succeeds and the artifact's git metadata is null

### Requirement: Local artifact storage
Artifacts SHALL be stored at `<project-root>/.walk-me-through/walkthroughs/<walkthrough-id>.json`. That directory tree SHALL be excluded from Git by `<project-root>/.walk-me-through/.gitignore`, which contains `*`. The project's own top-level `.gitignore` SHALL NOT be modified.

#### Scenario: First publish creates ignore file
- **WHEN** the first walkthrough is published in a project
- **THEN** `.walk-me-through/.gitignore` exists containing `*`, and `git status` shows no `.walk-me-through/` entries

#### Scenario: Top-level ignore untouched
- **WHEN** a walkthrough is published in a project that has a top-level `.gitignore`
- **THEN** that file's content is unchanged

### Requirement: Immutable artifacts
A published artifact SHALL be written atomically and SHALL never be overwritten by later publishing. Opening an older artifact SHALL show that artifact's own content, never the newest walkthrough's.

#### Scenario: Older walkthrough remains
- **WHEN** a second walkthrough is published after a first
- **THEN** both artifact files exist, and the first file's content is unchanged

### Requirement: Artifact schema validation on load
Players SHALL validate an artifact before playing it. They SHALL reject:
- An unsupported `schemaVersion`, with a message that asks the user to update the viewer.
- Malformed JSON.
- Content that breaks the structure, hierarchy, location, or range rules.

#### Scenario: Unsupported version
- **WHEN** an artifact declares `schemaVersion` 2
- **THEN** the player refuses to open it and asks the user to update the viewer

#### Scenario: Malformed range
- **WHEN** an artifact range ends before it starts
- **THEN** the player refuses to open it and reports the invalid step
