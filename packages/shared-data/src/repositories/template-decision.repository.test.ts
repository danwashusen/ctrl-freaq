import Database from 'better-sqlite3';
import { beforeEach, describe, expect, it } from 'vitest';

import { TemplateValidationDecisionRepository } from './template-decision.repository.js';

describe('TemplateValidationDecisionRepository', () => {
  let db: Database.Database;
  let repo: TemplateValidationDecisionRepository;

  beforeEach(() => {
    db = new Database(':memory:');
    db.pragma('journal_mode = WAL');
    repo = new TemplateValidationDecisionRepository(db);
  });

  it('records template validation decisions with payload metadata', async () => {
    const decision = await repo.recordDecision({
      projectId: '11111111-1111-4111-8111-111111111111',
      documentId: '22222222-2222-4222-8222-222222222222',
      templateId: 'architecture-reference',
      currentVersion: '1.0.0',
      requestedVersion: '1.1.0',
      action: 'approved',
      notes: 'Reviewed and approved.',
      submittedBy: 'user-maintainer',
      submittedAt: new Date('2025-05-01T10:15:00.000Z'),
      payload: {
        introduction: 'Updated executive summary',
      },
    });

    expect(decision.id).toMatch(/[0-9a-f-]{36}/i);
    expect(decision.projectId).toBe('11111111-1111-4111-8111-111111111111');
    expect(decision.documentId).toBe('22222222-2222-4222-8222-222222222222');
    expect(decision.templateId).toBe('architecture-reference');
    expect(decision.currentVersion).toBe('1.0.0');
    expect(decision.requestedVersion).toBe('1.1.0');
    expect(decision.action).toBe('approved');
    expect(decision.notes).toBe('Reviewed and approved.');
    expect(decision.submittedBy).toBe('user-maintainer');
    expect(decision.submittedAt.toISOString()).toBe('2025-05-01T10:15:00.000Z');
    expect(decision.payload).toMatchObject({
      introduction: 'Updated executive summary',
    });
  });

  it('returns the latest decision by project ordered by submission time', async () => {
    const projectId = '33333333-3333-4333-8333-333333333333';
    const early = await repo.recordDecision({
      projectId,
      documentId: '44444444-4444-4444-8444-444444444444',
      templateId: 'architecture-reference',
      currentVersion: '1.0.0',
      requestedVersion: '1.2.0',
      action: 'pending',
      submittedBy: 'user-maintainer',
      submittedAt: new Date('2025-05-01T08:00:00.000Z'),
      payload: {},
    });

    const latest = await repo.recordDecision({
      projectId,
      documentId: '55555555-5555-4555-8555-555555555555',
      templateId: 'architecture-reference',
      currentVersion: '1.2.0',
      requestedVersion: '1.3.0',
      action: 'approved',
      submittedBy: 'user-maintainer',
      submittedAt: new Date('2025-05-02T12:30:00.000Z'),
      payload: {},
    });

    const retrieved = await repo.findLatestByProject(projectId);
    expect(retrieved?.id).toBe(latest.id);
    expect(retrieved?.submittedAt.toISOString()).toBe(latest.submittedAt.toISOString());

    const otherProject = await repo.findLatestByProject('99999999-9999-4999-8999-999999999999');
    expect(otherProject).toBeNull();

    // ensure the earlier record remains accessible by document lookup
    const byDocument = await repo.findLatestByDocument(early.documentId);
    expect(byDocument?.id).toBe(early.id);
  });
});
