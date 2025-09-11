import type { AppFactories, Locator } from './index';

export function createAppLocator(factories: AppFactories) {
  return {
    derive(requestId: string): Locator {
      const logger = factories.makeLogger({ requestId });
      const db = factories.makeDb();
      const repos = factories.makeRepos(db);
      const ai = factories.makeAi({ requestId });
      const session = factories.getSession;
      return {
        requestId,
        logger,
        db: () => db,
        repos: () => repos,
        ai,
        session,
      };
    },
  };
}

