import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

import Database from 'better-sqlite3';
import { afterEach, describe, expect, it } from 'vitest';

import { DocumentTemplateRepositoryImpl, runSharedDataMigrations } from '@ctrl-freaq/shared-data';

import { createTemplatePublisher } from './template-publisher.js';

describe('template publisher metadata preservation', () => {
  let databaseDir: string | null = null;

  afterEach(() => {
    if (!databaseDir) {
      return;
    }
    rmSync(databaseDir, { recursive: true, force: true });
    databaseDir = null;
  });

  it('retains existing defaultAggressiveness when republishing a template', async () => {
    databaseDir = mkdtempSync(join(tmpdir(), 'template-publisher-'));
    const databasePath = join(databaseDir, 'ctrl-freaq.db');

    runSharedDataMigrations({ databasePath });

    const publisher = createTemplatePublisher({ databasePath, userId: 'manager_123' });
    const fixture = resolve(process.cwd(), 'tests/fixtures/architecture.valid.yaml');

    await publisher.publishFromFile({ file: fixture, version: '1.0.0' });

    const database = new Database(databasePath);
    const templates = new DocumentTemplateRepositoryImpl(database);

    await templates.upsertMetadata({
      id: 'architecture',
      name: 'Architecture Document',
      description: 'Architecture template',
      documentType: 'architecture',
      defaultAggressiveness: 'balanced',
      createdBy: 'manager_123',
      updatedBy: 'manager_123',
    });

    await publisher.publishFromFile({ file: fixture, version: '1.1.0' });

    const template = await templates.findById('architecture');
    expect(template?.defaultAggressiveness).toBe('balanced');

    database.close();
  });
});
