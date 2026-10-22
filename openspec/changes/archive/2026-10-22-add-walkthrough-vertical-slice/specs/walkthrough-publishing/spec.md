# Spec Delta

## Purpose

Defines how a coding agent authors a walkthrough as a JSON input file, and how the bundled publishing script validates it, resolves precise selections, and saves an artifact. The agent never has to calculate columns, hashes, IDs, or encodings.

## ADDED Requirements

### Requirement: Agent input format
The publishing script SHALL accept a UTF-8 JSON input containing:
- `version` 1.
- A title.
- A Markdown summary.
- A non-empty `steps` array.

Each step SHALL have:
- A title.
- A Markdown `explanation`.
- An optional `evidence` label.
- An optional `location`.
- An optional `children` array of steps.

The input SHALL NOT contain IDs, hashes, columns, or timestamps.

#### Scenario: Valid nested input
- **WHEN** the input contains three top-level steps, one of which has two children
- **THEN** publishing succeeds with five steps

#### Scenario: Unknown fields rejected
- **WHEN** a step contains an unrecognised field such as `id` or `startColumn`
- **THEN** publishing fails with an error naming that field and its path in the input

### Requirement: Line-range locations
A location SHALL consist of:
- A project-relative `path`.
- A 1-based, inclusive `startLine` and `endLine`.
- An optional exact-text `match`.

The path SHALL resolve, after following symlinks, to an existing UTF-8 text file inside the project root. Line numbers SHALL lie within the file, and `startLine` SHALL NOT exceed `endLine`.

#### Scenario: Whole-line selection
- **WHEN** a location gives lines 10–12 and no `match`
- **THEN** the stored range starts at the beginning of line 10 and ends at the end of line 12's content, excluding the line break

#### Scenario: Path outside project
- **WHEN** a location path escapes the project root directly or through a symlink
- **THEN** publishing fails with an error for that step

#### Scenario: Line out of range
- **WHEN** `endLine` exceeds the file's line count
- **THEN** publishing fails, and the error reports the file's actual line count

#### Scenario: Blank selection rejected
- **WHEN** a location without `match` covers only empty or whitespace-only lines
- **THEN** publishing fails with `EMPTY_SELECTION`, naming the input field, source path, and line range, and instructing the agent to inspect the current source and select meaningful code before retrying

#### Scenario: Binary or non-UTF-8 file
- **WHEN** a location refers to a file containing NUL bytes or invalid UTF-8
- **THEN** publishing fails with an error for that step

### Requirement: Exact-text match within the range
When a `match` is supplied, the script SHALL select exactly that text. The text SHALL occur exactly once within the given lines, after line endings are normalised. If the text is missing, empty, or occurs more than once, publishing SHALL fail with an error that asks the agent to refine either the snippet or the range.

#### Scenario: Expression selection
- **WHEN** `match` is `retryCount + 1`, and it occurs once on line 42
- **THEN** the stored range covers exactly those characters on line 42

#### Scenario: Multiline match
- **WHEN** `match` spans two lines inside the given range
- **THEN** the stored range starts and ends exactly at the matched text

#### Scenario: Ambiguous match
- **WHEN** `match` occurs twice within the given lines
- **THEN** publishing fails and reports both occurrence lines

#### Scenario: Missing match
- **WHEN** `match` does not occur within the given lines
- **THEN** publishing fails for that step

### Requirement: Input location and hierarchy rules
The script SHALL apply the artifact's hierarchy and location rules to the input:
- Nesting deeper than four levels SHALL be rejected.
- A nested leaf step without a location SHALL be rejected.
- Top-level steps and parent steps without a location SHALL be accepted.

#### Scenario: Fifth input level
- **WHEN** the input nests `children` five levels deep
- **THEN** publishing fails and names the path of the step at level 5

### Requirement: Input size limits
The script SHALL reject input that exceeds any documented limit: total step count, title length, explanation length, summary length, or referenced source file size. Errors SHALL name the limit that was exceeded.

#### Scenario: Too many steps
- **WHEN** the input contains more steps than the documented maximum
- **THEN** publishing fails and states the maximum

### Requirement: Project root from installation location
The script SHALL determine the project root from its own installed location, `<root>/.agents/skills/walk-me-through/scripts/`, without depending on the working directory or on git. Source paths SHALL be resolved against that root; the input JSON file path is relative to the working directory. An explicit `--root <dir>` option SHALL take precedence, for development use.

#### Scenario: Invoked from a subdirectory
- **WHEN** the installed script is run from `<root>/src/deep/dir`
- **THEN** locations are resolved against `<root>`, and the artifact is written under `<root>/.walk-me-through/`

