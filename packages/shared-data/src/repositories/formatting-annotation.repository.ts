import Database from 'better-sqlite3';

import { BaseRepository } from './base-repository.js';
import {
  FormattingAnnotationSchema,
  type CreateFormattingAnnotationInput,
  type FormattingAnnotation,
  type UpdateFormattingAnnotationInput,
} from '../models/formatting-annotation.js';
import type { QueryOptions } from '../types/index.js';

const SOFT_DELETE_CONDITION = "(deleted_at IS NULL OR deleted_at = '')";

export class FormattingAnnotationRepositoryImpl extends BaseRepository<FormattingAnnotation> {
  constructor(db: Database.Database) {
    super(db, 'formatting_annotations', FormattingAnnotationSchema);
  }

  async createAnnotation(
    input: CreateFormattingAnnotationInput,
    actorId: string
  ): Promise<FormattingAnnotation> {
    const annotation = await super.create({
      ...input,
      createdBy: input.createdBy ?? actorId,
      updatedBy: input.updatedBy ?? actorId,
      deletedAt: null,
      deletedBy: null,
    });

    return annotation;
  }

  async updateAnnotation(
    id: string,
    updates: UpdateFormattingAnnotationInput,
    actorId: string
  ): Promise<FormattingAnnotation> {
    const payload: Partial<FormattingAnnotation> = {
      ...updates,
      updatedBy: updates.updatedBy ?? actorId,
    };

    await super.update(id, payload);

    const refreshed = await this.findById(id);
    if (!refreshed) {
      throw new Error(`Formatting annotation ${id} not found after update`);
    }
    return refreshed;
  }

  async listByDraft(draftId: string, options: QueryOptions = {}): Promise<FormattingAnnotation[]> {
    const queryParts: string[] = [
      `SELECT * FROM ${this.tableName} WHERE draft_id = ? AND ${SOFT_DELETE_CONDITION}`,
    ];
    const params: unknown[] = [draftId];

    const orderBy = options.orderBy ?? 'start_offset';
    const direction = options.orderDirection ?? 'ASC';
    queryParts.push(`ORDER BY ${orderBy} ${direction}`);

    if (typeof options.limit === 'number') {
      queryParts.push('LIMIT ?');
      params.push(options.limit);
    }

    if (typeof options.offset === 'number') {
      queryParts.push('OFFSET ?');
      params.push(options.offset);
    }

    const stmt = this.db.prepare(queryParts.join(' '));
    const rows = stmt.all(...params) as Record<string, unknown>[];
    return rows.map(row => this.mapRowToEntity(row));
  }

  async deleteAnnotation(id: string, actorId: string): Promise<void> {
    const now = new Date().toISOString();
    const stmt = this.db.prepare(
      `UPDATE ${this.tableName}
         SET deleted_at = ?, deleted_by = ?, updated_at = ?, updated_by = ?
       WHERE id = ?`
    );
    stmt.run(now, actorId, now, actorId, id);
  }

  override async findById(id: string): Promise<FormattingAnnotation | null> {
    const stmt = this.db.prepare(
      `SELECT * FROM ${this.tableName} WHERE id = ? AND ${SOFT_DELETE_CONDITION}`
    );
    const row = stmt.get(id) as Record<string, unknown> | undefined;
    if (!row) {
      return null;
    }

    return this.mapRowToEntity(row);
  }
}
