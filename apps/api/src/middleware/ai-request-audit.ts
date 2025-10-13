import type { RequestHandler } from 'express';

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfterMs?: number;
}

export interface AIRequestAuditOptions {
  limiter: (input: {
    userId: string | null;
    documentId: string;
    sectionId: string;
    intent: string;
  }) => Promise<RateLimitResult>;
  emitTelemetry: (event: string, payload: Record<string, unknown>) => void;
  logger: {
    info: (payload: Record<string, unknown>, message?: string) => void;
    warn: (payload: Record<string, unknown>, message?: string) => void;
    error: (payload: Record<string, unknown>, message?: string) => void;
  };
}

const redactPrompt = () => '[REDACTED]';

const extractCitations = (input: unknown): string[] => {
  if (!Array.isArray(input)) {
    return [];
  }

  return input.filter((value): value is string => typeof value === 'string');
};

export function createAIRequestAuditMiddleware(options: AIRequestAuditOptions): RequestHandler {
  return async (req, res, next) => {
    const requestId = (req as { requestId?: string }).requestId ?? 'unknown';
    const userId = (req as { auth?: { userId?: string } }).auth?.userId ?? null;
    const documentId = String(req.params.documentId ?? '');
    const sectionId = String(req.params.sectionId ?? '');
    const intent = typeof req.body?.intent === 'string' ? req.body.intent : 'unknown';

    try {
      const rateResult = await options.limiter({ userId, documentId, sectionId, intent });

      if (!rateResult.allowed) {
        options.logger.warn({
          reason: 'rate_limit',
          requestId,
          userId,
          documentId,
          sectionId,
          intent,
        });

        if (typeof rateResult.retryAfterMs === 'number' && typeof res.setHeader === 'function') {
          res.setHeader('Retry-After', Math.ceil(rateResult.retryAfterMs / 1000).toString());
        }

        res.status(429).json({
          code: 'RATE_LIMITED',
          message: 'Too many co-authoring requests. Please retry later.',
          retryAfterMs: rateResult.retryAfterMs ?? 0,
        });
        return;
      }

      const telemetryCitations = extractCitations(req.body?.metadata?.citations);

      options.emitTelemetry('coauthor.intent', {
        requestId,
        userId,
        documentId,
        sectionId,
        intent,
        prompt: redactPrompt(),
        citations: telemetryCitations,
      });

      options.logger.info({
        requestId,
        userId,
        documentId,
        sectionId,
        intent,
      });

      const logQueueDisposition = (payload: {
        sessionId: string;
        disposition: 'active' | 'replaced' | 'canceled' | 'fallback';
        cancelReason?: string;
        replacedSessionId?: string;
        discrepancyFlag?: boolean;
        concurrencySlot?: number;
        fallbackReason?: string;
        preservedTokensCount?: number;
        retryAttempted?: boolean;
        elapsedMs?: number;
      }) => {
        const telemetryPayload = {
          requestId,
          userId,
          documentId,
          sectionId,
          intent,
          ...payload,
        } satisfies Record<string, unknown>;

        options.emitTelemetry('coauthor.queue', telemetryPayload);
        options.logger.info(telemetryPayload, 'Co-author queue disposition updated');
      };

      res.locals.aiAudit = {
        requestId,
        userId,
        documentId,
        sectionId,
        intent,
        startedAt: new Date(),
        logQueueDisposition,
      };

      next();
    } catch (error) {
      options.logger.error(
        {
          requestId,
          error: error instanceof Error ? error.message : error,
        },
        'AI request audit middleware encountered an error'
      );
      next(error);
    }
  };
}
