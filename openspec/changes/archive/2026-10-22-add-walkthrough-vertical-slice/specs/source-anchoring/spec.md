# Spec Delta

## Purpose

Defines how source selections are represented, captured when a walkthrough is published, and resolved again during playback. Code that moved is followed reliably. Any uncertainty is reported honestly instead of being shown as a confident match.

## ADDED Requirements

### Requirement: Stored coordinate convention
Stored ranges SHALL use the following convention:
- Line numbers and character offsets are 0-based.
- Character offsets count UTF-16 code units.
- The end position is exclusive.
- A tab counts as one character.
- A leading UTF-8 BOM is not counted.
- Line breaks are never part of a line's character count, whether the file uses CRLF or LF.

#### Scenario: Surrogate pair
- **WHEN** a selection follows an emoji on the same line
- **THEN** the emoji counts as two characters in the stored start offset

#### Scenario: CRLF file
- **WHEN** the same selection is captured from a CRLF file and from an LF copy of that file
- **THEN** both produce identical ranges and anchor hashes

#### Scenario: BOM file
- **WHEN** a file begins with a UTF-8 BOM
- **THEN** character offsets on line 0 are the same as in an identical file without a BOM

### Requirement: Anchor capture at publish time
When publishing, the script SHALL capture each step's anchor from the source text on disk:
- The exact selected text, after line endings are normalised.
- A whole-line context block covering the selection, with its SHA-256 hash, line span, and length.
- The selection's offsets within that block.

Anchors SHALL be captured at publish time, never first at playback.

#### Scenario: Edits before first open
- **WHEN** lines are inserted above a selection after publishing but before the walkthrough is first opened
- **THEN** the stored anchor still reflects the code as it was at publish time

### Requirement: Context widening until unique
Context capture SHALL start with the lines covering the selection. It SHALL widen by one line above and one line below per iteration, where such lines exist, until the block occurs exactly once among line-aligned positions in the file, or until the documented cap is reached. The anchor SHALL record whether its context is unique.

#### Scenario: Unique selection line
- **WHEN** the selected lines already occur exactly once in the file
- **THEN** the context block is exactly the selected lines

#### Scenario: Repeated line widened
- **WHEN** the selected line `return null;` occurs five times, but its surrounding three lines are unique
- **THEN** the context grows until it is unique, and is recorded as unique

#### Scenario: Cap reached
- **WHEN** the context is still not unique when the cap is reached
- **THEN** the capped context is stored and recorded as not unique

### Requirement: Exact resolution
During playback, if the current text at the anchor's original context lines hashes to the stored context hash, resolution SHALL return the state **exact** with the original range.

#### Scenario: Unchanged file
- **WHEN** the file has not changed since publishing
- **THEN** resolution returns exact with the stored range

#### Scenario: Edits outside context
- **WHEN** lines below the context block are edited
- **THEN** resolution returns exact

### Requirement: Confident relocation
If the original position no longer matches, and the identical context block occurs exactly once among line-aligned positions in the current text, resolution SHALL return the state **relocated**. The selection SHALL be placed at the same offsets within the relocated block.

#### Scenario: Lines inserted above
- **WHEN** three lines are inserted above the selection's context
- **THEN** resolution returns relocated, with the range moved down three lines and its characters unchanged

### Requirement: Uncertain nearest match
Resolution SHALL return the state **uncertain** when it uses the nearest of several possible matches. The candidates are, in order of preference:
1. Multiple matches of the context block.
2. If the context block is no longer found anywhere, every occurrence of the identical selected text.

The result SHALL identify which of these two reasons applied.

#### Scenario: Multiple context matches
- **WHEN** an identical copy of the context block is pasted elsewhere, and the original position no longer matches
- **THEN** resolution returns uncertain, with the candidate nearest to the original line and the reason `multiple-context-matches`

#### Scenario: Context edited but selection intact
- **WHEN** a line inside the context block is edited, but the selected expression remains unchanged elsewhere in the file
- **THEN** resolution returns uncertain, with the nearest occurrence of the selection and the reason `context-changed`, even if there is only one occurrence

### Requirement: Nearest candidate selection
Nearness SHALL be measured from the original selection start: line distance first, then character distance. If two candidates are equally near, the earlier position SHALL be used, and the result SHALL record the tie.

#### Scenario: Nearer candidate wins
- **WHEN** candidates exist 2 lines and 40 lines away from the original position
- **THEN** resolution uses the candidate 2 lines away

#### Scenario: Equal distance tie
- **WHEN** two candidates are equally near to the original position
- **THEN** resolution returns uncertain, with the earlier candidate and the tie recorded

### Requirement: Stale detection
Resolution SHALL return the state **stale**, with no range, in any of these cases:
- The file no longer exists.
- The file cannot be read as text.
- Neither the context block nor the selected text occurs in the current text.

Resolution SHALL NOT fall back to the stored line numbers or to fuzzy similarity.

#### Scenario: Selection edited
- **WHEN** the selected expression is changed and no identical text remains in the file
- **THEN** resolution returns stale with no range

#### Scenario: File deleted
- **WHEN** the referenced file has been deleted
- **THEN** resolution returns stale with the reason `file-missing`

### Requirement: Resolution against current buffer content
Playback SHALL resolve anchors against the editor's current document content, including unsaved changes, rather than against the file on disk.

#### Scenario: Unsaved insertion
- **WHEN** lines are inserted above a selection in an unsaved editor buffer
- **THEN** resolution returns relocated, matching the buffer content rather than the file on disk
