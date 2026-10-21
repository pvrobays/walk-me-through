import { build } from 'esbuild';
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = fileURLToPath(new URL('../', import.meta.url));
const { version } = JSON.parse(await readFile(path.join(root, 'packages/skill/package.json'), 'utf8'));
// Bundle the shared text module in memory so build-time hashing uses the core implementation.
const textModule = await build({ absWorkingDir: root, entryPoints: ['packages/core/src/text.ts'], bundle: true, write: false, format: 'esm', platform: 'node' });
const { hashFile } = await import(`data:text/javascript;base64,${Buffer.from(textModule.outputFiles[0].text).toString('base64')}`);
export const bundleFiles = ['SKILL.md', 'references/walkthrough-format.md', 'scripts/publish-walkthrough.mjs'];

export async function buildManifest(directory = path.join(root, 'packages/skill')) {
  const files = {};
  for (const file of bundleFiles) {
    const source = file.startsWith('scripts/') ? path.join(directory, file) : path.join(root, 'packages/skill', file);
    files[file] = hashFile(await readFile(source));
  }
  await mkdir(directory, { recursive: true });
  await writeFile(path.join(directory, 'manifest.json'), JSON.stringify({ manifestVersion: 1, bundleVersion: version, walkthroughSchemaVersion: 1, files }, null, 2) + '\n');
}

export async function buildSkill(outfile = path.join(root, 'packages/skill/scripts/publish-walkthrough.mjs')) {
  await build({
    absWorkingDir: root,
    entryPoints: ['packages/skill/src/cli.ts'],
    outfile,
    bundle: true,
    format: 'esm',
    platform: 'node',
    target: 'node18',
    minify: false,
    banner: { js: `// GENERATED — Walk Me Through bundle ${version}. Source: packages/skill/src/cli.ts and packages/core/src/.` },
  });
}

export async function buildExtension() {
  await build({
    absWorkingDir: root,
    entryPoints: ['packages/vscode/src/extension.ts'],
    outfile: path.join(root, 'packages/vscode/dist/extension.js'),
    bundle: true,
    format: 'cjs',
    platform: 'node',
    target: 'node18',
    external: ['vscode'],
  });
  const tests = (await readdir(path.join(root, 'packages/vscode/test'))).filter(file => file.endsWith('.test.ts'));
  await build({
    absWorkingDir: root,
    entryPoints: tests.map(file => `packages/vscode/test/${file}`),
    outdir: path.join(root, 'packages/vscode/out/test'),
    outExtension: { '.js': '.cjs' },
    bundle: true, format: 'cjs', platform: 'node', target: 'node18', external: ['vscode'],
  });
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await Promise.all([buildSkill().then(() => buildManifest()), buildExtension()]);
}
