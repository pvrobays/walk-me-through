import { validateArtifact, type Artifact, type Step } from '../packages/core/src/artifact';
import { captureAnchor } from '../packages/core/src/anchor';
import { normalizeText, hashText, occurrences } from '../packages/core/src/text';
import { offsetToPosition, positionToOffset } from '../packages/core/src/coords';
import { resolve } from '../packages/core/src/resolve';
import { Session } from '../packages/vscode/src/session';

export function artifact(): Artifact {
  return {
    schemaVersion: 1, generator: { name: 'walk-me-through', bundleVersion: '0.1.0' },
    id: '20261021T143005123Z-abcdef', createdAt: '2026-10-21T14:30:05.123Z',
    title: 'Conformance', summary: '**Shared** v1 fixture',
    project: { root: 'C:/fixture', environment: { kind: 'local', platform: 'win32', unsupportedOverride: false } },
    source: { git: { commit: 'abcdef123', dirty: true } },
    steps: [{ id: 'a', parentId: null, title: 'Overview branch', explanation: 'Narrative' }],
  };
}
export function code(id: string, parentId: string | null = null): Step {
  const range = { start: { line: 0, character: 0 }, end: { line: 0, character: 1 } };
  return { id, parentId, title: id, explanation: '**Evidence**', evidence: 'observation',
    location: { path: 'src/sample.cs', range, anchor: captureAnchor('x', range) } };
}

