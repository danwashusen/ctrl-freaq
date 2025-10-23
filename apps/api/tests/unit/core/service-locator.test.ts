import { EventEmitter } from 'node:events';

import pino from 'pino';
import type { Database } from 'better-sqlite3';
import type { Request, Response } from 'express';
import { describe, expect, test, vi } from 'vitest';

import { createServiceLocatorMiddleware } from '../../../src/core/service-locator.js';
import { SimpleAuthService } from '../../../src/services/simple-auth.service.js';

describe('createServiceLocatorMiddleware', () => {
  test('registers simple auth service when provided', () => {
    const logger = pino({ enabled: false });
    const simpleAuthService = new SimpleAuthService({ userFilePath: '/tmp/simple-auth.yaml' });

    const middleware = createServiceLocatorMiddleware(logger, {} as Database, {
      simpleAuthService,
    });

    const req = {
      headers: {},
    } as unknown as Request;
    const res = new EventEmitter() as unknown as Response;
    const next = vi.fn();

    middleware(req, res, next);

    expect(next).toHaveBeenCalledOnce();
    expect(req.services?.get('simpleAuthService')).toBe(simpleAuthService);

    res.emit('finish');
  });
});
