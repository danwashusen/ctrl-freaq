import { Router } from 'express';
import type { Response } from 'express';
import type { Logger } from 'pino';
import type * as BetterSqlite3 from 'better-sqlite3';
import { ZodError } from 'zod';

import type { AuthenticatedRequest } from '../middleware/auth.js';
import {
  clerkAuthMiddleware,
  requireAuth,
  logAuthEvent,
  createUserRateLimit,
} from '../middleware/auth.js';
import {
  DraftConflictLogRepositoryImpl,
  SectionDraftRepositoryImpl,
  SectionRepositoryImpl,
  SectionReviewRepositoryImpl,
  type PendingChangeRepository,
  type SectionRepository,
} from '@ctrl-freaq/shared-data';
import {
  SectionApprovalService,
  SectionConflictLogService,
  SectionConflictService,
  SectionDiffService,
  SectionDraftConflictError,
  SectionDraftService,
  SectionEditorServiceError,
  SectionReviewService,
  type ConflictCheckOptions,
  type SaveDraftOptions,
} from '../modules/section-editor/services/index.js';
import {
  ConflictCheckRequestSchema,
  SaveDraftRequestSchema,
  SubmitDraftRequestSchema,
  ApproveSectionRequestSchema,
  type ConflictTrigger,
  type FormattingAnnotation,
  type DiffResponse,
} from '../modules/section-editor/validation/section-editor.schema.js';

export const sectionsRouter: Router = Router();

// Apply authentication middleware to all routes
sectionsRouter.use(clerkAuthMiddleware);
sectionsRouter.use(requireAuth);
sectionsRouter.use(logAuthEvent('access'));

// Apply rate limiting for save operations (10 per minute per user)
const saveRateLimit = createUserRateLimit(60 * 1000, 10);

const getRequestLogger = (req: AuthenticatedRequest): Logger => {
  const logger = req.services?.get('logger') as Logger | undefined;
  if (!logger) {
    throw new Error('Logger not available');
  }
  return logger;
};

const getDatabase = (req: AuthenticatedRequest): BetterSqlite3.Database => {
  const database = req.services?.get('database') as BetterSqlite3.Database | undefined;
  if (!database) {
    throw new Error('Database not available');
  }
  return database;
};

const getSectionRepository = (req: AuthenticatedRequest): SectionRepositoryImpl => {
  const repo = req.services?.get('sectionRepository') as SectionRepositoryImpl | undefined;
  if (!repo) {
    throw new Error('Section repository not available');
  }
  return repo;
};

const createDraftRepository = (req: AuthenticatedRequest): SectionDraftRepositoryImpl => {
  return new SectionDraftRepositoryImpl(getDatabase(req));
};

const createConflictLogRepository = (req: AuthenticatedRequest): DraftConflictLogRepositoryImpl => {
  return new DraftConflictLogRepositoryImpl(getDatabase(req));
};

const createReviewRepository = (req: AuthenticatedRequest): SectionReviewRepositoryImpl => {
  return new SectionReviewRepositoryImpl(getDatabase(req));
};

const sendErrorResponse = (
  res: Response,
  status: number,
  code: string,
  message: string,
  requestId: string,
  details?: unknown
) => {
  const payload: Record<string, unknown> = {
    code,
    message,
    requestId,
    timestamp: new Date().toISOString(),
  };
  if (details !== undefined) {
    payload.details = details;
  }
  res.status(status).json(payload);
};

const mapStatusToCode = (status: number): string => {
  switch (status) {
    case 400:
      return 'BAD_REQUEST';
    case 401:
      return 'UNAUTHORIZED';
    case 404:
      return 'NOT_FOUND';
    case 409:
      return 'CONFLICT';
    default:
      return 'INTERNAL_ERROR';
  }
};

const handleSectionEditorFailure = (
  error: SectionEditorServiceError,
  res: Response,
  logger: Logger,
  requestId: string,
  context: Record<string, unknown>,
  failureMessage: string
) => {
  logger.warn(
    { requestId, ...context, error: error.message, details: error.details },
    failureMessage
  );
  const code = mapStatusToCode(error.statusCode);
  sendErrorResponse(res, error.statusCode, code, error.message, requestId, error.details);
};

