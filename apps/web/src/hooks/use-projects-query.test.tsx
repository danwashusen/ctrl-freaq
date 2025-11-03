import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';

import type { ProjectsListResponse } from '@/lib/api';
import type {
  EventEnvelope,
  EventHub,
  HubHealthState,
  HubListener,
  HubSubscriptionScope,
} from '@/lib/streaming/event-hub';

import { useProjectsQuery } from './use-projects-query';

const mockGetAll = vi.fn<() => Promise<ProjectsListResponse>>();
const unsubscribeMock = vi.fn();

let currentHealth: HubHealthState = {
  status: 'healthy',
  lastEventAt: null,
  lastHeartbeatAt: null,
  retryAttempt: 0,
  fallbackActive: false,
};

let eventListener: HubListener | null = null;

const subscribeMock = vi.fn(
  (scope: HubSubscriptionScope, listener: HubListener): (() => void) => {
    eventListener = listener;
    return () => {
      unsubscribeMock(scope);
    };
  }
);

const mockEventHub: EventHub = {
  subscribe: subscribeMock,
  onHealthChange: vi.fn().mockReturnValue(() => {}),
  onFallbackChange: vi.fn().mockReturnValue(() => {}),
  getHealthState: () => currentHealth,
  isEnabled: () => true,
  setEnabled: vi.fn(),
  forceReconnect: vi.fn(),
  shutdown: vi.fn(),
};

const setEventHubHealth = (next: HubHealthState) => {
  currentHealth.status = next.status;
  currentHealth.lastEventAt = next.lastEventAt;
  currentHealth.lastHeartbeatAt = next.lastHeartbeatAt;
  currentHealth.retryAttempt = next.retryAttempt;
  currentHealth.fallbackActive = next.fallbackActive;
};

const setEventHubEnabledMock = vi.fn();

let apiContextModule: typeof import('@/lib/api-context');
let useApiSpy: ReturnType<typeof vi.spyOn> | null = null;

beforeAll(async () => {
  apiContextModule = await import('@/lib/api-context');
});

const projectFixture = {
  id: 'proj-001',
  ownerUserId: 'user-123',
  name: 'Lifecycle Sample',
  slug: 'lifecycle-sample',
  description: 'Project for SSE tests',
  visibility: 'workspace' as const,
  status: 'draft' as const,
  archivedStatusBefore: null,
  goalTargetDate: null,
  goalSummary: null,
  createdAt: '2025-11-02T18:00:00.000Z',
  createdBy: 'user-123',
  updatedAt: '2025-11-02T18:00:00.000Z',
  updatedBy: 'user-123',
  deletedAt: null,
  deletedBy: null,
};

describe('useProjectsQuery', () => {
  let queryClient: QueryClient;

  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
      },
    });
    currentHealth = {
      status: 'healthy',
      lastEventAt: null,
      lastHeartbeatAt: null,
      retryAttempt: 0,
      fallbackActive: false,
    };
    eventListener = null;
    mockGetAll.mockReset();
    subscribeMock.mockClear();
    unsubscribeMock.mockClear();
    setEventHubEnabledMock.mockReset();
    useApiSpy = vi.spyOn(apiContextModule, 'useApi').mockReturnValue({
      projects: {
        getAll: mockGetAll,
        getById: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
        delete: vi.fn(),
        archive: vi.fn(),
        restore: vi.fn(),
      },
      configuration: {
        get: vi.fn(),
        update: vi.fn(),
      },
      health: {
        check: vi.fn(),
      },
      client: {} as never,
      eventHub: mockEventHub,
      eventHubHealth: currentHealth,
      eventHubEnabled: true,
      setEventHubEnabled: setEventHubEnabledMock,
    });
  });

  afterEach(() => {
    queryClient.clear();
    useApiSpy?.mockRestore();
    useApiSpy = null;
  });

  it('updates cached project list when hub delivers lifecycle events', async () => {
    mockGetAll.mockResolvedValue({
      projects: [projectFixture],
      total: 1,
      limit: 20,
      offset: 0,
    });

    const { result, unmount } = renderHook(() => useProjectsQuery(), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(subscribeMock).toHaveBeenCalledTimes(1);
    expect(subscribeMock).toHaveBeenCalledWith({ topic: 'project.lifecycle' }, expect.any(Function));
    expect(eventListener).not.toBeNull();
    expect(mockGetAll).toHaveBeenCalledTimes(1);

    const lifecycleEnvelope: EventEnvelope<{
      projectId: string;
      status: string;
      previousStatus?: string | null;
      updatedBy?: string;
    }> = {
      id: 'project.lifecycle:proj-001:2',
      topic: 'project.lifecycle',
      resourceId: projectFixture.id,
      workspaceId: 'workspace-default',
      sequence: 2,
      kind: 'event',
      payload: {
        projectId: projectFixture.id,
        status: 'archived',
        previousStatus: 'draft',
        updatedBy: 'user-456',
      },
      emittedAt: '2025-11-02T18:10:00.000Z',
      metadata: {},
      lastEventId: null,
    };

    await act(async () => {
      eventListener?.(lifecycleEnvelope);
    });

    await waitFor(() => {
      expect(result.current.data?.projects?.[0]?.status).toBe('archived');
      expect(result.current.data?.projects?.[0]?.archivedStatusBefore).toBe('draft');
    });
    expect(mockGetAll).toHaveBeenCalledTimes(1);

    unmount();
    expect(unsubscribeMock).toHaveBeenCalledTimes(1);
    expect(unsubscribeMock).toHaveBeenCalledWith({ topic: 'project.lifecycle' });
  });

  it('resumes polling when hub fallback activates and stops after recovery', async () => {
    vi.useFakeTimers();

    mockGetAll.mockResolvedValue({
      projects: [projectFixture],
      total: 1,
      limit: 20,
      offset: 0,
    });

    const { rerender, unmount, result } = renderHook(() => useProjectsQuery(), { wrapper });
    await act(async () => {
      await Promise.resolve();
    });
    expect(result.current.isSuccess).toBe(true);

    expect(mockGetAll).toHaveBeenCalledTimes(1);

    await act(async () => {
      vi.advanceTimersByTime(5000);
    });
    expect(mockGetAll).toHaveBeenCalledTimes(1);

    setEventHubHealth({
      status: 'degraded',
      lastEventAt: Date.now(),
      lastHeartbeatAt: Date.now(),
      retryAttempt: 3,
      fallbackActive: true,
    });
    rerender();

    await act(async () => {
      vi.advanceTimersByTime(1500);
    });
    expect(mockGetAll).toHaveBeenCalledTimes(2);

    setEventHubHealth({
      status: 'healthy',
      lastEventAt: Date.now(),
      lastHeartbeatAt: Date.now(),
      retryAttempt: 0,
      fallbackActive: false,
    });
    rerender();

    await act(async () => {
      vi.advanceTimersByTime(3000);
    });
    expect(mockGetAll).toHaveBeenCalledTimes(2);

    unmount();
    vi.useRealTimers();
  });
});
