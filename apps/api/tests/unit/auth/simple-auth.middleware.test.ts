import { describe, expect, test, vi, beforeEach } from 'vitest';
import type { NextFunction, Response } from 'express';

import type { AuthenticatedRequest } from '../../../src/middleware/auth.js';
import { simpleAuthMiddleware } from '../../../src/middleware/simple-auth.middleware.js';
import type { SimpleAuthUser } from '../../../src/services/simple-auth.service.js';
import type { ServiceContainer } from '../../../src/core/service-locator.js';
import { MOCK_JWT_TOKEN, TEMPLATE_MANAGER_JWT_TOKEN } from '../../../src/middleware/test-auth.js';

const createResponse = () => {
  const res = {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
  };
  return res as unknown as Response;
};

const createNext = () => {
  const nextMock = vi.fn();
  const next: NextFunction = (...args) => {
    nextMock(...args);
  };
  return { next, nextMock };
};

const createRequest = (
  overrides: Partial<AuthenticatedRequest> & { services?: ServiceContainer } = {}
) => {
  const req = {
    headers: {},
    method: 'GET',
    path: '/api/v1/test',
    requestId: 'req_simple_123',
    services: overrides.services,
    ...overrides,
  } as AuthenticatedRequest & { services: ServiceContainer };

  return req;
};

