import { defineConfig } from 'vitest/config';
import { resolve } from 'node:path';
import { createConsoleSilencer } from '../../scripts/vitest-console-hook';

const rootDir = resolve(__dirname, '..');
const editorCoreDist = resolve(rootDir, 'editor-core', 'dist');

export default defineConfig({
  test: {
    ...createConsoleSilencer(),
    globals: true,
    environment: 'node',
  },
  resolve: {
    alias: {
      '@ctrl-freaq/editor-core': editorCoreDist,
    },
  },
});
