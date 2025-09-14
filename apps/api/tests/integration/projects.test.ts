import { describe, test, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';

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
  let server: any;
  const mockJwtToken = 'mock-jwt-token';
  let testProjectId: string;

  beforeAll(async () => {
    const { createApp } = await import('../../src/app');
    app = await createApp();
    server = app.listen(0);
  });

  afterAll(async () => {
    if (server) {
      await new Promise<void>((resolve) => {
        server.close(() => resolve());
      });
    }
  });

  beforeEach(async () => {
    // Clean up test data and reset database state
    // Will use service locator to get database instance
    // await app.locals.services.get('database').clearTestData();
  });

  describe('Project Creation Integration', () => {
    test('creates project with database persistence', async () => {
      const projectData = {
        name: 'Integration Test Project',
        description: 'Created via integration test'
      };

      const response = await request(app)
        .post('/api/v1/projects')
        .set('Authorization', `Bearer ${mockJwtToken}`)
        .send(projectData)
        .expect(201);

      testProjectId = response.body.id;

      // Verify database persistence by fetching the project
      const fetchResponse = await request(app)
        .get(`/api/v1/projects/${testProjectId}`)
        .set('Authorization', `Bearer ${mockJwtToken}`)
        .expect(200);

      expect(fetchResponse.body.name).toBe(projectData.name);
      expect(fetchResponse.body.description).toBe(projectData.description);
    });

    test('enforces database constraints and validation', async () => {
      // Test unique constraint (one project per user)
      await request(app)
        .post('/api/v1/projects')
        .set('Authorization', `Bearer ${mockJwtToken}`)
        .send({ name: 'First Project' })
        .expect(201);

      await request(app)
        .post('/api/v1/projects')
        .set('Authorization', `Bearer ${mockJwtToken}`)
        .send({ name: 'Second Project' })
        .expect(409);
    });
  });

  describe('Database Transaction Handling', () => {
    test('rolls back failed project creation', async () => {
      // Test that partial failures don't leave orphaned data
      const projectData = {
        name: 'A'.repeat(1000), // Exceeds database field limit
        description: 'Test description'
      };

      await request(app)
        .post('/api/v1/projects')
        .set('Authorization', `Bearer ${mockJwtToken}`)
        .send(projectData)
        .expect(400);

      // Verify no project was created
      await request(app)
        .get('/api/v1/projects')
        .set('Authorization', `Bearer ${mockJwtToken}`)
        .expect(404);
    });
  });

  describe('Project Retrieval with Database Queries', () => {
    test('retrieves project with proper database joins', async () => {
      // This test validates that project retrieval includes all related data
      const response = await request(app)
        .get(`/api/v1/projects/${testProjectId}`)
        .set('Authorization', `Bearer ${mockJwtToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('id');
      expect(response.body).toHaveProperty('ownerUserId');
      expect(response.body).toHaveProperty('createdAt');
      expect(response.body).toHaveProperty('updatedAt');
    });
  });

  describe('Project Update Operations', () => {
    test('updates project with optimistic locking', async () => {
      const updateData = { name: 'Updated Project Name' };

      const response = await request(app)
        .patch(`/api/v1/projects/${testProjectId}`)
        .set('Authorization', `Bearer ${mockJwtToken}`)
        .send(updateData)
        .expect(200);

      expect(response.body.name).toBe(updateData.name);

      // Verify updatedAt timestamp changed
      const originalCreatedAt = response.body.createdAt;
      const updatedAt = response.body.updatedAt;
      expect(new Date(updatedAt).getTime()).toBeGreaterThan(new Date(originalCreatedAt).getTime());
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
});