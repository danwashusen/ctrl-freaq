import { randomUUID } from 'node:crypto';
import type { Request, Response, NextFunction, RequestHandler } from 'express';
import { Router } from 'express';
import type { Logger } from 'pino';

import {
  createAIRequestAuditMiddleware,
  type RateLimitResult,
} from '../middleware/ai-request-audit.js';
import { AIProposalService } from '../services/co-authoring/ai-proposal.service.js';
import type { QueueCancellationReason } from '@ctrl-freaq/editor-core/streaming/section-stream-queue.js';
import type { AuthenticatedRequest } from '../middleware/auth.js';
import { SessionRateLimiter } from './co-authoring-rate-limiter.js';
import type { AppContext } from '../app.js';
import { resolveRateLimitEnforcementMode } from '../config/rate-limiting.js';

type CoAuthoringRequest<
  P extends Record<string, string> = Record<string, string>,
  B = unknown,
  Q extends Record<string, unknown> = Record<string, unknown>,
> = AuthenticatedRequest & Request<P, unknown, B, Q>;

export const coAuthoringRouter: Router = Router();

const RATE_WINDOW_MS = 60_000;
const MAX_REQUESTS_PER_WINDOW = 5;

const rateLimiter = new SessionRateLimiter({
  windowMs: RATE_WINDOW_MS,
  maxRequestsPerWindow: MAX_REQUESTS_PER_WINDOW,
});

const buildRateLimitKey = (
  userId: string | null,
  documentId: string,
  sectionId: string,
  intent: string
): string => `${userId ?? 'anonymous'}:${documentId}:${sectionId}:${intent}`;

const getService = (req: AuthenticatedRequest): AIProposalService => {
  const service = req.services?.get('coAuthoringService') as AIProposalService | undefined;
  if (!service) {
    throw new Error('Co-authoring service not available');
  }
  return service;
};

const buildAuditMiddleware = (): RequestHandler => {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    const logger = req.services?.get('logger') as Logger | undefined;

    const limiter = async (input: {
      userId: string | null;
      documentId: string;
      sectionId: string;
      intent: string;
    }) => {
      if (!input.userId) {
        return { allowed: true, remaining: MAX_REQUESTS_PER_WINDOW };
      }

      const key = buildRateLimitKey(input.userId, input.documentId, input.sectionId, input.intent);
      const now = Date.now();
      const result = rateLimiter.check(key, { now });
      const appContext = req.app?.locals?.appContext as AppContext | undefined;
      const enforcementMode = resolveRateLimitEnforcementMode(
        appContext?.config?.security?.rateLimiting?.mode ?? process.env.RATE_LIMIT_ENFORCEMENT_MODE
      );

      if (!result.allowed && enforcementMode === 'log') {
        const requestId = (req as { requestId?: string }).requestId ?? 'unknown';

        logger?.warn(
          {
            requestId,
            userId: input.userId,
            documentId: input.documentId,
            sectionId: input.sectionId,
            intent: input.intent,
            rateLimitWindow: RATE_WINDOW_MS,
            maxRequests: MAX_REQUESTS_PER_WINDOW,
            enforcementMode,
          },
          'Co-authoring rate limit exceeded (log mode)'
        );

        return {
          allowed: true,
          remaining: 0,
          retryAfterMs: result.retryAfterMs,
        } satisfies RateLimitResult;
      }

      if (!result.allowed) {
        return {
          allowed: false,
          remaining: result.remaining,
          retryAfterMs: result.retryAfterMs,
        } satisfies RateLimitResult;
      }

      return {
        allowed: true,
        remaining: result.remaining,
        retryAfterMs: result.retryAfterMs,
      } satisfies RateLimitResult;
    };

    const emitTelemetry = (event: string, payload: Record<string, unknown>) => {
      logger?.info(payload, `Telemetry:${event}`);
    };

    const middleware = createAIRequestAuditMiddleware({
      limiter,
      emitTelemetry,
      logger: logger ?? {
        info: () => {},
        warn: () => {},
        error: () => {},
      },
    });

    middleware(req as Request, res, next);
  };
};

const coAuthorAuditMiddleware = buildAuditMiddleware();

const parseStringArray = (value: unknown): string[] => {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.filter((item): item is string => typeof item === 'string');
};

const resolveAuthorId = (req: AuthenticatedRequest): string => {
  return req.auth?.userId ?? req.user?.userId ?? 'unknown';
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

const resolveFallbackDelivery = () => {
  const flag =
    process.env.STREAMING_DISABLED ??
    process.env.COAUTHOR_STREAMING_DISABLED ??
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

coAuthoringRouter.get<{ sessionId: string }>(
  '/co-authoring/sessions/:sessionId/events',
  (req: CoAuthoringRequest<{ sessionId: string }>, res: Response) => {
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
        'Failed to open co-authoring stream'
      );
      res.status(500).json({
        code: 'STREAM_ERROR',
        message: 'Failed to open co-authoring stream',
      });
    }
  }
);

