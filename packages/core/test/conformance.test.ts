import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import { validateArtifact } from '../src/artifact';
import { resolve } from '../src/resolve';
import { normalizeText, occurrences } from '../src/text';
import { offsetToPosition, positionToOffset } from '../src/coords';

const fixtures = JSON.parse(readFileSync(new URL('../../../tests/conformance/v1.json', import.meta.url), 'utf8'));
it('executes committed validation, coordinate and resolver conformance cases', () => {
  for (const c of fixtures.validation) {
    const result = validateArtifact(c.input);
    expect({ ok: result.ok, errors: result.errors }, c.name).toEqual(c.expected);
  }
  for (const c of fixtures.coordinates) {
    expect(normalizeText(c.original), c.name).toBe(c.normalized);
    for (const p of c.positions) {
      expect(offsetToPosition(c.normalized, p.offset), c.name).toEqual(p.position);
      expect(positionToOffset(c.normalized, p.position), c.name).toBe(p.offset);
    }
    expect(occurrences(c.normalized, c.occurrences.needle), c.name).toEqual(c.occurrences.offsets);
  }
  for (const c of fixtures.resolutions) expect(resolve(c.anchor, c.range, c.current), c.name).toEqual(c.expected);
});
it('locks independent semantic expectations for matching and real-session traversal', () => {
  const resolution = (name: string) => fixtures.resolutions.find((c: any) => c.name === name).expected;
  expect(resolution('context-lost-single')).toMatchObject({ state: 'uncertain', reason: 'context-changed', candidateCount: 1 });
  expect(resolution('earlier-offset-tie')).toMatchObject({ state: 'uncertain', tie: true, range: { start: { line: 1, character: 0 } } });
  expect(resolution('line-before-character')).toMatchObject({ range: { start: { line: 0, character: 0 } } });
  expect(resolution('relocated')).toMatchObject({ state: 'relocated' });
  expect(resolution('stale')).not.toHaveProperty('range');
  const skip = fixtures.navigation.cases.find((c: any) => c.name === 'skip-then-previous');
  expect(skip.expected.map((s: any) => s.current)).toEqual(['overview', 'a', 'b', 'a2']);
  const final = fixtures.navigation.cases.find((c: any) => c.name === 'final-parent').expected[1];
  expect(final).toMatchObject({ current: 'b', next: true, skip: null });
});
