# Spec Delta

## Purpose

Preserves the existing editor-independent walkthrough format and anchor behavior when the same published artifact is played in Rider or VS Code.

## ADDED Requirements

### Requirement: Existing artifact compatibility
Rider SHALL accept valid existing schemaVersion 1 artifacts without regeneration, retaining generator metadata, step IDs/order, parent links, explanations, evidence labels, and captured anchors. It SHALL reject unsupported versions and malformed structures before playback, including duplicate IDs, invalid parents, non-depth-first order, fifth-level nesting, invalid ranges/anchors, and nested leaves without locations.

#### Scenario: One artifact in both players
- **WHEN** an artifact produced by the existing shared publisher is opened in Rider and VS Code
- **THEN** both expose the same overview, step sequence, hierarchy, explanations, and source selections without modifying the artifact

#### Scenario: Invalid hierarchy or anchors
- **WHEN** the reader opens an artifact with a cycle, forward parent, fifth level, or inconsistent selection dimensions
- **THEN** Rider reports the file and validation problem, starts no partial playback, and preserves any active valid session

### Requirement: Artifact-derived project root
Source paths SHALL resolve relative to the project containing the selected `.walk-me-through/walkthroughs/` directory, including nested projects and additional content roots. Browse SHALL require this layout. If the canonical root differs from the recorded root, Rider SHALL visibly name both and play from the containing root. Source paths SHALL NOT escape that root through path segments or resolved links.

#### Scenario: Moved checkout
- **WHEN** an artifact has been moved with its project to a different root
- **THEN** Rider warns with recorded and current roots and resolves source inside the current containing project

#### Scenario: Unsafe source reference
- **WHEN** a source path is absolute, contains traversal, or resolves through a link outside the containing root
- **THEN** Rider does not open or highlight the outside file and reports the source-resolution problem

### Requirement: Coordinates and normalized text
Rider SHALL interpret stored positions as zero-based UTF-16 lines/characters with exclusive ends. Anchor matching SHALL strip a leading BOM and normalize CRLF/lone CR to LF while preserving all other whitespace. Mapping to the editor SHALL preserve the selected characters, including tabs, supplementary Unicode, expressions, and multiline boundaries.

#### Scenario: Unicode and line endings
- **WHEN** an artifact selects an expression after a supplementary Unicode character or tab in BOM/CRLF source
- **THEN** Rider highlights the same text and exclusive endpoint as the existing player

### Requirement: Current-buffer resolution
Rider SHALL resolve on each step entry and Return to Current Step against the current document, including unsaved edits, without saving it. Disk loading SHALL reject unreadable, binary, or invalid UTF-8 source. Missing or unreadable source SHALL produce stale state without a resolved range. Automatic continuous re-resolution during editing is not required.

#### Scenario: Unsaved relocation
- **WHEN** the reader inserts lines in an unsaved document and re-enters the code step
- **THEN** Rider resolves the current buffer and shows its new location without saving the document

#### Scenario: Missing or invalid source
- **WHEN** a source file is deleted, unreadable, binary, or invalid UTF-8
- **THEN** the step becomes stale, retains its explanation and original path/line, and has no source attachment or highlight

### Requirement: Context-first anchor matching
Rider SHALL prefer matching original context, then a unique identical context relocation. Otherwise it SHALL select the nearest identical-context candidate, or nearest identical selected text when context is lost, with uncertainty. Distance SHALL compare line distance, then UTF-16 character distance; ties SHALL select the earlier offset and remain explicit. No identical selection SHALL mean stale, without fuzzy or old-line fallback.

#### Scenario: Confident relocation
- **WHEN** the original context no longer matches at its old position but exactly one identical context exists elsewhere
- **THEN** Rider relocates confidently using the captured selection offsets

#### Scenario: Context lost with one selection match
- **WHEN** no captured context matches but one identical selected expression exists
- **THEN** Rider shows that expression as uncertain, not confidently relocated

#### Scenario: Equal-distance candidates
- **WHEN** identical candidates have equal line and character distance
- **THEN** Rider selects the earlier offset, records the tie, and presents uncertainty

### Requirement: Cross-player conformance evidence
Repository verification SHALL run the TypeScript reference and Rider implementation against shared fixtures for artifact validation, normalized coordinate mapping, resolution states/reasons/ranges/ties, and branch navigation. Fixture drift SHALL be detectable. Kotlin tests SHALL consume committed fixtures without requiring Node during playback or ordinary plugin tests.

#### Scenario: Resolver or navigation drift
- **WHEN** either implementation differs on a shared case for candidate choice, UTF-16 range, hierarchy rejection, or Skip Details target
- **THEN** conformance verification fails with the case and differing result

### Requirement: Obsolete display suppression
Only the latest current step SHALL install presentation. Navigation, replacement, close, or project disposal SHALL invalidate outstanding display work. Returning from an outdated read or resolution SHALL NOT restore an old explanation, highlight, or action target.

#### Scenario: Close during a pending display
- **WHEN** a source read is pending and the walkthrough closes before it completes
- **THEN** completion does not reopen its source or restore any playback presentation
