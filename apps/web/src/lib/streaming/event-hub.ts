import { logger } from '@/lib/logger';

export type EventEnvelopeKind = 'event' | 'snapshot' | 'heartbeat';

export interface EventEnvelope<Payload = unknown> {
  id?: string | null;
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

export type HubHealthStatus = 'healthy' | 'recovering' | 'degraded';

export interface HubHealthState {
  status: HubHealthStatus;
  lastEventAt: number | null;
  lastHeartbeatAt: number | null;
  retryAttempt: number;
  fallbackActive: boolean;
}

export interface HubSubscriptionScope {
  topic: string;
  resourceId?: string;
}

export type HubListener<Payload = unknown> = (envelope: EventEnvelope<Payload>) => void;

type EventSourceInitWithHeaders = EventSourceInit & {
  headers?: Record<string, string>;
};

export interface EventHubOptions {
  streamPath?: string;
  getAuthToken: () => Promise<string | null>;
  eventSourceFactory?: (url: string, init?: EventSourceInitWithHeaders) => EventSource;
  retryDelaysMs?: number[];
  heartbeatTimeoutMs?: number;
  now?: () => number;
  onHealthChange?: (state: HubHealthState) => void;
  onFallbackChange?: (active: boolean) => void;
  logger?: {
    debug?: (message: string, context?: Record<string, unknown>) => void;
    warn?: (message: string, context?: Record<string, unknown>) => void;
    error?: (message: string, context?: Record<string, unknown>, error?: unknown) => void;
  };
}

export interface EventHub {
  subscribe<Payload = unknown>(scope: HubSubscriptionScope, listener: HubListener<Payload>): () => void;
  onHealthChange(listener: (state: HubHealthState) => void): () => void;
  onFallbackChange(listener: (active: boolean) => void): () => void;
  getHealthState(): HubHealthState;
  isEnabled(): boolean;
  setEnabled(enabled: boolean): void;
  forceReconnect(): void;
  shutdown(): void;
}

const DEFAULT_STREAM_PATH = '/api/v1/events';
const DEFAULT_RETRY_DELAYS = [1000, 2000, 5000, 10_000, 30_000];
const DEFAULT_HEARTBEAT_TIMEOUT_MS = 30_000;
const HEARTBEAT_EVENT = 'heartbeat';
const STREAM_OPEN_EVENT = 'stream.open';

interface InternalListener {
  id: number;
  scope: HubSubscriptionScope;
  callback: HubListener;
}

interface TopicRegistration {
  listeners: Set<InternalListener>;
}

export function createEventHub(options: EventHubOptions): EventHub {
  if (typeof options.getAuthToken !== 'function') {
    throw new Error('Event hub requires a getAuthToken function');
  }

  const resolvedLogger = options.logger ?? logger;
  const retryDelays = options.retryDelaysMs?.filter(delay => delay > 0) ?? DEFAULT_RETRY_DELAYS;
  const heartbeatTimeoutMs = options.heartbeatTimeoutMs ?? DEFAULT_HEARTBEAT_TIMEOUT_MS;
  const getNow = () => (options.now ? options.now() : Date.now());

  let enabled = true;
  let listenerIdCounter = 0;
  let eventSource: EventSource | null = null;
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  let heartbeatTimer: ReturnType<typeof setTimeout> | null = null;
  let isConnecting = false;

  const topicRegistrations = new Map<string, TopicRegistration>();
  const topicHandlers = new Map<string, (event: MessageEvent<string>) => void>();

  const healthListeners = new Set<(state: HubHealthState) => void>();
  const fallbackListeners = new Set<(active: boolean) => void>();

  let state: HubHealthState = {
    status: 'recovering',
    lastEventAt: null,
    lastHeartbeatAt: null,
    retryAttempt: 0,
    fallbackActive: false,
  };

  const notifyHealth = () => {
    for (const listener of healthListeners) {
      listener(state);
    }
  };

  const notifyFallback = () => {
    for (const listener of fallbackListeners) {
      listener(state.fallbackActive);
    }
  };

  if (options.onHealthChange) {
    healthListeners.add(options.onHealthChange);
    options.onHealthChange(state);
  }
  if (options.onFallbackChange) {
    fallbackListeners.add(options.onFallbackChange);
    options.onFallbackChange(state.fallbackActive);
  }

  const setState = (patch: Partial<HubHealthState>) => {
    const next: HubHealthState = {
      ...state,
      ...patch,
    };

    const statusChanged = next.status !== state.status;
    const retryChanged = next.retryAttempt !== state.retryAttempt;
    const lastEventChanged = next.lastEventAt !== state.lastEventAt;
    const heartbeatChanged = next.lastHeartbeatAt !== state.lastHeartbeatAt;
    const fallbackChanged = next.fallbackActive !== state.fallbackActive;

    state = next;

    if (statusChanged || retryChanged || lastEventChanged || heartbeatChanged || fallbackChanged) {
      notifyHealth();
    }
    if (fallbackChanged) {
      notifyFallback();
    }
  };

  const eventSourceFactory =
    options.eventSourceFactory ?? ((url: string, init?: EventSourceInitWithHeaders) => new EventSource(url, init));

  const resolveStreamUrl = (): string => {
    let envPath: string | undefined;
    if (typeof import.meta !== 'undefined') {
      const meta = import.meta as unknown as { env?: Record<string, unknown> };
      const candidate = meta.env?.VITE_EVENT_STREAM_PATH;
      if (typeof candidate === 'string' && candidate.trim().length > 0) {
        envPath = candidate;
      }
    }

    const rawPath = options.streamPath ?? envPath ?? DEFAULT_STREAM_PATH;
    const normalizedPath = rawPath.trim();

    if (/^https?:\/\//i.test(normalizedPath)) {
      return normalizedPath;
    }

    if (typeof window !== 'undefined' && window.location) {
      const origin = window.location.origin ?? '';
      if (normalizedPath.startsWith('/')) {
        return `${origin}${normalizedPath}`;
      }
      return `${origin}/${normalizedPath.replace(/^\//, '')}`;
    }

    const relativePath = normalizedPath.startsWith('/')
      ? normalizedPath
      : `/${normalizedPath.replace(/^\//, '')}`;
    return relativePath;
  };

  const clearReconnectTimer = () => {
    if (reconnectTimer) {
      clearTimeout(reconnectTimer);
      reconnectTimer = null;
    }
  };

  const clearHeartbeatTimer = () => {
    if (heartbeatTimer) {
      clearTimeout(heartbeatTimer);
      heartbeatTimer = null;
    }
  };

  const scheduleHeartbeatWatchdog = () => {
    if (heartbeatTimeoutMs <= 0) {
      return;
    }
    clearHeartbeatTimer();
    heartbeatTimer = setTimeout(() => {
      resolvedLogger.warn?.('Event hub heartbeat timeout', {
        timeoutMs: heartbeatTimeoutMs,
      });
      handleConnectionError('heartbeat_timeout');
    }, heartbeatTimeoutMs);
  };

  const attachTopicListener = (topic: string) => {
    if (topicHandlers.has(topic) || !eventSource) {
      return;
    }

    const handler = (event: MessageEvent<string>) => {
      if (!event?.data) {
        return;
      }

      let parsed: EventEnvelope | null = null;
      try {
        parsed = JSON.parse(event.data) as EventEnvelope;
      } catch (error) {
        resolvedLogger.warn?.('Failed to parse SSE payload', {
          topic,
          error: error instanceof Error ? error.message : 'unknown',
        });
        return;
      }

      if (!parsed || typeof parsed.topic !== 'string' || parsed.topic !== topic) {
        return;
      }

      setState({
        lastEventAt: getNow(),
        lastHeartbeatAt: state.lastHeartbeatAt,
      });
      scheduleHeartbeatWatchdog();

      const registration = topicRegistrations.get(topic);
      if (!registration) {
        return;
      }

      for (const listener of registration.listeners) {
        if (listener.scope.resourceId && listener.scope.resourceId !== parsed.resourceId) {
          continue;
        }
        try {
          listener.callback(parsed);
        } catch (error) {
          const normalizedError =
            error instanceof Error ? error : new Error(String(error ?? 'unknown listener error'));
          resolvedLogger.error?.(
            'Event hub listener threw',
            {
              topic,
              resourceId: parsed.resourceId,
            },
            normalizedError
          );
        }
      }
    };

    topicHandlers.set(topic, handler);
    eventSource.addEventListener(topic, handler);
  };

  const detachTopicListener = (topic: string) => {
    const handler = topicHandlers.get(topic);
    if (!handler || !eventSource) {
      return;
    }
    eventSource.removeEventListener(topic, handler);
    topicHandlers.delete(topic);
  };

  const detachAllTopicListeners = () => {
    for (const topic of topicHandlers.keys()) {
      detachTopicListener(topic);
    }
  };

  const closeEventSource = () => {
    if (!eventSource) {
      return;
    }
    eventSource.removeEventListener('open', handleOpen);
    eventSource.removeEventListener('error', handleError);
    eventSource.removeEventListener(HEARTBEAT_EVENT, handleHeartbeat);
    eventSource.removeEventListener(STREAM_OPEN_EVENT, handleStreamOpen);
    detachAllTopicListeners();
    eventSource.close();
    eventSource = null;
  };

  const scheduleReconnect = () => {
    if (reconnectTimer || !enabled) {
      return;
    }

    const attempt = Math.min(state.retryAttempt, retryDelays.length - 1);
    const delay = retryDelays[attempt] ?? retryDelays[retryDelays.length - 1];

    reconnectTimer = setTimeout(() => {
      reconnectTimer = null;
      connect();
    }, delay);
  };

  const handleHeartbeat = (event: MessageEvent<string>) => {
    if (!event?.data) {
      return;
    }

    let payload: { emittedAt?: string } | null = null;
    try {
      payload = JSON.parse(event.data) as { emittedAt?: string };
    } catch {
      payload = null;
    }

    const emittedAt = payload?.emittedAt ? Date.parse(payload.emittedAt) : getNow();
    setState({
      lastHeartbeatAt: Number.isFinite(emittedAt) ? emittedAt : getNow(),
    });
    scheduleHeartbeatWatchdog();
  };

  const handleStreamOpen = () => {
    setState({
      status: 'healthy',
      retryAttempt: 0,
      fallbackActive: false,
    });
    scheduleHeartbeatWatchdog();
  };

  const handleOpen = () => {
    setState({
      status: 'healthy',
      retryAttempt: 0,
      fallbackActive: false,
    });
    scheduleHeartbeatWatchdog();
  };

  const handleConnectionError = (reason: 'error' | 'heartbeat_timeout' | 'closed') => {
    clearHeartbeatTimer();
    closeEventSource();

    const nextAttempt = state.retryAttempt + 1;
    const degraded = nextAttempt >= retryDelays.length;
    setState({
      status: degraded ? 'degraded' : 'recovering',
      retryAttempt: nextAttempt,
      fallbackActive: degraded || state.fallbackActive,
    });

    resolvedLogger.warn?.('Event hub connection issue', {
      reason,
      retryAttempt: nextAttempt,
      degraded,
    });

    scheduleReconnect();
  };

  const handleError = () => {
    handleConnectionError('error');
  };

  const connect = async () => {
    if (!enabled || eventSource || isConnecting) {
      return;
    }

    if (!hasListeners()) {
      return;
    }

    isConnecting = true;
    clearReconnectTimer();

    try {
      const url = resolveStreamUrl();
      const token = await options.getAuthToken();
      const init: EventSourceInitWithHeaders = { withCredentials: true };
      if (token) {
        init.headers = {
          Authorization: `Bearer ${token}`,
        };
      }

      const source = eventSourceFactory(url, init);
      eventSource = source;

      source.addEventListener('open', handleOpen);
      source.addEventListener('error', handleError);
      source.addEventListener(HEARTBEAT_EVENT, handleHeartbeat);
      source.addEventListener(STREAM_OPEN_EVENT, handleStreamOpen);

      for (const topic of topicRegistrations.keys()) {
        attachTopicListener(topic);
      }

      setState({
        status: 'recovering',
      });
    } catch (error) {
      const normalizedError =
        error instanceof Error ? error : new Error(String(error ?? 'unknown connection error'));
      resolvedLogger.error?.('Failed to establish event hub connection', {}, normalizedError);
      handleConnectionError('error');
    } finally {
      isConnecting = false;
    }
  };

  const hasListeners = (): boolean => {
    for (const registration of topicRegistrations.values()) {
      if (registration.listeners.size > 0) {
        return true;
      }
    }
    return false;
  };

  const ensureConnection = () => {
    if (!enabled || eventSource || isConnecting) {
      return;
    }
    if (!hasListeners()) {
      return;
    }
    void connect();
  };

  const removeListener = (topic: string, listener: InternalListener) => {
    const registration = topicRegistrations.get(topic);
    if (!registration) {
      return;
    }

    registration.listeners.delete(listener);
    if (registration.listeners.size === 0) {
      topicRegistrations.delete(topic);
      detachTopicListener(topic);
    }

    if (!hasListeners()) {
      clearHeartbeatTimer();
      clearReconnectTimer();
      closeEventSource();
      setState({
        status: 'recovering',
        fallbackActive: false,
        retryAttempt: 0,
      });
    }
  };

  const subscribe = <Payload = unknown>(
    scope: HubSubscriptionScope,
    callback: HubListener<Payload>
  ): (() => void) => {
    if (!scope?.topic) {
      throw new Error('Event hub subscriptions require a topic');
    }
    if (typeof callback !== 'function') {
      throw new Error('Event hub subscribers must supply a listener callback');
    }

    const topic = scope.topic;
    let registration = topicRegistrations.get(topic);
    if (!registration) {
      registration = { listeners: new Set() };
      topicRegistrations.set(topic, registration);
    }

    const internal: InternalListener = {
      id: ++listenerIdCounter,
      scope,
      callback: callback as HubListener,
    };

    registration.listeners.add(internal);

    attachTopicListener(topic);
    ensureConnection();

    return () => removeListener(topic, internal);
  };

  const onHealthChange = (listener: (state: HubHealthState) => void) => {
    healthListeners.add(listener);
    listener(state);
    return () => healthListeners.delete(listener);
  };

  const onFallbackChange = (listener: (active: boolean) => void) => {
    fallbackListeners.add(listener);
    listener(state.fallbackActive);
    return () => fallbackListeners.delete(listener);
  };

  const setEnabled = (next: boolean) => {
    if (enabled === next) {
      return;
    }
    enabled = next;
    if (!enabled) {
      clearHeartbeatTimer();
      clearReconnectTimer();
      closeEventSource();
      setState({
        status: 'recovering',
        retryAttempt: 0,
        fallbackActive: false,
      });
    } else {
      ensureConnection();
    }
  };

  const forceReconnect = () => {
    clearHeartbeatTimer();
    clearReconnectTimer();
    closeEventSource();
    setState({
      status: 'recovering',
      fallbackActive: state.fallbackActive,
    });
    ensureConnection();
  };

  const shutdown = () => {
    setEnabled(false);
    topicRegistrations.clear();
    detachAllTopicListeners();
  };

  return {
    subscribe,
    onHealthChange,
    onFallbackChange,
    getHealthState: () => state,
    isEnabled: () => enabled,
    setEnabled,
    forceReconnect,
    shutdown,
  };
}
