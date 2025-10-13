import type { ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi, type MockedFunction } from 'vitest';

import type { CoAuthoringStreamEvent } from '../api/co-authoring.client';
import { useDocumentQaSession } from './useDocumentQaSession';
import { useDocumentQaStore } from '../stores/document-qa-store';

interface StartReviewBody {
  status: 'accepted';
  sessionId: string;
  queue: {
    disposition: 'started' | 'pending';
    concurrencySlot?: number;
    replacedSessionId: string | null;
    replacementPolicy: 'newest_replaces_pending';
  };
  delivery: {
    mode: 'streaming' | 'fallback';
    reason: string | null;
  };
}

interface RetryReviewBody {
  status: 'requeued';
  previousSessionId: string;
  sessionId: string;
  queue: StartReviewBody['queue'];
}

type StartReviewFn = (input: {
  documentId: string;
  sectionId: string;
  reviewerId: string;
  sessionId: string;
  prompt: string;
}) => Promise<{ body: StartReviewBody; streamLocation: string | null }>;

type CancelReviewFn = (input: {
  documentId: string;
  sectionId: string;
  sessionId: string;
  reason: 'author_cancelled' | 'replaced_by_new_request' | 'transport_failure' | 'deferred';
}) => Promise<{
  status: 'canceled' | 'not_found';
  cancelReason: 'author_cancelled' | 'replaced_by_new_request' | 'transport_failure' | 'deferred';
  promotedSessionId: string | null;
}>;

type RetryReviewFn = (input: {
  documentId: string;
  sectionId: string;
  sessionId: string;
}) => Promise<{ body: RetryReviewBody; streamLocation: string | null }>;

type SubscribeFn = (
  sessionId: string,
  handler: (event: CoAuthoringStreamEvent) => void,
  options?: { streamPath?: string }
) => { close: () => void };

interface TestApis {
  callbacks: Map<string, (event: CoAuthoringStreamEvent) => void>;
  streamPaths: Map<string, string | undefined>;
  startReview: MockedFunction<StartReviewFn>;
  cancelReview: MockedFunction<CancelReviewFn>;
  retryReview: MockedFunction<RetryReviewFn>;
  subscribeToSession: MockedFunction<SubscribeFn>;
}

const createWrapper =
  (queryClient: QueryClient) =>
  ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );

const setupApis = (
  overrides?: Partial<{
    startReview: StartReviewFn;
    cancelReview: CancelReviewFn;
    retryReview: RetryReviewFn;
  }>
): TestApis => {
  const callbacks = new Map<string, (event: CoAuthoringStreamEvent) => void>();
  const streamPaths = new Map<string, string | undefined>();

  const fallbackStart: StartReviewFn = async ({ sessionId }) => ({
    body: {
      status: 'accepted',
      sessionId,
      queue: {
        disposition: 'started',
        concurrencySlot: 1,
        replacedSessionId: null,
        replacementPolicy: 'newest_replaces_pending',
      },
      delivery: {
        mode: 'streaming',
        reason: null,
      },
    },
    streamLocation: `/api/v1/document-qa/sessions/${sessionId}/events`,
  });

  const fallbackCancel: CancelReviewFn = async () => ({
    status: 'canceled',
    cancelReason: 'author_cancelled',
    promotedSessionId: null,
  });

  const fallbackRetry: RetryReviewFn = async ({ sessionId }) => {
    const retrySessionId = `${sessionId}::retry`;
    return {
      body: {
        status: 'requeued',
        previousSessionId: sessionId,
        sessionId: retrySessionId,
        queue: {
          disposition: 'started',
          concurrencySlot: 2,
          replacedSessionId: sessionId,
          replacementPolicy: 'newest_replaces_pending',
        },
      },
      streamLocation: `/api/v1/document-qa/sessions/${retrySessionId}/events`,
    };
  };

  const startReview = vi.fn<StartReviewFn>(overrides?.startReview ?? fallbackStart);
  const cancelReview = vi.fn<CancelReviewFn>(overrides?.cancelReview ?? fallbackCancel);
  const retryReview = vi.fn<RetryReviewFn>(overrides?.retryReview ?? fallbackRetry);
  const subscribeToSession = vi.fn<SubscribeFn>(
    (
      sessionId: string,
      handler: (event: CoAuthoringStreamEvent) => void,
      options?: { streamPath?: string }
    ) => {
      callbacks.set(sessionId, handler);
      streamPaths.set(sessionId, options?.streamPath);
      return { close: vi.fn() };
    }
  );

  return {
    callbacks,
    streamPaths,
    startReview,
    cancelReview,
    retryReview,
    subscribeToSession,
  };
};