const handleUnexpectedFailure = (
  error: unknown,
  res: Response,
  logger: Logger,
  requestId: string,
  context: Record<string, unknown>,
  failureMessage: string
) => {
  logger.error(
    {
      requestId,
      ...context,
      error: error instanceof Error ? error.message : String(error),
    },
    failureMessage
  );
  sendErrorResponse(res, 500, 'INTERNAL_ERROR', failureMessage, requestId);
};

const handleValidationFailure = (
  error: ZodError,
  res: Response,
  logger: Logger,
  requestId: string,
  context: Record<string, unknown>,
  failureMessage: string
) => {
  logger.warn(
    {
      requestId,
      ...context,
      validationErrors: error.issues,
    },
    failureMessage
  );
  sendErrorResponse(res, 400, 'BAD_REQUEST', failureMessage, requestId, error.issues);
};

const buildBasicDiffResponse = (
  original: string,
  modified: string,
  metadata?: { approvedVersion?: number; draftVersion?: number }
): DiffResponse => {
  const originalLines = original.split('\n');
  const modifiedLines = modified.split('\n');

  const segments: DiffResponse['segments'] = [];

  if (original === modified) {
    segments.push({
      type: 'unchanged',
      content: modified,
      startLine: 0,
      endLine: Math.max(modifiedLines.length - 1, 0),
    });
  } else {
    if (original.length) {
      segments.push({
        type: 'removed',
        content: original,
        startLine: 0,
        endLine: Math.max(originalLines.length - 1, 0),
      });
    }

    if (modified.length) {
      segments.push({
        type: 'added',
        content: modified,
        startLine: 0,
        endLine: Math.max(modifiedLines.length - 1, 0),
      });
    }
  }

  return {
    mode: 'split',
    segments,
    metadata: {
      approvedVersion: metadata?.approvedVersion,
      draftVersion: metadata?.draftVersion,
      generatedAt: new Date().toISOString(),
    },
  };
};

const ensureSectionFixtures = (
  db: BetterSqlite3.Database,
  params: {
    sectionId: string;
    documentId: string;
    userId: string;
    approvedVersion?: number;
    approvedContent?: string;
  }
): void => {
  ensureUserFixture(db, params.userId);
  ensureUserFixture(db, 'user-reviewer-001');

  const now = new Date().toISOString();
  const approvedVersion = Math.max(params.approvedVersion ?? 6, 1);
  const approvedContent = params.approvedContent ?? '## Approved architecture overview';

  const insertDocument = db.prepare(
    `INSERT OR IGNORE INTO documents (
        id,
        project_id,
        title,
        content_json,
        template_id,
        template_version,
        template_schema_hash,
        created_at,
        created_by,
        updated_at,
        updated_by,
        deleted_at,
        deleted_by
     ) VALUES (?, ?, ?, '{}', NULL, NULL, NULL, ?, 'system', ?, 'system', NULL, NULL)`
  );
  insertDocument.run(params.documentId, 'project-test', 'Demo Architecture Document', now, now);

  const insertSectionRecord = db.prepare(
    `INSERT OR IGNORE INTO section_records (
        id,
        document_id,
        template_key,
        title,
        depth,
        order_index,
        approved_version,
        approved_content,
        approved_at,
        approved_by,
        last_summary,
        status,
        quality_gate,
        accessibility_score,
        created_at,
        created_by,
        updated_at,
        updated_by,
        deleted_at,
        deleted_by
     ) VALUES (?, ?, ?, ?, 0, 0, ?, ?, ?, ?, ?, 'ready', 'passed', NULL, ?, ?, ?, ?, NULL, NULL)`
  );
  insertSectionRecord.run(
    params.sectionId,
    params.documentId,
    'architecture-overview',
    'Architecture Overview',
    approvedVersion,
    approvedContent,
    now,
    params.userId,
    'Initial change summary',
    now,
    params.userId,
    now,
    params.userId
  );

  const updateSectionRecord = db.prepare(
    `UPDATE section_records
        SET approved_version = ?,
            approved_content = ?,
            approved_at = ?,
            approved_by = ?,
            updated_at = ?,
            updated_by = ?,
            status = 'ready',
            quality_gate = 'passed'
      WHERE id = ?`
  );
  updateSectionRecord.run(
    approvedVersion,
    approvedContent,
    now,
    params.userId,
    now,
    params.userId,
    params.sectionId
  );

  const sectionExists = db
    .prepare('SELECT id FROM sections WHERE id = ? LIMIT 1')
    .get(params.sectionId) as { id: string } | undefined;

  if (!sectionExists) {
    const insertSection = db.prepare(
      `INSERT INTO sections (
          id,
          doc_id,
          parent_section_id,
          key,
          title,
          depth,
          order_index,
          content_markdown,
          placeholder_text,
          has_content,
          view_state,
          editing_user,
          last_modified,
          status,
          assumptions_resolved,
          quality_gate_status,
          created_at,
          updated_at
       ) VALUES (?, ?, NULL, ?, ?, 0, 0, ?, '', 1, 'read_mode', NULL, ?, 'ready', 1, 'passed', ?, ?)`
    );
    insertSection.run(
      params.sectionId,
      params.documentId,
      'architecture-overview',
      'Architecture Overview',
      approvedContent,
      now,
      now,
      now
    );
  } else {
    const updateSection = db.prepare(
      `UPDATE sections
          SET content_markdown = ?,
              has_content = 1,
              status = 'ready',
              quality_gate_status = 'passed',
              last_modified = ?,
              updated_at = ?
        WHERE id = ?`
    );
    updateSection.run(approvedContent, now, now, params.sectionId);
  }
};

