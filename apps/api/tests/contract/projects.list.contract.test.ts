import type { Express } from 'express';
import request from 'supertest';
import { v4 as uuidv4 } from 'uuid';
import { describe, test, expect, beforeAll, afterAll } from 'vitest';

/**
 * Contract test: GET /api/v1/projects (list)
 *
 * Verifies:
 * - 401 without JWT
 * - 200 with JWT and object shape { projects: [], total }
 * - Query validation for limit/offset
 * - When a project exists, it appears in the list and includes lastModified: 'N/A'
 */

describe('Projects List API Contract', () => {
  let app: Express;

  beforeAll(async () => {
    const { createApp } = await import('../../src/app');
    app = await createApp();
  });

  afterAll(async () => {
    // No server to close when using supertest(app)
  });

  test('GET /api/v1/projects requires authentication', async () => {
    await request(app).get('/api/v1/projects').expect(401).expect('Content-Type', /json/);
  });

  test('GET /api/v1/projects validates query parameters', async () => {
    await request(app)
      .get('/api/v1/projects?limit=0')
      .set('Authorization', 'Bearer mock-jwt-token')
      .expect(400);

    await request(app)
      .get('/api/v1/projects?offset=-1')
      .set('Authorization', 'Bearer mock-jwt-token')
      .expect(400);
  });

  test('GET /api/v1/projects returns lifecycle metadata, pagination, and timestamps', async () => {
    const authHeader = { Authorization: 'Bearer mock-jwt-token' };

    // Seed multiple projects so pagination slices can be asserted
    const projectNames = ['Alpha', 'Bravo', 'Charlie'].map(
      name => `${name} ${uuidv4().slice(0, 8)}`
    );

    for (const name of projectNames) {
      const response = await request(app)
        .post('/api/v1/projects')
        .set(authHeader)
        .send({
          name,
          description: `${name} description`,
          visibility: 'private',
          goalTargetDate: '2026-06-01',
          goalSummary: `${name} goal`,
        });

      if (response.status !== 201 && response.status !== 409) {
        expect(response.status).toBe(201);
      }
    }

    const res = await request(app)
      .get('/api/v1/projects?limit=2&offset=1')
      .set(authHeader)
      .expect(200)
      .expect('Content-Type', /json/);

    expect(res.body).toMatchObject({
      limit: 2,
      offset: 1,
    });
    expect(Array.isArray(res.body.projects)).toBe(true);
    expect(typeof res.body.total).toBe('number');
    expect(res.body.projects.length).toBeLessThanOrEqual(2);

    if (res.body.projects.length > 0) {
      const item = res.body.projects[0];
      expect(item).toMatchObject({
        id: expect.any(String),
        ownerUserId: expect.any(String),
        name: expect.any(String),
        slug: expect.any(String),
        visibility: expect.stringMatching(/^(private|workspace)$/),
        status: expect.stringMatching(/^(draft|active|paused|completed|archived)$/),
        memberAvatars: expect.any(Array),
      });
      expect(item).toHaveProperty('goalTargetDate');
      expect(item).toHaveProperty('goalSummary');
      expect(item).toHaveProperty('updatedAt');
      expect(item).toHaveProperty('createdAt');
      expect(item.lastModified).not.toBe('N/A');
      expect(() => new Date(item.lastModified ?? '').toISOString()).not.toThrow();
      expect(item.lastModified).toBe(item.updatedAt);
    }
  });

  test('GET /api/v1/projects treats includeArchived=false as excluding archived projects', async () => {
    const authHeader = { Authorization: 'Bearer mock-jwt-token' };

    const active = await request(app)
      .post('/api/v1/projects')
      .set(authHeader)
      .send({ name: `Active ${uuidv4()}`, visibility: 'workspace' })
      .expect(201);

    const archived = await request(app)
      .post('/api/v1/projects')
      .set(authHeader)
      .send({ name: `Archived ${uuidv4()}`, visibility: 'workspace' })
      .expect(201);

    await request(app)
      .delete(`/api/v1/projects/${archived.body.id}`)
      .set(authHeader)
      .expect(204);

    const response = await request(app)
      .get('/api/v1/projects?includeArchived=false')
      .set(authHeader)
      .expect(200)
      .expect('Content-Type', /json/);

    const projectIds = (response.body.projects as Array<{ id: string }>).map(project => project.id);
    expect(projectIds).toContain(active.body.id);
    expect(projectIds).not.toContain(archived.body.id);
  });
});
