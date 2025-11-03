import { randomUUID } from 'node:crypto';

import { Router, type Response } from 'express';
import type { Router as ExpressRouter } from 'express';
import type { Logger } from 'pino';

import type { AuthenticatedRequest } from '../middleware/auth.js';
import type {
  EventBroker,
  EventBrokerSubscription,
  EventEnvelope,
  SubscriptionScope,
} from '../modules/event-stream/event-broker.js';
import type { EventStreamConfig } from '../config/event-stream.js';
import type {
  Document,
  DocumentRepositoryImpl,
  ProjectRepositoryImpl,
  SectionRepositoryImpl,
} from '@ctrl-freaq/shared-data';

interface EventsRouterOptions {
  broker: EventBroker;
  config: EventStreamConfig;
}

const DEFAULT_TOPIC_SCOPES: SubscriptionScope[] = [
  { topic: 'project.lifecycle' },
  { topic: 'quality-gate.progress' },
  { topic: 'quality-gate.summary' },
  { topic: 'section.conflict' },
  { topic: 'section.diff' },
];

const HEADER_LAST_EVENT_ID = 'last-event-id';
const HEADER_WORKSPACE_ID = 'x-workspace-id';
const DEFAULT_WORKSPACE_ID = 'workspace-default';
const HEARTBEAT_EVENT = 'heartbeat';
const STREAM_OPEN_EVENT = 'stream.open';

export const createEventsRouter = ({ broker, config }: EventsRouterOptions): ExpressRouter => {
  const router = Router();

  router.get('/events', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const logger = req.services?.get('logger') as Logger | undefined;
    const requestId = req.requestId || randomUUID();
    const workspaceId = extractWorkspaceId(req);
    const scopes = buildSubscriptionScopes(req);
    const lastEventId = coerceHeader(req.get(HEADER_LAST_EVENT_ID));

    if (scopes.length === 0) {
      res.status(400).json({
        error: 'INVALID_SCOPE',
        message: 'At least one topic scope is required',
        requestId,
        timestamp: new Date().toISOString(),
      });
      return;
    }

    const scopeValidation = await validateScopeAuthorization(req, scopes);
    if (!scopeValidation.ok) {
      logger?.warn(
        {
          requestId,
          userId: scopeValidation.context.userId,
          workspaceId,
          scopes,
          reason: scopeValidation.error.reason,
        },
        'SSE scope validation failed'
      );

      res.status(scopeValidation.error.status).json({
        code: scopeValidation.error.code,
        message: scopeValidation.error.message,
        requestId,
        timestamp: new Date().toISOString(),
      });
      return;
    }

    res.status(200);
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders?.();

    req.socket.setKeepAlive(true, config.heartbeatIntervalMs);
    req.socket.setTimeout(0);

    const connectionId = randomUUID();
    let closed = false;

    const pendingEnvelopes: EventEnvelope[] = [];
    let streamReady = false;

    const deliverEnvelope = (envelope: EventEnvelope): void => {
      if (closed || res.writableEnded || res.destroyed) {
        return;
      }

      try {
        if (envelope.kind === 'heartbeat') {
          writeSseEvent(res, HEARTBEAT_EVENT, {
            emittedAt: envelope.emittedAt,
            intervalMs: config.heartbeatIntervalMs,
          });
          return;
        }

        writeSseEvent(
          res,
          envelope.topic,
          {
            topic: envelope.topic,
            resourceId: envelope.resourceId,
            workspaceId: envelope.workspaceId,
            sequence: envelope.sequence,
            kind: envelope.kind,
            payload: envelope.payload,
            emittedAt: envelope.emittedAt,
            metadata: envelope.metadata ?? undefined,
            id: envelope.id,
            lastEventId: envelope.lastEventId ?? undefined,
          },
          envelope.id
        );
      } catch (error) {
        closeStream('write_failed', error);
      }
    };

    const sendEnvelope = (envelope: EventEnvelope): void => {
      if (!streamReady) {
        pendingEnvelopes.push(envelope);
        return;
      }

      deliverEnvelope(envelope);
    };

    let subscription: EventBrokerSubscription | null = null;

    const closeStream = (reason: string, error?: unknown) => {
      if (closed) {
        return;
      }
      closed = true;

      logger?.info(
        {
          requestId,
          connectionId,
          workspaceId,
          reason,
          error: error instanceof Error ? error.message : undefined,
        },
        'SSE connection closing'
      );

      pendingEnvelopes.length = 0;
      streamReady = true;

      subscription?.unsubscribe();
      if (!res.writableEnded) {
        res.end();
      }
    };

    subscription = broker.subscribe({
      connectionId,
      userId: req.user?.userId ?? 'anonymous',
      workspaceId,
      topics: scopes,
      lastEventId,
      send: sendEnvelope,
    });

    writeSseEvent(
      res,
      STREAM_OPEN_EVENT,
      {
        connectionId,
        heartbeatIntervalMs: config.heartbeatIntervalMs,
        replayLimit: config.replayLimit,
        workspaceId,
        topics: scopes,
      },
      connectionId
    );

    logger?.info(
      {
        requestId,
        connectionId,
        workspaceId,
        topics: scopes,
        lastEventId,
      },
      'SSE connection established'
    );

    const cleanup = () => closeStream('client_disconnect');

    const flushInitialEvents = () => {
      if (streamReady) {
        return;
      }
      streamReady = true;

      while (pendingEnvelopes.length > 0 && !closed && !res.writableEnded && !res.destroyed) {
        const envelope = pendingEnvelopes.shift();
        if (!envelope) {
          break;
        }
        deliverEnvelope(envelope);
      }
    };

    // Defer replay delivery until the next event loop tick so clients can register listeners
    setTimeout(flushInitialEvents, 0);

    req.on('close', cleanup);
    res.on('close', cleanup);
  });

  return router;
};