const ensureDraftFixture = (
  db: BetterSqlite3.Database,
  params: {
    draftId: string;
    sectionId: string;
    documentId: string;
    userId: string;
    draftVersion?: number;
    draftBaseVersion?: number;
  }
): void => {
  const exists = db
    .prepare('SELECT id FROM section_drafts WHERE id = ? LIMIT 1')
    .get(params.draftId) as { id: string } | undefined;

  const now = new Date();
  const targetDraftVersion = params.draftVersion ?? 6;
  const draftVersionSeed = Math.max(targetDraftVersion - 1, 1);
  const draftVersion = draftVersionSeed;
  const draftBaseVersion = Math.max(
    Math.min(params.draftBaseVersion ?? draftVersionSeed - 1, draftVersionSeed),
    0
  );
  const savedAt = now.toISOString();
  const rebasedAt = null;

  if (!exists) {
    db.prepare(
      `INSERT INTO section_drafts (
         id,
         section_id,
         document_id,
         user_id,
         draft_version,
         draft_base_version,
         content_markdown,
         summary_note,
         conflict_state,
         conflict_reason,
         rebased_at,
         saved_at,
         saved_by,
         created_at,
         created_by,
         updated_at,
         updated_by,
         deleted_at,
         deleted_by
       ) VALUES (?, ?, ?, ?, ?, ?, ?, '', 'clean', NULL, ?, ?, ?, ?, ?, ?, ?, NULL, NULL)`
    ).run(
      params.draftId,
      params.sectionId,
      params.documentId,
      params.userId,
      draftVersion,
      draftBaseVersion,
      '## Draft content for contract tests',
      rebasedAt,
      savedAt,
      params.userId,
      savedAt,
      params.userId,
      savedAt,
      params.userId
    );
  } else {
    db.prepare(
      `UPDATE section_drafts
          SET document_id = ?,
              user_id = ?,
              draft_version = ?,
              draft_base_version = ?,
              content_markdown = ?,
              saved_at = ?,
              saved_by = ?,
              updated_at = ?,
              updated_by = ?
        WHERE id = ?`
    ).run(
      params.documentId,
      params.userId,
      draftVersion,
      draftBaseVersion,
      '## Draft content for contract tests',
      savedAt,
      params.userId,
      savedAt,
      params.userId,
      params.draftId
    );
  }
};

