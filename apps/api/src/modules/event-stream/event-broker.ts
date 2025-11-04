type EventEnvelopeKind = 'event' | 'snapshot' | 'heartbeat';

export interface EventEnvelope<Payload = unknown> {
  id: string | null;
  topic: string;
  resourceId: string;
  workspaceId: string;
  sequence: number;
  kind: EventEnvelopeKind;
  payload: Payload;
  emittedAt: string;
  metadata?: Record<string, string>;
  lastEventId?: string | null;
}

export interface PublishEventOptions<Payload = unknown> {
  workspaceId: string;
  topic: string;
  resourceId: string;
  payload: Payload;
  metadata?: Record<string, string>;
  kind?: Exclude<EventEnvelopeKind, 'heartbeat'>;
}

export interface SubscriptionScope {
  topic: string;
  resourceId?: string;
}

export interface SubscribeOptions {
  connectionId: string;
  userId: string;
  workspaceId: string;
  topics: SubscriptionScope[];
  send: (envelope: EventEnvelope) => void;
  lastEventId?: string;
}

export interface EventBrokerOptions {
  replayLimit: number;
  heartbeatIntervalMs: number;
  now?: () => Date;
}

export interface EventBrokerSubscription {
  unsubscribe: () => void;
}

interface ReplayBuffer {
  lastSequence: number;
  events: EventEnvelope[];
}

interface ParsedEventId {
  topic: string;
  resourceId: string;
  sequence: number;
}

const HEARTBEAT_TOPIC = 'system.heartbeat';
const HEARTBEAT_RESOURCE_ID = '*';

const DEFAULT_NOW = () => new Date();

const parseEventId = (raw: string | undefined): ParsedEventId | null => {
  if (!raw) {
    return null;
  }

  const parts = raw.split(':');
  if (parts.length !== 3) {
    return null;
  }

  const [topic, resourceId, sequenceRaw] = parts as [string, string, string];
  const sequence = Number.parseInt(sequenceRaw, 10);
  if (!Number.isFinite(sequence) || Number.isNaN(sequence) || sequence < 0) {
    return null;
  }

  return { topic, resourceId, sequence };
};

const createEventId = (topic: string, resourceId: string, sequence: number): string =>
  `${topic}:${resourceId}:${sequence}`;

const bufferKey = (workspaceId: string, topic: string, resourceId: string): string =>
  `${workspaceId}:${topic}:${resourceId}`;

const topicIndexKey = (workspaceId: string, topic: string): string => `${workspaceId}:${topic}`;

const subscriptionKey = (workspaceId: string, topic: string, resourceId?: string): string =>
  `${workspaceId}:${topic}:${resourceId ?? '*'}`;

type HeartbeatTimer = ReturnType<typeof setTimeout>;

interface InternalSubscriber extends SubscribeOptions {
  heartbeatTimer?: HeartbeatTimer;
  subscriptionKeys: string[];
}

export class EventBroker {
  private readonly replayLimit: number;
  private readonly heartbeatIntervalMs: number;
  private readonly now: () => Date;

  private readonly buffers = new Map<string, ReplayBuffer>();
  private readonly topicResources = new Map<string, Set<string>>();
  private readonly subscribersByKey = new Map<string, Set<InternalSubscriber>>();
  private readonly subscribers = new Map<string, InternalSubscriber>();

  constructor(options: EventBrokerOptions) {
    if (options.replayLimit < 1) {
      throw new Error('EventBroker requires replayLimit >= 1');
    }

    this.replayLimit = options.replayLimit;
    this.heartbeatIntervalMs = options.heartbeatIntervalMs;
    this.now = options.now ?? DEFAULT_NOW;
  }

  publish<Payload = unknown>(options: PublishEventOptions<Payload>): EventEnvelope<Payload> {
    const buffer = this.getOrCreateBuffer(options.workspaceId, options.topic, options.resourceId);
    const sequence = buffer.lastSequence + 1;
    const envelope: EventEnvelope<Payload> = {
      id: createEventId(options.topic, options.resourceId, sequence),
      topic: options.topic,
      resourceId: options.resourceId,
      workspaceId: options.workspaceId,
      sequence,
      kind: options.kind ?? 'event',
      payload: options.payload,
      emittedAt: this.now().toISOString(),
      metadata: options.metadata,
      lastEventId: null,
    };

    buffer.lastSequence = sequence;
    buffer.events.push(envelope);
    if (buffer.events.length > this.replayLimit) {
      buffer.events.shift();
    }

    this.dispatch(envelope);

    return envelope;
  }

