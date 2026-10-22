# Changelog

## 0.2.0

- **Install Skill into Project:** a new command copies the project skill shipped inside the extension into `.agents/skills/walk-me-through/` at the Git root. It adds only missing files and never overwrites a differing one.
- **Missing-skill offer:** opening a trusted Git project without the skill shows a notification with **Install**, **Not for This Project** and **Don't Ask Again**.
- **Banner:** while the skill is missing, the Walk Me Through view shows a banner with an **Install Skill** button, even after the offer was dismissed.
- **macOS:** native macOS is accepted, in addition to Windows and Linux. Linux and macOS are not verified by the maintainers; WSL, SSH, remote hosts and containers are still refused.
- **Store listing:** Marketplace README, icon, categories and third-party notices.
- The bundled skill is version 0.2.0; artifacts it publishes record `generator.bundleVersion: "0.2.0"`.

## 0.1.0

- First Marketplace upload: walkthrough playback with the step outline, Step view, inline comments and highlights, Skip Details, changed-code handling, and `vscode://` launch links.
