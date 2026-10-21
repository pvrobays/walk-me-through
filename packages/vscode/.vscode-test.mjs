import { defineConfig } from '@vscode/test-cli';
export default defineConfig({
  files: 'out/test/**/*.test.cjs',
  version: '1.90.2',
  workspaceFolder: './test-fixtures/workspace',
  extensionDevelopmentPath: '.',
  launchArgs: ['--disable-extensions', '--disable-workspace-trust'],
  // Hosted Windows runners exceed mocha's 2s default for editor-driven playback; a timed-out test keeps
  // running and its cleanup would then interfere with the next suite.
  mocha: { timeout: 20000 },
});
