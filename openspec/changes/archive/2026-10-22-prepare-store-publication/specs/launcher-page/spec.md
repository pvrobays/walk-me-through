# Spec Delta

## Purpose

Points the launcher's install help at the two store pages instead of the repository's local-build instructions.

## MODIFIED Requirements

### Requirement: Configurable help targets
Install-help destinations SHALL be defined in one configuration block and SHALL point to each viewer's Marketplace page. Changing a destination SHALL require changing only that block.

#### Scenario: Initial targets
- **WHEN** the reader opens install help for VS Code or Rider
- **THEN** the help links lead to the VS Code Marketplace or JetBrains Marketplace page for Walk Me Through