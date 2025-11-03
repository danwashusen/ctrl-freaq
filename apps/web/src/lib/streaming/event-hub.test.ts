import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { EventHub, EventHubOptions } from './event-hub';
import { createEventHub } from './event-hub';

interface FakeEvent {
  type: string;
  data?: string;
  lastEventId?: string;
}

type EventListener = (event: MessageEvent<string>) => void;

class FakeEventSource {
  static instances: FakeEventSource[] = [];

  readonly listeners = new Map<string, Set<EventListener>>();
  readonly url: string;
  readonly init?: EventSourceInit;

  readyState: number = 0;
  closed = false;

  constructor(url: string, init?: EventSourceInit) {
    this.url = url;
    this.init = init;
    FakeEventSource.instances.push(this);
  }

  addEventListener(type: string, listener: EventListener) {
    if (!this.listeners.has(type)) {
      this.listeners.set(type, new Set());
    }
    this.listeners.get(type)!.add(listener);
  }

  removeEventListener(type: string, listener: EventListener) {
    this.listeners.get(type)?.delete(listener);
  }

  close() {
    this.closed = true;
    this.readyState = 2;
  }

  emitOpen() {
    this.readyState = 1;
    this.dispatch({ type: 'open' });
  }

  emitError(message: string = 'error') {
    const event = new MessageEvent('error', { data: message });
    this.dispatchRaw('error', event);
  }

  emit(type: string, payload: unknown, eventId?: string) {
    const data = typeof payload === 'string' ? payload : JSON.stringify(payload);
    const event = new MessageEvent<string>(type, {
      data,
      lastEventId: eventId,
    });
    this.dispatchRaw(type, event);
  }

  private dispatch(event: FakeEvent) {
    if (event.type === 'open') {
      this.dispatchRaw('open', new MessageEvent<string>('open', { data: '' }));
      return;
    }
    if (event.type === 'error') {
      this.dispatchRaw('error', new MessageEvent<string>('error', { data: event.data ?? '' }));
      return;
    }
  }

  private dispatchRaw(type: string, event: MessageEvent<string>) {
    const handlers = this.listeners.get(type);
    if (handlers) {
      for (const handler of handlers) {
        handler(event);
      }
    }
  }
}

const createHub = (overrides: Partial<EventHubOptions> = {}): EventHub => {
  const options: EventHubOptions = {
    getAuthToken: async () => 'test-token',
    eventSourceFactory: (url, init) => new FakeEventSource(url, init) as unknown as EventSource,
    retryDelaysMs: [10, 20],
    heartbeatTimeoutMs: 50,
    now: () => Date.now(),
    ...overrides,
  };
  return createEventHub(options);
};

const flushAsync = async () => {
  await Promise.resolve();
  await Promise.resolve();
};

const lastItem = <T>(items: T[]): T | undefined =>
  items.length > 0 ? items[items.length - 1] : undefined;

describe('event hub', () => {
  beforeEach(() => {
    FakeEventSource.instances = [];
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  it('creates a single connection shared across subscribers and closes after last unsubscribe', async () => {
    const hub = createHub();

    const unsubscribeA = hub.subscribe(
      { topic: 'project.lifecycle', resourceId: 'proj-1' },
      vi.fn()
    );
    await flushAsync();
    expect(FakeEventSource.instances).toHaveLength(1);
    const source = FakeEventSource.instances[0];
    if (!source) {
      throw new Error('Expected event source instance to exist');
    }
    expect(source.url).toContain('/api/v1/events');
    source.emitOpen();

    const unsubscribeB = hub.subscribe(
      { topic: 'project.lifecycle', resourceId: 'proj-2' },
      vi.fn()
    );
    await flushAsync();
    expect(FakeEventSource.instances).toHaveLength(1);

    unsubscribeA();
    expect(source.closed).toBe(false);

    unsubscribeB();
    expect(source.closed).toBe(true);
  });

  it('fan-outs envelopes to matching listeners and tracks health timestamps', async () => {
    const events: unknown[] = [];
    const healthChanges: string[] = [];
    const hub = createHub({
      onHealthChange: state => {
        healthChanges.push(state.status);
      },
    });

    const listenerMatching = vi.fn(envelope => events.push(envelope));
    const listenerWildcard = vi.fn();

    hub.subscribe({ topic: 'project.lifecycle', resourceId: 'proj-123' }, listenerMatching);
    hub.subscribe({ topic: 'project.lifecycle' }, listenerWildcard);

    await flushAsync();
    const source = FakeEventSource.instances[0];
    if (!source) {
      throw new Error('Expected event source instance to exist');
    }
    source.emitOpen();
    expect(healthChanges).toContain('healthy');

    const envelope = {
      topic: 'project.lifecycle',
      resourceId: 'proj-123',
      workspaceId: 'workspace-default',
      sequence: 42,
      kind: 'event' as const,
      payload: { status: 'archived' },
      emittedAt: new Date().toISOString(),
      id: 'project.lifecycle:proj-123:42',
    };

    source.emit('project.lifecycle', envelope, envelope.id);

    expect(listenerMatching).toHaveBeenCalledTimes(1);
    expect(listenerMatching).toHaveBeenCalledWith(envelope);
    expect(listenerWildcard).toHaveBeenCalledTimes(1);
    expect(listenerWildcard).toHaveBeenCalledWith(envelope);

    const otherEnvelope = { ...envelope, resourceId: 'proj-999' };
    source.emit('project.lifecycle', otherEnvelope, otherEnvelope.id);

    expect(listenerMatching).toHaveBeenCalledTimes(1);
    expect(listenerWildcard).toHaveBeenCalledTimes(2);
  });

  it('transitions to recovering then degraded after repeated failures and reverts to healthy on reconnect', async () => {
    const healthStates: string[] = [];
    const fallbackActivations: boolean[] = [];
    const hub = createHub({
      onHealthChange: state => {
        healthStates.push(state.status);
      },
      onFallbackChange: active => {
        fallbackActivations.push(active);
      },
      retryDelaysMs: [5, 5],
    });

    hub.subscribe({ topic: 'project.lifecycle' }, vi.fn());
    await flushAsync();
    expect(FakeEventSource.instances).toHaveLength(1);
    const first = FakeEventSource.instances[0];
    if (!first) {
      throw new Error('Expected first event source instance');
    }

    first.emitOpen();
    expect(lastItem(healthStates)).toBe('healthy');

    first.emitError('network');
    await vi.runOnlyPendingTimersAsync();

    expect(FakeEventSource.instances).toHaveLength(2);
    expect(healthStates).toContain('recovering');
    expect(lastItem(fallbackActivations)).toBe(false);

    const second = FakeEventSource.instances[1];
    if (!second) {
      throw new Error('Expected second event source instance');
    }
    second.emitError('network-again');
    await vi.runOnlyPendingTimersAsync();

    expect(FakeEventSource.instances).toHaveLength(3);
    expect(healthStates).toContain('degraded');
    expect(lastItem(fallbackActivations)).toBe(true);

    const third = FakeEventSource.instances[2];
    if (!third) {
      throw new Error('Expected third event source instance');
    }
    third.emitOpen();
    expect(lastItem(healthStates)).toBe('healthy');
    expect(lastItem(fallbackActivations)).toBe(false);
  });
});
