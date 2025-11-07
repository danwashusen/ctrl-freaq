import { readFile, mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import {
  DocumentRepositoryImpl,
  DocumentTemplateRepositoryImpl,
  ProjectRepositoryImpl,
  SectionRepositoryImpl,
  TemplateVersionRepositoryImpl,
} from '@ctrl-freaq/shared-data';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

import { createApp, type AppContext } from '../../../src/app';
import { MOCK_JWT_TOKEN } from '../../../src/middleware/test-auth';
import {
  DocumentProvisioningError,
  DocumentProvisioningService,
} from '../../../src/services/document-provisioning.service';

const AuthorizationHeader = { Authorization: `Bearer ${MOCK_JWT_TOKEN}` };

describe('DocumentProvisioningService template resolution', () => {
  let templateRootDir: string | null = null;
  let previousTemplateRoot: string | undefined;

  beforeEach(() => {
    previousTemplateRoot = process.env.CTRL_FREAQ_TEMPLATE_ROOT;
  });

  afterEach(async () => {
    if (templateRootDir) {
      await rm(templateRootDir, { recursive: true, force: true });
      templateRootDir = null;
    }
    if (typeof previousTemplateRoot === 'string') {
      process.env.CTRL_FREAQ_TEMPLATE_ROOT = previousTemplateRoot;
    } else {
      delete process.env.CTRL_FREAQ_TEMPLATE_ROOT;
    }
  });

  test('loads template definitions from CTRL_FREAQ_TEMPLATE_ROOT before falling back', async () => {
    const repoTemplatePath = join(
      process.cwd(),
      '..',
      '..',
      'templates',
      'architecture-reference.yaml'
    );
    const originalTemplate = await readFile(repoTemplatePath, 'utf-8');
    const customVersion = '9.9.9';
    const patchedTemplate = originalTemplate.replace(
      /^version:\s+.*/m,
      `version: ${customVersion}`
    );

    const tmpRoot = await mkdtemp(join(tmpdir(), 'ctrl-freaq-template-root-'));
    templateRootDir = join(tmpRoot, 'templates');
    await mkdir(templateRootDir, { recursive: true });
    await writeFile(join(templateRootDir, 'architecture-reference.yaml'), patchedTemplate, 'utf-8');
    process.env.CTRL_FREAQ_TEMPLATE_ROOT = templateRootDir;

    const app = await createApp();
    const appContext = app.locals.appContext as AppContext;

    const createProject = await request(app)
      .post('/api/v1/projects')
      .set(AuthorizationHeader)
      .send({
        name: 'Template Root Override',
        visibility: 'workspace',
        goalSummary: 'Validate template root override.',
      })
      .expect(201);

    const projectId = createProject.body.id as string;

    const provision = await request(app)
      .post(`/api/v1/projects/${projectId}/documents`)
      .set(AuthorizationHeader)
      .send({})
      .expect(201);

    expect(provision.body).toMatchObject({
      status: 'created',
      template: {
        templateVersion: customVersion,
      },
    });

    await appContext.database.close();
  });
});

describe('DocumentProvisioningService rollback safeguards', () => {
  let app: Awaited<ReturnType<typeof createApp>>;
  let appContext: AppContext;
  let projectRepository: ProjectRepositoryImpl;
  let documentRepository: DocumentRepositoryImpl;
  let sectionRepository: SectionRepositoryImpl;
  let provisioningService: DocumentProvisioningService;

  beforeEach(async () => {
    app = await createApp();
    appContext = app.locals.appContext as AppContext;
    const db = appContext.database;

    projectRepository = new ProjectRepositoryImpl(db);
    documentRepository = new DocumentRepositoryImpl(db);
    sectionRepository = new SectionRepositoryImpl(db);
    const templateRepository = new DocumentTemplateRepositoryImpl(db);
    const templateVersionRepository = new TemplateVersionRepositoryImpl(db);

    provisioningService = new DocumentProvisioningService({
      logger: appContext.logger,
      projects: projectRepository,
      documents: documentRepository,
      sections: sectionRepository,
      templates: templateRepository,
      templateVersions: templateVersionRepository,
    });

    const seedUserStatement = db.prepare(
      'INSERT OR IGNORE INTO users (id, email, first_name, last_name, created_by, updated_by) VALUES (?, ?, ?, ?, ?, ?)'
    );
    seedUserStatement.run(
      'system',
      'system@ctrl-freaq.local',
      'System',
      'User',
      'system',
      'system'
    );
    seedUserStatement.run(
      'user-rollback',
      'user-rollback@test.local',
      null,
      null,
      'system',
      'system'
    );
  });

  afterEach(async () => {
    await appContext.database.close();
  });

  test('rolls back partial provisioning when section seeding fails', async () => {
    const project = await projectRepository.create({
      ownerUserId: 'user-rollback',
      name: 'Rollback Project',
      slug: 'rollback-project',
      description: null,
      visibility: 'workspace',
      status: 'draft',
      goalTargetDate: null,
      goalSummary: null,
      createdBy: 'user-rollback',
      updatedBy: 'user-rollback',
    });

    const createSectionsSpy = vi
      .spyOn(
        provisioningService as unknown as Record<string, (...args: unknown[]) => Promise<unknown>>,
        'createSectionsFromTemplate'
      )
      .mockImplementation(async () => {
        throw new DocumentProvisioningError('section seeding failed');
      });

    await expect(
      provisioningService.provisionPrimaryDocument({
        projectId: project.id,
        requestedBy: 'user-rollback',
      })
    ).rejects.toThrow('section seeding failed');

    const orphanedDocuments = appContext.database
      .prepare('SELECT id, deleted_at AS deletedAt FROM documents WHERE project_id = ?')
      .all(project.id) as Array<{ id: string; deletedAt: string | null }>;

    expect(orphanedDocuments).toHaveLength(1);
    expect(orphanedDocuments[0]?.deletedAt).not.toBeNull();

    const sectionCount = appContext.database
      .prepare('SELECT COUNT(*) AS total FROM sections WHERE doc_id = ?')
      .get(orphanedDocuments[0]?.id) as { total: number };

    expect(sectionCount.total).toBe(0);

    createSectionsSpy.mockRestore();

    const result = await provisioningService.provisionPrimaryDocument({
      projectId: project.id,
      requestedBy: 'user-rollback',
    });

    expect(result.status).toBe('created');
    const persistedDocuments = await documentRepository.listByProject(project.id);
    expect(persistedDocuments).toHaveLength(1);
  });
});
