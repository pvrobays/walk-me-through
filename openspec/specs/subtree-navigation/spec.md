# subtree-navigation Specification

## Purpose
Lets readers bypass optional nested detail explicitly while preserving the existing full depth-first walkthrough traversal and direct tree selection.

## Requirements

### Requirement: Skip Details target
The player SHALL provide **Skip Details**. From a step it SHALL move to the first later step outside that step's subtree. If none exists at its level, it SHALL ascend ancestors until a following branch is found. From the overview it SHALL enter the first top-level step. If no target exists it SHALL do nothing, without wrapping or closing playback.

#### Scenario: Skip a parent deep dive
- **WHEN** top-level A has children A1 and A2 and is followed by top-level B, and the reader invokes Skip Details on A
- **THEN** B becomes current without visiting A1 or A2

#### Scenario: Continue between nested branches
- **WHEN** A1 has children and is followed by A2 within A, and the reader invokes Skip Details on A1
- **THEN** A2 becomes current without visiting A1's children

#### Scenario: Leave a final nested branch
- **WHEN** A2 is A's last child, A is followed by B, and the reader invokes Skip Details on A2 or its final descendant
- **THEN** B becomes current

#### Scenario: Overview and end boundary
- **WHEN** Skip Details is invoked on the overview
- **THEN** the first top-level step becomes current
- **WHEN** no following branch exists for the current step
- **THEN** invoking it leaves the current step unchanged

### Requirement: Discoverable navigation controls
Skip Details SHALL be available from the Command Palette, Step view, and player comment-header controls. The Step view SHALL disable it when no target exists; command and comment-header availability SHALL reflect that boundary. The Step view SHALL explain that it skips the current branch's nested detail and continues to the next available branch.

#### Scenario: Available for code and narrative steps
- **WHEN** a code step or location-less parent has a following branch
- **THEN** the reader can invoke Skip Details from the Step view or Command Palette and, for a displayed code comment, its header

#### Scenario: No following branch
- **WHEN** the current branch has no following branch at any ancestor level
- **THEN** the Step-view action is disabled, unavailable menu actions cannot cause navigation, and direct command invocation is a no-op

### Requirement: Existing traversal and presentation remain stable
Next and Previous SHALL retain depth-first order, independent of collapse and prior skips. Skipping SHALL NOT mark descendants complete, remove them, or alter navigation history semantics. The target SHALL use the normal step display, current-buffer anchor resolution, cleanup, and ancestor-reveal behavior. Existing v1 artifacts SHALL support Skip Details without regeneration.

#### Scenario: Previous after a skip
- **WHEN** A contains A1 and A2, the reader skips from A to B, then invokes Previous
- **THEN** A2, the previous depth-first entry, becomes current rather than A

#### Scenario: Detail remains accessible
- **WHEN** the reader returns to A after skipping it and presses Next, even if A is collapsed
- **THEN** A1 becomes current and is revealed

#### Scenario: Current-buffer target display
- **WHEN** Skip Details enters a code step whose source has unsaved changes
- **THEN** previous presentation is cleared and the target resolves against the current buffer with its normal exact, relocated, uncertain, or stale presentation
