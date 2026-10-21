# Cross-player v1 conformance

From the workspace root:

```powershell
npm run fixtures:generate
npm run fixtures:check
```

`v1.json` is committed language-neutral input/expected output. Generation uses TypeScript core validation, normalization, SHA-256, coordinates, anchor capture and resolution, plus the actual VS Code `Session` implementation. Only its host event/context APIs are stubbed; navigation is not copied. IDs, timestamps and source are deterministic. Review expected-output changes before regenerating after a behavior change. `fixtures:check` fails on drift and runs with `npm test`.

Coordinates enumerate every UTF-16 offset, including inside surrogate pairs and terminal empty lines. Resolver cases retain original text, captured anchors and current text. Validation results preserve field paths/messages. Navigation snapshots follow each action and expose availability and subtree targets, including inactive calls, ancestor exits, last branches, and Previous after skipping.

The TypeScript unit test independently asserts important semantic outcomes rather than trusting generated expectations alone. Kotlin tests consume the committed JSON directly; generation/checking are development-only Node tooling and are not required for ordinary Kotlin tests or playback.
