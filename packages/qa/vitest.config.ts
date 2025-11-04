import path from 'node:path';
import { defineConfig } from 'vitest/config';
import { createConsoleSilencer } from '../../scripts/vitest-console-hook';

const editorCoreSrc = path.resolve(__dirname, '../editor-core/src');
const testSupportSrc = path.resolve(__dirname, '..', 'tests', 'support');

export default defineConfig({
  resolve: {
    alias: {
      '@ctrl-freaq/editor-core': path.join(editorCoreSrc, 'index.ts'),
      '@ctrl-freaq/editor-core/': `${editorCoreSrc}/`,
      '@ctrl-freaq/test-support': testSupportSrc,
    },
  },
  test: {
    ...createConsoleSilencer(),
    include: ['src/**/*.test.ts'],
  },
});
