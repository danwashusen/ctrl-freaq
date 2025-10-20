import { randomUUID } from 'node:crypto';

import type Database from 'better-sqlite3';
import type { Logger } from 'pino';

import { SectionDraftRepositoryImpl } from '@ctrl-freaq/shared-data';

export interface QueueProposalInput {
  documentId: string;
  sectionId: string;
  authorId: string;
  proposalId: string;
  diffHash: string;
  draftPatch: string;
  updatedDraft: string;
  promptSummary: string;
}

export interface QueueProposalResult {
  draftVersion: number;
  draftId: string;
  requestId: string;
  previousDraftVersion: number | null;
}

export interface DraftPersistenceAdapter {
  queueProposal(input: QueueProposalInput): Promise<QueueProposalResult>;
  getLatestDraftSnapshot(
    documentId: string,
    sectionId: string
  ): Promise<{
    draftId: string;
    draftVersion: number;
    content: string;
  } | null>;
  getSectionApprovedVersion(documentId: string, sectionId: string): Promise<number | null>;
}

export class CoAuthoringDraftPersistenceAdapter implements DraftPersistenceAdapter {
  constructor(
    private readonly drafts: SectionDraftRepositoryImpl,
    private readonly logger: Logger,
    private readonly now: () => Date = () => new Date()
  ) {}

  private get database(): Database.Database {
    return (this.drafts as unknown as { db: Database.Database }).db;
  }

  async queueProposal(input: QueueProposalInput): Promise<QueueProposalResult> {
    const now = this.now();
    const summary = input.promptSummary.slice(0, 280);

    const latest = this.database
      .prepare(
        `SELECT id, draft_version, draft_base_version, content_markdown
           FROM section_drafts
          WHERE section_id = ? AND document_id = ?
          ORDER BY draft_version DESC
          LIMIT 1`
      )
      .get(input.sectionId, input.documentId) as
      | {
          id: string;
          draft_version: number;
          draft_base_version: number;
          content_markdown: string;
        }
      | undefined;

    if (latest) {
      const nextVersion = Number(latest.draft_version) + 1;

      await this.drafts.updateDraft(
        latest.id,
        {
          contentMarkdown: input.updatedDraft,
          draftVersion: nextVersion,
          draftBaseVersion: Number(latest.draft_version),
          summaryNote: summary,
        },
        {
          actorId: input.authorId,
          savedAt: now,
          savedBy: input.authorId,
        }
      );

      this.logger.info(
        {
          documentId: input.documentId,
          sectionId: input.sectionId,
          proposalId: input.proposalId,
          draftVersion: nextVersion,
        },
        'Co-authoring proposal persisted to draft store'
      );

      return {
        draftVersion: nextVersion,
        draftId: latest.id,
        requestId: randomUUID(),
        previousDraftVersion: Number(latest.draft_version),
      };
    }

    const created = await this.drafts.createDraft(
      {
        documentId: input.documentId,
        sectionId: input.sectionId,
        userId: input.authorId,
        contentMarkdown: input.updatedDraft,
        draftVersion: 1,
        draftBaseVersion: 0,
        summaryNote: summary,
      },
      {
        actorId: input.authorId,
        savedAt: now,
        savedBy: input.authorId,
      }
    );

    this.logger.info(
      {
        documentId: input.documentId,
        sectionId: input.sectionId,
        proposalId: input.proposalId,
        draftVersion: created.draftVersion,
      },
      'Co-authoring proposal persisted as initial draft version'
    );

    return {
      draftVersion: created.draftVersion,
      draftId: created.id,
      requestId: randomUUID(),
      previousDraftVersion: null,
    };
  }

  async getLatestDraftSnapshot(
    documentId: string,
    sectionId: string
  ): Promise<{
    draftId: string;
    draftVersion: number;
    content: string;
  } | null> {
    const stmt = this.database.prepare(
      `SELECT id, draft_version, content_markdown
         FROM section_drafts
        WHERE section_id = ? AND document_id = ?
        ORDER BY draft_version DESC
        LIMIT 1`
    );
    const row = stmt.get(sectionId, documentId) as
      | { id: string; draft_version: number; content_markdown: string }
      | undefined;

    if (!row) {
      return null;
    }

    return {
      draftId: row.id,
      draftVersion: Number(row.draft_version),
      content: String(row.content_markdown),
    };
  }

  async getSectionApprovedVersion(documentId: string, sectionId: string): Promise<number | null> {
    const stmt = this.database.prepare(
      `SELECT approved_version
         FROM section_records
        WHERE id = ? AND document_id = ?
        LIMIT 1`
    );
    const row = stmt.get(sectionId, documentId) as { approved_version: number } | undefined;
    if (!row) {
      return null;
    }
    return Number(row.approved_version);
  }
}
