import { expect, it } from 'vitest';
import { build } from 'esbuild';
import { readFileSync } from 'node:fs';
import path from 'node:path';

it('names every package bundled into dist/extension.js, with its version and license, in ThirdPartyNotices.txt', async () => {
  const result = await build({ entryPoints: ['packages/vscode/src/extension.ts'], bundle: true, write: false, metafile: true, platform: 'node', format: 'cjs', external: ['vscode'] });
  const packages = new Set<string>();
  for (const input of Object.keys(result.metafile.inputs)) {
    const match = input.split('/').reduce<string[] | undefined>((found, part, index, parts) => part === 'node_modules' ? parts.slice(index + 1, parts[index + 1]?.startsWith('@') ? index + 3 : index + 2) : found, undefined);
    if (match) packages.add(match.join('/'));
  }
  expect([...packages].sort()).toEqual(['entities', 'linkify-it', 'markdown-it', 'mdurl', 'punycode.js', 'uc.micro']);
  const notices = readFileSync('packages/vscode/ThirdPartyNotices.txt', 'utf8');
  for (const name of packages) {
    const manifest = JSON.parse(readFileSync(path.join('node_modules', name, 'package.json'), 'utf8'));
    expect(notices, `${name} ${manifest.version}`).toContain(`\n${name} ${manifest.version} (${manifest.license})\n`);
  }
});
