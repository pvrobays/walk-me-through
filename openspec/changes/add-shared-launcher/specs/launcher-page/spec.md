# Spec Delta

## Purpose

Specifies the static HTTPS launcher that a walkthrough link opens. It explains what will be opened, gives explicit VS Code and Rider choices with install help and retry, and keeps launch data private to the browser.

## ADDED Requirements

### Requirement: Fragment-only decoding
The launcher SHALL read the envelope only from the URL fragment and SHALL validate it with the v1 envelope rules before offering any IDE action. It SHALL ignore query parameters. Changing the fragment while the page is open SHALL re-render the page for the new envelope.

#### Scenario: Valid link
- **WHEN** a reader opens `https://pvrobays.github.io/walk-me-through/#<valid envelope>`
- **THEN** the page shows the walkthrough title (or the ID when there is no title), the artifact ID, the recorded project root, and the target step when present, and it enables the IDE choices

#### Scenario: Invalid or missing envelope
- **WHEN** the fragment is missing, malformed, oversized, or fails validation
- **THEN** the page shows a short explanation of the problem and how to get a fresh link from the agent, and it offers no IDE buttons

#### Scenario: Newer envelope version
- **WHEN** the fragment decodes to an envelope with an unsupported version
- **THEN** the page says the link was produced by a newer Walk Me Through version, and it offers no IDE buttons

### Requirement: Explicit IDE choices
The launcher SHALL offer **Open in VS Code** and **Open in Rider** as separate user-initiated controls. Each control SHALL open the corresponding IDE URI carrying the same envelope. The page SHALL NOT open an IDE on load or after a timeout.

#### Scenario: Choose VS Code
- **WHEN** the reader activates Open in VS Code
- **THEN** the browser is asked to open `vscode://pvrobays.walk-me-through/open?e=<envelope>` with the envelope unchanged

#### Scenario: Choose Rider
- **WHEN** the reader activates Open in Rider
- **THEN** the browser is asked to open the Rider protocol-command URI with the envelope unchanged

#### Scenario: No automatic launch
- **WHEN** the page loads with a valid envelope
- **THEN** no IDE URI is opened until the reader activates a control

### Requirement: Honest install help and retry
After an IDE choice, the launcher SHALL show that IDE's install and prerequisite help next to an explicit retry control. It SHALL NOT claim to detect whether the IDE or plugin is installed. Retry SHALL reuse the same envelope, and the original link SHALL keep working after installation.

#### Scenario: Plugin not installed
- **WHEN** the reader chooses an IDE and nothing happens
- **THEN** the visible help explains how to install the viewer and any protocol prerequisites (for Rider: JetBrains Toolbox/jetbrainsd), and Retry opens the same IDE URI again

#### Scenario: Re-click after install
- **WHEN** the reader installs the viewer and then clicks the original agent link again
- **THEN** the same walkthrough can be opened, not a newer one

### Requirement: Configurable help targets
Install-help destinations SHALL be defined in one configuration block and SHALL initially point to the repository documentation for the local VSIX and plugin ZIP installation. Switching to store or release URLs SHALL require changing only that block.

#### Scenario: Initial targets
- **WHEN** the reader opens install help for VS Code or Rider
- **THEN** the help links lead to the repository's installation instructions for that IDE

### Requirement: Picker fallback
The launcher SHALL let the reader copy the artifact ID, and SHALL explain that **Walk Me Through: Open Walkthrough** with that ID opens the same walkthrough.

#### Scenario: Copy ID
- **WHEN** the reader activates the copy control
- **THEN** the artifact ID is copied to the clipboard, or shown as selectable text if clipboard access fails

### Requirement: Local preference only
The launcher SHALL remember the last chosen IDE in browser-local storage, and SHALL use it only to highlight that choice. It SHALL NOT store envelopes, roots, IDs, or titles. A remembered choice SHALL NOT cause automatic launching.

#### Scenario: Returning reader
- **WHEN** a reader who previously chose Rider opens another link
- **THEN** Open in Rider is visually emphasized, both choices remain available, and nothing opens automatically

### Requirement: Self-contained and private
The launcher SHALL consist only of static same-origin assets. It SHALL make no network requests beyond loading those assets, SHALL include no analytics, third-party scripts, fonts, or images, and SHALL apply a restrictive content security policy and a no-referrer policy. It SHALL render envelope values only as text.

#### Scenario: Markup in title
- **WHEN** the envelope title contains `<img src=x onerror=alert(1)>`
- **THEN** the page shows it as literal text and runs no script

#### Scenario: No outbound requests
- **WHEN** a valid launch page is loaded and an IDE is chosen
- **THEN** the browser makes no requests other than the launcher's own static assets and the IDE protocol launch

### Requirement: Accessible and usable layout
The launcher SHALL be keyboard operable, SHALL label its controls for assistive technology, SHALL follow the system light/dark preference with readable contrast, and SHALL remain usable on narrow windows.

#### Scenario: Keyboard only
- **WHEN** a reader uses only Tab and Enter
- **THEN** they can reach and activate each IDE choice, retry, install help, and copy controls in a logical order

### Requirement: Gated Pages deployment
The repository SHALL deploy only the `launcher/` directory to GitHub Pages through the existing gated workflow when launcher assets exist. Its committed generated assets SHALL match a fresh build, and workflow checks SHALL assert the deployed path and permissions, no longer asserting that the launcher is absent.

#### Scenario: Launcher present
- **WHEN** the workflow runs on `main` with `launcher/index.html` committed
- **THEN** the gate selects deployment and only `launcher/` is uploaded

#### Scenario: Stale generated assets
- **WHEN** launcher source changes without rebuilding the committed assets
- **THEN** `npm test` fails with a stale-asset message
