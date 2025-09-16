import type { Express } from 'express';
import request from 'supertest';
import { beforeAll, describe, expect, test } from 'vitest';

import { createApp } from '../../src/app';
import { publishTemplateVersion } from './templates.helpers';
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
});
