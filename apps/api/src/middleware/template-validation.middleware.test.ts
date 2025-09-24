import { describe, expect, it, vi } from 'vitest';
import type { Response, NextFunction } from 'express';

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
import { TemplateValidationFailedError } from '../services/template-upgrade.service.js';

describe('templateValidationMiddleware', () => {
  function createResponseMock() {
    const res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
      locals: {} as Record<string, unknown>,
    } as unknown as Response;
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
      evaluate: vi.fn().mockResolvedValue({
        document: {
          ...document,
          templateVersion: '10.1.0',
          templateSchemaHash: 'hash-v11',
        },
        template,
        migration: succeededMigration,
        decision: upgradeDecision,
      }),
    };

    const logger = {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    };

    const { req, services } = createRequestMock();
    services.set('templateUpgradeService', service);
    services.set('logger', logger);

    const res = createResponseMock();
    const next = vi.fn();

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
      evaluate: vi.fn().mockResolvedValue({
        document,
        template,
        migration: null,
        decision: blockedDecision,
      }),
    };

    const logger = {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    };

    const { req, services } = createRequestMock();
    services.set('templateUpgradeService', service);
    services.set('logger', logger);

    const res = createResponseMock();
    const next = vi.fn();

    const middleware = createTemplateValidationMiddleware();
    await middleware(req, res, next as unknown as NextFunction);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.json).toHaveBeenCalled();
    const payload = (res.json as ReturnType<typeof vi.fn>).mock.calls[0]?.[0] as Record<
      string,
      unknown
    >;
    expect(payload).toMatchObject({
      error: 'TEMPLATE_VERSION_REMOVED',
      templateId: 'architecture',
      missingVersion: '20.0.0',
    });
  });

  it('returns validation failure response when service throws TemplateValidationFailedError', async () => {
    const service = {
      evaluate: vi.fn().mockRejectedValue(
        new TemplateValidationFailedError('Validation failed', {
          issues: [
            {
              path: ['introduction'],
              message: 'Executive Summary is required',
            },
          ],
        })
      ),
    };

    const logger = {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    };

    const { req, services } = createRequestMock();
    services.set('templateUpgradeService', service);
    services.set('logger', logger);

    const res = createResponseMock();
    const next = vi.fn();

    const middleware = createTemplateValidationMiddleware();
    await middleware(req, res, next as unknown as NextFunction);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(422);
    const payload = (res.json as ReturnType<typeof vi.fn>).mock.calls[0]?.[0] as Record<
      string,
      unknown
    >;
    expect(payload).toMatchObject({
      error: 'TEMPLATE_VALIDATION_FAILED',
      details: expect.anything(),
    });
  });
});
