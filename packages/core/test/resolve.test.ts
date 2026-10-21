import { expect, it } from 'vitest';
import { captureAnchor } from '../src/anchor';
import { wholeLineRange } from '../src/coords';
import { resolve } from '../src/resolve';
import { normalizeText } from '../src/text';

it('is exact for unchanged LF/CRLF/BOM text and edits outside context', () => {
  const text = 'before\nselected();\nafter'; const range = wholeLineRange(text, 2, 2); const anchor = captureAnchor(text, range);
  for (const current of [text, '\uFEFF' + text.replace(/\n/g, '\r\n'), 'before\nselected();\nchanged below']) {
    expect(resolve(anchor, range, current)).toMatchObject({ state: 'exact', range });
  }
  expect(captureAnchor(normalizeText('\uFEFF' + text.replace(/\n/g, '\r\n')), range)).toEqual(anchor);
});
it('relocates after insertions above, including before the first playback', () => {
  const text = 'before\nselected();\nafter'; const range = wholeLineRange(text, 2, 2);
  expect(resolve(captureAnchor(text, range), range, '1\n2\n3\n' + text)).toMatchObject({ state: 'relocated', range: { start: { line: 4, character: 0 }, end: { line: 4, character: 11 } } });
});
it('uses nearest duplicate context and records equal-distance ties', () => {
  const text = 'before\nselected();\nafter'; const range = wholeLineRange(text, 2, 2); const anchor = captureAnchor(text, range);
  expect(resolve(anchor, range, 'selected();\nchanged\nselected();')).toMatchObject({ state: 'uncertain', reason: 'multiple-context-matches', tie: true, candidateCount: 2, range: { start: { line: 0, character: 0 } } });
  expect(resolve(anchor, range, 'changed\nchanged\nselected();\n\n\n\nselected();')).toMatchObject({ state: 'uncertain', tie: false, range: { start: { line: 2, character: 0 } } });
});
it('marks an intact expression uncertain when its original context changed, even for one occurrence', () => {
  const text = 'before\nconst result = run();\nafter';
  const range = { start: { line: 1, character: 15 }, end: { line: 1, character: 20 } };
  const anchor = captureAnchor(text, range);
  expect(resolve(anchor, range, 'before\nlet changed = run();\nafter')).toMatchObject({ state: 'uncertain', reason: 'context-changed', candidateCount: 1 });
});
it('uses character distance after line distance', () => {
  const text = '0123456789x'; const range = { start: { line: 0, character: 10 }, end: { line: 0, character: 11 } };
  expect(resolve(captureAnchor(text, range), range, 'x     x')).toMatchObject({ state: 'uncertain', range: { start: { line: 0, character: 6 } } });
});
it('is stale without a range for edited selections, deleted and unreadable files', () => {
  const text = 'selected();'; const range = wholeLineRange(text, 1, 1); const anchor = captureAnchor(text, range);
  for (const [current, reason] of [['edited();', 'not-found'], [null, 'file-missing'], [{ unreadable: true }, 'unreadable']] as const) {
    const result = resolve(anchor, range, current);
    expect(result).toEqual({ state: 'stale', reason, candidateCount: 0 });
    expect(result.range).toBeUndefined();
  }
});
