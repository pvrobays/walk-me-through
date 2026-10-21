import { createHash } from 'node:crypto';
import { copyFile, mkdir, readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const files = ['SKILL.md', 'manifest.json', 'references/walkthrough-format.md', 'scripts/publish-walkthrough.mjs'];
const args = process.argv.slice(2);
const hash = bytes => createHash('sha256').update(bytes.toString('utf8').replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n')).digest('hex');
try {
  if (!args[0] || args[0].startsWith('--') || args.length > 2 || (args[1] && args[1] !== '--force')) throw new Error('Usage: npm run skill:install -- <projectDir> [--force]');
  const project = path.resolve(args[0]);
  if (!(await stat(project)).isDirectory()) throw new Error('Project target must be an existing directory.');
  const source = fileURLToPath(new URL('../packages/skill/', import.meta.url));
  const target = path.join(project, '.agents/skills/walk-me-through');
  const differences = [];
  for (const file of files) {
    const canonical = await readFile(path.join(source, file));
    let existing;
    try { existing = await readFile(path.join(target, file)); }
    catch (error) { if (error.code !== 'ENOENT') throw error; }
    if (existing && hash(existing) !== hash(canonical)) differences.push(file);
  }
  if (differences.length && args[1] !== '--force') throw new Error(`Refusing to overwrite differing files: ${differences.join(', ')}. Review the changes or pass --force.`);
  for (const file of files) {
    const destination = path.join(target, file);
    await mkdir(path.dirname(destination), { recursive: true });
    await copyFile(path.join(source, file), destination);
  }
  console.log(`Installed Walk Me Through in ${target}. Quit and restart OpenCode to discover the skill.`);
} catch (error) { console.error(error.message); process.exitCode = 1; }
