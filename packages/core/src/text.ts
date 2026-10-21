import { createHash } from 'node:crypto';

/** Preserve all whitespace except the encoding marker and line endings. */
export function normalizeText(text: string): string {
  return text.replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n');
}

export function decodeText(bytes: Uint8Array): string {
  if (bytes.includes(0)) throw new Error('Binary file: NUL bytes are not supported.');
  return normalizeText(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
}

export function splitLines(text: string): string[] {
  return normalizeText(text).split('\n');
}

export function hashText(text: string): string {
  return createHash('sha256').update(normalizeText(text), 'utf8').digest('hex');
}

export function hashFile(bytes: Uint8Array): string {
  return hashText(decodeText(bytes));
}

/** Includes overlapping occurrences. Empty needles have no meaningful matches. */
export function occurrences(text: string, needle: string): number[] {
  const offsets: number[] = [];
  if (!needle.length) return offsets;
  for (let offset = text.indexOf(needle); offset !== -1; offset = text.indexOf(needle, offset + 1)) {
    offsets.push(offset);
  }
  return offsets;
}