const coerceHeader = (value: string | undefined): string | undefined => {
  if (!value) {
    return undefined;
  }
  const trimmed = value.trim();
  return trimmed.length === 0 ? undefined : trimmed;
};

const coerceQueryId = (raw: string | string[] | undefined): string | undefined => {
  if (raw === undefined) {
    return undefined;
  }

  const value = Array.isArray(raw) ? raw[0] : raw;
  if (typeof value !== 'string') {
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed.length === 0 ? undefined : trimmed;
};

const extractWorkspaceId = (req: AuthenticatedRequest): string => {
  const headerValue = coerceHeader(req.get(HEADER_WORKSPACE_ID));
  if (headerValue) {
    return headerValue;
  }
  const authWorkspaceId = req.auth?.orgId;
  return authWorkspaceId ?? DEFAULT_WORKSPACE_ID;
};

const buildSubscriptionScopes = (req: AuthenticatedRequest): SubscriptionScope[] => {
  const projectId = coerceQueryId(req.query.projectId as string | string[] | undefined);
  const documentId = coerceQueryId(req.query.documentId as string | string[] | undefined);
  const sectionId = coerceQueryId(req.query.sectionId as string | string[] | undefined);

  const scopes = new Map<string, SubscriptionScope>();
  const track = (scope: SubscriptionScope) => {
    const key = `${scope.topic}:${scope.resourceId ?? '*'}`;
    scopes.set(key, scope);
  };

  if (projectId) {
    track({ topic: 'project.lifecycle', resourceId: projectId });
  } else {
    track({ topic: 'project.lifecycle' });
  }

  if (documentId) {
    track({ topic: 'quality-gate.progress', resourceId: documentId });
    track({ topic: 'quality-gate.summary', resourceId: documentId });
  } else {
    track({ topic: 'quality-gate.progress' });
    track({ topic: 'quality-gate.summary' });
  }

  if (sectionId) {
    track({ topic: 'section.conflict', resourceId: sectionId });
    track({ topic: 'section.diff', resourceId: sectionId });
  } else {
    track({ topic: 'section.conflict' });
    track({ topic: 'section.diff' });
  }

  if (projectId || documentId || sectionId) {
    return Array.from(scopes.values());
  }

  return DEFAULT_TOPIC_SCOPES;
};

const writeSseEvent = (
  res: Response & { flush?: () => void },
  eventName: string,
  data: unknown,
  id?: string | null
): void => {
  if (id) {
    res.write(`id: ${id}\n`);
  }
  res.write(`event: ${eventName}\n`);
  res.write(`data: ${JSON.stringify(data)}\n\n`);
  res.flush?.();
};

type ScopeValidationResult =
  | { ok: true }
  | {
      ok: false;
      error: {
        status: number;
        code: 'UNAUTHORIZED' | 'SCOPE_FORBIDDEN' | 'INTERNAL_ERROR';
        message: string;
        reason: string;
      };
      context: {
        userId: string | 'anonymous';
      };
    };

const validateScopeAuthorization = async (
  req: AuthenticatedRequest,
  scopes: SubscriptionScope[]
): Promise<ScopeValidationResult> => {
  const userId = req.user?.userId ?? req.auth?.userId;
  if (!userId) {
    return {
      ok: false,
      error: {
        status: 401,
        code: 'UNAUTHORIZED',
        message: 'Authentication required to stream events.',
        reason: 'missing_user',
      },
      context: {
        userId: 'anonymous',
      },
    };
  }

  const services = req.services;
  if (!services) {
    return {
      ok: false,
      error: {
        status: 500,
        code: 'INTERNAL_ERROR',
        message: 'Event stream dependencies unavailable.',
        reason: 'missing_service_container',
      },
      context: { userId },
    };
  }

  const projectRepository = resolveRepository<ProjectRepositoryImpl>(req, 'projectRepository');
  if (!projectRepository) {
    return {
      ok: false,
      error: {
        status: 500,
        code: 'INTERNAL_ERROR',
        message: 'Project repository unavailable for scope validation.',
        reason: 'missing_project_repository',
      },
      context: { userId },
    };
  }

  const projectIds = new Set<string>();
  const documentIds = new Set<string>();
  const sectionIds = new Set<string>();

  for (const scope of scopes) {
    if (!scope.resourceId) {
      continue;
    }

    switch (scope.topic) {
      case 'project.lifecycle':
        projectIds.add(scope.resourceId);
        break;
      case 'quality-gate.progress':
      case 'quality-gate.summary':
        documentIds.add(scope.resourceId);
        break;
      case 'section.conflict':
      case 'section.diff':
        sectionIds.add(scope.resourceId);
        break;
      default:
        // Ignore unknown topics for forward compatibility
        break;
    }
  }

  const projectCache = new Map<
    string,
    Awaited<ReturnType<ProjectRepositoryImpl['findByIdIncludingArchived']>>
  >();
  const documentCache = new Map<string, Awaited<ReturnType<DocumentRepositoryImpl['findById']>>>();

  const loadProject = async (projectId: string) => {
    if (projectCache.has(projectId)) {
      return projectCache.get(projectId) ?? null;
    }
    const project = await projectRepository.findByIdIncludingArchived(projectId);
    projectCache.set(projectId, project);
    return project ?? null;
  };

  const userCanAccessProject = (
    project: Awaited<ReturnType<ProjectRepositoryImpl['findByIdIncludingArchived']>> | null,
    currentUserId: string
  ): boolean => {
    if (!project) {
      return false;
    }
    return project.ownerUserId === currentUserId;
  };

  let cachedDocumentRepository: DocumentRepositoryImpl | null = null;
  let cachedSectionRepository: SectionRepositoryImpl | null = null;

  const ensureDocumentRepository = () => {
    if (!cachedDocumentRepository) {
      cachedDocumentRepository = resolveRepository<DocumentRepositoryImpl>(
        req,
        'documentRepository'
      );
    }
    return cachedDocumentRepository;
  };

  const ensureSectionRepository = () => {
    if (!cachedSectionRepository) {
      cachedSectionRepository = resolveRepository<SectionRepositoryImpl>(req, 'sectionRepository');
    }
    return cachedSectionRepository;
  };

  for (const projectId of projectIds) {
    const project = await loadProject(projectId);
    if (!userCanAccessProject(project, userId)) {
      return {
        ok: false,
        error: {
          status: 403,
          code: 'SCOPE_FORBIDDEN',
          message: 'Requested scope is not authorized for this user.',
          reason: 'project_scope_forbidden',
        },
        context: { userId },
      };
    }
  }

  if (documentIds.size > 0) {
    const documentRepository = ensureDocumentRepository();
    if (!documentRepository) {
      return {
        ok: false,
        error: {
          status: 500,
          code: 'INTERNAL_ERROR',
          message: 'Document repository unavailable for scope validation.',
          reason: 'missing_document_repository',
        },
        context: { userId },
      };
    }

    const loadDocument = async (documentId: string) => {
      if (documentCache.has(documentId)) {
        return documentCache.get(documentId) ?? null;
      }
      const document = await documentRepository.findById(documentId);
      documentCache.set(documentId, document);
      return document ?? null;
    };

    for (const documentId of documentIds) {
      const document = await loadDocument(documentId);
      if (!document) {
        continue;
      }

      const project = await loadProject(document.projectId);
      if (project && !userCanAccessProject(project, userId)) {
        return {
          ok: false,
          error: {
            status: 403,
            code: 'SCOPE_FORBIDDEN',
            message: 'Requested scope is not authorized for this user.',
            reason: 'document_project_forbidden',
          },
          context: { userId },
        };
      }
    }
  }

  if (sectionIds.size > 0) {
    const sectionRepository = ensureSectionRepository();
    if (!sectionRepository) {
      return {
        ok: false,
        error: {
          status: 500,
          code: 'INTERNAL_ERROR',
          message: 'Section repository unavailable for scope validation.',
          reason: 'missing_section_repository',
        },
        context: { userId },
      };
    }

    const documentRepository = ensureDocumentRepository();
    if (!documentRepository) {
      return {
        ok: false,
        error: {
          status: 500,
          code: 'INTERNAL_ERROR',
          message: 'Document repository unavailable for scope validation.',
          reason: 'missing_document_repository_for_sections',
        },
        context: { userId },
      };
    }

    const loadDocumentForSection = async (documentId: string): Promise<Document | null> => {
      if (documentCache.has(documentId)) {
        return documentCache.get(documentId) ?? null;
      }
      const document = await documentRepository.findById(documentId);
      documentCache.set(documentId, document);
      return document ?? null;
    };

    for (const sectionId of sectionIds) {
      const section = await sectionRepository.findById(sectionId);
      if (!section) {
        continue;
      }

      const document = await loadDocumentForSection(section.docId);
      if (!document) {
        continue;
      }

      const project = await loadProject(document.projectId);
      if (project && !userCanAccessProject(project, userId)) {
        return {
          ok: false,
          error: {
            status: 403,
            code: 'SCOPE_FORBIDDEN',
            message: 'Requested scope is not authorized for this user.',
            reason: 'section_project_forbidden',
          },
          context: { userId },
        };
      }
    }
  }

  return { ok: true };
};

const resolveRepository = <T>(req: AuthenticatedRequest, token: string): T | null => {
  const services = req.services;
  if (!services?.has(token)) {
    return null;
  }

  try {
    return services.get<T>(token);
  } catch {
    return null;
  }
};
