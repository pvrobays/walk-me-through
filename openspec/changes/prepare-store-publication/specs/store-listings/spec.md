# Spec Delta

## Purpose

Defines what each published Walk Me Through viewer package contains and declares, so the store listings describe the product accurately, are installable on supported IDE versions, and lead users to working install help.

## ADDED Requirements

### Requirement: Stable store identities
The VS Code extension SHALL keep the identifier `pvrobays.walk-me-through`, and the Rider plugin SHALL keep `io.github.pvrobays.walkmethrough`. Launch URIs depend on these identifiers. Both packages SHALL use the same plain semantic version for a release, starting at 0.2.0, and that version SHALL be higher than any version already uploaded.

#### Scenario: Next release version
- **WHEN** the 0.2.0 packages are built
- **THEN** the VSIX manifest and the plugin descriptor both report version `0.2.0` and the unchanged identifiers

#### Scenario: Launch URIs still reach the store build
- **WHEN** a store-installed viewer receives `vscode://pvrobays.walk-me-through/open?e=…` or `jetbrains://rider/walkmethrough/open?e=…`
- **THEN** it handles the link exactly as the locally built viewer does

### Requirement: Listing content
Each package SHALL include listing text that explains what Walk Me Through does, how to get the project skill, how launch links behave, and which platforms are supported, with Linux and macOS marked as not verified by the maintainers. It SHALL NOT describe the plugin as a development prototype. Each package SHALL include per-version change notes.

#### Scenario: VS Code Marketplace page
- **WHEN** the 0.2.0 VSIX is uploaded
- **THEN** its Marketplace page shows a README with usage, skill installation, launch links and platform notes, a changelog for 0.2.0, an icon, categories, keywords, and links to the repository and issue tracker

#### Scenario: JetBrains Marketplace page
- **WHEN** the 0.2.0 plugin ZIP is uploaded
- **THEN** its description, change notes, vendor link and icon are taken from the package, and the text contains no "prototype" wording

### Requirement: Store-compliant icons
The VS Code package SHALL declare a PNG icon of at least 128×128 pixels. The Rider package SHALL contain a 40×40 `pluginIcon.svg` and a dark variant. All of these SHALL be derived from one committed artwork source and SHALL be reproducible from it.

#### Scenario: VS Code icon rules
- **WHEN** the VSIX is packaged
- **THEN** `package.json` references a PNG icon of at least 128×128 pixels that is included in the package, and no SVG is used as the extension icon

#### Scenario: Regeneration matches the committed icons
- **WHEN** the icon generator is run on a clean checkout
- **THEN** it reproduces the committed icon files byte for byte

### Requirement: Rider compatibility range
The Rider plugin SHALL declare compatibility from build 262 with no upper bound, and SHALL pass Plugin Verifier, with no compatibility problems, against the installed Rider 2026.2.3.1 and against the latest released Rider build at verification time.

#### Scenario: Newer Rider
- **WHEN** a user runs a Rider release newer than 262.10968.170
- **THEN** the Marketplace offers the plugin for installation

#### Scenario: Verification evidence
- **WHEN** the release is prepared
- **THEN** the recorded verifier results name each verified Rider build and report it compatible

### Requirement: Third-party notices
Each package SHALL include the license notices of every third-party component that it bundles, and the project's own MIT license.

#### Scenario: Bundled components are attributed
- **WHEN** a reviewer inspects the VSIX or the plugin ZIP
- **THEN** it finds the project license and notices naming each bundled library with its version and license

### Requirement: Optional author signing
The Rider build SHALL produce a signed plugin ZIP when signing material is supplied through local environment or Gradle properties. Without it, the build SHALL produce an unsigned ZIP. Signing material SHALL never be committed.

#### Scenario: Signing configured
- **WHEN** the certificate chain, private key and password are supplied locally
- **THEN** the signing task produces a signed ZIP that the IntelliJ Platform signature verification accepts

#### Scenario: Signing absent
- **WHEN** no signing material is supplied
- **THEN** the build still produces an installable unsigned ZIP, and the repository contains no key or certificate

### Requirement: Store-based install help
The launcher page's install help SHALL link to each viewer's Marketplace page, from the single help-target configuration. The README SHALL lead with store installation, keep local VSIX and ZIP builds as the development path, and keep the JetBrains Toolbox prerequisite for Rider links.

#### Scenario: Launcher help after a click
- **WHEN** the reader chooses an IDE on the launcher and opens its install help
- **THEN** the install link opens that IDE's Marketplace page for Walk Me Through

#### Scenario: Live launcher updated
- **WHEN** the change is merged to `main`
- **THEN** the redeployed launcher page carries the store links and the updated platform wording
