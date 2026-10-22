# launch-envelope Specification

## Purpose
Defines the versioned, editor-independent launch envelope that identifies one saved local walkthrough and optional step. Also covers how the publisher and skill deliver it as a replayable HTTPS link without the model encoding anything.

## Requirements

### Requirement: Versioned v1 envelope content
A v1 envelope SHALL be a JSON object with exactly these members: `v` (the integer 1), `root` (the artifact's absolute recorded project root), `env` (`kind` and `platform`, copied from the artifact environment), `id` (the artifact ID), an optional `step` (a step ID), and an optional `title` (display-only). Unknown members SHALL be rejected.

#### Scenario: Walkthrough-level envelope
- **WHEN** an envelope is built for a published artifact without a step
- **THEN** it contains `v: 1`, the artifact's recorded `project.root`, `env.kind` and `env.platform`, the artifact `id`, and `title`, and it has no `step` member

#### Scenario: Unknown member
- **WHEN** a decoded v1 envelope contains a member not defined above
- **THEN** validation fails with an error naming that member

#### Scenario: Unsupported version
- **WHEN** a decoded envelope has a `v` other than 1
- **THEN** validation reports an unsupported-version error, distinct from malformed input, so that receivers can ask for an update

### Requirement: Field validation
Validators SHALL require that `root` is an absolute Windows or POSIX path, `id` matches the artifact ID format, `step` (if present) is a nonempty string of at most 200 characters, and `title` (if present) is at most 120 characters. `env.kind` and `env.platform` SHALL be nonempty strings. Envelope content SHALL never be treated as trusted: it only identifies artifacts and never supplies source text, commands, or paths outside the artifact location.

#### Scenario: Traversal in ID
- **WHEN** `id` is `../../etc/passwd` or anything else that does not match the artifact ID format
- **THEN** validation fails, and no file path is derived from the envelope

#### Scenario: Relative root
- **WHEN** `root` is `src/project`
- **THEN** validation fails with a `root` error

#### Scenario: Title is not authoritative
- **WHEN** an envelope's `title` differs from the artifact's title
- **THEN** receivers display and play the artifact's own title and content

### Requirement: Encoding
The envelope SHALL be encoded as UTF-8 JSON in unpadded base64url. Decoders SHALL reject padding, characters outside the base64url alphabet, invalid UTF-8, invalid JSON, and non-object JSON, with distinct malformed-input errors. Non-ASCII paths and titles SHALL round-trip exactly.

#### Scenario: Non-ASCII root round-trip
- **WHEN** an envelope with root `C:\Users\Jürgen\项目` is encoded and decoded
- **THEN** the decoded root is identical, and the encoded text contains only `A-Z`, `a-z`, `0-9`, `-` and `_`

#### Scenario: Corrupted text
- **WHEN** the encoded text is truncated so it is no longer valid base64url, UTF-8, or JSON
- **THEN** decoding fails with a malformed-envelope error and no partial envelope is returned

### Requirement: Size limit
The encoded envelope SHALL be at most 1,536 characters. This keeps both the HTTPS launcher URL and the derived IDE URIs under a conservative external-protocol length. Builders SHALL shorten a longer `title` to 120 characters, and SHALL omit `title` if the envelope still does not fit. The limit SHALL be enforced when building and when decoding.

#### Scenario: Long title shortened
- **WHEN** the artifact title is 200 characters long
- **THEN** the envelope's `title` is at most 120 characters and ends with an ellipsis

#### Scenario: Oversized envelope rejected on decode
- **WHEN** a receiver gets an encoded envelope longer than 1,536 characters
- **THEN** it rejects the envelope as too long without decoding it

#### Scenario: Title dropped to fit
- **WHEN** a shortened title still pushes the envelope over 1,536 characters but the envelope fits without it
- **THEN** the built envelope omits `title` and is otherwise unchanged

### Requirement: Publisher returns a launch URL
On success, the publisher SHALL also return `url`, which is the launcher base URL followed by `#` and the encoded envelope. The default base is `https://pvrobays.github.io/walk-me-through/`. The `open` text SHALL mention the link first and keep the existing title/ID picker fallback. Agents SHALL NOT need to encode or alter launch data.

#### Scenario: Successful publish with link
- **WHEN** a valid input is published from an installed bundle
- **THEN** the JSON result contains `url` starting with `https://pvrobays.github.io/walk-me-through/#`, its fragment decodes to the new artifact's envelope, and `id`, `artifactPath`, `stepCount`, `warnings`, and `open` are still present

#### Scenario: Development launcher base
- **WHEN** the publisher is run with a development option that selects another HTTPS or `http://localhost` launcher base
- **THEN** `url` uses that base, and the bundled skill never instructs agents to use the option

### Requirement: Oversized link fallback
If the encoded envelope would exceed the size limit even with the title removed, the publisher SHALL still save the artifact and succeed. It SHALL omit `url`, add a `launch-link-too-long` warning, and keep picker instructions in `open`.

#### Scenario: Very long project root
- **WHEN** the recorded root is long enough that the envelope exceeds 1,536 characters
- **THEN** publishing succeeds, the result has no `url` and has a `launch-link-too-long` warning, and `open` explains how to use the picker

### Requirement: Link-first skill delivery
The skill SHALL instruct agents to start successful final replies with **Walkthrough available**: the title, the returned launch URL copied verbatim as a clickable link when present, then ID, artifact path, and picker fallback. The reply SHALL then keep the requested normal answer depth. Agents SHALL NOT shorten, wrap, re-encode, or invent links.

#### Scenario: Reply with link
- **WHEN** the publisher returns `url`
- **THEN** the skill's guidance has the reply lead with that exact URL, followed by ID, path, and the Open Walkthrough fallback, before the explanation

#### Scenario: Reply without link
- **WHEN** the publisher omits `url`
- **THEN** the guidance has the reply lead with title, ID, path, and picker instructions, and it does not fabricate a link

### Requirement: Cross-language conformance
Committed launch fixtures generated from the TypeScript reference SHALL cover encoding, valid and invalid envelopes, size limits, and error categories. The Kotlin decoder SHALL pass the same fixtures without Node at runtime, and a drift check SHALL fail when the fixtures are stale.

#### Scenario: Shared fixtures
- **WHEN** core and Rider tests run against the launch fixtures
- **THEN** both accept and reject the same envelopes, with the same error categories and decoded values

#### Scenario: Fixture drift
- **WHEN** envelope rules change without regenerating the fixtures
- **THEN** `npm test` fails with a fixture drift message
