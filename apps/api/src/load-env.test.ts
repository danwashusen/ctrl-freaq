import { describe, it, expect, beforeEach, afterEach, vi, type MockInstance } from 'vitest';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import path from 'node:path';
import os from 'node:os';

const baseEnvSnapshot = { ...process.env };

const hasOwnProperty = <T extends object>(target: T, key: PropertyKey): boolean =>
  Object.prototype.hasOwnProperty.call(target, key);

function resetEnv() {
  for (const key of Object.keys(process.env)) {
    if (!hasOwnProperty(baseEnvSnapshot, key)) {
      Reflect.deleteProperty(process.env, key);
    }
  }
  for (const [key, value] of Object.entries(baseEnvSnapshot)) {
    Reflect.set(process.env, key, value ?? '');
  }
}

describe('load-env', () => {
  let tempDir: string;
  let warnSpy: MockInstance<typeof console.warn>;
  let cwdSpy: MockInstance<typeof process.cwd> | null;

  beforeEach(() => {
    vi.resetModules();
    tempDir = mkdtempSync(path.join(os.tmpdir(), 'ctrl-freaq-env-'));
    warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    cwdSpy = null;
    resetEnv();
  });

  afterEach(() => {
    warnSpy.mockRestore();
    cwdSpy?.mockRestore();
    resetEnv();
    rmSync(tempDir, { recursive: true, force: true });
  });

  it('treats missing values as empty strings and strips wrapping quotes', async () => {
    writeFileSync(path.join(tempDir, '.env'), 'EMPTY=\nQUOTED="value"\nSINGLE=\'alt\'\n');

    cwdSpy = vi.spyOn(process, 'cwd').mockReturnValue(tempDir);
    await import('./load-env.js');

    expect(process.env.EMPTY).toBe('');
    expect(typeof process.env.EMPTY).toBe('string');
    expect(process.env.QUOTED).toBe('value');
    expect(process.env.SINGLE).toBe('alt');
  });

  it('prefers values from .env.local and preserves existing variables', async () => {
    writeFileSync(path.join(tempDir, '.env'), 'SHARED=base\nOVERRIDE=base\n');
    writeFileSync(path.join(tempDir, '.env.local'), 'OVERRIDE=local\nLOCAL_ONLY=present\n');

    process.env.EXISTING = 'keep';
    cwdSpy = vi.spyOn(process, 'cwd').mockReturnValue(tempDir);
    await import('./load-env.js');

    expect(process.env.SHARED).toBe('base');
    expect(process.env.OVERRIDE).toBe('local');
    expect(process.env.LOCAL_ONLY).toBe('present');
    expect(process.env.EXISTING).toBe('keep');
  });

  it('defaults the auth provider to clerk when not specified', async () => {
    cwdSpy = vi.spyOn(process, 'cwd').mockReturnValue(tempDir);
    await import('./load-env.js');

    expect(process.env.AUTH_PROVIDER).toBe('clerk');
  });

  it('requires SIMPLE_AUTH_USER_FILE when simple auth is configured', async () => {
    writeFileSync(path.join(tempDir, '.env'), 'AUTH_PROVIDER=simple\n');
    cwdSpy = vi.spyOn(process, 'cwd').mockReturnValue(tempDir);

    await expect(import('./load-env.js')).rejects.toThrow(
      /SIMPLE_AUTH_USER_FILE is required when AUTH_PROVIDER=simple/i
    );
  });

  it('emits a warning when simple auth mode is active', async () => {
    const yamlPath = path.join(tempDir, 'simple-users.yaml');
    writeFileSync(yamlPath, 'users: []\n');
    writeFileSync(
      path.join(tempDir, '.env'),
      `AUTH_PROVIDER=simple\nSIMPLE_AUTH_USER_FILE=${yamlPath}\n`
    );

    cwdSpy = vi.spyOn(process, 'cwd').mockReturnValue(tempDir);
    await import('./load-env.js');

    expect(process.env.SIMPLE_AUTH_USER_FILE).toBe(yamlPath);
    expect(warnSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        authProvider: 'simple',
        simpleAuthUserFile: yamlPath,
      }),
      'Simple auth provider enabled for local development'
    );
  });
});
