# anchor-state-notices Specification

## Purpose
Keeps source-anchor uncertainty clearly communicated with compact, readable notices that support rather than overwhelm the walkthrough explanation.

## Requirements

### Requirement: Compact uncertainty explanation
Both the source comment and Step view SHALL label uncertain matches and explain concisely that the original location is unconfirmed and the closest identical code is shown. A distance tie SHALL additionally say the earlier equally near candidate is shown. The uncertainty notice SHALL remain visible without requiring expansion or a hover.

#### Scenario: Uncertain nearest match
- **WHEN** source context is lost or several identical contexts match
- **THEN** both surfaces visibly communicate uncertainty and the closest-identical-code fallback

#### Scenario: Tied candidates
- **WHEN** the selected uncertain candidate tied with another at the same distance
- **THEN** the notice also communicates the tie and earlier-candidate choice

### Requirement: Subordinate readable warning styling
The Step-view uncertainty notice SHALL use smaller text than the main explanation while remaining readable and theme-aware. Comment notices SHALL use ordinary paragraph typography without an oversized heading or bold warning lead-in. Warning indicators and dashed uncertain highlights SHALL remain visibly distinct from confident matches; notices SHALL NOT rely solely on color.

#### Scenario: Compare warning with explanation
- **WHEN** an uncertain code step is displayed
- **THEN** the Step-view warning is visually subordinate and readable, and the source comment starts with a compact normal-weight warning paragraph

#### Scenario: Theme changes
- **WHEN** the reader uses a light, dark, or high-contrast theme
- **THEN** uncertainty remains legible and identifiable through explicit text and warning indicators as well as theme colors

### Requirement: Preserve other anchor-state semantics
Presentation refinements SHALL NOT change anchor matching, uncertainty reasons, candidate choice, or stale detection. Stale steps SHALL retain error-themed markers, concise missing-original-code wording, original path/line, and no highlight or source comment. Relocated steps SHALL retain their informational notice and confident highlight.

#### Scenario: No identical selection remains
- **WHEN** the selected source text can no longer be found
- **THEN** the existing stale error presentation appears without source navigation, highlight, or comment

#### Scenario: Unique context relocation
- **WHEN** captured context uniquely identifies moved source
- **THEN** it remains a confident relocation with an informational note rather than an uncertainty warning
