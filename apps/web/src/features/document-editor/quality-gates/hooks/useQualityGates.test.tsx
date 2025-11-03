import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';

vi.mock('zustand/shallow', async () => {
  const actual = await vi.importActual<typeof import('zustand/shallow')>('zustand/shallow');
  return actual;
});

import type ApiClient from '@/lib/api';
import {
  documentQualityStore,
  sectionQualityStore,
} from '../stores';
import type {
  DocumentQualitySummary,
  SectionQualitySnapshot,
} from '../stores';
import type {
  EventEnvelope,
  EventHub,
  HubHealthState,
  HubListener,
  HubSubscriptionScope,
} from '@/lib/streaming/event-hub';

import { useQualityGates } from './useQualityGates';

const DOCUMENT_ID = 'demo-architecture';
const SECTION_ID = 'sec-overview';

const mockClient = {} as ApiClient;

const mockFetchSectionResult = vi.fn();
const mockFetchDocumentSummary = vi.fn();
const mockRunSection = vi.fn();
const mockRunDocument = vi.fn();

const unsubscribeMock = vi.fn();
const listeners = new Map<string, HubListener>();

let currentHealth: HubHealthState = {
  status: 'healthy',
  lastEventAt: null,
  lastHeartbeatAt: null,
  retryAttempt: 0,
  fallbackActive: false,
};

