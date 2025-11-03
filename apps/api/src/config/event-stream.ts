export interface EventStreamConfig {
  enabled: boolean;
  replayLimit: number;
  heartbeatIntervalMs: number;
  maxRetries: number;
}

export interface ResolveEventStreamConfigOptions {
  env?: NodeJS.ProcessEnv;
}

export class EventStreamConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'EventStreamConfigError';
  }
}

const DEFAULT_CONFIG: EventStreamConfig = {
  enabled: false,
  replayLimit: 100,
  heartbeatIntervalMs: 15_000,
  maxRetries: 5,
};

const isTestEnvironment = (env: NodeJS.ProcessEnv): boolean => {
  const nodeEnv = env.NODE_ENV?.trim().toLowerCase();
  if (nodeEnv === 'test') {
    return true;
  }
  const vitestFlag = env.VITEST?.trim().toLowerCase();
  return vitestFlag === 'true';
};

const normalizeBoolean = (raw: string | undefined, defaultValue: boolean): boolean => {
  if (raw === undefined) {
    return defaultValue;
  }

  const normalized = raw.trim().toLowerCase();
  if (normalized === '') {
    return defaultValue;
  }

  if (['1', 'true', 'yes', 'on'].includes(normalized)) {
    return true;
  }

  if (['0', 'false', 'no', 'off'].includes(normalized)) {
    return false;
  }

  throw new EventStreamConfigError(
    `Unrecognized boolean value "${raw}" for event stream configuration.`
  );
};

const normalizeInteger = (
  raw: string | undefined,
  options: { defaultValue: number; min?: number; max?: number; name: string }
): number => {
  if (raw === undefined || raw.trim() === '') {
    return options.defaultValue;
  }

  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed) || Number.isNaN(parsed)) {
    throw new EventStreamConfigError(
      `Expected ${options.name} to be an integer but received "${raw}".`
    );
  }

  if (!Number.isInteger(parsed)) {
    throw new EventStreamConfigError(
      `Expected ${options.name} to be an integer but received "${raw}".`
    );
  }

  if (options.min !== undefined && parsed < options.min) {
    throw new EventStreamConfigError(
      `Expected ${options.name} to be >= ${options.min} but received "${raw}".`
    );
  }

  if (options.max !== undefined && parsed > options.max) {
    throw new EventStreamConfigError(
      `Expected ${options.name} to be <= ${options.max} but received "${raw}".`
    );
  }

  return parsed;
};

export const resolveEventStreamConfig = (
  options: ResolveEventStreamConfigOptions = {}
): EventStreamConfig => {
  const env = options.env ?? process.env;

  const defaultEnabled = isTestEnvironment(env) ? true : DEFAULT_CONFIG.enabled;

  return {
    enabled: normalizeBoolean(env.ENABLE_EVENT_STREAM, defaultEnabled),
    replayLimit: normalizeInteger(env.EVENT_STREAM_REPLAY_LIMIT, {
      name: 'EVENT_STREAM_REPLAY_LIMIT',
      defaultValue: DEFAULT_CONFIG.replayLimit,
      min: 10,
    }),
    heartbeatIntervalMs: normalizeInteger(env.EVENT_STREAM_HEARTBEAT_INTERVAL_MS, {
      name: 'EVENT_STREAM_HEARTBEAT_INTERVAL_MS',
      defaultValue: DEFAULT_CONFIG.heartbeatIntervalMs,
      min: 1_000,
    }),
    maxRetries: normalizeInteger(env.EVENT_STREAM_MAX_RETRIES, {
      name: 'EVENT_STREAM_MAX_RETRIES',
      defaultValue: DEFAULT_CONFIG.maxRetries,
      min: 0,
    }),
  };
};

export const getDefaultEventStreamConfig = (): EventStreamConfig => ({ ...DEFAULT_CONFIG });