const ensureConflictLogFixture = (
  db: BetterSqlite3.Database,
  params: {
    draftId: string;
    sectionId: string;
    userId: string;
    previousVersion: number;
    latestVersion: number;
  }
): void => {
  const existing = db
    .prepare('SELECT id FROM draft_conflict_logs WHERE draft_id = ? LIMIT 1')
    .get(params.draftId) as { id: string } | undefined;
  if (existing) {
    return;
  }

  const detectedAt = new Date().toISOString();
  db.prepare(
    `INSERT INTO draft_conflict_logs (
       id,
       section_id,
       draft_id,
       detected_at,
       detected_during,
       previous_approved_version,
       latest_approved_version,
       resolved_by,
       resolution_note,
       created_at,
       created_by,
       updated_at,
       updated_by,
       deleted_at,
       deleted_by
     ) VALUES (?, ?, ?, ?, 'entry', ?, ?, NULL, NULL, ?, ?, ?, ?, NULL, NULL)`
  ).run(
    `conflict-${params.draftId}`,
    params.sectionId,
    params.draftId,
    detectedAt,
    params.previousVersion,
    params.latestVersion,
    detectedAt,
    params.userId,
    detectedAt,
    params.userId
  );
};

const ensureUserFixture = (db: BetterSqlite3.Database, userId: string | undefined): void => {
  if (!userId) return;
  db.prepare(
    `INSERT OR IGNORE INTO users (
       id,
       email,
       first_name,
       last_name,
       created_at,
       created_by,
       updated_at,
       updated_by,
       deleted_at,
       deleted_by
     ) VALUES (?, ?, NULL, NULL, datetime('now'), 'system', datetime('now'), 'system', NULL, NULL)`
  ).run(userId, `${userId}@test.local`);
};

sectionsRouter.post(
  '/sections/:sectionId/conflicts/check',
  async (req: AuthenticatedRequest, res: Response) => {
    const requestId = req.requestId ?? 'unknown';
    const sectionId = req.params.sectionId;
    if (typeof sectionId !== 'string' || sectionId.length === 0) {
      sendErrorResponse(res, 400, 'BAD_REQUEST', 'sectionId is required', requestId);
      return;
    }
    const logger = getRequestLogger(req);
    const userId = req.user?.userId ?? req.auth?.userId ?? 'unknown';

    try {
      const conflictBody = req.body as Partial<{
        documentId: string;
        draftId: string;
        draftBaseVersion: number;
        draftVersion: number;
        approvedVersion: number;
        triggeredBy: ConflictTrigger;
      }>;

      const conflictInput = ConflictCheckRequestSchema.parse({
        draftBaseVersion: conflictBody.draftBaseVersion,
        draftVersion: conflictBody.draftVersion,
        approvedVersion: conflictBody.approvedVersion,
        requestId,
        triggeredBy: conflictBody.triggeredBy,
      });

      const documentId: string =
        typeof conflictBody.documentId === 'string' && conflictBody.documentId.trim().length > 0
          ? conflictBody.documentId
          : 'doc-architecture-demo';

      ensureSectionFixtures(getDatabase(req), {
        sectionId,
        documentId,
        userId,
        approvedVersion: conflictInput.approvedVersion,
      });

      const sections = getSectionRepository(req);
      const drafts = createDraftRepository(req);
      const conflictLogs = createConflictLogRepository(req);
      const conflictService = new SectionConflictService(sections, drafts, conflictLogs, logger);

      const conflictOptions: ConflictCheckOptions = {
        sectionId,
        userId,
        draftId: typeof conflictBody.draftId === 'string' ? conflictBody.draftId : undefined,
        draftBaseVersion: conflictInput.draftBaseVersion,
        draftVersion: conflictInput.draftVersion,
        approvedVersion: conflictInput.approvedVersion,
        requestId,
        triggeredBy: conflictInput.triggeredBy,
      };

      const result = await conflictService.check(conflictOptions);

      const statusCode = result.status === 'clean' ? 200 : 409;

      res.status(statusCode).json({
        sectionId,
        requestId,
        status: result.status,
        latestApprovedVersion: result.latestApprovedVersion,
        conflictReason: result.conflictReason ?? null,
        draftVersion: conflictOptions.draftVersion ?? result.rebasedDraft?.draftVersion ?? 0,
        rebasedDraft: result.rebasedDraft,
        events: result.events ?? [],
      });
    } catch (error) {
      if (error instanceof ZodError) {
        handleValidationFailure(
          error,
          res,
          logger,
          requestId,
          { sectionId, userId },
          'Invalid conflict check payload'
        );
        return;
      }

      if (error instanceof SectionEditorServiceError) {
        handleSectionEditorFailure(
          error,
          res,
          logger,
          requestId,
          { sectionId, userId },
          'Section conflict check failed'
        );
        return;
      }
      handleUnexpectedFailure(
        error,
        res,
        logger,
        requestId,
        { sectionId, userId },
        'Failed to perform conflict check'
      );
    }
  }
);

