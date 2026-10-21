import path from 'node:path';
import { expect, it } from 'vitest';
import { publish, type PublishIO, type PublishOptions } from '../src/publish';
import { DEFAULT_LAUNCHER_BASE, decodeEnvelope } from '../src/launch';

function memory() {
  const root = path.resolve('memory-project');
  const files = new Map<string, string>([[path.join(root, 'source.ts'), 'const value = 1;\n'], [path.join(root, '.gitignore'), 'original\n']]);
  const io: PublishIO = {
    realpath: p => { if (p === root || files.has(p)) return p; throw new Error('missing'); },
    read: p => Buffer.from(files.get(p)!), size: p => Buffer.byteLength(files.get(p)!), exists: p => files.has(p), mkdir: () => {},
    writeExclusive: (p, text) => { if (files.has(p)) throw new Error('exists'); files.set(p, text); },
    rename: (from, to) => { files.set(to, files.get(from)!); files.delete(from); }, remove: p => { files.delete(p); }, git: () => null,
  };
  let sequence = 0;
  const options: PublishOptions = { root, scriptPath: '', cwd: process.cwd(), platform: process.platform, environment: { kind: 'local', platform: process.platform, unsupportedOverride: false }, bundleVersion: '0.1.0', io,
    makeId: () => `20261021T14300512${sequence++}Z-abcdef`, clock: () => new Date('2026-10-21T14:30:05.123Z') };
  return { root, files, io, options };
}
const input = { version: 1, title: 'Title', summary: 'Summary', steps: [{ title: 'Code', explanation: 'Evidence', location: { path: 'source.ts', startLine: 1, endLine: 1 } }] };
it('publishes in memory with absent git, preserves older artifacts and leaves root gitignore untouched', () => {
  const { root, files, options } = memory();
  const first = publish(input, options); expect(first.ok).toBe(true); if (!first.ok) return;
  const firstPath = path.join(root, first.artifactPath); const content = files.get(firstPath)!;
  const second = publish(input, options); expect(second.ok).toBe(true); if (!second.ok) return;
  expect(first.id < second.id).toBe(true); expect(files.get(firstPath)).toBe(content);
  expect(files.has(path.join(root, second.artifactPath))).toBe(true);
  expect(JSON.parse(content)).toMatchObject({ source: { git: null }, steps: [{ id: 's1', location: { anchor: { selectionText: 'const value = 1;' } } }] });
  expect(files.get(path.join(root, '.gitignore'))).toBe('original\n');
  expect(files.get(path.join(root, '.walk-me-through/.gitignore'))).toBe('*\n');
  expect([...files.keys()].some(p => p.includes('.tmp-') || p.endsWith('.lock'))).toBe(false);
});
it('rejects symlink escape and invalid input without publishing', () => {
  const { io, options, files } = memory(); const original = io.realpath;
  io.realpath = p => p.endsWith('source.ts') ? path.resolve('outside.ts') : original(p);
  expect(publish(input, options)).toMatchObject({ ok: false, errors: [{ code: 'SOURCE_OUTSIDE_ROOT', path: 'steps[0].location.path' }] });
  expect(publish({ ...input, title: '' }, options).ok).toBe(false);
  expect([...files.keys()].some(p => p.includes('walkthroughs'))).toBe(false);
});
it('retries colliding IDs without replacing an existing artifact', () => {
  const { root, files, options } = memory();
  files.set(path.join(root, '.walk-me-through/walkthroughs/20261021T143005120Z-abcdef.json'), 'immutable');
  const result = publish(input, options);
  expect(result).toMatchObject({ ok: true, id: '20261021T143005121Z-abcdef' });
  expect(files.get(path.join(root, '.walk-me-through/walkthroughs/20261021T143005120Z-abcdef.json'))).toBe('immutable');
});
it('reports write failures with environment recovery', () => {
  const { io, options } = memory(); io.mkdir = () => { throw new Error('permission denied'); };
  expect(publish(input, options)).toMatchObject({ ok: false, exitCode: 2, errors: [{ code: 'ARTIFACT_WRITE_FAILED', recovery: 'fix-environment' }] });
});
it('returns a launcher URL whose fragment decodes to the saved artifact envelope', () => {
  const { root, files, options } = memory();
  const result = publish(input, options); expect(result.ok).toBe(true); if (!result.ok) return;
  expect(Object.keys(result)).toEqual(['ok', 'id', 'artifactPath', 'stepCount', 'warnings', 'url', 'open']);
  expect(result).toMatchObject({ stepCount: 1, warnings: [], artifactPath: `.walk-me-through/walkthroughs/${result.id}.json` });
  expect(result.url!.startsWith(DEFAULT_LAUNCHER_BASE + '#')).toBe(true);
  const saved = JSON.parse(files.get(path.join(root, result.artifactPath))!);
  expect(decodeEnvelope(result.url!.slice(DEFAULT_LAUNCHER_BASE.length + 1))).toEqual({ ok: true, envelope: {
    v: 1, root: saved.project.root, env: { kind: 'local', platform: process.platform }, id: saved.id, title: 'Title' } });
  expect(result.open).toBe(`Open ${result.url} and choose VS Code or Rider, or run Walk Me Through: Open Walkthrough in VS Code or Rider and choose "Title" (ID ${result.id}) in the picker.`);
  const local = publish(input, { ...options, launcherBase: 'http://localhost:8123/' });
  expect(local.ok && local.url).toMatch(/^http:\/\/localhost:8123\/#[A-Za-z0-9_-]+$/);
});
it('keeps the artifact and drops the URL with a warning when the root is too long for a link', () => {
  const { root, files, io, options } = memory();
  const long = path.join(root, ...Array(30).fill('a'.repeat(50)));
  files.set(path.join(long, 'source.ts'), 'const value = 1;\n');
  const original = io.realpath; io.realpath = p => p === long ? p : original(p);
  const result = publish(input, { ...options, root: long }); expect(result.ok).toBe(true); if (!result.ok) return;
  expect(result).not.toHaveProperty('url');
  expect(result.warnings).toEqual([{ code: 'launch-link-too-long', length: expect.any(Number), limit: 1536 }]);
  expect(result.open).toContain('in the picker'); expect(result.open).toContain(result.id); expect(result.open).not.toContain('http');
  expect(files.has(path.join(long, result.artifactPath))).toBe(true);
});
