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
});
