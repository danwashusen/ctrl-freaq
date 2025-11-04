import type { Logger } from 'pino';
import { beforeEach, describe, expect, it } from 'vitest';
import {
  createTestLogger,
  mockAsyncFn,
  mockFn,
  type MockedAsyncFn,
  type MockedFn,
  type TestLogger,
} from '@ctrl-freaq/test-support';

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

type DocumentRepositoryMock = {
  findById: MockedAsyncFn<DocumentRepositoryImpl['findById']>;
  updateTemplateBinding: MockedAsyncFn<DocumentRepositoryImpl['updateTemplateBinding']>;
};

type TemplateRepositoryMock = {
  findById: MockedAsyncFn<DocumentTemplateRepositoryImpl['findById']>;
};

type VersionRepositoryMock = {
  listByTemplate: MockedAsyncFn<TemplateVersionRepositoryImpl['listByTemplate']>;
  findById: MockedAsyncFn<TemplateVersionRepositoryImpl['findById']>;
  findByTemplateAndVersion: MockedAsyncFn<
    TemplateVersionRepositoryImpl['findByTemplateAndVersion']
  >;
};

type MigrationRepositoryMock = {
  logPending: MockedAsyncFn<DocumentTemplateMigrationRepositoryImpl['logPending']>;
  markSucceeded: MockedAsyncFn<DocumentTemplateMigrationRepositoryImpl['markSucceeded']>;
  markFailed: MockedAsyncFn<DocumentTemplateMigrationRepositoryImpl['markFailed']>;
};

type TemplateResolverMock = {
  resolve: MockedAsyncFn<TemplateResolver['resolve']>;
  resolveActiveVersion: MockedAsyncFn<TemplateResolver['resolveActiveVersion']>;
  clearCache: MockedFn<TemplateResolver['clearCache']>;
  getCacheStats: MockedFn<TemplateResolver['getCacheStats']>;
};

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

  let documentRepository: DocumentRepositoryMock;
  let templateRepository: TemplateRepositoryMock;
  let versionRepository: VersionRepositoryMock;
  let migrationRepository: MigrationRepositoryMock;
  let resolver: TemplateResolverMock;
  let logger: TestLogger<Logger>;
  let service: TemplateUpgradeService;

  beforeEach(() => {
    documentRepository = {
      findById: mockAsyncFn<DocumentRepositoryImpl['findById']>(),
      updateTemplateBinding: mockAsyncFn<DocumentRepositoryImpl['updateTemplateBinding']>(),
    };
    documentRepository.findById.mockResolvedValue(baseDocument);
    documentRepository.updateTemplateBinding.mockImplementation(async () => ({
      ...baseDocument,
      templateVersion: '10.1.0',
      templateSchemaHash: 'hash-v11',
      updatedAt: new Date('2025-01-02T00:05:02Z'),
      updatedBy: 'user_editor_1',
    }));

    templateRepository = {
      findById: mockAsyncFn<DocumentTemplateRepositoryImpl['findById']>(),
    };
    templateRepository.findById.mockResolvedValue(template);

    versionRepository = {
      listByTemplate: mockAsyncFn<TemplateVersionRepositoryImpl['listByTemplate']>(),
      findById: mockAsyncFn<TemplateVersionRepositoryImpl['findById']>(),
      findByTemplateAndVersion:
        mockAsyncFn<TemplateVersionRepositoryImpl['findByTemplateAndVersion']>(),
    };
    versionRepository.listByTemplate.mockResolvedValue([activeVersion, baseVersion]);
    versionRepository.findById.mockImplementation(async id => {
      if (id === activeVersion.id) return activeVersion;
      if (id === baseVersion.id) return baseVersion;
      return null;
    });
    versionRepository.findByTemplateAndVersion.mockImplementation(async (_templateId, version) => {
      if (version === '10.1.0') return activeVersion;
      if (version === '10.0.0') return baseVersion;
      return null;
    });

    migrationRepository = {
      logPending: mockAsyncFn<DocumentTemplateMigrationRepositoryImpl['logPending']>(),
      markSucceeded: mockAsyncFn<DocumentTemplateMigrationRepositoryImpl['markSucceeded']>(),
      markFailed: mockAsyncFn<DocumentTemplateMigrationRepositoryImpl['markFailed']>(),
    };
    migrationRepository.logPending.mockResolvedValue(pendingMigration);
    migrationRepository.markSucceeded.mockResolvedValue(succeededMigration);
    migrationRepository.markFailed.mockResolvedValue(pendingMigration);

    const schemaValidator = {
      parse: mockFn<(input: unknown) => unknown>(),
      safeParse:
        mockFn<(input: unknown) => { success: boolean; data?: unknown; error?: unknown }>(),
    };
    schemaValidator.parse.mockImplementation(input => input);
    schemaValidator.safeParse.mockReturnValue({ success: true, data: baseDocument.content });

    resolver = {
      resolve: mockAsyncFn<TemplateResolver['resolve']>(),
      resolveActiveVersion: mockAsyncFn<TemplateResolver['resolveActiveVersion']>(),
      clearCache: mockFn<TemplateResolver['clearCache']>(),
      getCacheStats: mockFn<TemplateResolver['getCacheStats']>(),
    };
    resolver.resolve.mockResolvedValue({
      cacheHit: false,
      template: {
        templateId: activeVersion.templateId,
        version: activeVersion.version,
        schemaHash: activeVersion.schemaHash,
        sections: activeVersion.sectionsJson,
        schema: activeVersion.schemaJson,
        validator: schemaValidator,
      },
    });
    resolver.resolveActiveVersion.mockResolvedValue(null);
    resolver.getCacheStats.mockReturnValue({ hits: 0, misses: 1, entries: 0 });

    logger = createTestLogger<Logger>();

    service = new TemplateUpgradeService(
      documentRepository as unknown as DocumentRepositoryImpl,
      templateRepository as unknown as DocumentTemplateRepositoryImpl,
      versionRepository as unknown as TemplateVersionRepositoryImpl,
      migrationRepository as unknown as DocumentTemplateMigrationRepositoryImpl,
      resolver as unknown as TemplateResolver,
      logger.logger
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
    versionRepository.listByTemplate.mockResolvedValue([activeVersion]);
    versionRepository.findByTemplateAndVersion.mockResolvedValueOnce(activeVersion);
    versionRepository.findByTemplateAndVersion.mockResolvedValueOnce(null);

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
    resolver.resolve.mockResolvedValue({
      cacheHit: false,
      template: {
        templateId: activeVersion.templateId,
        version: activeVersion.version,
        schemaHash: activeVersion.schemaHash,
        sections: activeVersion.sectionsJson,
        schema: activeVersion.schemaJson,
        validator: {
          parse: mockFn<(input: unknown) => unknown>(input => input),
          safeParse: mockFn<
            (input: unknown) => {
              success: boolean;
              error?: {
                issues: Array<{ path: string[]; message: string; code: string }>;
              };
            }
          >().mockReturnValue({
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
    documentRepository.findById.mockResolvedValueOnce(null);

    await expect(
      service.evaluate({
        documentId: 'missing-doc',
        userId: 'user_editor_1',
      })
    ).rejects.toBeInstanceOf(TemplateUpgradeNotFoundError);
  });
});
