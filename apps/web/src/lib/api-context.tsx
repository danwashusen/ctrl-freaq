import { useAuth } from '@/lib/auth-provider';
import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';

import { createApiClient } from './api';
import type ApiClient from './api';
import { logger } from './logger';
import { E2EFixtureProvider, isE2EModeEnabled } from './fixtures/e2e/fixture-provider';

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
  const isE2E = isE2EModeEnabled();

  useEffect(() => {
    if (isE2E) {
      logger.warn('VITE_E2E fixture mode enabled. API calls will be short-circuited.', {
        baseUrl,
      });
    }
  }, [isE2E, baseUrl]);

  const tokenFetcher = useMemo(() => {
    const maybeAuth = auth as unknown as { getToken?: unknown };
    if (typeof maybeAuth.getToken === 'function') {
      const fetcher = maybeAuth.getToken as () => Promise<string | null>;
      return async () => {
        const token = await fetcher();
        if (typeof token === 'string') {
          const trimmed = token.trim();
          return trimmed.length > 0 ? trimmed : null;
        }
        return token;
      };
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

  const [queryClient] = useState(() => new QueryClient());

  const providerTree = (
    <QueryClientProvider client={queryClient}>
      <ApiContext.Provider value={value}>{children}</ApiContext.Provider>
    </QueryClientProvider>
  );

  if (isE2E) {
    return <E2EFixtureProvider>{providerTree}</E2EFixtureProvider>;
  }

  return providerTree;
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
