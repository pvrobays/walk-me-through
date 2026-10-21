# Proposal

## Why

Manual acceptance showed that a correct walkthrough can still be too verbose for experienced readers. Use its existing hierarchy to offer a concise complete story with optional deep dives, and make uncertainty notices visible without dominating the explanation.

## What Changes

- Teach the skill to make top-level steps a complete concise account of the mechanism, finding, consequence, and essential caveats; children add evidence and progressively deeper detail.
- Add **Skip Details** navigation that moves past the current subtree, including from inside a final nested branch, without changing depth-first Next/Previous or collapse behavior.
- Make the action discoverable in the Step view, comment-header controls, and Command Palette, with availability based on the actual target.
- Compact uncertainty notices and use smaller text in the Step view, retaining explicit closest-identical-code and tie information, warning color/icon, and dashed highlights.
- Preserve the accepted red stale presentation and leading **Walkthrough available** reply section.
- Refresh the sample/reference and validate both a concise reading path and the full deep-dive path with the owner.

## Capabilities

### New Capabilities

- `progressive-explanations`: Authoring guidance for a self-contained concise top level and optional nested evidence/deep dives.
- `subtree-navigation`: Explicit detail-skipping navigation alongside the existing depth-first traversal.
- `anchor-state-notices`: Compact, accessible uncertainty notices that remain distinct from confident and stale states.

There are currently no main specs (`openspec list --specs` is empty). These focused capabilities supplement, rather than duplicate or replace, `skill-bundle` and `walkthrough-playback` in the completed, unarchived `add-walkthrough-vertical-slice` change. Their existing contracts remain the baseline.

### Modified Capabilities

None in the main spec inventory.

## Impact

- Skill guidance, format-reference examples, sample walkthrough input, generated manifest, and documentation.
- VS Code session target calculation/context keys, commands/menus, Step-view controls, and comment notice formatting.
- Extension-host navigation/notice regression coverage and a short Windows manual/real-agent acceptance pass.
- No input/artifact schema change, new dependency, depth limit change, reading mode, or reader-seniority classification. Linux remains unofficially supported; native Linux acceptance is not required for this change.
- Launcher, URI/window routing, onboarding, and distribution remain later milestones. Implementation is a separate session; this change contains planning only.
