import { Router, type Response } from 'express';
import type { Router as ExpressRouter } from 'express';
import { z } from 'zod';
import type { Logger } from 'pino';

import type { AuthenticatedRequest } from '../middleware/auth.js';

export const activitiesRouter: ExpressRouter = Router();

const QuerySchema = z.object({
  limit: z
    .string()
    .transform(v => Number(v))
    .pipe(z.number().int().min(1).max(50))
    .optional(),
});

activitiesRouter.get(
  '/activities',
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const logger = req.services?.get('logger') as Logger | undefined;

    const parsed = QuerySchema.safeParse(req.query);
    if (!parsed.success) {
      res.status(400).json({
        error: 'VALIDATION_ERROR',
        message: 'Invalid query parameters',
        requestId: req.requestId || 'unknown',
        timestamp: new Date().toISOString(),
        details: parsed.error.format(),
      });
      return;
    }

    const payload = {
      activities: [] as unknown[],
      total: 0,
    };

    logger?.info(
      { requestId: req.requestId, userId: req.user?.userId },
      'Activities returned (MVP empty)'
    );
    res.status(200).json(payload);
  }
);

export default activitiesRouter;
