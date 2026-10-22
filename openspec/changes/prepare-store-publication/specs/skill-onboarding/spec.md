# Spec Delta

## Purpose

Lets a user who installed a Walk Me Through viewer from a store add the project skill to their repository from inside the IDE, and offers that once per project without becoming a nuisance.

## ADDED Requirements

### Requirement: Bundled skill
Each viewer package SHALL contain the four-file skill bundle (`SKILL.md`, `manifest.json`, `references/walkthrough-format.md`, `scripts/publish-walkthrough.mjs`), identical to the repository's canonical bundle at build time. Installation SHALL need no network access, Node, or repository clone.

#### Scenario: Package contents
- **WHEN** a reviewer inspects the built VSIX or plugin ZIP
- **THEN** it contains the four bundle files, and their normalized hashes equal the bundled `manifest.json`

### Requirement: Install target
The install target SHALL be `.agents/skills/walk-me-through/` under the nearest ancestor of the chosen project folder that contains a `.git` directory or file, or under the chosen folder itself when no ancestor does. With several candidate folders, the user SHALL choose one.

#### Scenario: Subfolder of a repository
- **WHEN** the open folder is `repo/src/app` and `repo/.git` exists
- **THEN** the skill is installed to `repo/.agents/skills/walk-me-through/`

#### Scenario: Worktree
- **WHEN** the open folder is a Git worktree whose `.git` is a file
- **THEN** the worktree root is the target

### Requirement: Install Skill command
Both IDEs SHALL offer **Walk Me Through: Install Skill into Project**. It SHALL write only missing files and SHALL leave identical files (after BOM and line-ending normalization) alone. If any existing file differs, it SHALL write nothing and SHALL name the differing files.

#### Scenario: Fresh install
- **WHEN** the user runs the command in a repository without the skill
- **THEN** the four files are created, and a message tells the user to commit `.agents/skills/walk-me-through/` and restart their agent so it discovers the skill

#### Scenario: Customized skill present
- **WHEN** `SKILL.md` already exists with different content
- **THEN** no file is written or overwritten, and the message names `SKILL.md` and says the skill was left unchanged

#### Scenario: Already installed
- **WHEN** all four files already match the bundle
- **THEN** nothing is written, and the user is told the skill is already installed

### Requirement: Missing-skill offer
When a project opens whose install target is inside a Git repository and lacks `.agents/skills/walk-me-through/SKILL.md`, the IDE SHALL show one non-modal notification per project per session. It SHALL offer **Install**, **Not for This Project**, and **Don't Ask Again**, and it SHALL NOT write any file without a click.

#### Scenario: Offer shown
- **WHEN** a Git project without the skill opens and no dismissal applies
- **THEN** a notification explains that agents need the project skill to create walkthroughs, and offers the three choices

#### Scenario: No offer outside Git or when installed
- **WHEN** the opened folder is not in a Git repository, or the skill's `SKILL.md` exists, including a customized one
- **THEN** no offer is shown

#### Scenario: Untrusted VS Code workspace
- **WHEN** VS Code opens the folder in Restricted Mode
- **THEN** no offer is shown, and the command remains available

### Requirement: Remembered dismissals
**Not for This Project** SHALL suppress the offer for that project in that IDE, persistently. **Don't Ask Again** SHALL suppress it for every project in that IDE, persistently. Neither SHALL disable the Install Skill command. Dismissal state SHALL be stored only in IDE-local state, never in project files.

#### Scenario: Project dismissal
- **WHEN** the user chooses Not for This Project and reopens that project later
- **THEN** no offer appears for it, while other projects still get the offer

#### Scenario: Global dismissal
- **WHEN** the user chooses Don't Ask Again
- **THEN** no project shows the offer again in that IDE, and the command still installs on request

#### Scenario: Ignoring the notification
- **WHEN** the user closes the notification without choosing
- **THEN** the offer may return in a later session
