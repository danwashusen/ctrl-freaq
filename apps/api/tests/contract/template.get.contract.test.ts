import type { Express } from 'express';
import request from 'supertest';
import { beforeAll, describe, expect, test } from 'vitest';

import { createApp } from '../../src/app';
import { getTemplate, publishTemplateVersion, activateTemplateVersion } from './templates.helpers';

describe('Template Metadata API Contract', () => {
  let app: Express;

  beforeAll(async () => {
    app = await createApp();
  });

  test('GET /api/v1/templates/:templateId requires authentication', async () => {
    await request(app).get('/api/v1/templates/architecture').expect(401);
  });

  test('GET /api/v1/templates/:templateId returns 404 for unknown template', async () => {
    const res = await getTemplate(app, 'unknown-template');
    expect(res.status).toBe(404);
  });

  test('GET /api/v1/templates/:templateId returns catalog entry with active version metadata', async () => {
    const publishRes = await publishTemplateVersion(app, {
      templateId: 'architecture',
      version: '1.0.1',
      autoActivate: false,
    });
    expect(publishRes.status).toBe(201);

    const activateRes = await activateTemplateVersion(app, 'architecture', '1.0.1');
    expect(activateRes.status).toBe(204);

    const res = await getTemplate(app, 'architecture');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('template');
    expect(res.body.template).toMatchObject({
      id: 'architecture',
      name: 'Architecture Document',
      documentType: 'architecture',
      activeVersion: '1.0.1',
      status: 'active',
    });
    expect(res.body.template).toHaveProperty('activeVersionMetadata');
    expect(res.body.template.activeVersionMetadata).toHaveProperty('schemaHash');
    expect(res.body.template.activeVersionMetadata).toHaveProperty('sections');
  });
});
