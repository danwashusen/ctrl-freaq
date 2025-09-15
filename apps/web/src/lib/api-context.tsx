import { useAuth } from '@clerk/clerk-react';
import { createContext, useContext, useMemo } from 'react';
import type { ReactNode } from 'react';

import { createApiClient } from './api';
import type ApiClient from './api';
import { logger } from './logger';

interface ApiContextValue {
  apiClient: ApiClient;
}

const ApiContext = createContext<ApiContextValue | null>(null);

interface ApiProviderProps {
  children: ReactNode;
  baseUrl?: string;
}

export function ApiProvider({ children, baseUrl }: ApiProviderProps) {
  const auth = useAuth();
  const tokenFetcher = useMemo(() => {
    const maybeAuth = auth as unknown as { getToken?: unknown };
    if (typeof maybeAuth.getToken === 'function') {
      return maybeAuth.getToken as () => Promise<string | null>;
    }
    return async () => null;
  }, [auth]);

  const apiClient = useMemo(
    () =>
      createApiClient({
        baseUrl,
        getAuthToken: async () => {
          try {
            return await tokenFetcher();
          } catch (error) {
            logger.error(
              'Failed to get auth token',
              {},
              error instanceof Error ? error : undefined
            );
            return null;
          }
        },
      }),
    [baseUrl, tokenFetcher]
  );

  const value = useMemo(
    () => ({
      apiClient,
    }),
    [apiClient]
  );

  return <ApiContext.Provider value={value}>{children}</ApiContext.Provider>;
}

export function useApiClient(): ApiClient {
  const context = useContext(ApiContext);
  if (!context) {
    throw new Error('useApiClient must be used within an ApiProvider');
  }
  return context.apiClient;
}

export function useApi() {
  const apiClient = useApiClient();

  // Memoize API facade so its identity is stable across renders
  return useMemo(
    () => ({
      projects: {
        getAll: () => apiClient.getProjects(),
        getById: (id: string) => apiClient.getProject(id),
        create: (data: { name: string; description: string }) => apiClient.createProject(data),
        update: (id: string, updates: { name?: string; description?: string }) =>
          apiClient.updateProject(id, updates),
        delete: (id: string) => apiClient.deleteProject(id),
      },
      configuration: {
        get: () => apiClient.getConfiguration(),
        update: (config: {
          theme?: string;
          notifications?: boolean;
          language?: string;
          timezone?: string;
        }) => apiClient.updateConfiguration(config),
      },
      health: {
        check: () => apiClient.healthCheck(),
      },
      client: apiClient,
    }),
    [apiClient]
  );
}
