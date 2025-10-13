import type { ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';

import type { AssumptionFlowState } from '..';
import { useAssumptionsFlow } from './use-assumptions-flow';

vi.mock('..', async () => {
  const actual = await vi.importActual<typeof import('..')>('..');
  const mockState: AssumptionFlowState = {
    sessionId: 'session-streaming',
    promptsRemaining: 3,
    overridesOpen: 0,
    proposalHistory: [],
    summaryMarkdown: 'Pending streaming updates',
    prompts: [
      {
        id: 'assume-streaming',
        heading: 'Streaming reliability',
        body: 'Confirm streaming behaviour',
        responseType: 'text',
        options: [],
        priority: 0,
        status: 'pending',
        answer: null,
        overrideJustification: null,
        unresolvedOverrideCount: 0,
      },
    ],
  };

  const bootstrap = {
    start: vi.fn(async () => mockState),
    resume: vi.fn(async () => mockState),
    respond: vi.fn(async () => mockState),
    stop: vi.fn(async () => undefined),
  };

  return {
    ...actual,
    createAssumptionsFlowBootstrap: vi.fn(() => bootstrap),
  };
});

const wrapper = ({ children }: { children: ReactNode }) => {
  const queryClient = new QueryClient();
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
};

const buildProgressEvent = (
  sequence: number,
  stageLabel: string,
  snippet: string,
  overrides: Record<string, unknown> = {}
) => ({
  type: 'progress' as const,
  data: {
    sessionId: 'session-streaming',
    sequence,
    stageLabel,
    timestamp: new Date().toISOString(),
    contentSnippet: snippet,
    deltaType: 'text',
    deliveryChannel: 'streaming',
    announcementPriority: 'polite',
    elapsedMs: sequence * 25,
    ...overrides,
  },
});

const buildStatusEvent = (status: string, overrides: Record<string, unknown> = {}) => ({
  type: 'status' as const,
  data: {
    status,
    timestamp: new Date().toISOString(),
    ...overrides,
  },
});

describe('useAssumptionsFlow streaming', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('resequences progress events and records announcements for assumption streaming', async () => {
    const callbacks = new Map<string, (event: { type: string; data: unknown }) => void>();
    const subscribeToStream = vi.fn(
      (
        sectionId: string,
        sessionId: string,
        handler: (event: { type: string; data: unknown }) => void
      ) => {
        callbacks.set(`${sectionId}:${sessionId}`, handler);
        return { close: vi.fn() };
      }
    );

    const { result } = renderHook(
      () =>
        useAssumptionsFlow({
          documentId: 'doc-stream',
          sectionId: 'section-stream',
          api: {
            subscribeToStream,
          },
        }),
      { wrapper }
    );

    await waitFor(() => {
      expect(result.current.state).not.toBeNull();
    });

    const handler = callbacks.get('section-stream:session-streaming');
    expect(handler).toBeDefined();

    act(() => {
      handler?.(buildProgressEvent(2, 'assumptions.progress.analysis', 'Second bullet'));
      handler?.(buildProgressEvent(1, 'assumptions.progress.summary', 'First bullet'));
    });

    expect(result.current.streaming.bullets.map(bullet => bullet.sequence)).toEqual([1, 2]);
    expect(result.current.streaming.hasOutOfOrder).toBe(true);
    expect(
      result.current.streaming.announcements.some(announcement =>
        announcement.includes('Second bullet')
      )
    ).toBe(true);
  });

  it('tracks deferred and resumed streaming status updates for assumptions', async () => {
    const callbacks = new Map<string, (event: { type: string; data: unknown }) => void>();
    const subscribeToStream = vi.fn(
      (
        sectionId: string,
        sessionId: string,
        handler: (event: { type: string; data: unknown }) => void
      ) => {
        callbacks.set(`${sectionId}:${sessionId}`, handler);
        return { close: vi.fn() };
      }
    );

    const { result } = renderHook(
      () =>
        useAssumptionsFlow({
          documentId: 'doc-status',
          sectionId: 'section-status',
          api: {
            subscribeToStream,
          },
        }),
      { wrapper }
    );

    await waitFor(() => {
      expect(result.current.state).not.toBeNull();
    });

    const handler = callbacks.get('section-status:session-streaming');
    expect(handler).toBeDefined();

    act(() => {
      handler?.(buildStatusEvent('deferred'));
    });
    expect(result.current.streaming.status).toBe('deferred');

    act(() => {
      handler?.(buildStatusEvent('resumed'));
    });
    expect(result.current.streaming.status).toBe('streaming');
  });

  it('marks streaming as canceled when cancel status arrives', async () => {
    const callbacks = new Map<string, (event: { type: string; data: unknown }) => void>();
    const subscribeToStream = vi.fn(
      (
        sectionId: string,
        sessionId: string,
        handler: (event: { type: string; data: unknown }) => void
      ) => {
        callbacks.set(`${sectionId}:${sessionId}`, handler);
        return { close: vi.fn() };
      }
    );

    const { result } = renderHook(
      () =>
        useAssumptionsFlow({
          documentId: 'doc-cancel',
          sectionId: 'section-cancel',
          api: {
            subscribeToStream,
          },
        }),
      { wrapper }
    );

    await waitFor(() => {
      expect(result.current.state).not.toBeNull();
    });

    const handler = callbacks.get('section-cancel:session-streaming');
    expect(handler).toBeDefined();

    act(() => {
      handler?.(buildStatusEvent('canceled'));
    });

    expect(result.current.streaming.status).toBe('canceled');
  });

  it('captures fallback lifecycle announcements and state', async () => {
    const callbacks = new Map<string, (event: { type: string; data: unknown }) => void>();
    const subscribeToStream = vi.fn(
      (
        sectionId: string,
        sessionId: string,
        handler: (event: { type: string; data: unknown }) => void
      ) => {
        callbacks.set(`${sectionId}:${sessionId}`, handler);
        return { close: vi.fn() };
      }
    );

    const { result } = renderHook(
      () =>
        useAssumptionsFlow({
          documentId: 'doc-fallback',
          sectionId: 'section-fallback',
          api: {
            subscribeToStream,
          },
        }),
      { wrapper }
    );

    await waitFor(() => {
      expect(result.current.state).not.toBeNull();
    });

    const handler = callbacks.get('section-fallback:session-streaming');
    expect(handler).toBeDefined();

    act(() => {
      handler?.(
        buildProgressEvent(1, 'assumptions.progress.analysis', 'Fallback bullet', {
          status: 'fallback',
          deliveryChannel: 'fallback',
          fallbackReason: 'transport_blocked',
          preservedTokensCount: 3,
          elapsedMs: 1600,
        })
      );
    });

    expect(result.current.streaming.status).toBe('fallback');
    expect(result.current.streaming.fallback?.status).toBe('active');
    expect(result.current.streaming.fallback?.progressCopy).toContain(
      'Assumptions fallback in progress'
    );

    act(() => {
      handler?.(
        buildStatusEvent('fallback_completed', {
          fallbackReason: 'transport_blocked',
          preservedTokensCount: 3,
          elapsedMs: 2800,
        })
      );
    });

    expect(result.current.streaming.fallback?.status).toBe('completed');
    expect(
      result.current.streaming.announcements.some(announcement =>
        announcement.includes('Completed using fallback')
      )
    ).toBe(true);
  });
});
