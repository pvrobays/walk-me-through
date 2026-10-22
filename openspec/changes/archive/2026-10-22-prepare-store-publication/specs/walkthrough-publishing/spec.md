# Spec Delta

## Purpose

Replaces the vertical slice's Windows-and-Linux-only publishing environment with the local desktop platforms defined in `platform-support`.

## MODIFIED Requirements

### Requirement: Supported execution environment
The script SHALL run under native Windows, native Linux and native macOS, using Node 20 or later. Each of the following SHALL produce an actionable message and no artifact:
- An older Node version.
- WSL.
- An SSH session.
- A container.
- Any other platform.

A documented development and test override SHALL allow running the script on other platforms.

#### Scenario: WSL detected
- **WHEN** the script runs inside WSL
- **THEN** it exits with an unsupported-environment error that names WSL and states that a local desktop on native Windows, Linux or macOS is required, excluding WSL

#### Scenario: Native Linux accepted
- **WHEN** the script runs locally on native Linux with a supported Node version, outside WSL, SSH, or a container
- **THEN** publishing succeeds without an environment override and records platform `linux`

#### Scenario: Native macOS accepted
- **WHEN** the script runs locally on native macOS with a supported Node version, outside SSH or a container
- **THEN** publishing succeeds without an environment override and records platform `darwin`

#### Scenario: Old Node
- **WHEN** the script runs on Node 18
- **THEN** it exits with an error stating that Node 20 or later is required