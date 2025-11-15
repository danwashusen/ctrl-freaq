import { randomUUID } from 'node:crypto';

const DEFAULT_SESSION_ID = 'sess_fixture_browser';
const DEFAULT_USER_ID = 'user-local-author';
const DEFAULT_METADATA = { release: 'fixture', attempt: 1 };
const DEFAULT_OVERSIZE_BYTES = 1024 * 1024 + 2048; // ~1MB + guard rail

export const BROWSER_LOG_LEVELS = ['DEBUG', 'INFO', 'WARN', 'ERROR', 'FATAL'] as const;
export type BrowserLogLevel = (typeof BROWSER_LOG_LEVELS)[number];

export interface BrowserLogEntry {
  timestamp: string;
  level: BrowserLogLevel;
  message: string;
  requestId: string;
  sessionId?: string;
  event_type?: string;
  context?: Record<string, string | number | boolean>;
  attributes?: Record<string, unknown>;
  error?: {
    name: string;
    message: string;
    stack?: string;
  };
}

export interface BrowserLogBatch {
  source: 'browser';
  sessionId: string;
  userId?: string | null;
  logs: BrowserLogEntry[];
  metadata?: Record<string, unknown>;
}

export interface BuildBrowserLogEntryOptions extends Partial<BrowserLogEntry> {
  messageSizeBytes?: number;
  includeError?: boolean;
}

export interface BuildBrowserLogBatchOptions {
  logsCount?: number;
  sessionId?: string;
  userId?: string | null;
  metadata?: Record<string, unknown>;
  entryOverrides?: BuildBrowserLogEntryOptions;
  entries?: BrowserLogEntry[];
}

export interface BuildOversizeBatchOptions extends BuildBrowserLogBatchOptions {
  minBytes?: number;
}

export type MalformedBatchScenario = 'missingRequestId' | 'invalidSource' | 'tooManyEntries';

export interface BuildMalformedBrowserLogBatchOptions extends BuildBrowserLogBatchOptions {
  scenario?: MalformedBatchScenario;
}

const LOG_PREFIX = 'fixture log entry ';

const LOG_LEVEL_SEQUENCE: BrowserLogLevel[] = ['INFO', 'WARN', 'ERROR', 'DEBUG', 'FATAL'];

function createMessage(sizeBytes?: number, suffix?: string): string {
  const defaultMessage = `${LOG_PREFIX}${suffix ?? 'received'}`;
  if (!sizeBytes || sizeBytes <= defaultMessage.length) {
    return defaultMessage;
  }

  const chunk = 'x'.repeat(1024);
  const repeats = Math.ceil(sizeBytes / chunk.length);
  return (defaultMessage + chunk.repeat(repeats)).slice(0, sizeBytes);
}

export function buildBrowserLogEntry(
  overrides: BuildBrowserLogEntryOptions = {},
  index = 0
): BrowserLogEntry {
  const message = createMessage(overrides.messageSizeBytes, `#${index}`);
  const derivedLevel = LOG_LEVEL_SEQUENCE[index % LOG_LEVEL_SEQUENCE.length] ?? 'INFO';

  const entry: BrowserLogEntry = {
    timestamp: overrides.timestamp ?? new Date().toISOString(),
    level: overrides.level ?? derivedLevel,
    message: overrides.message ?? message,
    requestId: overrides.requestId ?? `req_fixture_${index}_${randomUUID().slice(0, 8)}`,
    sessionId: overrides.sessionId,
    event_type: overrides.event_type ?? 'telemetry.event',
    context: overrides.context ?? { retries: 0, component: 'editor' },
    attributes: overrides.attributes ?? {
      route: '/documents',
      latencyMs: 123,
    },
    error: overrides.includeError
      ? {
          name: overrides.error?.name ?? 'Error',
          message: overrides.error?.message ?? 'fixture stack',
          stack: overrides.error?.stack ?? 'Error: fixture stack\n   at handler.ts:10:4',
        }
      : overrides.error,
  };

  return {
    ...entry,
    ...overrides,
    message: overrides.message ?? message,
  };
}

function buildEntries(
  count: number,
  overrides: BuildBrowserLogEntryOptions = {}
): BrowserLogEntry[] {
  return Array.from({ length: count }, (_, index) => buildBrowserLogEntry(overrides, index));
}

export function buildBrowserLogBatch(options: BuildBrowserLogBatchOptions = {}): BrowserLogBatch {
  const {
    logsCount = 1,
    sessionId = DEFAULT_SESSION_ID,
    userId = DEFAULT_USER_ID,
    metadata = DEFAULT_METADATA,
    entryOverrides,
    entries,
  } = options;

  const payloadEntries = entries ?? buildEntries(logsCount, entryOverrides);

  return {
    source: 'browser',
    sessionId,
    userId,
    logs: payloadEntries,
    ...(metadata ? { metadata } : {}),
  };
}

export function buildOversizeBrowserLogBatch(
  options: BuildOversizeBatchOptions = {}
): BrowserLogBatch {
  const { minBytes = DEFAULT_OVERSIZE_BYTES, entryOverrides = {}, ...rest } = options;
  const oversizeOverrides: BuildBrowserLogEntryOptions = {
    ...entryOverrides,
    message: entryOverrides.message ?? createMessage(minBytes, 'oversize'),
  };

  return buildBrowserLogBatch({
    ...rest,
    entryOverrides: oversizeOverrides,
  });
}

export function buildMalformedBrowserLogBatch(
  options: BuildMalformedBrowserLogBatchOptions = {}
): Record<string, unknown> {
  const { scenario = 'missingRequestId', ...rest } = options;
  const base = buildBrowserLogBatch(rest);
  const invalidBatch = JSON.parse(JSON.stringify(base)) as Record<string, unknown>;
  const logs = Array.isArray(invalidBatch.logs)
    ? (invalidBatch.logs as Record<string, unknown>[])
    : undefined;

  if (scenario === 'missingRequestId') {
    if (logs?.[0]) {
      delete logs[0].requestId;
    }
    return invalidBatch;
  }

  if (scenario === 'invalidSource') {
    invalidBatch.source = 'extension';
    return invalidBatch;
  }

  if (scenario === 'tooManyEntries') {
    invalidBatch.logs = buildEntries(101, rest.entryOverrides) as unknown as Record<
      string,
      unknown
    >[];
    return invalidBatch;
  }

  return invalidBatch;
}

export function serializeBatchAsText(batch: BrowserLogBatch): string {
  return JSON.stringify(batch);
}
