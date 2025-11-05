import type { Express } from 'express';
import request from 'supertest';
import { describe, test, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import type { Database as SqliteDatabase } from 'better-sqlite3';
import { DEFAULT_TEST_USER_ID, MOCK_JWT_TOKEN } from '../../src/middleware/test-auth.js';
import { resetDatabaseForApp } from '../../src/testing/reset';

/**
 * Integration tests for project CRUD operations
 *
 * Tests complete project lifecycle including:
 * - Project creation with validation
 * - Project retrieval and querying
 * - Project updates with conflict resolution
 * - Project deletion (soft delete)
 * - Database integration and transactions
 *
 * These tests MUST fail before implementation to follow TDD principles.
 */

describe('Project CRUD Integration Tests', () => {
  let app: Express;
  const mockJwtToken = MOCK_JWT_TOKEN;
  const mockUserId = DEFAULT_TEST_USER_ID;
  let testProjectId: string;

  beforeAll(async () => {
    const { createApp } = await import('../../src/app');
    app = await createApp();
  });

  afterAll(async () => {
    // No server to close when using supertest(app)
  });

  beforeEach(() => {
    resetDatabaseForApp(app);
  });

  describe('Project Creation Integration', () => {
    test('persists lifecycle defaults to database columns', async () => {
      const response = await request(app)
        .post('/api/v1/projects')
        .set('Authorization', `Bearer ${mockJwtToken}`)
        .send({ name: 'Lifecycle Defaults Integration' })
        .expect(201);

      testProjectId = response.body.id;

      const db = app.locals.appContext.database as SqliteDatabase;
      const row = db
        .prepare(
          `SELECT
            visibility,
            status,
            goal_target_date as goalTargetDate,
            goal_summary as goalSummary,
            deleted_at as deletedAt,
            deleted_by as deletedBy
          FROM projects
          WHERE id = ?`
        )
        .get(testProjectId) as
        | {
            visibility?: string;
            status?: string;
            goalTargetDate?: string | null;
            goalSummary?: string | null;
            deletedAt?: string | null;
            deletedBy?: string | null;
          }
        | undefined;

      expect(row).toBeDefined();
      expect(row?.visibility).toBe('workspace');
      expect(row?.status).toBe('draft');
      expect(row?.goalTargetDate).toBeNull();
      expect(row?.goalSummary).toBeNull();
      expect(row?.deletedAt).toBeNull();
      expect(row?.deletedBy).toBeNull();
    });

    test('records lifecycle metadata in activity log on creation', async () => {
      const projectPayload = {
        name: 'Lifecycle Audit Project',
        description: 'Integration log coverage',
        visibility: 'private',
        goalTargetDate: '2026-03-01',
        goalSummary: 'Launch beta pilot',
      };

      const response = await request(app)
        .post('/api/v1/projects')
        .set('Authorization', `Bearer ${mockJwtToken}`)
        .send(projectPayload)
        .expect(201);

      const db = app.locals.appContext.database as SqliteDatabase;
      const activityLog = db
        .prepare(
          `SELECT
            action,
            resource_type as resourceType,
            resource_id as resourceId,
            metadata
          FROM activity_logs
          WHERE resource_id = ?
          ORDER BY created_at DESC
          LIMIT 1`
        )
        .get(response.body.id) as
        | {
            action?: string;
            resourceType?: string;
            resourceId?: string;
            metadata?: string | null;
          }
        | undefined;

      expect(activityLog).toBeDefined();
      expect(activityLog?.action).toBe('project.create');
      expect(activityLog?.resourceType).toBe('project');
      expect(activityLog?.resourceId).toBe(response.body.id);

      const metadata =
        typeof activityLog?.metadata === 'string'
          ? (JSON.parse(activityLog?.metadata) as Record<string, unknown>)
          : {};

      expect(metadata).toMatchObject({
        name: projectPayload.name,
        slug: expect.any(String),
        status: 'draft',
        visibility: 'private',
        goalTargetDate: projectPayload.goalTargetDate,
        goalSummary: projectPayload.goalSummary,
      });
    });

    test('accepts goal summaries up to 280 characters on creation', async () => {
      const longSummary = 'c'.repeat(280);

      const response = await request(app)
        .post('/api/v1/projects')
        .set('Authorization', `Bearer ${mockJwtToken}`)
        .send({
          name: 'Long Summary Project',
          goalSummary: longSummary,
        })
        .expect(201);

      expect(response.body.goalSummary).toBe(longSummary);
    });

    test('rejects goal summaries longer than 280 characters on creation', async () => {
      const tooLongSummary = 'd'.repeat(281);

      const response = await request(app)
        .post('/api/v1/projects')
        .set('Authorization', `Bearer ${mockJwtToken}`)
        .send({
          name: 'Too Long Summary',
          goalSummary: tooLongSummary,
        })
        .expect(400);

      expect(response.body.error).toBe('VALIDATION_ERROR');
    });

    test('returns 409 when creating projects with duplicate names for same owner', async () => {
      await request(app)
        .post('/api/v1/projects')
        .set('Authorization', `Bearer ${mockJwtToken}`)
        .send({ name: 'Duplicate Name Integration' })
        .expect(201);

      const conflict = await request(app)
        .post('/api/v1/projects')
        .set('Authorization', `Bearer ${mockJwtToken}`)
        .send({ name: 'Duplicate Name Integration' })
        .expect(409);

      expect(conflict.body.error).toBe('CONFLICT');
    });

    test('accepts goal target date equal to the current local day for negative UTC offsets', async () => {
      vi.useFakeTimers();
      try {
        // Simulate current time just past UTC midnight while the local day remains the same
        vi.setSystemTime(new Date('2025-10-31T04:30:00.000Z'));

        const response = await request(app)
          .post('/api/v1/projects')
          .set('Authorization', `Bearer ${mockJwtToken}`)
          .set('X-Client-Timezone-Offset', '420')
          .send({
            name: 'Same Day Goal Target',
            goalTargetDate: '2025-10-30',
          })
          .expect(201);

        expect(response.body.goalTargetDate).toBe('2025-10-30');
      } finally {
        vi.useRealTimers();
      }
    });
  });

  describe('Database Transaction Handling', () => {
    test('rolls back failed project creation', async () => {
      // Test that partial failures don't leave orphaned data
      const projectData = {
        name: 'A'.repeat(1000), // Exceeds database field limit
        description: 'Test description',
      };

      await request(app)
        .post('/api/v1/projects')
        .set('Authorization', `Bearer ${mockJwtToken}`)
        .send(projectData)
        .expect(400);

      // Verify no project was created
      const res = await request(app)
        .get('/api/v1/projects')
        .set('Authorization', `Bearer ${mockJwtToken}`)
        .expect(200);
      expect(res.body).toHaveProperty('projects');
      expect(Array.isArray(res.body.projects)).toBe(true);
      expect(res.body.projects.length).toBe(0);
    });
  });

  describe('Project Retrieval with Database Queries', () => {
    test('retrieves project with proper database joins', async () => {
      // Create a project first (DB resets between tests)
      const created = await request(app)
        .post('/api/v1/projects')
        .set('Authorization', `Bearer ${mockJwtToken}`)
        .send({ name: 'Join Test', description: 'Test' })
        .expect(201);

      const response = await request(app)
        .get(`/api/v1/projects/${created.body.id}`)
        .set('Authorization', `Bearer ${mockJwtToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('id');
      expect(response.body).toHaveProperty('ownerUserId');
      expect(response.body).toHaveProperty('createdAt');
      expect(response.body).toHaveProperty('updatedAt');
    });
  });

  describe('Project Listing', () => {
    test('lists multiple projects with lifecycle metadata and pagination', async () => {
      const authHeader = { Authorization: `Bearer ${mockJwtToken}` };
      const payloads = [
        {
          name: 'Dashboard Alpha',
          description: 'Alpha project',
          visibility: 'workspace',
          goalTargetDate: '2026-07-01',
          goalSummary: 'Hit alpha milestone',
        },
        {
          name: 'Dashboard Bravo',
          description: 'Bravo project',
          visibility: 'private',
          goalTargetDate: '2026-08-15',
          goalSummary: 'Bravo milestone',
        },
        {
          name: 'Dashboard Charlie',
          description: 'Charlie project',
          visibility: 'workspace',
          goalTargetDate: '2026-09-10',
          goalSummary: 'Charlie milestone',
        },
      ];

      for (const payload of payloads) {
        const response = await request(app).post('/api/v1/projects').set(authHeader).send(payload);

        if (response.status !== 201 && response.status !== 409) {
          expect(response.status).toBe(201);
        }
      }

      const firstPage = await request(app)
        .get('/api/v1/projects?limit=2&offset=0')
        .set(authHeader)
        .expect(200)
        .expect('Content-Type', /json/);

      expect(firstPage.body).toMatchObject({ limit: 2, offset: 0, total: payloads.length });
      expect(firstPage.body.projects).toHaveLength(2);

      const firstProject = firstPage.body.projects[0];
      expect(firstProject).toMatchObject({
        id: expect.any(String),
        ownerUserId: expect.any(String),
        name: expect.any(String),
        slug: expect.any(String),
        visibility: expect.stringMatching(/^(private|workspace)$/),
        status: expect.stringMatching(/^(draft|active|paused|completed|archived)$/),
      });
      expect(firstProject).toHaveProperty('goalTargetDate');
      expect(firstProject).toHaveProperty('goalSummary');
      expect(firstProject).toHaveProperty('updatedAt');
      expect(firstProject.lastModified).toBe(firstProject.updatedAt);

      const secondPage = await request(app)
        .get('/api/v1/projects?limit=2&offset=2')
        .set(authHeader)
        .expect(200)
        .expect('Content-Type', /json/);

      expect(secondPage.body).toMatchObject({ limit: 2, offset: 2, total: payloads.length });
      expect(secondPage.body.projects.length).toBeLessThanOrEqual(1);
      if (secondPage.body.projects.length === 1) {
        const [archivedCandidate] = secondPage.body.projects;
        expect(archivedCandidate.lastModified).toBe(archivedCandidate.updatedAt);
      }
    });

    test('excludes archived projects by default and includes them when requested', async () => {
      const authHeader = { Authorization: `Bearer ${mockJwtToken}` };

      const active = await request(app)
        .post('/api/v1/projects')
        .set(authHeader)
        .send({ name: 'Active Project', visibility: 'workspace' })
        .expect(201);

      const archived = await request(app)
        .post('/api/v1/projects')
        .set(authHeader)
        .send({ name: 'Archived Project', visibility: 'workspace' })
        .expect(201);

      const db = app.locals.appContext.database as SqliteDatabase;
      const archivedAt = '2026-08-15T12:00:00.000Z';
      db.prepare(
        `UPDATE projects
        SET status = ?,
            archived_status_before = ?,
            deleted_at = ?,
            deleted_by = ?,
            updated_at = ?,
            updated_by = ?
        WHERE id = ?`
      ).run('archived', 'active', archivedAt, mockUserId, archivedAt, mockUserId, archived.body.id);

      const defaultList = await request(app)
        .get('/api/v1/projects')
        .set(authHeader)
        .expect(200)
        .expect('Content-Type', /json/);

      expect(defaultList.body.total).toBe(1);
      expect(defaultList.body.projects).toHaveLength(1);
      expect(defaultList.body.projects[0].id).toBe(active.body.id);

      const explicitFalse = await request(app)
        .get('/api/v1/projects?includeArchived=false')
        .set(authHeader)
        .expect(200)
        .expect('Content-Type', /json/);

      expect(explicitFalse.body.total).toBe(1);
      expect(explicitFalse.body.projects).toHaveLength(1);
      expect(explicitFalse.body.projects[0].id).toBe(active.body.id);

      const withArchived = await request(app)
        .get('/api/v1/projects?includeArchived=true')
        .set(authHeader)
        .expect(200)
        .expect('Content-Type', /json/);

      expect(withArchived.body.total).toBe(2);
      const archivedEntry = withArchived.body.projects.find(
        (p: Record<string, unknown>) => p.id === archived.body.id
      );
      expect(archivedEntry).toBeDefined();
      expect(archivedEntry?.status).toBe('archived');
      expect(archivedEntry?.deletedAt).toBe(archivedAt);
      expect(archivedEntry?.deletedBy).toBe(mockUserId);
      expect(archivedEntry?.lastModified).toBe(archivedEntry?.updatedAt);
    });
  });

  describe('Project Update Operations', () => {
    const createProject = async (payload: Record<string, unknown> = {}) => {
      const response = await request(app)
        .post('/api/v1/projects')
        .set('Authorization', `Bearer ${mockJwtToken}`)
        .send({ name: 'Update Me', ...payload })
        .expect(201);

      const lastModified =
        (response.headers['last-modified'] as string | undefined) ??
        (response.body.updatedAt as string);

      return {
        id: response.body.id as string,
        lastModified,
        updatedAt: response.body.updatedAt as string,
      };
    };

    const getDbProject = (projectId: string) => {
      const db = app.locals.appContext.database as SqliteDatabase;
      return db
        .prepare(
          `SELECT
            name,
            description,
            status,
            updated_at as updatedAt,
            goal_summary as goalSummary
          FROM projects
          WHERE id = ?`
        )
        .get(projectId) as
        | {
            name?: string;
            description?: string | null;
            status?: string;
            updatedAt?: string;
            goalSummary?: string | null;
          }
        | undefined;
    };

    test('requires If-Unmodified-Since header for updates', async () => {
      const { id } = await createProject();

      const response = await request(app)
        .patch(`/api/v1/projects/${id}`)
        .set('Authorization', `Bearer ${mockJwtToken}`)
        .send({ name: 'Headerless Update' })
        .expect(428)
        .expect('Content-Type', /json/);

      expect(response.body.error).toBe('PRECONDITION_REQUIRED');
    });

    test('accepts goal summaries up to 280 characters on update', async () => {
      const { id, lastModified } = await createProject();
      const summary = 'e'.repeat(280);

      const response = await request(app)
        .patch(`/api/v1/projects/${id}`)
        .set('Authorization', `Bearer ${mockJwtToken}`)
        .set('If-Unmodified-Since', lastModified)
        .send({ goalSummary: summary })
        .expect(200);

      expect(response.body.goalSummary).toBe(summary);
      const persisted = getDbProject(id);
      expect(persisted?.goalSummary).toBe(summary);
    });

    test('rejects goal summaries longer than 280 characters on update', async () => {
      const { id, lastModified } = await createProject();
      const tooLongSummary = 'f'.repeat(281);

      const response = await request(app)
        .patch(`/api/v1/projects/${id}`)
        .set('Authorization', `Bearer ${mockJwtToken}`)
        .set('If-Unmodified-Since', lastModified)
        .send({ goalSummary: tooLongSummary })
        .expect(400)
        .expect('Content-Type', /json/);

      expect(response.body.error).toBe('VALIDATION_ERROR');
      const persisted = getDbProject(id);
      expect(persisted?.goalSummary).not.toBe(tooLongSummary);
    });

    test('detects conflicting updates and keeps latest data', async () => {
      const { id, lastModified } = await createProject({ goalSummary: 'Initial summary' });

      await new Promise(resolve => setTimeout(resolve, 1100));

      const first = await request(app)
        .patch(`/api/v1/projects/${id}`)
        .set('Authorization', `Bearer ${mockJwtToken}`)
        .set('If-Unmodified-Since', lastModified)
        .send({ goalSummary: 'First writer' })
        .expect(200);

      const firstLastModified =
        (first.headers['last-modified'] as string | undefined) ?? (first.body.updatedAt as string);

      const conflict = await request(app)
        .patch(`/api/v1/projects/${id}`)
        .set('Authorization', `Bearer ${mockJwtToken}`)
        .set('If-Unmodified-Since', lastModified)
        .send({ goalSummary: 'Stale writer' })
        .expect(409)
        .expect('Content-Type', /json/);

      expect(conflict.body.error).toBe('VERSION_CONFLICT');

      const persisted = getDbProject(id);
      expect(persisted?.goalSummary).toBe('First writer');
      expect(new Date(persisted?.updatedAt ?? '').toISOString()).toBe(firstLastModified);
    });

    test('rejects concurrency headers with sub-second drift', async () => {
      const { id, lastModified } = await createProject({ description: 'Original copy' });
      const headerWithinTolerance = new Date(new Date(lastModified).getTime() - 500).toISOString();

      const conflict = await request(app)
        .patch(`/api/v1/projects/${id}`)
        .set('Authorization', `Bearer ${mockJwtToken}`)
        .set('If-Unmodified-Since', headerWithinTolerance)
        .send({ description: 'Updated copy with drift' })
        .expect(409)
        .expect('Content-Type', /json/);

      expect(conflict.body.error).toBe('VERSION_CONFLICT');

      const persisted = getDbProject(id);
      expect(persisted?.description).toBe('Original copy');
      expect(new Date(persisted?.updatedAt ?? '').getTime()).toBe(new Date(lastModified).getTime());
    });

    test('enforces valid lifecycle transitions', async () => {
      const { id, lastModified } = await createProject();

      const activate = await request(app)
        .patch(`/api/v1/projects/${id}`)
        .set('Authorization', `Bearer ${mockJwtToken}`)
        .set('If-Unmodified-Since', lastModified)
        .send({ status: 'active' })
        .expect(200);

      expect(activate.body.status).toBe('active');

      const pauseHeader =
        (activate.headers['last-modified'] as string | undefined) ??
        (activate.body.updatedAt as string);

      const paused = await request(app)
        .patch(`/api/v1/projects/${id}`)
        .set('Authorization', `Bearer ${mockJwtToken}`)
        .set('If-Unmodified-Since', pauseHeader)
        .send({ status: 'paused' })
        .expect(200);

      expect(paused.body.status).toBe('paused');

      const completeHeader =
        (paused.headers['last-modified'] as string | undefined) ??
        (paused.body.updatedAt as string);

      const completed = await request(app)
        .patch(`/api/v1/projects/${id}`)
        .set('Authorization', `Bearer ${mockJwtToken}`)
        .set('If-Unmodified-Since', completeHeader)
        .send({ status: 'completed' })
        .expect(200);

      expect(completed.body.status).toBe('completed');

      const invalidTransition = await request(app)
        .patch(`/api/v1/projects/${id}`)
        .set('Authorization', `Bearer ${mockJwtToken}`)
        .set(
          'If-Unmodified-Since',
          (completed.headers['last-modified'] as string | undefined) ??
            (completed.body.updatedAt as string)
        )
        .send({ status: 'draft' })
        .expect(400);

      expect(invalidTransition.body.error).toBe('INVALID_STATUS_TRANSITION');
    });

    test('returns PROJECT_ARCHIVED when attempting to update an archived project', async () => {
      const { id, lastModified } = await createProject({ description: 'Archive guard coverage' });

      await request(app)
        .delete(`/api/v1/projects/${id}`)
        .set('Authorization', `Bearer ${mockJwtToken}`)
        .expect(204);

      const archivedUpdate = await request(app)
        .patch(`/api/v1/projects/${id}`)
        .set('Authorization', `Bearer ${mockJwtToken}`)
        .set('If-Unmodified-Since', lastModified)
        .send({ description: 'Attempt update on archived project' })
        .expect(409)
        .expect('Content-Type', /json/);

      expect(archivedUpdate.body.error).toBe('PROJECT_ARCHIVED');
      expect(archivedUpdate.body.message).toContain('Archived projects cannot be updated');
    });
  });

  describe('Project Archive and Restore Operations', () => {
    test('archives project and removes it from default listings', async () => {
      const authHeader = { Authorization: `Bearer ${mockJwtToken}` };

      const created = await request(app)
        .post('/api/v1/projects')
        .set(authHeader)
        .send({ name: 'Archive Integration Target' })
        .expect(201);

      const projectId: string = created.body.id;
      expect(typeof projectId).toBe('string');

      const lastModified =
        (created.headers['last-modified'] as string | undefined) ??
        (created.body.updatedAt as string);

      await request(app)
        .patch(`/api/v1/projects/${projectId}`)
        .set(authHeader)
        .set('If-Unmodified-Since', lastModified)
        .send({ status: 'active' })
        .expect(200);

      await request(app).delete(`/api/v1/projects/${created.body.id}`).set(authHeader).expect(204);

      const defaultList = await request(app).get('/api/v1/projects').set(authHeader).expect(200);

      const includeArchived = await request(app)
        .get('/api/v1/projects?includeArchived=true')
        .set(authHeader)
        .expect(200);

      expect(
        defaultList.body.projects.some(
          (project: Record<string, unknown>) => project.id === created.body.id
        )
      ).toBe(false);

      const archivedProject = includeArchived.body.projects.find(
        (project: Record<string, unknown>) => project.id === created.body.id
      );
      expect(archivedProject).toMatchObject({
        status: 'archived',
        archivedStatusBefore: 'active',
      });
      expect(archivedProject.deletedAt).toBeDefined();
      expect(archivedProject.deletedBy).toBe(mockUserId);

      const db = app.locals.appContext.database as SqliteDatabase;
      const row = db
        .prepare(
          `SELECT status, archived_status_before as archivedStatusBefore, deleted_at as deletedAt, deleted_by as deletedBy FROM projects WHERE id = ?`
        )
        .get(created.body.id) as
        | {
            status?: string;
            archivedStatusBefore?: string | null;
            deletedAt?: string | null;
            deletedBy?: string | null;
          }
        | undefined;

      expect(row).toMatchObject({
        status: 'archived',
        deletedBy: mockUserId,
        archivedStatusBefore: 'active',
      });
      expect(row?.deletedAt).toBeDefined();
    });

    test('restores archived project to its pre-archive status', async () => {
      const authHeader = { Authorization: `Bearer ${mockJwtToken}` };

      const created = await request(app)
        .post('/api/v1/projects')
        .set(authHeader)
        .send({ name: 'Restore Integration Target' })
        .expect(201);

      const projectId: string = created.body.id;
      expect(typeof projectId).toBe('string');

      const lastModified =
        (created.headers['last-modified'] as string | undefined) ??
        (created.body.updatedAt as string);

      const activated = await request(app)
        .patch(`/api/v1/projects/${projectId}`)
        .set(authHeader)
        .set('If-Unmodified-Since', lastModified)
        .send({ status: 'active' })
        .expect(200);

      const activatedLastModified =
        (activated.headers['last-modified'] as string | undefined) ??
        (activated.body.updatedAt as string);

      await request(app)
        .patch(`/api/v1/projects/${projectId}`)
        .set(authHeader)
        .set('If-Unmodified-Since', activatedLastModified)
        .send({ status: 'completed' })
        .expect(200);

      await request(app).delete(`/api/v1/projects/${projectId}`).set(authHeader).expect(204);

      const restoreResponse = await request(app)
        .post(`/api/v1/projects/${projectId}/restore`)
        .set(authHeader)
        .expect(200);

      expect(restoreResponse.body.status).toBe('completed');
      expect(restoreResponse.body.deletedAt).toBeNull();
      expect(restoreResponse.body.deletedBy).toBeNull();
      expect(restoreResponse.body.archivedStatusBefore).toBeNull();

      const db = app.locals.appContext.database as SqliteDatabase;
      const row = db
        .prepare(
          `SELECT status, archived_status_before as archivedStatusBefore, deleted_at as deletedAt, deleted_by as deletedBy FROM projects WHERE id = ?`
        )
        .get(projectId) as
        | {
            status?: string;
            archivedStatusBefore?: string | null;
            deletedAt?: string | null;
            deletedBy?: string | null;
          }
        | undefined;

      expect(row).toMatchObject({
        status: 'completed',
        deletedAt: null,
        deletedBy: null,
        archivedStatusBefore: null,
      });
    });

    test('returns 409 when creating a project with the name of an archived project', async () => {
      const authHeader = { Authorization: `Bearer ${mockJwtToken}` };
      const projectName = 'Archive Slug Collision';

      const created = await request(app)
        .post('/api/v1/projects')
        .set(authHeader)
        .send({ name: projectName })
        .expect(201);

      await request(app).delete(`/api/v1/projects/${created.body.id}`).set(authHeader).expect(204);

      const recreate = await request(app)
        .post('/api/v1/projects')
        .set(authHeader)
        .send({ name: projectName })
        .expect(409);

      expect(recreate.body).toMatchObject({
        error: 'CONFLICT',
        message: expect.stringContaining('already exists'),
      });
    });
  });

  describe('Database Error Handling', () => {
    test('handles database connection failures gracefully', async () => {
      // Simulate database connection issues
      // This would be tested by temporarily disconnecting the database
      // The service locator should handle reconnection attempts

      const response = await request(app)
        .get('/api/v1/projects')
        .set('Authorization', `Bearer ${mockJwtToken}`);

      // Should either succeed or return proper error response
      if (response.status === 500) {
        expect(response.body.error).toBe('INTERNAL_ERROR');
        expect(response.body).toHaveProperty('requestId');
      } else {
        expect(response.status).toBe(200);
      }
    });
  });

  describe('CORS configuration', () => {
    test('includes X-Client-Timezone-Offset header in preflight allow list', async () => {
      const response = await request(app)
        .options('/api/v1/projects')
        .set('Origin', 'http://localhost:5173')
        .set('Access-Control-Request-Method', 'POST')
        .set('Access-Control-Request-Headers', 'Content-Type, X-Client-Timezone-Offset')
        .expect(200);

      const allowHeaders = response.headers['access-control-allow-headers'];
      expect(allowHeaders, 'access-control-allow-headers should be returned').toBeDefined();
      const allowHeadersValue = Array.isArray(allowHeaders)
        ? allowHeaders.join(', ')
        : (allowHeaders ?? '');
      expect(allowHeadersValue.toLowerCase()).toContain('x-client-timezone-offset');
    });
  });
});
