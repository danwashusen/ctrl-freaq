import { describe, test, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';

/**
 * Integration tests for configuration management
 *
 * Tests user configuration CRUD operations including:
 * - Configuration creation and merging
 * - Configuration retrieval with type validation
 * - Configuration updates with conflict resolution
 * - Database persistence and consistency
 *
 * These tests MUST fail before implementation to follow TDD principles.
 */

describe('Configuration Management Integration Tests', () => {
  let app: Express;
  let server: any;
  const mockJwtToken = 'mock-jwt-token';

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
    // Clean configuration data between tests
  });

  describe('Configuration CRUD Operations', () => {
    test('creates and retrieves configuration values', async () => {
      const configData = {
        theme: 'dark',
        logLevel: 'debug',
        editorPreferences: '{"fontSize": 16}'
      };

      await request(app)
        .patch('/api/v1/projects/config')
        .set('Authorization', `Bearer ${mockJwtToken}`)
        .send(configData)
        .expect(200);

      const response = await request(app)
        .get('/api/v1/projects/config')
        .set('Authorization', `Bearer ${mockJwtToken}`)
        .expect(200);

      expect(response.body).toEqual(configData);
    });

    test('merges partial configuration updates', async () => {
      // Set initial configuration
      await request(app)
        .patch('/api/v1/projects/config')
        .set('Authorization', `Bearer ${mockJwtToken}`)
        .send({ theme: 'light', logLevel: 'info', fontSize: '14' })
        .expect(200);

      // Update only theme
      await request(app)
        .patch('/api/v1/projects/config')
        .set('Authorization', `Bearer ${mockJwtToken}`)
        .send({ theme: 'dark' })
        .expect(200);

      // Verify merge
      const response = await request(app)
        .get('/api/v1/projects/config')
        .set('Authorization', `Bearer ${mockJwtToken}`)
        .expect(200);

      expect(response.body.theme).toBe('dark');
      expect(response.body.logLevel).toBe('info');
      expect(response.body.fontSize).toBe('14');
    });
  });

  describe('Configuration Validation', () => {
    test('rejects non-string configuration values', async () => {
      const invalidConfig = {
        theme: 'dark',
        numericValue: 123,
        booleanValue: true,
        arrayValue: ['item1', 'item2']
      };

      const response = await request(app)
        .patch('/api/v1/projects/config')
        .set('Authorization', `Bearer ${mockJwtToken}`)
        .send(invalidConfig)
        .expect(400);

      expect(response.body.error).toBe('VALIDATION_ERROR');
    });
  });

  describe('Database Integration', () => {
    test('persists configuration changes to database', async () => {
      const configData = { theme: 'dark', logLevel: 'debug' };

      await request(app)
        .patch('/api/v1/projects/config')
        .set('Authorization', `Bearer ${mockJwtToken}`)
        .send(configData)
        .expect(200);

      // Verify persistence by making a fresh request
      const response = await request(app)
        .get('/api/v1/projects/config')
        .set('Authorization', `Bearer ${mockJwtToken}`)
        .expect(200);

      expect(response.body).toEqual(configData);
    });
  });
});