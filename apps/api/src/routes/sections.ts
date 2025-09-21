import { Router } from 'express';
import type { Response } from 'express';
import type { Logger } from 'pino';

import type { AuthenticatedRequest } from '../middleware/auth.js';
import {
  clerkAuthMiddleware,
  requireAuth,
  logAuthEvent,
  createUserRateLimit,
} from '../middleware/auth.js';
import type { SectionRepository, PendingChangeRepository } from '@ctrl-freaq/shared-data';

export const sectionsRouter: Router = Router();

// Apply authentication middleware to all routes
sectionsRouter.use(clerkAuthMiddleware);
sectionsRouter.use(requireAuth);
sectionsRouter.use(logAuthEvent('access'));

// Apply rate limiting for save operations (10 per minute per user)
const saveRateLimit = createUserRateLimit(60 * 1000, 10);

// T037: GET /api/v1/documents/{docId}/sections endpoint
sectionsRouter.get(
  '/documents/:docId/sections',
  async (req: AuthenticatedRequest, res: Response) => {
    const logger = req.services?.get('logger') as Logger | undefined;
    const docId = req.params.docId;
    const requestId = req.requestId ?? 'unknown';

    try {
      if (!docId) {
        res.status(400).json({
          code: 'BAD_REQUEST',
          message: 'Document ID is required',
          requestId,
          timestamp: new Date().toISOString(),
        });
        return;
      }

      logger?.info(
        {
          requestId,
          docId,
          userId: req.user?.userId,
        },
        'Fetching document sections'
      );

      const sectionRepository = req.services?.get('sectionRepository') as SectionRepository;
      if (!sectionRepository) {
        throw new Error('Section repository not available');
      }

      const sections = await sectionRepository.findByDocumentId(docId);
      const toc = await sectionRepository.generateTableOfContents(docId);

      // Convert dates to ISO strings for JSON response
      const serializedSections = sections.map(section => ({
        ...section,
        lastModified: section.lastModified.toISOString(),
        createdAt: section.createdAt.toISOString(),
        updatedAt: section.updatedAt.toISOString(),
      }));

      const serializedToc = {
        ...toc,
        lastUpdated: toc.lastUpdated.toISOString(),
      };

      res.status(200).json({
        sections: serializedSections,
        toc: serializedToc,
      });
    } catch (error) {
      logger?.error(
        {
          requestId,
          docId,
          error: error instanceof Error ? error.message : 'Unknown error',
        },
        'Error fetching document sections'
      );

      res.status(500).json({
        code: 'INTERNAL_ERROR',
        message: 'Failed to fetch document sections',
        requestId,
        timestamp: new Date().toISOString(),
      });
    }
  }
);