#### Scenario: Not installed and no root given
- **WHEN** the script is run from outside an installed bundle layout without `--root`
- **THEN** it fails with a usage error explaining how to supply `--root`

### Requirement: Supported execution environment
The script SHALL run under native Windows and native Linux, using Node 20 or later. Each of the following SHALL produce an actionable message and no artifact:
- An older Node version.
- WSL.
- An SSH session.
- A container.
- Any other platform.

A documented development and test override SHALL allow running the script on other platforms.

#### Scenario: WSL detected
- **WHEN** the script runs inside WSL
- **THEN** it exits with an unsupported-environment error that names WSL and states that the MVP supports native Windows and native Linux, excluding WSL

#### Scenario: Native Linux accepted
- **WHEN** the script runs locally on native Linux with a supported Node version, outside WSL, SSH, or a container
- **THEN** publishing succeeds without an environment override and records platform `linux`

#### Scenario: Old Node
- **WHEN** the script runs on Node 18
- **THEN** it exits with an error stating that Node 20 or later is required

### Requirement: Command-line interface and result output
The script SHALL be invoked as `node publish-walkthrough.mjs <input.json> [--root <dir>]`. It SHALL print exactly one JSON object to stdout:
- **On success:** `ok: true`, the walkthrough ID, the artifact path, step count, warnings, and instructions to choose that artifact using Open Walkthrough. No launch URL is returned in this slice.
- **On failure:** `ok: false` and a list of actionable structured errors.

#### Scenario: Successful publish
- **WHEN** a valid input file is published
- **THEN** the script prints a single JSON object containing `ok: true`, the walkthrough ID, the artifact path, and the opening instruction

### Requirement: Actionable structured errors
Every publishing error SHALL include a stable `code`, affected field `path`, human-readable `message`, repair `hint`, and `recovery`: `fix-input`, `fix-environment`, or `report`. Source errors SHALL include the file and requested range where available. The script SHALL NOT create an artifact on failure. An unchanged invalid input SHALL NOT be recommended for retry.

#### Scenario: Blank selection recovery
- **WHEN** a selection contains only whitespace
- **THEN** the error has code `EMPTY_SELECTION` and recovery `fix-input`, with a hint to read the source, correct the range or snippet, and retry after correction

#### Scenario: Missing snippet recovery
- **WHEN** the exact snippet does not occur in the requested lines
- **THEN** the error has code `MATCH_NOT_FOUND` and recovery `fix-input`, naming the file and range and asking the agent to re-read the current source and correct the snippet or range

#### Scenario: Ambiguous snippet recovery
- **WHEN** the snippet occurs more than once within the requested lines
- **THEN** the error has code `MATCH_AMBIGUOUS` and recovery `fix-input`, with occurrence lines and a hint to narrow the range or extend the snippet until unique

#### Scenario: Environment recovery
- **WHEN** Node is too old or the execution environment is unsupported
- **THEN** the error has recovery `fix-environment` and describes the required setup, so the agent can report the blocker instead of retrying the same input

#### Scenario: Unexpected tool failure
- **WHEN** an unexpected internal error prevents publishing
- **THEN** the error has code `INTERNAL_ERROR` and recovery `report`, telling the agent to report the failure without fabricating an artifact or repeatedly retrying

### Requirement: Exit codes
The script SHALL exit with code 0 on success, 1 for input validation errors, and 2 for usage or environment errors.

#### Scenario: Success exit code
- **WHEN** a valid input file is published
- **THEN** the script exits with code 0

#### Scenario: Validation errors are all reported
- **WHEN** an input contains two invalid steps
- **THEN** the script exits with code 1 and reports both errors, each with its JSON path

#### Scenario: Missing input file
- **WHEN** the input file path does not exist
- **THEN** the script exits with code 2 and reports a usage error

### Requirement: Non-unique anchor warnings
When anchor context cannot be made unique within the documented cap, publishing SHALL still succeed. The result SHALL include a warning naming the affected step.

#### Scenario: Repetitive code
- **WHEN** a selected line and its surrounding lines repeat identically elsewhere in the file, beyond the context cap
- **THEN** publishing succeeds and reports a non-unique-anchor warning for that step

### Requirement: No IDE side effects
The publishing script SHALL NOT launch, focus, or communicate with any IDE, network service, or background process.

#### Scenario: Publish while VS Code is open
- **WHEN** a walkthrough is published while VS Code is running
- **THEN** VS Code's focus and the open editors are unchanged, and no network request is made
