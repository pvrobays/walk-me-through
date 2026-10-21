// Launch envelope v1: identifies one saved local walkthrough (and optional step) for launcher links.
// Pure and dependency-free so the same code runs in the Node publisher and the browser launcher page.
import type { Artifact } from './artifact';
import { absolutePathPattern, artifactIdPattern, isRecord, isText } from './validation';

export const LAUNCH_LIMITS = { encoded: 1536, title: 120, step: 200 } as const;
export const DEFAULT_LAUNCHER_BASE = 'https://pvrobays.github.io/walk-me-through/';
export const VSCODE_LAUNCH_PREFIX = 'vscode://pvrobays.walk-me-through/open?e=';
export const RIDER_LAUNCH_PREFIX = 'jetbrains://rider/walkmethrough/open?e=';

export interface LaunchEnvelope {
  v: 1;
  root: string;
  env: { kind: string; platform: string };
  id: string;
  step?: string;
  title?: string;
}
export type LaunchCategory = 'malformed' | 'too-long' | 'unsupported-version' | 'invalid';
export interface LaunchProblem { path: string; message: string }
export type LaunchDecode =
  | { ok: true; envelope: LaunchEnvelope }
  | { ok: false; category: LaunchCategory; problems: LaunchProblem[] };
export type LaunchBuild =
  | { ok: true; envelope: LaunchEnvelope; encoded: string }
  | { ok: false; code: 'launch-link-too-long'; length: number };

const MESSAGES = {
  empty: 'Launch envelope is empty.',
  tooLong: `Launch envelope exceeds ${LAUNCH_LIMITS.encoded} characters.`,
  padding: 'Launch envelope must not contain base64 padding.',
  alphabet: 'Launch envelope contains characters outside the base64url alphabet.',
  base64: 'Launch envelope is not valid unpadded base64url.',
  utf8: 'Launch envelope is not valid UTF-8.',
  json: 'Launch envelope is not valid JSON.',
  notObject: 'Launch envelope must be a JSON object.',
  version: 'Unsupported launch envelope version. Update Walk Me Through to open this link.',
} as const;

// ---- base64url ----

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
const VALUES = new Map([...ALPHABET].map((c, i) => [c, i]));

export function base64urlEncode(bytes: Uint8Array): string {
  let out = '';
  for (let i = 0; i < bytes.length; i += 3) {
    const n = (bytes[i] << 16) | ((bytes[i + 1] ?? 0) << 8) | (bytes[i + 2] ?? 0);
    const chars = Math.min(4, Math.ceil(((bytes.length - i) * 8) / 6));
    for (let k = 0; k < chars; k++) out += ALPHABET[(n >> (18 - 6 * k)) & 63];
  }
  return out;
}

/** Strict unpadded base64url; returns a malformed reason instead of throwing. */
export function base64urlDecode(text: string): Uint8Array | 'padding' | 'alphabet' | 'base64' {
  if (text.includes('=')) return 'padding';
  const values: number[] = [];
  for (const c of text) {
    const v = VALUES.get(c);
    if (v === undefined) return 'alphabet';
    values.push(v);
  }
  const rest = values.length % 4;
  if (rest === 1) return 'base64';
  // Reject non-canonical encodings whose unused trailing bits are not zero.
  if ((rest === 2 && (values[values.length - 1] & 15)) || (rest === 3 && (values[values.length - 1] & 3))) return 'base64';
  const bytes = new Uint8Array(Math.floor((values.length * 6) / 8));
  let buffer = 0, bits = 0, index = 0;
  for (const v of values) {
    buffer = ((buffer << 6) | v) & 0xffffff; bits += 6;
    if (bits >= 8) { bits -= 8; bytes[index++] = (buffer >> bits) & 0xff; }
  }
  return bytes;
}

// ---- UTF-8 ----

