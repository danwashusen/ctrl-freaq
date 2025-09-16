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
  let warnSpy: MockInstance<[message?: any, ...optionalParams: any[]], void>;
  let cwdSpy: MockInstance<[], string> | null;

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
    await import('../../src/load-env');

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
    await import('../../src/load-env');

    expect(process.env.SHARED).toBe('base');
    expect(process.env.OVERRIDE).toBe('local');
    expect(process.env.LOCAL_ONLY).toBe('present');
    expect(process.env.EXISTING).toBe('keep');
  });
});
