import logger from '@/lib/logger';

type LogoutHandler = () => Promise<void> | void;

type HandlerRegistry = Map<string, Set<LogoutHandler>>;

interface RegistryState {
  handlers: HandlerRegistry;
}

const WINDOW_REGISTRY_KEY = '__CTRL_FREAQ_DRAFT_LOGOUT_REGISTRY__';
const WINDOW_BRIDGE_KEY = '__CTRL_FREAQ_DRAFT_LOGOUT__';

const sharedState: RegistryState = {
  handlers: new Map(),
};

const ensureWindowState = (): RegistryState => {
  if (typeof window === 'undefined') {
    return sharedState;
  }

  const globalWindow = window as typeof window & {
    [WINDOW_REGISTRY_KEY]?: RegistryState;
    [WINDOW_BRIDGE_KEY]?: {
      trigger(authorId: string): Promise<void>;
    };
  };

  let registry = globalWindow[WINDOW_REGISTRY_KEY];
  if (!registry) {
    registry = {
      handlers: new Map(),
    } satisfies RegistryState;
    globalWindow[WINDOW_REGISTRY_KEY] = registry;
  }

  if (!globalWindow[WINDOW_BRIDGE_KEY]) {
    globalWindow[WINDOW_BRIDGE_KEY] = {
      trigger: async (authorId: string) => {
        await triggerDraftLogoutHandlers(authorId);
      },
    };
  }

  return registry;
};

const getRegistry = (): RegistryState => {
  return typeof window === 'undefined' ? sharedState : ensureWindowState();
};

export const registerDraftLogoutHandler = (
  authorId: string,
  handler: LogoutHandler
): (() => void) => {
  const normalizedAuthorId = authorId.trim();
  if (!normalizedAuthorId) {
    return () => undefined;
  }

  const registry = getRegistry();
  let handlers = registry.handlers.get(normalizedAuthorId);
  if (!handlers) {
    handlers = new Set();
    registry.handlers.set(normalizedAuthorId, handlers);
  }
  handlers.add(handler);

  return () => {
    handlers.delete(handler);
    if (handlers.size === 0) {
      registry.handlers.delete(normalizedAuthorId);
    }
  };
};

export const triggerDraftLogoutHandlers = async (authorId: string): Promise<void> => {
  const normalizedAuthorId = authorId.trim();
  if (!normalizedAuthorId) {
    return;
  }

  const registry = getRegistry();
  const handlers = registry.handlers.get(normalizedAuthorId);
  if (!handlers || handlers.size === 0) {
    return;
  }

  await Promise.all(
    Array.from(handlers.values()).map(async handler => {
      try {
        await handler();
      } catch (error) {
        const err = error instanceof Error ? error : new Error(String(error));
        logger.error(
          'Draft logout handler execution failed',
          { authorId: normalizedAuthorId },
          err
        );
      }
    })
  );
};
