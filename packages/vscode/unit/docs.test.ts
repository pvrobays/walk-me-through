import { expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

const vscodeTitles = (JSON.parse(readFileSync('packages/vscode/package.json', 'utf8')).contributes.commands as { title: string }[]).map(command => command.title);
const riderTitles = [...readFileSync('packages/rider/src/main/resources/META-INF/plugin.xml', 'utf8').matchAll(/text="(Walk Me Through: [^"]+)"/g)].map(match => match[1]);
const documented = (file: string) => [...readFileSync(file, 'utf8').matchAll(/\*\*(Walk Me Through: [^*]+)\*\*/g)].map(match => match[1]);

it('documents only command names that the IDEs contribute', () => {
  expect(vscodeTitles).toContain('Walk Me Through: Install Skill into Project');
  expect(riderTitles).toContain('Walk Me Through: Install Skill into Project');
  for (const file of ['README.md', 'packages/vscode/README.md']) for (const name of documented(file)) expect(vscodeTitles, `${file}: ${name}`).toContain(name);
  for (const file of ['README.md', 'packages/rider/README.md']) for (const name of documented(file)) expect(riderTitles, `${file}: ${name}`).toContain(name);
  for (const file of ['README.md', 'packages/vscode/README.md', 'packages/rider/README.md']) expect(documented(file), file).toContain('Walk Me Through: Install Skill into Project');
});
