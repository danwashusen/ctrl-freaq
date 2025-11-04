import type { Logger } from 'pino';

import type { EventStreamConfig } from '../../config/event-stream.js';
import type { EventBroker } from '../event-stream/event-broker.js';
import type { AuthenticatedRequest } from '../../middleware/auth.js';

const WORKSPACE_HEADER = 'X-Workspace-Id';
const DEFAULT_WORKSPACE_ID = 'workspace-default';

export interface EventStreamResolutionContext {
  logger: Logger | undefined;
  context?: Record<string, unknown>;
}

export interface ResolvedEventStream {
  broker: EventBroker;
  config: EventStreamConfig;
  workspaceId: string;
}

const coerceWorkspaceId = (value: string | null | undefined): string | null => {
  if (!value) {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

export const resolveWorkspaceId = (req: AuthenticatedRequest): string => {
  const headerWorkspace = coerceWorkspaceId(req.get(WORKSPACE_HEADER));
  if (headerWorkspace) {
    return headerWorkspace;
  }
  const authWorkspace = coerceWorkspaceId(req.auth?.orgId ?? null);
  return authWorkspace ?? DEFAULT_WORKSPACE_ID;
};

export const resolveEventStream = (
  req: AuthenticatedRequest,
  { logger, context }: EventStreamResolutionContext
): ResolvedEventStream | null => {
  const container = req.services;
  if (!container?.has('eventStreamConfig') || !container.has('eventBroker')) {
    return null;
  }

  try {
    const config = container.get<EventStreamConfig>('eventStreamConfig');
    if (!config.enabled) {
      return null;
    }

    const broker = container.get<EventBroker>('eventBroker');
    const workspaceId = resolveWorkspaceId(req);

    return { broker, config, workspaceId };
  } catch (error) {
    logger?.warn(
      {
        requestId: req.requestId,
        ...(context ?? {}),
        error: error instanceof Error ? error.message : String(error),
      },
      'Failed to resolve event stream dependencies for quality gate events'
    );
    return null;
  }
};
