export interface Position { line: number; character: number }
export interface Range { start: Position; end: Position }

/** These helpers consume normalized text; offsets are UTF-16 code units. */
export function offsetToPosition(text: string, offset: number): Position {
  if (!Number.isInteger(offset) || offset < 0 || offset > text.length) throw new RangeError('Offset outside text.');
  const before = text.slice(0, offset);
  const line = before.split('\n').length - 1;
  return { line, character: offset - (before.lastIndexOf('\n') + 1) };
}

export function positionToOffset(text: string, position: Position): number {
  const lines = text.split('\n');
  if (!Number.isInteger(position.line) || !Number.isInteger(position.character) ||
      position.line < 0 || position.line >= lines.length || position.character < 0 ||
      position.character > lines[position.line].length) throw new RangeError('Position outside text.');
  let offset = position.character;
  for (let i = 0; i < position.line; i++) offset += lines[i].length + 1;
  return offset;
}

export function wholeLineRange(text: string, startLine: number, endLine: number): Range {
  const lines = text.split('\n');
  if (!Number.isInteger(startLine) || !Number.isInteger(endLine) || startLine < 1 ||
      endLine < startLine || endLine > lines.length) throw new RangeError('Line range outside text.');
  return { start: { line: startLine - 1, character: 0 }, end: { line: endLine - 1, character: lines[endLine - 1].length } };
}

export function comparePositions(a: Position, b: Position): number {
  return a.line - b.line || a.character - b.character;
}
