import { readFileSync } from 'fs';
import { join } from 'path';

import Database from 'better-sqlite3';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { AssumptionSessionRepository } from './assumption-session.repository';

const USER_ID = 'user-author';
const SECTION_ID = 'section-new-content';
const DOCUMENT_ID = 'document-new-content';

function bootstrapDatabase(): Database.Database {
  const db = new Database(':memory:');
  db.pragma('journal_mode = WAL');
  db.exec(
    `CREATE TABLE users (id TEXT PRIMARY KEY);
     CREATE TABLE documents (id TEXT PRIMARY KEY);
     CREATE TABLE section_records (
       id TEXT PRIMARY KEY,
       document_id TEXT NOT NULL,
       template_key TEXT NOT NULL,
       order_index INTEGER NOT NULL DEFAULT 0,
       created_at TEXT NOT NULL,
       created_by TEXT NOT NULL,
       updated_at TEXT NOT NULL,
       updated_by TEXT NOT NULL
     );`
  );

  db.prepare('INSERT INTO users(id) VALUES (?)').run(USER_ID);
  db.prepare('INSERT INTO documents(id) VALUES (?)').run(DOCUMENT_ID);
  db.prepare(
    `INSERT INTO section_records (id, document_id, template_key, order_index, created_at, created_by, updated_at, updated_by)
       VALUES (?, ?, 'section.template', 1, ?, ?, ?, ?)`
  ).run(
    SECTION_ID,
    DOCUMENT_ID,
    new Date().toISOString(),
    USER_ID,
    new Date().toISOString(),
    USER_ID
  );

  const migrationPath = join(process.cwd(), 'migrations/012_assumption_sessions.sql');
  const migrationSql = readFileSync(migrationPath, 'utf-8');
  db.exec(migrationSql);

  return db;
}

describe('AssumptionSessionRepository', () => {
  let db: Database.Database;
  let repository: AssumptionSessionRepository;

  beforeEach(() => {
    db = bootstrapDatabase();
    repository = new AssumptionSessionRepository(db);
  });

  afterEach(() => {
    if (db) {
      db.close();
    }
  });

  it('creates sessions with prompts and maintains ordering', async () => {
    const { session, prompts } = await repository.createSessionWithPrompts({
      sectionId: SECTION_ID,
      documentId: DOCUMENT_ID,
      templateVersion: '1.0.0',
      startedBy: USER_ID,
      startedAt: new Date('2025-09-29T05:00:00.000Z'),
      createdBy: USER_ID,
      updatedBy: USER_ID,
      prompts: [
        {
          id: 'assume-latency',
          templateKey: 'latency-baseline',
          promptHeading: 'Latency commitment',
          promptBody: 'Confirm end-to-end latency targets.',
          responseType: 'single_select',
          options: [{ id: 'opt-1', label: '<150ms', description: null, defaultSelected: true }],
          priority: 2,
          status: 'pending',
          answerValue: null,
          answerNotes: null,
          overrideJustification: null,
          conflictDecisionId: null,
          conflictResolvedAt: null,
        },
        {
          id: 'assume-compliance',
          templateKey: 'compliance-review',
          promptHeading: 'Compliance sign-off',
          promptBody: 'Confirm SOC2 controls applied.',
          responseType: 'text',
          options: [],
          priority: 1,
          status: 'pending',
          answerValue: null,
          answerNotes: null,
          overrideJustification: null,
          conflictDecisionId: null,
          conflictResolvedAt: null,
        },
      ],
    });

    expect(session.sectionId).toBe(SECTION_ID);
    expect(prompts.map(prompt => prompt.id)).toEqual(['assume-compliance', 'assume-latency']);
  });

  it('updates prompt state and recalculates session counters', async () => {
    await repository.createSessionWithPrompts({
      sectionId: SECTION_ID,
      documentId: DOCUMENT_ID,
      templateVersion: '1.0.0',
      startedBy: USER_ID,
      startedAt: new Date('2025-09-29T05:00:00.000Z'),
      createdBy: USER_ID,
      updatedBy: USER_ID,
      prompts: [
        {
          id: 'assume-overrides',
          templateKey: 'override-check',
          promptHeading: 'Override justification',
          promptBody: 'Explain override.',
          responseType: 'text',
          options: [],
          priority: 0,
          status: 'pending',
          answerValue: null,
          answerNotes: null,
          overrideJustification: null,
          conflictDecisionId: null,
          conflictResolvedAt: null,
        },
      ],
    });

    const updateResult = await repository.updatePrompt('assume-overrides', {
      status: 'override_skipped',
      overrideJustification: 'Need to unblock drafting',
      updatedBy: USER_ID,
    });

    expect(updateResult.prompt.status).toBe('override_skipped');
    expect(updateResult.session.unresolvedOverrideCount).toBe(1);
    expect(updateResult.session.status).toBe('blocked');
  });

  it('creates draft proposals and returns chronological history', async () => {
    const { session } = await repository.createSessionWithPrompts({
      sectionId: SECTION_ID,
      documentId: DOCUMENT_ID,
      templateVersion: '1.0.0',
      startedBy: USER_ID,
      startedAt: new Date('2025-09-29T05:00:00.000Z'),
      createdBy: USER_ID,
      updatedBy: USER_ID,
      prompts: [
        {
          id: 'assume-history',
          templateKey: 'history',
          promptHeading: 'History',
          promptBody: 'Record history prompt',
          responseType: 'text',
          options: [],
          priority: 0,
          status: 'answered',
          answerValue: 'Documented',
          answerNotes: null,
          overrideJustification: null,
          conflictDecisionId: null,
          conflictResolvedAt: null,
        },
      ],
    });

    await repository.createProposal({
      sessionId: session.id,
      sectionId: SECTION_ID,
      source: 'ai_generated',
      contentMarkdown: '# Draft V1',
      rationale: [{ assumptionId: 'assume-history', summary: 'Initial content' }],
      createdBy: USER_ID,
      updatedBy: USER_ID,
    });

    const { proposal } = await repository.createProposal({
      sessionId: session.id,
      sectionId: SECTION_ID,
      source: 'manual_revision',
      contentMarkdown: '# Draft V2',
      rationale: [{ assumptionId: 'assume-history', summary: 'Manual refinement' }],
      createdBy: USER_ID,
      updatedBy: USER_ID,
    });

    const proposals = await repository.listProposals(session.id);
    expect(proposals).toHaveLength(2);
    expect(proposals.at(-1)?.proposalIndex).toBe(1);
    expect(proposal.contentMarkdown).toBe('# Draft V2');
  });
});
