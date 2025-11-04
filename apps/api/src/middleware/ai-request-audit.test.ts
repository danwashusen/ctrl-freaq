import { describe, expect, it } from 'vitest';
import type { NextFunction, Request, Response } from 'express';
import { mockAsyncFn, mockFn, type MockedFnWithArgs } from '@ctrl-freaq/test-support';

import { createAIRequestAuditMiddleware, type AIRequestAuditOptions } from './ai-request-audit';

type ResponseMock = Response & {
  status: MockedFnWithArgs<[number], Response>;
  json: MockedFnWithArgs<[unknown], Response>;
  locals: Record<string, unknown>;
};

type LimiterFn = AIRequestAuditOptions['limiter'];

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

  const buildResponse = (): ResponseMock => {
    const status = mockFn<(code: number) => Response>();
    const json = mockFn<(payload: unknown) => Response>();
    const res = { locals: {}, status, json } as unknown as ResponseMock;
    status.mockReturnValue(res);
    json.mockReturnValue(res);
    return res;
  };

  const buildNext = (): NextFunction => mockFn<(err?: any) => void>() as unknown as NextFunction;

  it('enforces per-section intent rate limiting', async () => {
    const limiter = mockAsyncFn<LimiterFn>();
    limiter.mockResolvedValueOnce({ allowed: true, remaining: 4 });
    limiter.mockResolvedValueOnce({ allowed: false, remaining: 0, retryAfterMs: 30000 });

    const logger: AIRequestAuditOptions['logger'] = {
      info: mockFn<(payload: Record<string, unknown>, message?: string) => void>(),
      warn: mockFn<(payload: Record<string, unknown>, message?: string) => void>(),
      error: mockFn<(payload: Record<string, unknown>, message?: string) => void>(),
    };

    const middleware = createAIRequestAuditMiddleware({
      limiter,
      logger,
      emitTelemetry: mockFn<(event: string, payload: Record<string, unknown>) => void>(),
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
    const limiter = mockAsyncFn<LimiterFn>();
    limiter.mockResolvedValue({ allowed: true, remaining: 4 });
    const emitTelemetry = mockFn<(event: string, payload: Record<string, unknown>) => void>();
    const logger: AIRequestAuditOptions['logger'] = {
      info: mockFn<(payload: Record<string, unknown>, message?: string) => void>(),
      warn: mockFn<(payload: Record<string, unknown>, message?: string) => void>(),
      error: mockFn<(payload: Record<string, unknown>, message?: string) => void>(),
    };

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
