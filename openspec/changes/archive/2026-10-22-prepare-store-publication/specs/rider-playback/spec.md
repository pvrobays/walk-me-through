# Spec Delta

## Purpose

Replaces the Rider player's Windows-only runtime acceptance with local desktop Rider on native Windows, Linux and macOS, as defined in `platform-support`.

## MODIFIED Requirements

### Requirement: Local Windows acceptance
The player SHALL run in local desktop Rider from build 262 on native Windows, Linux and macOS without a model call, Node process, package download, companion service, or semantic backend during playback. Remote development hosts and headless IDEs SHALL receive an actionable unsupported-environment message without starting playback. Windows remains the maintainers' acceptance platform; Linux and macOS are accepted but not verified by the maintainers.

#### Scenario: Offline playback
- **WHEN** Rider has the plugin installed and a saved artifact but no network or Node executable available
- **THEN** opening and navigating the walkthrough work locally

#### Scenario: Linux or macOS host
- **WHEN** local desktop Rider on native Linux or macOS opens a saved artifact
- **THEN** playback runs instead of being refused