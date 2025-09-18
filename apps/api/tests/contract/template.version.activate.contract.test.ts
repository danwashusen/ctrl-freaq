import type { Express } from 'express';
import request from 'supertest';
import { beforeAll, describe, expect, test } from 'vitest';

import { createApp } from '../../src/app';
import { activateTemplateVersion, publishTemplateVersion } from './templates.helpers';
import { MOCK_JWT_TOKEN } from '../../src/middleware/test-auth.js';

describe('Template Version Activate API Contract', () => {
  let app: Express;

  beforeAll(async () => {
    app = await createApp();
  });

  test('POST /api/v1/templates/:templateId/versions/:version/activate requires authentication', async () => {
    await request(app).post('/api/v1/templates/architecture/versions/4.0.0/activate').expect(401);
  });

  test('POST /api/v1/templates/:templateId/versions/:version/activate returns 404 for unknown version', async () => {
    const res = await activateTemplateVersion(app, 'architecture', '9.9.9');
    expect(res.status).toBe(404);
  });

  test('POST /api/v1/templates/:templateId/versions/:version/activate promotes version and returns 204', async () => {
    const publishRes = await publishTemplateVersion(app, {
      templateId: 'architecture',
      version: '4.0.0',
    });
    expect(publishRes.status).toBe(201);

    const res = await activateTemplateVersion(app, 'architecture', '4.0.0');
    expect(res.status).toBe(204);

    const second = await activateTemplateVersion(app, 'architecture', '4.0.0');
    expect([204, 409]).toContain(second.status);
  });

  test('POST /api/v1/templates/:templateId/versions/:version/activate rejects callers without manage permission', async () => {
    const publishRes = await publishTemplateVersion(app, {
      templateId: 'architecture',
      version: '4.1.0',
    });
    expect(publishRes.status).toBe(201);

    const res = await request(app)
      .post('/api/v1/templates/architecture/versions/4.1.0/activate')
      .set('Authorization', `Bearer ${MOCK_JWT_TOKEN}`)
      .send();

    expect(res.status).toBe(403);
    expect(res.body).toMatchObject({
      error: 'FORBIDDEN',
    });
  });
});
