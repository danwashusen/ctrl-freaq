import type { Express } from 'express';
import request from 'supertest';
import { beforeAll, describe, expect, test } from 'vitest';

import { createApp } from '../../src/app';
import { listTemplateVersions, publishTemplateVersion } from './templates.helpers';

describe('Template Versions List API Contract', () => {
  let app: Express;

  beforeAll(async () => {
    app = await createApp();
  });

  test('GET /api/v1/templates/:templateId/versions requires authentication', async () => {
    await request(app).get('/api/v1/templates/architecture/versions').expect(401);
  });

  test('GET /api/v1/templates/:templateId/versions returns 404 for unknown template', async () => {
    const res = await listTemplateVersions(app, 'missing-template');
    expect(res.status).toBe(404);
  });

  test('GET /api/v1/templates/:templateId/versions lists published versions', async () => {
    const first = await publishTemplateVersion(app, {
      templateId: 'architecture',
      version: '1.1.0',
    });
    expect(first.status).toBe(201);

    const second = await publishTemplateVersion(app, {
      templateId: 'architecture',
      version: '1.2.0',
    });
    expect(second.status).toBe(201);

    const res = await listTemplateVersions(app, 'architecture');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('versions');
    expect(res.body.versions).toHaveLength(2);
    expect(res.body.versions[0].version).toBe('1.2.0');
    expect(res.body.versions[1].version).toBe('1.1.0');
  });
});
