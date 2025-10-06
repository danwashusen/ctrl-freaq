import type { Express } from 'express';
import request from 'supertest';
import { beforeAll, describe, expect, test } from 'vitest';
import { z } from 'zod';

import { createApp } from '../../src/app';
import { MOCK_JWT_TOKEN } from '../../src/middleware/test-auth';
import { demoProjectRetention } from './fixtures/project-retention';

const AuthorizationHeader = { Authorization: `Bearer ${MOCK_JWT_TOKEN}` };

const RetentionResponseSchema = z.object({
  policyId: z.string().min(1),
  retentionWindow: z.string().min(1),
  guidance: z.string().min(1),
});

describe('Project retention policy contract', () => {
  let app: Express;

  beforeAll(async () => {
    process.env.NODE_ENV = 'test';
    app = await createApp();
  });

  test('GET /api/v1/projects/:projectSlug/retention returns retention metadata', async () => {
    const response = await request(app)
      .get(`/api/v1/projects/${demoProjectRetention.projectSlug}/retention`)
      .set(AuthorizationHeader);

    expect(response.status).toBe(200);
    const parsed = RetentionResponseSchema.safeParse(response.body);
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.policyId).toBe(demoProjectRetention.policyId);
      expect(parsed.data.retentionWindow).toBe(demoProjectRetention.retentionWindow);
    }
  });

  test('responds with 404 for projects without retention policies', async () => {
    const response = await request(app)
      .get('/api/v1/projects/unknown-project/retention')
      .set(AuthorizationHeader);

    expect(response.status).toBe(404);
  });
});