coAuthoringRouter.post<{ documentId: string; sectionId: string }>(
  '/documents/:documentId/sections/:sectionId/co-author/analyze',
  coAuthorAuditMiddleware,
  async (
    req: CoAuthoringRequest<{ documentId: string; sectionId: string }>,
    res: Response,
    next: NextFunction
  ) => {
    try {
      const service = getService(req);
      const sessionId = typeof req.body?.sessionId === 'string' ? req.body.sessionId : null;
      const intent = typeof req.body?.intent === 'string' ? req.body.intent : 'analyze';
      const prompt = typeof req.body?.prompt === 'string' ? req.body.prompt : '';

      if (!sessionId || !prompt) {
        res.status(400).json({
          code: 'INVALID_REQUEST',
          message: 'sessionId and prompt are required',
        });
        return;
      }

      const knowledgeItemIds = parseStringArray(req.body?.knowledgeItemIds);
      const decisionIds = parseStringArray(req.body?.decisionIds);

      const { documentId, sectionId } = req.params;

      const response = await service.startAnalysis({
        sessionId,
        documentId,
        sectionId,
        authorId: resolveAuthorId(req),
        intent,
        prompt,
        knowledgeItemIds,
        decisionIds,
      });

      res.setHeader('HX-Stream-Location', response.streamLocation);
      res.status(202).json(response.responseBody);
    } catch (error) {
      next(error);
    }
  }
);

coAuthoringRouter.post<{ documentId: string; sectionId: string }>(
  '/documents/:documentId/sections/:sectionId/co-author/proposal',
  coAuthorAuditMiddleware,
  async (
    req: CoAuthoringRequest<{ documentId: string; sectionId: string }>,
    res: Response,
    next: NextFunction
  ) => {
    try {
      const service = getService(req);
      const sessionId = typeof req.body?.sessionId === 'string' ? req.body.sessionId : null;
      const promptId = typeof req.body?.promptId === 'string' ? req.body.promptId : randomUUID();
      const turnId = typeof req.body?.turnId === 'string' ? req.body.turnId : randomUUID();
      const intent = typeof req.body?.intent === 'string' ? req.body.intent : 'improve';
      const prompt = typeof req.body?.prompt === 'string' ? req.body.prompt : '';

      if (!sessionId || !prompt) {
        res.status(400).json({
          code: 'INVALID_REQUEST',
          message: 'sessionId and prompt are required',
        });
        return;
      }

      const knowledgeItemIds = parseStringArray(req.body?.knowledgeItemIds);
      const decisionIds = parseStringArray(req.body?.decisionIds);

      const { documentId, sectionId } = req.params;

      const response = await service.startProposal({
        sessionId,
        documentId,
        sectionId,
        authorId: resolveAuthorId(req),
        intent,
        prompt,
        promptId,
        turnId,
        draftVersion:
          typeof req.body?.draftVersion === 'number' ? req.body.draftVersion : undefined,
        baselineVersion:
          typeof req.body?.baselineVersion === 'string' ? req.body.baselineVersion : undefined,
        knowledgeItemIds,
        decisionIds,
      });

      const fallbackDelivery = resolveFallbackDelivery();

      res.setHeader('HX-Stream-Location', response.streamLocation);
      res.status(202).json({
        ...response.responseBody,
        queue: response.queue,
        delivery: {
          mode: fallbackDelivery.mode,
          reason: fallbackDelivery.reason,
        },
      });

      const audit = res.locals.aiAudit as
        | { logQueueDisposition?: (payload: Record<string, unknown>) => void }
        | undefined;
      if (typeof audit?.logQueueDisposition === 'function') {
        if (response.queue.disposition === 'started') {
          audit.logQueueDisposition({
            sessionId: response.responseBody.sessionId,
            disposition: 'active',
            concurrencySlot: response.queue.concurrencySlot,
          });
        }
        if (response.queue.replacedSessionId) {
          audit.logQueueDisposition({
            sessionId: response.queue.replacedSessionId,
            disposition: 'replaced',
            replacedSessionId: response.responseBody.sessionId,
          });
        }
        if (fallbackDelivery.mode === 'fallback') {
          audit.logQueueDisposition({
            sessionId: response.responseBody.sessionId,
            disposition: 'fallback',
            fallbackReason: fallbackDelivery.reason ?? 'assistant_unavailable',
            preservedTokensCount: 0,
            retryAttempted: false,
          });
        }
      }
    } catch (error) {
      next(error);
    }
  }
);

