import { lineAligned } from './anchor';
import type { Anchor } from './artifact';
import { offsetToPosition, type Range } from './coords';
import { hashText, normalizeText, occurrences } from './text';

export interface Resolution {
  state: 'exact' | 'relocated' | 'uncertain' | 'stale';
  range?: Range;
  reason?: 'multiple-context-matches' | 'context-changed' | 'file-missing' | 'unreadable' | 'not-found';
  tie?: boolean;
  candidateCount: number;
}

export function resolve(anchor: Anchor, range: Range, currentText: string | null | { unreadable: true }): Resolution {
  if (currentText === null) return { state: 'stale', reason: 'file-missing', candidateCount: 0 };
  if (typeof currentText !== 'string' || currentText.includes('\0')) return { state: 'stale', reason: 'unreadable', candidateCount: 0 };
  const text = normalizeText(currentText);
  const lines = text.split('\n');
  const context = anchor.context;
  if (context.startLine + context.lineCount <= lines.length &&
      hashText(lines.slice(context.startLine, context.startLine + context.lineCount).join('\n')) === context.hash) {
    return { state: 'exact', range, candidateCount: 1 };
  }
  const matches = occurrences(text, anchor.selectionText);
  const contexts = matches.filter(offset => {
    const start = offset - anchor.selectionInContext.start;
    const end = start + context.length;
    return lineAligned(text, start, end) && hashText(text.slice(start, end)) === context.hash;
  });
  const candidates = contexts.length ? contexts : matches;
  if (!candidates.length) return { state: 'stale', reason: 'not-found', candidateCount: 0 };
  const ranked = candidates.map(offset => {
    const start = offsetToPosition(text, offset);
    return { offset, start, lineDistance: Math.abs(start.line - range.start.line), characterDistance: Math.abs(start.character - range.start.character) };
  }).sort((a, b) => a.lineDistance - b.lineDistance || a.characterDistance - b.characterDistance || a.offset - b.offset);
  const best = ranked[0]; const second = ranked[1];
  const tie = !!second && best.lineDistance === second.lineDistance && best.characterDistance === second.characterDistance;
  return {
    state: contexts.length === 1 ? 'relocated' : 'uncertain',
    range: { start: best.start, end: offsetToPosition(text, best.offset + anchor.selectionText.length) },
    ...(contexts.length === 1 ? {} : { reason: contexts.length > 1 ? 'multiple-context-matches' as const : 'context-changed' as const, tie }),
    candidateCount: candidates.length,
  };
}
