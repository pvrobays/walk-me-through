import { build } from 'esbuild';
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = fileURLToPath(new URL('../', import.meta.url));
const result = await build({ absWorkingDir: root, entryPoints: ['scripts/conformance.ts'], bundle: true, write: false,
  platform: 'node', format: 'esm', alias: { vscode: path.join(root, 'scripts/conformance-vscode.ts') } });
const { generateConformance } = await import(`data:text/javascript;base64,${Buffer.from(result.outputFiles[0].text).toString('base64')}`);
const generated = JSON.stringify(await generateConformance(), null, 2) + '\n';
const target = path.join(root, 'tests/conformance/v1.json');
if (process.argv.includes('--write')) {
  await writeFile(target, generated);
  console.log('Generated tests/conformance/v1.json from TypeScript core and real Session.');
} else {
  const committed = await readFile(target, 'utf8');
  if (committed.replace(/\r\n/g, '\n') !== generated) throw new Error('Conformance fixture drift. Review changes, then run npm run fixtures:generate.');
  console.log('Conformance fixtures match TypeScript core and real Session.');
}
