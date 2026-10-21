import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildLauncher, buildManifest, buildSkill } from './build.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const temporary = await mkdtemp(path.join(tmpdir(), 'wmt-bundle-'));
const normalize = text => text.replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n');
async function compare(committed, fresh, message) {
  const [actual, expected] = await Promise.all([readFile(committed, 'utf8').catch(() => ''), readFile(fresh, 'utf8')]);
  if (normalize(actual) !== normalize(expected)) throw new Error(message);
}
try {
  await buildSkill(path.join(temporary, 'scripts/publish-walkthrough.mjs'));
  await buildManifest(temporary);
  for (const file of ['scripts/publish-walkthrough.mjs', 'manifest.json']) {
    await compare(path.join(root, 'packages/skill', file), path.join(temporary, file), `Stale bundle file: packages/skill/${file}. Run npm run build.`);
  }
  console.log('Committed skill script and manifest match a fresh build.');
  await buildLauncher(path.join(temporary, 'launcher/launcher.js'));
  await compare(path.join(root, 'launcher/launcher.js'), path.join(temporary, 'launcher/launcher.js'), 'Stale launcher asset: launcher/launcher.js does not match packages/launcher/src. Run npm run build.');
  console.log('Committed launcher/launcher.js matches a fresh build.');
} finally { await rm(temporary, { recursive: true, force: true }); }
