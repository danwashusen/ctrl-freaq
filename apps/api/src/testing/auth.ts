import fs from 'node:fs';
import path from 'node:path';

import type { Database } from 'better-sqlite3';
import { load } from 'js-yaml';

import { isTestRuntime } from '../utils/runtime-env.js';

interface SimpleAuthUserRecord {
  id: string;
  email: string;
  first_name?: string;
  last_name?: string;
}

interface SimpleAuthConfig {
  users: SimpleAuthUserRecord[];
}

const CANONICAL_SIMPLE_AUTH_USER_FILE = path.resolve(
  process.cwd(),
  'tests/shared/simple-auth/users.yaml'
);

type EnvSnapshot = {
  authProvider?: string;
  simpleAuthUserFile?: string;
};

let cachedUsers: SimpleAuthUserRecord[] | null = null;

const resolveCanonicalFile = (): string => {
  if (!fs.existsSync(CANONICAL_SIMPLE_AUTH_USER_FILE)) {
    throw new Error(`Canonical simple-auth fixture missing at ${CANONICAL_SIMPLE_AUTH_USER_FILE}`);
  }
  return CANONICAL_SIMPLE_AUTH_USER_FILE;
};

const loadCanonicalUsers = (): SimpleAuthUserRecord[] => {
  if (cachedUsers) {
    return cachedUsers;
  }

  const raw = fs.readFileSync(resolveCanonicalFile(), 'utf8');
  const parsed = load(raw) as SimpleAuthConfig | undefined;
  const rawUsers = Array.isArray(parsed?.users) ? parsed.users : [];

  cachedUsers = rawUsers.map(user => ({
    id: user.id,
    email: user.email,
    first_name: user.first_name,
    last_name: user.last_name,
  }));

  return cachedUsers;
};

export const seedSimpleAuthUsers = (db: Database): void => {
  if (!isTestRuntime()) {
    return;
  }

  const users = loadCanonicalUsers();
  if (users.length === 0) {
    return;
  }

  const statement = db.prepare(
    `INSERT OR REPLACE INTO users (
       id,
       email,
       first_name,
       last_name,
       created_by,
       updated_by
     ) VALUES (?, ?, ?, ?, 'system', 'system')`
  );

  for (const user of users) {
    statement.run(user.id, user.email, user.first_name ?? null, user.last_name ?? null);
  }
};

export const setSimpleAuthEnv = (): EnvSnapshot => {
  const snapshot: EnvSnapshot = {
    authProvider: process.env.AUTH_PROVIDER,
    simpleAuthUserFile: process.env.SIMPLE_AUTH_USER_FILE,
  };

  process.env.AUTH_PROVIDER = 'simple';
  process.env.SIMPLE_AUTH_USER_FILE = resolveCanonicalFile();

  return snapshot;
};

export const restoreSimpleAuthEnv = (snapshot: EnvSnapshot): void => {
  if (snapshot.authProvider === undefined) {
    delete process.env.AUTH_PROVIDER;
  } else {
    process.env.AUTH_PROVIDER = snapshot.authProvider;
  }

  if (snapshot.simpleAuthUserFile === undefined) {
    delete process.env.SIMPLE_AUTH_USER_FILE;
  } else {
    process.env.SIMPLE_AUTH_USER_FILE = snapshot.simpleAuthUserFile;
  }
};
