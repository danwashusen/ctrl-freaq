import { randomUUID } from 'crypto';

import type Database from 'better-sqlite3';
import { z } from 'zod';

import { BaseRepository } from '../repositories/base-repository.js';

export const DocumentContentSchema = z.record(z.string(), z.unknown(), {
  message: 'Document content is required',
});

export const DocumentSchema = z.object({
  id: z.string().min(1, 'Document id is required'),
  projectId: z.string().min(1, 'Project id is required'),
  title: z.string().min(1, 'Title is required'),
  content: DocumentContentSchema,
  templateId: z.string().min(1, 'Template id is required'),
  templateVersion: z.string().min(1, 'Template version is required'),
  templateSchemaHash: z.string().min(1, 'Template schema hash is required'),
  createdAt: z.date(),
  createdBy: z.string().min(1, 'createdBy is required'),
  updatedAt: z.date(),
  updatedBy: z.string().min(1, 'updatedBy is required'),
  deletedAt: z.date().nullable().optional(),
  deletedBy: z.string().nullable().optional(),
});

export type Document = z.infer<typeof DocumentSchema>;

export interface CreateDocumentInput {
  id?: string;
  projectId: string;
  title: string;
  content: Record<string, unknown>;
  templateId: string;
  templateVersion: string;
  templateSchemaHash: string;
  createdBy: string;
  updatedBy: string;
}

export interface UpdateDocumentContentInput {
  title?: string;
  content: Record<string, unknown>;
  templateVersion: string;
  templateSchemaHash: string;
  updatedBy: string;
}

export interface UpdateTemplateBindingInput {
  documentId: string;
  templateId: string;
  templateVersion: string;
  templateSchemaHash: string;
  updatedBy: string;
}

export class DocumentRepositoryImpl extends BaseRepository<Document> {
  constructor(db: Database.Database) {
    super(db, 'documents', DocumentSchema);
  }

  override async create(input: CreateDocumentInput): Promise<Document> {
    const now = new Date();
    const entity: Document = {
      id: input.id ?? randomUUID(),
      projectId: input.projectId,
      title: input.title,
      content: input.content,
      templateId: input.templateId,
      templateVersion: input.templateVersion,
      templateSchemaHash: input.templateSchemaHash,
      createdAt: now,
      createdBy: input.createdBy,
      updatedAt: now,
      updatedBy: input.updatedBy,
      deletedAt: null,
      deletedBy: null,
    };

    const validated = this.schema.parse(entity);
    const row = this.mapEntityToRow(validated);

    const entries = Object.entries(row);
    const columns = entries.map(([column]) => column);
    const placeholders = columns.map(() => '?').join(', ');
    const query = `INSERT INTO ${this.tableName} (${columns.join(', ')}) VALUES (${placeholders})`;
    const values = entries.map(([, value]) => value);
    this.db.prepare(query).run(...values);

    return validated;
  }

  async updateContent(id: string, input: UpdateDocumentContentInput): Promise<Document> {
    const updates: Partial<Document> = {
      content: input.content,
      templateVersion: input.templateVersion,
      templateSchemaHash: input.templateSchemaHash,
      updatedBy: input.updatedBy,
    };

    if (typeof input.title === 'string') {
      updates.title = input.title;
    }

    return super.update(id, updates);
  }

  async updateTemplateBinding(input: UpdateTemplateBindingInput): Promise<Document> {
    return super.update(input.documentId, {
      templateId: input.templateId,
      templateVersion: input.templateVersion,
      templateSchemaHash: input.templateSchemaHash,
      updatedBy: input.updatedBy,
    });
  }

  async listByProject(projectId: string): Promise<Document[]> {
    const stmt = this.db.prepare(
      `SELECT * FROM ${this.tableName}
        WHERE project_id = ? AND (deleted_at IS NULL OR deleted_at = '')
        ORDER BY updated_at DESC`
    );
    const rows = stmt.all(projectId) as Record<string, unknown>[];
    return rows.map(row => this.mapRowToEntity(row));
  }

  protected override mapEntityToRow(entity: Document): Record<string, unknown> {
    return {
      id: entity.id,
      project_id: entity.projectId,
      title: entity.title,
      content_json: JSON.stringify(entity.content),
      template_id: entity.templateId,
      template_version: entity.templateVersion,
      template_schema_hash: entity.templateSchemaHash,
      created_at: entity.createdAt.toISOString(),
      created_by: entity.createdBy,
      updated_at: entity.updatedAt.toISOString(),
      updated_by: entity.updatedBy,
      deleted_at: entity.deletedAt ? entity.deletedAt.toISOString() : null,
      deleted_by: entity.deletedBy ?? null,
    };
  }

  protected override mapRowToEntity(row: Record<string, unknown>): Document {
    const contentSource = row.content_json;
    let content: Record<string, unknown> = {};
    if (typeof contentSource === 'string') {
      try {
        const parsed = JSON.parse(contentSource) as Record<string, unknown> | null;
        if (parsed && typeof parsed === 'object') {
          content = parsed;
        }
      } catch (error) {
        throw new Error(
          `Failed to parse document content_json for id=${row.id}: ${(error as Error).message}`
        );
      }
    }

    const templateId = row.template_id;
    const templateVersion = row.template_version;
    const templateSchemaHash = row.template_schema_hash;

    if (!templateId || !templateVersion || !templateSchemaHash) {
      throw new Error(`Document ${row.id as string} is missing template binding metadata`);
    }

    const entity = {
      id: String(row.id),
      projectId: String(row.project_id),
      title: String(row.title),
      content,
      templateId: String(templateId),
      templateVersion: String(templateVersion),
      templateSchemaHash: String(templateSchemaHash),
      createdAt: new Date(String(row.created_at)),
      createdBy: String(row.created_by),
      updatedAt: new Date(String(row.updated_at)),
      updatedBy: String(row.updated_by),
      deletedAt: row.deleted_at ? new Date(String(row.deleted_at)) : null,
      deletedBy:
        row.deleted_by === null || row.deleted_by === undefined ? null : String(row.deleted_by),
    } satisfies Document;

    return this.schema.parse(entity);
  }
}
