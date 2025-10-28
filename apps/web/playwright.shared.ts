import { devices, type PlaywrightTestConfig } from '@playwright/test';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const moduleDir = path.dirname(fileURLToPath(import.meta.url));
const isPlaywrightDebug = process.env.PLAYWRIGHT_DEBUG === '1';

export const DEFAULT_BASE_URL = process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:5173';

function createReporters(): PlaywrightTestConfig['reporter'] {
  const reporters: PlaywrightTestConfig['reporter'] = [
    ['html', { outputFile: 'test-results.html', open: 'never' }],
    ['json', { outputFile: 'test-results.json' }],
    ['junit', { outputFile: 'junit.xml' }],
  ];

  if (isPlaywrightDebug) {
    reporters.push(['list']);
  }

  return reporters;
}

function createProjects(): PlaywrightTestConfig['projects'] {
  return [
    {
      name: 'Desktop Chrome',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1440, height: 900 },
      },
    } /** Disabled to speed up testing during heavy development!,
    {
      name: 'Desktop Firefox',
      use: {
        ...devices['Desktop Firefox'],
        viewport: { width: 1440, height: 900 },
      },
    },
    {
      name: 'Desktop Safari',
      use: {
        ...devices['Desktop Safari'],
        viewport: { width: 1440, height: 900 },
      },
    },
    {
      name: 'Mobile Chrome',
      use: { ...devices['Pixel 5'] },
    },
    {
      name: 'Mobile Safari',
      use: { ...devices['iPhone 13'] },
    },
    {
      name: 'iPad',
      use: { ...devices['iPad Pro'] },
    },**/,
  ];
}

export function createBaseConfig(): PlaywrightTestConfig {
  return {
    testDir: './tests/e2e',
    testMatch: ['**/*.e2e.ts', '**/*.e2e.tsx'],
    fullyParallel: true,
    forbidOnly: !!process.env.CI,
    retries: process.env.CI ? 2 : 0,
    workers: process.env.CI ? 1 : undefined,
    reporter: createReporters(),
    use: {
      baseURL: DEFAULT_BASE_URL,
      trace: isPlaywrightDebug ? 'on' : 'on-first-retry',
      screenshot: isPlaywrightDebug ? 'on' : 'only-on-failure',
      video: isPlaywrightDebug ? 'on' : 'retain-on-failure',
    },
    projects: createProjects(),
    expect: {
      // Give slower CI environments a bit more room to render dashboard UIs.
      timeout: 6 * 1000,
    },
    timeout: 15 * 1000,
  } satisfies PlaywrightTestConfig;
}

export function createFixtureConfig(): PlaywrightTestConfig {
  const config = createBaseConfig();

  config.webServer = {
    command: 'pnpm --filter @ctrl-freaq/web dev:e2e',
    url: DEFAULT_BASE_URL,
    reuseExistingServer: !process.env.CI,
    timeout: 120 * 1000,
    env: {
      ...process.env,
      VITE_E2E: 'true',
      VITE_API_BASE_URL: process.env.VITE_API_BASE_URL || 'http://localhost:5173/__fixtures/api',
    },
  };

  config.use = {
    ...config.use,
    storageState: path.resolve(moduleDir, './tests/e2e/support/simple-auth.storage.json'),
  };

  return config;
}

export function createLiveConfig(): PlaywrightTestConfig {
  const config = createBaseConfig();

  config.testDir = './tests/live';
  config.testMatch = ['**/*.live.ts', '**/*.live.tsx'];

  config.webServer = {
    command: 'pnpm --filter @ctrl-freaq/web dev:live',
    url: DEFAULT_BASE_URL,
    reuseExistingServer: !process.env.CI,
    timeout: 120 * 1000,
    env: {
      ...process.env,
      VITE_E2E: 'false',
      VITE_API_BASE_URL: process.env.VITE_API_BASE_URL || 'http://localhost:5001/api/v1',
    },
  };

  return config;
}
