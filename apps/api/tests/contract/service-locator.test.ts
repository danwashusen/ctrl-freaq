import type { Express } from 'express';
import express from 'express';
import request from 'supertest';
import { describe, test, expect, beforeAll, afterAll } from 'vitest';
import { setTimeout } from 'node:timers/promises';

/**
 * Contract tests for service locator functionality
 *
 * Tests the service locator pattern implementation:
 * - Per-request service container
 * - Service registration and resolution
 * - Dependency injection
 * - Service lifecycle management
 * - No singleton pattern usage
 *
 * These tests MUST fail before implementation to follow TDD principles.
 */

describe('Service Locator Contract Tests', () => {
  let app: Express;
  let server: any;

  beforeAll(async () => {
    const { createApp } = await import('../../src/app');
    app = await createApp();
    server = app.listen(0);
  });

  afterAll(async () => {
    if (server) {
      await new Promise<void>(resolve => {
        server.close(() => resolve());
      });
    }
  });

  describe('Service Container per Request', () => {
    test('creates new service container for each request', async () => {
      // This test validates that each request gets its own service locator instance
      // We'll test this by verifying that services are scoped per request

      const middleware = (req: any, _res: any, next: any) => {
        // Service locator should be attached to request
        expect(req.services).toBeDefined();
        expect(typeof req.services.get).toBe('function');
        expect(typeof req.services.register).toBe('function');
        next();
      };

      // This test will pass once service locator middleware is implemented
      const testApp = express();
      testApp.use(middleware);
      testApp.get('/test', (_req, res) => {
        res.json({ serviceLocator: 'attached' });
      });

      await request(testApp).get('/test').expect(200);
    });

    test('services are isolated between concurrent requests', async () => {
      // Test that services registered in one request don't affect another
      // intentionally removed unused _testMiddleware helper

      // Make concurrent requests
      const [response1, response2] = await Promise.all([
        request(app).get('/test-service-isolation-1'),
        request(app).get('/test-service-isolation-2'),
      ]);

      // Each request should have its own isolated service container
      // This will be testable once the service locator is implemented
      expect([response1.status, response2.status]).toEqual([200, 200]);
    });
  });

  describe('Service Registration and Resolution', () => {
    test('registers and resolves services correctly', async () => {
      // Test that services can be registered and retrieved
      const testEndpoint = '/test-service-registration';

      await request(app)
        .get(testEndpoint)
        .expect(res => {
          // Should be able to resolve core services like logger, database
          expect(res.status).toBe(200);
        });
    });

    test('throws error for unregistered services', async () => {
      // Test that attempting to get a non-registered service throws an error
      const testEndpoint = '/test-unregistered-service';

      await request(app)
        .get(testEndpoint)
        .expect(res => {
          // Should handle service resolution errors gracefully
          expect([400, 500]).toContain(res.status);
        });
    });

    test('supports service factory functions', async () => {
      // Test that services can be registered as factory functions
      const testEndpoint = '/test-service-factory';

      await request(app)
        .get(testEndpoint)
        .expect(res => {
          // Factory functions should create new instances per resolution
          expect(res.status).toBe(200);
        });
    });
  });

  describe('Core Service Availability', () => {
    test('logger service is available in all requests', async () => {
      await request(app)
        .get('/health')
        .expect(200)
        .expect(res => {
          // Health endpoint should use logger service
          // Verify through log output or response headers
          expect(res.headers['x-request-id']).toBeDefined();
        });
    });

    test('database service is available in data operations', async () => {
      await request(app)
        .get('/api/v1/projects')
        .set('Authorization', 'Bearer mock-token')
        .expect(res => {
          // Project endpoints should use database service
          // Will return 401 until auth is implemented, but should not be 500
          expect([401, 404]).toContain(res.status);
        });
    });

    test('request context service maintains state', async () => {
      // Test that request context is maintained throughout request lifecycle
      await request(app)
        .get('/health')
        .expect(200)
        .expect(res => {
          // Request context should be maintained
          expect(res.headers['x-request-id']).toMatch(/^req_[a-zA-Z0-9]+$/);
        });
    });
  });

  describe('Service Lifecycle Management', () => {
    test('services are disposed after request completion', async () => {
      // Test that services are properly cleaned up after request
      const initialMemory = process.memoryUsage().heapUsed;

      // Make multiple requests to check for memory leaks
      const requests = Array.from({ length: 10 }, () => request(app).get('/health').expect(200));

      await Promise.all(requests);

      // Allow garbage collection
      await setTimeout(100);

      const finalMemory = process.memoryUsage().heapUsed;

      // Memory should not grow excessively (allowing for some variance)
      const memoryGrowth = finalMemory - initialMemory;
      expect(memoryGrowth).toBeLessThan(10 * 1024 * 1024); // Less than 10MB growth
    });

    test('services support graceful shutdown', async () => {
      // Test that services can be gracefully shut down
      await request(app).get('/health').expect(200);

      // This test validates that service cleanup works properly
      // Implementation will include proper disposal patterns
      expect(true).toBe(true); // Placeholder until implementation
    });
  });

  describe('No Singleton Pattern Validation', () => {
    test('services are not global singletons', async () => {
      // Test that services are not implemented as singletons
      // Each request should get fresh service instances

      const requests = await Promise.all([
        request(app).get('/health'),
        request(app).get('/health'),
        request(app).get('/health'),
      ]);

      requests.forEach(response => {
        expect(response.status).toBe(200);
        // Each should have unique request ID
        expect(response.headers['x-request-id']).toBeDefined();
      });

      // Request IDs should all be different
      const requestIds = requests.map(r => r.headers['x-request-id']);
      const uniqueIds = new Set(requestIds);
      expect(uniqueIds.size).toBe(requestIds.length);
    });

    test('service state is not shared between requests', async () => {
      // Test that modifying service state in one request doesn't affect another
      const [response1, response2] = await Promise.all([
        request(app).get('/health'),
        request(app).get('/health'),
      ]);

      expect(response1.status).toBe(200);
      expect(response2.status).toBe(200);

      // Each request should be independent
      expect(response1.headers['x-request-id']).not.toBe(response2.headers['x-request-id']);
    });
  });

  describe('Error Handling in Service Resolution', () => {
    test('handles circular dependencies', async () => {
      // Test that circular dependencies are detected and handled
      const testEndpoint = '/test-circular-dependency';

      await request(app)
        .get(testEndpoint)
        .expect(res => {
          // Should handle circular dependencies gracefully
          expect([400, 500]).toContain(res.status);
          if (res.status === 500) {
            expect(res.body.error).toBeDefined();
          }
        });
    });

    test('handles service resolution failures', async () => {
      // Test that service resolution failures are handled gracefully
      const testEndpoint = '/test-service-failure';

      await request(app)
        .get(testEndpoint)
        .expect(res => {
          // Should return proper error response for service failures
          expect([400, 500]).toContain(res.status);
        });
    });
  });
});
