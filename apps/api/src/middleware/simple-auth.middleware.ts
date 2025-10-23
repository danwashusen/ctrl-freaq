import type { NextFunction, Response } from 'express';
import type { Logger } from 'pino';

import type { AuthenticatedRequest } from './auth.js';
import {
  SimpleAuthService,
  SimpleAuthServiceError,
  type SimpleAuthUser,
} from '../services/simple-auth.service.js';
import { MOCK_JWT_TOKEN, TEMPLATE_MANAGER_JWT_TOKEN } from './test-auth.js';
import { isTestRuntime } from '../utils/runtime-env.js';

const SIMPLE_AUTH_SCHEME = 'bearer';
const SIMPLE_AUTH_PREFIX = 'simple:';
const SIMPLE_AUTH_COOKIE = 'simple_auth_token';

const toDisplayName = (user: SimpleAuthUser): string | undefined => {
  if (user.first_name || user.last_name) {
    return [user.first_name, user.last_name].filter(Boolean).join(' ').trim() || undefined;
  }
  return undefined;
};

const resolveAuthorizationHeader = (req: AuthenticatedRequest): string | undefined => {
  const header = req.headers.authorization ?? (req.headers.Authorization as string | undefined);
  if (!header || typeof header !== 'string') {
    return undefined;
  }
  return header;
};

const resolveCookieToken = (req: AuthenticatedRequest): string | undefined => {
  const rawCookieHeader = req.headers.cookie;
  if (!rawCookieHeader || typeof rawCookieHeader !== 'string') {
    return undefined;
  }

  const segments = rawCookieHeader.split(';');
  for (const segment of segments) {
    const [namePart, ...valueParts] = segment.split('=');
    if (!namePart) {
      continue;
    }
    if (namePart.trim() !== SIMPLE_AUTH_COOKIE) {
      continue;
    }
    const value = valueParts.join('=').trim();
    if (!value) {
      return undefined;
    }
    try {
      return decodeURIComponent(value);
    } catch {
      return value;
    }
  }

  return undefined;
};

const remapTestTokenToSimpleUser = async (
  token: string,
  service: SimpleAuthService
): Promise<string | null> => {
  if (!isTestRuntime()) {
    return null;
  }

  const preferById = (users: SimpleAuthUser[], envKey: string | undefined) =>
    envKey ? (users.find(user => user.id === envKey) ?? null) : null;

  if (token !== MOCK_JWT_TOKEN && token !== TEMPLATE_MANAGER_JWT_TOKEN) {
    return null;
  }

  let users: SimpleAuthUser[];
  try {
    users = await service.listUsers();
  } catch {
    return null;
  }
  if (users.length === 0) {
    return null;
  }

  if (token === TEMPLATE_MANAGER_JWT_TOKEN) {
    const preferredManagerId = process.env.SIMPLE_AUTH_TEMPLATE_MANAGER_USER_ID?.trim();
    const managerUser =
      preferById(users, preferredManagerId) ??
      users.find(
        user =>
          Array.isArray(user.org_permissions) && user.org_permissions.includes('templates:manage')
      ) ??
      users.find(user => (user.org_role ?? '').toLowerCase() === 'template_manager') ??
      null;
    const selected = managerUser ?? users[0];
    if (!selected) {
      return null;
    }
    return `${SIMPLE_AUTH_PREFIX}${selected.id}`;
  }

  const preferredUserId = process.env.SIMPLE_AUTH_TEST_USER_ID?.trim();
  const selectedUser = preferById(users, preferredUserId) ?? users[0];
  if (!selectedUser) {
    return null;
  }
  return `${SIMPLE_AUTH_PREFIX}${selectedUser.id}`;
};

const resolveService = (req: AuthenticatedRequest): SimpleAuthService => {
  const services = req.services;
  if (!services?.has('simpleAuthService')) {
    throw new SimpleAuthServiceError('Simple auth service is not registered for this request');
  }

  return services.get<SimpleAuthService>('simpleAuthService');
};

