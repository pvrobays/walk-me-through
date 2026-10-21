import { describe, expect, it } from 'vitest';
import {
  base64urlDecode, base64urlEncode, buildEnvelope, decodeEnvelope, encodeEnvelope, launcherUrl, parseLauncherBase,
  riderUri, shortenTitle, utf8Decode, utf8Encode, vscodeUri, LAUNCH_LIMITS, type LaunchEnvelope,
} from '../src/launch';

const id = '20261021T143005123Z-abcdef';
const envelope = (extra: Partial<LaunchEnvelope> & Record<string, unknown> = {}): LaunchEnvelope =>
  ({ v: 1, root: 'C:\\repo', env: { kind: 'local', platform: 'win32' }, id, ...extra } as LaunchEnvelope);
const raw = (value: unknown) => base64urlEncode(utf8Encode(JSON.stringify(value)));
const artifact = (root: string, title = 'Retry flow') =>
  ({ id, title, project: { root, environment: { kind: 'local', platform: 'win32', unsupportedOverride: false } } });
/** Root padded so the built envelope (optionally with title) encodes to `target` characters. */
function rootFor(target: number, title?: string): string {
  for (let n = 1; n < 2000; n++) {
    const root = 'C:\\' + 'r'.repeat(n);
    if (encodeEnvelope(envelope({ root, ...(title ? { title } : {}) })).length === target) return root;
  }
  throw new Error('no root');
}

describe('codec', () => {
  it('matches Node base64url and UTF-8 for random bytes and strings', () => {
    let seed = 7; const next = () => (seed = (seed * 1103515245 + 12345) & 0x7fffffff);
    for (let n = 0; n < 200; n++) {
      const bytes = Uint8Array.from({ length: n % 23 }, () => next() & 255);
      const encoded = base64urlEncode(bytes);
      expect(encoded).toBe(Buffer.from(bytes).toString('base64url'));
      expect(base64urlDecode(encoded)).toEqual(bytes);
      const fatal = new TextDecoder('utf-8', { fatal: true });
      let expected: string | null; try { expected = fatal.decode(bytes); } catch { expected = null; }
      expect(utf8Decode(bytes)).toBe(expected);
    }
    for (const text of ['', 'ascii', 'Jürgen', '项目', '😀𝄞', 'a\u0000b', '\u{10FFFF}']) {
      expect(Buffer.from(utf8Encode(text)).toString('utf8')).toBe(text);
      expect(utf8Encode(text)).toEqual(Uint8Array.from(Buffer.from(text, 'utf8')));
    }
  });
  it('rejects invalid UTF-8 sequences', () => {
    for (const bytes of [[0xc0, 0x80], [0xe0, 0x80, 0x80], [0xed, 0xa0, 0x80], [0xf4, 0x90, 0x80, 0x80], [0xf5], [0x80], [0xe4, 0xb8], [0xff]]) {
      expect(utf8Decode(Uint8Array.from(bytes)), bytes.join(',')).toBeNull();
    }
  });
  it('rejects padding, foreign characters, impossible lengths and non-canonical bits', () => {
    expect(base64urlDecode('eyJ9==')).toBe('padding');
    for (const text of ['ab+c', 'ab/c', 'ab c', 'ab.c', 'abç']) expect(base64urlDecode(text)).toBe('alphabet');
    expect(base64urlDecode('abcde')).toBe('base64');
    expect(base64urlDecode('QR')).toBe('base64'); // 'QQ' is canonical for "A"
    expect(base64urlDecode('QUJ')).toBe('base64'); // 'QUI' is canonical for "AB"
  });
});

