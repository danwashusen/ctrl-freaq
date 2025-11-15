import type { Response } from 'express';
import { ZodIssueCode, type ZodIssue } from 'zod';

export type BrowserLogsErrorCode = 'INVALID_PAYLOAD' | 'PAYLOAD_TOO_LARGE';

export interface BrowserLogsErrorBody {
  code: BrowserLogsErrorCode;
  message: string;
  requestId: string;
  timestamp: string;
  details?: Record<string, unknown>;
}

export interface BrowserLogsHttpError {
  status: number;
  body: BrowserLogsErrorBody;
}

interface BodyParserError {
  type?: string;
  status?: number;
  message?: string;
}

const MAX_LOG_ENTRIES = 100;

const createErrorBody = (
  status: number,
  code: BrowserLogsErrorCode,
  requestId: string,
  message: string,
  details?: Record<string, unknown>
): BrowserLogsHttpError => ({
  status,
  body: {
    code,
    message,
    requestId,
    timestamp: new Date().toISOString(),
    ...(details ? { details } : {}),
  },
});

export const formatIssuePath = (path: readonly PropertyKey[]): string => {
  if (path.length === 0) {
    return '';
  }

  return path
    .map((segment, index) => {
      if (typeof segment === 'number') {
        return `[${segment}]`;
      }
      if (typeof segment === 'string') {
        return index === 0 ? segment : `.${segment}`;
      }
      const symbolSegment = segment.toString();
      return index === 0 ? symbolSegment : `.${symbolSegment}`;
    })
    .join('');
};

const buildDetailsFromIssue = (issue: ZodIssue): Record<string, unknown> | undefined => {
  if (issue.path.length === 0) {
    return undefined;
  }
  const path = formatIssuePath(issue.path);
  return path ? { path } : undefined;
};

export const buildValidationError = (issue: ZodIssue, requestId: string): BrowserLogsHttpError => {
  if (issue.code === ZodIssueCode.too_big && issue.path.length > 0 && issue.path[0] === 'logs') {
    return createErrorBody(
      413,
      'PAYLOAD_TOO_LARGE',
      requestId,
      `Batch may include at most ${MAX_LOG_ENTRIES} entries`,
      { path: 'logs' }
    );
  }

  return createErrorBody(
    400,
    'INVALID_PAYLOAD',
    requestId,
    issue.message,
    buildDetailsFromIssue(issue)
  );
};

export const buildUnknownValidationError = (requestId: string): BrowserLogsHttpError =>
  createErrorBody(400, 'INVALID_PAYLOAD', requestId, 'Payload failed validation');

export const buildEntryLimitError = (requestId: string): BrowserLogsHttpError =>
  createErrorBody(
    413,
    'PAYLOAD_TOO_LARGE',
    requestId,
    `Batch may include at most ${MAX_LOG_ENTRIES} entries`,
    { path: 'logs' }
  );

const isEntityTooLargeError = (error: BodyParserError): boolean =>
  error.type === 'entity.too.large' || error.status === 413;

const isParseFailureError = (error: BodyParserError): boolean =>
  error.type === 'entity.parse.failed' || error.status === 400;

export const translateBodyParserError = (
  error: BodyParserError,
  requestId: string
): BrowserLogsHttpError => {
  if (isEntityTooLargeError(error)) {
    return createErrorBody(413, 'PAYLOAD_TOO_LARGE', requestId, 'Batch body must be ≤1MB');
  }

  if (isParseFailureError(error)) {
    return createErrorBody(400, 'INVALID_PAYLOAD', requestId, 'Invalid JSON payload');
  }

  return createErrorBody(400, 'INVALID_PAYLOAD', requestId, 'Unable to parse request body');
};

export const isBrowserLogsBodyParserError = (error: unknown): error is BodyParserError => {
  if (!error || typeof error !== 'object') {
    return false;
  }

  const candidate = error as BodyParserError;
  return typeof candidate.type === 'string' || typeof candidate.status === 'number';
};

export const sendBrowserLogsError = (res: Response, error: BrowserLogsHttpError): void => {
  res.status(error.status).json(error.body);
};
