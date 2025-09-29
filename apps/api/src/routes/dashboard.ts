import { Router, type Response } from 'express';
import type { Router as ExpressRouter } from 'express';
import { z } from 'zod';
import type { Logger } from 'pino';

import type { AuthenticatedRequest } from '../middleware/auth.js';

export const dashboardRouter: ExpressRouter = Router();

// Minimal shapes aligned with OpenAPI examples used by UI
const MemberAvatarSchema = z.object({
  userId: z.string().optional(),
  imageUrl: z.string().url().optional(),
  name: z.string().optional(),
});

const ProjectListItemSchema = z.object({
  id: z.string().uuid(),
  ownerUserId: z.string(),
  name: z.string().min(1),
  slug: z.string().regex(/^[a-z0-9-]+$/),
  description: z.string().max(500).nullable().optional(),
  memberAvatars: z.array(MemberAvatarSchema).optional(),
  lastModified: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

const ActivityItemSchema = z.object({
  id: z.string().uuid(),
  projectId: z.string().uuid(),
  projectName: z.string(),
  userId: z.string(),
  userAvatar: z.string().url(),
  userName: z.string(),
  type: z.enum([
    'document_created',
    'document_updated',
    'document_published',
    'member_added',
    'member_removed',
  ]),
  description: z.string().max(255),
  metadata: z.record(z.string(), z.any()).optional(),
  createdAt: z.string(),
});

const DashboardResponseSchema = z.object({
  projects: z.array(ProjectListItemSchema),
  activities: z.array(ActivityItemSchema),
  stats: z.object({
    totalProjects: z.number().int().min(0),
    recentActivityCount: z.number().int().min(0).optional(),
  }),
});

dashboardRouter.get(
  '/dashboard',
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const logger = req.services?.get('logger') as Logger | undefined;
    const userId = req.user?.userId;

    // Basic authenticated route shape per spec; data integration follows in core tasks
    const payload = {
      projects: [],
      activities: [],
      stats: {
        totalProjects: 0,
        recentActivityCount: 0,
      },
    };

    // Validate outgoing shape (defensive)
    const result = DashboardResponseSchema.safeParse(payload);
    if (!result.success) {
      logger?.error(
        { requestId: req.requestId, userId, error: result.error },
        'Invalid dashboard response shape'
      );
      res.status(500).json({
        error: 'INTERNAL_ERROR',
        message: 'Failed to build dashboard data',
        requestId: req.requestId || 'unknown',
        timestamp: new Date().toISOString(),
      });
      return;
    }

    logger?.info({ requestId: req.requestId, userId }, 'Dashboard data returned');
    res.status(200).json(result.data);
  }
);

export default dashboardRouter;
