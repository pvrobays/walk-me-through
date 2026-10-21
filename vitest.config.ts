import { defineConfig } from 'vitest/config';
export default defineConfig({ test: { include: ['packages/core/test/**/*.test.ts', 'packages/skill/test/**/*.test.ts', 'packages/vscode/unit/**/*.test.ts', 'packages/launcher/test/**/*.test.ts'] } });
