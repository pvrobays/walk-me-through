import { validateArtifact, type Artifact, type Step } from '../packages/core/src/artifact';
import { captureAnchor } from '../packages/core/src/anchor';
import { normalizeText, hashText, occurrences } from '../packages/core/src/text';
import { offsetToPosition, positionToOffset } from '../packages/core/src/coords';
import { resolve } from '../packages/core/src/resolve';
import {
  DEFAULT_LAUNCHER_BASE, LAUNCH_LIMITS, RIDER_LAUNCH_PREFIX, VSCODE_LAUNCH_PREFIX, base64urlEncode, buildEnvelope, decodeEnvelope,
  encodeEnvelope, launcherUrl, riderUri, utf8Encode, vscodeUri,
} from '../packages/core/src/launch';
import { Session } from '../packages/vscode/src/session';
export { generateSkillInstallConformance } from './conformance-skill';

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

/** Launch envelope v1 fixtures, consumed by core and the Rider Kotlin decoder. */
export function generateLaunchConformance() {
  const id = '20261021T143005123Z-abcdef';
  const env = { kind: 'local', platform: 'win32' };
  const base = { v: 1, root: 'C:\\repo', env, id };
  const bytes = (values: number[]) => base64urlEncode(Uint8Array.from(values));
  const text = (json: string) => base64urlEncode(utf8Encode(json));
  const json = (value: unknown) => text(JSON.stringify(value));
  const rootFor = (target: number) => {
    for (let n = 1; n < 2000; n++) {
      const root = 'C:\\' + 'r'.repeat(n);
      if (encodeEnvelope({ ...base, v: 1, root }).length === target) return root;
    }
    throw new Error('no root');
  };
  const valid = encodeEnvelope({ ...base, v: 1, step: 's2', title: 'Retry flow' });

  type Expect = 'ok' | 'malformed' | 'too-long' | 'unsupported-version' | 'invalid';
  const decode: { name: string; encoded: string; expected: unknown }[] = [];
  const add = (name: string, encoded: string, category: Expect) => {
    const result = decodeEnvelope(encoded);
    // Independently assert the intended category so a rule change cannot silently rewrite expectations.
    const actual = result.ok ? 'ok' : result.category;
    if (actual !== category) throw new Error(`Launch fixture ${name}: expected ${category}, got ${actual}`);
    decode.push({ name, encoded, expected: result });
  };
  add('valid-minimal', json(base), 'ok');
  add('valid-step-title', valid, 'ok');
  add('valid-non-ascii-root', json({ ...base, root: 'C:\\Users\\Jürgen\\项目', title: 'Ünïcödé 项目' }), 'ok');
  add('valid-supplementary-plane', json({ ...base, root: '/home/me/𝄞', title: 'Emoji 😀 and 𝄞' }), 'ok');
  add('valid-escaped-lone-surrogate', text(`{"v":1,"root":"C:\\\\repo","env":{"kind":"local","platform":"win32"},"id":"${id}","title":"\\ud800"}`), 'ok');
  add('valid-posix-root', json({ ...base, root: '/' }), 'ok');
  add('valid-unc-root', json({ ...base, root: '\\\\server\\share' }), 'ok');
  add('valid-forward-slash-drive', json({ ...base, root: 'c:/repo' }), 'ok');
  add('valid-member-order-whitespace', text(`{ "id" : "${id}" ,\n\t"env":{"platform":"linux","kind":"wsl"}, "root":"/r", "v":1 }`), 'ok');
  add('valid-version-float-literal', text(`{"v":1.0,"root":"/r","env":{"kind":"local","platform":"win32"},"id":"${id}"}`), 'ok');
  add('valid-duplicate-member-last-wins', text(`{"v":1,"root":"/r","env":{"kind":"local","platform":"win32"},"id":"bad","id":"${id}"}`), 'ok');
  add('valid-step-200', json({ ...base, step: 'x'.repeat(200) }), 'ok');
  add('valid-title-120', json({ ...base, title: 't'.repeat(120) }), 'ok');
  add('valid-empty-title', json({ ...base, title: '' }), 'ok');
  add('valid-boundary-1536', encodeEnvelope({ ...base, v: 1, root: rootFor(1536) }), 'ok');

  // 1,537 is not a possible unpadded base64 length; 1,538 is the shortest real envelope over the limit.
  add('too-long-1538', encodeEnvelope({ ...base, v: 1, root: rootFor(1538) }), 'too-long');
  add('too-long-garbage', '*'.repeat(LAUNCH_LIMITS.encoded + 1), 'too-long');

  add('malformed-empty', '', 'malformed');
  add('malformed-padding', json(base).slice(0, -2) + '==', 'malformed');
  add('malformed-alphabet-plus', valid.slice(0, 8) + '+' + valid.slice(9), 'malformed');
  add('malformed-alphabet-slash', valid.slice(0, 8) + '/' + valid.slice(9), 'malformed');
  add('malformed-alphabet-space', valid.slice(0, 8) + ' ' + valid.slice(9), 'malformed');
  add('malformed-alphabet-non-ascii', valid.slice(0, 8) + 'é' + valid.slice(9), 'malformed');
  add('malformed-length', valid.slice(0, 4 * 10 + 1), 'malformed');
  add('malformed-non-canonical-bits', 'QR', 'malformed');
  add('malformed-truncated', valid.slice(0, Math.floor(valid.length / 2)), 'malformed');
  add('malformed-truncated-aligned', valid.slice(0, 40), 'malformed');
  add('malformed-utf8-overlong', bytes([0x7b, 0xc0, 0x80, 0x7d]), 'malformed');
  add('malformed-utf8-surrogate', bytes([0x7b, 0xed, 0xa0, 0x80, 0x7d]), 'malformed');
  add('malformed-utf8-above-max', bytes([0x7b, 0xf4, 0x90, 0x80, 0x80, 0x7d]), 'malformed');
  add('malformed-utf8-truncated', bytes([0x7b, 0x22, 0xe4, 0xb8]), 'malformed');
  add('malformed-utf8-continuation', bytes([0x80, 0x7b, 0x7d]), 'malformed');
  add('malformed-json-truncated', text('{"v":1,"root":"/r"'), 'malformed');
  add('malformed-json-trailing', text(JSON.stringify(base) + ' x'), 'malformed');
  add('malformed-json-single-quotes', text(`{'v':1}`), 'malformed');
  add('malformed-json-unquoted-name', text(`{v:1}`), 'malformed');
  add('malformed-json-comment', text(`{"v":1 /* c */}`), 'malformed');
  add('malformed-json-trailing-comma', text(`{"v":1,}`), 'malformed');
  add('malformed-json-bom', text('\uFEFF' + JSON.stringify(base)), 'malformed');
  add('malformed-json-inner-bom', text(JSON.stringify(base).replace(',', ',\uFEFF')), 'malformed');
  add('malformed-json-control-character', text(`{"v":1,"root":"/r\u0001","env":{"kind":"local","platform":"win32"},"id":"${id}"}`), 'malformed');
  add('malformed-json-invalid-escape', text(`{"v":1,"root":"/r\\q","env":{"kind":"local","platform":"win32"},"id":"${id}"}`), 'malformed');
  add('malformed-json-multiple-values', text(JSON.stringify(base) + JSON.stringify(base)), 'malformed');
  add('malformed-json-nan', text(`{"v":NaN}`), 'malformed');
  add('malformed-not-object-array', json([base]), 'malformed');
  add('malformed-not-object-null', json(null), 'malformed');
  add('malformed-not-object-string', json('envelope'), 'malformed');
  add('malformed-not-object-number', json(1), 'malformed');

  add('unsupported-version-2', json({ ...base, v: 2, future: { more: true } }), 'unsupported-version');
  add('unsupported-version-0', json({ ...base, v: 0 }), 'unsupported-version');
  add('unsupported-version-fraction', json({ ...base, v: 1.5 }), 'unsupported-version');

  add('invalid-unknown-member', json({ ...base, extra: true }), 'invalid');
  add('invalid-unknown-members-sorted', json({ ...base, zeta: 1, alpha: 2, 10: 3 }), 'invalid');
  add('invalid-proto-member', text(`{"v":1,"root":"/r","env":{"kind":"local","platform":"win32"},"id":"${id}","__proto__":{}}`), 'invalid');
  add('invalid-env-unknown-member', json({ ...base, env: { ...env, unsupportedOverride: false } }), 'invalid');
  add('invalid-traversal-id', json({ ...base, id: '../../etc/passwd' }), 'invalid');
  add('invalid-uppercase-id', json({ ...base, id: id.toUpperCase() }), 'invalid');
  add('invalid-relative-root', json({ ...base, root: 'src/project' }), 'invalid');
  add('invalid-root-number', json({ ...base, root: 1 }), 'invalid');
  add('invalid-version-string', json({ ...base, v: '1' }), 'invalid');
  add('invalid-version-missing', json({ root: base.root, env, id }), 'invalid');
  add('invalid-env-missing', json({ v: 1, root: base.root, id }), 'invalid');
  add('invalid-env-array', json({ ...base, env: [] }), 'invalid');
  add('invalid-env-blank-kind-number-platform', json({ ...base, env: { kind: ' ', platform: 1 } }), 'invalid');
  add('invalid-step-empty', json({ ...base, step: '' }), 'invalid');
  add('invalid-step-blank', json({ ...base, step: ' \t' }), 'invalid');
  add('invalid-step-201', json({ ...base, step: 'x'.repeat(201) }), 'invalid');
  add('invalid-step-null', json({ ...base, step: null }), 'invalid');
  add('invalid-step-number', json({ ...base, step: 2 }), 'invalid');
  add('invalid-title-121', json({ ...base, title: 't'.repeat(121) }), 'invalid');
  add('invalid-title-number', json({ ...base, title: 3 }), 'invalid');
  add('invalid-everything', json({ v: 1, root: 'x', env: {}, id: 'x', step: '', title: false, other: 0 }), 'invalid');

  const build: { name: string; artifact: unknown; step?: string; expected: unknown }[] = [];
  const artifactFor = (root: string, title: string) => ({ id, title, project: { root, environment: { ...env, unsupportedOverride: false } } });
  const addBuild = (name: string, root: string, title: string, step?: string) => {
    const artifact = artifactFor(root, title);
    const result = buildEnvelope(artifact, step === undefined ? {} : { step });
    const urls = result.ok ? { launcher: launcherUrl(DEFAULT_LAUNCHER_BASE, result.encoded), vscode: vscodeUri(result.encoded), rider: riderUri(result.encoded) } : undefined;
    build.push({ name, artifact, ...(step === undefined ? {} : { step }), expected: { ...result, ...(urls ? { urls } : {}) } });
    return result;
  };
  addBuild('walkthrough-level', 'C:\\repo', 'Retry flow');
  addBuild('with-step', '/home/me/repo', 'Retry flow', 's1.2');
  addBuild('non-ascii', 'C:\\Users\\Jürgen\\项目', 'Wie 😀 funktioniert');
  const shortened = addBuild('title-shortened', 'C:\\repo', 'T'.repeat(200));
  if (!shortened.ok || shortened.envelope.title !== 'T'.repeat(119) + '…') throw new Error('Launch fixture title-shortened');
  addBuild('title-shortened-surrogate', 'C:\\repo', 'a'.repeat(116) + '😀'.repeat(10));
  const dropped = addBuild('title-dropped', rootFor(1536), 'Dropped title');
  if (!dropped.ok || 'title' in dropped.envelope) throw new Error('Launch fixture title-dropped');
  const tooLong = addBuild('too-long', rootFor(1536) + 'r'.repeat(4), 'Too long');
  if (tooLong.ok) throw new Error('Launch fixture too-long');

  return {
    fixtureVersion: 1,
    limits: LAUNCH_LIMITS,
    prefixes: { launcherBase: DEFAULT_LAUNCHER_BASE, vscode: VSCODE_LAUNCH_PREFIX, rider: RIDER_LAUNCH_PREFIX },
    categories: ['malformed', 'too-long', 'unsupported-version', 'invalid'],
    decode,
    build,
  };
}
