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
import type { EditorSessionRepository } from '@ctrl-freaq/shared-data';

export const sessionsRouter: Router = Router();

// Apply authentication middleware to all routes
sessionsRouter.use(clerkAuthMiddleware);
sessionsRouter.use(requireAuth);
sessionsRouter.use(logAuthEvent('access'));

// Apply rate limiting for session updates (30 per minute per user)
const sessionRateLimit = createUserRateLimit(60 * 1000, 30);

// T043: GET /api/v1/documents/{docId}/editor-session endpoint
sessionsRouter.get(
  '/documents/:docId/editor-session',
  async (req: AuthenticatedRequest, res: Response) => {
    const logger = req.services?.get('logger') as Logger | undefined;
    const docId = req.params.docId;
    const requestId = req.requestId ?? 'unknown';

    try {
      logger?.info(
        {
          requestId,
          docId,
          userId: req.user?.userId,
        },
        'Fetching editor session'
      );

      const editorSessionRepository = req.services?.get(
        'editorSessionRepository'
      ) as EditorSessionRepository;
      if (!editorSessionRepository) {
        throw new Error('Editor session repository not available');
      }

      if (!docId) {
        res.status(400).json({
          code: 'BAD_REQUEST',
          message: 'Document ID is required',
          requestId,
          timestamp: new Date().toISOString(),
        });
        return;
      }

      const userId = req.user?.userId;
      if (!userId) {
        res.status(401).json({
          code: 'UNAUTHORIZED',
          message: 'User ID is required',
          requestId,
          timestamp: new Date().toISOString(),
        });
        return;
      }

      let session = await editorSessionRepository.findByDocumentAndUser(docId, userId);

      if (!session) {
        // Create default session if none exists
        session = await editorSessionRepository.create({
          documentId: docId,
          userId,
          sessionId: (req as { sessionID?: string }).sessionID || 'unknown',
          activeSectionId: null,
          expandedSections: [],
          scrollPosition: 0,
          editorMode: 'wysiwyg',
          showDiffView: false,
          autoSaveEnabled: true,
          autoSaveInterval: 30000,
          collaborators: [],
          lastSaveTime: 0,
          pendingChangeCount: 0,
        });
      }

      // Convert dates to ISO strings for JSON response
      const serializedSession = {
        ...session,
        createdAt: session.createdAt.toISOString(),
        updatedAt: session.updatedAt.toISOString(),
        collaborators: session.collaborators.map(c => ({
          ...c,
          lastActivity: c.lastActivity.toISOString(),
        })),
      };

      res.status(200).json(serializedSession);
    } catch (error) {
      logger?.error(
        {
          requestId,
          docId,
          error: error instanceof Error ? error.message : 'Unknown error',
        },
        'Error fetching editor session'
      );

      res.status(500).json({
        code: 'INTERNAL_ERROR',
        message: 'Failed to fetch editor session',
        requestId,
        timestamp: new Date().toISOString(),
      });
    }
  }
);

// T044: PUT /api/v1/documents/{docId}/editor-session endpoint
sessionsRouter.put(
  '/documents/:docId/editor-session',
  sessionRateLimit, // Apply rate limiting to session updates
  async (req: AuthenticatedRequest, res: Response) => {
    const logger = req.services?.get('logger') as Logger | undefined;
    const docId = req.params.docId;
    const requestId = req.requestId ?? 'unknown';

    const {
      activeSectionId,
      expandedSections,
      scrollPosition,
      editorMode,
      showDiffView,
      autoSaveEnabled,
      autoSaveInterval,
    } = req.body;

    try {
      logger?.info(
        {
          requestId,
          docId,
          userId: req.user?.userId,
          activeSectionId,
          editorMode,
        },
        'Updating editor session'
      );

      // Validate request body
      if (editorMode && !['wysiwyg', 'markdown', 'preview'].includes(editorMode)) {
        res.status(400).json({
          code: 'BAD_REQUEST',
          message: 'Invalid editorMode. Must be one of: wysiwyg, markdown, preview',
          requestId,
          timestamp: new Date().toISOString(),
        });
        return;
      }

      if (autoSaveInterval && (typeof autoSaveInterval !== 'number' || autoSaveInterval < 10000)) {
        res.status(400).json({
          code: 'BAD_REQUEST',
          message: 'autoSaveInterval must be a number >= 10000 (10 seconds)',
          requestId,
          timestamp: new Date().toISOString(),
        });
        return;
      }

      const editorSessionRepository = req.services?.get(
        'editorSessionRepository'
      ) as EditorSessionRepository;
      if (!editorSessionRepository) {
        throw new Error('Editor session repository not available');
      }

      if (!docId) {
        res.status(400).json({
          code: 'BAD_REQUEST',
          message: 'Document ID is required',
          requestId,
          timestamp: new Date().toISOString(),
        });
        return;
      }

      const userId = req.user?.userId;
      if (!userId) {
        res.status(401).json({
          code: 'UNAUTHORIZED',
          message: 'User ID is required',
          requestId,
          timestamp: new Date().toISOString(),
        });
        return;
      }

      // Get existing session or create one
      let session = await editorSessionRepository.findByDocumentAndUser(docId, userId);

      if (!session) {
        // Create new session with provided values
        session = await editorSessionRepository.create({
          documentId: docId,
          userId,
          sessionId: (req as { sessionID?: string }).sessionID || 'unknown',
          activeSectionId: activeSectionId ?? null,
          expandedSections: expandedSections ?? [],
          scrollPosition: scrollPosition ?? 0,
          editorMode: editorMode ?? 'wysiwyg',
          showDiffView: showDiffView ?? false,
          autoSaveEnabled: autoSaveEnabled ?? true,
          autoSaveInterval: autoSaveInterval ?? 30000,
          collaborators: [],
          lastSaveTime: Date.now(),
          pendingChangeCount: 0,
        });
      } else {
        // Update existing session
        session = await editorSessionRepository.updateEditorConfig(session.id, {
          activeSectionId,
          expandedSections,
          scrollPosition,
          editorMode,
          showDiffView,
          autoSaveEnabled,
          autoSaveInterval,
        });
      }

      // Convert dates to ISO strings for JSON response
      const serializedSession = {
        ...session,
        createdAt: session.createdAt.toISOString(),
        updatedAt: session.updatedAt.toISOString(),
        collaborators: session.collaborators.map(c => ({
          ...c,
          lastActivity: c.lastActivity.toISOString(),
        })),
      };

      res.status(200).json(serializedSession);
    } catch (error) {
      logger?.error(
        {
          requestId,
          docId,
          error: error instanceof Error ? error.message : 'Unknown error',
        },
        'Error updating editor session'
      );

      res.status(500).json({
        code: 'INTERNAL_ERROR',
        message: 'Failed to update editor session',
        requestId,
        timestamp: new Date().toISOString(),
      });
    }
  }
);

export default sessionsRouter;
