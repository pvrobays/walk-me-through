# Walkthrough input v1

Write UTF-8 JSON, then invoke `node .agents/skills/walk-me-through/scripts/publish-walkthrough.mjs <input.json> [--root <dir>]`. The input path is relative to the working directory. Source paths use the installed bundle's project root; `--root` overrides it for development. The consuming project needs only Node 20+, with no dependencies to install.

## Fields

Unknown fields are rejected. Do not provide IDs, hashes, timestamps, or columns.

| Object | Fields |
| --- | --- |
| Document | `version`: exactly `1`; `title`: nonempty string; `summary`: nonempty Markdown string; `steps`: nonempty array |
| Step | `title`: nonempty string; `explanation`: nonempty Markdown string; optional `evidence`: `observation`, `hypothesis`, or `conclusion`; optional `location`; optional nonempty `children` array of steps |
| Location | `path`: project-relative forward-slash path; `startLine` and `endLine`: 1-based inclusive integers; optional `match`: exact text within those lines |

Top-level steps and grouping parents may omit a location. Nested leaves require one. Maximum nesting is four levels including the top level. Paths must stay inside the root after symlinks resolve; absolute paths and `..` segments are forbidden. Referenced files must be UTF-8 text without NUL bytes.

Without `match`, the entire range is selected, excluding its final line break. With `match`, exactly one occurrence, including overlapping occurrences, must exist within the range. BOMs are stripped; CRLF and lone CR become LF. All other whitespace is significant. Empty and whitespace-only selections are rejected. The script computes 0-based UTF-16 character positions and captures original anchors from disk.

## Two reading paths

Write the top-level sequence as a concise, self-contained account of the mechanism or finding, its consequence, and essential caveats. Keep uncertainty and verification limits (including an untested proposed repair) understandable without children. Readers can use **Skip Details** to follow this path.

Each nested level adds optional evidence, examples, or implementation depth, with descriptive titles and no repeated parent explanation or missing main conclusion. **Next** follows the full depth-first path; **Previous** always reverses that order, even after a skip. Use a flat sequence when no deep dive is useful; do not nest merely to reach four levels. Keep precise minimal locations and the nested-leaf location rules above. The walkthrough supplements the normal answer at the user's requested depth; successful replies still lead with **Walkthrough available**: title, the returned launch `url` verbatim when present, ID, artifact path, and the picker fallback.

## Example

This example runs against `examples/sample-project` using `--root examples/sample-project` from the repository root. Its two top-level steps stand alone; children add failure-path and helper evidence. The sample input in that directory adds a four-level deep dive. Both include precise expressions and multiline selections.

```json
{
  "version": 1,
  "title": "Why retries never back off",
  "summary": "The retry loop always passes zero to the exponential delay helper.",
  "steps": [
    { "title": "Retries wait without backing off", "explanation": "Failed operations retry up to the configured limit, with the final failure rethrown. Earlier failures always pass zero to the exponential helper, so every wait is 100 ms with the default base. This is source inspection, not a runtime measurement." },
    {
      "title": "Proposed repair: pass the attempt counter",
      "explanation": "Passing `attempt` instead of `0` would allow 100, 200, 400 ms waits as the zero-based counter grows. This repair has not been executed or tested; validate timing, retry counts, and final-error behavior before relying on it.",
      "evidence": "hypothesis",
      "location": { "path": "src/retry.ts", "startLine": 9, "endLine": 9, "match": "retryDelay(0)" },
      "children": [
        {
          "title": "Final failure bypasses the timer",
          "explanation": "The final-attempt guard runs before delay calculation and the timer; successful operations return directly. The default three-attempt budget therefore permits two waits.",
          "evidence": "observation",
          "location": { "path": "src/retry.ts", "startLine": 5, "endLine": 10 }
        },
        {
          "title": "Helper arithmetic has no cap or jitter",
          "explanation": "The default base is 100, multiplied by `2 ** attempt`. The helper implements neither a maximum delay nor random jitter; changing its caller adds neither.",
          "evidence": "observation",
          "location": { "path": "src/timing.ts", "startLine": 1, "endLine": 3 }
        }
      ]
    }
  ]
}
```

## Limits

| Limit | Maximum |
| --- | --- |
| Input file | 1 MiB (1,048,576 bytes) |
| Steps | 200 |
| Title | 200 UTF-16 characters |
| Summary | 10,000 characters |
| Explanation | 20,000 characters |
| `match` | 2,000 characters |
| Location span | 300 lines |
| Referenced source file | 2 MiB (2,097,152 bytes) |
| Context padding | 10 lines above and below the selection |

## Results and recovery

Stdout contains exactly one JSON object. Exit code **0** means success, **1** means invalid input/source selections, and **2** means usage, environment, filesystem, or internal failure.

