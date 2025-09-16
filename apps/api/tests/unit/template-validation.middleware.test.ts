import { describe, expect, it, vi } from 'vitest';
import type { Response, NextFunction } from 'express';

import type { AuthenticatedRequest } from '../../src/middleware/auth.js';
import { createTemplateValidationMiddleware } from '../../src/middleware/template-validation.js';
import {
  DocumentTemplateMigrationStatus,
  DocumentTemplateStatus,
  type Document,
  type DocumentTemplate,
  type DocumentTemplateMigration,
  type DocumentTemplateMigrationRepositoryImpl,
  type DocumentTemplateRepositoryImpl,
  type DocumentRepositoryImpl,
  type TemplateVersion,
  type TemplateVersionRepositoryImpl,
  TemplateVersionStatus,
} from '@ctrl-freaq/shared-data';
import type { TemplateResolver } from '@ctrl-freaq/template-resolver';

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

  it('auto-upgrades documents when active version differs and validation passes', async () => {
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

    const updatedDocument: Document = {
      ...document,
      templateVersion: '10.1.0',
      templateSchemaHash: 'hash-v11',
      updatedBy: 'user_editor_1',
      updatedAt: new Date('2025-01-02T00:05:00Z'),
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

    const baseVersion: TemplateVersion = {
      id: 'architecture@10.0.0',
      templateId: 'architecture',
      version: '10.0.0',
      status: TemplateVersionStatus.DRAFT,
      changelog: null,
      schemaHash: 'hash-v10',
      schemaJson: { type: 'object', properties: { introduction: { type: 'string' } } },
      sectionsJson: {},
      sourcePath: '<memory>',
      publishedAt: null,
      publishedBy: null,
      deprecatedAt: null,
      deprecatedBy: null,
      createdAt,
      createdBy: 'user_mgr_template_admin',
      updatedAt,
      updatedBy: 'user_mgr_template_admin',
    };

    const activeVersion: TemplateVersion = {
      ...baseVersion,
      id: 'architecture@10.1.0',
      version: '10.1.0',
      status: TemplateVersionStatus.ACTIVE,
      schemaHash: 'hash-v11',
      schemaJson: { type: 'object', properties: { introduction: { type: 'string' } } },
      sectionsJson: { introduction: {} },
      updatedAt: new Date('2025-01-02T00:01:00Z'),
    };

    const pendingMigration: DocumentTemplateMigration = {
      id: 'migration-1',
      documentId: document.id,
      fromVersion: '10.0.0',
      toVersion: '10.1.0',
      status: DocumentTemplateMigrationStatus.PENDING,
      validationErrors: undefined,
      initiatedBy: 'user_editor_1',
      initiatedAt: new Date('2025-01-02T00:05:00Z'),
      completedAt: null,
    };

    const succeededMigration: DocumentTemplateMigration = {
      ...pendingMigration,
      status: DocumentTemplateMigrationStatus.SUCCEEDED,
      completedAt: new Date('2025-01-02T00:05:01Z'),
    };

    const documentRepository: Pick<DocumentRepositoryImpl, 'findById' | 'updateTemplateBinding'> = {
      findById: vi.fn().mockResolvedValue(document),
      updateTemplateBinding: vi.fn().mockResolvedValue(updatedDocument),
    } as unknown as DocumentRepositoryImpl;

    const templateRepository: Pick<DocumentTemplateRepositoryImpl, 'findById'> = {
      findById: vi.fn().mockResolvedValue(template),
    } as unknown as DocumentTemplateRepositoryImpl;

    const templateVersionRepository: Pick<TemplateVersionRepositoryImpl, 'listByTemplate' | 'findById' | 'findByTemplateAndVersion'>
      = {
        listByTemplate: vi.fn().mockResolvedValue([activeVersion, baseVersion]),
        findById: vi.fn().mockImplementation(async (id: string) => {
          if (id === activeVersion.id) return activeVersion;
          if (id === baseVersion.id) return baseVersion;
          return null;
        }),
        findByTemplateAndVersion: vi.fn().mockImplementation(async (_templateId: string, version: string) => {
          if (version === '10.1.0') return activeVersion;
          if (version === '10.0.0') return baseVersion;
          return null;
        }),
      } as unknown as TemplateVersionRepositoryImpl;

    const migrationRepository: Pick<
      DocumentTemplateMigrationRepositoryImpl,
      'logPending' | 'markSucceeded' | 'markFailed'
    > = {
      logPending: vi.fn().mockResolvedValue(pendingMigration),
      markSucceeded: vi.fn().mockResolvedValue(succeededMigration),
      markFailed: vi.fn(),
    } as unknown as DocumentTemplateMigrationRepositoryImpl;

    const templateResolver: TemplateResolver = {
      resolve: vi.fn().mockResolvedValue({
        cacheHit: false,
        template: {
          templateId: 'architecture',
          version: '10.1.0',
          schemaHash: 'hash-v11',
          sections: {},
          schema: activeVersion.schemaJson,
          validator: {
            safeParse: vi.fn().mockReturnValue({ success: true, data: document.content }),
          },
        },
      }),
      resolveActiveVersion: vi.fn(),
      clearCache: vi.fn(),
      getCacheStats: vi.fn().mockReturnValue({ hits: 0, misses: 1 }),
    } as unknown as TemplateResolver;

    const logger = {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    };

    const { req, services } = createRequestMock();
    services.set('documentRepository', documentRepository);
    services.set('documentTemplateRepository', templateRepository);
    services.set('templateVersionRepository', templateVersionRepository);
    services.set('documentTemplateMigrationRepository', migrationRepository);
    services.set('templateResolver', templateResolver);
    services.set('logger', logger);

    const res = createResponseMock();
    const next = vi.fn();

    const middleware = createTemplateValidationMiddleware();
    await middleware(req, res, next as unknown as NextFunction);

    expect(next).toHaveBeenCalledTimes(1);
    expect(res.status).not.toHaveBeenCalled();
    expect(documentRepository.updateTemplateBinding).toHaveBeenCalledWith({
      documentId: 'doc-upgrade-1',
      templateId: 'architecture',
      templateVersion: '10.1.0',
      templateSchemaHash: 'hash-v11',
      updatedBy: 'user_editor_1',
    });
    expect(migrationRepository.logPending).toHaveBeenCalledWith({
      documentId: 'doc-upgrade-1',
      fromVersion: '10.0.0',
      toVersion: '10.1.0',
      initiatedBy: 'user_editor_1',
    });
    expect(migrationRepository.markSucceeded).toHaveBeenCalledWith({ migrationId: pendingMigration.id });
    expect(res.locals.document).toEqual(updatedDocument);
    expect(res.locals.templateMigration).toEqual(succeededMigration);
    expect(res.locals.templateDecision).toMatchObject({
      action: 'upgrade',
      reason: 'out_of_date',
    });
  });

  it('blocks editing when template version has been removed', async () => {
    const createdAt = new Date('2025-01-01T00:00:00Z');

    const document: Document = {
      id: 'doc-removed',
      projectId: 'proj_removed',
      title: 'Removed Template Doc',
      content: { introduction: 'legacy content' },
      templateId: 'architecture',
      templateVersion: '20.0.0',
      templateSchemaHash: 'hash-v20',
      createdAt,
      createdBy: 'user_mgr',
      updatedAt: createdAt,
      updatedBy: 'user_mgr',
      deletedAt: null,
      deletedBy: null,
    };

    const template: DocumentTemplate = {
      id: 'architecture',
      name: 'Architecture Template',
      description: 'Architecture',
      documentType: 'architecture',
      activeVersionId: 'architecture@19.0.0',
      status: DocumentTemplateStatus.ACTIVE,
      defaultAggressiveness: null,
      createdAt,
      createdBy: 'user_mgr',
      updatedAt: createdAt,
      updatedBy: 'user_mgr',
      deletedAt: null,
      deletedBy: null,
    };

    const availableVersion: TemplateVersion = {
      id: 'architecture@19.0.0',
      templateId: 'architecture',
      version: '19.0.0',
      status: TemplateVersionStatus.ACTIVE,
      changelog: null,
      schemaHash: 'hash-v19',
      schemaJson: { type: 'object', properties: { introduction: { type: 'string' } } },
      sectionsJson: {},
      sourcePath: '<memory>',
      publishedAt: new Date('2025-01-01T00:00:00Z'),
      publishedBy: 'user_mgr',
      deprecatedAt: null,
      deprecatedBy: null,
      createdAt,
      createdBy: 'user_mgr',
      updatedAt: createdAt,
      updatedBy: 'user_mgr',
    };

    const documentRepository: Pick<DocumentRepositoryImpl, 'findById' | 'updateTemplateBinding'> = {
      findById: vi.fn().mockResolvedValue(document),
      updateTemplateBinding: vi.fn(),
    } as unknown as DocumentRepositoryImpl;

    const templateRepository: Pick<DocumentTemplateRepositoryImpl, 'findById'> = {
      findById: vi.fn().mockResolvedValue(template),
    } as unknown as DocumentTemplateRepositoryImpl;

    const templateVersionRepository: Pick<TemplateVersionRepositoryImpl, 'listByTemplate' | 'findById'> = {
      listByTemplate: vi.fn().mockResolvedValue([availableVersion]),
      findById: vi.fn().mockResolvedValue(availableVersion),
    } as unknown as TemplateVersionRepositoryImpl;

    const migrationRepository: Pick<
      DocumentTemplateMigrationRepositoryImpl,
      'logPending' | 'markSucceeded' | 'markFailed'
    > = {
      logPending: vi.fn(),
      markSucceeded: vi.fn(),
      markFailed: vi.fn(),
    } as unknown as DocumentTemplateMigrationRepositoryImpl;

    const templateResolver: TemplateResolver = {
      resolve: vi.fn(),
      resolveActiveVersion: vi.fn(),
      clearCache: vi.fn(),
      getCacheStats: vi.fn().mockReturnValue({ hits: 0, misses: 0 }),
    } as unknown as TemplateResolver;

    const logger = {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    };

    const { req, services } = createRequestMock();
    services.set('documentRepository', documentRepository);
    services.set('documentTemplateRepository', templateRepository);
    services.set('templateVersionRepository', templateVersionRepository);
    services.set('documentTemplateMigrationRepository', migrationRepository);
    services.set('templateResolver', templateResolver);
    services.set('logger', logger);

    const res = createResponseMock();
    const next = vi.fn();

    const middleware = createTemplateValidationMiddleware();
    await middleware(req, res, next as unknown as NextFunction);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.json).toHaveBeenCalled();
    const firstCall = (res.json as ReturnType<typeof vi.fn>).mock.calls[0]?.[0];
    expect(firstCall).toBeDefined();
    const payload = firstCall as Record<string, unknown>;
    expect(payload).toMatchObject({
      error: 'TEMPLATE_VERSION_REMOVED',
      templateId: 'architecture',
      missingVersion: '20.0.0',
    });
    expect(payload).toHaveProperty('remediation');
    expect(documentRepository.updateTemplateBinding).not.toHaveBeenCalled();
  });
});
