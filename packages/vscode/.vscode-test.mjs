import { defineConfig } from '@vscode/test-cli';
export default defineConfig({
  files: 'out/test/**/*.test.cjs',
  version: '1.90.2',
  workspaceFolder: './test-fixtures/workspace',
  extensionDevelopmentPath: '.',
  launchArgs: ['--disable-extensions', '--disable-workspace-trust'],
});
