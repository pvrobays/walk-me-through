---
name: walk-me-through
description: Use for explanations and bug investigations spanning several code locations; publish an evidence-backed walkthrough for local IDE playback alongside the normal answer.
---

# Walk Me Through

Use this skill when an explanation or investigation connects several source locations. Read [the format reference](references/walkthrough-format.md) before writing input.

## Author

1. Inspect the current source. Explain findings and supporting evidence, relevant rationale, assumptions, and uncertainty. Never request or expose private internal chain-of-thought.
2. Make the top-level sequence a concise, complete account of the requested mechanism or finding: include the main conclusion, consequences, essential uncertainty, and verification limits there. A reader using **Skip Details** must understand the story without children. In particular, say at the top level when a proposed repair has not been executed or tested.
3. Use children for optional supporting evidence, examples, and progressively deeper implementation detail. Add information rather than repeating the parent, and give children descriptive titles. Flat explanations are fine; do not add hierarchy merely to reach the depth limit. Write concise Markdown, prefer the smallest useful source ranges, and use `match` to select expressions precisely. Use honest optional evidence labels: `observation`, `hypothesis`, or `conclusion`.
4. Top-level narrative steps and grouping parents may omit a location. Nested leaves require one. Use at most four levels including the top level. Do not invent a source location for narrative content.
5. Write a UTF-8 JSON draft to `.walk-me-through/drafts/<slug>.json`. Create `.walk-me-through/.gitignore` containing `*` if absent so drafts are ignored too. Follow version 1 of the reference; do not supply IDs, columns, timestamps, or hashes.

## Publish

From the project root, run:

```sh
node .agents/skills/walk-me-through/scripts/publish-walkthrough.mjs .walk-me-through/drafts/<slug>.json
```

The script requires Node 20 or later, on native Windows or native Linux outside WSL, SSH, or containers. It needs no package installation. If `node` is missing, report that Node 20+ must be installed and available to the agent; never write an artifact or invent hashes by hand.

Read the single JSON result:

- `ok: true`: retain the returned ID, artifact path, warnings, `url` (when present), and `open` instructions. A `non-unique-anchor` warning means the original context could not be made unique; do not claim all locations are unambiguous. A `launch-link-too-long` warning means no `url` was returned; the saved walkthrough is still valid and opens through the picker.
- `ok: false`, `recovery: fix-input`: inspect the named field and current source, follow the repair hint, and correct the draft before retrying. For empty selections, select meaningful code or remove the location only for an eligible narrative/grouping step. For missing or ambiguous matches, correct the snippet/range using the reported line count or occurrence lines.
- `recovery: fix-environment`: report the required runtime, local execution setup, filesystem permissions, or free space. This is a publishing blocker until fixed.
- `recovery: report`: report the tool failure. Never fabricate an artifact or anchors.

Stop if the same error repeats and no new correction is available. Do not loop on unchanged invalid input. The development environment override is for explicit development/test use, not normal native Linux setup.

## Reply

Preserve the normal user-facing answer at the depth requested, including findings, evidence, rationale, and uncertainty. The walkthrough supplements that answer. Do not impose a short-summary limit or duplicate every walkthrough step.

On success, begin the final reply with a compact **Walkthrough available** section, before the explanation or conclusion:

1. The walkthrough title.
2. When the result has `url`: that exact URL as a clickable link, copied verbatim from the result. Never shorten, wrap, re-encode, edit, or reconstruct it, and never invent a link. The link opens a launcher page where the user chooses VS Code or Rider; it is replayable later.
3. The ID and the project-relative artifact path.
4. The fallback: run **Walk Me Through: Open Walkthrough** in VS Code or Rider and choose the title/ID in the picker.

When the result has no `url`, lead with the title, ID, path, and picker instructions only, and do not offer or fabricate a link. Follow this section with the full normal answer. The viewer never automatically opens the latest artifact. Restart OpenCode after installing or updating this skill so it discovers the bundle.

If publishing fails, still give the normal answer and state the remaining blocker. Do not claim a saved walkthrough exists.