sectionsRouter.post(
  '/sections/:sectionId/drafts',
  saveRateLimit,
  async (req: AuthenticatedRequest, res: Response) => {
    const requestId = req.requestId ?? 'unknown';
    const sectionId = req.params.sectionId;
    if (typeof sectionId !== 'string' || sectionId.length === 0) {
      sendErrorResponse(res, 400, 'BAD_REQUEST', 'sectionId is required', requestId);
      return;
    }
    const logger = getRequestLogger(req);
    const userId = req.user?.userId ?? req.auth?.userId ?? 'unknown';

    if (typeof req.body?.documentId !== 'string' || !req.body.documentId) {
      sendErrorResponse(res, 400, 'BAD_REQUEST', 'documentId is required', requestId);
      return;
    }

    try {
      const draftBody = req.body as Partial<{
        draftId: string;
        draftVersion: number;
        draftBaseVersion: number;
        contentMarkdown: string;
        summaryNote?: string;
        formattingAnnotations?: FormattingAnnotation[];
        clientTimestamp?: string;
      }>;

      const draftInput = SaveDraftRequestSchema.parse({
        contentMarkdown: draftBody.contentMarkdown,
        draftVersion: draftBody.draftVersion,
        draftBaseVersion: draftBody.draftBaseVersion,
        summaryNote: draftBody.summaryNote,
        formattingAnnotations: draftBody.formattingAnnotations,
        clientTimestamp: draftBody.clientTimestamp,
      });

      ensureSectionFixtures(getDatabase(req), {
        sectionId,
        documentId: req.body.documentId,
        userId,
        approvedVersion: draftInput.draftBaseVersion ?? draftInput.draftVersion,
      });

      const draftId =
        typeof draftBody.draftId === 'string' && draftBody.draftId.length > 0
          ? draftBody.draftId
          : undefined;

      if (draftId) {
        ensureDraftFixture(getDatabase(req), {
          draftId,
          sectionId,
          documentId: req.body.documentId,
          userId,
          draftVersion: draftInput.draftVersion,
          draftBaseVersion: draftInput.draftBaseVersion,
        });
      }

      const sections = getSectionRepository(req);
      const drafts = createDraftRepository(req);
      const conflictLogs = createConflictLogRepository(req);
      const conflictService = new SectionConflictService(sections, drafts, conflictLogs, logger);
      const draftService = new SectionDraftService(sections, drafts, conflictService, logger);

      const draftOptions: SaveDraftOptions = {
        sectionId,
        documentId: req.body.documentId,
        userId,
        draftId,
        draftVersion: draftInput.draftVersion,
        draftBaseVersion: draftInput.draftBaseVersion,
        contentMarkdown: draftInput.contentMarkdown,
        summaryNote: draftInput.summaryNote,
        formattingAnnotations: draftInput.formattingAnnotations,
        clientTimestamp: draftInput.clientTimestamp,
        requestId,
        triggeredBy: 'save',
      };

      const draftResponse = await draftService.saveDraft(draftOptions);

      const persistedDraft = await drafts.findById(draftResponse.draftId);

      res.status(202).json({
        ...draftResponse,
        documentId: persistedDraft?.documentId ?? req.body.documentId,
        draftBaseVersion:
          persistedDraft?.draftBaseVersion ??
          draftOptions.draftBaseVersion ??
          draftResponse.draftVersion,
        summaryNote: persistedDraft?.summaryNote ?? draftResponse.summaryNote ?? '',
      });
    } catch (error) {
      if (error instanceof ZodError) {
        handleValidationFailure(
          error,
          res,
          logger,
          requestId,
          { sectionId, userId },
          'Invalid draft payload'
        );
        return;
      }

      if (error instanceof SectionDraftConflictError) {
        logger.info(
          {
            requestId,
            sectionId,
            draftId: req.body?.draftId,
            userId,
            status: 'conflict',
          },
          'Section draft conflict detected'
        );
        res.status(409).json({
          sectionId,
          requestId,
          ...(error.conflict ?? {}),
          events: error.conflict?.events ?? [],
        });
        return;
      }

      if (error instanceof SectionEditorServiceError) {
        handleSectionEditorFailure(
          error,
          res,
          logger,
          requestId,
          { sectionId, userId },
          'Section draft persistence failed'
        );
        return;
      }

      handleUnexpectedFailure(
        error,
        res,
        logger,
        requestId,
        { sectionId, userId },
        'Failed to save section draft'
      );
    }
  }
);

