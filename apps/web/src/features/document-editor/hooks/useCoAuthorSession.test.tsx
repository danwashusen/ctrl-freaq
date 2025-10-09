import type { ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createHash } from 'node:crypto';

import type { CoAuthoringStreamEvent } from '../api/co-authoring.client';
import { useCoAuthoringStore } from '../stores/co-authoring-store';
import { useCoAuthorSession } from './useCoAuthorSession';

describe('useCoAuthorSession', () => {
  beforeEach(() => {
    useCoAuthoringStore.getState().reset();
  });

  it('normalizes diff segments using content from SSE payloads and computes canonical diff hash when missing', async () => {
    const callbacks = new Map<string, (event: CoAuthoringStreamEvent) => void>();
    const subscribeToSession = vi.fn(
      (sessionId: string, handler: (event: CoAuthoringStreamEvent) => void) => {
        callbacks.set(sessionId, handler);
        return { close: vi.fn() };
      }
    );

    const queryClient = new QueryClient();
    const { result } = renderHook(
      () =>
        useCoAuthorSession({
          documentId: 'doc-123',
          sectionId: 'section-abc',
          authorId: 'author-789',
          api: { subscribeToSession },
        }),
      {
        wrapper: ({ children }: { children: ReactNode }) => (
          <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
        ),
      }
    );

    act(() => {
      result.current.ensureSession();
    });

    const session = useCoAuthoringStore.getState().session;
    expect(session?.sessionId).toBeTruthy();

    const handler = session ? callbacks.get(session.sessionId) : undefined;
    expect(handler).toBeDefined();

    const diffSegments = [
      {
        segmentId: 'seg-context',
        type: 'context',
        content: 'Existing copy',
        startLine: 1,
        endLine: 1,
      },
      {
        segmentId: 'seg-added',
        type: 'added',
        content: 'Fresh accessible content',
        startLine: 2,
        endLine: 2,
        metadata: {
          original: { startLine: 2, endLine: 2 },
          modified: { startLine: 2, endLine: 2 },
        },
      },
    ];

    const expectedDiffHash = `sha256:${createHash('sha256')
      .update(JSON.stringify(diffSegments))
      .digest('hex')}`;

    act(() => {
      handler?.({
        type: 'proposal.ready',
        proposalId: 'proposal-123',
        diff: {
          mode: 'unified',
          segments: diffSegments,
        },
        annotations: [],
        confidence: 0.82,
        citations: [],
        expiresAt: '2025-10-06T12:05:00.000Z',
        diffHash: undefined,
      });
    });

    let pending = useCoAuthoringStore.getState().pendingProposal;

    await waitFor(() => {
      pending = useCoAuthoringStore.getState().pendingProposal;
      expect(pending).not.toBeNull();
    });

    expect(pending?.diffHash).toBe(expectedDiffHash);

    const diff = pending?.diff as {
      mode?: string;
      segments?: Array<{ segmentId: string; content?: string }>;
    };

    expect(diff?.segments?.[1]?.segmentId).toBe('seg-added');
    expect(diff?.segments?.[1]?.content).toBe('Fresh accessible content');
    expect(pending?.draftPatch).toContain('+Fresh accessible content');
    expect(pending?.diffHash).toBe(expectedDiffHash);
  });

  it('passes computed diff hash to apply requests when SSE payload omits hash', async () => {
    const callbacks = new Map<string, (event: CoAuthoringStreamEvent) => void>();
    const subscribeToSession = vi.fn(
      (sessionId: string, handler: (event: CoAuthoringStreamEvent) => void) => {
        callbacks.set(sessionId, handler);
        return { close: vi.fn() };
      }
    );
    const postApply = vi.fn().mockResolvedValue({ status: 'queued' });

    const queryClient = new QueryClient();
    const { result } = renderHook(
      () =>
        useCoAuthorSession({
          documentId: 'doc-apply',
          sectionId: 'section-apply',
          authorId: 'author-apply',
          api: { subscribeToSession, postApply },
        }),
      {
        wrapper: ({ children }: { children: ReactNode }) => (
          <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
        ),
      }
    );

    act(() => {
      result.current.ensureSession();
    });

    const session = useCoAuthoringStore.getState().session;
    const handler = session ? callbacks.get(session.sessionId) : undefined;

    const diffSegments = [
      {
        segmentId: 'seg-context',
        type: 'context',
        content: 'Existing copy',
        startLine: 1,
        endLine: 1,
      },
      {
        segmentId: 'seg-added',
        type: 'added',
        content: 'Fresh accessible content',
        startLine: 2,
        endLine: 2,
      },
    ];

    const expectedDiffHash = `sha256:${createHash('sha256')
      .update(JSON.stringify(diffSegments))
      .digest('hex')}`;

    act(() => {
      handler?.({
        type: 'proposal.ready',
        proposalId: 'proposal-apply',
        diff: {
          mode: 'unified',
          segments: diffSegments,
        },
        annotations: [],
        confidence: 0.92,
        citations: [],
        expiresAt: '2025-10-06T12:10:00.000Z',
      });
    });

    let pending = useCoAuthoringStore.getState().pendingProposal;

    await waitFor(() => {
      pending = useCoAuthoringStore.getState().pendingProposal;
      expect(pending).not.toBeNull();
    });

    const resolvedPending = pending;
    if (!resolvedPending) {
      throw new Error('Pending proposal not available');
    }
    expect(resolvedPending.diffHash).toBe(expectedDiffHash);
    const draftPatch = resolvedPending.draftPatch;
    if (!draftPatch) {
      throw new Error('Pending proposal missing draft patch');
    }

    await act(async () => {
      await result.current.approveProposal({
        proposalId: resolvedPending.proposalId,
        draftPatch,
        diffHash: resolvedPending.diffHash,
        approvalNotes: 'Looks good',
      });
    });

    expect(postApply).toHaveBeenCalledWith(
      expect.objectContaining({
        diffHash: expectedDiffHash,
        proposalId: 'proposal-apply',
      }),
      expect.objectContaining({ signal: expect.any(AbortSignal) })
    );
  });

  it('prefixes every line in draft patches for multi-line segments', async () => {
    const callbacks = new Map<string, (event: CoAuthoringStreamEvent) => void>();
    const subscribeToSession = vi.fn(
      (sessionId: string, handler: (event: CoAuthoringStreamEvent) => void) => {
        callbacks.set(sessionId, handler);
        return { close: vi.fn() };
      }
    );

    const queryClient = new QueryClient();
    const { result } = renderHook(
      () =>
        useCoAuthorSession({
          documentId: 'doc-123',
          sectionId: 'section-abc',
          authorId: 'author-789',
          api: { subscribeToSession },
        }),
      {
        wrapper: ({ children }: { children: ReactNode }) => (
          <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
        ),
      }
    );

    act(() => {
      result.current.ensureSession();
    });

    const session = useCoAuthoringStore.getState().session;
    const handler = session ? callbacks.get(session.sessionId) : undefined;

    act(() => {
      handler?.({
        type: 'proposal.ready',
        proposalId: 'proposal-456',
        diff: {
          mode: 'unified',
          segments: [
            {
              segmentId: 'seg-context',
              type: 'context',
              content: 'Existing context line\nSecond context line',
            },
            {
              segmentId: 'seg-removed',
              type: 'removed',
              content: 'Old line one\nOld line two\n',
            },
            {
              segmentId: 'seg-added',
              type: 'added',
              content: 'New line one\nNew line two',
            },
          ],
        },
        annotations: [],
        confidence: 0.4,
        citations: [],
      });
    });

    let pending = useCoAuthoringStore.getState().pendingProposal;

    await waitFor(() => {
      pending = useCoAuthoringStore.getState().pendingProposal;
      expect(pending).not.toBeNull();
    });

    const resolvedPending = pending;
    if (!resolvedPending) {
      throw new Error('Pending proposal not available');
    }
    const draftPatch = resolvedPending.draftPatch;
    if (!draftPatch) {
      throw new Error('Pending proposal missing draft patch');
    }

    const patchLines = draftPatch.split('\n');
    expect(patchLines).toContain(' Existing context line');
    expect(patchLines).toContain(' Second context line');
    expect(patchLines).toContain('-Old line one');
    expect(patchLines).toContain('-Old line two');
    expect(patchLines).toContain('-');
    expect(patchLines).toContain('+New line one');
    expect(patchLines).toContain('+New line two');
  });

  it('increments streaming elapsed time locally so cancel controls unlock after SLA threshold', async () => {
    vi.useFakeTimers();
    const callbacks = new Map<string, (event: CoAuthoringStreamEvent) => void>();
    const subscribeToSession = vi.fn(
      (sessionId: string, handler: (event: CoAuthoringStreamEvent) => void) => {
        callbacks.set(sessionId, handler);
        return { close: vi.fn() };
      }
    );

    const queryClient = new QueryClient();
    const { result, unmount } = renderHook(
      () =>
        useCoAuthorSession({
          documentId: 'doc-progress',
          sectionId: 'section-progress',
          authorId: 'author-progress',
          api: { subscribeToSession },
        }),
      {
        wrapper: ({ children }: { children: ReactNode }) => (
          <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
        ),
      }
    );

    try {
      await act(async () => {
        result.current.ensureSession();
      });

      const storeProgressStatus = useCoAuthoringStore.getState().progress.status;
      expect(storeProgressStatus).toBe('streaming');
      const timersAfterSession = vi.getTimerCount();
      expect(timersAfterSession).toBeGreaterThan(0);

      const session = useCoAuthoringStore.getState().session;
      const handler = session ? callbacks.get(session.sessionId) : undefined;
      expect(handler).toBeDefined();
      act(() => {
        handler?.({ type: 'progress', status: 'streaming', elapsedMs: 0 });
      });

      expect(useCoAuthoringStore.getState().progress.status).toBe('streaming');

      act(() => {
        vi.advanceTimersByTime(6000);
        vi.runOnlyPendingTimers();
      });

      const progressed = useCoAuthoringStore.getState().progress.elapsedMs;
      expect(progressed).toBeGreaterThanOrEqual(5000);
    } finally {
      vi.useRealTimers();
      unmount();
    }
  });
});
