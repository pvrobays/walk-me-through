import { readFile, readdir, access } from 'node:fs/promises';
import assert from 'node:assert/strict';
import { parseDocument } from 'yaml';

export async function workflow(name) {
  const document = parseDocument(await readFile(new URL(`../.github/workflows/${name}.yml`, import.meta.url), 'utf8'), { uniqueKeys: true });
  assert.equal(document.errors.length, 0, document.errors.map(error => error.message).join('\n'));
  return document.toJS();
}
const ci = await workflow('ci');
assert.deepEqual(ci.jobs.verify.strategy.matrix.os, ['windows-latest', 'ubuntu-latest', 'macos-latest']);
const commands = ci.jobs.verify.steps.map(step => step.run).filter(Boolean);
for (const command of ['npm ci', 'npm run build', 'npm run typecheck', 'npm test', 'npm run test:extension', 'xvfb-run -a npm run test:extension']) assert.ok(commands.includes(command));
const extensionHost = ci.jobs.verify.steps.find(step => step.run === 'npm run test:extension');
assert.ok(extensionHost.if.includes("runner.os == 'Windows'") && extensionHost.if.includes("runner.os == 'macOS'"), 'Windows and macOS run extension-host tests without Xvfb.');
assert.equal(ci.jobs.verify.steps.find(step => step.run === 'xvfb-run -a npm run test:extension').if, "runner.os == 'Linux'");
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
assert.deepEqual(pages.permissions, { contents: 'read' });
const uploads = pages.jobs.deploy.steps.filter(step => step.uses?.startsWith('actions/upload-pages-artifact@'));
assert.equal(uploads.length, 1, 'Exactly one Pages artifact upload.');
for (const asset of ['index.html', 'styles.css', 'launcher.js']) {
  await access(new URL(`../launcher/${asset}`, import.meta.url)).catch(() => assert.fail(`launcher/${asset} must exist for the gated Pages deployment.`));
}
const deployed = (await readdir(new URL('../launcher/', import.meta.url))).sort();
assert.deepEqual(deployed, ['index.html', 'launcher.js', 'styles.css'], 'launcher/ must contain only the static launcher assets.');
console.log('Pages YAML is valid; launcher/index.html exists, so the gate selects ready=true. Upload is limited to launcher/ (index.html, styles.css, launcher.js).');
