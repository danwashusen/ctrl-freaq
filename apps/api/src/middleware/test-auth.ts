import type { NextFunction, Response } from 'express';
import type { AuthenticatedRequest } from './auth.js';
import { isTestRuntime } from '../utils/runtime-env.js';

/**
 * Default mock bearer token used across legacy tests.
 */
export const MOCK_JWT_TOKEN = 'mock-jwt-token';

/**
 * Mock bearer token representing a template manager with elevated permissions.
 */
export const TEMPLATE_MANAGER_JWT_TOKEN = 'template-manager-mock-token';

/**
 * Deterministic Clerk user IDs consumed by repository tests and fixtures.
 */
export const DEFAULT_TEST_USER_ID = 'user_2abc123def456';
export const TEMPLATE_MANAGER_USER_ID = 'user_mgr_template_admin';

const TEMPLATE_MANAGER_PERMISSIONS = ['templates:manage'];

/**
 * Test-only auth shim to ease contract/integration testing without Clerk.
 * If running under the test runtime flag and an Authorization header is present, populate req.auth.
 */
export function testAuthShim(req: AuthenticatedRequest, _res: Response, next: NextFunction): void {
  if (isTestRuntime()) {
    const auth = req.headers.authorization || req.headers.Authorization;
    if (auth && typeof auth === 'string' && auth.toLowerCase().startsWith('bearer')) {
      const token = auth.slice('bearer'.length).trim();
      if (token === MOCK_JWT_TOKEN) {
        req.auth = req.auth || {};
        req.auth.userId = req.auth.userId || DEFAULT_TEST_USER_ID;
      } else if (token === TEMPLATE_MANAGER_JWT_TOKEN) {
        req.auth = req.auth || {};
        req.auth.userId = TEMPLATE_MANAGER_USER_ID;
        req.auth.orgRole = 'template_manager';
        req.auth.orgPermissions = TEMPLATE_MANAGER_PERMISSIONS;
      }
    }
  }
  next();
}
