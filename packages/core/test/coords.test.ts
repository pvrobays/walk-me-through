import { expect, it } from 'vitest';
import { offsetToPosition, positionToOffset, wholeLineRange } from '../src/coords';
import { normalizeText } from '../src/text';

it('uses UTF-16 characters, including tabs and surrogate pairs', () => {
  const text = '\t😀value\nnext';
  expect(offsetToPosition(text, 3)).toEqual({ line: 0, character: 3 });
  for (let offset = 0; offset <= text.length; offset++) {
    expect(positionToOffset(text, offsetToPosition(text, offset))).toBe(offset);
  }
});

it('produces identical positions after LF/CRLF/BOM normalization and excludes line breaks', () => {
  for (const source of ['a\nbc\n', '\uFEFFa\r\nbc\r\n', 'a\rbc\r']) {
    const text = normalizeText(source);
    expect(wholeLineRange(text, 1, 2)).toEqual({ start: { line: 0, character: 0 }, end: { line: 1, character: 2 } });
    expect(positionToOffset(text, { line: 1, character: 2 })).toBe(4);
    expect(wholeLineRange(text, 3, 3).end).toEqual({ line: 2, character: 0 });
  }
});

it('rejects coordinates outside the text', () => {
  expect(() => offsetToPosition('x', 2)).toThrow(RangeError);
  expect(() => positionToOffset('x', { line: 0, character: 2 })).toThrow(RangeError);
  expect(() => wholeLineRange('x', 2, 1)).toThrow(RangeError);
});
