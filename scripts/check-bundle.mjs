import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildManifest, buildSkill } from './build.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const temporary = await mkdtemp(path.join(tmpdir(), 'wmt-bundle-'));
const normalize = text => text.replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n');
try {
  await buildSkill(path.join(temporary, 'scripts/publish-walkthrough.mjs'));
  await buildManifest(temporary);
  for (const file of ['scripts/publish-walkthrough.mjs', 'manifest.json']) {
    const [actual, expected] = await Promise.all([
      readFile(path.join(root, 'packages/skill', file), 'utf8'), readFile(path.join(temporary, file), 'utf8'),
    ]);
    if (normalize(actual) !== normalize(expected)) throw new Error(`Stale bundle file: packages/skill/${file}. Run npm run build.`);
  }
  console.log('Committed skill script and manifest match a fresh build.');
} finally { await rm(temporary, { recursive: true, force: true }); }
