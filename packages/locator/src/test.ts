import type { Locator, Logger, DbHandle } from './index';

export function makeTestLocator(overrides?: Partial<Locator>): Locator {
  const log: Logger = {
    info: () => {},
    warn: () => {},
    error: () => {},
  };
  const db: DbHandle = { connection: {} };
  const repos = {
    documents: {} as any,
    sections: {} as any,
    assumptions: {} as any,
    knowledge: {} as any,
    trace: {} as any,
    proposals: {} as any,
    activity: {} as any,
  };
  return {
    requestId: 'test',
    logger: log,
    db: () => db,
    repos: () => repos,
    ai: () => ({} as any),
    session: async () => ({ userId: 'test-user@example.com' }),
    ...overrides,
  };
}

