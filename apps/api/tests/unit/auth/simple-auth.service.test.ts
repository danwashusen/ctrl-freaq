import { afterEach, describe, expect, test, vi } from 'vitest';

type ReadFileFn = (typeof import('node:fs/promises'))['readFile'];

const { readFileMock } = vi.hoisted(() => ({
  readFileMock: vi.fn<ReadFileFn>(),
}));

vi.mock('node:fs/promises', () => ({
  readFile: readFileMock,
}));

import {
  SimpleAuthService,
  SimpleAuthServiceError,
} from '../../../src/services/simple-auth.service';

const VALID_YAML = `
users:
  - id: user_alice
    email: alice@example.com
    first_name: Alice
    last_name: Example
    org_role: designer
    org_permissions:
      - manage:projects
      - view:reports
  - id: user_bob
    email: bob@example.com
    first_name: Bob
    last_name: Builder
`;

const DUPLICATE_YAML = `
users:
  - id: user_alice
    email: alice@example.com
  - id: user_alice
    email: alice2@example.com
`;

const DUPLICATE_EMAIL_YAML = `
users:
  - id: user_alice
    email: alice@example.com
  - id: user_bob
    email: alice@example.com
`;

const INVALID_YAML = `
users:
  - identifier: missing_required_fields
`;

describe('SimpleAuthService', () => {
  afterEach(() => {
    readFileMock.mockReset();
  });

  test('parses YAML users and caches the result', async () => {
    readFileMock.mockResolvedValue(VALID_YAML);

    const service = new SimpleAuthService({
      userFilePath: '/tmp/simple-auth.yaml',
    });

    const first = await service.listUsers();
    const second = await service.listUsers();

    expect(readFileMock).toHaveBeenCalledTimes(1);
    expect(first).toHaveLength(2);
    expect(second).toEqual(first);
    expect(first[0]).toEqual(
      expect.objectContaining({
        id: 'user_alice',
        email: 'alice@example.com',
        first_name: 'Alice',
        last_name: 'Example',
        org_role: 'designer',
        org_permissions: ['manage:projects', 'view:reports'],
      })
    );
    await expect(service.getUserById('user_bob')).resolves.toEqual(
      expect.objectContaining({
        id: 'user_bob',
        email: 'bob@example.com',
      })
    );
  });

  test('refresh reloads the YAML file', async () => {
    readFileMock.mockResolvedValue(VALID_YAML);
    const service = new SimpleAuthService({
      userFilePath: '/tmp/simple-auth.yaml',
    });

    await service.listUsers();
    expect(readFileMock).toHaveBeenCalledTimes(1);

    readFileMock.mockResolvedValueOnce(`
users:
  - id: user_carla
    email: carla@example.com
`);

    await service.refresh();
    const users = await service.listUsers();

    expect(readFileMock).toHaveBeenCalledTimes(2);
    expect(users).toHaveLength(1);
    expect(users[0]?.id).toBe('user_carla');
  });

  test('rejects duplicate user IDs with a validation error', async () => {
    readFileMock.mockResolvedValue(DUPLICATE_YAML);
    const service = new SimpleAuthService({
      userFilePath: '/tmp/simple-auth.yaml',
    });

    await expect(service.listUsers()).rejects.toThrow(/duplicate simple auth user id/i);
  });

  test('rejects duplicate user emails with a validation error', async () => {
    readFileMock.mockResolvedValue(DUPLICATE_EMAIL_YAML);
    const service = new SimpleAuthService({
      userFilePath: '/tmp/simple-auth.yaml',
    });

    await expect(service.listUsers()).rejects.toThrow(/duplicate simple auth user email/i);
  });

  test('fails fast when YAML schema is invalid', async () => {
    readFileMock.mockResolvedValue(INVALID_YAML);
    const service = new SimpleAuthService({
      userFilePath: '/tmp/simple-auth.yaml',
    });

    await expect(service.listUsers()).rejects.toBeInstanceOf(SimpleAuthServiceError);
  });

  test('bubbles filesystem errors with helpful context', async () => {
    readFileMock.mockRejectedValue(Object.assign(new Error('ENOENT'), { code: 'ENOENT' }));
    const service = new SimpleAuthService({
      userFilePath: '/missing/simple-auth.yaml',
    });

    await expect(service.listUsers()).rejects.toThrow(/failed to load simple auth users/i);
  });
});
