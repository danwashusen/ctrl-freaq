import { randomUUID } from 'node:crypto';
import type { Request, Response, NextFunction } from 'express';
import { Router } from 'express';
import type { Logger } from 'pino';

import type { AuthenticatedRequest } from '../middleware/auth.js';
import { DocumentQaStreamingService } from '../modules/document-qa/services/document-qa-streaming.service.js';
import type { QueueCancellationReason } from '@ctrl-freaq/editor-core/streaming/section-stream-queue.js';

type DocumentQaRequest<
  P extends Record<string, string> = Record<string, string>,
  B = unknown,
  Q extends Record<string, unknown> = Record<string, unknown>,
> = AuthenticatedRequest & Request<P, unknown, B, Q>;

export const documentQaRouter: Router = Router();

const getService = (req: DocumentQaRequest): DocumentQaStreamingService => {
  const service = req.services?.get('documentQaStreamingService') as
    | DocumentQaStreamingService
    | undefined;
  if (!service) {
    throw new Error('Document QA streaming service not available');
  }
  return service;
};

const resolveReviewerId = (req: DocumentQaRequest): string => {
  return req.auth?.userId ?? req.user?.userId ?? 'unknown-reviewer';
};

const normalizeCancelReason = (value: unknown): QueueCancellationReason => {
  if (
    value === 'replaced_by_new_request' ||
    value === 'transport_failure' ||
    value === 'deferred'
  ) {
    return value;
  }
  return 'author_cancelled';
};

const resolveDocumentQaFallbackDelivery = () => {
  const flag =
    process.env.STREAMING_DISABLED ??
    process.env.DOCUMENT_QA_STREAMING_DISABLED ??
    process.env.AI_STREAMING_DISABLED;

  if (!flag) {
    return { mode: 'streaming' as const, reason: null };
  }

  const normalized = String(flag).trim().toLowerCase();
  const enabled =
    normalized === '1' || normalized === 'true' || normalized === 'yes' || normalized === 'on';

  return enabled
    ? { mode: 'fallback' as const, reason: 'transport_blocked' as const }
    : { mode: 'streaming' as const, reason: null };
};

documentQaRouter.get<{ sessionId: string }>(
  '/document-qa/sessions/:sessionId/events',
  (req: DocumentQaRequest<{ sessionId: string }>, res: Response) => {
    try {
      const service = getService(req);
      service.subscribe(req.params.sessionId, res);
    } catch (error) {
      const logger = req.services?.get('logger') as Logger | undefined;
      logger?.error(
        {
          error: error instanceof Error ? error.message : error,
          sessionId: req.params.sessionId,
        },
        'Failed to open document QA stream'
      );
      res.status(500).json({
        code: 'STREAM_ERROR',
        message: 'Failed to open document QA stream',
      });
    }
  }
);

documentQaRouter.post<{ documentId: string; sectionId: string }>(
  '/documents/:documentId/sections/:sectionId/document-qa/review',
  async (
    req: DocumentQaRequest<
      { documentId: string; sectionId: string },
      { prompt?: string; sessionId?: string }
    >,
    res: Response,
    next: NextFunction
  ) => {
    try {
      const service = getService(req);
      const prompt = typeof req.body?.prompt === 'string' ? req.body.prompt : null;
      const sessionId = typeof req.body?.sessionId === 'string' ? req.body.sessionId : randomUUID();

      if (!prompt) {
        res.status(400).json({
          code: 'INVALID_REQUEST',
          message: 'prompt is required to start a document QA review',
        });
        return;
      }

      const result = await service.startReview({
        sessionId,
        documentId: req.params.documentId,
        sectionId: req.params.sectionId,
        reviewerId: resolveReviewerId(req),
        prompt,
      });

      const fallbackDelivery = resolveDocumentQaFallbackDelivery();

      res.setHeader('HX-Stream-Location', result.streamLocation);
      res.status(202).json({
        status: result.status,
        sessionId: result.sessionId,
        queue: result.queue,
        delivery: {
          mode: fallbackDelivery.mode,
          reason: fallbackDelivery.reason,
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

documentQaRouter.post<{ documentId: string; sectionId: string; sessionId: string }>(
  '/documents/:documentId/sections/:sectionId/document-qa/sessions/:sessionId/cancel',
  async (
    req: DocumentQaRequest<
      { documentId: string; sectionId: string; sessionId: string },
      { reason?: QueueCancellationReason }
    >,
    res: Response,
    next: NextFunction
  ) => {
    try {
      const service = getService(req);
      const result = await service.cancelReview({
        sessionId: req.params.sessionId,
        sectionId: req.params.sectionId,
        reason: normalizeCancelReason(req.body?.reason),
      });

      const statusCode = result.status === 'canceled' ? 200 : 404;
      res.status(statusCode).json(result);
    } catch (error) {
      next(error);
    }
  }
);

documentQaRouter.post<{ documentId: string; sectionId: string; sessionId: string }>(
  '/documents/:documentId/sections/:sectionId/document-qa/sessions/:sessionId/retry',
  async (
    req: DocumentQaRequest<{ documentId: string; sectionId: string; sessionId: string }>,
    res: Response,
    next: NextFunction
  ) => {
    try {
      const service = getService(req);
      const result = await service.retryReview({
        sessionId: req.params.sessionId,
        sectionId: req.params.sectionId,
      });

      res.status(202).json(result);
    } catch (error) {
      next(error);
    }
  }
);

export default documentQaRouter;
