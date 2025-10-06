import { randomUUID } from 'crypto';

import Database from 'better-sqlite3';

import { BaseRepository } from './base-repository.js';
import {
  SectionDraftSchema,
  type CreateSectionDraftInput,
  type SectionDraft,
  type UpdateSectionDraftInput,
} from '../models/section-draft.js';
import type { QueryOptions } from '../types/index.js';
import type { FormattingAnnotation } from '../models/formatting-annotation.js';

interface DraftAnnotationInput {
  startOffset: number;
  endOffset: number;
  markType: string;
  message: string;
  severity: 'warning' | 'error';
}

interface CreateDraftOptions {
  actorId: string;
  savedAt?: Date;
  savedBy?: string;
  formattingAnnotations?: DraftAnnotationInput[];
}

interface UpdateDraftOptions {
  actorId: string;
  savedAt?: Date;
  savedBy?: string;
  formattingAnnotations?: DraftAnnotationInput[];
}

const SOFT_DELETE_CONDITION = "(deleted_at IS NULL OR deleted_at = '')";

export class SectionDraftRepositoryImpl extends BaseRepository<SectionDraft> {
  constructor(db: Database.Database) {
    super(db, 'section_drafts', SectionDraftSchema);
  }

  async createDraft(
    input: CreateSectionDraftInput,
    options: CreateDraftOptions
  ): Promise<SectionDraft> {
    return this.createDraftInternal(input, options);
  }

  async createDraftWithId(
    id: string,
    input: CreateSectionDraftInput,
    options: CreateDraftOptions
  ): Promise<SectionDraft> {
    return this.createDraftInternal(input, options, id);
  }

