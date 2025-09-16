import type Database from 'better-sqlite3';
import { z } from 'zod';

export enum DocumentTemplateStatus {
  DRAFT = 'draft',
  ACTIVE = 'active',
  DEPRECATED = 'deprecated',
}

export const DocumentTemplateAggressivenessSchema = z
  .enum(['conservative', 'balanced', 'yolo'])
  .nullable()
  .optional();

export const DocumentTemplateSchema = z.object({
  id: z
    .string()
    .min(1, 'Template id is required')
    .max(64, 'Template id is too long')
    .regex(/^[a-z0-9-]+$/, 'Template id must use lowercase letters, numbers, or hyphen'),
  name: z.string().min(1, 'Template name is required'),
  description: z.string().nullable().optional(),
  documentType: z.string().min(1, 'Document type is required'),
  activeVersionId: z.string().nullable().optional(),
  status: z.nativeEnum(DocumentTemplateStatus),
  defaultAggressiveness: DocumentTemplateAggressivenessSchema,
  createdAt: z.date(),
  createdBy: z.string().min(1, 'createdBy is required'),
  updatedAt: z.date(),
  updatedBy: z.string().min(1, 'updatedBy is required'),
  deletedAt: z.date().nullable().optional(),
  deletedBy: z.string().nullable().optional(),
});

export type DocumentTemplate = z.infer<typeof DocumentTemplateSchema>;

export interface CreateDocumentTemplateInput {
  id: string;
  name: string;
  description?: string | null;
  documentType: string;
  status?: DocumentTemplateStatus;
  defaultAggressiveness?: 'conservative' | 'balanced' | 'yolo' | null;
  createdBy: string;
  updatedBy: string;
}

export interface UpsertDocumentTemplateInput {
  id: string;
  name: string;
  description?: string | null;
  documentType: string;
  defaultAggressiveness?: 'conservative' | 'balanced' | 'yolo' | null;
  createdBy: string;
  updatedBy: string;
}

export interface SetActiveVersionInput {
  templateId: string;
  versionId: string;
  updatedBy: string;
}

export interface MarkDeprecatedInput {
  templateId: string;
  updatedBy: string;
}

export class DocumentTemplateRepositoryImpl {
  private readonly db: Database.Database;

  constructor(db: Database.Database) {
    this.db = db;
  }

