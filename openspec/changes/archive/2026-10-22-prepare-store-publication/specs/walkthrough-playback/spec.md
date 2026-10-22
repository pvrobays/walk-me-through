# Spec Delta

## Purpose

Extends VS Code playback from native Windows and Linux to native macOS, as defined in `platform-support`.

## MODIFIED Requirements

### Requirement: Unsupported environment notice
Open Walkthrough SHALL support desktop VS Code on native Windows, native Linux and native macOS. In WSL, SSH, containers, remote extension hosts, or other unsupported platforms, it SHALL explain the supported environments and SHALL NOT start playback.

#### Scenario: Native Linux playback
- **WHEN** Open Walkthrough runs in local desktop VS Code on native Linux
- **THEN** the picker and playback work without a development override

#### Scenario: Native macOS playback
- **WHEN** Open Walkthrough runs in local desktop VS Code on native macOS
- **THEN** the picker and playback work without a development override

#### Scenario: Remote window
- **WHEN** Open Walkthrough runs in a WSL remote window
- **THEN** an unsupported-environment message is shown, and no walkthrough becomes active