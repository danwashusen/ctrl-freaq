import Database from 'better-sqlite3';

import { BaseRepository } from './base-repository';
import {
  SectionReviewSummarySchema,
  type CreateSectionReviewSummaryInput,
  type SectionReviewSummary,
  type UpdateSectionReviewSummaryInput,
} from '../models/section-review-summary';

const SOFT_DELETE_CONDITION = "(deleted_at IS NULL OR deleted_at = '')";

export class SectionReviewRepositoryImpl extends BaseRepository<SectionReviewSummary> {
  constructor(db: Database.Database) {
    super(db, 'section_review_summaries', SectionReviewSummarySchema);
  }

  async createReview(
    input: CreateSectionReviewSummaryInput,
    actorId: string
  ): Promise<SectionReviewSummary> {
    const review = await super.create({
      ...input,
      decidedAt: input.decidedAt ?? null,
      createdBy: actorId,
      updatedBy: actorId,
      deletedAt: null,
      deletedBy: null,
    });

    return review;
  }

  async updateReviewStatus(
    id: string,
    updates: UpdateSectionReviewSummaryInput,
    actorId: string
  ): Promise<SectionReviewSummary> {
    await super.update(id, {
      ...updates,
      decidedAt: updates.decidedAt ?? null,
      updatedBy: updates.updatedBy ?? actorId,
    });

    const refreshed = await this.findById(id);
    if (!refreshed) {
      throw new Error(`Review summary ${id} not found after update`);
    }
    return refreshed;
  }

  async listBySection(
    sectionId: string,
    status?: SectionReviewSummary['reviewStatus']
  ): Promise<SectionReviewSummary[]> {
    const clauses: string[] = [`section_id = ?`, SOFT_DELETE_CONDITION];
    const params: unknown[] = [sectionId];

    if (status) {
      clauses.push('review_status = ?');
      params.push(status);
    }

    const stmt = this.db.prepare(
      `SELECT * FROM ${this.tableName}
       WHERE ${clauses.join(' AND ')}
       ORDER BY submitted_at DESC`
    );
    const rows = stmt.all(...params) as Record<string, unknown>[];
    return rows.map(row => this.mapRowToEntity(row));
  }

  async deleteReview(id: string, actorId: string): Promise<void> {
    const now = new Date().toISOString();
    const stmt = this.db.prepare(
      `UPDATE ${this.tableName}
         SET deleted_at = ?, deleted_by = ?, updated_at = ?, updated_by = ?
       WHERE id = ?`
    );
    stmt.run(now, actorId, now, actorId, id);
  }

  override async findById(id: string): Promise<SectionReviewSummary | null> {
    const stmt = this.db.prepare(
      `SELECT * FROM ${this.tableName} WHERE id = ? AND ${SOFT_DELETE_CONDITION}`
    );
    const row = stmt.get(id) as Record<string, unknown> | undefined;
    if (!row) {
      return null;
    }
    return this.mapRowToEntity(row);
  }

  protected override mapRowToEntity(row: Record<string, unknown>): SectionReviewSummary {
    const normalized: Record<string, unknown> = { ...row };

    if (normalized.decided_at === undefined) {
      normalized.decided_at = null;
    }

    return super.mapRowToEntity(normalized);
  }
}