coAuthoringRouter.post<{ documentId: string; sectionId: string; sessionId: string }>(
  '/documents/:documentId/sections/:sectionId/co-author/sessions/:sessionId/cancel',
  async (
    req: CoAuthoringRequest<{ documentId: string; sectionId: string; sessionId: string }>,
    res: Response,
    next: NextFunction
  ) => {
    try {
      const service = getService(req);
      const result = await service.cancelInteraction({
        sessionId: req.params.sessionId,
        sectionId: req.params.sectionId,
        reason: normalizeCancelReason(req.body?.reason),
      });

      const statusCode = result.status === 'canceled' ? 200 : 404;
      res.status(statusCode).json(result);

      if (result.status === 'canceled') {
        const audit = res.locals.aiAudit as
          | { logQueueDisposition?: (payload: Record<string, unknown>) => void }
          | undefined;
        audit?.logQueueDisposition?.({
          sessionId: req.params.sessionId,
          disposition: 'canceled',
          cancelReason: result.cancelReason,
          promotedSessionId: result.promotedSessionId,
        });
      }
    } catch (error) {
      next(error);
    }
  }
);

coAuthoringRouter.post<{ documentId: string; sectionId: string; sessionId: string }>(
  '/documents/:documentId/sections/:sectionId/co-author/sessions/:sessionId/retry',
  async (
    req: CoAuthoringRequest<{ documentId: string; sectionId: string; sessionId: string }>,
    res: Response,
    next: NextFunction
  ) => {
    try {
      const service = getService(req);
      const result = await service.retryInteraction({
        sessionId: req.params.sessionId,
        sectionId: req.params.sectionId,
        intent: typeof req.body?.intent === 'string' ? req.body.intent : undefined,
      });

      res.setHeader('HX-Stream-Location', result.streamLocation);
      res.status(202).json({
        status: result.status,
        previousSessionId: result.previousSessionId,
        sessionId: result.sessionId,
        queue: result.queue,
        response: result.responseBody,
      });
    } catch (error) {
      next(error);
    }
  }
);

coAuthoringRouter.post<{ documentId: string; sectionId: string }>(
  '/documents/:documentId/sections/:sectionId/co-author/apply',
  coAuthorAuditMiddleware,
  async (
    req: CoAuthoringRequest<{ documentId: string; sectionId: string }>,
    res: Response,
    next: NextFunction
  ) => {
    try {
      const service = getService(req);

      const sessionId = typeof req.body?.sessionId === 'string' ? req.body.sessionId : null;
      const proposalId = typeof req.body?.proposalId === 'string' ? req.body.proposalId : null;
      const draftPatch = typeof req.body?.draftPatch === 'string' ? req.body.draftPatch : null;
      const diffHash = typeof req.body?.diffHash === 'string' ? req.body.diffHash : null;
      const approvalNotes =
        typeof req.body?.approvalNotes === 'string' ? req.body.approvalNotes : '';

      if (!sessionId || !proposalId || !draftPatch || !diffHash) {
        res.status(400).json({
          code: 'INVALID_REQUEST',
          message: 'sessionId, proposalId, diffHash, and draftPatch are required',
        });
        return;
      }

      const { documentId, sectionId } = req.params;

      const result = await service.approveProposal({
        documentId,
        sectionId,
        sessionId,
        authorId: resolveAuthorId(req),
        proposalId,
        diffHash,
        draftPatch,
        approvalNotes,
      });

      if (!result) {
        res.status(404).json({
          code: 'PROPOSAL_NOT_FOUND',
          message: 'Pending proposal is no longer available for approval',
        });
        return;
      }

      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  }
);

coAuthoringRouter.post<{ documentId: string; sectionId: string }>(
  '/documents/:documentId/sections/:sectionId/co-author/proposal/reject',
  async (
    req: CoAuthoringRequest<{ documentId: string; sectionId: string }>,
    res: Response,
    next: NextFunction
  ) => {
    try {
      const service = getService(req);
      const sessionId = typeof req.body?.sessionId === 'string' ? req.body.sessionId : null;
      const proposalId = typeof req.body?.proposalId === 'string' ? req.body.proposalId : null;

      if (!sessionId || !proposalId) {
        res.status(400).json({
          code: 'INVALID_REQUEST',
          message: 'sessionId and proposalId are required',
        });
        return;
      }

      service.rejectProposal({ sessionId, proposalId });
      res.status(204).end();
    } catch (error) {
      next(error);
    }
  }
);

coAuthoringRouter.post<{ documentId: string; sectionId: string }>(
  '/documents/:documentId/sections/:sectionId/co-author/teardown',
  async (
    req: CoAuthoringRequest<{ documentId: string; sectionId: string }>,
    res: Response,
    next: NextFunction
  ) => {
    try {
      const service = getService(req);
      const sessionId = typeof req.body?.sessionId === 'string' ? req.body.sessionId : null;
      const reason = typeof req.body?.reason === 'string' ? req.body.reason : 'manual';

      if (!sessionId) {
        res.status(400).json({
          code: 'INVALID_REQUEST',
          message: 'sessionId is required',
        });
        return;
      }

      const normalizedReason: 'section-change' | 'navigation' | 'logout' | 'manual' | 'expired' =
        reason === 'section-change' ||
        reason === 'navigation' ||
        reason === 'logout' ||
        reason === 'expired'
          ? reason
          : 'manual';

      service.teardownSession({ sessionId, reason: normalizedReason });
      res.status(204).end();
    } catch (error) {
      next(error);
    }
  }
);

export default coAuthoringRouter;
