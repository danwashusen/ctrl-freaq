import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = resolve(__dirname, '..');
const sharedDataSrc = resolve(rootDir, '..', 'packages', 'shared-data', 'src');
const templatesSrc = resolve(rootDir, '..', 'packages', 'templates', 'src');
const templateResolverSrc = resolve(rootDir, '..', 'packages', 'template-resolver', 'src');
const editorCoreSrc = resolve(rootDir, '..', 'packages', 'editor-core', 'src');

export default defineConfig({
  test: {
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
      '@ctrl-freaq/templates': templatesSrc,
      '@ctrl-freaq/template-resolver': templateResolverSrc,
      '@ctrl-freaq/editor-core': editorCoreSrc,
    },
  },
});
