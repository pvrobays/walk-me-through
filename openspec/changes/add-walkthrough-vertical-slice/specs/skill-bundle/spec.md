# Spec Delta

## Purpose

Defines the project-local skill bundle that teaches coding agents to author walkthroughs. It ships the publishing script and its metadata. Teams commit the bundle so that teammates' agents can use it without any extra installation.

## ADDED Requirements

### Requirement: Bundle layout
The bundle SHALL be installable at `.agents/skills/walk-me-through/` and SHALL contain:
- `SKILL.md`
- `manifest.json`
- `references/walkthrough-format.md`
- `scripts/publish-walkthrough.mjs`

The skill's frontmatter name SHALL be `walk-me-through`, matching its directory, so that OpenCode and other compatible agents can discover it.

#### Scenario: OpenCode discovery
- **WHEN** the bundle is installed in a project and OpenCode is restarted there
- **THEN** OpenCode lists the `walk-me-through` skill as available

### Requirement: Self-contained publishing script
The bundled script SHALL be a single JavaScript file that runs with Node built-ins only. It SHALL need no package installation, network access, native compilation, or build step in the consuming project. It SHALL begin with a header stating that it is generated, the bundle version, and the source location.

#### Scenario: Clean project
- **WHEN** the bundle is copied into a project that has no `node_modules`
- **THEN** `node .agents/skills/walk-me-through/scripts/publish-walkthrough.mjs <input>` publishes successfully

### Requirement: Committed script matches source
The committed generated script SHALL be reproducible from the repository's sources. A repository check SHALL fail when the committed script differs from a fresh build. Line-ending differences alone SHALL NOT count as a difference.

#### Scenario: Stale generated script
- **WHEN** shared core code changes without the script being regenerated
- **THEN** the repository's bundle check fails

### Requirement: Bundle manifest
`manifest.json` SHALL record:
- `manifestVersion` 1.
- The semantic `bundleVersion`.
- The `walkthroughSchemaVersion`.
- A SHA-256 hash for every other bundle file.

Each file hash SHALL be computed over UTF-8 text with any leading BOM removed and CRLF normalised to LF. The manifest SHALL NOT hash itself.

#### Scenario: CRLF checkout
- **WHEN** Git checks out the bundle files with CRLF line endings
- **THEN** recomputed file hashes still equal the manifest's hashes

### Requirement: Agent guidance
`SKILL.md` SHALL instruct agents to do the following:
- Use walkthroughs for explanations and investigations that span several code locations.
- Write evidence-backed steps, never private chain-of-thought.
- Prefer the smallest useful ranges, and use `match` for expressions.
- Write the input under `.walk-me-through/drafts/`.
- Publish the input and follow the script's recovery guidance on errors.

#### Scenario: Evidence-backed walkthrough
- **WHEN** an agent following the skill publishes a walkthrough
- **THEN** its steps explain findings and supporting code, including uncertainty where appropriate, rather than exposing private internal reasoning

### Requirement: Walkthrough supplements the normal answer
The skill SHALL preserve the agent's normal user-facing answer, including findings, evidence, rationale, and uncertainty at the detail requested by the user. It SHALL append the walkthrough ID, artifact path, and Open Walkthrough picker instructions. It SHALL NOT replace the answer with only a short conclusion or require a copy of every walkthrough step. It SHALL NOT request private internal chain-of-thought.

#### Scenario: Normal explanation preserved
- **WHEN** the user requests a detailed explanation and the agent publishes a walkthrough
- **THEN** the reply still provides the requested explanation and adds the artifact path, ID, and instructions for choosing it in VS Code

#### Scenario: Walkthrough unavailable
- **WHEN** publishing cannot finish because of an environment or tool failure
- **THEN** the agent still gives its normal answer, explains that the walkthrough could not be created, and does not claim that a saved artifact exists

### Requirement: Publishing error recovery guidance
The skill SHALL tell the agent to correct `fix-input` errors using the supplied hint and current source before retrying. For `fix-environment`, it SHALL report the required setup; for `report`, it SHALL report the tool failure. It SHALL NOT instruct the agent to retry unchanged input, loop on repeated identical errors, or fabricate anchors or artifacts.

#### Scenario: Empty selection corrected
- **WHEN** publishing returns `EMPTY_SELECTION` with recovery `fix-input`
- **THEN** the agent checks the referenced source and corrects the range or snippet to meaningful code before publishing again

#### Scenario: Repeated unrepairable error
- **WHEN** the same error recurs without a new correction available
- **THEN** the agent stops retrying, reports the remaining blocker, and preserves its normal answer

#### Scenario: Missing Node
- **WHEN** `node` is unavailable or older than version 20
- **THEN** the guidance tells the agent to report that Node 20 or later is required, rather than writing an artifact by hand or inventing hashes

### Requirement: Format reference
`references/walkthrough-format.md` SHALL document the version 1 input format, with an example that covers all of the following:
- Nested steps.
- A narrative step.
- A whole-line location.
- A `match` location.
- Evidence labels.

It SHALL also document the script's limits, exit codes, structured error fields and codes, and recovery actions, with examples for empty selections, missing/ambiguous snippets, unsupported environments, and internal failures.

#### Scenario: Example is valid
- **WHEN** the example input from the format reference is published against matching sample files
- **THEN** publishing succeeds

### Requirement: Developer installation command
For this slice, the repository SHALL provide a developer command that copies the canonical bundle into a given project's `.agents/skills/walk-me-through/`. If an existing bundle differs from the canonical one, the command SHALL refuse to overwrite it unless forced. It SHALL NOT commit anything or modify any agent's global configuration.

#### Scenario: Install into project
- **WHEN** the developer runs the install command for a project directory
- **THEN** the bundle files exist in that project's `.agents/skills/walk-me-through/`, and its git history is unchanged

#### Scenario: Modified bundle protected
- **WHEN** the target already contains an edited `SKILL.md`
- **THEN** the command refuses without the force option and reports the differing file
