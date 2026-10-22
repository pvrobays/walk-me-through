import { build } from 'esbuild';
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = fileURLToPath(new URL('../', import.meta.url));
const result = await build({ absWorkingDir: root, entryPoints: ['scripts/conformance.ts'], bundle: true, write: false,
  platform: 'node', format: 'esm', alias: { vscode: path.join(root, 'scripts/conformance-vscode.ts') } });
const { generateConformance, generateLaunchConformance, generateSkillInstallConformance } = await import(`data:text/javascript;base64,${Buffer.from(result.outputFiles[0].text).toString('base64')}`);
const fixtures = [];
try {
  fixtures.push(['tests/conformance/v1.json', await generateConformance(), 'TypeScript core and real Session']);
  fixtures.push(['tests/conformance/launch-v1.json', generateLaunchConformance(), 'TypeScript launch envelope']);
  fixtures.push(['tests/conformance/skill-install.json', generateSkillInstallConformance(), 'the VS Code skill installer']);
} catch (error) {
  // Report only the message: the bundled module's stack contains a very long data: URL.
  console.error(`Fixture generation failed: ${error.message}`);
  process.exit(1);
}
for (const [file, value, source] of fixtures) {
  const generated = JSON.stringify(value, null, 2) + '\n';
  const target = path.join(root, file);
  if (process.argv.includes('--write')) {
    await writeFile(target, generated);
    console.log(`Generated ${file} from ${source}.`);
  } else {
    const committed = await readFile(target, 'utf8').catch(() => '');
    if (committed.replace(/\r\n/g, '\n') !== generated) throw new Error(`Conformance fixture drift in ${file}. Review changes, then run npm run fixtures:generate.`);
    console.log(`Conformance fixtures in ${file} match ${source}.`);
  }
}
