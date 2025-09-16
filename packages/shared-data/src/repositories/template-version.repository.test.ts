import Database from 'better-sqlite3';
import { beforeEach, describe, expect, it } from 'vitest';

import {
  DocumentTemplateRepositoryImpl,
  DocumentTemplateStatus,
} from '../models/document-template';
import { TemplateVersionRepositoryImpl, TemplateVersionStatus } from '../models/template-version';

function setupDb() {
  const db = new Database(':memory:');
  db.pragma('journal_mode = WAL');
  db.exec(`
    CREATE TABLE document_templates (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      document_type TEXT NOT NULL,
      active_version_id TEXT,
      status TEXT NOT NULL,
      default_aggressiveness TEXT,
      created_at TEXT NOT NULL,
      created_by TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      updated_by TEXT NOT NULL,
      deleted_at TEXT,
      deleted_by TEXT
    );

    CREATE TABLE template_versions (
      id TEXT PRIMARY KEY,
      template_id TEXT NOT NULL,
      version TEXT NOT NULL,
      status TEXT NOT NULL,
      changelog TEXT,
      schema_hash TEXT NOT NULL,
      schema_json TEXT NOT NULL,
      sections_json TEXT NOT NULL,
      source_path TEXT NOT NULL,
      published_at TEXT,
      published_by TEXT,
      deprecated_at TEXT,
      deprecated_by TEXT,
      created_at TEXT NOT NULL,
      created_by TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      updated_by TEXT NOT NULL,
      UNIQUE(template_id, version)
    );
  `);
  return db;
}

describe('TemplateVersionRepositoryImpl', () => {
  let db: Database.Database;
  let templateRepo: DocumentTemplateRepositoryImpl;
  let repo: TemplateVersionRepositoryImpl;
  const managerId = 'manager_123';

  beforeEach(() => {
    db = setupDb();
    templateRepo = new DocumentTemplateRepositoryImpl(db);
    repo = new TemplateVersionRepositoryImpl(db);
  });

  async function seedTemplate() {
    return templateRepo.create({
      id: 'architecture',
      name: 'Architecture Template',
      documentType: 'architecture',
      createdBy: managerId,
      updatedBy: managerId,
      status: DocumentTemplateStatus.DRAFT,
    });
  }

  it('creates and retrieves template versions with schema snapshots', async () => {
    const template = await seedTemplate();

    const created = await repo.create({
      templateId: template.id,
      version: '1.0.0',
      status: TemplateVersionStatus.DRAFT,
      changelog: 'Initial release',
      schemaHash: 'hash-v1',
      schemaJson: { title: 'Architecture Template', type: 'object' },
      sectionsJson: [
        {
          id: 'introduction',
          title: 'Introduction',
          orderIndex: 0,
          required: true,
          type: 'markdown',
        },
      ],
      sourcePath: 'templates/architecture.yaml',
      createdBy: managerId,
      updatedBy: managerId,
    });

    expect(created.id).toBeTruthy();
    expect(created.status).toBe(TemplateVersionStatus.DRAFT);
    expect(created.schemaJson).toMatchObject({ title: 'Architecture Template' });

    const fetched = await repo.findByTemplateAndVersion(template.id, '1.0.0');
    expect(fetched?.id).toBe(created.id);
    expect(fetched?.schemaHash).toBe('hash-v1');

    const list = await repo.listByTemplate(template.id);
    expect(list).toHaveLength(1);
    expect(list[0].version).toBe('1.0.0');
  });

  it('marks a version active and stamps publish metadata', async () => {
    const template = await seedTemplate();
    const version = await repo.create({
      templateId: template.id,
      version: '1.0.0',
      status: TemplateVersionStatus.DRAFT,
      changelog: 'Initial release',
      schemaHash: 'hash-v1',
      schemaJson: { title: 'Architecture Template', type: 'object' },
      sectionsJson: [
        {
          id: 'introduction',
          title: 'Introduction',
          orderIndex: 0,
          required: true,
          type: 'markdown',
        },
      ],
      sourcePath: 'templates/architecture.yaml',
      createdBy: managerId,
      updatedBy: managerId,
    });

    const activated = await repo.markActive({
      versionId: version.id,
      activatedBy: 'manager_activator',
    });

    expect(activated.status).toBe(TemplateVersionStatus.ACTIVE);
    expect(activated.publishedBy).toBe('manager_activator');
    expect(activated.publishedAt).toBeInstanceOf(Date);
    expect(activated.updatedAt.getTime()).toBeGreaterThan(version.updatedAt.getTime());
  });

  it('marks a version deprecated without losing audit trail', async () => {
    const template = await seedTemplate();
    const version = await repo.create({
      templateId: template.id,
      version: '1.0.0',
      status: TemplateVersionStatus.ACTIVE,
      changelog: 'Initial release',
      schemaHash: 'hash-v1',
      schemaJson: { title: 'Architecture Template', type: 'object' },
      sectionsJson: [
        {
          id: 'introduction',
          title: 'Introduction',
          orderIndex: 0,
          required: true,
          type: 'markdown',
        },
      ],
      sourcePath: 'templates/architecture.yaml',
      createdBy: managerId,
      updatedBy: managerId,
    });

    const deprecated = await repo.markDeprecated({
      versionId: version.id,
      deprecatedBy: 'manager_retire',
    });

    expect(deprecated.status).toBe(TemplateVersionStatus.DEPRECATED);
    expect(deprecated.deprecatedBy).toBe('manager_retire');
    expect(deprecated.deprecatedAt).toBeInstanceOf(Date);
  });

  it('rejects duplicate semantic versions for the same template', async () => {
    const template = await seedTemplate();

    await repo.create({
      templateId: template.id,
      version: '1.0.0',
      status: TemplateVersionStatus.DRAFT,
      changelog: 'Initial release',
      schemaHash: 'hash-v1',
      schemaJson: { title: 'Architecture Template', type: 'object' },
      sectionsJson: [
        {
          id: 'introduction',
          title: 'Introduction',
          orderIndex: 0,
          required: true,
          type: 'markdown',
        },
      ],
      sourcePath: 'templates/architecture.yaml',
      createdBy: managerId,
      updatedBy: managerId,
    });

    await expect(
      repo.create({
        templateId: template.id,
        version: '1.0.0',
        status: TemplateVersionStatus.DRAFT,
        changelog: 'Duplicate',
        schemaHash: 'hash-v2',
        schemaJson: { title: 'Duplicate', type: 'object' },
        sectionsJson: [
          { id: 'summary', title: 'Summary', orderIndex: 0, required: true, type: 'markdown' },
        ],
        sourcePath: 'templates/architecture.yaml',
        createdBy: managerId,
        updatedBy: managerId,
      })
    ).rejects.toThrowError(/template_versions/);
  });
});