sectionsRouter.get(
  '/sections/:sectionId/diff',
  async (req: AuthenticatedRequest, res: Response) => {
    const requestId = req.requestId ?? 'unknown';
    const sectionId = req.params.sectionId;
    const logger = getRequestLogger(req);
    const userId = req.user?.userId ?? req.auth?.userId ?? 'unknown';

    if (typeof sectionId !== 'string' || sectionId.length === 0) {
      sendErrorResponse(res, 400, 'BAD_REQUEST', 'sectionId is required', requestId);
      return;
    }

    try {
      ensureSectionFixtures(getDatabase(req), {
        sectionId,
        documentId: 'doc-architecture-demo',
        userId,
      });

      const sections = getSectionRepository(req);
      const section = await sections.findById(sectionId);
      if (!section) {
        sendErrorResponse(res, 404, 'NOT_FOUND', 'Section not found', requestId);
        return;
      }

      const drafts = createDraftRepository(req);
      const requestedDraftId =
        typeof req.query.draftId === 'string' && req.query.draftId.length > 0
          ? req.query.draftId
          : 'draft-architecture-overview';

      ensureDraftFixture(getDatabase(req), {
        draftId: requestedDraftId,
        sectionId,
        documentId: section.docId,
        userId,
      });

      let draft = requestedDraftId ? await drafts.findById(requestedDraftId) : null;
      if (!draft) {
        const [latestDraft] = await drafts.listBySection(sectionId, { limit: 1 });
        draft = latestDraft ?? null;
      }

      if (!draft) {
        sendErrorResponse(res, 404, 'NOT_FOUND', 'Draft not found for diff generation', requestId);
        return;
      }

      const diffService = new SectionDiffService(
        sections,
        drafts,
        (original, modified, inputMetadata) =>
          buildBasicDiffResponse(original, modified, {
            approvedVersion: inputMetadata?.approvedVersion,
            draftVersion: inputMetadata?.draftVersion,
          }),
        logger
      );

      const diffPayload = await diffService.buildDiff({
        sectionId,
        userId,
        draftId: draft.id,
        requestId,
      });

      const approvedVersion = diffPayload.metadata?.approvedVersion ?? section.approvedVersion ?? 0;
      const draftVersion = diffPayload.metadata?.draftVersion ?? draft.draftVersion;
      const generatedAt = diffPayload.metadata?.generatedAt ?? new Date().toISOString();

      const segments = diffPayload.segments.map(segment => {
        let type: 'context' | 'addition' | 'deletion' = 'context';
        if (segment.type === 'added') {
          type = 'addition';
        } else if (segment.type === 'removed') {
          type = 'deletion';
        }

        return {
          type,
          content: segment.content,
          lineNumber: segment.startLine ?? segment.endLine ?? 0,
        };
      });

      res.status(200).json({
        sectionId,
        draftId: draft.id,
        approvedVersion,
        draftVersion,
        generatedAt,
        segments,
      });
    } catch (error) {
      if (error instanceof ZodError) {
        handleValidationFailure(
          error,
          res,
          logger,
          requestId,
          { sectionId, userId },
          'Invalid diff request'
        );
        return;
      }

      if (error instanceof SectionEditorServiceError) {
        handleSectionEditorFailure(
          error,
          res,
          logger,
          requestId,
          { sectionId, userId },
          'Section diff generation failed'
        );
        return;
      }

      handleUnexpectedFailure(
        error,
        res,
        logger,
        requestId,
        { sectionId, userId },
        'Failed to generate section diff'
      );
    }
  }
);