export async function generateConformance() {
  const validations: { name: string; input: unknown; expected: unknown }[] = [];
  function validation(name: string, edit: (value: any) => unknown = value => value) {
    const input = edit(structuredClone(artifact()));
    const result = validateArtifact(input);
    validations.push({ name, input, expected: { ok: result.ok, errors: result.errors } });
  }
  validation('narrative-metadata');
  validation('unknown-fields-accepted', a => ({ ...a, future: { retained: true }, steps: [{ ...code('a'), future: 42 }] }));
  validation('four-levels-evidence', a => ({ ...a, steps: [code('a'), code('a1', 'a'), code('a11', 'a1'), { ...code('a111', 'a11'), evidence: 'hypothesis' }, { ...code('b'), evidence: 'conclusion' }] }));
  validation('group-without-location', a => ({ ...a, steps: [a.steps[0], { id: 'group', parentId: 'a', title: 'Group', explanation: 'Group' }, code('leaf', 'group')] }));
  for (const [name, field, value] of [
    ['bad-version', 'schemaVersion', 2], ['bad-id', 'id', 'latest'], ['bad-date', 'createdAt', '2026-02-30T00:00:00.000Z'],
    ['empty-title', 'title', ' '], ['missing-source', 'source', {}], ['no-steps', 'steps', []],
    ['generator-version', 'generator', { name: 'walk-me-through', bundleVersion: 'latest' }],
    ['relative-root', 'project', { root: 'relative', environment: { kind: 'local', platform: 'win32', unsupportedOverride: false } }],
  ] as const) validation(name, a => ({ ...a, [field]: value }));
  validation('not-object', () => null);
  const hierarchies: [string, Step[]][] = [
    ['duplicate', [code('a'), code('a')]], ['forward-cycle', [code('a', 'b'), code('b', 'a')]],
    ['missing-parent', [code('a', 'missing')]], ['self-parent', [code('a', 'a')]],
    ['non-depth-first', [code('a'), code('a1', 'a'), code('b'), code('a2', 'a')]],
    ['fifth-level', [code('a'), code('a1', 'a'), code('a11', 'a1'), code('a111', 'a11'), code('a1111', 'a111')]],
    ['nested-leaf', [code('a'), { id: 'a1', parentId: 'a', title: 'Leaf', explanation: 'No location' }]],
  ];
  for (const [name, steps] of hierarchies) validation(name, a => ({ ...a, steps }));
  for (const path of ['../escape', '/absolute', 'C:/outside', 'src\\file', 'src/../../escape']) {
    validation(`unsafe-path-${path}`, a => { const step = code('a'); step.location!.path = path; return { ...a, steps: [step] }; });
  }
  for (const [name, edit] of [
    ['empty-range', (s: Step) => { s.location!.range.end.character = 0; }],
    ['wrong-dimensions', (s: Step) => { s.location!.range.end.character = 2; }],
    ['negative-position', (s: Step) => { s.location!.range.start.line = -1; }],
    ['bad-hash', (s: Step) => { s.location!.anchor.context.hash = 'bad'; }],
    ['bad-algorithm', (s: any) => { s.location.anchor.algorithm = 'unknown'; }],
    ['bad-context-span', (s: Step) => { s.location!.anchor.context.lineCount = 10000; }],
    ['bad-relative-offsets', (s: Step) => { s.location!.anchor.selectionInContext.end = 2; }],
    ['unnormalized-selection', (s: Step) => { s.location!.anchor.selectionText = '\rx'; }],
    ['binary-selection', (s: Step) => { s.location!.anchor.selectionText = '\0'; }],
    ['bad-evidence', (s: any) => { s.evidence = 'proof'; }],
  ] as const) validation(name, a => { const step = code('a'); edit(step); return { ...a, steps: [step] }; });

  const coordinates = ['\uFEFF\t😀x\r\ny\rz\n', 'a\n', '😀\tvalue', 'a\r\nb\rc', 'aaa'].map((original, i) => {
    const normalized = normalizeText(original);
    return { name: `text-${i}`, original, normalized, hash: hashText(original),
      positions: Array.from({ length: normalized.length + 1 }, (_, offset) => ({ offset, position: offsetToPosition(normalized, offset) })),
      occurrences: { needle: i === 4 ? 'aa' : 'x', offsets: occurrences(normalized, i === 4 ? 'aa' : 'x') } };
  });
  // Independently assert coordinate reversibility before exporting expectations.
  for (const c of coordinates) for (const p of c.positions) {
    if (positionToOffset(c.normalized, p.position) !== p.offset) throw new Error(`Coordinate invariant: ${c.name}`);
  }

  const resolutions: { name: string; original: string; range: any; anchor: any; current: any; expected: any }[] = [];
  function resolution(name: string, original: string, selection: string, current: any, occurrence = 0) {
    original = normalizeText(original);
    const offset = occurrences(original, selection)[occurrence];
    const range = { start: offsetToPosition(original, offset), end: offsetToPosition(original, offset + selection.length) };
    const anchor = captureAnchor(original, range);
    resolutions.push({ name, original, range, anchor, current, expected: resolve(anchor, range, current) });
  }
  resolution('exact', 'head\nvalue(x)\ntail', 'x', 'head\nvalue(x)\ntail');
  resolution('bom-crlf-unicode', '\t😀x\ny', '😀x', '\uFEFF\t😀x\r\ny');
  resolution('relocated', 'head\nvalue(x)\ntail', 'x', 'new\nhead\nvalue(x)\ntail');
  resolution('context-lost-single', 'value(x)', 'x', 'changed(x)');
  resolution('multiple-contexts', 'x', 'x', 'new\nx\nx');
  resolution('equidistant-contexts', 'prefix\nx\nsuffix', 'x', 'prefix\nx\nsuffix\nchanged\nprefix\nx\nsuffix');
  resolution('earlier-offset-tie', 'a\nb\nx\nz', 'x', 'a\nx\nb\nx');
  resolution('line-before-character', 'aaaaax', 'x', 'x\nbbbbbx');
  resolution('character-distance', 'aaaaax', 'x', 'x aaaax');
  resolution('overlapping', 'aaaa', 'aa', 'baaaab', 1);
  resolution('multiline-exclusive-end', 'head\na\nb\ntail', 'a\nb\n', 'new\nhead\na\nb\ntail');
  resolution('missing', 'x', 'x', null);
  resolution('unreadable', 'x', 'x', { unreadable: true });
  resolution('nul', 'x', 'x', 'x\0');
  resolution('stale', 'x', 'x', 'y');

  const steps = [code('a'), code('a1', 'a'), code('a11', 'a1'), code('a111', 'a11'), code('a2', 'a'), code('b'), code('b1', 'b')];
  const navigationArtifact = { ...artifact(), steps };
  const navigation = [];
  for (const [name, actions] of [
    ['full-forward-back', ['open', ...Array(9).fill('next'), ...Array(9).fill('previous')]],
    ['skip-then-previous', ['open', 'skip', 'skip', 'previous']],
    ['ancestor-exits', ['open', 'select:a1', 'skip', 'skip', 'skip', 'next', 'next']],
    ['deep-selection-return', ['open', 'select:a111', 'return', 'skip', 'previous', 'select:missing', 'select:overview']],
    ['inactive-boundaries', ['next', 'previous', 'skip', 'select:a', 'return', 'open', 'close', 'next', 'skip', 'previous']],
    ['final-parent', ['open', 'select:b', 'skip', 'next', 'skip', 'previous']],
  ] as [string, string[]][]) {
    const session = new Session();
    const snapshots = [];
    for (const action of actions) {
      if (action === 'open') await session.open(navigationArtifact, {} as any);
      else if (action === 'close') await session.close();
      else if (action === 'next') await session.next();
      else if (action === 'previous') await session.previous();
      else if (action === 'skip') await session.skipDetails();
      else if (action === 'return') await session.refresh();
      else await session.goToStep(action.slice(7));
      snapshots.push({ active: session.isActive, index: session.index, current: session.isActive ? session.current?.id ?? 'overview' : null,
        previous: session.isActive && session.index > 0, next: session.isActive && session.index < steps.length,
        skip: session.skipDetailsTarget?.id ?? null });
    }
    session.dispose();
    navigation.push({ name, actions, expected: snapshots });
  }
  return { fixtureVersion: 1, validation: validations, coordinates, resolutions, navigation: { artifact: navigationArtifact, cases: navigation } };
}