const renderQaHook = (
  apis: TestApis,
  options?: Partial<{
    documentId: string;
    sectionId: string;
    reviewerId: string;
    promptBuilder: (context: { documentId: string; sectionId: string }) => string;
  }>
) => {
  const queryClient = new QueryClient();
  const hook = renderHook(
    () =>
      useDocumentQaSession({
        documentId: options?.documentId ?? 'doc-qa',
        sectionId: options?.sectionId ?? 'section-qa',
        reviewerId: options?.reviewerId ?? 'reviewer-123',
        promptBuilder:
          options?.promptBuilder ??
          (({ sectionId }) => `Review section ${sectionId} for compliance readiness.`),
        api: {
          startReview: apis.startReview,
          cancelReview: apis.cancelReview,
          retryReview: apis.retryReview,
          subscribeToSession: apis.subscribeToSession,
        },
      }),
    {
      wrapper: createWrapper(queryClient),
    }
  );

  return { ...hook, queryClient };
};

describe('useDocumentQaSession', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('calls backend review endpoint and subscribes using returned stream location', async () => {
    const apis = setupApis();
    const { result } = renderQaHook(apis);

    await act(async () => {
      await result.current.ensureSession();
    });

    expect(apis.startReview).toHaveBeenCalledTimes(1);
    const payload = apis.startReview.mock.calls[0]?.[0];
    expect(payload).toMatchObject({
      documentId: 'doc-qa',
      sectionId: 'section-qa',
      reviewerId: 'reviewer-123',
    });
    expect(typeof payload?.prompt).toBe('string');
    expect(payload?.prompt).toContain('section-qa');

    const invokedSessionId = payload?.sessionId;
    expect(typeof invokedSessionId).toBe('string');

    expect(apis.subscribeToSession).toHaveBeenCalledWith(
      invokedSessionId,
      expect.any(Function),
      expect.objectContaining({
        streamPath: expect.stringContaining('document-qa/sessions'),
      })
    );
  });

  it('records stage labels and replacement notices for streaming parity', async () => {
    const apis = setupApis({
      startReview: async input => ({
        body: {
          status: 'accepted',
          sessionId: input.sessionId,
          queue: {
            disposition: 'pending',
            concurrencySlot: undefined,
            replacedSessionId: 'qa-session-old',
            replacementPolicy: 'newest_replaces_pending',
          },
          delivery: {
            mode: 'streaming',
            reason: null,
          },
        },
        streamLocation: `/api/v1/document-qa/sessions/${input.sessionId}/events`,
      }),
    });
    const { result } = renderQaHook(apis);

    await act(async () => {
      await result.current.ensureSession();
    });

    const handler = result.current.session
      ? apis.callbacks.get(result.current.session.sessionId)
      : undefined;
    expect(handler).toBeDefined();

    await act(async () => {
      handler?.({
        type: 'progress',
        status: 'streaming',
        elapsedMs: 200,
        stage: 'analysis',
        replacement: {
          previousSessionId: 'qa-session-old',
          promotedSessionId: null,
        },
      } as CoAuthoringStreamEvent);
    });

    expect(result.current.progress.stageLabel).toBe('analysis');
    expect(result.current.progress.status).toBe('streaming');

    await waitFor(() =>
      expect(useDocumentQaStore.getState().replacementNotice?.previousSessionId).toBe(
        'qa-session-old'
      )
    );

    expect(result.current.replacementNotice?.previousSessionId).toBe('qa-session-old');
  });

  it('resequences out-of-order QA review tokens before updating transcript', async () => {
    const apis = setupApis();
    const { result } = renderQaHook(apis);

    await act(async () => {
      await result.current.ensureSession();
    });

    const handler = result.current.session
      ? apis.callbacks.get(result.current.session.sessionId)
      : undefined;
    expect(handler).toBeDefined();

    await act(async () => {
      handler?.({
        type: 'token',
        value: 'Second finding',
        sequence: 2,
      } as CoAuthoringStreamEvent);
      handler?.({
        type: 'token',
        value: 'First finding',
        sequence: 1,
      } as CoAuthoringStreamEvent);
    });

    expect(result.current.transcript).toEqual(['First finding', 'Second finding']);
  });

  it('invokes cancel and retry endpoints to manage streaming lifecycle', async () => {
    const apis = setupApis();
    const { result } = renderQaHook(apis);

    await act(async () => {
      await result.current.ensureSession();
    });

    act(() => {
      result.current.cancelStreaming();
    });

    expect(apis.cancelReview).toHaveBeenCalledTimes(1);
    expect(result.current.progress.status).toBe('canceled');

    await act(async () => {
      await result.current.ensureSession();
    });

    expect(apis.retryReview).toHaveBeenCalledTimes(1);
    expect(result.current.progress.retryCount).toBeGreaterThan(0);
  });

  it('tracks fallback transitions for document QA reviews', async () => {
    const apis = setupApis({
      startReview: async ({ sessionId }) => ({
        body: {
          status: 'accepted',
          sessionId,
          queue: {
            disposition: 'started',
            concurrencySlot: 1,
            replacedSessionId: null,
            replacementPolicy: 'newest_replaces_pending',
          },
          delivery: {
            mode: 'fallback',
            reason: 'transport_blocked',
          },
        },
        streamLocation: `/api/v1/document-qa/sessions/${sessionId}/events`,
      }),
    });
    const { result } = renderQaHook(apis);

    await act(async () => {
      await result.current.ensureSession();
    });

    const handler = result.current.session
      ? apis.callbacks.get(result.current.session.sessionId)
      : undefined;
    expect(handler).toBeDefined();

    await act(async () => {
      handler?.({
        type: 'state',
        status: 'fallback_active',
        fallbackReason: 'transport_blocked',
        preservedTokensCount: 4,
        retryAttempted: false,
        elapsedMs: 900,
        delivery: 'fallback',
      } as CoAuthoringStreamEvent);
    });

    expect(result.current.progress.status).toBe('fallback');
    expect(result.current.progress.fallbackReason).toBe('transport_blocked');

    await act(async () => {
      handler?.({
        type: 'state',
        status: 'fallback_completed',
        fallbackReason: 'transport_blocked',
        preservedTokensCount: 4,
        elapsedMs: 2100,
        delivery: 'fallback',
      } as CoAuthoringStreamEvent);
    });

    expect(result.current.progress.status).toBe('fallback');
    expect(result.current.progress.delivery).toBe('fallback');

    await act(async () => {
      handler?.({
        type: 'token',
        value: 'Review focus: Validate fallback guidance mirrors streaming tokens.',
        sequence: 1,
      } as CoAuthoringStreamEvent);
      handler?.({
        type: 'token',
        value: 'Finding: QA panel must surface transcripts even when SSE is disabled.',
        sequence: 2,
      } as CoAuthoringStreamEvent);
    });

    expect(result.current.transcript).toEqual([
      'Review focus: Validate fallback guidance mirrors streaming tokens.',
      'Finding: QA panel must surface transcripts even when SSE is disabled.',
    ]);
  });
});
