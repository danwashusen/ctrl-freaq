import { readFile, mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import request from 'supertest';
import { afterEach, beforeEach, describe, expect, test } from 'vitest';

import { createApp, type AppContext } from '../../../src/app';
import { MOCK_JWT_TOKEN } from '../../../src/middleware/test-auth';

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
