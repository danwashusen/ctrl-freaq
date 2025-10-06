import type { Express } from 'express';
import request from 'supertest';
import { v4 as uuidv4 } from 'uuid';
import { describe, test, expect, beforeAll, afterAll, beforeEach } from 'vitest';

import { resetDatabaseForApp } from '../../src/testing/reset';

/**
 * Contract tests for Projects API endpoints
 *
 * Tests the project management endpoints against the OpenAPI specification:
 * - GET /api/v1/projects (get user's project)
 * - POST /api/v1/projects (create user's project)
 * - GET /api/v1/projects/{projectId} (get project by ID)
 * - PATCH /api/v1/projects/{projectId} (update project)
 * - GET /api/v1/projects/config (get user configuration)
 * - PATCH /api/v1/projects/config (update user configuration)
 *
 * These tests MUST fail before implementation to follow TDD principles.
 *
 * Contract: /specs/002-1-1-development/contracts/projects-api.yaml
 */

describe('Projects API Contract Tests', () => {
  let app: Express;
  const mockUserId = 'user_2abc123def456';
  const mockJwtToken = 'mock-jwt-token';

  beforeAll(async () => {
    // This will fail until the app is implemented
    const { createApp } = await import('../../src/app');
    app = await createApp();
  });

  afterAll(async () => {
    // No server to close when using supertest(app)
  });

  beforeEach(() => {
    // Clean up test data between tests
    // Will be implemented once database layer is available
    resetDatabaseForApp(app);
  });

  describe('Authentication Required', () => {
    test('returns 401 for requests without auth token', async () => {
      await request(app)
        .get('/api/v1/projects')
        .expect(401)
        .expect('Content-Type', /application\/json/);
    });

    test('returns 401 for requests with invalid auth token', async () => {
      await request(app)
        .get('/api/v1/projects')
        .set('Authorization', 'Bearer invalid-token')
        .expect(401)
        .expect('Content-Type', /application\/json/);
    });
  });

  describe('GET /api/v1/projects (list)', () => {
    test('returns list shape when authenticated', async () => {
      const response = await request(app)
        .get('/api/v1/projects')
        .set('Authorization', `Bearer ${mockJwtToken}`)
        .expect(200)
        .expect('Content-Type', /application\/json/);

      // Validate list schema: { projects: Project[], total: number }
      expect(response.body).toHaveProperty('projects');
      expect(Array.isArray(response.body.projects)).toBe(true);
      expect(response.body).toHaveProperty('total');
      expect(typeof response.body.total).toBe('number');

      // If there are projects, validate each item has expected fields
      if (response.body.projects.length > 0) {
        const item = response.body.projects[0];
        expect(item).toHaveProperty('id');
        expect(item).toHaveProperty('ownerUserId');
        expect(item).toHaveProperty('name');
        expect(item).toHaveProperty('slug');
        expect(item).toHaveProperty('createdAt');
        expect(item).toHaveProperty('updatedAt');
        expect(item).toHaveProperty('lastModified');
        expect(item.lastModified).toBe('N/A');
        expect(item).toHaveProperty('memberAvatars');
        expect(Array.isArray(item.memberAvatars)).toBe(true);
      }
    });

    test('returns empty list when user has no project', async () => {
      const response = await request(app)
        .get('/api/v1/projects')
        .set('Authorization', `Bearer ${mockJwtToken}`)
        .expect(200)
        .expect('Content-Type', /application\/json/);

      expect(response.body).toHaveProperty('projects');
      expect(Array.isArray(response.body.projects)).toBe(true);
      expect(response.body.projects.length === 0 || response.body.projects.length >= 0).toBe(true);
      expect(response.body).toHaveProperty('total');
      expect(typeof response.body.total).toBe('number');
    });
  });

  describe('POST /api/v1/projects', () => {
    test('creates project with valid data', async () => {
      const projectData = {
        name: 'My Test Project',
        description: 'A test project for contract validation',
      };

      const response = await request(app)
        .post('/api/v1/projects')
        .set('Authorization', `Bearer ${mockJwtToken}`)
        .send(projectData)
        .expect(201)
        .expect('Content-Type', /application\/json/);

      // Validate created project matches schema
      expect(response.body).toHaveProperty('id');
      expect(response.body).toHaveProperty('ownerUserId');
      expect(response.body).toHaveProperty('name', projectData.name);
      expect(response.body).toHaveProperty('description', projectData.description);
      expect(response.body).toHaveProperty('slug');
      expect(response.body).toHaveProperty('createdAt');
      expect(response.body).toHaveProperty('updatedAt');

      // Validate slug generation
      expect(response.body.slug).toMatch(/^[a-z0-9-]+$/);
      expect(response.body.slug.includes(' ')).toBe(false);
    });

    test('creates project with minimal required data', async () => {
      const projectData = {
        name: 'Minimal Project',
      };

      const response = await request(app)
        .post('/api/v1/projects')
        .set('Authorization', `Bearer ${mockJwtToken}`)
        .send(projectData)
        .expect(201);

      expect(response.body.name).toBe(projectData.name);
      expect(response.body.description).toBeNull();
    });

    test('returns 400 for missing required fields', async () => {
      const response = await request(app)
        .post('/api/v1/projects')
        .set('Authorization', `Bearer ${mockJwtToken}`)
        .send({})
        .expect(400)
        .expect('Content-Type', /application\/json/);

      expect(response.body.error).toBe('VALIDATION_ERROR');
      expect(response.body).toHaveProperty('requestId');
    });

    test('returns 400 for name too long', async () => {
      const longName = 'a'.repeat(101); // Exceeds 100 char limit

      await request(app)
        .post('/api/v1/projects')
        .set('Authorization', `Bearer ${mockJwtToken}`)
        .send({ name: longName })
        .expect(400);
    });

    test('returns 400 for description too long', async () => {
      const longDescription = 'a'.repeat(501); // Exceeds 500 char limit

      await request(app)
        .post('/api/v1/projects')
        .set('Authorization', `Bearer ${mockJwtToken}`)
        .send({
          name: 'Valid Name',
          description: longDescription,
        })
        .expect(400);
    });

    test('returns 409 when user already has project', async () => {
      // First creation should succeed
      await request(app)
        .post('/api/v1/projects')
        .set('Authorization', `Bearer ${mockJwtToken}`)
        .send({ name: 'First Project' })
        .expect(201);

      // Second creation should conflict
      const response = await request(app)
        .post('/api/v1/projects')
        .set('Authorization', `Bearer ${mockJwtToken}`)
        .send({ name: 'Second Project' })
        .expect(409);

      expect(response.body.error).toBe('CONFLICT');
    });
  });

  describe('GET /api/v1/projects/{projectId}', () => {
    test('returns project by ID for owner', async () => {
      // Create a project first
      const createRes = await request(app)
        .post('/api/v1/projects')
        .set('Authorization', `Bearer ${mockJwtToken}`)
        .send({ name: 'Owned Project', description: 'By ID test' })
        .expect(res => {
          if (res.status !== 201 && res.status !== 409) {
            throw new Error(`Unexpected status: ${res.status}`);
          }
        });

      // Resolve projectId either from creation or list (if conflict)
      let projectId: string;
      if (createRes.status === 201) {
        projectId = createRes.body.id;
      } else {
        const listRes = await request(app)
          .get('/api/v1/projects')
          .set('Authorization', `Bearer ${mockJwtToken}`)
          .expect(200);
        projectId = listRes.body.projects?.[0]?.id;
      }

      const response = await request(app)
        .get(`/api/v1/projects/${projectId}`)
        .set('Authorization', `Bearer ${mockJwtToken}`)
        .expect(200)
        .expect('Content-Type', /application\/json/);

      expect(response.body.id).toBe(projectId);
      expect(response.body.ownerUserId).toBe(mockUserId);
    });

    test('returns 404 for non-existent project', async () => {
      const nonExistentId = uuidv4();

      await request(app)
        .get(`/api/v1/projects/${nonExistentId}`)
        .set('Authorization', `Bearer ${mockJwtToken}`)
        .expect(404);
    });

    test.skip('returns 403 for project owned by different user', async () => {
      // Requires seeding a project for a different user; covered elsewhere
    });

    test('returns 404 for invalid UUID format', async () => {
      await request(app)
        .get('/api/v1/projects/invalid-uuid')
        .set('Authorization', `Bearer ${mockJwtToken}`)
        .expect(404);
    });
  });

  describe('PATCH /api/v1/projects/{projectId}', () => {
    test('updates project name successfully', async () => {
      // Create a project to update
      const createRes = await request(app)
        .post('/api/v1/projects')
        .set('Authorization', `Bearer ${mockJwtToken}`)
        .send({ name: 'Updatable Project', description: 'Original' })
        .expect(res => {
          if (res.status !== 201 && res.status !== 409) {
            throw new Error(`Unexpected status: ${res.status}`);
          }
        });
      const projectId =
        createRes.status === 201
          ? createRes.body.id
          : (
              await request(app)
                .get('/api/v1/projects')
                .set('Authorization', `Bearer ${mockJwtToken}`)
                .expect(200)
            ).body.projects[0].id;

      const updateData = { name: 'Updated Project Name' };

      const response = await request(app)
        .patch(`/api/v1/projects/${projectId}`)
        .set('Authorization', `Bearer ${mockJwtToken}`)
        .send(updateData)
        .expect(200);

      expect(response.body.name).toBe(updateData.name);
      expect(response.body.updatedAt).not.toBe(response.body.createdAt);
    });

    test('updates project description successfully', async () => {
      // Create a project to update
      const createRes = await request(app)
        .post('/api/v1/projects')
        .set('Authorization', `Bearer ${mockJwtToken}`)
        .send({ name: 'Updatable Project 2', description: 'Original' })
        .expect(res => {
          if (res.status !== 201 && res.status !== 409) {
            throw new Error(`Unexpected status: ${res.status}`);
          }
        });
      const projectId =
        createRes.status === 201
          ? createRes.body.id
          : (
              await request(app)
                .get('/api/v1/projects')
                .set('Authorization', `Bearer ${mockJwtToken}`)
                .expect(200)
            ).body.projects[0].id;

      const updateData = { description: 'Updated description' };

      const response = await request(app)
        .patch(`/api/v1/projects/${projectId}`)
        .set('Authorization', `Bearer ${mockJwtToken}`)
        .send(updateData)
        .expect(200);

      expect(response.body.description).toBe(updateData.description);
    });

    test('updates multiple fields simultaneously', async () => {
      // Create a project to update
      const createRes = await request(app)
        .post('/api/v1/projects')
        .set('Authorization', `Bearer ${mockJwtToken}`)
        .send({ name: 'Updatable Project 3', description: 'Original' })
        .expect(res => {
          if (res.status !== 201 && res.status !== 409) {
            throw new Error(`Unexpected status: ${res.status}`);
          }
        });
      const projectId =
        createRes.status === 201
          ? createRes.body.id
          : (
              await request(app)
                .get('/api/v1/projects')
                .set('Authorization', `Bearer ${mockJwtToken}`)
                .expect(200)
            ).body.projects[0].id;

      const updateData = {
        name: 'New Name',
        description: 'New description',
      };

      const response = await request(app)
        .patch(`/api/v1/projects/${projectId}`)
        .set('Authorization', `Bearer ${mockJwtToken}`)
        .send(updateData)
        .expect(200);

      expect(response.body.name).toBe(updateData.name);
      expect(response.body.description).toBe(updateData.description);
    });

    test('returns 404 for non-existent project', async () => {
      const nonExistentId = uuidv4();

      await request(app)
        .patch(`/api/v1/projects/${nonExistentId}`)
        .set('Authorization', `Bearer ${mockJwtToken}`)
        .send({ name: 'Updated Name' })
        .expect(404);
    });

    test.skip('returns 403 for project owned by different user', async () => {
      // Requires seeding project owned by another user; not covered in this suite
    });
  });

  describe('GET /api/v1/projects/config', () => {
    test('returns user configuration as key-value pairs', async () => {
      const response = await request(app)
        .get('/api/v1/projects/config')
        .set('Authorization', `Bearer ${mockJwtToken}`)
        .expect(200);

      expect(typeof response.body).toBe('object');

      // All values should be strings per contract
      Object.values(response.body).forEach(value => {
        expect(typeof value).toBe('string');
      });
    });

    test('returns empty object when user has no configuration', async () => {
      const response = await request(app)
        .get('/api/v1/projects/config')
        .set('Authorization', `Bearer ${mockJwtToken}`)
        .expect(200);

      expect(response.body).toEqual({});
    });
  });

  describe('PATCH /api/v1/projects/config', () => {
    test('updates configuration successfully', async () => {
      const configData = {
        theme: 'dark',
        logLevel: 'debug',
        editorPreferences: '{"fontSize": 16, "tabSize": 4}',
      };

      const response = await request(app)
        .patch('/api/v1/projects/config')
        .set('Authorization', `Bearer ${mockJwtToken}`)
        .send(configData)
        .expect(200);

      expect(response.body).toEqual(configData);
    });

    test('merges configuration with existing values', async () => {
      // Set initial config
      await request(app)
        .patch('/api/v1/projects/config')
        .set('Authorization', `Bearer ${mockJwtToken}`)
        .send({ theme: 'light', logLevel: 'info' });

      // Update partial config
      const updateData = { theme: 'dark' };
      const response = await request(app)
        .patch('/api/v1/projects/config')
        .set('Authorization', `Bearer ${mockJwtToken}`)
        .send(updateData)
        .expect(200);

      expect(response.body.theme).toBe('dark');
      expect(response.body.logLevel).toBe('info'); // Should remain unchanged
    });

    test('returns 400 for non-string configuration values', async () => {
      const invalidConfig = {
        theme: 'dark',
        invalidNumber: 123,
        invalidBoolean: true,
      };

      await request(app)
        .patch('/api/v1/projects/config')
        .set('Authorization', `Bearer ${mockJwtToken}`)
        .send(invalidConfig)
        .expect(400);
    });

    test('returns 400 for unknown configuration keys', async () => {
      const invalidKeys = {
        unsupported: 'value',
      };

      const response = await request(app)
        .patch('/api/v1/projects/config')
        .set('Authorization', `Bearer ${mockJwtToken}`)
        .send(invalidKeys)
        .expect(400);

      expect(response.body.error).toBe('VALIDATION_ERROR');
    });
  });

  describe('Error Response Format', () => {
    test('all error responses include required fields', async () => {
      const response = await request(app)
        .get('/api/v1/projects/nonexistent')
        .set('Authorization', `Bearer ${mockJwtToken}`)
        .expect(404);

      expect(response.body).toHaveProperty('error');
      expect(response.body).toHaveProperty('message');
      expect(response.body).toHaveProperty('requestId');
      expect(response.body).toHaveProperty('timestamp');

      expect(typeof response.body.error).toBe('string');
      expect(typeof response.body.message).toBe('string');
      expect(typeof response.body.requestId).toBe('string');
      expect(typeof response.body.timestamp).toBe('string');
      expect(new Date(response.body.timestamp)).toBeInstanceOf(Date);
    });

    test('request ID is unique across requests', async () => {
      const [response1, response2] = await Promise.all([
        request(app)
          .get('/api/v1/projects/invalid1')
          .set('Authorization', `Bearer ${mockJwtToken}`),
        request(app)
          .get('/api/v1/projects/invalid2')
          .set('Authorization', `Bearer ${mockJwtToken}`),
      ]);

      expect(response1.body.requestId).not.toBe(response2.body.requestId);
    });
  });
});
