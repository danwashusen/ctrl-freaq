import type { Response } from 'express';
import type { Logger } from 'pino';

import type { AuthenticatedRequest } from '../../../middleware/auth.js';
import type {
  DocumentQualityService,
  RunDocumentInput,
} from '../services/document-quality.service.js';
import type { DocumentQualityGateSummary } from '@ctrl-freaq/shared-data';
import { resolveEventStream } from '../event-stream-utils.js';

interface RunDocumentBody {
  reason?: RunDocumentInput['source'];
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

const serializeSummary = (summary: DocumentQualityGateSummary) => ({
  documentId: summary.documentId,
  statusCounts: summary.statusCounts,
  blockerSections: summary.blockerSections,
  warningSections: summary.warningSections,
  lastRunAt: summary.lastRunAt ? summary.lastRunAt.toISOString() : null,
  triggeredBy: summary.triggeredBy,
  requestId: summary.requestId,
  publishBlocked: summary.publishBlocked,
  coverageGaps: summary.coverageGaps,
  createdAt: summary.createdAt.toISOString(),
  updatedAt: summary.updatedAt.toISOString(),
});

export class DocumentQualityController {
  constructor(
    private readonly service: DocumentQualityService,
    private readonly logger: Logger
  ) {}

  private publishDocumentProgress(
    req: AuthenticatedRequest,
    documentId: string,
    payload: {
      runId: string;
      requestId: string;
      triggeredBy: string;
      stage: string;
      status: 'running' | 'failed';
      percentComplete?: number;
      incidentId?: string | null;
    }
  ): void {
    const resolved = resolveEventStream(req, {
      logger: this.logger,
      context: { documentId, stage: payload.stage },
    });
    if (!resolved) {
      return;
    }

    try {
      resolved.broker.publish({
        workspaceId: resolved.workspaceId,
        topic: 'quality-gate.progress',
        resourceId: documentId,
        payload: {
          runId: payload.runId,
          documentId,
          sectionId: null,
          status: payload.status,
          stage: payload.stage,
          percentComplete:
            typeof payload.percentComplete === 'number'
              ? payload.percentComplete
              : payload.status === 'running'
                ? 0
                : 100,
          incidentId: payload.incidentId ?? null,
          triggeredBy: payload.triggeredBy,
          requestId: payload.requestId,
        },
        metadata: {
          requestId: payload.requestId,
          stage: payload.stage,
          status: payload.status,
        },
      });
    } catch (error) {
      this.logger.warn(
        {
          requestId: req.requestId,
          documentId,
          stage: payload.stage,
          error: error instanceof Error ? error.message : 'Unknown error',
        },
        'Failed to publish document quality gate progress event'
      );
    }
  }

  private async publishDocumentSummary(
    req: AuthenticatedRequest,
    documentId: string,
    triggeredBy: string
  ): Promise<void> {
    const resolved = resolveEventStream(req, {
      logger: this.logger,
      context: { documentId, stage: 'document.summary' },
    });
    if (!resolved) {
      return;
    }

    try {
      const summary = await this.service.getSummary(documentId);
      if (!summary) {
        return;
      }

      const serialized = serializeSummary(summary);
      resolved.broker.publish({
        workspaceId: resolved.workspaceId,
        topic: 'quality-gate.summary',
        resourceId: documentId,
        payload: {
          ...serialized,
          status: 'completed' as const,
        },
        metadata: {
          requestId: serialized.requestId ?? 'unknown',
          triggeredBy,
        },
      });
    } catch (error) {
      this.logger.warn(
        {
          requestId: req.requestId,
          documentId,
          error: error instanceof Error ? error.message : 'Unknown error',
        },
        'Failed to publish document quality gate summary event'
      );
    }
  }

  async runDocument(req: AuthenticatedRequest, res: Response): Promise<void> {
    const requestId = req.requestId ?? 'unknown';
    const { documentId } = req.params as { documentId?: string };
    const body = (req.body ?? {}) as RunDocumentBody;

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
        message: 'Authentication required to run quality gates',
        requestId,
      });
      return;
    }

    const runInput: RunDocumentInput = {
      documentId,
      triggeredBy,
      source: (body.reason ?? 'dashboard') as RunDocumentInput['source'],
    };

    this.logger.info(
      {
        requestId,
        documentId,
        source: runInput.source,
        triggeredBy,
      },
      'Document quality gate run requested'
    );

    const result = await this.service.runDocument(runInput);

    if (result.status === 'failed') {
      this.logger.warn(
        {
          requestId,
          documentId,
          incidentId: result.incidentId,
        },
        'Document quality gate run failed'
      );

      this.publishDocumentProgress(req, documentId, {
        runId: result.requestId,
        requestId: result.requestId,
        triggeredBy,
        stage: 'document.failed',
        status: 'failed',
        percentComplete: 0,
        incidentId: result.incidentId ?? null,
      });

      sendError(res, {
        status: 503,
        code: 'QUALITY_GATE_UNAVAILABLE',
        message: result.error,
        requestId,
        details: result.incidentId ? { incidentId: result.incidentId } : undefined,
      });
      return;
    }

    res.status(202).json({
      documentId,
      requestId: result.requestId,
      status: result.status,
      triggeredBy: result.triggeredBy,
      queuedAt: result.queuedAt,
      estimatedCompletionSeconds: result.estimatedCompletionSeconds,
    });

    this.publishDocumentProgress(req, documentId, {
      runId: result.requestId,
      requestId: result.requestId,
      triggeredBy: result.triggeredBy,
      stage: 'document.running',
      status: 'running',
    });

    await this.publishDocumentSummary(req, documentId, result.triggeredBy);
  }

  async getSummary(req: AuthenticatedRequest, res: Response): Promise<void> {
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

    const summary = await this.service.getSummary(documentId);

    if (!summary) {
      sendError(res, {
        status: 404,
        code: 'NOT_FOUND',
        message: `No quality gate summary found for document ${documentId}`,
        requestId,
      });
      return;
    }

    this.logger.debug(
      {
        requestId,
        documentId,
        publishBlocked: summary.publishBlocked,
      },
      'Document quality gate summary retrieved'
    );

    res.status(200).json(serializeSummary(summary));
  }
}
