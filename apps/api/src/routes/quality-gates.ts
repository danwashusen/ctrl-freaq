import { Router as createRouter, type Response } from 'express';
import type { Router } from 'express';
import type { Logger } from 'pino';

import { SectionQualityController } from '../modules/quality-gates/controllers/section-quality.controller.js';
import type { SectionQualityService } from '../modules/quality-gates/services/section-quality.service.js';
import { DocumentQualityController } from '../modules/quality-gates/controllers/document-quality.controller.js';
import { TraceabilityController } from '../modules/quality-gates/controllers/traceability.controller.js';
import type { DocumentQualityService } from '../modules/quality-gates/services/document-quality.service.js';
import type { AuthenticatedRequest } from '../middleware/auth.js';
import type { TraceabilitySyncService } from '@ctrl-freaq/qa/traceability';

export const qualityGatesRouter: Router = createRouter();

const sendServiceUnavailable = (req: AuthenticatedRequest, res: Response, message: string) => {
  res.status(500).json({
    code: 'SERVICE_UNAVAILABLE',
    message,
    requestId: req.requestId ?? 'unknown',
    timestamp: new Date().toISOString(),
  });
};

qualityGatesRouter.post(
  '/documents/:documentId/sections/:sectionId/quality-gates/run',
  async (req: AuthenticatedRequest, res, next) => {
    try {
      const logger = req.services?.get('logger') as Logger | undefined;
      let service: SectionQualityService | undefined;
      try {
        service = req.services?.get('sectionQualityService') as SectionQualityService;
      } catch (error) {
        logger?.error({ err: error }, 'failed to resolve sectionQualityService');
        next(error);
        return;
      }

      if (!logger || !service) {
        sendServiceUnavailable(
          req,
          res,
          'Section quality service dependencies unavailable; check container wiring'
        );
        return;
      }

      const controller = new SectionQualityController(service, logger);
      await controller.runSection(req, res);
    } catch (error) {
      next(error);
    }
  }
);

qualityGatesRouter.get(
  '/documents/:documentId/sections/:sectionId/quality-gates/result',
  async (req: AuthenticatedRequest, res, next) => {
    try {
      const logger = req.services?.get('logger') as Logger | undefined;
      const service = req.services?.get('sectionQualityService') as
        | SectionQualityService
        | undefined;

      if (!logger || !service) {
        sendServiceUnavailable(
          req,
          res,
          'Section quality service dependencies unavailable; check container wiring'
        );
        return;
      }

      const controller = new SectionQualityController(service, logger);
      await controller.getLatestResult(req, res);
    } catch (error) {
      next(error);
    }
  }
);

qualityGatesRouter.post(
  '/documents/:documentId/quality-gates/run',
  async (req: AuthenticatedRequest, res, next) => {
    try {
      const logger = req.services?.get('logger') as Logger | undefined;
      let service: DocumentQualityService | undefined;

      try {
        service = req.services?.get('documentQualityService') as DocumentQualityService;
      } catch (error) {
        logger?.error({ err: error }, 'failed to resolve documentQualityService');
        next(error);
        return;
      }

      if (!logger || !service) {
        sendServiceUnavailable(
          req,
          res,
          'Document quality service dependencies unavailable; check container wiring'
        );
        return;
      }

      const controller = new DocumentQualityController(service, logger);
      await controller.runDocument(req, res);
    } catch (error) {
      next(error);
    }
  }
);

qualityGatesRouter.get(
  '/documents/:documentId/quality-gates/summary',
  async (req: AuthenticatedRequest, res, next) => {
    try {
      const logger = req.services?.get('logger') as Logger | undefined;
      const service = req.services?.get('documentQualityService') as
        | DocumentQualityService
        | undefined;

      if (!logger || !service) {
        sendServiceUnavailable(
          req,
          res,
          'Document quality service dependencies unavailable; check container wiring'
        );
        return;
      }

      const controller = new DocumentQualityController(service, logger);
      await controller.getSummary(req, res);
    } catch (error) {
      next(error);
    }
  }
);

qualityGatesRouter.get(
  '/documents/:documentId/traceability',
  async (req: AuthenticatedRequest, res, next) => {
    try {
      const logger = req.services?.get('logger') as Logger | undefined;
      let service: TraceabilitySyncService | undefined;

      try {
        service = req.services?.get('traceabilitySyncService') as TraceabilitySyncService;
      } catch (error) {
        logger?.error({ err: error }, 'failed to resolve traceabilitySyncService');
        next(error);
        return;
      }

      if (!logger || !service) {
        sendServiceUnavailable(
          req,
          res,
          'Traceability service dependencies unavailable; check container wiring'
        );
        return;
      }

      const controller = new TraceabilityController(service, logger);
      await controller.getMatrix(req, res);
    } catch (error) {
      next(error);
    }
  }
);

qualityGatesRouter.post(
  '/documents/:documentId/traceability/orphans',
  async (req: AuthenticatedRequest, res, next) => {
    try {
      const logger = req.services?.get('logger') as Logger | undefined;
      let service: TraceabilitySyncService | undefined;

      try {
        service = req.services?.get('traceabilitySyncService') as TraceabilitySyncService;
      } catch (error) {
        logger?.error({ err: error }, 'failed to resolve traceabilitySyncService');
        next(error);
        return;
      }

      if (!logger || !service) {
        sendServiceUnavailable(
          req,
          res,
          'Traceability service dependencies unavailable; check container wiring'
        );
        return;
      }

      const controller = new TraceabilityController(service, logger);
      await controller.markOrphaned(req, res);
    } catch (error) {
      next(error);
    }
  }
);
