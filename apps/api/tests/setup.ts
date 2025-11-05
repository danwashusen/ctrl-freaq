import type { EventSource as NodeEventSource } from 'eventsource';
import { afterAll, beforeEach } from 'vitest';

import { restoreSimpleAuthEnv, setSimpleAuthEnv } from '../src/testing/auth.js';

type EventSourceConstructor = typeof EventSource;

const resolveEventSource = async (): Promise<NodeEventSource> => {
  const module = (await import('eventsource')) as unknown as {
    default?: NodeEventSource;
    EventSource?: NodeEventSource;
  };
  const candidate = module.default ?? module.EventSource;

  if (!candidate) {
    throw new Error('Failed to resolve EventSource polyfill constructor');
  }

  return candidate;
};

if (typeof globalThis.EventSource === 'undefined') {
  const polyfill = await resolveEventSource();
  globalThis.EventSource = polyfill as unknown as EventSourceConstructor;
}

const simpleAuthSnapshot = setSimpleAuthEnv();

process.env.API_TEST_AUTO_RESET = process.env.API_TEST_AUTO_RESET || 'true';

beforeEach(async () => {
  const { resetAllRegisteredApps } = await import('../src/testing/reset');
  resetAllRegisteredApps();
});

afterAll(() => {
  restoreSimpleAuthEnv(simpleAuthSnapshot);
});