const resolveLogger = (req: AuthenticatedRequest): Logger | undefined => {
  try {
    return req.services?.get<Logger>('logger');
  } catch {
    return undefined;
  }
};

const buildErrorPayload = (message: string, req: AuthenticatedRequest) => ({
  error: 'UNAUTHORIZED' as const,
  message,
  requestId: req.requestId ?? 'unknown',
  timestamp: new Date().toISOString(),
});

export const simpleAuthMiddleware = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  const logger = resolveLogger(req);
  const authorizationHeader = resolveAuthorizationHeader(req);
  const cookieToken = resolveCookieToken(req);
  const authorization =
    authorizationHeader ?? (cookieToken ? `${SIMPLE_AUTH_SCHEME} ${cookieToken}` : undefined);

  if (!authorization) {
    const payload = buildErrorPayload('Simple auth token is required', req);
    res.status(401).json(payload);
    return;
  }

  const [schemeRaw, rawToken] = authorization.split(' ', 2);
  const scheme = schemeRaw?.toLowerCase();
  let tokenValue = rawToken?.trim() ?? '';

  try {
    const service = resolveService(req);

    if (
      scheme === SIMPLE_AUTH_SCHEME &&
      (tokenValue === MOCK_JWT_TOKEN || tokenValue === TEMPLATE_MANAGER_JWT_TOKEN) &&
      req.services?.has('simpleAuthService')
    ) {
      const remapped = await remapTestTokenToSimpleUser(tokenValue, service);
      if (remapped) {
        tokenValue = remapped;
      } else {
        logger?.warn(
          {
            requestId: req.requestId ?? 'unknown',
            token: tokenValue,
          },
          'Unable to remap test auth token to a simple auth user'
        );
      }
    }

    if (
      scheme !== SIMPLE_AUTH_SCHEME ||
      !tokenValue ||
      !tokenValue.startsWith(SIMPLE_AUTH_PREFIX)
    ) {
      const payload = buildErrorPayload(
        'Simple auth token must use `Bearer simple:<userId>` format',
        req
      );
      res.status(401).json(payload);
      return;
    }

    const userId = tokenValue.slice(SIMPLE_AUTH_PREFIX.length);
    if (!userId) {
      const payload = buildErrorPayload('Simple auth token is missing a user identifier', req);
      res.status(401).json(payload);
      return;
    }

    const user = await service.getUserById(userId);

    if (!user) {
      const payload = buildErrorPayload(`Unknown simple auth user "${userId}"`, req);
      logger?.warn(
        {
          requestId: payload.requestId,
          userId,
          path: req.path,
          method: req.method,
          reason: 'unknown_simple_user',
        },
        'Simple auth token rejected'
      );
      res.status(401).json(payload);
      return;
    }

    logger?.info(
      {
        requestId: req.requestId ?? 'unknown',
        userId: user.id,
        path: req.path,
        method: req.method,
        event: 'simple_auth_login',
      },
      'Simple auth user authenticated'
    );

    req.auth = req.auth ?? {};
    req.auth.userId = user.id;
    req.auth.sessionId = req.auth.sessionId ?? `simple:${user.id}`;
    req.auth.orgRole = user.org_role ?? req.auth.orgRole;
    req.auth.orgPermissions = Array.isArray(user.org_permissions)
      ? user.org_permissions
      : (req.auth.orgPermissions ?? []);

    req.user = {
      userId: user.id,
      email: user.email,
      name: toDisplayName(user),
      imageUrl: user.image_url ?? undefined,
    };

    next();
  } catch (error) {
    if (error instanceof SimpleAuthServiceError) {
      logger?.error(
        {
          requestId: req.requestId ?? 'unknown',
          path: req.path,
          method: req.method,
          error: error.message,
        },
        'Simple auth middleware failed'
      );
      res.status(500).json({
        error: 'INTERNAL_ERROR',
        message: 'Failed to authenticate simple auth user',
        requestId: req.requestId ?? 'unknown',
        timestamp: new Date().toISOString(),
      });
      return;
    }

    next(error);
  }
};
