import type { Artifact, Step } from '../src/artifact';

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
