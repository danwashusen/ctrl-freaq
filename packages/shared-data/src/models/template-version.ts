import type Database from 'better-sqlite3';
import { z } from 'zod';

import { BaseRepository } from '../repositories/index.js';

export enum TemplateVersionStatus {
  DRAFT = 'draft',
  ACTIVE = 'active',
  DEPRECATED = 'deprecated',
}

export const TemplateVersionSchema = z.object({
  id: z.string().uuid('Invalid template version id'),
  templateId: z.string().min(1, 'Template id is required'),
  version: z.string().min(1, 'Version is required'),
  status: z.nativeEnum(TemplateVersionStatus),
  changelog: z.string().nullable().optional(),
  schemaHash: z.string().min(1, 'Schema hash is required'),
  schemaJson: z.unknown(),
  sectionsJson: z.unknown(),
  sourcePath: z.string().min(1, 'Source path is required'),
  publishedAt: z.date().nullable().optional(),
  publishedBy: z.string().nullable().optional(),
  deprecatedAt: z.date().nullable().optional(),
  deprecatedBy: z.string().nullable().optional(),
  createdAt: z.date(),
  createdBy: z.string().min(1, 'createdBy is required'),
  updatedAt: z.date(),
  updatedBy: z.string().min(1, 'updatedBy is required'),
});

export type TemplateVersion = z.infer<typeof TemplateVersionSchema>;

export interface CreateTemplateVersionInput {
  templateId: string;
  version: string;
  status: TemplateVersionStatus;
  changelog?: string | null;
  schemaHash: string;
  schemaJson: unknown;
  sectionsJson: unknown;
  sourcePath: string;
  createdBy: string;
  updatedBy: string;
}

export interface ActivateTemplateVersionInput {
  versionId: string;
  activatedBy: string;
}

export interface DeprecateTemplateVersionInput {
  versionId: string;
  deprecatedBy: string;
}

export class TemplateVersionRepositoryImpl extends BaseRepository<TemplateVersion> {
  constructor(db: Database.Database) {
    super(db, 'template_versions', TemplateVersionSchema);
  }

  override async create(input: CreateTemplateVersionInput): Promise<TemplateVersion> {
    return super.create({
      ...input,
      changelog: input.changelog ?? null,
      publishedAt: null,
      publishedBy: null,
      deprecatedAt: null,
      deprecatedBy: null,
    });
  }

  protected override mapEntityToRow(entity: TemplateVersion): Record<string, unknown> {
    const row = super.mapEntityToRow(entity);
    row.schema_json = JSON.stringify(entity.schemaJson);
    row.sections_json = JSON.stringify(entity.sectionsJson);
    return row;
  }

  protected override mapRowToEntity(row: Record<string, unknown>): TemplateVersion {
    const normalized: Record<string, unknown> = { ...row };
    if (typeof normalized.schema_json === 'string') {
      normalized.schema_json = JSON.parse(normalized.schema_json);
    }
    if (typeof normalized.sections_json === 'string') {
      normalized.sections_json = JSON.parse(normalized.sections_json);
    }
    return super.mapRowToEntity(normalized);
  }

  async findByTemplateAndVersion(
    templateId: string,
    version: string
  ): Promise<TemplateVersion | null> {
    const stmt = this.db.prepare(
      `SELECT * FROM ${this.tableName} WHERE template_id = ? AND version = ?`
    );
    const row = stmt.get(templateId, version) as Record<string, unknown> | undefined;
    if (!row) {
      return null;
    }
    return this.mapRowToEntity(row);
  }

  async listByTemplate(templateId: string): Promise<TemplateVersion[]> {
    const stmt = this.db.prepare(
      `SELECT * FROM ${this.tableName} WHERE template_id = ? ORDER BY created_at DESC`
    );
    const rows = stmt.all(templateId) as Record<string, unknown>[];
    return rows.map(row => this.mapRowToEntity(row));
  }

  async markActive(input: ActivateTemplateVersionInput): Promise<TemplateVersion> {
    const existing = this.getByIdOrThrow(input.versionId);
    const now = new Date(existing.updatedAt.getTime() + 1);
    const stmt = this.db.prepare(
      `UPDATE ${this.tableName}
         SET status = ?,
             published_at = ?,
             published_by = ?,
             updated_at = ?,
             updated_by = ?
       WHERE id = ?`
    );
    const result = stmt.run(
      TemplateVersionStatus.ACTIVE,
      now.toISOString(),
      input.activatedBy,
      now.toISOString(),
      input.activatedBy,
      input.versionId
    );

    if (result.changes === 0) {
      throw new Error(`Template version not found: ${input.versionId}`);
    }

    return this.getByIdOrThrow(input.versionId);
  }

  async markDeprecated(input: DeprecateTemplateVersionInput): Promise<TemplateVersion> {
    const existing = this.getByIdOrThrow(input.versionId);
    const now = new Date(existing.updatedAt.getTime() + 1);
    const stmt = this.db.prepare(
      `UPDATE ${this.tableName}
         SET status = ?,
             deprecated_at = ?,
             deprecated_by = ?,
             updated_at = ?,
             updated_by = ?
       WHERE id = ?`
    );
    const result = stmt.run(
      TemplateVersionStatus.DEPRECATED,
      now.toISOString(),
      input.deprecatedBy,
      now.toISOString(),
      input.deprecatedBy,
      input.versionId
    );

    if (result.changes === 0) {
      throw new Error(`Template version not found: ${input.versionId}`);
    }

    return this.getByIdOrThrow(input.versionId);
  }

  private getByIdOrThrow(id: string): TemplateVersion {
    const stmt = this.db.prepare(`SELECT * FROM ${this.tableName} WHERE id = ?`);
    const row = stmt.get(id) as Record<string, unknown> | undefined;
    if (!row) {
      throw new Error(`Template version not found: ${id}`);
    }
    return this.mapRowToEntity(row);
  }
}