describe('simpleAuthMiddleware', () => {
  const user: SimpleAuthUser = {
    id: 'user_alpha',
    email: 'alpha@example.com',
    first_name: 'Alpha',
    last_name: 'Tester',
    org_permissions: ['view:projects'],
  };
  const managerUser: SimpleAuthUser = {
    id: 'manager_user',
    email: 'manager@example.com',
    first_name: 'Morgan',
    last_name: 'Lee',
    org_role: 'template_manager',
    org_permissions: ['templates:manage'],
  };

  const getServiceMocks = (options: { users?: SimpleAuthUser[] } = {}) => {
    const users = options.users ?? [user];
    const simpleAuthService = {
      getUserById: vi.fn<(id: string) => Promise<SimpleAuthUser | undefined>>(),
      listUsers: vi.fn<() => Promise<SimpleAuthUser[]>>().mockResolvedValue(users),
    };

    const services: ServiceContainer = {
      get<T>(name: string) {
        if (name !== 'simpleAuthService') {
          throw new Error(`Unknown service requested: ${name}`);
        }
        return simpleAuthService as unknown as T;
      },
      has(name: string) {
        return name === 'simpleAuthService';
      },
      register: vi.fn(),
      dispose: vi.fn().mockResolvedValue(undefined),
    };

    return {
      simpleAuthService,
      services,
    };
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('attaches auth context for valid simple bearer tokens', async () => {
    const { simpleAuthService, services } = getServiceMocks();
    simpleAuthService.getUserById.mockResolvedValue(user);

    const req = createRequest({
      headers: {
        authorization: 'Bearer simple:user_alpha',
      },
      services,
    });
    const res = createResponse();
    const { next, nextMock } = createNext();

    await simpleAuthMiddleware(req, res, next);

    expect(simpleAuthService.getUserById).toHaveBeenCalledWith('user_alpha');
    expect(req.auth?.userId).toBe('user_alpha');
    expect(req.auth?.orgRole).toBeUndefined();
    expect(req.auth?.orgPermissions).toEqual(['view:projects']);
    expect(req.user).toEqual({
      userId: 'user_alpha',
      email: 'alpha@example.com',
      name: 'Alpha Tester',
      imageUrl: undefined,
    });
    expect(nextMock).toHaveBeenCalledOnce();
    expect(res.status).not.toHaveBeenCalled();
  });

  test('attaches auth context when token is provided via cookie', async () => {
    const { simpleAuthService, services } = getServiceMocks();
    simpleAuthService.getUserById.mockResolvedValue(user);

    const req = createRequest({
      headers: {
        cookie: `simple_auth_token=${encodeURIComponent('simple:user_alpha')}`,
      },
      services,
    });
    const res = createResponse();
    const { next, nextMock } = createNext();

    await simpleAuthMiddleware(req, res, next);

    expect(simpleAuthService.getUserById).toHaveBeenCalledWith('user_alpha');
    expect(req.auth?.userId).toBe('user_alpha');
    expect(req.user?.userId).toBe('user_alpha');
    expect(nextMock).toHaveBeenCalledOnce();
    expect(res.status).not.toHaveBeenCalled();
  });

  test('remaps mock JWT token to a simple auth user in test runtime', async () => {
    const { simpleAuthService, services } = getServiceMocks();
    simpleAuthService.getUserById.mockResolvedValue(user);

    const req = createRequest({
      headers: {
        authorization: `Bearer ${MOCK_JWT_TOKEN}`,
      },
      services,
    });
    const res = createResponse();
    const { next, nextMock } = createNext();

    await simpleAuthMiddleware(req, res, next);

    expect(simpleAuthService.listUsers).toHaveBeenCalledOnce();
    expect(simpleAuthService.getUserById).toHaveBeenCalledWith('user_alpha');
    expect(req.auth?.userId).toBe('user_alpha');
    expect(nextMock).toHaveBeenCalledOnce();
    expect(res.status).not.toHaveBeenCalled();
  });

  test('remaps template manager token to a user with manage permissions', async () => {
    const { simpleAuthService, services } = getServiceMocks({ users: [managerUser, user] });
    simpleAuthService.getUserById.mockResolvedValue(managerUser);

    const req = createRequest({
      headers: {
        authorization: `Bearer ${TEMPLATE_MANAGER_JWT_TOKEN}`,
      },
      services,
    });
    const res = createResponse();
    const { next, nextMock } = createNext();

    await simpleAuthMiddleware(req, res, next);

    expect(simpleAuthService.listUsers).toHaveBeenCalledOnce();
    expect(simpleAuthService.getUserById).toHaveBeenCalledWith('manager_user');
    expect(req.auth?.userId).toBe('manager_user');
    expect(req.auth?.orgPermissions).toEqual(managerUser.org_permissions);
    expect(nextMock).toHaveBeenCalledOnce();
    expect(res.status).not.toHaveBeenCalled();
  });

  test('responds with 401 when authorization header is missing', async () => {
    const { services } = getServiceMocks();

    const req = createRequest({
      headers: {},
      services,
    });
    const res = createResponse();
    const { next, nextMock } = createNext();

    await simpleAuthMiddleware(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    const payload = (res.json as unknown as ReturnType<typeof vi.fn>).mock.calls[0]?.[0] as
      | Record<string, unknown>
      | undefined;
    expect(payload).toMatchObject({
      error: 'UNAUTHORIZED',
    });
    expect(typeof payload?.message).toBe('string');
    expect(payload?.message).toMatch(/simple auth token/i);
    expect(nextMock).not.toHaveBeenCalled();
  });

  test('rejects tokens for unknown users', async () => {
    const { simpleAuthService, services } = getServiceMocks();
    simpleAuthService.getUserById.mockResolvedValue(undefined);

    const req = createRequest({
      headers: {
        authorization: 'Bearer simple:missing_user',
      },
      services,
    });
    const res = createResponse();
    const { next, nextMock } = createNext();

    await simpleAuthMiddleware(req, res, next);

    expect(simpleAuthService.getUserById).toHaveBeenCalledWith('missing_user');
    expect(res.status).toHaveBeenCalledWith(401);
    const payload = (res.json as unknown as ReturnType<typeof vi.fn>).mock.calls[0]?.[0] as
      | Record<string, unknown>
      | undefined;
    expect(payload).toMatchObject({
      error: 'UNAUTHORIZED',
    });
    expect(payload?.message).toMatch(/unknown simple auth user/i);
    expect(nextMock).not.toHaveBeenCalled();
  });

  test('rejects non-simple bearer tokens', async () => {
    const { services } = getServiceMocks();

    const req = createRequest({
      headers: {
        authorization: 'Bearer token-user_alpha',
      },
      services,
    });
    const res = createResponse();
    const { next, nextMock } = createNext();

    await simpleAuthMiddleware(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    const payload = (res.json as unknown as ReturnType<typeof vi.fn>).mock.calls[0]?.[0] as
      | Record<string, unknown>
      | undefined;
    expect(payload).toMatchObject({
      error: 'UNAUTHORIZED',
    });
    expect(payload?.message).toMatch(/simple auth token/i);
    expect(nextMock).not.toHaveBeenCalled();
  });
});