export function utf8Encode(text: string): Uint8Array {
  const out: number[] = [];
  for (let i = 0; i < text.length; i++) {
    let cp = text.charCodeAt(i);
    if (cp >= 0xd800 && cp <= 0xdbff && i + 1 < text.length) {
      const low = text.charCodeAt(i + 1);
      if (low >= 0xdc00 && low <= 0xdfff) { cp = 0x10000 + ((cp - 0xd800) << 10) + (low - 0xdc00); i++; }
    }
    if (cp >= 0xd800 && cp <= 0xdfff) cp = 0xfffd; // lone surrogate
    if (cp < 0x80) out.push(cp);
    else if (cp < 0x800) out.push(0xc0 | (cp >> 6), 0x80 | (cp & 63));
    else if (cp < 0x10000) out.push(0xe0 | (cp >> 12), 0x80 | ((cp >> 6) & 63), 0x80 | (cp & 63));
    else out.push(0xf0 | (cp >> 18), 0x80 | ((cp >> 12) & 63), 0x80 | ((cp >> 6) & 63), 0x80 | (cp & 63));
  }
  return Uint8Array.from(out);
}

/** Strict UTF-8: rejects overlong forms, surrogates, code points above U+10FFFF, and truncation. */
export function utf8Decode(bytes: Uint8Array): string | null {
  let out = '';
  for (let i = 0; i < bytes.length;) {
    const b = bytes[i];
    let need: number, cp: number, min: number;
    if (b < 0x80) { out += String.fromCharCode(b); i++; continue; }
    else if (b >= 0xc2 && b <= 0xdf) { need = 1; cp = b & 0x1f; min = 0x80; }
    else if (b >= 0xe0 && b <= 0xef) { need = 2; cp = b & 0x0f; min = 0x800; }
    else if (b >= 0xf0 && b <= 0xf4) { need = 3; cp = b & 0x07; min = 0x10000; }
    else return null;
    if (i + need >= bytes.length) return null; // truncated sequence
    for (let k = 1; k <= need; k++) {
      const c = bytes[i + k];
      if ((c & 0xc0) !== 0x80) return null;
      cp = (cp << 6) | (c & 0x3f);
    }
    if (cp < min || cp > 0x10ffff || (cp >= 0xd800 && cp <= 0xdfff)) return null;
    out += String.fromCodePoint(cp);
    i += need + 1;
  }
  return out;
}

// ---- envelope ----

const MEMBERS = ['v', 'root', 'env', 'id', 'step', 'title'];
const ENV_MEMBERS = ['kind', 'platform'];
const has = (object: Record<string, unknown>, key: string) => Object.prototype.hasOwnProperty.call(object, key);
const nonempty = (value: unknown): value is string => typeof value === 'string' && value.trim().length > 0;

/** Validates a parsed JSON value against v1 rules (after malformed-input checks). */
export function validateEnvelope(value: Record<string, unknown>): LaunchDecode {
  if (has(value, 'v') && typeof value.v === 'number' && value.v !== 1) {
    return { ok: false, category: 'unsupported-version', problems: [{ path: 'v', message: MESSAGES.version }] };
  }
  const problems: LaunchProblem[] = [];
  const add = (path: string, message: string) => problems.push({ path, message });
  if (value.v !== 1) add('v', 'Expected version number 1.');
  if (typeof value.root !== 'string' || !absolutePathPattern.test(value.root)) add('root', 'Expected an absolute Windows or POSIX project root.');
  const env = value.env;
  if (!isRecord(env)) add('env', 'Expected an env object with kind and platform.');
  else {
    if (!nonempty(env.kind)) add('env.kind', 'Expected a nonempty environment kind.');
    if (!nonempty(env.platform)) add('env.platform', 'Expected a nonempty environment platform.');
    for (const key of Object.keys(env).filter(k => !ENV_MEMBERS.includes(k)).sort()) add(`env.${key}`, `Unknown member: env.${key}.`);
  }
  if (typeof value.id !== 'string' || !artifactIdPattern.test(value.id)) add('id', 'Expected an artifact ID: a timestamp and six lowercase base32 characters.');
  if (has(value, 'step') && !isText(value.step, LAUNCH_LIMITS.step)) add('step', `Expected a nonempty step ID of at most ${LAUNCH_LIMITS.step} characters.`);
  if (has(value, 'title') && (typeof value.title !== 'string' || value.title.length > LAUNCH_LIMITS.title)) add('title', `Expected a title of at most ${LAUNCH_LIMITS.title} characters.`);
  for (const key of Object.keys(value).filter(k => !MEMBERS.includes(k)).sort()) add(key, `Unknown member: ${key}.`);
  if (problems.length) return { ok: false, category: 'invalid', problems };
  const fields = env as Record<string, string>;
  const envelope: LaunchEnvelope = { v: 1, root: value.root as string, env: { kind: fields.kind, platform: fields.platform }, id: value.id as string };
  if (has(value, 'step')) envelope.step = value.step as string;
  if (has(value, 'title')) envelope.title = value.title as string;
  return { ok: true, envelope };
}

