import fs from 'node:fs';
import path from 'node:path';

import type { Database } from 'better-sqlite3';
import { load } from 'js-yaml';

type SimpleAuthUserRecord = {
  id: string;
  email: string;
  first_name?: string;
  last_name?: string;
};

type SimpleAuthConfig = {
  users: SimpleAuthUserRecord[];
};

const CANONICAL_SIMPLE_AUTH_USER_FILE = path.resolve(
  process.cwd(),
  'tests/shared/simple-auth/users.yaml'
);

type EnvSnapshot = {
  authProvider?: string;
  simpleAuthUserFile?: string;
};

let cachedUsers: SimpleAuthUserRecord[] | null = null;

export function getCanonicalSimpleAuthUserFile(): string {
  return CANONICAL_SIMPLE_AUTH_USER_FILE;
}

export function setSimpleAuthEnv(): EnvSnapshot {
  const snapshot: EnvSnapshot = {
    authProvider: process.env.AUTH_PROVIDER,
    simpleAuthUserFile: process.env.SIMPLE_AUTH_USER_FILE,
  };

  process.env.AUTH_PROVIDER = 'simple';
  process.env.SIMPLE_AUTH_USER_FILE = CANONICAL_SIMPLE_AUTH_USER_FILE;

  return snapshot;
}

export function restoreSimpleAuthEnv(snapshot: EnvSnapshot): void {
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
}

function loadCanonicalUsers(): SimpleAuthUserRecord[] {
  if (cachedUsers) {
    return cachedUsers;
  }

  if (!fs.existsSync(CANONICAL_SIMPLE_AUTH_USER_FILE)) {
    throw new Error(`Canonical simple-auth fixture missing at ${CANONICAL_SIMPLE_AUTH_USER_FILE}`);
  }

  const raw = fs.readFileSync(CANONICAL_SIMPLE_AUTH_USER_FILE, 'utf8');
  const parsed = load(raw) as SimpleAuthConfig | undefined;
  const rawUsers = Array.isArray(parsed?.users) ? parsed.users : [];

  cachedUsers = rawUsers.map(user => ({
    id: user.id,
    email: user.email,
    first_name: user.first_name,
    last_name: user.last_name,
  }));

  return cachedUsers;
}

export function seedSimpleAuthUsers(db: Database): void {
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
}
