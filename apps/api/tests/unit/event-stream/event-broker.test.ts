import { afterEach, describe, expect, it, vi } from 'vitest';

import { EventBroker } from '../../../src/modules/event-stream/event-broker.js';

const baseSubscriber = {
  connectionId: 'conn-1',
  userId: 'user-1',
  workspaceId: 'ws-1',
};

describe('EventBroker', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('delivers published events to subscribers that match topic/resource scope', () => {
    const broker = new EventBroker({
      replayLimit: 10,
      heartbeatIntervalMs: 1_000,
    });

    const matchingHandler = vi.fn();
    const otherHandler = vi.fn();

    const subscription = broker.subscribe({
      ...baseSubscriber,
      topics: [{ topic: 'project.lifecycle', resourceId: 'proj-1' }],
      send: matchingHandler,
    });

    broker.subscribe({
      ...baseSubscriber,
      connectionId: 'conn-2',
      topics: [{ topic: 'project.lifecycle', resourceId: 'proj-2' }],
      send: otherHandler,
    });

    broker.publish({
      workspaceId: 'ws-1',
      topic: 'project.lifecycle',
      resourceId: 'proj-1',
      payload: { status: 'archived' },
    });

    expect(matchingHandler).toHaveBeenCalledTimes(1);
    const [matchingCall] = matchingHandler.mock.calls;
    expect(matchingCall).toBeDefined();
    const [matchingEnvelope] = matchingCall!;
    expect(matchingEnvelope).toMatchObject({
      topic: 'project.lifecycle',
      resourceId: 'proj-1',
      kind: 'event',
      sequence: 1,
      payload: { status: 'archived' },
    });
    expect(otherHandler).not.toHaveBeenCalled();

    subscription.unsubscribe();
  });

  it('replays buffered events newer than the provided Last-Event-ID', () => {
    const broker = new EventBroker({
      replayLimit: 5,
      heartbeatIntervalMs: 5_000,
    });

    broker.publish({
      workspaceId: 'ws-1',
      topic: 'project.lifecycle',
      resourceId: 'proj-1',
      payload: { status: 'active' },
    });

    broker.publish({
      workspaceId: 'ws-1',
      topic: 'project.lifecycle',
      resourceId: 'proj-1',
      payload: { status: 'archived' },
    });

    const replayHandler = vi.fn();

    broker.subscribe({
      ...baseSubscriber,
      connectionId: 'conn-3',
      topics: [{ topic: 'project.lifecycle', resourceId: 'proj-1' }],
      lastEventId: 'project.lifecycle:proj-1:1',
      send: replayHandler,
    });

    expect(replayHandler).toHaveBeenCalledTimes(1);
    const [replayCall] = replayHandler.mock.calls;
    expect(replayCall).toBeDefined();
    const [replayedEnvelope] = replayCall!;
    expect(replayedEnvelope).toMatchObject({
      topic: 'project.lifecycle',
      resourceId: 'proj-1',
      sequence: 2,
      payload: { status: 'archived' },
    });
  });

  it('emits heartbeat envelopes on the configured cadence when idle', async () => {
    vi.useFakeTimers();
    const broker = new EventBroker({
      replayLimit: 5,
      heartbeatIntervalMs: 1_000,
    });

    const heartbeatHandler = vi.fn();

    const subscription = broker.subscribe({
      ...baseSubscriber,
      connectionId: 'conn-4',
      topics: [{ topic: 'project.lifecycle', resourceId: 'proj-1' }],
      send: heartbeatHandler,
    });

    expect(heartbeatHandler).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(1_000);

    expect(heartbeatHandler).toHaveBeenCalledTimes(1);
    const [heartbeatCall] = heartbeatHandler.mock.calls;
    expect(heartbeatCall).toBeDefined();
    const [heartbeatEnvelope] = heartbeatCall!;
    expect(heartbeatEnvelope).toMatchObject({
      kind: 'heartbeat',
      payload: {},
    });

    subscription.unsubscribe();
  });
});
