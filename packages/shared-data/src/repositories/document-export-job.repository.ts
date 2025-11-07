import Database from 'better-sqlite3';

import { BaseRepository } from './base-repository.js';
import {
  CreateDocumentExportJobSchema,
  DocumentExportJobSchema,
  type CreateDocumentExportJobInput,
  type DocumentExportJob,
  type UpdateDocumentExportJobInput,
} from '../models/document-export-job.js';

const ACTIVE_STATUSES = new Set<DocumentExportJob['status']>(['queued', 'running']);

export class DocumentExportJobRepository extends BaseRepository<DocumentExportJob> {
  constructor(db: Database.Database) {
    super(db, 'document_export_jobs', DocumentExportJobSchema);
    this.ensureTable();
  }

  private ensureTable(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS document_export_jobs (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL,
        format TEXT NOT NULL,
        scope TEXT NOT NULL,
        status TEXT NOT NULL,
        requested_by TEXT NOT NULL,
        requested_at TEXT NOT NULL,
        notify_email TEXT,
        artifact_url TEXT,
        error_message TEXT,
        completed_at TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      )
    `);

    this.db.exec(
      `CREATE INDEX IF NOT EXISTS idx_document_export_jobs_project_status ON document_export_jobs(project_id, status)`
    );
  }

  async createQueuedJob(
    input: Omit<CreateDocumentExportJobInput, 'status'>
  ): Promise<DocumentExportJob> {
    const payload = CreateDocumentExportJobSchema.parse({
      ...input,
      status: 'queued' as const,
    });

    return this.create({
      projectId: payload.projectId,
      format: payload.format,
      scope: payload.scope,
      status: payload.status,
      requestedBy: payload.requestedBy,
      requestedAt: payload.requestedAt,
      notifyEmail: payload.notifyEmail ?? null,
      artifactUrl: null,
      errorMessage: null,
      completedAt: null,
    });
  }

  async findActiveJob(projectId: string): Promise<DocumentExportJob | null> {
    const stmt = this.db.prepare(
      `SELECT * FROM ${this.tableName}
        WHERE project_id = ? AND status IN ('queued', 'running')
        ORDER BY created_at DESC
        LIMIT 1`
    );

    const row = stmt.get(projectId) as Record<string, unknown> | undefined;
    if (!row) {
      return null;
    }

    return this.mapRowToEntity(row);
  }

  async updateJobStatus(
    id: string,
    updates: UpdateDocumentExportJobInput
  ): Promise<DocumentExportJob> {
    return this.update(id, updates);
  }

  async listByProject(projectId: string, limit = 25): Promise<DocumentExportJob[]> {
    const stmt = this.db.prepare(
      `SELECT * FROM ${this.tableName}
        WHERE project_id = ?
        ORDER BY created_at DESC
        LIMIT ?`
    );

    const rows = stmt.all(projectId, limit) as Record<string, unknown>[];
    return rows.map(row => this.mapRowToEntity(row));
  }

  isActiveStatus(status: DocumentExportJob['status']): boolean {
    return ACTIVE_STATUSES.has(status);
  }
}
