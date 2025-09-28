import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

import { createFixtureRequestHandler } from './src/lib/fixtures/e2e';

const resolveCliMode = (): string | null => {
  const modeFlagIndex = process.argv.findIndex(
    arg => arg === '--mode' || arg.startsWith('--mode=')
  );
  if (modeFlagIndex === -1) {
    return null;
  }

  const flag = process.argv[modeFlagIndex];
  if (flag === '--mode') {
    return process.argv[modeFlagIndex + 1] ?? null;
  }

  const [, value] = flag.split('=');
  return value ?? null;
};

const createE2EFixturePlugin = (isE2EEnabled: boolean) => {
  return {
    name: 'ctrl-freaq-e2e-fixture-alias',
    configureServer(server: import('vite').ViteDevServer) {
      if (!isE2EEnabled) {
        return;
      }

      const handler = createFixtureRequestHandler();

      server.middlewares.use('/__fixtures', (req, res, next) => {
        Promise.resolve(handler(req, res, next)).catch(error => {
          server.config.logger.error(
            '[fixtures] request handler failed',
            error instanceof Error ? error : new Error(String(error))
          );

          res.statusCode = 500;
          res.setHeader('Content-Type', 'application/json');
          res.end(
            JSON.stringify({
              code: 'fixtures.handler_error',
              message: 'Fixture handler failed to process request.',
            })
          );
        });
      });
    },
  } satisfies import('vite').Plugin;
};

export default defineConfig(({ mode }) => {
  const projectRoot = process.cwd();
  const rawEnv = loadEnv(mode, projectRoot, '');
  const cliMode = resolveCliMode();
  const resolvedE2E =
    process.env.VITE_E2E ??
    rawEnv.VITE_E2E ??
    (cliMode === 'e2e' ? 'true' : undefined) ??
    (mode === 'e2e' ? 'true' : 'false');

  process.env.VITE_E2E = resolvedE2E;
  const isE2EEnabled = resolvedE2E === 'true';

  const plugins: import('vite').Plugin[] = [react()];
  if (isE2EEnabled) {
    plugins.push(createE2EFixturePlugin(isE2EEnabled));
  }

  return {
    plugins,
    define: {
      'import.meta.env.VITE_E2E': JSON.stringify(resolvedE2E),
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
        '@ctrl-freaq/editor-persistence': path.resolve(
          __dirname,
          '../..',
          'packages/editor-persistence/src/storage/index.ts'
        ),
        '@ctrl-freaq/e2e-fixtures': path.resolve(__dirname, './src/lib/fixtures/e2e'),
      },
    },
    server: {
      port: 5173,
      proxy: {
        '/api': {
          target: 'http://localhost:5001',
          changeOrigin: true,
        },
      },
    },
    build: {
      outDir: 'dist',
      sourcemap: true,
    },
    test: {
      globals: true,
      environment: 'jsdom',
      setupFiles: ['./tests/setup.ts'],
      coverage: {
        provider: 'v8',
        reporter: ['text', 'json', 'html'],
        thresholds: { lines: 80, statements: 80, branches: 70, functions: 80 },
      },
    },
  } satisfies ReturnType<typeof defineConfig>;
});
