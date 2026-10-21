import { offsetToPosition, positionToOffset, wholeLineRange, type Range } from './coords';
import type { InputLocation } from './input';
import { normalizeText, occurrences } from './text';
import { problem, type Validation } from './validation';

export function resolveSelection(location: InputLocation, text: string, path = 'location'): Validation<{ range: Range; selectionText: string }> {
  const lineCount = text.split('\n').length;
  const details = { sourcePath: location.path, startLine: location.startLine, endLine: location.endLine, lineCount };
  const fail = (code: string, field: string, message: string, hint: string, extra = {}) => ({
    ok: false as const, errors: [{ ...problem(`${path}${field}`, message, code, hint), details: { ...details, ...extra } }],
  });
  if (location.startLine < 1 || location.endLine < location.startLine || location.endLine > lineCount) {
    return fail('RANGE_OUT_OF_BOUNDS', '', `Requested range is outside the file's ${lineCount} lines.`, 'Re-read the current file and correct the range using the reported line count before retrying.');
  }
  const whole = wholeLineRange(text, location.startLine, location.endLine);
  const base = positionToOffset(text, whole.start);
  let start = base; let end = positionToOffset(text, whole.end);
  if (location.match !== undefined) {
    const match = normalizeText(location.match);
    if (!match.trim()) return fail('EMPTY_SELECTION', '.match', 'The selection is empty or whitespace-only.', 'Inspect the current source and choose meaningful code; do not blindly broaden the range. For an eligible narrative/grouping step, remove the location. Retry only after correction.');
    const matches = occurrences(text.slice(start, end), match);
    if (!matches.length) return fail('MATCH_NOT_FOUND', '.match', 'The snippet does not occur in the requested lines.', 'Re-read the current file and correct the snippet or line range before retrying.');
    if (matches.length > 1) return fail('MATCH_AMBIGUOUS', '.match', 'The snippet occurs more than once in the requested lines.', 'Use the reported occurrence lines to narrow the range or extend the snippet until unique, then retry.', { occurrenceLines: matches.map(offset => offsetToPosition(text, base + offset).line + 1) });
    start = base + matches[0]; end = start + match.length;
  }
  const selectionText = text.slice(start, end);
  if (!selectionText.trim()) return fail('EMPTY_SELECTION', '', 'The selection is empty or whitespace-only.', 'Inspect the current source and choose meaningful code; do not blindly broaden the range. For an eligible narrative/grouping step, remove the location. Retry only after correction.');
  return { ok: true, value: { range: { start: offsetToPosition(text, start), end: offsetToPosition(text, end) }, selectionText }, errors: [] };
}
