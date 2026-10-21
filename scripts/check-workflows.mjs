import { readFile, access } from 'node:fs/promises';
import assert from 'node:assert/strict';
import { parseDocument } from 'yaml';

export async function workflow(name) {
  const document = parseDocument(await readFile(new URL(`../.github/workflows/${name}.yml`, import.meta.url), 'utf8'), { uniqueKeys: true });
  assert.equal(document.errors.length, 0, document.errors.map(error => error.message).join('\n'));
  return document.toJS();
}
const ci = await workflow('ci');
assert.deepEqual(ci.jobs.verify.strategy.matrix.os, ['windows-latest', 'ubuntu-latest']);
const commands = ci.jobs.verify.steps.map(step => step.run).filter(Boolean);
for (const command of ['npm ci', 'npm run build', 'npm run typecheck', 'npm test', 'npm run test:extension', 'xvfb-run -a npm run test:extension']) assert.ok(commands.includes(command));
assert.ok(!JSON.stringify(ci).includes('WALK_ME_THROUGH_ALLOW_UNSUPPORTED_ENVIRONMENT'));
console.log('Native-platform CI YAML and verification commands are valid.');
const pages = await workflow('pages');
assert.ok(pages.on.workflow_dispatch !== undefined);
assert.deepEqual(pages.on.push.branches, ['main']);
assert.ok(pages.on.push.paths.includes('launcher/**'));
assert.equal(pages.jobs.deploy.if, "needs.inspect.outputs.ready == 'true'");
const gate = pages.jobs.inspect.steps.find(step => step.id === 'launcher').run;
assert.ok(gate.includes('test -f launcher/index.html'));
assert.ok(gate.includes('ready=false') && gate.includes('GITHUB_STEP_SUMMARY'));
assert.equal(pages.jobs.deploy.steps.find(step => step.uses?.startsWith('actions/upload-pages-artifact@')).with.path, 'launcher/');
assert.equal(pages.jobs.deploy.permissions.pages, 'write');
assert.equal(pages.jobs.deploy.permissions['id-token'], 'write');
assert.equal(pages.jobs.deploy.environment.name, 'github-pages');
let launcherExists = true;
try { await access(new URL('../launcher/index.html', import.meta.url)); } catch { launcherExists = false; }
assert.equal(launcherExists, false, 'Update the no-launcher acceptance check once launcher assets are implemented.');
console.log('Pages YAML is valid; the absent launcher selects ready=false and skips deployment. Upload is limited to launcher/.');
