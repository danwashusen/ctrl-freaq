import fs from 'node:fs';
import path from 'node:path';

import { resolveAuthProviderConfig } from './config/auth-provider.js';

// Minimal .env loader supporting .env and .env.local
// Precedence: real environment variables > .env.local > .env
// Does not override variables already present in the process environment.

function parseEnv(content: string): Record<string, string> {
  const vars = new Map<string, string>();
  const lines = content.split(/\r?\n/);
  for (const raw of lines) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    // key=value where key matches common env var pattern
    const match = line.match(/^([A-Za-z_][A-Za-z0-9_.-]*)\s*=\s*(.*)$/);
    if (!match) continue;
    const rawKey = match[1] ?? '';
    const rawValue = match[2];
    if (!rawKey) continue;

    const key = rawKey;
    let val = (typeof rawValue === 'string' ? rawValue : '').trim();
    // Strip surrounding single or double quotes when both ends match
    if (val.length >= 2) {
      const first = val[0];
      const last = val[val.length - 1];
      if ((first === '"' && last === '"') || (first === "'" && last === "'")) {
        val = val.slice(1, -1);
      }
    }
    vars.set(key, String(val));
  }
  return Object.fromEntries(vars.entries());
}

function loadEnvFile(filePath: string): Record<string, string> | null {
  try {
    if (!fs.existsSync(filePath)) return null;
    const content = fs.readFileSync(filePath, 'utf8');
    return parseEnv(content);
  } catch {
    return null;
  }
}

// Capture the original environment so we don't overwrite real env vars
const originalEnvKeys = new Set(Object.keys(process.env));

const getEnvValue = (key: string) => Reflect.get(process.env, key) as string | undefined;
const setEnvValue = (key: string, value: string) => {
  Reflect.set(process.env, key, value);
};

const cwd = process.cwd();
const envPath = path.join(cwd, '.env');
const envLocalPath = path.join(cwd, '.env.local');

// 1) Load .env (only set if not already defined in real env)
const baseVars = loadEnvFile(envPath);
if (baseVars) {
  for (const [key, value] of Object.entries(baseVars)) {
    if (!originalEnvKeys.has(key) && getEnvValue(key) === undefined) {
      setEnvValue(key, value);
    }
  }
}

// 2) Load .env.local (override .env but never real env)
const localVars = loadEnvFile(envLocalPath);
if (localVars) {
  for (const [key, value] of Object.entries(localVars)) {
    if (!originalEnvKeys.has(key)) {
      setEnvValue(key, value);
    }
  }
}

const authConfig = resolveAuthProviderConfig({ env: process.env, cwd });
setEnvValue('AUTH_PROVIDER', authConfig.provider);

if (authConfig.provider === 'simple') {
  if (authConfig.simpleAuthUserFile) {
    setEnvValue('SIMPLE_AUTH_USER_FILE', authConfig.simpleAuthUserFile);
  }

  if (process.env.NODE_ENV !== 'production') {
    // eslint-disable-next-line no-console
    console.warn(
      {
        authProvider: authConfig.provider,
        simpleAuthUserFile: authConfig.simpleAuthUserFile,
      },
      'Simple auth provider enabled for local development'
    );
  }
} else if (process.env.NODE_ENV !== 'production') {
  const missing: string[] = [];
  if (!process.env.CLERK_PUBLISHABLE_KEY) missing.push('CLERK_PUBLISHABLE_KEY');
  if (!process.env.CLERK_SECRET_KEY) missing.push('CLERK_SECRET_KEY');
  if (missing.length > 0) {
    // eslint-disable-next-line no-console
    console.warn(
      `Warning: Missing env vars: ${missing.join(', ')} (looked in ${envLocalPath} and ${envPath})`
    );
  }
}
