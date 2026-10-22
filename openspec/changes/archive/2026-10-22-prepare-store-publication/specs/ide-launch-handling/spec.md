# Spec Delta

## Purpose

Removes Rider's Windows-only launch refusal; launch links are refused only for unsupported environments and platform mismatches.

## MODIFIED Requirements

### Requirement: Envelope and environment validation
Receivers SHALL decode and validate the envelope with the v1 rules. They SHALL refuse it, with an actionable notice, when the receiving IDE is in an unsupported environment, when `env.kind` is not `local`, or when `env.platform` differs from the receiver's platform. Refusal SHALL leave the current session unchanged.

#### Scenario: Malformed link
- **WHEN** the envelope is malformed or has an unsupported version
- **THEN** the IDE shows a notice that the link is invalid or needs a newer viewer, and no session changes

#### Scenario: Remote or mismatched environment
- **WHEN** a valid envelope reaches a remote/WSL VS Code window, or its platform is `linux` while the receiver runs on Windows
- **THEN** playback is refused with the existing unsupported-environment guidance

#### Scenario: Rider on Linux
- **WHEN** a Rider launch command for a `linux` envelope arrives in local desktop Rider on native Linux
- **THEN** the plugin handles it like any other matching link instead of refusing the platform