// T038: GET /api/v1/sections/{sectionId} endpoint
sectionsRouter.get('/sections/:sectionId', async (req: AuthenticatedRequest, res: Response) => {
  const logger = req.services?.get('logger') as Logger | undefined;
  const sectionId = req.params.sectionId;
  const requestId = req.requestId ?? 'unknown';

  try {
    if (!sectionId) {
      res.status(400).json({
        code: 'BAD_REQUEST',
        message: 'Section ID is required',
        requestId,
        timestamp: new Date().toISOString(),
      });
      return;
    }

    logger?.info(
      {
        requestId,
        sectionId,
        userId: req.user?.userId,
      },
      'Fetching section details'
    );

    const sectionRepository = req.services?.get('sectionRepository') as SectionRepository;
    if (!sectionRepository) {
      throw new Error('Section repository not available');
    }

    const section = await sectionRepository.findById(sectionId);

    if (!section) {
      res.status(404).json({
        code: 'NOT_FOUND',
        message: 'Section not found',
        requestId,
        timestamp: new Date().toISOString(),
      });
      return;
    }

    // Convert dates to ISO strings for JSON response
    const serializedSection = {
      ...section,
      lastModified: section.lastModified.toISOString(),
      createdAt: section.createdAt.toISOString(),
      updatedAt: section.updatedAt.toISOString(),
    };

    res.status(200).json(serializedSection);
  } catch (error) {
    logger?.error(
      {
        requestId,
        sectionId,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      'Error fetching section details'
    );

    res.status(500).json({
      code: 'INTERNAL_ERROR',
      message: 'Failed to fetch section details',
      requestId,
      timestamp: new Date().toISOString(),
    });
  }
});

// T039: PATCH /api/v1/sections/{sectionId} endpoint
sectionsRouter.patch('/sections/:sectionId', async (req: AuthenticatedRequest, res: Response) => {
  const logger = req.services?.get('logger') as Logger | undefined;
  const sectionId = req.params.sectionId;
  const { viewState } = req.body;
  const requestId = req.requestId ?? 'unknown';

  try {
    if (!sectionId) {
      res.status(400).json({
        code: 'BAD_REQUEST',
        message: 'Section ID is required',
        requestId,
        timestamp: new Date().toISOString(),
      });
      return;
    }
    logger?.info(
      {
        requestId,
        sectionId,
        viewState,
        userId: req.user?.userId,
      },
      'Updating section view state'
    );

    if (!viewState || !['idle', 'read_mode', 'edit_mode', 'saving'].includes(viewState)) {
      res.status(400).json({
        code: 'BAD_REQUEST',
        message: 'Invalid viewState. Must be one of: idle, read_mode, edit_mode, saving',
        requestId,
        timestamp: new Date().toISOString(),
      });
      return;
    }

    const sectionRepository = req.services?.get('sectionRepository') as SectionRepository;
    if (!sectionRepository) {
      throw new Error('Section repository not available');
    }

    await sectionRepository.updateViewState(sectionId, viewState);

    // Update editing user if entering edit mode
    if (viewState === 'edit_mode') {
      await sectionRepository.update(sectionId, {
        editingUser: req.user?.userId || null,
      });
    } else if (viewState === 'read_mode' || viewState === 'idle') {
      await sectionRepository.update(sectionId, {
        editingUser: null,
      });
    }

    // Get updated section
    const updatedSection = await sectionRepository.findById(sectionId);
    if (!updatedSection) {
      res.status(404).json({
        code: 'NOT_FOUND',
        message: 'Section not found after update',
        requestId,
        timestamp: new Date().toISOString(),
      });
      return;
    }

    // Convert dates to ISO strings for JSON response
    const serializedSection = {
      ...updatedSection,
      lastModified: updatedSection.lastModified.toISOString(),
      createdAt: updatedSection.createdAt.toISOString(),
      updatedAt: updatedSection.updatedAt.toISOString(),
    };

    res.status(200).json(serializedSection);
  } catch (error) {
    logger?.error(
      {
        requestId,
        sectionId,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      'Error updating section view state'
    );

    res.status(500).json({
      code: 'INTERNAL_ERROR',
      message: 'Failed to update section view state',
      requestId,
      timestamp: new Date().toISOString(),
    });
  }
});

// GET /api/v1/sections/{sectionId}/pending-changes endpoint
sectionsRouter.get(
  '/sections/:sectionId/pending-changes',
  async (req: AuthenticatedRequest, res: Response) => {
    const logger = req.services?.get('logger') as Logger | undefined;
    const sectionId = req.params.sectionId;
    const requestId = req.requestId ?? 'unknown';

    try {
      if (!sectionId) {
        res.status(400).json({
          code: 'BAD_REQUEST',
          message: 'Section ID is required',
          requestId,
          timestamp: new Date().toISOString(),
        });
        return;
      }

      logger?.info(
        {
          requestId,
          sectionId,
          userId: req.user?.userId,
        },
        'Fetching pending changes for section'
      );

      const pendingChangeRepository = req.services?.get(
        'pendingChangeRepository'
      ) as PendingChangeRepository;
      if (!pendingChangeRepository) {
        throw new Error('Pending change repository not available');
      }

      const pendingChanges = await pendingChangeRepository.findBySectionId(sectionId);

      // Convert dates to ISO strings for JSON response
      const serializedChanges = pendingChanges.map(change => ({
        ...change,
        createdAt: change.createdAt.toISOString(),
        updatedAt: change.updatedAt.toISOString(),
      }));

      res.status(200).json({
        changes: serializedChanges,
      });
    } catch (error) {
      logger?.error(
        {
          requestId,
          sectionId,
          error: error instanceof Error ? error.message : 'Unknown error',
        },
        'Error fetching pending changes'
      );

      res.status(500).json({
        code: 'INTERNAL_ERROR',
        message: 'Failed to fetch pending changes',
        requestId,
        timestamp: new Date().toISOString(),
      });
    }
  }
);

// T040: POST /api/v1/sections/{sectionId}/pending-changes endpoint
sectionsRouter.post(
  '/sections/:sectionId/pending-changes',
  async (req: AuthenticatedRequest, res: Response) => {
    const logger = req.services?.get('logger') as Logger | undefined;
    const sectionId = req.params.sectionId;
    const { patches, originalContent, previewContent } = req.body;
    const requestId = req.requestId ?? 'unknown';

    try {
      if (!sectionId) {
        res.status(400).json({
          code: 'BAD_REQUEST',
          message: 'Section ID is required',
          requestId,
          timestamp: new Date().toISOString(),
        });
        return;
      }
      logger?.info(
        {
          requestId,
          sectionId,
          patchCount: patches?.length || 0,
          userId: req.user?.userId,
        },
        'Creating pending changes'
      );

      if (!patches || !Array.isArray(patches) || patches.length === 0) {
        res.status(400).json({
          code: 'BAD_REQUEST',
          message: 'patches array is required and must not be empty',
          requestId,
          timestamp: new Date().toISOString(),
        });
        return;
      }

      if (typeof originalContent !== 'string' || typeof previewContent !== 'string') {
        res.status(400).json({
          code: 'BAD_REQUEST',
          message: 'originalContent and previewContent are required strings',
          requestId,
          timestamp: new Date().toISOString(),
        });
        return;
      }

      const pendingChangeRepository = req.services?.get(
        'pendingChangeRepository'
      ) as PendingChangeRepository;
      const sectionRepository = req.services?.get('sectionRepository') as SectionRepository;

      if (!pendingChangeRepository || !sectionRepository) {
        throw new Error('Required repositories not available');
      }

      // Get section to validate it exists and get document ID
      const section = await sectionRepository.findById(sectionId);
      if (!section) {
        res.status(404).json({
          code: 'NOT_FOUND',
          message: 'Section not found',
          requestId,
          timestamp: new Date().toISOString(),
        });
        return;
      }

      const pendingChange = await pendingChangeRepository.create({
        sectionId,
        documentId: section.docId,
        patches,
        originalContent,
        previewContent,
        createdBy: req.user?.userId || 'unknown',
        sessionId: (req as { sessionID?: string }).sessionID || 'unknown',
        status: 'pending' as const,
        conflictsWith: [],
      });

      // Convert dates to ISO strings for JSON response
      const serializedPendingChange = {
        ...pendingChange,
        createdAt: pendingChange.createdAt.toISOString(),
        updatedAt: pendingChange.updatedAt.toISOString(),
      };

      res.status(201).json(serializedPendingChange);
    } catch (error) {
      logger?.error(
        {
          requestId,
          sectionId,
          error: error instanceof Error ? error.message : 'Unknown error',
        },
        'Error creating pending changes'
      );

      res.status(500).json({
        code: 'INTERNAL_ERROR',
        message: 'Failed to create pending changes',
        requestId,
        timestamp: new Date().toISOString(),
      });
    }
  }
);

// T041: POST /api/v1/sections/{sectionId}/save endpoint
sectionsRouter.post(
  '/sections/:sectionId/save',
  saveRateLimit, // Apply rate limiting to save operations
  async (req: AuthenticatedRequest, res: Response) => {
    const logger = req.services?.get('logger') as Logger | undefined;
    const sectionId = req.params.sectionId;
    const { changeIds } = req.body;
    const requestId = req.requestId ?? 'unknown';

    try {
      if (!sectionId) {
        res.status(400).json({
          code: 'BAD_REQUEST',
          message: 'Section ID is required',
          requestId,
          timestamp: new Date().toISOString(),
        });
        return;
      }
      logger?.info(
        {
          requestId,
          sectionId,
          changeCount: changeIds?.length || 0,
          userId: req.user?.userId,
        },
        'Saving section changes'
      );

      if (!changeIds || !Array.isArray(changeIds) || changeIds.length === 0) {
        res.status(400).json({
          code: 'BAD_REQUEST',
          message: 'changeIds array is required and must not be empty',
          requestId,
          timestamp: new Date().toISOString(),
        });
        return;
      }

      const sectionRepository = req.services?.get('sectionRepository') as SectionRepository;
      const pendingChangeRepository = req.services?.get(
        'pendingChangeRepository'
      ) as PendingChangeRepository;

      if (!sectionRepository || !pendingChangeRepository) {
        throw new Error('Required repositories not available');
      }

      // Get the pending changes to apply
      const pendingChanges = await Promise.all(
        changeIds.map(id => pendingChangeRepository.findById(id))
      );

      // Check if all changes exist and belong to this section
      for (const change of pendingChanges) {
        if (!change) {
          res.status(400).json({
            code: 'BAD_REQUEST',
            message: 'One or more pending changes not found',
            requestId,
            timestamp: new Date().toISOString(),
          });
          return;
        }
        if (change.sectionId !== sectionId) {
          res.status(400).json({
            code: 'BAD_REQUEST',
            message: 'Pending change does not belong to this section',
            requestId,
            timestamp: new Date().toISOString(),
          });
          return;
        }
      }

      // Apply changes (simplified - in production would need proper merge logic)
      const validChanges = pendingChanges.filter(Boolean);
      if (validChanges.length > 0) {
        const latestChange = validChanges[validChanges.length - 1];
        if (latestChange) {
          await sectionRepository.updateContent(sectionId, latestChange.previewContent);
        }

        // Mark changes as applied
        await Promise.all(changeIds.map(id => pendingChangeRepository.markAsApplied(id)));
      }

      // Get updated section
      const updatedSection = await sectionRepository.findById(sectionId);
      if (!updatedSection) {
        res.status(500).json({
          code: 'INTERNAL_ERROR',
          message: 'Failed to retrieve updated section',
          requestId,
          timestamp: new Date().toISOString(),
        });
        return;
      }

      // Convert dates to ISO strings for JSON response
      const serializedSection = {
        ...updatedSection,
        lastModified: updatedSection.lastModified.toISOString(),
        createdAt: updatedSection.createdAt.toISOString(),
        updatedAt: updatedSection.updatedAt.toISOString(),
      };

      res.status(200).json({
        section: serializedSection,
        appliedChanges: changeIds,
      });
    } catch (error) {
      logger?.error(
        {
          requestId,
          sectionId,
          error: error instanceof Error ? error.message : 'Unknown error',
        },
        'Error saving section changes'
      );

      res.status(500).json({
        code: 'INTERNAL_ERROR',
        message: 'Failed to save section changes',
        requestId,
        timestamp: new Date().toISOString(),
      });
    }
  }
);

// T042: GET /api/v1/documents/{docId}/toc endpoint
sectionsRouter.get('/documents/:docId/toc', async (req: AuthenticatedRequest, res: Response) => {
  const logger = req.services?.get('logger') as Logger | undefined;
  const docId = req.params.docId;
  const requestId = req.requestId ?? 'unknown';

  try {
    if (!docId) {
      res.status(400).json({
        code: 'BAD_REQUEST',
        message: 'Document ID is required',
        requestId,
        timestamp: new Date().toISOString(),
      });
      return;
    }
    logger?.info(
      {
        requestId,
        docId,
        userId: req.user?.userId,
      },
      'Fetching table of contents'
    );

    const sectionRepository = req.services?.get('sectionRepository') as SectionRepository;
    if (!sectionRepository) {
      throw new Error('Section repository not available');
    }

    const toc = await sectionRepository.generateTableOfContents(docId);

    // Convert dates to ISO strings for JSON response
    const serializedToc = {
      ...toc,
      lastUpdated: toc.lastUpdated.toISOString(),
    };

    res.status(200).json(serializedToc);
  } catch (error) {
    logger?.error(
      {
        requestId,
        docId,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      'Error fetching table of contents'
    );

    res.status(500).json({
      code: 'INTERNAL_ERROR',
      message: 'Failed to fetch table of contents',
      requestId,
      timestamp: new Date().toISOString(),
    });
  }
});

export default sectionsRouter;