  subscribe(options: SubscribeOptions): EventBrokerSubscription {
    if (options.topics.length === 0) {
      throw new Error('EventBroker subscribers must register at least one topic scope');
    }

    const existing = this.subscribers.get(options.connectionId);
    if (existing) {
      this.unregisterSubscriber(existing);
    }

    const internalSubscriber: InternalSubscriber = {
      ...options,
      heartbeatTimer: undefined,
      subscriptionKeys: [],
    };

    this.subscribers.set(options.connectionId, internalSubscriber);
    this.registerSubscriber(internalSubscriber);
    const lastEvent = parseEventId(options.lastEventId);
    if (lastEvent) {
      this.deliverReplay(internalSubscriber, lastEvent);
    }
    this.resetHeartbeat(internalSubscriber);

    return {
      unsubscribe: () => {
        this.unregisterSubscriber(internalSubscriber);
      },
    };
  }

  private dispatch(envelope: EventEnvelope): void {
    const exactKey = subscriptionKey(envelope.workspaceId, envelope.topic, envelope.resourceId);
    const wildcardKey = subscriptionKey(envelope.workspaceId, envelope.topic);

    const recipients = new Set<InternalSubscriber>();
    const exactSubscribers = this.subscribersByKey.get(exactKey);
    if (exactSubscribers) {
      for (const subscriber of exactSubscribers) {
        recipients.add(subscriber);
      }
    }

    const wildcardSubscribers = this.subscribersByKey.get(wildcardKey);
    if (wildcardSubscribers) {
      for (const subscriber of wildcardSubscribers) {
        recipients.add(subscriber);
      }
    }

    for (const subscriber of recipients) {
      subscriber.send(envelope);
      this.resetHeartbeat(subscriber);
    }
  }

  private deliverReplay(subscriber: InternalSubscriber, lastEvent: ParsedEventId | null): void {
    const { workspaceId } = subscriber;

    for (const scope of subscriber.topics) {
      const resourceIds = scope.resourceId
        ? [scope.resourceId]
        : Array.from(this.topicResources.get(topicIndexKey(workspaceId, scope.topic)) ?? []);

      for (const resourceId of resourceIds) {
        const buffer = this.buffers.get(bufferKey(workspaceId, scope.topic, resourceId));
        if (!buffer) {
          continue;
        }

        for (const event of buffer.events) {
          if (
            lastEvent &&
            lastEvent.topic === event.topic &&
            lastEvent.resourceId === event.resourceId &&
            event.sequence <= lastEvent.sequence
          ) {
            continue;
          }

          subscriber.send(event);
        }
      }
    }
  }

  private registerSubscriber(subscriber: InternalSubscriber): void {
    for (const scope of subscriber.topics) {
      const key = subscriptionKey(subscriber.workspaceId, scope.topic, scope.resourceId);
      let bucket = this.subscribersByKey.get(key);
      if (!bucket) {
        bucket = new Set();
        this.subscribersByKey.set(key, bucket);
      }
      bucket.add(subscriber);
      subscriber.subscriptionKeys.push(key);
    }
  }

  private unregisterSubscriber(subscriber: InternalSubscriber): void {
    for (const key of subscriber.subscriptionKeys) {
      const bucket = this.subscribersByKey.get(key);
      if (!bucket) {
        continue;
      }
      bucket.delete(subscriber);
      if (bucket.size === 0) {
        this.subscribersByKey.delete(key);
      }
    }

    subscriber.subscriptionKeys = [];
    if (subscriber.heartbeatTimer) {
      clearTimeout(subscriber.heartbeatTimer);
      subscriber.heartbeatTimer = undefined;
    }

    this.subscribers.delete(subscriber.connectionId);
  }

  private getOrCreateBuffer(workspaceId: string, topic: string, resourceId: string): ReplayBuffer {
    const key = bufferKey(workspaceId, topic, resourceId);
    let buffer = this.buffers.get(key);
    if (!buffer) {
      buffer = { lastSequence: 0, events: [] };
      this.buffers.set(key, buffer);
      let resources = this.topicResources.get(topicIndexKey(workspaceId, topic));
      if (!resources) {
        resources = new Set();
        this.topicResources.set(topicIndexKey(workspaceId, topic), resources);
      }
      resources.add(resourceId);
    }
    return buffer;
  }

  private resetHeartbeat(subscriber: InternalSubscriber): void {
    if (subscriber.heartbeatTimer) {
      clearTimeout(subscriber.heartbeatTimer);
    }

    if (this.heartbeatIntervalMs <= 0) {
      subscriber.heartbeatTimer = undefined;
      return;
    }

    subscriber.heartbeatTimer = setTimeout(() => {
      const heartbeatEnvelope: EventEnvelope = {
        id: null,
        topic: HEARTBEAT_TOPIC,
        resourceId: HEARTBEAT_RESOURCE_ID,
        workspaceId: subscriber.workspaceId,
        sequence: 0,
        kind: 'heartbeat',
        payload: {},
        emittedAt: this.now().toISOString(),
        metadata: undefined,
        lastEventId: null,
      };

      subscriber.send(heartbeatEnvelope);
      this.resetHeartbeat(subscriber);
    }, this.heartbeatIntervalMs);
  }
}
