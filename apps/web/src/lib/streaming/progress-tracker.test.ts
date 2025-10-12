import { describe, expect, it, vi } from 'vitest';

import { createStreamingProgressTracker } from './progress-tracker';

describe('createStreamingProgressTracker', () => {
  it('announces queued start and elapsed time when streaming exceeds threshold', () => {
    const announce = vi.fn();
    const tracker = createStreamingProgressTracker({ announce });

    tracker.update({ status: 'queued', elapsedMs: 0 });
    expect(announce).toHaveBeenCalledTimes(1);
    expect(announce).toHaveBeenCalledWith(
      expect.objectContaining({
        message: expect.stringContaining('Assistant request started'),
        polite: true,
      })
    );

    tracker.update({ status: 'streaming', elapsedMs: 6200 });
    expect(announce).toHaveBeenCalledTimes(2);
    expect(announce).toHaveBeenLastCalledWith(
      expect.objectContaining({
        message: expect.stringContaining('Assistant is still working'),
        polite: true,
      })
    );
  });

  it('emits downgrade guidance once when errors occur', () => {
    const announce = vi.fn();
    const tracker = createStreamingProgressTracker({ announce });

    tracker.update({ status: 'error', elapsedMs: 3100, reason: 'assistant_unavailable' });
    tracker.update({ status: 'error', elapsedMs: 4100, reason: 'assistant_unavailable' });

    const errorAnnouncements = announce.mock.calls.filter(
      ([call]) =>
        typeof call?.message === 'string' && call.message.includes('Assistant became unavailable')
    );
    expect(errorAnnouncements).toHaveLength(1);
    expect(errorAnnouncements[0]?.[0]).toMatchObject({
      message: expect.stringContaining('Assistant became unavailable'),
      polite: false,
    });
  });

  it('announces when a proposal is ready for review once per cycle', () => {
    const announce = vi.fn();
    const tracker = createStreamingProgressTracker({ announce });

    tracker.update({ status: 'awaiting-approval', elapsedMs: 4100 });
    tracker.update({ status: 'awaiting-approval', elapsedMs: 5200 });
    tracker.update({ status: 'idle', elapsedMs: 0 });
    tracker.update({ status: 'awaiting-approval', elapsedMs: 1800 });

    const readyMessages = announce.mock.calls.filter(
      ([call]) =>
        typeof call?.message === 'string' && call.message.includes('Review the changes when ready')
    );
    expect(readyMessages).toHaveLength(2);
    expect(readyMessages[0]?.[0]?.polite).toBe(true);
  });

  it('provides specific guidance when approval fails', () => {
    const announce = vi.fn();
    const tracker = createStreamingProgressTracker({ announce });

    tracker.update({ status: 'error', elapsedMs: 4100, reason: 'approval_failed' });

    expect(announce).toHaveBeenCalledWith(
      expect.objectContaining({
        message: expect.stringContaining('Could not apply the proposal'),
        polite: false,
      })
    );
  });

  it('announces streaming start within the latency window', () => {
    const announce = vi.fn();
    const tracker = createStreamingProgressTracker({ announce });

    tracker.update({ status: 'queued', elapsedMs: 0 });
    tracker.update({ status: 'streaming', elapsedMs: 180 });

    const startMessages = announce.mock.calls.filter(
      ([call]) => typeof call?.message === 'string' && call.message.includes('preparing guidance')
    );
    expect(startMessages).toHaveLength(1);
    expect(startMessages[0]?.[0]).toMatchObject({ polite: true });
  });

  it('announces cancellation once per sequence with cancel reason', () => {
    const announce = vi.fn();
    const tracker = createStreamingProgressTracker({ announce });

    tracker.update({ status: 'canceled', elapsedMs: 2_000, cancelReason: 'author_cancelled' });
    tracker.update({ status: 'canceled', elapsedMs: 2_500, cancelReason: 'author_cancelled' });

    const cancelMessages = announce.mock.calls.filter(
      ([call]) => typeof call?.message === 'string' && call.message.includes('request canceled')
    );
    expect(cancelMessages).toHaveLength(1);
    expect(cancelMessages[0]?.[0]).toMatchObject({ polite: false });
  });

  it('announces retries when retry count increments', () => {
    const announce = vi.fn();
    const tracker = createStreamingProgressTracker({ announce });

    tracker.update({ status: 'queued', elapsedMs: 0 });
    tracker.update({ status: 'streaming', elapsedMs: 200, retryCount: 1 });
    tracker.update({ status: 'streaming', elapsedMs: 800, retryCount: 1 });
    tracker.update({ status: 'streaming', elapsedMs: 1_200, retryCount: 2 });

    const retryMessages = announce.mock.calls.filter(
      ([call]) => typeof call?.message === 'string' && call.message.includes('retrying')
    );
    expect(retryMessages).toHaveLength(2);
    expect(retryMessages[0]?.[0]).toMatchObject({ polite: false });
  });

  it('announces fallback progress once per activation', () => {
    const announce = vi.fn();
    const tracker = createStreamingProgressTracker({ announce });

    tracker.update({ status: 'fallback', elapsedMs: 2_400, preservedTokens: 3 });
    tracker.update({ status: 'fallback', elapsedMs: 3_600, preservedTokens: 4 });

    const fallbackMessages = announce.mock.calls.filter(
      ([call]) => typeof call?.message === 'string' && call.message.includes('fallback in progress')
    );
    expect(fallbackMessages).toHaveLength(1);
    expect(fallbackMessages[0]?.[0]).toMatchObject({ polite: true });
  });
});