  private async createDraftInternal(
    input: CreateSectionDraftInput,
    options: CreateDraftOptions,
    draftId?: string
  ): Promise<SectionDraft> {
    const now = new Date();
    const savedAt = options.savedAt ?? now;
    const actorId = options.actorId;
    const savedBy = options.savedBy ?? actorId;

    const { summaryNote, ...rest } = input;

    const payload: Omit<SectionDraft, 'id' | 'createdAt' | 'updatedAt'> = {
      ...rest,
      summaryNote: summaryNote ?? '',
      conflictState: 'clean',
      conflictReason: null,
      rebasedAt: null,
      savedAt,
      savedBy,
      createdBy: actorId,
      updatedBy: actorId,
      formattingAnnotations: [],
      deletedAt: null,
      deletedBy: null,
    };

    if (draftId) {
      const savedAtIso = payload.savedAt.toISOString();
      const createdAtIso = now.toISOString();
      const updatedAtIso = createdAtIso;
      const rebasedAtIso = payload.rebasedAt ? payload.rebasedAt.toISOString() : null;
      const stmt = this.db.prepare(
        `INSERT INTO ${this.tableName} (
           id,
           section_id,
           document_id,
           user_id,
           draft_version,
           draft_base_version,
           content_markdown,
           summary_note,
           conflict_state,
           conflict_reason,
           rebased_at,
           saved_at,
           saved_by,
           created_at,
           created_by,
           updated_at,
           updated_by,
           deleted_at,
           deleted_by
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      );
      stmt.run(
        draftId,
        payload.sectionId,
        payload.documentId,
        payload.userId,
        payload.draftVersion,
        payload.draftBaseVersion,
        payload.contentMarkdown,
        payload.summaryNote,
        payload.conflictState,
        payload.conflictReason,
        rebasedAtIso,
        savedAtIso,
        payload.savedBy,
        createdAtIso,
        actorId,
        updatedAtIso,
        actorId,
        null,
        null
      );

      if (options.formattingAnnotations?.length) {
        await this.replaceFormattingAnnotations(draftId, options.formattingAnnotations, actorId);
      }

      const inserted = await this.findById(draftId);
      if (!inserted) {
        throw new Error('Draft unexpectedly missing after creation');
      }
      return inserted;
    }

    const draft = await super.create(payload);
    if (options.formattingAnnotations?.length) {
      await this.replaceFormattingAnnotations(draft.id, options.formattingAnnotations, actorId);
    }

    const hydrated = await this.findById(draft.id);
    if (!hydrated) {
      throw new Error('Draft unexpectedly missing after creation');
    }
    return hydrated;
  }

  async updateDraft(
    id: string,
    updates: Partial<UpdateSectionDraftInput>,
    options: UpdateDraftOptions
  ): Promise<SectionDraft> {
    const actorId = options.actorId;
    const updatePayload: Partial<SectionDraft> = {
      ...updates,
      savedAt: options.savedAt ?? updates.savedAt,
      savedBy: options.savedBy ?? updates.savedBy,
      updatedBy: updates.updatedBy ?? actorId,
    };

    if ('summaryNote' in updates && updates.summaryNote === undefined) {
      updatePayload.summaryNote = '';
    }

    // Remove formattingAnnotations before delegating to BaseRepository (stored separately)
    const { formattingAnnotations, ...persistable } = updatePayload as Partial<SectionDraft> & {
      formattingAnnotations?: DraftAnnotationInput[];
    };

    await super.update(id, persistable);

    const annotationUpdates: DraftAnnotationInput[] =
      options.formattingAnnotations ?? formattingAnnotations ?? [];
    if (annotationUpdates.length) {
      await this.replaceFormattingAnnotations(id, annotationUpdates, actorId);
    }

    const hydrated = await this.findById(id);
    if (!hydrated) {
      throw new Error('Draft not found after update');
    }
    return hydrated;
  }

  override async findById(id: string): Promise<SectionDraft | null> {
    const draft = await super.findById(id);
    if (!draft) {
      return null;
    }

    const hydrated = await this.hydrateFormattingAnnotations([draft]);
    return hydrated[0] ?? draft;
  }

  override async findAll(options: QueryOptions = {}): Promise<SectionDraft[]> {
    const drafts = await super.findAll(options);
    if (!drafts.length) {
      return drafts;
    }

    return this.hydrateFormattingAnnotations(drafts);
  }

  async listBySection(sectionId: string, options: QueryOptions = {}): Promise<SectionDraft[]> {
    let query = `SELECT * FROM ${this.tableName} WHERE section_id = ? AND ${SOFT_DELETE_CONDITION}`;
    const params: unknown[] = [sectionId];

    if (options.orderBy) {
      query += ` ORDER BY ${options.orderBy} ${options.orderDirection || 'ASC'}`;
    } else {
      query += ' ORDER BY saved_at DESC';
    }

    if (typeof options.limit === 'number') {
      query += ' LIMIT ?';
      params.push(options.limit);
    }

    if (typeof options.offset === 'number') {
      query += ' OFFSET ?';
      params.push(options.offset);
    }

    const stmt = this.db.prepare(query);
    const rows = stmt.all(...params) as Record<string, unknown>[];
    const drafts = rows.map(row => this.mapRowToEntity(row));

    if (!drafts.length) {
      return drafts;
    }

    return this.hydrateFormattingAnnotations(drafts);
  }

  async replaceFormattingAnnotations(
    draftId: string,
    annotations: DraftAnnotationInput[],
    actorId: string
  ): Promise<void> {
    const draft = await super.findById(draftId);
    if (!draft) {
      throw new Error(`Draft ${draftId} not found`);
    }

    const sectionId = draft.sectionId;
    const timestamp = new Date().toISOString();

    const deleteStmt = this.db.prepare(
      `UPDATE formatting_annotations
         SET deleted_at = ?, deleted_by = ?, updated_at = ?, updated_by = ?
       WHERE draft_id = ? AND ${SOFT_DELETE_CONDITION}`
    );
    deleteStmt.run(timestamp, actorId, timestamp, actorId, draftId);

    if (!annotations.length) {
      return;
    }

    const insertStmt = this.db.prepare(
      `INSERT INTO formatting_annotations (
        id,
        section_id,
        draft_id,
        start_offset,
        end_offset,
        mark_type,
        message,
        severity,
        created_at,
        created_by,
        updated_at,
        updated_by,
        deleted_at,
        deleted_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, NULL)`
    );

    for (const annotation of annotations) {
      insertStmt.run(
        randomUUID(),
        sectionId,
        draftId,
        annotation.startOffset,
        annotation.endOffset,
        annotation.markType,
        annotation.message,
        annotation.severity,
        timestamp,
        actorId,
        timestamp,
        actorId
      );
    }
  }

  private async hydrateFormattingAnnotations(drafts: SectionDraft[]): Promise<SectionDraft[]> {
    for (const draft of drafts) {
      const stmt = this.db.prepare(
        `SELECT * FROM formatting_annotations
         WHERE draft_id = ? AND ${SOFT_DELETE_CONDITION}
         ORDER BY start_offset ASC`
      );
      const rows = stmt.all(draft.id) as Array<Record<string, unknown>>;

      draft.formattingAnnotations = rows.map(
        row =>
          ({
            id: String(row.id),
            sectionId: String(row.section_id),
            draftId: String(row.draft_id),
            startOffset: Number(row.start_offset),
            endOffset: Number(row.end_offset),
            markType: String(row.mark_type),
            message: String(row.message),
            severity: row.severity as FormattingAnnotation['severity'],
            createdAt: new Date(String(row.created_at)),
            createdBy: String(row.created_by),
            updatedAt: new Date(String(row.updated_at)),
            updatedBy: String(row.updated_by),
            deletedAt: row.deleted_at ? new Date(String(row.deleted_at)) : null,
            deletedBy: row.deleted_by ? String(row.deleted_by) : null,
          }) satisfies FormattingAnnotation
      );
    }

    return drafts;
  }

  protected override mapEntityToRow(entity: SectionDraft): Record<string, unknown> {
    const row = super.mapEntityToRow(entity);
    delete row.formatting_annotations;
    return row;
  }

  protected override mapRowToEntity(row: Record<string, unknown>): SectionDraft {
    const normalized: Record<string, unknown> = { ...row };

    if (!Array.isArray(normalized.formatting_annotations)) {
      normalized.formatting_annotations = [];
    }
    if (normalized.summary_note == null) {
      normalized.summary_note = '';
    }
    if (normalized.conflict_reason === undefined) {
      normalized.conflict_reason = null;
    }
    if (normalized.rebased_at === undefined) {
      normalized.rebased_at = null;
    }

    return super.mapRowToEntity(normalized);
  }
}
