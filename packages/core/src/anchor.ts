import type { Anchor } from './artifact';
import { positionToOffset, type Range } from './coords';
import { LIMITS } from './limits';
import { hashText, occurrences } from './text';

export function lineAligned(text: string, start: number, end: number): boolean {
  return start >= 0 && end <= text.length && (start === 0 || text[start - 1] === '\n') && (end === text.length || text[end] === '\n');
}

export function captureAnchor(text: string, range: Range): Anchor {
  const lines = text.split('\n');
  const selectionStart = positionToOffset(text, range.start);
  const selectionEnd = positionToOffset(text, range.end);
  const selectionText = text.slice(selectionStart, selectionEnd);
  if (!selectionText.trim()) throw new Error('Cannot anchor an empty selection.');
  const matches = occurrences(text, selectionText);
  for (let padding = 0; ; padding++) {
    const startLine = Math.max(0, range.start.line - padding);
    const endLine = Math.min(lines.length - 1, range.end.line + padding);
    const context = lines.slice(startLine, endLine + 1).join('\n');
    const contextStart = positionToOffset(text, { line: startLine, character: 0 });
    const relativeStart = selectionStart - contextStart;
    const count = matches.filter(offset => {
      const start = offset - relativeStart; const end = start + context.length;
      return lineAligned(text, start, end) && text.slice(start, end) === context;
    }).length;
    const unique = count === 1;
    if (unique || padding === LIMITS.contextPadding) return {
      algorithm: 'sha256-lf-v1', selectionText,
      context: { startLine, lineCount: endLine - startLine + 1, length: context.length, hash: hashText(context), unique },
      selectionInContext: { start: relativeStart, end: selectionEnd - contextStart },
    };
  }
}
