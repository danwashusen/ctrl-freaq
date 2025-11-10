import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import Database from 'better-sqlite3';
import type { Logger } from 'pino';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  DocumentTemplateRepositoryImpl,
  TemplateVersionRepositoryImpl,
} from '@ctrl-freaq/shared-data';

import { TemplateCatalogService } from '../template-catalog.service.js';
import { bootstrapDefaultTemplate } from './bootstrap-default-template.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, '..', '..', '..');
const migrationPath = resolve(
  repoRoot,
  '..',
  '..',
  'packages',
  'shared-data',
  'migrations',
  '005_template_catalog.sql'
);
const templateFilePath = resolve(repoRoot, '..', '..', 'templates', 'architecture-reference.yaml');

describe('bootstrapDefaultTemplate', () => {
  let db: Database.Database;
  let templateRepository: DocumentTemplateRepositoryImpl;
  let versionRepository: TemplateVersionRepositoryImpl;
  let catalogService: TemplateCatalogService;
  const logger = {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  } as unknown as Logger;

  beforeEach(() => {
    db = new Database(':memory:');
    const migrationSql = readFileSync(migrationPath, 'utf-8');
    db.exec(migrationSql);
    templateRepository = new DocumentTemplateRepositoryImpl(db);
    versionRepository = new TemplateVersionRepositoryImpl(db);
    catalogService = new TemplateCatalogService(templateRepository, versionRepository, logger);
  });

  afterEach(() => {
    db.close();
    vi.clearAllMocks();
  });

  it('publishes and activates the default template when the catalog is empty', async () => {
    await bootstrapDefaultTemplate({
      templateRepository,
      versionRepository,
      catalogService,
      logger,
      templateFile: templateFilePath,
    });

    const template = await templateRepository.findById('architecture-reference');
    expect(template).toBeTruthy();

    const versions = await versionRepository.listByTemplate('architecture-reference');
    expect(versions).toHaveLength(1);
    expect(template?.activeVersionId).toBe(versions[0]?.id);
    expect(versions[0]).toMatchObject({
      version: '2.1.0',
      status: 'active',
    });

    await bootstrapDefaultTemplate({
      templateRepository,
      versionRepository,
      catalogService,
      logger,
      templateFile: templateFilePath,
    });

    const versionsAfterSecondRun = await versionRepository.listByTemplate('architecture-reference');
    expect(versionsAfterSecondRun).toHaveLength(1);
    expect(versionsAfterSecondRun[0]?.id).toBe(versions[0]?.id);
  });
});
