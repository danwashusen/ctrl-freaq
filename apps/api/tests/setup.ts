import { beforeEach } from 'vitest';

process.env.API_TEST_AUTO_RESET = process.env.API_TEST_AUTO_RESET || 'true';

beforeEach(async () => {
  const { resetAllRegisteredApps } = await import('../src/testing/reset');
  resetAllRegisteredApps();
});