const subscribeMock = vi.fn(
  (scope: HubSubscriptionScope, listener: HubListener): (() => void) => {
    listeners.set(scope.topic, listener);
    return () => {
      listeners.delete(scope.topic);
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

const setEventHubHealth = (state: HubHealthState) => {
  currentHealth = state;
};

const setEventHubEnabledMock = vi.fn();

vi.mock('@/lib/api-context', () => ({
  useApiClient: () => mockClient,
  useApi: () => ({
    eventHub: mockEventHub,
    eventHubHealth: currentHealth,
    eventHubEnabled: true,
    setEventHubEnabled: setEventHubEnabledMock,
  }),
}));

describe('useQualityGates', () => {
  let queryClient: QueryClient;

  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    mockFetchSectionResult.mockReset();
    mockFetchDocumentSummary.mockReset();
    mockRunSection.mockReset();
    mockRunDocument.mockReset();
    subscribeMock.mockClear();
    unsubscribeMock.mockClear();
    listeners.clear();
    documentQualityStore.getState().reset();
    sectionQualityStore.getState().reset();
    currentHealth = {
      status: 'healthy',
      lastEventAt: null,
      lastHeartbeatAt: null,
      retryAttempt: 0,
      fallbackActive: false,
    };
    setEventHubEnabledMock.mockReset();
  });

  afterEach(() => {
    queryClient.clear();
  });

  it('updates section and document state from hub progress/summary events', async () => {
    const initialSectionSnapshot: SectionQualitySnapshot = {
      sectionId: SECTION_ID,
      documentId: DOCUMENT_ID,
      runId: 'run-initial',
      status: 'Pass',
      rules: [],
      lastRunAt: '2025-11-03T17:55:00.000Z',
      lastSuccessAt: '2025-11-03T17:55:00.000Z',
      triggeredBy: 'user-456',
      source: 'manual',
      durationMs: 1800,
      remediationState: 'resolved',
      incidentId: null,
      requestId: 'req-initial',
      createdAt: '2025-11-03T17:55:00.000Z',
      updatedAt: '2025-11-03T17:55:00.000Z',
    };

    const completedSectionSnapshot: SectionQualitySnapshot = {
      sectionId: SECTION_ID,
      documentId: DOCUMENT_ID,
      runId: 'run-section',
      status: 'Pass',
      rules: [],
      lastRunAt: '2025-11-03T18:00:00.000Z',
      lastSuccessAt: '2025-11-03T18:00:00.000Z',
      triggeredBy: 'user-123',
      source: 'manual',
      durationMs: 2500,
      remediationState: 'resolved',
      incidentId: null,
      requestId: 'req-section',
      createdAt: '2025-11-03T18:00:00.000Z',
      updatedAt: '2025-11-03T18:00:00.000Z',
    };

    const documentSummary: DocumentQualitySummary = {
      documentId: DOCUMENT_ID,
      statusCounts: { pass: 5, warning: 0, blocker: 0, neutral: 0 },
      blockerSections: [],
      warningSections: [],
      lastRunAt: '2025-11-03T18:00:01.000Z',
      triggeredBy: 'user-123',
      requestId: 'req-doc',
      publishBlocked: false,
      coverageGaps: [],
    };

    mockFetchSectionResult.mockResolvedValue(initialSectionSnapshot);
    mockFetchDocumentSummary.mockResolvedValue(documentSummary);
    mockRunSection.mockResolvedValue({
      status: 'running',
      requestId: 'req-section',
      runId: 'run-section',
      triggeredBy: 'user-123',
      sectionId: SECTION_ID,
    });
    mockRunDocument.mockResolvedValue({
      status: 'running',
      requestId: 'req-doc',
      documentId: DOCUMENT_ID,
      triggeredBy: 'user-123',
    });

    const { result } = renderHook(
      () =>
        useQualityGates({
          documentId: DOCUMENT_ID,
          sectionId: SECTION_ID,
          serviceOverrides: {
            fetchSectionResult: mockFetchSectionResult,
            fetchDocumentSummary: mockFetchDocumentSummary,
            runSection: mockRunSection,
            runDocument: mockRunDocument,
          },
        }),
      { wrapper }
    );

    await waitFor(() => expect(mockFetchSectionResult).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(mockFetchDocumentSummary).toHaveBeenCalledTimes(1));

    expect(subscribeMock).toHaveBeenCalled();
    const progressListener = listeners.get('quality-gate.progress');
    const summaryListener = listeners.get('quality-gate.summary');
    expect(progressListener).toBeDefined();
    expect(summaryListener).toBeDefined();

    await act(async () => {
      await result.current.runSection();
    });
    await waitFor(() => expect(result.current.isRunning).toBe(true));

    const progressEnvelope: EventEnvelope<{
      runId: string;
      documentId: string;
      sectionId: string;
      status: string;
      stage: string;
      percentComplete: number;
      incidentId: string | null;
      result?: SectionQualitySnapshot | null;
    }> = {
      id: 'quality-gate.progress:demo-architecture:1',
      topic: 'quality-gate.progress',
      resourceId: DOCUMENT_ID,
      workspaceId: 'workspace-default',
      sequence: 1,
      kind: 'event',
      emittedAt: '2025-11-03T18:00:02.000Z',
      payload: {
        runId: 'run-section',
        documentId: DOCUMENT_ID,
        sectionId: SECTION_ID,
        status: 'completed',
        stage: 'section.completed',
        percentComplete: 100,
        incidentId: null,
        result: completedSectionSnapshot,
      },
      metadata: {},
      lastEventId: null,
    };

    await act(async () => {
      progressListener?.(progressEnvelope);
    });

    expect(result.current.isRunning).toBe(false);
    expect(result.current.status).toBe('completed');
    expect(result.current.incidentId).toBeNull();

    const summaryEnvelope: EventEnvelope<DocumentQualitySummary & { status: string }> = {
      id: 'quality-gate.summary:demo-architecture:2',
      topic: 'quality-gate.summary',
      resourceId: DOCUMENT_ID,
      workspaceId: 'workspace-default',
      sequence: 2,
      kind: 'event',
      emittedAt: '2025-11-03T18:00:03.000Z',
      payload: {
        ...documentSummary,
        status: 'completed',
      },
      metadata: {},
      lastEventId: null,
    };

    await act(async () => {
      summaryListener?.(summaryEnvelope);
    });

    expect(result.current.documentSummary).toEqual(documentSummary);
    expect(result.current.isDocumentRunning).toBe(false);
  });

  it('restores polling when hub fallback activates', async () => {
    mockFetchSectionResult.mockResolvedValue({
      sectionId: SECTION_ID,
      documentId: DOCUMENT_ID,
      runId: 'run-initial',
      status: 'Pass',
      rules: [],
      lastRunAt: null,
      lastSuccessAt: null,
      triggeredBy: 'user-789',
      source: 'manual',
      durationMs: 100,
      remediationState: 'resolved',
      incidentId: null,
      requestId: 'req-initial',
      createdAt: '2025-11-03T18:01:00.000Z',
      updatedAt: '2025-11-03T18:01:00.000Z',
    } satisfies SectionQualitySnapshot);
    mockFetchDocumentSummary.mockResolvedValue({
      documentId: DOCUMENT_ID,
      statusCounts: { pass: 1, warning: 0, blocker: 0, neutral: 0 },
      blockerSections: [],
      warningSections: [],
      lastRunAt: null,
      triggeredBy: 'user-789',
      requestId: 'req-doc-initial',
      publishBlocked: false,
      coverageGaps: [],
    } satisfies DocumentQualitySummary);
    mockRunSection.mockResolvedValue({
      status: 'running',
      requestId: 'req-run',
      runId: 'run-section',
      triggeredBy: 'user-789',
      sectionId: SECTION_ID,
    });

    const { result, rerender } = renderHook(
      () =>
        useQualityGates({
          documentId: DOCUMENT_ID,
          sectionId: SECTION_ID,
          serviceOverrides: {
            fetchSectionResult: mockFetchSectionResult,
            fetchDocumentSummary: mockFetchDocumentSummary,
            runSection: mockRunSection,
            runDocument: mockRunDocument,
          },
        }),
      { wrapper }
    );

    await waitFor(() => expect(mockFetchSectionResult).toHaveBeenCalledTimes(1));

    await act(async () => {
      await result.current.runSection();
    });
    await waitFor(() => expect(result.current.isRunning).toBe(true));

    const callCountAfterRun = mockFetchSectionResult.mock.calls.length;

    await new Promise(resolve => setTimeout(resolve, 1000));
    expect(mockFetchSectionResult.mock.calls.length).toBe(callCountAfterRun);

    setEventHubHealth({
      status: 'degraded',
      lastEventAt: Date.now(),
      lastHeartbeatAt: Date.now(),
      retryAttempt: 3,
      fallbackActive: true,
    });
    rerender();

    await new Promise(resolve => setTimeout(resolve, 700));

    await waitFor(() =>
      expect(mockFetchSectionResult.mock.calls.length).toBeGreaterThan(callCountAfterRun)
    );
  });
});
