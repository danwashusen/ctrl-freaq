import fs from 'node:fs';
import path from 'node:path';

import { createLogger, defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

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

const parseEnvFile = (content: string): Record<string, string> => {
  const result = new Map<string, string>();
  const lines = content.split(/\r?\n/);
  for (const raw of lines) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;

    const match = line.match(/^([A-Za-z_][A-Za-z0-9_.-]*)\s*=\s*(.*)$/);
    if (!match) continue;

    const key = match[1] ?? '';
    let value = (match[2] ?? '').trim();

    if (value.length >= 2) {
      const start = value[0];
      const end = value[value.length - 1];
      if ((start === '"' && end === '"') || (start === "'" && end === "'")) {
        value = value.slice(1, -1);
      }
    }

    if (key) {
      result.set(key, value);
    }
  }

  return Object.fromEntries(result.entries());
};

const loadEnvFile = (filePath: string): Record<string, string> | null => {
  try {
    if (!fs.existsSync(filePath)) return null;
    const content = fs.readFileSync(filePath, 'utf8');
    return parseEnvFile(content);
  } catch {
    return null;
  }
};

const configLogger = createLogger('info');

export default defineConfig(({ mode }) => {
  const projectRoot = process.cwd();
  const originalEnv = { ...process.env };
  const rawEnv = loadEnv(mode, projectRoot, '');
  const cliMode = resolveCliMode();
  const profile =
    process.env.CTRL_FREAQ_PROFILE ??
    rawEnv.CTRL_FREAQ_PROFILE ??
    rawEnv.VITE_CTRL_FREAQ_PROFILE ??
    '';
  const normalizedProfile = profile?.trim().toLowerCase() ?? '';
  const isFixtureProfile = normalizedProfile === 'fixture';

  const envFixturePath = path.resolve(projectRoot, '.env.fixture');
  const envLocalPath = path.resolve(projectRoot, '.env.local');

  let fixtureVars: Record<string, string> | null = null;
  if (isFixtureProfile) {
    fixtureVars = loadEnvFile(envFixturePath);
    if (fixtureVars) {
      for (const [key, value] of Object.entries(fixtureVars)) {
        rawEnv[key] = value;
        process.env[key] = value;
      }
    } else {
      configLogger.warn(
        `CTRL_FREAQ_PROFILE=fixture but ${envFixturePath} was not found or failed to load`
      );
    }
  }

  if (isFixtureProfile) {
    const localVars = loadEnvFile(envLocalPath);
    if (localVars) {
      const fixtureKeys = new Set(Object.keys(fixtureVars ?? {}));
      for (const key of Object.keys(localVars)) {
        if (fixtureKeys.has(key)) {
          continue;
        }

        if (originalEnv[key] !== undefined) {
          process.env[key] = originalEnv[key];
        } else {
          Reflect.deleteProperty(process.env, key);
        }
        Reflect.deleteProperty(rawEnv, key);
      }
    }
  }

  const resolvedE2E =
    process.env.VITE_E2E ??
    rawEnv.VITE_E2E ??
    (cliMode === 'e2e' ? 'true' : undefined) ??
    (mode === 'e2e' ? 'true' : 'false');

  process.env.VITE_E2E = resolvedE2E;
  const isE2EEnabled = resolvedE2E === 'true';

  const plugins: import('vite').Plugin[] = [tailwindcss(), react()];
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
          'packages/editor-persistence/src'
        ),
        '@ctrl-freaq/editor-persistence/*':
          path.resolve(__dirname, '../..', 'packages/editor-persistence/src') + '/*',
        '@ctrl-freaq/qa': path.resolve(__dirname, '../..', 'packages/qa/src'),
        '@ctrl-freaq/qa/*': path.resolve(__dirname, '../..', 'packages/qa/src') + '/*',
        '@ctrl-freaq/e2e-fixtures': path.resolve(__dirname, './src/lib/fixtures/e2e'),
        '@ctrl-freaq/test-support': path.resolve(__dirname, '../..', 'tests', 'support'),
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
