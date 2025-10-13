import { describe, expect, it, vi, beforeEach } from 'vitest';
import type { Logger } from 'pino';
import type { Response } from 'express';

import { createSectionStreamQueue } from '@ctrl-freaq/editor-core/streaming/section-stream-queue.js';
import {
  DocumentQaStreamingService,
  type DocumentQaStreamingDependencies,
} from '../../../src/modules/document-qa/services/document-qa-streaming.service.js';

type CompleteSession = (
  sessionId: string,
  outcome: {
    status: 'completed' | 'fallback_completed';
    delivery: 'streaming' | 'fallback';
    extras?: Record<string, unknown>;
  }
) => void;

describe('DocumentQaStreamingService', () => {
  const baseLogger = {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  } as unknown as Logger;

  const buildService = () => {
    const queue = createSectionStreamQueue();
    const telemetry = {
      logReview: vi.fn(),
    };
    const dependencies: DocumentQaStreamingDependencies = {
      logger: baseLogger,
      queue,
      telemetry,
      now: () => new Date('2025-10-06T12:00:00Z'),
    };

    const service = new DocumentQaStreamingService(dependencies);

    return {
      service,
      telemetry,
    };
  };

  const captureSse = () => {
    const events: Array<{ event: string; data: unknown }> = [];
    let pending: Partial<{ event: string; data: unknown }> = {};

    const res: Partial<Response> = {
      setHeader: vi.fn(),
      flushHeaders: vi.fn(),
      on: vi.fn(),
      end: vi.fn(),
      write(chunk: string) {
        const text = chunk.toString();
        for (const line of text.split('\n')) {
          if (line.startsWith('event:')) {
            pending.event = line.replace('event:', '').trim();
          } else if (line.startsWith('data:')) {
            const payload = line.replace('data:', '').trim();
            try {
              pending.data = JSON.parse(payload);
            } catch {
              pending.data = payload;
            }
          } else if (line.trim() === '' && pending.event) {
            events.push({ event: pending.event, data: pending.data ?? null });
            pending = {};
          }
        }
        return true;
      },
    };

    return { res: res as Response, events };
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('enqueues newest review requests and reports queue metadata', async () => {
    const { service, telemetry } = buildService();

    const internals = service as unknown as { completeSession: CompleteSession };
    const completeSpy = vi.spyOn(internals, 'completeSession').mockImplementation(() => {});

    const first = await service.startReview({
      sessionId: 'qa-session-primary',
      documentId: 'doc-qa',
      sectionId: 'section-qa',
      reviewerId: 'qa-user',
      prompt: 'Verify requirements',
    });

    expect((first as Record<string, unknown>).queue).toMatchObject({
      disposition: 'started',
      concurrencySlot: 1,
      replacementPolicy: 'newest_replaces_pending',
    });

    const second = await service.startReview({
      sessionId: 'qa-session-secondary',
      documentId: 'doc-qa',
      sectionId: 'section-qa',
      reviewerId: 'qa-user',
      prompt: 'Re-run check',
    });

    expect((second as Record<string, unknown>).queue).toMatchObject({
      disposition: 'pending',
      replacedSessionId: 'qa-session-primary',
      replacementPolicy: 'newest_replaces_pending',
    });

    expect(telemetry.logReview).toHaveBeenCalledWith(
      expect.objectContaining({
        sessionId: 'qa-session-primary',
        status: 'queued',
        concurrencySlot: 1,
      })
    );
    expect(telemetry.logReview).toHaveBeenCalledWith(
      expect.objectContaining({
        sessionId: 'qa-session-secondary',
        status: 'replaced',
        replacedSessionId: 'qa-session-primary',
      })
    );

    completeSpy.mockRestore();
  });

  it('buffers out-of-order review progress events before notifying subscribers', async () => {
    const { service } = buildService();
    const { res, events } = captureSse();
    service.subscribe('qa-session-buffer', res);

    await service.startReview({
      sessionId: 'qa-session-buffer',
      documentId: 'doc-qa',
      sectionId: 'section-ordering',
      reviewerId: 'qa-user',
      prompt: 'Ordering check',
    });

    const sequences = events
      .filter(entry => entry.event === 'progress')
      .map(entry => (entry.data as { sequence: number }).sequence);

    expect(sequences).toEqual([1, 2, 3]);
  });

  it('streams transcript tokens and final summary cues for QA reviews', async () => {
    const { service } = buildService();
    const { res, events } = captureSse();
    service.subscribe('qa-session-stream', res);

    await service.startReview({
      sessionId: 'qa-session-stream',
      documentId: 'doc-qa',
      sectionId: 'section-stream',
      reviewerId: 'qa-reviewer',
      prompt: 'Confirm telemetry and transcript parity across streaming modes.',
    });

    const tokens = events
      .filter(entry => entry.event === 'token')
      .map(entry => entry.data as { value: string; sequence?: number });

    expect(tokens).toHaveLength(4);
    expect(tokens.map(token => token.value)).toEqual([
      expect.stringContaining('Review focus'),
      expect.stringContaining('Finding'),
      expect.stringContaining('Recommendation'),
      expect.stringContaining('Next steps'),
    ]);

    const sequences = tokens
      .map(token => token.sequence)
      .filter((value): value is number => typeof value === 'number');
    expect(sequences).toEqual([1, 2, 3, 4]);

    const finalProgress = events
      .filter(entry => entry.event === 'progress')
      .map(entry => entry.data as Record<string, unknown>)
      .find(payload => payload.status === 'awaiting-approval');

    expect(finalProgress).toMatchObject({
      status: 'awaiting-approval',
      delivery: 'streaming',
    });
    expect(finalProgress).toHaveProperty('contentSnippet');
  });

  it('emits parity transcript tokens when fallback transport is enforced', async () => {
    const { service } = buildService();
    const { res, events } = captureSse();
    service.subscribe('qa-session-fallback', res);

    const originalEnv = process.env.DOCUMENT_QA_STREAMING_DISABLED;
    process.env.DOCUMENT_QA_STREAMING_DISABLED = 'true';

    try {
      await service.startReview({
        sessionId: 'qa-session-fallback',
        documentId: 'doc-qa',
        sectionId: 'section-fallback',
        reviewerId: 'qa-reviewer',
        prompt: 'Force fallback transport to confirm transcript parity.',
      });
    } finally {
      if (originalEnv === undefined) {
        delete process.env.DOCUMENT_QA_STREAMING_DISABLED;
      } else {
        process.env.DOCUMENT_QA_STREAMING_DISABLED = originalEnv;
      }
    }

    const tokens = events
      .filter(entry => entry.event === 'token')
      .map(entry => entry.data as { value: string; sequence?: number });

    expect(tokens).toHaveLength(4);
    expect(tokens.map(token => token.value)).toEqual([
      expect.stringContaining('Review focus'),
      expect.stringContaining('Finding'),
      expect.stringContaining('Recommendation'),
      expect.stringContaining('Next steps'),
    ]);

    const fallbackStates = events
      .filter(entry => entry.event === 'state')
      .map(entry => (entry.data as { status?: string }).status);
    expect(fallbackStates).toEqual(
      expect.arrayContaining(['fallback_active', 'fallback_completed'])
    );

    const fallbackProgress = events
      .filter(entry => entry.event === 'progress')
      .map(entry => entry.data as Record<string, unknown>);
    expect(
      fallbackProgress.some(
        payload => payload.status === 'fallback' && payload.delivery === 'fallback'
      )
    ).toBe(true);
    expect(
      fallbackProgress.some(
        payload => payload.status === 'awaiting-approval' && payload.delivery === 'fallback'
      )
    ).toBe(true);
  });

  it('exposes cancelReview handler to release queue slots and log telemetry', async () => {
    const { service, telemetry } = buildService();

    const internals = service as unknown as { completeSession: CompleteSession };
    const completeSpy = vi.spyOn(internals, 'completeSession').mockImplementation(() => {});

    await service.startReview({
      sessionId: 'qa-session-cancel',
      documentId: 'doc-qa',
      sectionId: 'section-cancel',
      reviewerId: 'qa-user',
      prompt: 'Cancel scenario',
    });

    const result = await service.cancelReview({
      sessionId: 'qa-session-cancel',
      sectionId: 'section-cancel',
      reason: 'author_cancelled',
    });

    expect(result).toMatchObject({
      status: 'canceled',
      cancelReason: 'author_cancelled',
    });

    expect(telemetry.logReview).toHaveBeenCalledWith(
      expect.objectContaining({
        sessionId: 'qa-session-cancel',
        status: 'canceled',
        cancelReason: 'author_cancelled',
      })
    );

    completeSpy.mockRestore();
  });

  it('exposes retryReview handler that links telemetry to prior sessions', async () => {
    const { service, telemetry } = buildService();

    const internals = service as unknown as { completeSession: CompleteSession };
    const completeSpy = vi.spyOn(internals, 'completeSession').mockImplementation(() => {});

    await service.startReview({
      sessionId: 'qa-session-retry',
      documentId: 'doc-qa',
      sectionId: 'section-retry',
      reviewerId: 'qa-user',
      prompt: 'Retry scenario',
    });

    await service.cancelReview({
      sessionId: 'qa-session-retry',
      sectionId: 'section-retry',
      reason: 'transport_failure',
    });

    const retryResult = await service.retryReview({
      sessionId: 'qa-session-retry',
      sectionId: 'section-retry',
    });

    expect(retryResult).toMatchObject({
      status: 'requeued',
      previousSessionId: 'qa-session-retry',
    });

    expect(telemetry.logReview).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'retried',
        sourceSessionId: 'qa-session-retry',
      })
    );

    completeSpy.mockRestore();
  });

  it('releases completed sessions and starts the next pending review', async () => {
    const { service, telemetry } = buildService();

    const { res: firstRes } = captureSse();
    service.subscribe('qa-session-primary', firstRes);

    const { res: secondRes, events: secondEvents } = captureSse();
    service.subscribe('qa-session-secondary', secondRes);

    const internals = service as unknown as { completeSession: CompleteSession };
    const originalComplete = internals.completeSession.bind(service);
    const captured: Array<Parameters<CompleteSession>> = [];
    const completeSpy = vi.spyOn(internals, 'completeSession').mockImplementation((...args) => {
      captured.push(args as Parameters<CompleteSession>);
    });

    await service.startReview({
      sessionId: 'qa-session-primary',
      documentId: 'doc-qa',
      sectionId: 'section-queue',
      reviewerId: 'qa-user',
      prompt: 'Primary review',
    });

    const second = await service.startReview({
      sessionId: 'qa-session-secondary',
      documentId: 'doc-qa',
      sectionId: 'section-queue',
      reviewerId: 'qa-user',
      prompt: 'Follow-up review',
    });

    expect(second.queue).toMatchObject({
      disposition: 'pending',
      replacedSessionId: 'qa-session-primary',
      replacementPolicy: 'newest_replaces_pending',
    });

    expect(captured).toHaveLength(1);

    const firstCapture = captured.at(0);

    completeSpy.mockRestore();

    if (!firstCapture) {
      throw new Error('completeSession must be captured before promotion assertions run');
    }

    originalComplete(...firstCapture);

    const sequences = secondEvents
      .filter(entry => entry.event === 'progress')
      .map(entry => (entry.data as { sequence: number }).sequence);

    expect(sequences).toEqual([1, 2, 3]);

    expect(telemetry.logReview).toHaveBeenCalledWith(
      expect.objectContaining({
        sessionId: 'qa-session-primary',
        status: 'completed',
      })
    );

    expect(telemetry.logReview).toHaveBeenCalledWith(
      expect.objectContaining({
        sessionId: 'qa-session-secondary',
        status: 'promoted',
        concurrencySlot: 1,
      })
    );
  });
});
