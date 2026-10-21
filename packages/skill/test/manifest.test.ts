import { expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { hashFile } from '../../core/src/text';

it('records normalized hashes for all three bundle files, excluding the manifest itself', () => {
  const manifest = JSON.parse(readFileSync('packages/skill/manifest.json', 'utf8'));
  expect(manifest).toMatchObject({ manifestVersion: 1, bundleVersion: '0.1.0', walkthroughSchemaVersion: 1 });
  expect(Object.keys(manifest.files).sort()).toEqual(['SKILL.md', 'references/walkthrough-format.md', 'scripts/publish-walkthrough.mjs']);
  for (const [name, hash] of Object.entries(manifest.files)) {
    const bytes = readFileSync(`packages/skill/${name}`);
    expect(hashFile(bytes)).toBe(hash);
    expect(hashFile(Buffer.from('\uFEFF' + bytes.toString('utf8').replace(/\n/g, '\r\n')))).toBe(hash);
  }
});
