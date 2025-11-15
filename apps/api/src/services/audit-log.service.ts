import type { Logger } from 'pino';

export interface BrowserLogRejectionEvent {
  reason: string;
  requestId: string;
  sessionId?: string;
  userId?: string | null;
  details?: Record<string, unknown>;
}

export interface BrowserLogAuditLogger {
  recordRejection(event: BrowserLogRejectionEvent): void;
}

export function createBrowserLogAuditLogger(logger?: Logger | null): BrowserLogAuditLogger {
  return {
    recordRejection(event: BrowserLogRejectionEvent) {
      if (!logger) {
        return;
      }

      logger.warn(
        {
          event: 'browser.log.reject',
          reason: event.reason,
          requestId: event.requestId,
          sessionId: event.sessionId,
          userId: event.userId,
          details: event.details,
        },
        'Browser log batch rejected'
      );
    },
  };
}