export function decodeEnvelope(text: string): LaunchDecode {
  const malformed = (message: string): LaunchDecode => ({ ok: false, category: 'malformed', problems: [{ path: '$', message }] });
  if (text.length > LAUNCH_LIMITS.encoded) return { ok: false, category: 'too-long', problems: [{ path: '$', message: MESSAGES.tooLong }] };
  if (text.length === 0) return malformed(MESSAGES.empty);
  const bytes = base64urlDecode(text);
  if (typeof bytes === 'string') return malformed(MESSAGES[bytes]);
  const json = utf8Decode(bytes);
  if (json === null) return malformed(MESSAGES.utf8);
  let parsed: unknown;
  try { parsed = JSON.parse(json); } catch { return malformed(MESSAGES.json); }
  if (!isRecord(parsed)) return malformed(MESSAGES.notObject);
  return validateEnvelope(parsed);
}

/** Canonical member order keeps encodings deterministic across builders. */
export function encodeEnvelope(envelope: LaunchEnvelope): string {
  const ordered: LaunchEnvelope = { v: 1, root: envelope.root, env: { kind: envelope.env.kind, platform: envelope.env.platform }, id: envelope.id };
  if (envelope.step !== undefined) ordered.step = envelope.step;
  if (envelope.title !== undefined) ordered.title = envelope.title;
  return base64urlEncode(utf8Encode(JSON.stringify(ordered)));
}

export function shortenTitle(title: string): string {
  if (title.length <= LAUNCH_LIMITS.title) return title;
  let cut = LAUNCH_LIMITS.title - 1;
  const last = title.charCodeAt(cut - 1);
  if (last >= 0xd800 && last <= 0xdbff) cut--; // keep surrogate pairs whole
  return title.slice(0, cut).trimEnd() + '…';
}

export function buildEnvelope(artifact: Pick<Artifact, 'id' | 'title' | 'project'>, options: { step?: string } = {}): LaunchBuild {
  const base: LaunchEnvelope = {
    v: 1, root: artifact.project.root,
    env: { kind: artifact.project.environment.kind, platform: artifact.project.environment.platform }, id: artifact.id,
    ...(options.step !== undefined ? { step: options.step } : {}),
  };
  const check = validateEnvelope(base as unknown as Record<string, unknown>);
  if (!check.ok) throw new Error(`Cannot build launch envelope: ${check.problems.map(p => `${p.path}: ${p.message}`).join(' ')}`);
  let encoded = '';
  for (const envelope of [{ ...base, title: shortenTitle(artifact.title) }, base]) {
    encoded = encodeEnvelope(envelope);
    if (encoded.length <= LAUNCH_LIMITS.encoded) return { ok: true, envelope, encoded };
  }
  return { ok: false, code: 'launch-link-too-long', length: encoded.length };
}

// ---- URLs ----

export function launcherUrl(base: string, encoded: string): string { return `${base}#${encoded}`; }
export function vscodeUri(encoded: string): string { return VSCODE_LAUNCH_PREFIX + encoded; }
export function riderUri(encoded: string): string { return RIDER_LAUNCH_PREFIX + encoded; }

/** Accepts https:// bases, or http:// on localhost/127.0.0.1 for local previews; normalizes to end in `/`. */
export function parseLauncherBase(text: string): { ok: true; base: string } | { ok: false; message: string } {
  let url: URL;
  try { url = new URL(text); } catch { return { ok: false, message: 'Expected an absolute launcher URL.' }; }
  const local = url.protocol === 'http:' && (url.hostname === 'localhost' || url.hostname === '127.0.0.1');
  if (url.protocol !== 'https:' && !local) return { ok: false, message: 'Launcher URL must use https://, or http://localhost / http://127.0.0.1.' };
  if (url.username || url.password || /[?#]/.test(text)) return { ok: false, message: 'Launcher URL must not contain credentials, a query, or a fragment.' };
  if (!url.pathname.endsWith('/')) url.pathname += '/';
  return { ok: true, base: url.href };
}
