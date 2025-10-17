import type { Response } from 'express';
import type { Logger } from 'pino';

import type { AuthenticatedRequest } from '../../../middleware/auth.js';
import type {
  RunSectionInput,
  SectionQualityService,
} from '../services/section-quality.service.js';
import type { SectionQualityGateResult } from '@ctrl-freaq/shared-data';

interface RunSectionBody {
  reason?: RunSectionInput['source'];
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

const serializeSectionResult = (result: SectionQualityGateResult) => ({
  sectionId: result.sectionId,
  documentId: result.documentId,
  runId: result.runId,
  status: result.status,
  rules: result.rules,
  lastRunAt: result.lastRunAt ? result.lastRunAt.toISOString() : null,
  lastSuccessAt: result.lastSuccessAt ? result.lastSuccessAt.toISOString() : null,
  triggeredBy: result.triggeredBy,
  source: result.source,
  durationMs: result.durationMs,
  remediationState: result.remediationState,
  incidentId: result.incidentId ?? null,
  createdAt: result.createdAt.toISOString(),
  updatedAt: result.updatedAt.toISOString(),
});

export class SectionQualityController {
  constructor(
    private readonly service: SectionQualityService,
    private readonly logger: Logger
  ) {}

  async runSection(req: AuthenticatedRequest, res: Response): Promise<void> {
    const requestId = req.requestId ?? 'unknown';
    const { documentId, sectionId } = req.params as {
      documentId?: string;
      sectionId?: string;
    };
    const body = (req.body ?? {}) as RunSectionBody;

    if (!sectionId) {
      sendError(res, {
        status: 400,
        code: 'BAD_REQUEST',
        message: 'sectionId parameter is required',
        requestId,
      });
      return;
    }

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

    const runInput: RunSectionInput = {
      sectionId,
      documentId,
      triggeredBy,
      source: (body.reason ?? 'manual') as RunSectionInput['source'],
    };

    this.logger.info(
      {
        requestId,
        sectionId,
        documentId,
        source: runInput.source,
        triggeredBy,
      },
      'Section quality gate run requested'
    );

    const result = await this.service.runSection(runInput);

    if (result.status === 'failed') {
      this.logger.warn(
        {
          requestId,
          sectionId,
          documentId,
          incidentId: result.incidentId,
        },
        'Section quality gate run failed'
      );

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
      requestId: result.requestId,
      status: result.status,
      runId: result.runId,
      sectionId,
      documentId,
      triggeredBy: result.triggeredBy,
      receivedAt: new Date().toISOString(),
    });
  }

  async getLatestResult(req: AuthenticatedRequest, res: Response): Promise<void> {
    const requestId = req.requestId ?? 'unknown';
    const { documentId, sectionId } = req.params as {
      documentId?: string;
      sectionId?: string;
    };

    if (!sectionId) {
      sendError(res, {
        status: 400,
        code: 'BAD_REQUEST',
        message: 'sectionId parameter is required',
        requestId,
      });
      return;
    }

    if (!documentId) {
      sendError(res, {
        status: 400,
        code: 'BAD_REQUEST',
        message: 'documentId parameter is required',
        requestId,
      });
      return;
    }

    const result = await this.service.getLatestResult(sectionId);

    if (!result) {
      sendError(res, {
        status: 404,
        code: 'NOT_FOUND',
        message: `No quality gate result found for section ${sectionId}`,
        requestId,
      });
      return;
    }

    if (result.documentId !== documentId) {
      sendError(res, {
        status: 404,
        code: 'NOT_FOUND',
        message: `No quality gate result found for section ${sectionId} in document ${documentId}`,
        requestId,
      });
      return;
    }

    this.logger.debug(
      {
        requestId,
        sectionId,
        documentId: result.documentId,
        status: result.status,
      },
      'Section quality gate result retrieved'
    );

    res.status(200).json(serializeSectionResult(result));
  }
}
