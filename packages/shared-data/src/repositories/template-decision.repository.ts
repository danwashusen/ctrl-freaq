import Database from 'better-sqlite3';

import { BaseRepository } from './base-repository.js';
import {
  RecordTemplateValidationDecisionInputSchema,
  TemplateValidationDecisionRecordSchema,
  type RecordTemplateValidationDecisionInput,
  type TemplateValidationDecisionRecord,
} from '../models/template-decision.js';

function parsePayload(value: unknown): unknown {
  if (typeof value !== 'string' || value.length === 0) {
    return null;
  }

  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

export class TemplateValidationDecisionRepository extends BaseRepository<TemplateValidationDecisionRecord> {
  constructor(db: Database.Database) {
    super(db, 'template_validation_decisions', TemplateValidationDecisionRecordSchema);
    this.ensureTable();
  }

  private ensureTable(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS template_validation_decisions (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL,
        document_id TEXT NOT NULL,
        template_id TEXT NOT NULL,
        current_version TEXT NOT NULL,
        requested_version TEXT NOT NULL,
        action TEXT NOT NULL,
        notes TEXT,
        submitted_by TEXT,
        submitted_at TEXT NOT NULL,
        payload_json TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
    `);

    this.db.exec(
      `CREATE INDEX IF NOT EXISTS idx_template_decisions_project_submitted ON template_validation_decisions(project_id, submitted_at DESC)`
    );
    this.db.exec(
      `CREATE INDEX IF NOT EXISTS idx_template_decisions_document_submitted ON template_validation_decisions(document_id, submitted_at DESC)`
    );
  }

  protected override mapEntityToRow(
    entity: TemplateValidationDecisionRecord
  ): Record<string, unknown> {
    return {
      id: entity.id,
      project_id: entity.projectId,
      document_id: entity.documentId,
      template_id: entity.templateId,
      current_version: entity.currentVersion,
      requested_version: entity.requestedVersion,
      action: entity.action,
      notes: entity.notes ?? null,
      submitted_by: entity.submittedBy ?? null,
      submitted_at: entity.submittedAt.toISOString(),
      payload_json: entity.payload != null ? JSON.stringify(entity.payload) : null,
      created_at: entity.createdAt.toISOString(),
      updated_at: entity.updatedAt.toISOString(),
    };
  }

  protected override mapRowToEntity(
    row: Record<string, unknown>
  ): TemplateValidationDecisionRecord {
    return TemplateValidationDecisionRecordSchema.parse({
      id: String(row.id),
      projectId: String(row.project_id),
      documentId: String(row.document_id),
      templateId: String(row.template_id),
      currentVersion: String(row.current_version),
      requestedVersion: String(row.requested_version),
      action: row.action,
      notes: row.notes === null || row.notes === undefined ? null : String(row.notes),
      submittedBy:
        row.submitted_by === null || row.submitted_by === undefined
          ? null
          : String(row.submitted_by),
      submittedAt: new Date(String(row.submitted_at)),
      payload: parsePayload(row.payload_json),
      createdAt: new Date(String(row.created_at)),
      updatedAt: new Date(String(row.updated_at)),
    });
  }

  async recordDecision(
    input: RecordTemplateValidationDecisionInput
  ): Promise<TemplateValidationDecisionRecord> {
    const parsed = RecordTemplateValidationDecisionInputSchema.parse(input);
    return this.create({
      projectId: parsed.projectId,
      documentId: parsed.documentId,
      templateId: parsed.templateId,
      currentVersion: parsed.currentVersion,
      requestedVersion: parsed.requestedVersion,
      action: parsed.action,
      notes: parsed.notes ?? null,
      submittedBy: parsed.submittedBy ?? null,
      submittedAt: parsed.submittedAt ?? new Date(),
      payload: parsed.payload ?? null,
    });
  }

  async findLatestByProject(projectId: string): Promise<TemplateValidationDecisionRecord | null> {
    const stmt = this.db.prepare(
      `SELECT * FROM ${this.tableName}
        WHERE project_id = ?
        ORDER BY submitted_at DESC, created_at DESC
        LIMIT 1`
    );

    const row = stmt.get(projectId) as Record<string, unknown> | undefined;
    if (!row) {
      return null;
    }
    return this.mapRowToEntity(row);
  }

  async findLatestByDocument(documentId: string): Promise<TemplateValidationDecisionRecord | null> {
    const stmt = this.db.prepare(
      `SELECT * FROM ${this.tableName}
        WHERE document_id = ?
        ORDER BY submitted_at DESC, created_at DESC
        LIMIT 1`
    );

    const row = stmt.get(documentId) as Record<string, unknown> | undefined;
    if (!row) {
      return null;
    }
    return this.mapRowToEntity(row);
  }
}
