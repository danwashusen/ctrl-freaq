import path from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  AuthProviderConfigError,
  resolveAuthProviderConfig,
} from '../../../src/config/auth-provider.js';

describe('resolveAuthProviderConfig', () => {
  it('defaults to clerk when AUTH_PROVIDER is not set', () => {
    const config = resolveAuthProviderConfig({
      env: {} as NodeJS.ProcessEnv,
      cwd: '/workspace',
    });

    expect(config).toEqual({ provider: 'clerk' });
  });

  it('normalizes provider casing and trims whitespace', () => {
    const config = resolveAuthProviderConfig({
      env: {
        AUTH_PROVIDER: '  SIMPLE  ',
        SIMPLE_AUTH_USER_FILE: '/tmp/simple.yaml',
      } as unknown as NodeJS.ProcessEnv,
      cwd: '/workspace',
    });

    expect(config.provider).toBe('simple');
    expect(config.simpleAuthUserFile).toBe('/tmp/simple.yaml');
  });

  it('resolves relative SIMPLE_AUTH_USER_FILE paths against cwd', () => {
    const config = resolveAuthProviderConfig({
      env: {
        AUTH_PROVIDER: 'simple',
        SIMPLE_AUTH_USER_FILE: './fixtures/users.yaml',
      } as unknown as NodeJS.ProcessEnv,
      cwd: '/workspace/apps/api',
    });

    expect(config.provider).toBe('simple');
    expect(config.simpleAuthUserFile).toBe(
      path.join('/workspace/apps/api', 'fixtures', 'users.yaml')
    );
  });

  it('throws when simple auth is configured without a user file', () => {
    expect(() =>
      resolveAuthProviderConfig({
        env: { AUTH_PROVIDER: 'simple' } as unknown as NodeJS.ProcessEnv,
        cwd: '/workspace',
      })
    ).toThrow(AuthProviderConfigError);
  });

  it('throws when provider value is unsupported', () => {
    expect(() =>
      resolveAuthProviderConfig({
        env: { AUTH_PROVIDER: 'unknown' } as unknown as NodeJS.ProcessEnv,
        cwd: '/workspace',
      })
    ).toThrow(/Unsupported AUTH_PROVIDER/i);
  });
});
