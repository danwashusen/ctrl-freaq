import type { Response } from 'express';
import type { Logger } from 'pino';

import type { AuthenticatedRequest } from '../../../middleware/auth.js';
import type { TraceabilitySyncService, TraceabilityMatrixEntry } from '@ctrl-freaq/qa';

interface TraceabilityOrphanRequestBody {
  requirementId?: string;
  sectionId?: string;
  reason?: 'no-link' | 'blocker' | 'warning-override';
}

interface ErrorResponseOptions {
  status: number;
  code: string;
  message: string;
  requestId: string;
  details?: unknown;
}

const sendError = (res: Response, options: ErrorResponseOptions) => {
  res.status(options.status).json({
    code: options.code,
    message: options.message,
    requestId: options.requestId,
    timestamp: new Date().toISOString(),
    details: options.details ?? null,
  });
};

const serializeAuditTrail = (entry: TraceabilityMatrixEntry['auditTrail']) =>
  entry.map(event => ({
    eventId: event.eventId,
    type: event.type,
    timestamp: event.timestamp instanceof Date ? event.timestamp.toISOString() : event.timestamp,
    actorId: event.actorId,
    details: event.details ?? null,
  }));

export class TraceabilityController {
  constructor(
    private readonly service: TraceabilitySyncService,
    private readonly logger: Logger
  ) {}

  async getMatrix(req: AuthenticatedRequest, res: Response): Promise<void> {
    const requestId = req.requestId ?? 'unknown';
    const { documentId } = req.params as { documentId?: string };

    if (!documentId) {
      sendError(res, {
        status: 400,
        code: 'BAD_REQUEST',
        message: 'documentId parameter is required',
        requestId,
      });
      return;
    }

    const triggeredBy = req.auth?.userId ?? req.user?.userId ?? null;
    if (!triggeredBy) {
      sendError(res, {
        status: 401,
        code: 'UNAUTHORIZED',
        message: 'Authentication required to view traceability data',
        requestId,
      });
      return;
    }

    try {
      const requirements = await this.service.listDocumentTraceability(documentId);

      res.status(200).json({
        documentId,
        requirements: requirements.map(requirement => ({
          requirementId: requirement.requirementId,
          sectionId: requirement.sectionId,
          title: requirement.title,
          preview: requirement.preview,
          gateStatus: requirement.gateStatus,
          coverageStatus: requirement.coverageStatus,
          lastValidatedAt: requirement.lastValidatedAt,
          validatedBy: requirement.validatedBy,
          notes: requirement.notes,
          revisionId: requirement.revisionId,
          auditTrail: serializeAuditTrail(requirement.auditTrail),
        })),
      });

      this.logger.info(
        {
          requestId,
          documentId,
          requirementCount: requirements.length,
        },
        'Traceability matrix served'
      );
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error(
        { requestId, documentId, err: error, errorMessage },
        'Failed to load traceability matrix'
      );
      sendError(res, {
        status: 500,
        code: 'TRACEABILITY_MATRIX_ERROR',
        message: 'Failed to load traceability matrix',
        requestId,
        details: { error: errorMessage },
      });
    }
  }

  async markOrphaned(req: AuthenticatedRequest, res: Response): Promise<void> {
    const requestId = req.requestId ?? 'unknown';
    const { documentId } = req.params as { documentId?: string };
    const body = (req.body ?? {}) as TraceabilityOrphanRequestBody;

    if (!documentId) {
      sendError(res, {
        status: 400,
        code: 'BAD_REQUEST',
        message: 'documentId parameter is required',
        requestId,
      });
      return;
    }

    if (!body.requirementId || !body.sectionId) {
      sendError(res, {
        status: 400,
        code: 'BAD_REQUEST',
        message: 'requirementId and sectionId are required to mark an orphaned requirement',
        requestId,
      });
      return;
    }

    const actorId = req.auth?.userId ?? req.user?.userId ?? null;
    if (!actorId) {
      sendError(res, {
        status: 401,
        code: 'UNAUTHORIZED',
        message: 'Authentication required to mark traceability gaps',
        requestId,
      });
      return;
    }

    const reason = body.reason ?? 'no-link';

    try {
      const updated = await this.service.markRequirementOrphaned({
        documentId,
        requirementId: body.requirementId,
        sectionId: body.sectionId,
        reason,
        actorId,
      });

      res.status(200).json({
        requirementId: updated.requirementId,
        sectionId: updated.sectionId,
        coverageStatus: updated.coverageStatus,
        reason,
        lastValidatedAt: updated.lastValidatedAt.toISOString(),
        validatedBy: updated.validatedBy,
      });

      this.logger.info(
        {
          requestId,
          documentId,
          requirementId: updated.requirementId,
          sectionId: updated.sectionId,
          reason,
        },
        'Traceability requirement marked orphaned'
      );
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error(
        { requestId, documentId, requirementId: body.requirementId, err: error, errorMessage },
        'Failed to mark traceability orphan'
      );
      sendError(res, {
        status: 500,
        code: 'TRACEABILITY_ORPHAN_ERROR',
        message: 'Failed to mark requirement as orphaned',
        requestId,
        details: { error: errorMessage },
      });
    }
  }
}
