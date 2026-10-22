import { expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { hashFile } from '../../core/src/text';

it('records normalized hashes for all three bundle files, excluding the manifest itself', () => {
  const manifest = JSON.parse(readFileSync('packages/skill/manifest.json', 'utf8'));
  expect(manifest).toMatchObject({ manifestVersion: 1, bundleVersion: '0.2.0', walkthroughSchemaVersion: 1 });
  expect(manifest.bundleVersion).toBe(JSON.parse(readFileSync('packages/skill/package.json', 'utf8')).version);
  expect(readFileSync('packages/skill/scripts/publish-walkthrough.mjs', 'utf8')).toContain(`Walk Me Through bundle ${manifest.bundleVersion}.`);
  expect(Object.keys(manifest.files).sort()).toEqual(['SKILL.md', 'references/walkthrough-format.md', 'scripts/publish-walkthrough.mjs']);
  for (const [name, hash] of Object.entries(manifest.files)) {
    const bytes = readFileSync(`packages/skill/${name}`);
    expect(hashFile(bytes)).toBe(hash);
    expect(hashFile(Buffer.from('\uFEFF' + bytes.toString('utf8').replace(/\n/g, '\r\n')))).toBe(hash);
  }
});
