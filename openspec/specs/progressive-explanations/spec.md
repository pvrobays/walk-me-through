# progressive-explanations Specification

## Purpose
Defines how walkthrough authors use hierarchy to support a concise complete reading path and optional progressively deeper source-backed explanations.

## Requirements

### Requirement: Self-contained top-level account
The skill SHALL instruct authors to make top-level steps a concise complete account of the requested mechanism or finding. Essential consequences, uncertainty, and verification limits SHALL remain understandable without reading children. Children SHALL add optional evidence, examples, or deeper implementation detail rather than carry a missing main conclusion.

#### Scenario: Concise reading path
- **WHEN** a reader follows only the top-level steps of a generated investigation
- **THEN** the reader can understand the mechanism, main finding, consequence, and essential caveats without entering child steps

#### Scenario: Unverified proposed repair
- **WHEN** a proposed repair has not been executed
- **THEN** the concise path makes that limit clear even if detailed repair evidence is in children

### Requirement: Progressive optional detail
The skill and format reference SHALL explain that each nested level adds optional depth to its parent. Authors SHALL avoid repeating the same explanation at each level and SHALL use descriptive child titles. Nesting SHALL remain limited to four levels, with existing source-location rules unchanged; authors SHALL NOT add hierarchy solely to reach the depth limit.

#### Scenario: Detailed reading path
- **WHEN** a reader enters a finding's children
- **THEN** the child steps provide additional relevant source evidence or detail that supports the parent's concise account

#### Scenario: Simple explanation
- **WHEN** an explanation needs no optional deep dive
- **THEN** it can remain flat without artificial grouping or duplicate detail

### Requirement: Reference demonstrates both reading paths
The bundled reference and sample walkthrough SHALL demonstrate a useful concise top-level path and at least one optional nested deep dive, including a precise expression selection. Their drafts SHALL publish under the existing input and artifact schemas. Successful normal replies SHALL continue to lead with walkthrough availability and retain the requested answer depth.

#### Scenario: Sample publishing and playback
- **WHEN** the documented sample is published and opened
- **THEN** its top-level steps tell the complete concise story and its nested steps offer additional evidence without schema migration

#### Scenario: Normal answer preserved
- **WHEN** an agent uses progressive-depth authoring to answer a detailed request
- **THEN** the final reply starts with walkthrough opening details and still provides the requested normal explanation
