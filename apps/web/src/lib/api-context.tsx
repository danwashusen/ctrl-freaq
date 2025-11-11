import { useAuth } from '@/lib/auth-provider';
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  useCallback,
} from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';

import { createApiClient } from './api';
import type ApiClient from './api';
import type {
  CreateProjectRequest,
  ProjectsListQueryParams,
  UpdateProjectRequest,
  UpdateProjectOptions,
} from './api';
import { logger } from './logger';
import { E2EFixtureProvider, isE2EModeEnabled } from './fixtures/e2e/fixture-provider';
import { createEventHub } from './streaming/event-hub';
import type { EventHub, HubHealthState } from './streaming/event-hub';
import { configureDocumentEditorClients } from './document-editor-client-config';

interface ApiContextValue {
  apiClient: ApiClient;
  eventHub: EventHub;
  eventHubHealth: HubHealthState;
  eventHubEnabled: boolean;
  setEventHubEnabled: (enabled: boolean) => void;
}

const parseBooleanEnv = (value: string | undefined): boolean => {
  if (!value) {
    return false;
  }
  const normalized = value.trim().toLowerCase();
  return normalized === 'true' || normalized === '1' || normalized === 'yes' || normalized === 'on';
};

const DEFAULT_API_BASE_URL = 'http://localhost:5001/api/v1';

const resolveApiBaseUrl = (override?: string): string => {
  const envValue =
    override ?? (import.meta.env?.VITE_API_BASE_URL as string | undefined) ?? DEFAULT_API_BASE_URL;
  const trimmed = envValue.trim();
  if (trimmed.length === 0) {
    return DEFAULT_API_BASE_URL;
  }
  return trimmed.replace(/\/+$/, '');
};

const ApiContext = createContext<ApiContextValue | null>(null);

interface ApiProviderProps {
  children: ReactNode;
  baseUrl?: string;
}

export function ApiProvider({ children, baseUrl }: ApiProviderProps) {
  const auth = useAuth();
  const isE2E = isE2EModeEnabled();
  const resolvedBaseUrl = useMemo(() => resolveApiBaseUrl(baseUrl), [baseUrl]);

  useEffect(() => {
    if (isE2E) {
      logger.warn('VITE_E2E fixture mode enabled. API calls will be short-circuited.', {
        baseUrl: resolvedBaseUrl,
      });
    }
  }, [isE2E, resolvedBaseUrl]);

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

  const getAuthToken = useCallback(async () => {
    try {
      return await tokenFetcher();
    } catch (error) {
      logger.error('Failed to get auth token', {}, error instanceof Error ? error : undefined);
      return null;
    }
  }, [tokenFetcher]);

  const tokenFetcherRef = useRef(getAuthToken);
  useEffect(() => {
    tokenFetcherRef.current = getAuthToken;
  }, [getAuthToken]);

  const eventHubRef = useRef<EventHub | null>(null);
  if (!eventHubRef.current) {
    eventHubRef.current = createEventHub({
      getAuthToken: () => tokenFetcherRef.current(),
      streamPath: import.meta.env?.VITE_EVENT_STREAM_PATH as string | undefined,
    });
  }
  const eventHub = eventHubRef.current;

  const [eventHubHealth, setEventHubHealth] = useState<HubHealthState>(() =>
    eventHub.getHealthState()
  );

  useEffect(() => {
    const dispose = eventHub.onHealthChange(setEventHubHealth);
    return () => dispose();
  }, [eventHub]);

  const [eventHubEnabled, setEventHubEnabled] = useState<boolean>(
    () => !isE2E && parseBooleanEnv(import.meta.env?.VITE_ENABLE_SSE_HUB as string | undefined)
  );

  const lastConfiguredRef = useRef<{ baseUrl: string; getAuthToken: typeof getAuthToken } | null>(
    null
  );
  if (
    !lastConfiguredRef.current ||
    lastConfiguredRef.current.baseUrl !== resolvedBaseUrl ||
    lastConfiguredRef.current.getAuthToken !== getAuthToken
  ) {
    configureDocumentEditorClients({
      baseUrl: resolvedBaseUrl,
      getAuthToken,
    });
    lastConfiguredRef.current = { baseUrl: resolvedBaseUrl, getAuthToken };
  }

  const apiClient = useMemo(
    () =>
      createApiClient({
        baseUrl: resolvedBaseUrl,
        getAuthToken,
      }),
    [resolvedBaseUrl, getAuthToken]
  );

  const authState = auth as { isSignedIn?: boolean; userId?: string | null };
  const isSignedIn = Boolean(authState?.isSignedIn);
  const authUserId = authState?.userId ?? null;

  useEffect(() => {
    if (!isSignedIn) {
      eventHub.shutdown();
      setEventHubHealth(eventHub.getHealthState());
      return;
    }

    eventHub.setEnabled(eventHubEnabled);
    if (eventHubEnabled) {
      eventHub.forceReconnect();
    }
  }, [eventHub, eventHubEnabled, isSignedIn, authUserId]);

  useEffect(() => {
    if (isE2E) {
      setEventHubEnabled(false);
      eventHub.shutdown();
      setEventHubHealth(eventHub.getHealthState());
    }
  }, [eventHub, isE2E]);

  useEffect(() => {
    return () => {
      eventHub.shutdown();
    };
  }, [eventHub]);

  const value = useMemo(
    () => ({
      apiClient,
      eventHub,
      eventHubHealth,
      eventHubEnabled,
      setEventHubEnabled,
    }),
    [apiClient, eventHub, eventHubHealth, eventHubEnabled, setEventHubEnabled]
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
  const context = useContext(ApiContext);
  if (!context) {
    throw new Error('useApi must be used within an ApiProvider');
  }

  const { apiClient, eventHub, eventHubHealth, eventHubEnabled, setEventHubEnabled } = context;

  // Memoize API facade so its identity is stable across renders
  return useMemo(
    () => ({
      projects: {
        getAll: (params?: ProjectsListQueryParams) => apiClient.getProjects(params),
        getById: (id: string) => apiClient.getProject(id),
        create: (data: CreateProjectRequest) => apiClient.createProject(data),
        update: (id: string, updates: UpdateProjectRequest, options: UpdateProjectOptions) =>
          apiClient.updateProject(id, updates, options),
        delete: (id: string) => apiClient.archiveProject(id),
        archive: (id: string) => apiClient.archiveProject(id),
        restore: (id: string) => apiClient.restoreProject(id),
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
      eventHub,
      eventHubHealth,
      eventHubEnabled,
      setEventHubEnabled,
    }),
    [apiClient, eventHub, eventHubHealth, eventHubEnabled, setEventHubEnabled]
  );
}
