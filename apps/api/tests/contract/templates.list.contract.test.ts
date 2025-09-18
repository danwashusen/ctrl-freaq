import type { Express } from 'express';
import request from 'supertest';
import { beforeAll, describe, expect, test } from 'vitest';

import { createApp } from '../../src/app';
import {
  activateTemplateVersion,
  listTemplates,
  publishTemplateVersion,
} from './templates.helpers';

describe('Templates List API Contract', () => {
  let app: Express;

  beforeAll(async () => {
    app = await createApp();
  });

  test('GET /api/v1/templates requires authentication', async () => {
    await request(app).get('/api/v1/templates').expect(401);
  });

  test('GET /api/v1/templates returns empty collection when no templates exist', async () => {
    const res = await listTemplates(app);
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('templates');
    expect(Array.isArray(res.body.templates)).toBe(true);
  });

  test('GET /api/v1/templates includes active version metadata once published', async () => {
    const publishRes = await publishTemplateVersion(app, {
      templateId: 'architecture',
      version: '1.0.0',
      autoActivate: false,
    });
    expect(publishRes.status).toBe(201);

    const activateRes = await activateTemplateVersion(app, 'architecture', '1.0.0');
    expect(activateRes.status).toBe(204);

    const res = await listTemplates(app);
    expect(res.status).toBe(200);
    const [template] = res.body.templates ?? [];
    expect(template).toMatchObject({
      id: 'architecture',
      name: 'Architecture Document',
      activeVersion: '1.0.0',
      status: 'active',
    });
    expect(new Date(template.updatedAt).toString()).not.toBe('Invalid Date');
  });
});
