import Database from 'better-sqlite3';

import { BaseRepository } from '../base-repository.js';
import {
  CreateDocumentQualityGateSummarySchema,
  DocumentQualityGateSummarySchema,
  type CreateDocumentQualityGateSummaryInput,
  type DocumentQualityGateSummary,
} from '../../models/quality-gates/document-quality-gate-summary.js';

const TABLE_NAME = 'document_quality_gate_summaries';

export class DocumentQualityGateSummaryRepository extends BaseRepository<DocumentQualityGateSummary> {
  constructor(db: Database.Database) {
    super(db, TABLE_NAME, DocumentQualityGateSummarySchema);
  }

  protected override mapEntityToRow(entity: DocumentQualityGateSummary): Record<string, unknown> {
    const row = super.mapEntityToRow(entity);
    row.status_counts = JSON.stringify(entity.statusCounts);
    row.blocker_sections = JSON.stringify(entity.blockerSections);
    row.warning_sections = JSON.stringify(entity.warningSections);
    row.coverage_gaps = JSON.stringify(entity.coverageGaps);
    row.publish_blocked = entity.publishBlocked ? 1 : 0;
    return row;
  }

  protected override mapRowToEntity(row: Record<string, unknown>): DocumentQualityGateSummary {
    const normalized = { ...row };
    try {
      normalized.status_counts =
        typeof normalized.status_counts === 'string'
          ? JSON.parse(normalized.status_counts)
          : normalized.status_counts;
      normalized.blocker_sections =
        typeof normalized.blocker_sections === 'string'
          ? JSON.parse(normalized.blocker_sections)
          : normalized.blocker_sections;
      normalized.warning_sections =
        typeof normalized.warning_sections === 'string'
          ? JSON.parse(normalized.warning_sections)
          : normalized.warning_sections;
      normalized.coverage_gaps =
        typeof normalized.coverage_gaps === 'string'
          ? JSON.parse(normalized.coverage_gaps)
          : normalized.coverage_gaps;
      if (typeof normalized.publish_blocked === 'number') {
        normalized.publish_blocked = normalized.publish_blocked > 0;
      }
    } catch (error) {
      throw new Error(`Failed to parse document quality gate summary JSON: ${error}`);
    }

    return super.mapRowToEntity(normalized) as DocumentQualityGateSummary;
  }

  async findByDocumentId(documentId: string): Promise<DocumentQualityGateSummary | null> {
    const stmt = this.db.prepare(`SELECT * FROM ${TABLE_NAME} WHERE document_id = ?`);
    const row = stmt.get(documentId) as Record<string, unknown> | undefined;
    if (!row) {
      return null;
    }
    return this.mapRowToEntity(row);
  }

  async upsertSummary(
    payload: CreateDocumentQualityGateSummaryInput
  ): Promise<DocumentQualityGateSummary> {
    const sanitized = CreateDocumentQualityGateSummarySchema.parse(payload);
    const existing = await this.findByDocumentId(sanitized.documentId);
    if (existing) {
      return this.update(existing.id, sanitized);
    }
    return this.create(sanitized);
  }
}
