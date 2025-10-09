import type Database from 'better-sqlite3';

export interface RecordProposalApprovalInput {
  entryId: string;
  documentId: string;
  sectionId: string;
  approvedBy: string;
  approvedAt: Date;
  diffHash: string;
  proposal: {
    proposalId: string;
    promptSummary: string;
    citations: string[];
    confidence: number;
    transcript?: string;
  };
}

export interface SectionChangelogEntry {
  entryId: string;
  documentId: string;
  sectionId: string;
  proposalId: string;
  promptSummary: string;
  citations: string[];
  confidence: number;
  diffHash: string;
  approvedBy: string;
  approvedAt: Date;
}

export interface ListChangelogOptions {
  documentId: string;
  sectionId: string;
}

const parseCitations = (value: unknown): string[] => {
  if (typeof value !== 'string') {
    return [];
  }

  try {
    const parsed = JSON.parse(value) as unknown;
    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed.filter(item => typeof item === 'string') as string[];
  } catch (error) {
    throw new Error(
      `Failed to parse changelog citations JSON: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
};

export class CoAuthoringChangelogRepository {
  constructor(private readonly database: Database.Database) {
    this.ensureTable();
  }

  private ensureTable(): void {
    this.database.exec(`
      CREATE TABLE IF NOT EXISTS section_changelog_entries (
        entry_id TEXT PRIMARY KEY,
        document_id TEXT NOT NULL,
        section_id TEXT NOT NULL,
        proposal_id TEXT NOT NULL,
        prompt_summary TEXT NOT NULL,
        citations TEXT NOT NULL,
        confidence REAL NOT NULL,
        diff_hash TEXT NOT NULL,
        approved_by TEXT NOT NULL,
        approved_at TEXT NOT NULL,
        created_at TEXT NOT NULL
      )
    `);
  }

  async recordProposalApproval(input: RecordProposalApprovalInput): Promise<void> {
    const insert = this.database.prepare(`
      INSERT INTO section_changelog_entries (
        entry_id,
        document_id,
        section_id,
        proposal_id,
        prompt_summary,
        citations,
        confidence,
        diff_hash,
        approved_by,
        approved_at,
        created_at
      ) VALUES (@entryId, @documentId, @sectionId, @proposalId, @promptSummary, @citations, @confidence, @diffHash, @approvedBy, @approvedAt, @createdAt)
    `);

    insert.run({
      entryId: input.entryId,
      documentId: input.documentId,
      sectionId: input.sectionId,
      proposalId: input.proposal.proposalId,
      promptSummary: input.proposal.promptSummary,
      citations: JSON.stringify(input.proposal.citations ?? []),
      confidence: input.proposal.confidence,
      diffHash: input.diffHash,
      approvedBy: input.approvedBy,
      approvedAt: input.approvedAt.toISOString(),
      createdAt: new Date().toISOString(),
    });
  }

  async listBySection(options: ListChangelogOptions): Promise<SectionChangelogEntry[]> {
    const query = this.database.prepare(`
      SELECT
        entry_id,
        document_id,
        section_id,
        proposal_id,
        prompt_summary,
        citations,
        confidence,
        diff_hash,
        approved_by,
        approved_at
      FROM section_changelog_entries
      WHERE document_id = @documentId AND section_id = @sectionId
      ORDER BY approved_at DESC
    `);

    const rows = query.all({
      documentId: options.documentId,
      sectionId: options.sectionId,
    }) as Array<{
      entry_id: string;
      document_id: string;
      section_id: string;
      proposal_id: string;
      prompt_summary: string;
      citations: string;
      confidence: number;
      diff_hash: string;
      approved_by: string;
      approved_at: string;
    }>;

    return rows.map(row => ({
      entryId: row.entry_id,
      documentId: row.document_id,
      sectionId: row.section_id,
      proposalId: row.proposal_id,
      promptSummary: row.prompt_summary,
      citations: parseCitations(row.citations),
      confidence: Number(row.confidence),
      diffHash: row.diff_hash,
      approvedBy: row.approved_by,
      approvedAt: new Date(row.approved_at),
    }));
  }
}
