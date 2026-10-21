import { expect, it } from 'vitest';
import { validateArtifact, type Artifact, type Step } from '../src/artifact';

export function fixture(): Artifact {
  return {
    schemaVersion: 1, generator: { name: 'walk-me-through', bundleVersion: '0.1.0' },
    id: '20261021T143005123Z-abcdef', createdAt: '2026-10-21T14:30:05.123Z', title: 'Retry', summary: 'Summary',
    project: { root: '/project', environment: { kind: 'local', platform: 'linux', unsupportedOverride: false } },
    source: { git: null }, steps: [{ id: 's1', parentId: null, title: 'Context', explanation: 'Narrative' }],
  };
}
export function codeStep(id = 's1', parentId: string | null = null): Step {
  return { id, parentId, title: 'Code', explanation: 'Evidence', location: {
    path: 'src/retry.ts', range: { start: { line: 0, character: 0 }, end: { line: 0, character: 1 } },
    anchor: { algorithm: 'sha256-lf-v1', selectionText: 'x', context: { startLine: 0, lineCount: 1, length: 1, hash: 'a'.repeat(64), unique: true }, selectionInContext: { start: 0, end: 1 } },
  } };
}
it('accepts identity, narrative, grouping parents, four levels, and evidence', () => {
  const artifact = fixture();
  artifact.steps = [codeStep(), { id: 's2', parentId: 's1', title: 'Group', explanation: 'Group' }, codeStep('s3', 's2'), codeStep('s4', 's3')];
  artifact.steps[3].evidence = 'hypothesis';
  expect(validateArtifact(artifact)).toMatchObject({ ok: true });
});
it('rejects fifth levels, duplicate IDs, missing/forward parents, cycles and nested leaves without locations', () => {
  const cases = [
    [codeStep(), codeStep('s2', 's1'), codeStep('s3', 's2'), codeStep('s4', 's3'), codeStep('s5', 's4')],
    [codeStep(), codeStep()], [codeStep('s1', 'absent')], [codeStep('s1', 's2'), codeStep('s2', 's1')],
    [codeStep(), { id: 's2', parentId: 's1', title: 'Leaf', explanation: 'Missing location' }],
  ];
  for (const steps of cases) expect(validateArtifact({ ...fixture(), steps }).ok).toBe(false);
});
it('rejects paths escaping the project', () => {
  for (const path of ['../secret', '/secret', 'C:/secret', 'src/../../secret', 'src\\file', '//host/file']) {
    const step = codeStep(); step.location!.path = path;
    expect(validateArtifact({ ...fixture(), steps: [step] })).toMatchObject({ ok: false, errors: expect.arrayContaining([expect.objectContaining({ path: 'steps[0].location.path' })]) });
  }
});
it('collects identity and range/anchor problems with paths, and requests viewer updates', () => {
  const step = codeStep(); step.location!.range.end.character = 0; step.location!.anchor.context.hash = 'invalid';
  const result = validateArtifact({ ...fixture(), schemaVersion: 2, createdAt: 'yesterday', title: '', steps: [step] });
  expect(result.ok).toBe(false);
  expect(result.errors).toEqual(expect.arrayContaining([
    expect.objectContaining({ path: 'schemaVersion', message: expect.stringContaining('Update the viewer') }),
    expect.objectContaining({ path: 'createdAt' }), expect.objectContaining({ path: 'title' }),
    expect.objectContaining({ path: 'steps[0].location.range' }), expect.objectContaining({ path: 'steps[0].location.anchor.context' }),
  ]));
});
it('rejects malformed documents without throwing', () => {
  for (const value of [null, [], {}, { steps: [null, {}] }]) expect(validateArtifact(value).ok).toBe(false);
});
