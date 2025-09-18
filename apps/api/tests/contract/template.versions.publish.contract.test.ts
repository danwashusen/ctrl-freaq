import type { Express } from 'express';
import request from 'supertest';
import { beforeAll, describe, expect, test } from 'vitest';

import { DocumentTemplateRepositoryImpl } from '@ctrl-freaq/shared-data';

import { createApp, type AppContext } from '../../src/app';
import { publishTemplateVersion } from './templates.helpers';
import { MOCK_JWT_TOKEN, TEMPLATE_MANAGER_USER_ID } from '../../src/middleware/test-auth.js';
import {
  getManagerAuthHeader,
  readTemplateFixture,
} from '../../src/testing/templates-test-helpers.js';

describe('Template Version Publish API Contract', () => {
  let app: Express;

  beforeAll(async () => {
    app = await createApp();
  });

  test('POST /api/v1/templates/:templateId/versions requires authentication', async () => {
    await request(app).post('/api/v1/templates/architecture/versions').send({}).expect(401);
  });

  test('POST /api/v1/templates/:templateId/versions validates payloads', async () => {
    await request(app)
      .post('/api/v1/templates/architecture/versions')
      .set('Authorization', getManagerAuthHeader())
      .send({})
      .expect(400);
  });

  test('POST /api/v1/templates/:templateId/versions publishes a new version', async () => {
    const res = await publishTemplateVersion(app, {
      templateId: 'architecture',
      version: '2.0.0',
      fixture: 'architecture.valid',
    });

    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('version');
    expect(res.body.version).toMatchObject({
      version: '2.0.0',
      status: 'draft',
      schemaHash: expect.any(String),
    });
    expect(res.body.version.sections).toBeInstanceOf(Array);
  });

  test('POST /api/v1/templates/:templateId/versions rejects invalid semantic versions', async () => {
    const res = await publishTemplateVersion(app, {
      templateId: 'architecture',
      version: 'not-a-semver',
      fixture: 'architecture.invalidVersion',
    });
    expect([400, 422]).toContain(res.status);
  });

  test('POST /api/v1/templates/:templateId/versions rejects invalid schema definitions', async () => {
    const res = await publishTemplateVersion(app, {
      templateId: 'architecture',
      version: '2.1.0',
      fixture: 'architecture.missingFields',
    });
    expect([400, 422]).toContain(res.status);
    if (res.status === 422) {
      expect(res.body).toHaveProperty('issues');
    }
  });

  test('POST /api/v1/templates/:templateId/versions prevents duplicate versions', async () => {
    const templateYaml = readTemplateFixture('architecture.valid');

    await request(app)
      .post('/api/v1/templates/architecture/versions')
      .set('Authorization', getManagerAuthHeader())
      .send({
        version: '2.0.0',
        templateYaml,
      })
      .expect(409);
  });

  test('POST /api/v1/templates/:templateId/versions rejects callers without manage permission', async () => {
    const templateYaml = readTemplateFixture('architecture.valid');

    const res = await request(app)
      .post('/api/v1/templates/architecture/versions')
      .set('Authorization', `Bearer ${MOCK_JWT_TOKEN}`)
      .send({
        version: '3.0.0',
        templateYaml,
      });

    expect(res.status).toBe(403);
    expect(res.body).toMatchObject({
      error: 'FORBIDDEN',
    });
  });

  test('POST /api/v1/templates/:templateId/versions preserves existing defaultAggressiveness metadata', async () => {
    const appContext = app.locals.appContext as AppContext;
    const templates = new DocumentTemplateRepositoryImpl(appContext.database);

    const firstPublish = await publishTemplateVersion(app, {
      templateId: 'architecture',
      version: '4.0.0',
      fixture: 'architecture.valid',
    });

    expect(firstPublish.status).toBe(201);

    const existing = await templates.findById('architecture');
    expect(existing).not.toBeNull();
    if (!existing) {
      throw new Error('Template should exist after initial publish');
    }

    await templates.upsertMetadata({
      id: existing.id,
      name: existing.name,
      description: existing.description,
      documentType: existing.documentType,
      defaultAggressiveness: 'balanced',
      createdBy: TEMPLATE_MANAGER_USER_ID,
      updatedBy: TEMPLATE_MANAGER_USER_ID,
    });

    const secondPublish = await publishTemplateVersion(app, {
      templateId: 'architecture',
      version: '4.1.0',
      fixture: 'architecture.valid',
    });

    expect(secondPublish.status).toBe(201);

    const template = await templates.findById('architecture');
    expect(template?.defaultAggressiveness).toBe('balanced');
  });

  test('POST /api/v1/templates/:templateId/versions retains active version metadata when publishing draft versions', async () => {
    const activated = await publishTemplateVersion(app, {
      templateId: 'architecture',
      version: '5.0.0',
      autoActivate: true,
    });

    expect(activated.status).toBe(201);
    expect(activated.body).toHaveProperty('template');
    expect(activated.body.template).toMatchObject({
      id: 'architecture',
      activeVersion: '5.0.0',
    });
    expect(activated.body.template.activeVersionMetadata).toMatchObject({
      version: '5.0.0',
      schemaHash: expect.any(String),
    });

    const draftPublish = await publishTemplateVersion(app, {
      templateId: 'architecture',
      version: '5.1.0',
    });

    expect(draftPublish.status).toBe(201);
    expect(draftPublish.body).toHaveProperty('template');
    expect(draftPublish.body.template).toMatchObject({
      id: 'architecture',
      activeVersion: '5.0.0',
    });
    expect(draftPublish.body.template.activeVersionMetadata).toMatchObject({
      version: '5.0.0',
      schemaHash: expect.any(String),
      sections: expect.any(Array),
    });
  });
});
