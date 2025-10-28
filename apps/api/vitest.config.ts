import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { createConsoleSilencer } from '../../scripts/vitest-console-hook';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = resolve(__dirname, '..');
const sharedDataSrc = resolve(rootDir, '..', 'packages', 'shared-data', 'src');
const templatesDist = resolve(rootDir, '..', 'packages', 'templates', 'dist');
const templateResolverDist = resolve(rootDir, '..', 'packages', 'template-resolver', 'dist');
const editorCoreDist = resolve(rootDir, '..', 'packages', 'editor-core', 'dist');
const qaDist = resolve(rootDir, '..', 'packages', 'qa', 'dist');
const aiDist = resolve(rootDir, '..', 'packages', 'ai', 'dist');

export default defineConfig({
  test: {
    ...createConsoleSilencer(),
    globals: true,
    environment: 'node',
    testTimeout: 30000,
    hookTimeout: 30000,
    teardownTimeout: 10000,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      thresholds: {
        lines: 80,
        statements: 80,
        branches: 70,
        functions: 80,
      },
      exclude: ['node_modules/', 'tests/', 'dist/', '**/*.d.ts', 'vitest.config.ts'],
    },
    setupFiles: ['./tests/setup.ts'],
  },
  resolve: {
    alias: {
      '@': '/src',
      '@ctrl-freaq/shared-data': sharedDataSrc,
      '@ctrl-freaq/templates': templatesDist,
      '@ctrl-freaq/template-resolver': templateResolverDist,
      '@ctrl-freaq/editor-core': editorCoreDist,
      '@ctrl-freaq/qa': qaDist,
      '@ctrl-freaq/qa/traceability': resolve(
        rootDir,
        '..',
        'packages',
        'qa',
        'src',
        'traceability',
        'index.ts'
      ),
      '@ctrl-freaq/ai': aiDist,
    },
  },
});
