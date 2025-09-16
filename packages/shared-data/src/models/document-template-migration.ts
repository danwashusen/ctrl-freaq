import { randomUUID } from 'crypto';

import type Database from 'better-sqlite3';
import { z } from 'zod';

export enum DocumentTemplateMigrationStatus {
  PENDING = 'pending',
  SUCCEEDED = 'succeeded',
  FAILED = 'failed',
}

export const DocumentTemplateMigrationSchema = z.object({
  id: z.string().uuid(),
  documentId: z.string().min(1, 'documentId is required'),
  fromVersion: z.string().min(1, 'fromVersion is required'),
  toVersion: z.string().min(1, 'toVersion is required'),
  status: z.nativeEnum(DocumentTemplateMigrationStatus),
  validationErrors: z.unknown().optional(),
  initiatedBy: z.string().min(1, 'initiatedBy is required'),
  initiatedAt: z.date(),
  completedAt: z.date().nullable().optional(),
});

export type DocumentTemplateMigration = z.infer<typeof DocumentTemplateMigrationSchema>;

export interface LogPendingMigrationInput {
  documentId: string;
  fromVersion: string;
  toVersion: string;
  initiatedBy: string;
}

export interface MarkSucceededInput {
  migrationId: string;
}

export interface MarkFailedInput {
  migrationId: string;
  validationErrors?: unknown;
}

export class DocumentTemplateMigrationRepositoryImpl {
  private readonly db: Database.Database;

  constructor(db: Database.Database) {
    this.db = db;
  }

  async logPending(input: LogPendingMigrationInput): Promise<DocumentTemplateMigration> {
    const id = randomUUID();
    const now = new Date();
    const stmt = this.db.prepare(`
      INSERT INTO document_template_migrations (
        id,
        document_id,
        from_version,
        to_version,
        status,
        validation_errors,
        initiated_by,
        initiated_at,
        completed_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, NULL)
    `);

    stmt.run(
      id,
      input.documentId,
      input.fromVersion,
      input.toVersion,
      DocumentTemplateMigrationStatus.PENDING,
      null,
      input.initiatedBy,
      now.toISOString()
    );

    return this.getById(id);
  }

  async markSucceeded(input: MarkSucceededInput): Promise<DocumentTemplateMigration> {
    const now = new Date();
    const stmt = this.db.prepare(`
      UPDATE document_template_migrations
         SET status = ?,
             completed_at = ?,
             validation_errors = NULL
       WHERE id = ?
    `);

    const result = stmt.run(
      DocumentTemplateMigrationStatus.SUCCEEDED,
      now.toISOString(),
      input.migrationId
    );

    if (result.changes === 0) {
      throw new Error(`Migration not found: ${input.migrationId}`);
    }

    return this.getById(input.migrationId);
  }

  async markFailed(input: MarkFailedInput): Promise<DocumentTemplateMigration> {
    const now = new Date();
    const stmt = this.db.prepare(`
      UPDATE document_template_migrations
         SET status = ?,
             validation_errors = ?,
             completed_at = ?
       WHERE id = ?
    `);

    const payload =
      input.validationErrors === undefined ? null : JSON.stringify(input.validationErrors);

    const result = stmt.run(
      DocumentTemplateMigrationStatus.FAILED,
      payload,
      now.toISOString(),
      input.migrationId
    );

    if (result.changes === 0) {
      throw new Error(`Migration not found: ${input.migrationId}`);
    }

    return this.getById(input.migrationId);
  }

  async listForDocument(documentId: string): Promise<DocumentTemplateMigration[]> {
    const stmt = this.db.prepare(`
      SELECT * FROM document_template_migrations
       WHERE document_id = ?
       ORDER BY initiated_at DESC, rowid DESC
    `);
    const rows = stmt.all(documentId) as Record<string, unknown>[];
    return rows.map(row => this.mapRow(row));
  }

  private getById(id: string): DocumentTemplateMigration {
    const stmt = this.db.prepare('SELECT * FROM document_template_migrations WHERE id = ?');
    const row = stmt.get(id) as Record<string, unknown> | undefined;
    if (!row) {
      throw new Error(`Migration not found: ${id}`);
    }
    return this.mapRow(row);
  }

  private mapRow(row: Record<string, unknown>): DocumentTemplateMigration {
    const validationErrorsRaw = row.validation_errors as string | null | undefined;
    const validationErrors = validationErrorsRaw ? JSON.parse(validationErrorsRaw) : undefined;

    return DocumentTemplateMigrationSchema.parse({
      id: String(row.id),
      documentId: String(row.document_id),
      fromVersion: String(row.from_version),
      toVersion: String(row.to_version),
      status: row.status as DocumentTemplateMigrationStatus,
      validationErrors,
      initiatedBy: String(row.initiated_by),
      initiatedAt: new Date(String(row.initiated_at)),
      completedAt: row.completed_at ? new Date(String(row.completed_at)) : null,
    });
  }
}