Success contains `ok: true`, `id`, project-relative `artifactPath`, `stepCount`, `warnings`, an optional `url`, and `open` instructions identifying the title and ID. Both players consume the same v1 artifact and shared authoring bundle. `non-unique-anchor` warnings name the affected `stepId` and input `path`. Artifacts are immutable under `.walk-me-through/walkthroughs/`; that tree ignores itself via `.walk-me-through/.gitignore` containing `*`.

`url` is a replayable HTTPS launcher link, `https://pvrobays.github.io/walk-me-through/#<envelope>`. Its fragment is a script-built envelope that identifies this artifact in this checkout on this machine. Copy it verbatim as a clickable link. Never shorten, wrap, re-encode, edit, or construct one. The launcher page sends nothing to a server. It shows what will open and offers explicit **Open in VS Code** and **Open in Rider** choices, with install help and a retry. `open` then reads: `Open <url> and choose VS Code or Rider, or run Walk Me Through: Open Walkthrough in VS Code or Rider and choose "<title>" (ID <id>) in the picker.`

If the envelope would exceed 1,536 characters (in practice, only for a very long project root), the artifact is still saved and the result is still a success. `url` is then omitted, `warnings` contains `{code: "launch-link-too-long", length, limit: 1536}`, and `open` gives only the picker instructions. Reply with the picker fallback and never invent a link.

The publisher's `--launcher-url <base>` option exists only for repository development (previewing a local launcher page). Agents never pass it. An invalid value fails with `INVALID_LAUNCHER_URL`.

Failures contain `ok: false` and `errors`. Every error has `code`, field `path` (`$` for document/runtime errors), `message`, repair `hint`, and `recovery`. Source failures also include `details.sourcePath`, requested `startLine`/`endLine`, and current `lineCount` where available. Ambiguity includes `occurrenceLines`. Files are not dumped into errors.

| Code | Recovery and repair |
| --- | --- |
| `INVALID_INPUT`, `INVALID_JSON` | `fix-input`: correct the named field/type or JSON/UTF-8 syntax |
| `INPUT_TOO_LARGE`, `SOURCE_TOO_LARGE` | `fix-input`: reduce input or choose a source file within limits |
| `EMPTY_SELECTION` | `fix-input`: inspect source and choose meaningful code; remove location only for eligible narrative/grouping steps |
| `MATCH_NOT_FOUND` | `fix-input`: re-read current source and correct snippet or range |
| `MATCH_AMBIGUOUS` | `fix-input`: use occurrence lines to narrow range or extend snippet until unique |
| `RANGE_OUT_OF_BOUNDS` | `fix-input`: correct range using current line count |
| `SOURCE_UNREADABLE`, `SOURCE_OUTSIDE_ROOT` | `fix-input`: choose an existing UTF-8 source inside the real project root |
| `INPUT_FILE_NOT_FOUND`, `ROOT_NOT_RESOLVED`, `USAGE` | `fix-input`: correct invocation, input path, or development `--root` |
| `INVALID_LAUNCHER_URL` | `fix-input`: development-only `--launcher-url` was not `https://` or `http://localhost`/`127.0.0.1`; omit it in normal use |
| `NODE_VERSION_UNSUPPORTED`, `ENVIRONMENT_UNSUPPORTED` | `fix-environment`: report Node 20+ / local desktop (native Windows, Linux or macOS) setup requirements |
| `ARTIFACT_WRITE_FAILED` | `fix-environment`: report filesystem failure; check permissions/free space |
| `INTERNAL_ERROR` | `report`: report the tool failure without fabricating an artifact |

`fix-input` means retry **only after correction**. `fix-environment` and `report` are blockers until resolved. Stop if an identical error recurs without a new correction available. Preserve the normal user-facing answer even when publishing fails.

### Error examples

- Blank line: `EMPTY_SELECTION`, path `steps[0].location`, details `{sourcePath: "src/retry.ts", startLine: 2, endLine: 2, lineCount: 15}`. Read the source and select meaningful code; do not blindly broaden the range.
- Missing snippet: `MATCH_NOT_FOUND`, path `steps[0].location.match`. Re-read the current file and correct the snippet or range.
- Repeated snippet: `MATCH_AMBIGUOUS`, details include `occurrenceLines: [9, 12]`. Narrow the range or extend the snippet until unique.
- WSL, SSH, or container: `ENVIRONMENT_UNSUPPORTED`, recovery `fix-environment`. Use a local desktop process on native Windows, Linux or macOS. Native Linux and macOS need no override. `WALK_ME_THROUGH_ALLOW_UNSUPPORTED_ENVIRONMENT=1` is development/test-only, records `unsupportedOverride: true`, and never bypasses Node 20+.
- Tool failure: `INTERNAL_ERROR`, recovery `report`. State the blocker; do not repeatedly retry or manufacture anchors.
