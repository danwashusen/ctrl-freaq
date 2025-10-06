import Database from 'better-sqlite3';

import { BaseRepository } from './base-repository.js';
import {
  DraftConflictLogSchema,
  type CreateDraftConflictLogInput,
  type DraftConflictLog,
  type UpdateDraftConflictLogInput,
} from '../models/draft-conflict-log.js';

const SOFT_DELETE_CONDITION = "(deleted_at IS NULL OR deleted_at = '')";

export class DraftConflictLogRepositoryImpl extends BaseRepository<DraftConflictLog> {
  constructor(db: Database.Database) {
    super(db, 'draft_conflict_logs', DraftConflictLogSchema);
  }

  async createLogEntry(
    input: CreateDraftConflictLogInput,
    actorId: string
  ): Promise<DraftConflictLog> {
    const entry = await super.create({
      ...input,
      resolvedBy: input.resolvedBy ?? null,
      resolutionNote: input.resolutionNote ?? null,
      createdBy: actorId,
      updatedBy: actorId,
      deletedAt: null,
      deletedBy: null,
    });
    return entry;
  }

  async listByDraft(draftId: string): Promise<DraftConflictLog[]> {
    const stmt = this.db.prepare(
      `SELECT * FROM ${this.tableName}
       WHERE draft_id = ? AND ${SOFT_DELETE_CONDITION}
       ORDER BY detected_at DESC`
    );
    const rows = stmt.all(draftId) as Record<string, unknown>[];
    return rows.map(row => this.mapRowToEntity(row));
  }

  async resolveLogEntry(
    id: string,
    updates: UpdateDraftConflictLogInput,
    actorId: string
  ): Promise<DraftConflictLog> {
    await super.update(id, {
      ...updates,
      resolvedBy: updates.resolvedBy ?? null,
      resolutionNote: updates.resolutionNote ?? null,
      updatedBy: updates.updatedBy ?? actorId,
    });

    const refreshed = await this.findById(id);
    if (!refreshed) {
      throw new Error(`Conflict log ${id} not found after resolve`);
    }
    return refreshed;
  }

  async deleteLogEntry(id: string, actorId: string): Promise<void> {
    const now = new Date().toISOString();
    const stmt = this.db.prepare(
      `UPDATE ${this.tableName}
         SET deleted_at = ?, deleted_by = ?, updated_at = ?, updated_by = ?
       WHERE id = ?`
    );
    stmt.run(now, actorId, now, actorId, id);
  }

  override async findById(id: string): Promise<DraftConflictLog | null> {
    const stmt = this.db.prepare(
      `SELECT * FROM ${this.tableName} WHERE id = ? AND ${SOFT_DELETE_CONDITION}`
    );
    const row = stmt.get(id) as Record<string, unknown> | undefined;
    if (!row) {
      return null;
    }

    return this.mapRowToEntity(row);
  }

  protected override mapRowToEntity(row: Record<string, unknown>): DraftConflictLog {
    const normalized: Record<string, unknown> = { ...row };

    if (normalized.resolved_by === undefined) {
      normalized.resolved_by = null;
    }
    if (normalized.resolution_note === undefined) {
      normalized.resolution_note = null;
    }

    return super.mapRowToEntity(normalized);
  }
}