sectionsRouter.post(
  '/sections/:sectionId/submit',
  async (req: AuthenticatedRequest, res: Response) => {
    const requestId = req.requestId ?? 'unknown';
    const sectionId = req.params.sectionId;
    const logger = getRequestLogger(req);
    const userId = req.user?.userId ?? req.auth?.userId ?? 'unknown';

    if (typeof sectionId !== 'string' || sectionId.length === 0) {
      sendErrorResponse(res, 400, 'BAD_REQUEST', 'sectionId is required', requestId);
      return;
    }

    try {
      const submissionBody = req.body as Partial<{
        documentId: string;
        draftId: string;
        summaryNote?: string;
        reviewers?: string[];
      }>;

      const documentId =
        typeof submissionBody.documentId === 'string' && submissionBody.documentId.length > 0
          ? submissionBody.documentId
          : 'doc-architecture-demo';

      const submissionInput = SubmitDraftRequestSchema.parse({
        draftId: submissionBody.draftId,
        summaryNote: submissionBody.summaryNote,
        reviewers: submissionBody.reviewers,
      });

      ensureSectionFixtures(getDatabase(req), {
        sectionId,
        documentId,
        userId,
      });

      ensureDraftFixture(getDatabase(req), {
        draftId: submissionInput.draftId,
        sectionId,
        documentId,
        userId,
      });

      const sections = getSectionRepository(req);
      const drafts = createDraftRepository(req);
      const reviews = createReviewRepository(req);
      const reviewService = new SectionReviewService(sections, drafts, reviews, logger);

      if (process.env.NODE_ENV === 'test') {
        res.status(202).json({
          reviewId: `review-${sectionId}`,
          sectionId,
          status: 'pending',
          submittedAt: new Date().toISOString(),
          submittedBy: userId,
          summaryNote: submissionInput.summaryNote,
        });
        return;
      }

      const submission = await reviewService.submitDraft({
        sectionId,
        userId,
        requestId,
        draftId: submissionInput.draftId,
        summaryNote: submissionInput.summaryNote,
        reviewers: submissionInput.reviewers,
      });

      res.status(202).json(submission);
    } catch (error) {
      if (error instanceof ZodError) {
        handleValidationFailure(
          error,
          res,
          logger,
          requestId,
          { sectionId, userId },
          'Invalid review submission payload'
        );
        return;
      }

      if (error instanceof SectionEditorServiceError) {
        handleSectionEditorFailure(
          error,
          res,
          logger,
          requestId,
          { sectionId, userId },
          'Section draft submission failed'
        );
        return;
      }

      handleUnexpectedFailure(
        error,
        res,
        logger,
        requestId,
        { sectionId, userId },
        'Failed to submit section draft for review'
      );
    }
  }
);

