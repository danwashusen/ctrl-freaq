import { describe, expect, it } from 'vitest';
import type { Response, NextFunction } from 'express';
import { mockAsyncFn, mockFn, type MockedFnWithArgs } from '@ctrl-freaq/test-support';
import type { Logger } from 'pino';

import type { AuthenticatedRequest } from './auth.js';
import { createTemplateValidationMiddleware } from './template-validation.js';
import {
  DocumentTemplateMigrationStatus,
  DocumentTemplateStatus,
  type Document,
  type DocumentTemplate,
  type DocumentTemplateMigration,
} from '@ctrl-freaq/shared-data';
import type { TemplateUpgradeDecision } from '@ctrl-freaq/template-resolver';
import {
  TemplateUpgradeService,
  TemplateValidationFailedError,
} from '../services/template-upgrade.service.js';

type EvaluateFn = OmitThisParameter<TemplateUpgradeService['evaluate']>;

type ResponseMock = Response & {
  status: MockedFnWithArgs<[number], Response>;
  json: MockedFnWithArgs<[unknown], Response>;
  locals: Record<string, unknown>;
};

describe('templateValidationMiddleware', () => {
  function createResponseMock(): ResponseMock {
    const status = mockFn<(code: number) => Response>();
    const json = mockFn<(payload: unknown) => Response>();
    const res = { status, json, locals: {} as Record<string, unknown> } as unknown as ResponseMock;
    status.mockReturnValue(res);
    json.mockReturnValue(res);
    return res;
  }

  function createRequestMock(overrides?: Partial<AuthenticatedRequest>) {
    const services = new Map<string, unknown>();
    const req = {
      params: { documentId: 'doc-upgrade-1' },
      requestId: 'req_123',
      user: { userId: 'user_editor_1' },
      services: {
        get: (name: string) => {
          if (!services.has(name)) {
            throw new Error(`Service not registered: ${name}`);
          }
          return services.get(name);
        },
      },
      ...overrides,
    } as AuthenticatedRequest & { services: { get<T>(name: string): T } };

    return { req, services };
  }

  const createdAt = new Date('2025-01-01T00:00:00Z');
  const updatedAt = new Date('2025-01-02T00:00:00Z');

  const document: Document = {
    id: 'doc-upgrade-1',
    projectId: 'proj_auto_upgrade',
    title: 'Legacy Architecture Doc',
    content: {
      introduction: 'Legacy summary',
      system_overview: {
        architecture_diagram: 'https://ctrl-freaq.dev/diagram.png',
        tech_stack: 'react',
      },
    },
    templateId: 'architecture',
    templateVersion: '10.0.0',
    templateSchemaHash: 'hash-v10',
    createdAt,
    createdBy: 'user_mgr_template_admin',
    updatedAt,
    updatedBy: 'user_mgr_template_admin',
    deletedAt: null,
    deletedBy: null,
  };

  const template: DocumentTemplate = {
    id: 'architecture',
    name: 'Architecture Template',
    description: 'Architecture document layout',
    documentType: 'architecture',
    activeVersionId: 'architecture@10.1.0',
    status: DocumentTemplateStatus.ACTIVE,
    defaultAggressiveness: null,
    createdAt,
    createdBy: 'user_mgr_template_admin',
    updatedAt,
    updatedBy: 'user_mgr_template_admin',
    deletedAt: null,
    deletedBy: null,
  };

  const succeededMigration: DocumentTemplateMigration = {
    id: 'migration-1',
    documentId: document.id,
    fromVersion: '10.0.0',
    toVersion: '10.1.0',
    status: DocumentTemplateMigrationStatus.SUCCEEDED,
    validationErrors: undefined,
    initiatedBy: 'user_editor_1',
    initiatedAt: new Date('2025-01-02T00:05:00Z'),
    completedAt: new Date('2025-01-02T00:05:01Z'),
  };

  it('auto-upgrades documents when service completes upgrade', async () => {
    const upgradeDecision: TemplateUpgradeDecision = {
      action: 'upgrade',
      reason: 'out_of_date',
      currentVersion: {
        templateId: 'architecture',
        version: '10.0.0',
        schemaHash: 'hash-v10',
        status: 'draft',
      },
      targetVersion: {
        templateId: 'architecture',
        version: '10.1.0',
        schemaHash: 'hash-v11',
        status: 'active',
      },
    };

    const service = {
      evaluate: mockAsyncFn<EvaluateFn>(),
    };
    service.evaluate.mockResolvedValue({
      document: {
        ...document,
        templateVersion: '10.1.0',
        templateSchemaHash: 'hash-v11',
      },
      template,
      migration: succeededMigration,
      decision: upgradeDecision,
    });

    const logger = {
      info: mockFn<(payload: Record<string, unknown>, message?: string) => void>(),
      warn: mockFn<(payload: Record<string, unknown>, message?: string) => void>(),
      error: mockFn<(payload: Record<string, unknown>, message?: string) => void>(),
    } satisfies Pick<Logger, 'info' | 'warn' | 'error'>;

    const { req, services } = createRequestMock();
    services.set('templateUpgradeService', service);
    services.set('logger', logger);

    const res = createResponseMock();
    const next = mockFn<(err?: any) => void>();

    const middleware = createTemplateValidationMiddleware();
    await middleware(req, res, next as unknown as NextFunction);

    expect(service.evaluate).toHaveBeenCalledWith({
      documentId: 'doc-upgrade-1',
      requestId: 'req_123',
      userId: 'user_editor_1',
    });
    expect(next).toHaveBeenCalledTimes(1);
    expect(res.status).not.toHaveBeenCalled();
    expect(res.locals.document).toMatchObject({ templateVersion: '10.1.0' });
    expect(res.locals.templateMigration).toEqual(succeededMigration);
    expect(res.locals.templateDecision).toEqual(upgradeDecision);
  });

  it('blocks editing when template version has been removed', async () => {
    const blockedDecision: TemplateUpgradeDecision = {
      action: 'blocked',
      reason: 'removed_version',
      requestedVersion: {
        templateId: 'architecture',
        version: '20.0.0',
        schemaHash: 'hash-v20',
      },
    };

    const service = {
      evaluate: mockAsyncFn<EvaluateFn>(),
    };
    service.evaluate.mockResolvedValue({
      document,
      template,
      migration: null,
      decision: blockedDecision,
    });

    const logger = {
      info: mockFn<(payload: Record<string, unknown>, message?: string) => void>(),
      warn: mockFn<(payload: Record<string, unknown>, message?: string) => void>(),
      error: mockFn<(payload: Record<string, unknown>, message?: string) => void>(),
    } satisfies Pick<Logger, 'info' | 'warn' | 'error'>;

    const { req, services } = createRequestMock();
    services.set('templateUpgradeService', service);
    services.set('logger', logger);

    const res = createResponseMock();
    const next = mockFn<(err?: any) => void>();

    const middleware = createTemplateValidationMiddleware();
    await middleware(req, res, next as unknown as NextFunction);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.json).toHaveBeenCalled();
    const payload = res.json.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(payload).toMatchObject({
      error: 'TEMPLATE_VERSION_REMOVED',
      templateId: 'architecture',
      missingVersion: '20.0.0',
    });
  });

  it('returns validation failure response when service throws TemplateValidationFailedError', async () => {
    const service = {
      evaluate: mockAsyncFn<EvaluateFn>(),
    };
    service.evaluate.mockRejectedValue(
      new TemplateValidationFailedError('Validation failed', {
        issues: [
          {
            path: ['introduction'],
            message: 'Executive Summary is required',
          },
        ],
      })
    );

    const logger = {
      info: mockFn<(payload: Record<string, unknown>, message?: string) => void>(),
      warn: mockFn<(payload: Record<string, unknown>, message?: string) => void>(),
      error: mockFn<(payload: Record<string, unknown>, message?: string) => void>(),
    } satisfies Pick<Logger, 'info' | 'warn' | 'error'>;

    const { req, services } = createRequestMock();
    services.set('templateUpgradeService', service);
    services.set('logger', logger);

    const res = createResponseMock();
    const next = mockFn<(err?: any) => void>();

    const middleware = createTemplateValidationMiddleware();
    await middleware(req, res, next as unknown as NextFunction);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(422);
    const payload = res.json.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(payload).toMatchObject({
      error: 'TEMPLATE_VALIDATION_FAILED',
      details: expect.anything(),
    });
  });
});
