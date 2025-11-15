import type { NextFunction, Router as ExpressRouter, Response } from 'express';
import { Router } from 'express';
import type { Logger } from 'pino';
import type { ZodIssue } from 'zod';

import type { AuthenticatedRequest } from '../../middleware/auth.js';
import type { ServiceContainer } from '../../core/service-locator.js';
import { createBrowserLogAuditLogger } from '../../services/audit-log.service.js';
import { createBrowserLogsBodyParser } from './body-parser.js';
import { emitBrowserLog } from './emit-browser-log.js';
import { enrichLogEntry } from './enrich-log-entry.js';
import {
  BrowserLogBatchSchema,
  type BrowserLogBatch,
  type BrowserLogBatchInput,
  type BrowserLogsAckResponse,
} from './logs.schema.js';
import {
  buildUnknownValidationError,
  buildEntryLimitError,
  buildValidationError,
  isBrowserLogsBodyParserError,
  sendBrowserLogsError,
  translateBodyParserError,
} from './logs.errors.js';

/**
 * Browser Log Ingestion Router
 *
 * Provides the entry point for POST /api/v1/logs traffic once D001–D004 land:
 * - D001: Strict schema validation + atomic rejection
 * - D002: 1 MB parser that supports sendBeacon text payloads
 * - D003: Structured browser.log enrichment + emission
 * - D004: Rate limiting + audit trail alignment
 */

export const logsRouter: ExpressRouter = Router();

export interface BrowserLogsRequest extends AuthenticatedRequest {
  body: unknown;
  services: ServiceContainer;
}

const logsBodyParser = createBrowserLogsBodyParser();
const LOG_ENTRY_LIMIT = 100;
type ValidationResult =
  | { success: true; batch: BrowserLogBatch }
  | { success: false; issue?: ZodIssue; limitExceeded?: boolean };

const resolveRequestLogger = (req: BrowserLogsRequest): Logger | undefined => {
  const services = req.services;
  if (!services) {
    return undefined;
  }

  try {
    return services.get<Logger>('logger');
  } catch {
    return undefined;
  }
};

const addEntryIndexes = (batch: BrowserLogBatchInput): BrowserLogBatch => ({
  ...batch,
  logs: batch.logs.map((entry, index) => ({
    ...entry,
    index,
  })),
});

const resolveUserId = (req: BrowserLogsRequest): string | null =>
  req.user?.userId ?? req.auth?.userId ?? null;

const extractSessionId = (payload: unknown): string | undefined => {
  if (!payload || typeof payload !== 'object') {
    return undefined;
  }

  const candidate = (payload as Record<string, unknown>).sessionId;
  return typeof candidate === 'string' && candidate.length > 0 ? candidate : undefined;
};

const hasTooManyEntries = (payload: unknown): boolean => {
  if (!payload || typeof payload !== 'object') {
    return false;
  }

  const candidate = (payload as Record<string, unknown>).logs;
  if (!Array.isArray(candidate)) {
    return false;
  }

  return candidate.length > LOG_ENTRY_LIMIT;
};

const validateBatch = (body: unknown): ValidationResult => {
  if (hasTooManyEntries(body)) {
    return {
      success: false,
      limitExceeded: true,
    };
  }

  const parsed = BrowserLogBatchSchema.safeParse(body);
  if (!parsed.success) {
    return {
      success: false,
      issue: parsed.error.issues[0],
    };
  }

  return {
    success: true,
    batch: addEntryIndexes(parsed.data),
  };
};

const buildAckResponse = (requestId: string, receivedCount: number): BrowserLogsAckResponse => ({
  requestId,
  status: 'accepted',
  receivedCount,
});

logsRouter.post('/logs', logsBodyParser, async (req: BrowserLogsRequest, res: Response) => {
  const requestId = req.requestId ?? 'unknown';
  const requestLogger = resolveRequestLogger(req);
  const auditLogger = createBrowserLogAuditLogger(requestLogger);
  const userId = resolveUserId(req);

  const validation = validateBatch(req.body);
  if (!validation.success) {
    const error = validation.limitExceeded
      ? buildEntryLimitError(requestId)
      : validation.issue
        ? buildValidationError(validation.issue, requestId)
        : buildUnknownValidationError(requestId);

    auditLogger.recordRejection({
      reason: error.body.code,
      requestId,
      sessionId: extractSessionId(req.body),
      userId,
      details: {
        ...(error.body.details ?? {}),
        message: error.body.message,
      },
    });

    sendBrowserLogsError(res, error);
    return;
  }

  const { batch } = validation;

  batch.logs.forEach(entry => {
    const enrichedEvent = enrichLogEntry({
      entry,
      batch,
      index: entry.index,
      request: req,
    });
    emitBrowserLog(requestLogger, enrichedEvent);
  });

  const ackPayload = buildAckResponse(requestId, batch.logs.length);
  res.status(202).json(ackPayload);
});

logsRouter.use(
  '/logs',
  (error: unknown, req: BrowserLogsRequest, res: Response, next: NextFunction) => {
    if (!isBrowserLogsBodyParserError(error)) {
      next(error);
      return;
    }

    const requestId = req.requestId ?? 'unknown';
    const requestLogger = resolveRequestLogger(req);
    const auditLogger = createBrowserLogAuditLogger(requestLogger);
    const translated = translateBodyParserError(error, requestId);

    auditLogger.recordRejection({
      reason: translated.body.code,
      requestId,
      userId: resolveUserId(req),
    });

    sendBrowserLogsError(res, translated);
  }
);
