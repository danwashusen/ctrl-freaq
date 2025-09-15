import { Router, type Response } from 'express';
import type { Router as ExpressRouter } from 'express';
import { z } from 'zod';
import type { Logger } from 'pino';

import type { AuthenticatedRequest } from '../middleware/auth.js';

export const projectSelectionRouter: ExpressRouter = Router();

const ParamsSchema = z.object({
  projectId: z.string().uuid(),
});

projectSelectionRouter.post(
  '/projects/:projectId/select',
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const logger = req.services?.get('logger') as Logger | undefined;
    const params = ParamsSchema.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({
        error: 'VALIDATION_ERROR',
        message: 'Invalid project ID',
        requestId: req.requestId || 'unknown',
        timestamp: new Date().toISOString(),
        details: params.error.format(),
      });
      return;
    }

    const { projectId } = params.data;

    // MVP: Accept valid UUID and return 204 (ownership checks to be added with repository methods)
    logger?.info(
      { requestId: req.requestId, userId: req.user?.userId, projectId },
      'Project selected (MVP no-op)'
    );
    res.status(204).send();
  }
);

export default projectSelectionRouter;
