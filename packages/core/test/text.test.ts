import { describe, expect, it } from 'vitest';
import { decodeText, hashFile, hashText, normalizeText, occurrences, splitLines } from '../src/text';

describe('source text', () => {
  it('normalizes BOM, CRLF, lone CR and preserves trailing empty lines', () => {
    const source = '\uFEFFa\r\nb\rc\n';
    expect(decodeText(Buffer.from(source))).toBe('a\nb\nc\n');
    expect(splitLines(source)).toEqual(['a', 'b', 'c', '']);
    expect(hashFile(Buffer.from(source))).toBe(hashText('a\nb\nc\n'));
    expect(normalizeText(' a\t ')).toBe(' a\t ');
  });
  it('rejects invalid UTF-8 and binary files', () => {
    expect(() => decodeText(new Uint8Array([0xc3, 0x28]))).toThrow();
    expect(() => decodeText(Buffer.from('a\0b'))).toThrow('NUL');
  });
  it('finds overlapping matches', () => {
    expect(occurrences('aaaa', 'aa')).toEqual([0, 1, 2]);
  });
});
