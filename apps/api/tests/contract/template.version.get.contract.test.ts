import type { Express } from 'express';
import request from 'supertest';
import { beforeAll, describe, expect, test } from 'vitest';

import { createApp } from '../../src/app';
import { getTemplateVersion, publishTemplateVersion } from './templates.helpers';

describe('Template Version Get API Contract', () => {
  let app: Express;

  beforeAll(async () => {
    app = await createApp();
  });

  test('GET /api/v1/templates/:templateId/versions/:version requires authentication', async () => {
    await request(app).get('/api/v1/templates/architecture/versions/1.3.0').expect(401);
  });

  test('GET /api/v1/templates/:templateId/versions/:version returns 404 when not found', async () => {
    const res = await getTemplateVersion(app, 'architecture', '9.9.9');
    expect(res.status).toBe(404);
  });

  test('GET /api/v1/templates/:templateId/versions/:version returns compiled schema metadata', async () => {
    const publishRes = await publishTemplateVersion(app, {
      templateId: 'architecture',
      version: '3.0.0',
    });
    expect(publishRes.status).toBe(201);

    const res = await getTemplateVersion(app, 'architecture', '3.0.0');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('version');
    expect(res.body.version).toMatchObject({
      version: '3.0.0',
      schemaHash: expect.any(String),
      status: 'draft',
    });
    expect(res.body.version.sections).toBeInstanceOf(Array);
    expect(res.body.version.sections[0]).toHaveProperty('id');
  });
});
