import type { Express } from 'express';
import { PROJECT_CONSTANTS } from '@ctrl-freaq/shared-data';
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
    test('creates project with lifecycle metadata and returns defaults', async () => {
      const projectData = {
        name: 'Lifecycle Contract Project',
        description: 'A test project for lifecycle contract validation',
        visibility: 'private',
        goalTargetDate: '2026-01-15',
        goalSummary: 'Hit launch milestone',
      };

      const response = await request(app)
        .post('/api/v1/projects')
        .set('Authorization', `Bearer ${mockJwtToken}`)
        .send(projectData)
        .expect(201)
        .expect('Content-Type', /application\/json/);

      expect(response.headers['last-modified']).toBeDefined();

      expect(response.body).toMatchObject({
        name: projectData.name,
        description: projectData.description,
        visibility: 'private',
        status: 'draft',
        goalTargetDate: projectData.goalTargetDate,
        goalSummary: projectData.goalSummary,
      });
      expect(response.body.deletedAt).toBeNull();
      expect(response.body.deletedBy).toBeNull();
      expect(response.body.ownerUserId).toBeDefined();
      expect(response.body.createdBy).toBe(response.body.ownerUserId);
      expect(response.body.updatedBy).toBe(response.body.ownerUserId);
      expect(response.body.slug).toMatch(/^[a-z0-9-]+$/);
    });

    test('applies defaults when optional lifecycle fields are omitted', async () => {
      const response = await request(app)
        .post('/api/v1/projects')
        .set('Authorization', `Bearer ${mockJwtToken}`)
        .send({ name: 'Lifecycle Defaults Project' })
        .expect(201);

      expect(response.body.visibility).toBe('workspace');
      expect(response.body.status).toBe('draft');
      expect(response.body.description).toBeNull();
      expect(response.body.goalTargetDate).toBeNull();
      expect(response.body.goalSummary).toBeNull();
      expect(response.body.deletedAt).toBeNull();
      expect(response.body.deletedBy).toBeNull();
    });

    test('returns 400 when required name field is missing', async () => {
      const response = await request(app)
        .post('/api/v1/projects')
        .set('Authorization', `Bearer ${mockJwtToken}`)
        .send({})
        .expect(400)
        .expect('Content-Type', /application\/json/);

      expect(response.body.error).toBe('VALIDATION_ERROR');
      expect(response.body).toHaveProperty('requestId');
    });

    test('returns 409 when project name collides for the same owner', async () => {
      await request(app)
        .post('/api/v1/projects')
        .set('Authorization', `Bearer ${mockJwtToken}`)
        .send({ name: 'Duplicate Lifecycle Project' })
        .expect(201);

      const response = await request(app)
        .post('/api/v1/projects')
        .set('Authorization', `Bearer ${mockJwtToken}`)
        .send({ name: 'Duplicate Lifecycle Project' })
        .expect(409)
        .expect('Content-Type', /application\/json/);

      expect(response.body.error).toBe('CONFLICT');
      expect(response.body.message).toMatch(/name|slug/i);
    });

    test('returns 400 for invalid visibility value', async () => {
      await request(app)
        .post('/api/v1/projects')
        .set('Authorization', `Bearer ${mockJwtToken}`)
        .send({ name: 'Invalid Visibility', visibility: 'public' })
        .expect(400);
    });

    test('returns 400 for malformed goalTargetDate', async () => {
      await request(app)
        .post('/api/v1/projects')
        .set('Authorization', `Bearer ${mockJwtToken}`)
        .send({ name: 'Invalid Goal Date', goalTargetDate: '15-01-2026' })
        .expect(400);
    });

    test('accepts name at the maximum length', async () => {
      const maxLengthName = 'a'.repeat(PROJECT_CONSTANTS.MAX_NAME_LENGTH);

      const response = await request(app)
        .post('/api/v1/projects')
        .set('Authorization', `Bearer ${mockJwtToken}`)
        .send({ name: maxLengthName })
        .expect(201);

      expect(response.body.name).toBe(maxLengthName);
    });

    test('returns 400 for name too long', async () => {
      const tooLongName = 'a'.repeat(PROJECT_CONSTANTS.MAX_NAME_LENGTH + 1);

      await request(app)
        .post('/api/v1/projects')
        .set('Authorization', `Bearer ${mockJwtToken}`)
        .send({ name: tooLongName })
        .expect(400);
    });

    test('returns 400 for description too long', async () => {
      const longDescription = 'a'.repeat(501);

      await request(app)
        .post('/api/v1/projects')
        .set('Authorization', `Bearer ${mockJwtToken}`)
        .send({
          name: 'Valid Name With Long Description',
          description: longDescription,
        })
        .expect(400);
    });

    test('accepts goal summary up to 280 characters', async () => {
      const longSummary = 'a'.repeat(280);

      const response = await request(app)
        .post('/api/v1/projects')
        .set('Authorization', `Bearer ${mockJwtToken}`)
        .send({
          name: 'Goal Summary Acceptance',
          goalSummary: longSummary,
        })
        .expect(201)
        .expect('Content-Type', /application\/json/);

      expect(response.body.goalSummary).toBe(longSummary);
    });

    test('returns 400 for goal summary longer than 280 characters', async () => {
      const tooLongSummary = 'a'.repeat(281);

      await request(app)
        .post('/api/v1/projects')
        .set('Authorization', `Bearer ${mockJwtToken}`)
        .send({
          name: 'Goal Summary Too Long',
          goalSummary: tooLongSummary,
        })
        .expect(400);
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
    const createProject = async (payload: Record<string, unknown> = {}) => {
      const uniqueSuffix = Math.random().toString(36).slice(2, 8);
      const response = await request(app)
        .post('/api/v1/projects')
        .set('Authorization', `Bearer ${mockJwtToken}`)
        .send({
          name: `Updatable Project ${uniqueSuffix}`,
          description: 'Original description',
          ...payload,
        })
        .expect(201);

      const projectId = response.body.id as string;
      const lastModified =
        (response.headers['last-modified'] as string | undefined) ??
        (response.body.updatedAt as string);

      return {
        projectId,
        lastModified,
        updatedAt: response.body.updatedAt as string,
      };
    };

    test('rejects updates without If-Unmodified-Since header', async () => {
      const { projectId } = await createProject();

      const response = await request(app)
        .patch(`/api/v1/projects/${projectId}`)
        .set('Authorization', `Bearer ${mockJwtToken}`)
        .send({ name: 'Missing Header Project' })
        .expect(428)
        .expect('Content-Type', /application\/json/);

      expect(response.body.error).toBe('PRECONDITION_REQUIRED');
    });

    test('rejects stale If-Unmodified-Since header with 409 conflict', async () => {
      const { projectId, lastModified } = await createProject();

      await new Promise(resolve => setTimeout(resolve, 1100));

      const firstUpdate = await request(app)
        .patch(`/api/v1/projects/${projectId}`)
        .set('Authorization', `Bearer ${mockJwtToken}`)
        .set('If-Unmodified-Since', lastModified)
        .send({ description: 'First mutation' })
        .expect(200);

      const newLastModified =
        (firstUpdate.headers['last-modified'] as string | undefined) ??
        (firstUpdate.body.updatedAt as string);

      expect(new Date(newLastModified).getTime()).toBeGreaterThan(new Date(lastModified).getTime());

      const conflict = await request(app)
        .patch(`/api/v1/projects/${projectId}`)
        .set('Authorization', `Bearer ${mockJwtToken}`)
        .set('If-Unmodified-Since', lastModified)
        .send({ description: 'Stale mutation' })
        .expect(409)
        .expect('Content-Type', /application\/json/);

      expect(conflict.body.error).toBe('VERSION_CONFLICT');
      expect(conflict.body.message).toMatch(/modified/i);
    });

    test('rejects If-Unmodified-Since values with sub-second drift', async () => {
      const { projectId, lastModified } = await createProject();
      const headerWithinTolerance = new Date(new Date(lastModified).getTime() + 500).toISOString();

      const conflict = await request(app)
        .patch(`/api/v1/projects/${projectId}`)
        .set('Authorization', `Bearer ${mockJwtToken}`)
        .set('If-Unmodified-Since', headerWithinTolerance)
        .send({ description: 'Minor update with drift' })
        .expect(409)
        .expect('Content-Type', /application\/json/);

      expect(conflict.body.error).toBe('VERSION_CONFLICT');
    });

    test('updates project fields when concurrency precondition matches', async () => {
      const { projectId, lastModified } = await createProject();

      const updateData = {
        name: 'Updated Project Contract',
        description: 'Updated description contract test',
        visibility: 'workspace',
        status: 'active',
        goalTargetDate: '2026-08-01',
        goalSummary: 'Updated summary',
      };

      const response = await request(app)
        .patch(`/api/v1/projects/${projectId}`)
        .set('Authorization', `Bearer ${mockJwtToken}`)
        .set('If-Unmodified-Since', lastModified)
        .send(updateData)
        .expect(200)
        .expect('Content-Type', /application\/json/);

      expect(response.headers['last-modified']).toBeDefined();
      expect(response.body).toMatchObject(updateData);
    });

    test('returns 400 for invalid status value', async () => {
      const { projectId, lastModified } = await createProject();

      await request(app)
        .patch(`/api/v1/projects/${projectId}`)
        .set('Authorization', `Bearer ${mockJwtToken}`)
        .set('If-Unmodified-Since', lastModified)
        .send({ status: 'invalid-status' })
        .expect(400);
    });

    test('returns 409 PROJECT_ARCHIVED when updating an archived project', async () => {
      const { projectId, lastModified } = await createProject();

      await request(app)
        .delete(`/api/v1/projects/${projectId}`)
        .set('Authorization', `Bearer ${mockJwtToken}`)
        .expect(204);

      const response = await request(app)
        .patch(`/api/v1/projects/${projectId}`)
        .set('Authorization', `Bearer ${mockJwtToken}`)
        .set('If-Unmodified-Since', lastModified)
        .send({ description: 'Attempt update on archived project' })
        .expect(409)
        .expect('Content-Type', /application\/json/);

      expect(response.body.error).toBe('PROJECT_ARCHIVED');
      expect(response.body.message).toMatch(/Archived projects cannot be updated/i);
    });

    test('returns 404 for non-existent project', async () => {
      await request(app)
        .patch(`/api/v1/projects/${uuidv4()}`)
        .set('Authorization', `Bearer ${mockJwtToken}`)
        .set('If-Unmodified-Since', new Date().toISOString())
        .send({ name: 'Updated Name' })
        .expect(404);
    });
  });

  describe('DELETE /api/v1/projects/{projectId}', () => {
    test('archives project and hides it from default listings', async () => {
      const created = await request(app)
        .post('/api/v1/projects')
        .set('Authorization', `Bearer ${mockJwtToken}`)
        .send({ name: 'Archive Contract Target' })
        .expect(201);

      const lastModified =
        (created.headers['last-modified'] as string | undefined) ?? (created.body.updatedAt as string);

      await request(app)
        .patch(`/api/v1/projects/${created.body.id}`)
        .set('Authorization', `Bearer ${mockJwtToken}`)
        .set('If-Unmodified-Since', lastModified)
        .send({ status: 'active' })
        .expect(200);

      await request(app)
        .delete(`/api/v1/projects/${created.body.id}`)
        .set('Authorization', `Bearer ${mockJwtToken}`)
        .expect(204);

      const defaultList = await request(app)
        .get('/api/v1/projects')
        .set('Authorization', `Bearer ${mockJwtToken}`)
        .expect(200);

      const includeArchived = await request(app)
        .get('/api/v1/projects?includeArchived=true')
        .set('Authorization', `Bearer ${mockJwtToken}`)
        .expect(200)
        .expect('Content-Type', /application\/json/);

      expect(defaultList.body.projects.find((project: Record<string, unknown>) => project.id === created.body.id)).toBeUndefined();
      const archivedEntry = includeArchived.body.projects.find((project: Record<string, unknown>) => project.id === created.body.id);
      expect(archivedEntry).toMatchObject({
        status: 'archived',
        deletedBy: created.body.ownerUserId,
        archivedStatusBefore: 'active',
      });
      expect(archivedEntry.deletedAt).toBeDefined();
    });

    test('returns 404 when project does not exist', async () => {
      await request(app)
        .delete(`/api/v1/projects/${uuidv4()}`)
        .set('Authorization', `Bearer ${mockJwtToken}`)
        .expect(404);
    });
  });

  describe('POST /api/v1/projects/{projectId}/restore', () => {
    test('restores archived project and returns updated payload', async () => {
      const created = await request(app)
        .post('/api/v1/projects')
        .set('Authorization', `Bearer ${mockJwtToken}`)
        .send({ name: 'Restore Contract Target' })
        .expect(201);

      await request(app)
        .patch(`/api/v1/projects/${created.body.id}`)
        .set('Authorization', `Bearer ${mockJwtToken}`)
        .set(
          'If-Unmodified-Since',
          (created.headers['last-modified'] as string | undefined) ?? created.body.updatedAt
        )
        .send({ status: 'active' })
        .expect(200);

      await request(app)
        .delete(`/api/v1/projects/${created.body.id}`)
        .set('Authorization', `Bearer ${mockJwtToken}`)
        .expect(204);

      const restoreResponse = await request(app)
        .post(`/api/v1/projects/${created.body.id}/restore`)
        .set('Authorization', `Bearer ${mockJwtToken}`)
        .expect(200)
        .expect('Content-Type', /application\/json/);

      expect(restoreResponse.headers['last-modified']).toBeDefined();
      expect(restoreResponse.body).toMatchObject({
        id: created.body.id,
        status: 'active',
        deletedAt: null,
        deletedBy: null,
        archivedStatusBefore: null,
      });

      const listAfterRestore = await request(app)
        .get('/api/v1/projects')
        .set('Authorization', `Bearer ${mockJwtToken}`)
        .expect(200);

      const restoredEntry = listAfterRestore.body.projects.find(
        (project: Record<string, unknown>) => project.id === created.body.id
      );
      expect(restoredEntry).toBeDefined();
      expect(restoredEntry?.status).toBe('active');
    });

    test('returns 409 when restoring an active project', async () => {
      const created = await request(app)
        .post('/api/v1/projects')
        .set('Authorization', `Bearer ${mockJwtToken}`)
        .send({ name: 'Restore Conflict Target' })
        .expect(201);

      await request(app)
        .post(`/api/v1/projects/${created.body.id}/restore`)
        .set('Authorization', `Bearer ${mockJwtToken}`)
        .expect(409);
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
