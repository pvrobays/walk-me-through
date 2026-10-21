# Cross-player v1 conformance

From the workspace root:

```powershell
npm run fixtures:generate
npm run fixtures:check
```

`v1.json` is committed language-neutral input/expected output. Generation uses TypeScript core validation, normalization, SHA-256, coordinates, anchor capture and resolution, plus the actual VS Code `Session` implementation. Only its host event/context APIs are stubbed; navigation is not copied. IDs, timestamps and source are deterministic. Review expected-output changes before regenerating after a behavior change. `fixtures:check` fails on drift and runs with `npm test`.

Coordinates enumerate every UTF-16 offset, including inside surrogate pairs and terminal empty lines. Resolver cases retain original text, captured anchors and current text. Validation results preserve field paths/messages. Navigation snapshots follow each action and expose availability and subtree targets, including inactive calls, ancestor exits, last branches, and Previous after skipping.

The TypeScript unit test independently asserts important semantic outcomes rather than trusting generated expectations alone. Kotlin tests consume the committed JSON directly; generation/checking are development-only Node tooling and are not required for ordinary Kotlin tests or playback.

## Launch envelope v1 (`launch-v1.json`)

The same commands regenerate and check `launch-v1.json`, which is produced from `packages/core/src/launch.ts`:

```powershell
npm run fixtures:generate   # writes v1.json and launch-v1.json
npm run fixtures:check      # fails with "Conformance fixture drift in tests/conformance/launch-v1.json" when stale
```

Contents:

- `limits` and `prefixes`: the 1,536-character encoded limit, the title and step limits, the default launcher base, and the VS Code and Rider URI prefixes.
- `decode`: encoded inputs with the full expected decoder result. A result is either `{ok: true, envelope}` or `{ok: false, category, problems: [{path, message}]}`, where `category` is one of `malformed`, `too-long`, `unsupported-version`, or `invalid`. The cases cover:
  - non-ASCII, supplementary-plane and escaped lone-surrogate values;
  - padding, alphabet, length and non-canonical-bit errors;
  - invalid UTF-8 (overlong forms, surrogates, values above U+10FFFF, truncation);
  - JSON that lenient parsers would accept (comments, single quotes, trailing commas, BOM, NaN);
  - non-object JSON;
  - newer versions;
  - field problems, with unknown members reported in sorted order;
  - the exact 1,536 boundary.
- `build`: artifact fields and an optional step, with the built envelope, its encoding, and the launcher, VS Code and Rider URLs. Builds cover title shortening (including surrogate pairs), title dropping, and `launch-link-too-long`.

Each decode case declares its intended category in the generator, so a rule change that moves a case to a different category fails generation instead of silently rewriting the expectations. Decoders must match every result exactly, including problem order and messages. Duplicate JSON members resolve to the last value, as `JSON.parse` does. The Rider Kotlin decoder runs these cases without Node.
