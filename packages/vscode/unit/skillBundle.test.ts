import { expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { hashFile } from '../../core/src/text';

const files = ['SKILL.md', 'manifest.json', 'references/walkthrough-format.md', 'scripts/publish-walkthrough.mjs'];

it('ships the four canonical skill files in packages/vscode/skill, hashing to the shipped manifest', () => {
  expect(existsSync('packages/vscode/skill/manifest.json'), 'Run npm run build to copy the skill into the extension.').toBe(true);
  for (const file of files) expect(readFileSync(`packages/vscode/skill/${file}`).equals(readFileSync(`packages/skill/${file}`)), file).toBe(true);
  const manifest = JSON.parse(readFileSync('packages/vscode/skill/manifest.json', 'utf8'));
  expect(Object.keys(manifest.files).sort()).toEqual(files.filter(file => file !== 'manifest.json').sort());
  for (const [file, hash] of Object.entries(manifest.files)) expect(hashFile(readFileSync(`packages/vscode/skill/${file}`)), file).toBe(hash);
});
