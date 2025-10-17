import { describe, expect, it, vi } from 'vitest';
import type { NextFunction, Request, Response } from 'express';

import { createAIRequestAuditMiddleware } from './ai-request-audit';

describe('createAIRequestAuditMiddleware', () => {
  const buildRequest = (
    overrides: Partial<Request> = {}
  ): Request & {
    requestId: string;
    auth?: { userId: string };
  } =>
    ({
      requestId: 'req-test-123',
      method: 'POST',
      originalUrl: '/api/documents/doc-1/sections/sec-1/co-author/proposal',
      params: {
        documentId: 'doc-1',
        sectionId: 'sec-1',
      },
      body: {
        intent: 'proposal',
        prompt: 'Rewrite the section',
        metadata: {
          citations: ['decision:architecture'],
        },
      },
      auth: { userId: 'user_staff_eng' },
      ip: '127.0.0.1',
      headers: {
        'user-agent': 'vitest',
      },
      ...overrides,
    }) as Request & { requestId: string; auth?: { userId: string } };

  const buildResponse = (): Response & {
    status: ReturnType<typeof vi.fn>;
    json: ReturnType<typeof vi.fn>;
    locals: Record<string, unknown>;
  } =>
    ({
      locals: {},
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
    }) as unknown as Response & {
      status: ReturnType<typeof vi.fn>;
      json: ReturnType<typeof vi.fn>;
      locals: Record<string, unknown>;
    };

  const buildNext = (): NextFunction => vi.fn();

  it('enforces per-section intent rate limiting', async () => {
    const limiter = vi
      .fn()
      .mockResolvedValueOnce({ allowed: true, remaining: 4 })
      .mockResolvedValueOnce({ allowed: false, retryAfterMs: 30000 });

    const logger = { info: vi.fn(), warn: vi.fn(), error: vi.fn() };

    const middleware = createAIRequestAuditMiddleware({
      limiter,
      logger,
      emitTelemetry: vi.fn(),
    });

    const req = buildRequest();
    const res = buildResponse();
    const next = buildNext();

    await middleware(req, res, next);
    expect(next).toHaveBeenCalledTimes(1);
    expect(res.status).not.toHaveBeenCalled();

    await middleware(req, res, next);
    expect(res.status).toHaveBeenCalledWith(429);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        code: 'RATE_LIMITED',
        retryAfterMs: 30000,
      })
    );
    expect(logger.warn).toHaveBeenCalledWith(
      expect.objectContaining({ reason: 'rate_limit', requestId: 'req-test-123' })
    );
  });

  it('redacts prompt content and emits telemetry events', async () => {
    const limiter = vi.fn().mockResolvedValue({ allowed: true, remaining: 4 });
    const emitTelemetry = vi.fn();
    const logger = { info: vi.fn(), warn: vi.fn(), error: vi.fn() };

    const middleware = createAIRequestAuditMiddleware({ limiter, emitTelemetry, logger });

    const req = buildRequest({
      body: {
        intent: 'analyze',
        prompt: 'Sensitive system architecture description',
        metadata: { citations: ['decision:security'] },
      },
    });
    const res = buildResponse();
    const next = buildNext();

    await middleware(req, res, next);

    expect(emitTelemetry).toHaveBeenCalledWith('coauthor.intent', {
      requestId: 'req-test-123',
      userId: 'user_staff_eng',
      triggeredBy: 'user_staff_eng',
      documentId: 'doc-1',
      sectionId: 'sec-1',
      intent: 'analyze',
      prompt: '[REDACTED]',
      citations: ['decision:security'],
    });
    expect(res.locals.aiAudit).toMatchObject({
      requestId: 'req-test-123',
      userId: 'user_staff_eng',
      intent: 'analyze',
      startedAt: expect.any(Date),
    });
    expect(next).toHaveBeenCalledTimes(1);
  });
});
