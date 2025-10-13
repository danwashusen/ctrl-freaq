import { describe, expect, it, vi } from 'vitest';

import { createSectionStreamQueue } from './section-stream-queue.js';

const buildRequest = (sessionId: string, sectionId: string, enqueuedAt: number) => ({
  sessionId,
  sectionId,
  enqueuedAt,
});

describe('section-stream-queue', () => {
  it('replaces the newest pending request for a section and cancels the previous pending session', () => {
    const onCancel = vi.fn();
    const queue = createSectionStreamQueue({ onCancel });

    const first = queue.enqueue(buildRequest('session-1', 'section-a', 10));
    expect(first.disposition).toBe('started');
    expect(first.concurrencySlot).toBe(1);

    const pending = queue.enqueue(buildRequest('session-2', 'section-a', 20));
    expect(pending.disposition).toBe('pending');
    expect(pending.replacedSessionId).toBeNull();
    expect(onCancel).not.toHaveBeenCalled();

    const replacement = queue.enqueue(buildRequest('session-3', 'section-a', 30));
    expect(replacement.disposition).toBe('pending');
    expect(replacement.replacedSessionId).toBe('session-2');

    expect(onCancel).toHaveBeenCalledOnce();
    expect(onCancel).toHaveBeenCalledWith({
      sessionId: 'session-2',
      sectionId: 'section-a',
      reason: 'replaced_by_new_request',
      state: 'pending',
    });

    const snapshot = queue.snapshot();
    expect(snapshot.pending.get('section-a')?.sessionId).toBe('session-3');
  });

  it('enforces a single active session per section and activates the pending request when the active session completes', () => {
    const queue = createSectionStreamQueue();

    const active = queue.enqueue(buildRequest('session-1', 'section-a', 10));
    expect(active.disposition).toBe('started');
    expect(active.concurrencySlot).toBe(1);

    const pending = queue.enqueue(buildRequest('session-2', 'section-a', 20));
    expect(pending.disposition).toBe('pending');

    const completion = queue.complete('session-1');
    expect(completion?.releasedSessionId).toBe('session-1');
    expect(completion?.activated?.sessionId).toBe('session-2');
    expect(completion?.activated?.sectionId).toBe('section-a');
    expect(completion?.activated?.concurrencySlot).toBe(1);

    const current = queue.snapshot();
    expect(current.active.get('section-a')?.sessionId).toBe('session-2');
    expect(current.pending.has('section-a')).toBe(false);
  });

  it('calculates concurrency slots based on the number of active sessions when a stream starts', () => {
    const queue = createSectionStreamQueue();

    const first = queue.enqueue(buildRequest('session-1', 'section-a', 10));
    expect(first.concurrencySlot).toBe(1);

    const second = queue.enqueue(buildRequest('session-2', 'section-b', 20));
    expect(second.disposition).toBe('started');
    expect(second.concurrencySlot).toBe(2);

    queue.complete('session-1');

    const third = queue.enqueue(buildRequest('session-3', 'section-c', 30));
    expect(third.disposition).toBe('started');
    expect(third.concurrencySlot).toBe(2);
  });

  it('propagates cancel reasons to listeners and promotes the next pending session', () => {
    const onCancel = vi.fn();
    const queue = createSectionStreamQueue({ onCancel });

    queue.enqueue(buildRequest('session-1', 'section-a', 10));
    queue.enqueue(buildRequest('session-2', 'section-a', 20));

    const cancelResult = queue.cancel('session-1', 'author_cancelled');
    expect(cancelResult.released).toBe(true);
    expect(cancelResult.reason).toBe('author_cancelled');
    expect(cancelResult.promoted?.sessionId).toBe('session-2');
    expect(cancelResult.promoted?.concurrencySlot).toBe(1);

    expect(onCancel).toHaveBeenCalled();
    expect(onCancel).toHaveBeenCalledWith({
      sessionId: 'session-1',
      sectionId: 'section-a',
      reason: 'author_cancelled',
      state: 'active',
    });
  });
});
