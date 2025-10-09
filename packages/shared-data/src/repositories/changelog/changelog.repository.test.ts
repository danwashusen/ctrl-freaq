import Database from 'better-sqlite3';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { CoAuthoringChangelogRepository } from './changelog.repository';

function createDatabase(): Database.Database {
  const db = new Database(':memory:');
  db.pragma('journal_mode = WAL');
  db.exec(
    `CREATE TABLE section_changelog_entries (
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
    );`
  );
  return db;
}

describe('CoAuthoringChangelogRepository', () => {
  let db: Database.Database;
  let repository: CoAuthoringChangelogRepository;

  const baseApproval = {
    entryId: 'entry-coauthor-001',
    documentId: 'doc-architecture-demo',
    sectionId: 'architecture-overview',
    approvedBy: 'user_staff_eng',
    approvedAt: new Date('2025-10-06T12:00:00.000Z'),
    diffHash: 'sha256:proposal-digest',
    proposal: {
      proposalId: 'proposal-xyz',
      promptSummary: 'Improve architecture overview for accessibility',
      citations: ['decision:telemetry', 'knowledge:wcag'],
      confidence: 0.87,
      transcript: 'Assistant explained rationale with transcript text that must be dropped.',
    },
  } as const;

  beforeEach(() => {
    db = createDatabase();
    repository = new CoAuthoringChangelogRepository(db);
  });

  afterEach(() => {
    db.close();
  });

  it('persists AI proposal metadata without storing transcript text', async () => {
    await repository.recordProposalApproval(baseApproval);

    const row = db.prepare('SELECT * FROM section_changelog_entries').get();
    expect(row).toMatchObject({
      entry_id: baseApproval.entryId,
      document_id: baseApproval.documentId,
      section_id: baseApproval.sectionId,
      proposal_id: baseApproval.proposal.proposalId,
      prompt_summary: baseApproval.proposal.promptSummary,
      confidence: baseApproval.proposal.confidence,
      diff_hash: baseApproval.diffHash,
      approved_by: baseApproval.approvedBy,
    });
    expect(JSON.parse(row.citations)).toEqual(baseApproval.proposal.citations);
    expect(Object.keys(row)).not.toContain('transcript');
  });

  it('lists approvals in reverse chronological order with sanitized fields', async () => {
    await repository.recordProposalApproval(baseApproval);
    await repository.recordProposalApproval({
      ...baseApproval,
      entryId: 'entry-coauthor-002',
      approvedAt: new Date('2025-10-06T12:05:00.000Z'),
      proposal: {
        proposalId: 'proposal-newer',
        promptSummary: 'Refine architecture rationale',
        citations: ['decision:scope'],
        confidence: 0.93,
        transcript: 'Still should not persist',
      },
      diffHash: 'sha256:new-digest',
    });

    const entries = await repository.listBySection({
      documentId: baseApproval.documentId,
      sectionId: baseApproval.sectionId,
    });

    expect(entries.map(entry => entry.proposalId)).toEqual(['proposal-newer', 'proposal-xyz']);
    expect(entries[0]).toMatchObject({
      promptSummary: 'Refine architecture rationale',
      confidence: 0.93,
      citations: ['decision:scope'],
    });
    expect(entries.every(entry => !('transcript' in entry))).toBe(true);
  });
});
