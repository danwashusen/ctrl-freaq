import Database from 'better-sqlite3';

import { BaseRepository } from '../base-repository.js';
import {
  CreateSectionQualityGateResultSchema,
  SectionQualityGateResultSchema,
  type CreateSectionQualityGateResultInput,
  type SectionQualityGateResult,
} from '../../models/quality-gates/section-quality-gate-result.js';

const TABLE_NAME = 'section_quality_gate_results';

export class SectionQualityGateResultRepository extends BaseRepository<SectionQualityGateResult> {
  constructor(db: Database.Database) {
    super(db, TABLE_NAME, SectionQualityGateResultSchema);
  }

  protected override mapEntityToRow(entity: SectionQualityGateResult): Record<string, unknown> {
    const row = super.mapEntityToRow(entity);
    row.rules = JSON.stringify(entity.rules ?? []);
    return row;
  }

  protected override mapRowToEntity(row: Record<string, unknown>): SectionQualityGateResult {
    const normalized = { ...row };
    if (typeof normalized.rules === 'string') {
      try {
        normalized.rules = JSON.parse(normalized.rules as string);
      } catch (error) {
        throw new Error(`Failed to parse quality gate rules JSON: ${error}`);
      }
    }
    return super.mapRowToEntity(normalized) as SectionQualityGateResult;
  }

  async findBySectionId(sectionId: string): Promise<SectionQualityGateResult | null> {
    const stmt = this.db.prepare(`SELECT * FROM ${TABLE_NAME} WHERE section_id = ?`);
    const row = stmt.get(sectionId) as Record<string, unknown> | undefined;
    if (!row) {
      return null;
    }
    return this.mapRowToEntity(row);
  }

  async listByDocumentId(documentId: string): Promise<SectionQualityGateResult[]> {
    const stmt = this.db.prepare(`SELECT * FROM ${TABLE_NAME} WHERE document_id = ?`);
    const rows = stmt.all(documentId) as Record<string, unknown>[];
    return rows.map(row => this.mapRowToEntity(row));
  }

  async upsertResult(
    payload: CreateSectionQualityGateResultInput
  ): Promise<SectionQualityGateResult> {
    const sanitized = CreateSectionQualityGateResultSchema.parse(payload);
    const existing = await this.findBySectionId(sanitized.sectionId);
    if (existing) {
      return this.update(existing.id, sanitized);
    }
    return this.create(sanitized);
  }
}
