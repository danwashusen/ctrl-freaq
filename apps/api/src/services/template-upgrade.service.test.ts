import { describe, expect, it, vi, beforeEach } from 'vitest';
import type { Logger } from 'pino';

import {
  DocumentTemplateMigrationStatus,
  DocumentTemplateStatus,
  type Document,
  type DocumentTemplate,
  type DocumentTemplateMigration,
  type DocumentTemplateMigrationRepositoryImpl,
  type DocumentRepositoryImpl,
  type DocumentTemplateRepositoryImpl,
  type TemplateVersion,
  type TemplateVersionRepositoryImpl,
  TemplateVersionStatus,
} from '@ctrl-freaq/shared-data';
import type { TemplateResolver } from '@ctrl-freaq/template-resolver';

import {
  TemplateUpgradeService,
  TemplateUpgradeNotFoundError,
  TemplateValidationFailedError,
} from './template-upgrade.service.js';

describe('TemplateUpgradeService', () => {
  const createdAt = new Date('2025-01-01T00:00:00Z');
  const updatedAt = new Date('2025-01-02T00:00:00Z');

  const baseDocument: Document = {
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

  const baseVersion: TemplateVersion = {
    id: 'architecture@10.0.0',
    templateId: 'architecture',
    version: '10.0.0',
    status: TemplateVersionStatus.DRAFT,
    changelog: null,
    schemaHash: 'hash-v10',
    schemaJson: { type: 'object', properties: { introduction: { type: 'string' } } },
    sectionsJson: [{ id: 'introduction' }],
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
    sectionsJson: [{ id: 'introduction' }],
    updatedAt: new Date('2025-01-02T00:01:00Z'),
  };

  const pendingMigration: DocumentTemplateMigration = {
    id: 'migration-1',
    documentId: baseDocument.id,
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

  let documentRepository: Pick<DocumentRepositoryImpl, 'findById' | 'updateTemplateBinding'>;
  let templateRepository: Pick<DocumentTemplateRepositoryImpl, 'findById'>;
  let versionRepository: Pick<
    TemplateVersionRepositoryImpl,
    'listByTemplate' | 'findById' | 'findByTemplateAndVersion'
  >;
  let migrationRepository: Pick<
    DocumentTemplateMigrationRepositoryImpl,
    'logPending' | 'markSucceeded' | 'markFailed'
  >;
  let resolver: TemplateResolver;
  let logger: Pick<Logger, 'child' | 'info' | 'warn' | 'error'>;
  let service: TemplateUpgradeService;

  beforeEach(() => {
    documentRepository = {
      findById: vi.fn().mockResolvedValue(baseDocument),
      updateTemplateBinding: vi.fn().mockImplementation(async () => ({
        ...baseDocument,
        templateVersion: '10.1.0',
        templateSchemaHash: 'hash-v11',
        updatedAt: new Date('2025-01-02T00:05:02Z'),
        updatedBy: 'user_editor_1',
      })),
    } as unknown as DocumentRepositoryImpl;

    templateRepository = {
      findById: vi.fn().mockResolvedValue(template),
    } as unknown as DocumentTemplateRepositoryImpl;

    versionRepository = {
      listByTemplate: vi.fn().mockResolvedValue([activeVersion, baseVersion]),
      findById: vi.fn().mockImplementation(async (id: string) => {
        if (id === activeVersion.id) return activeVersion;
        if (id === baseVersion.id) return baseVersion;
        return null;
      }),
      findByTemplateAndVersion: vi
        .fn()
        .mockImplementation(async (_templateId: string, version: string) => {
          if (version === '10.1.0') return activeVersion;
          if (version === '10.0.0') return baseVersion;
          return null;
        }),
    } as unknown as TemplateVersionRepositoryImpl;

    migrationRepository = {
      logPending: vi.fn().mockResolvedValue(pendingMigration),
      markSucceeded: vi.fn().mockResolvedValue(succeededMigration),
      markFailed: vi.fn(),
    } as unknown as DocumentTemplateMigrationRepositoryImpl;

    resolver = {
      resolve: vi.fn().mockResolvedValue({
        cacheHit: false,
        template: {
          templateId: activeVersion.templateId,
          version: activeVersion.version,
          schemaHash: activeVersion.schemaHash,
          sections: activeVersion.sectionsJson,
          schema: activeVersion.schemaJson,
          validator: {
            safeParse: vi.fn().mockReturnValue({ success: true, data: baseDocument.content }),
          },
        },
      }),
      resolveActiveVersion: vi.fn(),
      clearCache: vi.fn(),
      getCacheStats: vi.fn().mockReturnValue({ hits: 0, misses: 1 }),
    } as unknown as TemplateResolver;

    logger = {
      child: vi.fn().mockReturnThis(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    };

    service = new TemplateUpgradeService(
      documentRepository as DocumentRepositoryImpl,
      templateRepository as DocumentTemplateRepositoryImpl,
      versionRepository as TemplateVersionRepositoryImpl,
      migrationRepository as DocumentTemplateMigrationRepositoryImpl,
      resolver,
      logger as Logger
    );
  });

  it('auto-upgrades documents when active version differs and validation passes', async () => {
    const outcome = await service.evaluate({
      documentId: baseDocument.id,
      userId: 'user_editor_1',
      requestId: 'req_123',
    });

    expect(outcome.document.templateVersion).toBe('10.1.0');
    expect(outcome.migration?.status).toBe(DocumentTemplateMigrationStatus.SUCCEEDED);
    expect(outcome.decision.action).toBe('upgrade');
    expect(migrationRepository.logPending).toHaveBeenCalledWith({
      documentId: baseDocument.id,
      fromVersion: '10.0.0',
      toVersion: '10.1.0',
      initiatedBy: 'user_editor_1',
    });
    expect(migrationRepository.markSucceeded).toHaveBeenCalledWith({
      migrationId: pendingMigration.id,
    });
    expect(documentRepository.updateTemplateBinding).toHaveBeenCalledWith({
      documentId: baseDocument.id,
      templateId: 'architecture',
      templateVersion: '10.1.0',
      templateSchemaHash: 'hash-v11',
      updatedBy: 'user_editor_1',
    });
    expect(logger.child).toHaveBeenCalledWith(
      expect.objectContaining({
        templateId: 'architecture',
        currentVersion: '10.0.0',
        targetVersion: '10.1.0',
        requestId: 'req_123',
      })
    );
  });

  it('returns blocked decision when referenced template version has been removed', async () => {
    (versionRepository.listByTemplate as ReturnType<typeof vi.fn>).mockResolvedValue([
      activeVersion,
    ]);
    (versionRepository.findByTemplateAndVersion as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
      activeVersion
    );
    (versionRepository.findByTemplateAndVersion as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
      null
    );

    const outcome = await service.evaluate({
      documentId: baseDocument.id,
      userId: 'user_editor_1',
      requestId: 'req_456',
    });

    expect(outcome.decision.action).toBe('blocked');
    expect(documentRepository.updateTemplateBinding).not.toHaveBeenCalled();
    expect(migrationRepository.logPending).not.toHaveBeenCalled();
  });

  it('marks migration failed and throws when validation fails', async () => {
    (resolver.resolve as ReturnType<typeof vi.fn>).mockResolvedValue({
      cacheHit: false,
      template: {
        templateId: activeVersion.templateId,
        version: activeVersion.version,
        schemaHash: activeVersion.schemaHash,
        sections: activeVersion.sectionsJson,
        schema: activeVersion.schemaJson,
        validator: {
          safeParse: vi.fn().mockReturnValue({
            success: false,
            error: {
              issues: [
                {
                  path: ['introduction'],
                  message: 'Executive Summary is required',
                  code: 'custom',
                },
              ],
            },
          }),
        },
      },
    });

    await expect(
      service.evaluate({
        documentId: baseDocument.id,
        userId: 'user_editor_1',
        requestId: 'req_789',
      })
    ).rejects.toBeInstanceOf(TemplateValidationFailedError);

    expect(migrationRepository.markFailed).toHaveBeenCalledWith({
      migrationId: pendingMigration.id,
      validationErrors: expect.anything(),
    });
  });

  it('throws not found error when document is missing', async () => {
    (documentRepository.findById as ReturnType<typeof vi.fn>).mockResolvedValueOnce(null);

    await expect(
      service.evaluate({
        documentId: 'missing-doc',
        userId: 'user_editor_1',
      })
    ).rejects.toBeInstanceOf(TemplateUpgradeNotFoundError);
  });
});
