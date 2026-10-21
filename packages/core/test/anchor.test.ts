import { expect, it } from 'vitest';
import { captureAnchor } from '../src/anchor';
import { wholeLineRange } from '../src/coords';
import { LIMITS } from '../src/limits';
import { hashText } from '../src/text';

it('captures a unique selected line without extra context', () => {
  const text = 'before\nreturn null;\nafter';
  expect(captureAnchor(text, wholeLineRange(text, 2, 2))).toEqual({
    algorithm: 'sha256-lf-v1', selectionText: 'return null;',
    context: { startLine: 1, lineCount: 1, length: 12, hash: hashText('return null;'), unique: true },
    selectionInContext: { start: 0, end: 12 },
  });
});
it('widens repeated selection lines until their surroundings are unique', () => {
  const text = Array.from({ length: 5 }, (_, i) => `function f${i}() {\nreturn null;\n}`).join('\n');
  const anchor = captureAnchor(text, wholeLineRange(text, 5, 5));
  expect(anchor.context).toMatchObject({ startLine: 3, lineCount: 3, unique: true });
  expect(anchor.context.hash).toBe(hashText('function f1() {\nreturn null;\n}'));
  expect(anchor.selectionInContext.start).toBe('function f1() {\n'.length);
});
it('retains a nonunique capped context', () => {
  const text = Array.from({ length: 100 }, () => 'return null;').join('\n');
  const anchor = captureAnchor(text, wholeLineRange(text, 50, 50));
  expect(anchor.context).toMatchObject({ startLine: 49 - LIMITS.contextPadding, lineCount: 1 + 2 * LIMITS.contextPadding, unique: false });
});
