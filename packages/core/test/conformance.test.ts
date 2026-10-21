import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import { validateArtifact } from '../src/artifact';
import { resolve } from '../src/resolve';
import { normalizeText, occurrences } from '../src/text';
import { offsetToPosition, positionToOffset } from '../src/coords';
import {
  DEFAULT_LAUNCHER_BASE, LAUNCH_LIMITS, RIDER_LAUNCH_PREFIX, VSCODE_LAUNCH_PREFIX, buildEnvelope, decodeEnvelope, launcherUrl, riderUri, vscodeUri,
} from '../src/launch';

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

const launch = JSON.parse(readFileSync(new URL('../../../tests/conformance/launch-v1.json', import.meta.url), 'utf8'));
it('executes committed launch envelope decode and build cases', () => {
  expect(launch.limits).toEqual(LAUNCH_LIMITS);
  expect(launch.prefixes).toEqual({ launcherBase: DEFAULT_LAUNCHER_BASE, vscode: VSCODE_LAUNCH_PREFIX, rider: RIDER_LAUNCH_PREFIX });
  for (const c of launch.decode) expect(decodeEnvelope(c.encoded), c.name).toEqual(c.expected);
  for (const c of launch.build) {
    const result = buildEnvelope(c.artifact, c.step === undefined ? {} : { step: c.step });
    const { urls, ...expected } = c.expected;
    expect(result, c.name).toEqual(expected);
    if (result.ok) {
      expect(urls).toEqual({ launcher: launcherUrl(DEFAULT_LAUNCHER_BASE, result.encoded), vscode: vscodeUri(result.encoded), rider: riderUri(result.encoded) });
      expect(decodeEnvelope(result.encoded)).toEqual({ ok: true, envelope: result.envelope });
    }
  }
});
it('locks independent launch expectations', () => {
  const find = (name: string) => launch.decode.find((c: any) => c.name === name).expected;
  expect(find('valid-non-ascii-root').envelope.root).toBe('C:\\Users\\Jürgen\\项目');
  expect(find('valid-boundary-1536').ok).toBe(true);
  expect(launch.decode.find((c: any) => c.name === 'valid-boundary-1536').encoded).toHaveLength(1536);
  expect(find('too-long-1538').category).toBe('too-long');
  expect(find('unsupported-version-2').category).toBe('unsupported-version');
  expect(find('invalid-traversal-id').problems).toEqual([expect.objectContaining({ path: 'id' })]);
  expect(find('malformed-json-bom').category).toBe('malformed');
  const build = (name: string) => launch.build.find((c: any) => c.name === name).expected;
  expect(build('title-shortened').envelope.title).toHaveLength(120);
  expect(build('title-dropped').envelope).not.toHaveProperty('title');
  expect(build('too-long')).toMatchObject({ ok: false, code: 'launch-link-too-long' });
});
