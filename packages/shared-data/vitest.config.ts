import { defineConfig } from 'vitest/config';
import { resolve } from 'node:path';

const rootDir = resolve(__dirname, '..');
const editorCoreDist = resolve(rootDir, 'editor-core', 'dist');

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
  },
  resolve: {
    alias: {
      '@ctrl-freaq/editor-core': editorCoreDist,
    },
  },
});
