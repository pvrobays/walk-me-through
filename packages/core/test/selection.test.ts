import { expect, it } from 'vitest';
import { resolveSelection } from '../src/selection';

const loc = { path: 'src/a.ts', startLine: 1, endLine: 3 };
it('selects whole lines, expressions and multiline snippets precisely', () => {
  const text = 'const x = 1;\n  run(x);\nfinish();\n';
  expect(resolveSelection(loc, text)).toMatchObject({ ok: true, value: { selectionText: text.trimEnd(), range: { start: { line: 0, character: 0 }, end: { line: 2, character: 9 } } } });
  expect(resolveSelection({ ...loc, match: 'run(x)' }, text)).toMatchObject({ ok: true, value: { range: { start: { line: 1, character: 2 }, end: { line: 1, character: 8 } } } });
  expect(resolveSelection({ ...loc, match: 'run(x);\r\nfinish' }, text)).toMatchObject({ ok: true, value: { range: { start: { line: 1, character: 2 }, end: { line: 2, character: 6 } } } });
});
it('reports actionable empty, missing, ambiguous and out-of-bounds errors', () => {
  const cases = [
    { location: loc, text: ' \n\t\n', code: 'EMPTY_SELECTION', hint: 'meaningful code' },
    { location: { ...loc, match: '' }, text: 'a\nb\nc', code: 'EMPTY_SELECTION', hint: 'meaningful code' },
    { location: { ...loc, match: 'absent' }, text: 'a\nb\nc', code: 'MATCH_NOT_FOUND', hint: 'Re-read' },
    { location: { ...loc, match: 'x' }, text: 'x\nx\nc', code: 'MATCH_AMBIGUOUS', hint: 'narrow' },
    { location: loc, text: 'only one', code: 'RANGE_OUT_OF_BOUNDS', hint: 'line count' },
  ];
  for (const c of cases) {
    const result = resolveSelection(c.location, c.text, 'steps[0].location');
    expect(result).toMatchObject({ ok: false, errors: [expect.objectContaining({ code: c.code, path: expect.stringContaining('steps[0].location'), recovery: 'fix-input', hint: expect.stringContaining(c.hint), details: expect.objectContaining({ sourcePath: loc.path, startLine: 1, endLine: 3, lineCount: c.text.split('\n').length }) })] });
    if (c.code === 'MATCH_AMBIGUOUS') expect(result.errors[0].details!.occurrenceLines).toEqual([1, 2]);
  }
});
