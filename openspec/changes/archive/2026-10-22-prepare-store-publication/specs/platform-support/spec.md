# Spec Delta

## Purpose

Defines which host environments the publisher script, the VS Code extension and the Rider plugin accept, and how platforms that the maintainers have not verified are described to users.

## ADDED Requirements

### Requirement: Supported local desktop platforms
The publisher, the VS Code extension and the Rider plugin SHALL accept native local Windows, Linux and macOS. They SHALL refuse WSL, SSH sessions, containers, remote IDE hosts and headless IDEs with the existing setup guidance. The development override SHALL keep its current meaning and SHALL never bypass the Node 20 requirement.

#### Scenario: Native macOS publishing
- **WHEN** the installed publisher runs with Node 20+ on native macOS
- **THEN** it publishes successfully and records `env.kind: "local"` and `env.platform: "darwin"`

#### Scenario: Rider on Linux or macOS
- **WHEN** Rider on native Linux or macOS opens a saved artifact or receives a matching launch link
- **THEN** playback runs instead of being refused

#### Scenario: Remote and container hosts still refused
- **WHEN** any of the three components runs over SSH, in WSL, in a container, or in a remote or headless IDE
- **THEN** it refuses with the local-desktop guidance and changes no session or files

### Requirement: Platform match for artifacts and links
Playback through launch links SHALL still require that the envelope's `env.platform` equals the receiving host's platform. An artifact's recorded platform SHALL NOT be reinterpreted for another OS.

#### Scenario: macOS link on Windows
- **WHEN** a link with `env.platform: "darwin"` reaches a Windows IDE
- **THEN** the existing platform-mismatch notice is shown and the session is unchanged

### Requirement: Honest verification status
User-facing documentation, store listings and launcher help SHALL state that Windows is the maintainers' acceptance platform, and that Linux and macOS are supported but not verified by the maintainers. Automated CI results MAY be cited as such. Messages SHALL NOT claim a platform is verified without recorded evidence.

#### Scenario: Listing wording
- **WHEN** a user reads either store listing or the README platform section
- **THEN** it says Windows is tested by the maintainers and Linux and macOS are not, and lists the remaining exclusions (WSL, SSH, containers, remote hosts)
