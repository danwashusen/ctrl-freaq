import type { BrowserLogsRequest } from './index.js';
import type { BrowserLogBatch, BrowserLogEntry, BrowserLogEntryWithIndex } from './logs.schema.js';

export interface EnrichLogEntryParams {
  entry: BrowserLogEntryWithIndex;
  batch: BrowserLogBatch;
  index: number;
  request: BrowserLogsRequest;
}

export interface EnrichedBrowserLogPayload extends BrowserLogEntry {
  sessionId: string;
  index: number;
}

export interface EnrichedBrowserLogEvent {
  event: 'browser.log';
  apiRequestId: string;
  entryRequestId: string;
  sessionId: string;
  userId: string | null;
  ip: string | null;
  userAgent: string | null;
  ingestedAt: string;
  level: BrowserLogEntry['level'];
  payload: EnrichedBrowserLogPayload;
}

const USER_AGENT_MAX_LENGTH = 512;

const normalizeUserAgent = (value?: string | null): string | null => {
  if (!value) {
    return null;
  }

  return value.length > USER_AGENT_MAX_LENGTH ? value.slice(0, USER_AGENT_MAX_LENGTH) : value;
};

export function enrichLogEntry(params: EnrichLogEntryParams): EnrichedBrowserLogEvent {
  const { entry, batch, index, request } = params;
  const sessionId = entry.sessionId ?? batch.sessionId;
  const apiRequestId = request.requestId ?? 'unknown';
  const userId = request.user?.userId ?? batch.userId ?? null;
  const ip = typeof request.ip === 'string' && request.ip.length > 0 ? request.ip : null;
  const userAgent = normalizeUserAgent(request.get?.('user-agent'));

  const payload: EnrichedBrowserLogPayload = {
    ...entry,
    sessionId,
    index: entry.index ?? index,
  };

  return {
    event: 'browser.log',
    apiRequestId,
    entryRequestId: entry.requestId,
    sessionId,
    userId,
    ip,
    userAgent,
    ingestedAt: new Date().toISOString(),
    level: entry.level,
    payload,
  };
}