describe('decodeEnvelope', () => {
  it('round-trips non-ASCII and supplementary-plane values with a URL-safe alphabet', () => {
    const value = envelope({ root: 'C:\\Users\\Jürgen\\项目', title: 'Retry 😀 𝄞 flow', step: 's2' });
    const encoded = encodeEnvelope(value);
    expect(encoded).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(decodeEnvelope(encoded)).toEqual({ ok: true, envelope: value });
  });
  it('reports distinct malformed errors and never returns a partial envelope', () => {
    const encoded = encodeEnvelope(envelope({ title: 'Title' }));
    const messages = new Set<string>();
    for (const text of ['', encoded + '=', encoded.slice(0, 10) + '+', encoded.slice(0, 5),
      base64urlEncode(Uint8Array.from([0x7b, 0xc0, 0x80, 0x7d])), base64urlEncode(utf8Encode('{"v":1')), raw([1]), raw(null)]) {
      const result = decodeEnvelope(text);
      expect(result, text).toMatchObject({ ok: false, category: 'malformed' });
      expect(result).not.toHaveProperty('envelope');
      if (!result.ok) messages.add(result.problems[0].message);
    }
    expect(messages.size).toBeGreaterThanOrEqual(7);
    for (let n = 1; n < encoded.length; n++) expect(decodeEnvelope(encoded.slice(0, n)).ok).toBe(false);
  });
  it('rejects unknown members, traversal IDs, relative roots, and limits', () => {
    const invalid = (value: unknown) => { const r = decodeEnvelope(raw(value)); return r.ok ? [] : (expect(r.category).toBe('invalid'), r.problems.map(p => p.path)); };
    expect(invalid({ ...envelope(), extra: true })).toEqual(['extra']);
    expect(invalid({ ...envelope(), env: { kind: 'local', platform: 'win32', unsupportedOverride: false } })).toEqual(['env.unsupportedOverride']);
    expect(invalid(envelope({ id: '../../etc/passwd' }))).toEqual(['id']);
    expect(invalid(envelope({ root: 'src/project' }))).toEqual(['root']);
    expect(invalid(envelope({ step: '' }))).toEqual(['step']);
    expect(invalid(envelope({ step: 'x'.repeat(201) }))).toEqual(['step']);
    expect(invalid(envelope({ step: 'x'.repeat(200), title: 'y'.repeat(120) }))).toEqual([]);
    expect(invalid(envelope({ title: 'y'.repeat(121) }))).toEqual(['title']);
    expect(invalid({ ...envelope(), v: '1' })).toEqual(['v']);
    expect(invalid({ ...envelope(), env: { kind: ' ', platform: 1 } })).toEqual(['env.kind', 'env.platform']);
    expect(invalid(envelope({ root: '/home/me/repo' }))).toEqual([]);
    expect(invalid(envelope({ root: '\\\\server\\share' }))).toEqual([]);
  });
  it('separates newer versions from malformed input', () => {
    expect(decodeEnvelope(raw({ v: 2, future: true }))).toMatchObject({ ok: false, category: 'unsupported-version', problems: [{ path: 'v' }] });
  });
  it('enforces the 1,536-character boundary before decoding', () => {
    const exact = encodeEnvelope(envelope({ root: rootFor(1536) }));
    expect(exact).toHaveLength(1536);
    expect(decodeEnvelope(exact).ok).toBe(true);
    expect(decodeEnvelope('*'.repeat(1537))).toMatchObject({ ok: false, category: 'too-long' });
  });
});

describe('buildEnvelope', () => {
  it('builds a walkthrough-level envelope from artifact fields', () => {
    const built = buildEnvelope(artifact('C:\\repo'));
    expect(built).toMatchObject({ ok: true, envelope: { v: 1, root: 'C:\\repo', env: { kind: 'local', platform: 'win32' }, id, title: 'Retry flow' } });
    if (!built.ok) return;
    expect(built.envelope).not.toHaveProperty('step');
    expect(Object.keys(built.envelope.env)).toEqual(['kind', 'platform']);
    expect(decodeEnvelope(built.encoded)).toEqual({ ok: true, envelope: built.envelope });
    expect(buildEnvelope(artifact('C:\\repo'), { step: 's3' })).toMatchObject({ envelope: { step: 's3' } });
  });
  it('shortens long titles to 120 characters with an ellipsis, keeping surrogate pairs whole', () => {
    const built = buildEnvelope(artifact('C:\\repo', 't'.repeat(200)));
    expect(built.ok && built.envelope.title).toMatch(/^t{119}…$/);
    const emoji = shortenTitle('a'.repeat(116) + '😀'.repeat(10));
    expect(emoji).toBe('a'.repeat(116) + '😀…');
    expect(shortenTitle('short')).toBe('short');
  });
  it('drops the title when only that fits, and gives up beyond the limit', () => {
    const title = 'T'.repeat(120);
    const root = rootFor(1536);
    const dropped = buildEnvelope(artifact(root, title));
    expect(dropped).toMatchObject({ ok: true, envelope: { root, id } });
    expect(dropped.ok && dropped.envelope).not.toHaveProperty('title');
    expect(dropped.ok && dropped.encoded.length).toBe(1536);
    const withTitle = buildEnvelope(artifact(rootFor(1536, title), title));
    expect(withTitle.ok && withTitle.envelope.title).toBe(title);
    expect(buildEnvelope(artifact(root + 'rrrr', title))).toMatchObject({ ok: false, code: 'launch-link-too-long' });
    expect(LAUNCH_LIMITS.encoded).toBe(1536);
  });
});

describe('URLs', () => {
  it('builds launcher and IDE URIs with the envelope unchanged', () => {
    expect(launcherUrl('https://pvrobays.github.io/walk-me-through/', 'abc')).toBe('https://pvrobays.github.io/walk-me-through/#abc');
    expect(vscodeUri('a-_b')).toBe('vscode://pvrobays.walk-me-through/open?e=a-_b');
    expect(riderUri('a-_b')).toBe('jetbrains://rider/walkmethrough/open?e=a-_b');
  });
  it('accepts https and localhost launcher bases only', () => {
    expect(parseLauncherBase('https://example.com/launch')).toEqual({ ok: true, base: 'https://example.com/launch/' });
    expect(parseLauncherBase('http://localhost:8123')).toEqual({ ok: true, base: 'http://localhost:8123/' });
    expect(parseLauncherBase('http://127.0.0.1:9/x/')).toEqual({ ok: true, base: 'http://127.0.0.1:9/x/' });
    for (const bad of ['http://example.com/', 'file:///C:/x', 'javascript:alert(1)', 'relative/', 'https://a/?q', 'https://a/#f', 'https://u:p@a/']) {
      expect(parseLauncherBase(bad).ok, bad).toBe(false);
    }
  });
});