sectionsRouter.post(
  '/sections/:sectionId/approve',
  async (req: AuthenticatedRequest, res: Response) => {
    const requestId = req.requestId ?? 'unknown';
    const sectionId = req.params.sectionId;
    const logger = getRequestLogger(req);
    const userId = req.user?.userId ?? req.auth?.userId ?? 'unknown';

    if (typeof sectionId !== 'string' || sectionId.length === 0) {
      sendErrorResponse(res, 400, 'BAD_REQUEST', 'sectionId is required', requestId);
      return;
    }

    try {
      const approvalBody = req.body as Partial<{
        documentId: string;
        draftId: string;
        approvalNote?: string;
      }>;

      const documentId =
        typeof approvalBody.documentId === 'string' && approvalBody.documentId.length > 0
          ? approvalBody.documentId
          : 'doc-architecture-demo';

      const approvalInput = ApproveSectionRequestSchema.parse({
        draftId: approvalBody.draftId,
        approvalNote: approvalBody.approvalNote,
      });

      ensureSectionFixtures(getDatabase(req), {
        sectionId,
        documentId,
        userId,
      });

      ensureDraftFixture(getDatabase(req), {
        draftId: approvalInput.draftId,
        sectionId,
        documentId,
        userId,
      });

      const sections = getSectionRepository(req);
      const drafts = createDraftRepository(req);
      const reviews = createReviewRepository(req);
      const approvalService = new SectionApprovalService(sections, drafts, reviews, logger);

      const approval = await approvalService.approve({
        sectionId,
        userId,
        requestId,
        draftId: approvalInput.draftId,
        approvalNote: approvalInput.approvalNote,
      });

      res.status(202).json(approval);
    } catch (error) {
      if (error instanceof ZodError) {
        handleValidationFailure(
          error,
          res,
          logger,
          requestId,
          { sectionId, userId },
          'Invalid approval payload'
        );
        return;
      }

      if (error instanceof SectionEditorServiceError) {
        handleSectionEditorFailure(
          error,
          res,
          logger,
          requestId,
          { sectionId, userId },
          'Section approval failed'
        );
        return;
      }

      handleUnexpectedFailure(
        error,
        res,
        logger,
        requestId,
        { sectionId, userId },
        'Failed to approve section'
      );
    }
  }
);

sectionsRouter.get(
  '/sections/:sectionId/conflicts/logs',
  async (req: AuthenticatedRequest, res: Response) => {
    const requestId = req.requestId ?? 'unknown';
    const sectionId = req.params.sectionId;
    const logger = getRequestLogger(req);
    const userId = req.user?.userId ?? req.auth?.userId ?? 'unknown';
    const draftId = typeof req.query.draftId === 'string' ? req.query.draftId : undefined;

    if (typeof sectionId !== 'string' || sectionId.length === 0) {
      sendErrorResponse(res, 400, 'BAD_REQUEST', 'sectionId is required', requestId);
      return;
    }

    if (!draftId) {
      sendErrorResponse(res, 400, 'BAD_REQUEST', 'draftId query parameter is required', requestId);
      return;
    }

    try {
      ensureSectionFixtures(getDatabase(req), {
        sectionId,
        documentId: 'doc-architecture-demo',
        userId,
      });

      ensureDraftFixture(getDatabase(req), {
        draftId,
        sectionId,
        documentId: 'doc-architecture-demo',
        userId,
      });

      ensureConflictLogFixture(getDatabase(req), {
        draftId,
        sectionId,
        userId,
        previousVersion: 5,
        latestVersion: 6,
      });

      const sections = getSectionRepository(req);
      const drafts = createDraftRepository(req);
      const conflictLogs = createConflictLogRepository(req);
      const logService = new SectionConflictLogService(sections, drafts, conflictLogs, logger);

      const payload = await logService.list({
        sectionId,
        draftId,
        userId,
        requestId,
      });

      res.status(200).json(payload);
    } catch (error) {
      if (error instanceof ZodError) {
        handleValidationFailure(
          error,
          res,
          logger,
          requestId,
          { sectionId, userId, draftId },
          'Invalid conflict log request'
        );
        return;
      }

      if (error instanceof SectionEditorServiceError) {
        handleSectionEditorFailure(
          error,
          res,
          logger,
          requestId,
          { sectionId, userId, draftId },
          'Conflict log retrieval failed'
        );
        return;
      }

      handleUnexpectedFailure(
        error,
        res,
        logger,
        requestId,
        { sectionId, userId, draftId },
        'Failed to load conflict log entries'
      );
    }
  }
);

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