  async create(input: CreateDocumentTemplateInput): Promise<DocumentTemplate> {
    const now = new Date();
    const entity = DocumentTemplateSchema.parse({
      id: input.id,
      name: input.name,
      description: input.description ?? null,
      documentType: input.documentType,
      activeVersionId: null,
      status: input.status ?? DocumentTemplateStatus.DRAFT,
      defaultAggressiveness: input.defaultAggressiveness ?? null,
      createdAt: now,
      createdBy: input.createdBy,
      updatedAt: now,
      updatedBy: input.updatedBy,
      deletedAt: null,
      deletedBy: null,
    });

    const stmt = this.db.prepare(`
      INSERT INTO document_templates (
        id,
        name,
        description,
        document_type,
        active_version_id,
        status,
        default_aggressiveness,
        created_at,
        created_by,
        updated_at,
        updated_by,
        deleted_at,
        deleted_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      entity.id,
      entity.name,
      entity.description,
      entity.documentType,
      entity.activeVersionId,
      entity.status,
      entity.defaultAggressiveness,
      entity.createdAt.toISOString(),
      entity.createdBy,
      entity.updatedAt.toISOString(),
      entity.updatedBy,
      entity.deletedAt,
      entity.deletedBy
    );

    return entity;
  }

  async findById(id: string): Promise<DocumentTemplate | null> {
    const stmt = this.db.prepare('SELECT * FROM document_templates WHERE id = ?');
    const row = stmt.get(id) as Record<string, unknown> | undefined;
    if (!row) {
      return null;
    }
    return this.mapRow(row);
  }

  async listAll(): Promise<DocumentTemplate[]> {
    const stmt = this.db.prepare('SELECT * FROM document_templates ORDER BY name ASC');
    const rows = stmt.all() as Record<string, unknown>[];
    return rows.map(row => this.mapRow(row));
  }

  async upsertMetadata(input: UpsertDocumentTemplateInput): Promise<DocumentTemplate> {
    const existing = await this.findById(input.id);
    if (!existing) {
      return this.create({
        id: input.id,
        name: input.name,
        description: input.description,
        documentType: input.documentType,
        status: DocumentTemplateStatus.DRAFT,
        defaultAggressiveness: input.defaultAggressiveness ?? null,
        createdBy: input.createdBy,
        updatedBy: input.updatedBy,
      });
    }

    const now = new Date(existing.updatedAt.getTime() + 1);
    const stmt = this.db.prepare(`
      UPDATE document_templates
         SET name = ?,
             description = ?,
             document_type = ?,
             default_aggressiveness = ?,
             updated_at = ?,
             updated_by = ?
       WHERE id = ?
    `);

    const result = stmt.run(
      input.name,
      input.description ?? null,
      input.documentType,
      input.defaultAggressiveness ?? null,
      now.toISOString(),
      input.updatedBy,
      input.id
    );

    if (result.changes === 0) {
      throw new Error(`Failed to update document template: ${input.id}`);
    }

    const updated = await this.findById(input.id);
    if (!updated) {
      throw new Error(`Document template not found after update: ${input.id}`);
    }
    return updated;
  }

  async setActiveVersion(input: SetActiveVersionInput): Promise<DocumentTemplate> {
    const existing = await this.findById(input.templateId);
    if (!existing) {
      throw new Error(`Document template not found: ${input.templateId}`);
    }

    const now = new Date(existing.updatedAt.getTime() + 1);
    const stmt = this.db.prepare(`
      UPDATE document_templates
         SET active_version_id = ?,
             status = ?,
             updated_at = ?,
             updated_by = ?
       WHERE id = ?
    `);

    const result = stmt.run(
      input.versionId,
      DocumentTemplateStatus.ACTIVE,
      now.toISOString(),
      input.updatedBy,
      input.templateId
    );

    if (result.changes === 0) {
      throw new Error(`Document template not found: ${input.templateId}`);
    }

    const updated = await this.findById(input.templateId);
    if (!updated) {
      throw new Error(`Failed to load template after activation: ${input.templateId}`);
    }
    return updated;
  }

  async markDeprecated(input: MarkDeprecatedInput): Promise<DocumentTemplate> {
    const existing = await this.findById(input.templateId);
    if (!existing) {
      throw new Error(`Document template not found: ${input.templateId}`);
    }

    const now = new Date(existing.updatedAt.getTime() + 1);
    const stmt = this.db.prepare(`
      UPDATE document_templates
         SET status = ?,
             updated_at = ?,
             updated_by = ?
       WHERE id = ?
    `);

    const result = stmt.run(
      DocumentTemplateStatus.DEPRECATED,
      now.toISOString(),
      input.updatedBy,
      input.templateId
    );

    if (result.changes === 0) {
      throw new Error(`Document template not found: ${input.templateId}`);
    }

    const updated = await this.findById(input.templateId);
    if (!updated) {
      throw new Error(`Failed to load template after deprecation: ${input.templateId}`);
    }
    return updated;
  }

  private mapRow(row: Record<string, unknown>): DocumentTemplate {
    const entity = {
      id: String(row.id),
      name: String(row.name),
      description:
        row.description === null || row.description === undefined ? null : String(row.description),
      documentType: String(row.document_type),
      activeVersionId:
        row.active_version_id === null || row.active_version_id === undefined
          ? null
          : String(row.active_version_id),
      status: row.status as DocumentTemplateStatus,
      defaultAggressiveness:
        row.default_aggressiveness === null || row.default_aggressiveness === undefined
          ? null
          : (String(row.default_aggressiveness) as 'conservative' | 'balanced' | 'yolo'),
      createdAt: new Date(String(row.created_at)),
      createdBy: String(row.created_by),
      updatedAt: new Date(String(row.updated_at)),
      updatedBy: String(row.updated_by),
      deletedAt:
        row.deleted_at === null || row.deleted_at === undefined
          ? null
          : new Date(String(row.deleted_at)),
      deletedBy:
        row.deleted_by === null || row.deleted_by === undefined ? null : String(row.deleted_by),
    } satisfies DocumentTemplate;

    return DocumentTemplateSchema.parse(entity);
  }
}
