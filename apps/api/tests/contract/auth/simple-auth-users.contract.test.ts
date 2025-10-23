import path from 'node:path';

import type { Express } from 'express';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, test, vi } from 'vitest';

const ORIGINAL_AUTH_PROVIDER = process.env.AUTH_PROVIDER;
const ORIGINAL_SIMPLE_FILE = process.env.SIMPLE_AUTH_USER_FILE;

const validFixture = path.resolve(__dirname, '../fixtures/simple-auth/users.valid.yaml');
const invalidFixture = path.resolve(__dirname, '../fixtures/simple-auth/users.invalid.yaml');

describe('GET /auth/simple/users contract', () => {
  afterAll(() => {
    if (ORIGINAL_AUTH_PROVIDER === undefined) {
      delete process.env.AUTH_PROVIDER;
    } else {
      process.env.AUTH_PROVIDER = ORIGINAL_AUTH_PROVIDER;
    }

    if (ORIGINAL_SIMPLE_FILE === undefined) {
      delete process.env.SIMPLE_AUTH_USER_FILE;
    } else {
      process.env.SIMPLE_AUTH_USER_FILE = ORIGINAL_SIMPLE_FILE;
    }
  });

  describe('with a valid simple auth user file', () => {
    let app: Express;

    beforeAll(async () => {
      vi.resetModules();
      process.env.AUTH_PROVIDER = 'simple';
      process.env.SIMPLE_AUTH_USER_FILE = validFixture;

      const { createApp } = await import('../../../src/app.js');
      app = await createApp();
    });

    test('returns configured users with expected fields', async () => {
      const response = await request(app)
        .get('/auth/simple/users')
        .expect(200)
        .expect('Content-Type', /application\/json/);

      expect(response.body).toHaveProperty('users');
      expect(Array.isArray(response.body.users)).toBe(true);
      expect(response.body.users.length).toBeGreaterThan(0);

      for (const user of response.body.users) {
        expect(typeof user.id).toBe('string');
        expect(user.id.length).toBeGreaterThan(0);
        expect(typeof user.email).toBe('string');
        if (user.first_name !== undefined) {
          expect(typeof user.first_name).toBe('string');
        }
        if (user.last_name !== undefined) {
          expect(typeof user.last_name).toBe('string');
        }
        if (user.org_permissions !== undefined) {
          expect(Array.isArray(user.org_permissions)).toBe(true);
        }
      }
    });
  });

  describe('with an invalid simple auth user file', () => {
    test('fails to start the application', async () => {
      vi.resetModules();
      process.env.AUTH_PROVIDER = 'simple';
      process.env.SIMPLE_AUTH_USER_FILE = invalidFixture;

      const { createApp } = await import('../../../src/app.js');
      await expect(createApp()).rejects.toThrow(/simple auth/i);
    });
  });
});
