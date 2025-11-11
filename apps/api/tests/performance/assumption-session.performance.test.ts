import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import Database from 'better-sqlite3';
import type { Logger } from 'pino';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Mock } from 'vitest';

import {
  AssumptionSessionRepository,
  type Document,
  type DocumentRepositoryImpl,
} from '@ctrl-freaq/shared-data';
import type { TemplateResolver } from '@ctrl-freaq/template-resolver';

import {
  AssumptionSessionService,
  type AssumptionPromptTemplate,
} from '../../src/modules/section-editor/services/assumption-session.service';

const fixedNow = new Date('2025-09-30T12:00:00.000Z');

const promptTemplates: AssumptionPromptTemplate[] = [
  {
    id: 'assume-security',
    templateKey: 'assumptions.priority.security',
    heading: 'Confirm security baseline',
    body: 'Does this change impact baseline security controls?',
    responseType: 'single_select',
    options: [
      { id: 'secure', label: 'No impact', description: null, defaultSelected: true },
      { id: 'review', label: 'Requires review', description: null, defaultSelected: false },
    ],
    priority: 0,
  },
  {
    id: 'assume-dependencies',
    templateKey: 'assumptions.priority.dependencies',
    heading: 'List new dependencies',
    body: 'Call out any new services introduced in this section.',
    responseType: 'text',
    options: [],
    priority: 1,
  },
];

const bootstrapDatabase = () => {
  const database = new Database(':memory:');
  database.pragma('journal_mode = WAL');
  database.exec(
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

  const timestamp = fixedNow.toISOString();
  database.prepare('INSERT INTO users(id) VALUES (?)').run('user-observability');
  database.prepare('INSERT INTO documents(id) VALUES (?)').run('doc-assumptions');
  database
    .prepare(
      `INSERT INTO section_records (id, document_id, template_key, order_index, created_at, created_by, updated_at, updated_by)
         VALUES (?, ?, 'section.template', 0, ?, ?, ?, ?)`
    )
    .run(
      'sec-observability',
      'doc-assumptions',
      timestamp,
      'user-observability',
      timestamp,
      'user-observability'
    );

  const __dirname = fileURLToPath(new URL('.', import.meta.url));
  const migrationPath = join(
    __dirname,
    '../../../../packages/shared-data/migrations/012_assumption_sessions.sql'
  );
  const migrationSql = readFileSync(migrationPath, 'utf-8');
  database.exec(migrationSql);

  return database;
};

describe('AssumptionSessionService observability performance', () => {
  let db: Database.Database;
  let repository: AssumptionSessionRepository;
  let service: AssumptionSessionService;
  let documentRepository: DocumentRepositoryImpl;
  let templateResolver: TemplateResolver;
  const infoSpy = vi.fn();
  const logger = {
    info: infoSpy,
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  } as unknown as Logger;

  beforeEach(() => {
    db = bootstrapDatabase();
    repository = new AssumptionSessionRepository(db);
    const document: Document = {
      id: 'doc-assumptions',
      projectId: 'project-observability',
      title: 'Observability Deep Dive',
      content: {},
      templateId: 'architecture-reference',
      templateVersion: '1.0.0',
      templateSchemaHash: 'hash-architecture-reference',
      createdAt: fixedNow,
      createdBy: 'user-observability',
      updatedAt: fixedNow,
      updatedBy: 'user-observability',
      deletedAt: null,
      deletedBy: null,
    };
    documentRepository = {
      findById: vi.fn().mockResolvedValue(document),
    } as unknown as DocumentRepositoryImpl;
    const templateResolution = {
      cacheHit: false,
      template: {
        templateId: 'architecture-reference',
        version: '1.0.0',
        schemaHash: 'hash-architecture-reference',
        sections: [],
      },
    };
    templateResolver = {
      resolve: vi.fn().mockResolvedValue(templateResolution),
      resolveActiveVersion: vi.fn().mockResolvedValue(templateResolution),
      clearCache: vi.fn(),
      getCacheStats: vi.fn(() => ({ hits: 0, misses: 0, entries: 0 })),
    };
    service = new AssumptionSessionService({
      repository,
      logger,
      documentRepository,
      templateResolver,
      promptProvider: {
        async getPrompts(): Promise<AssumptionPromptTemplate[]> {
          return promptTemplates;
        },
      },
      timeProvider: () => fixedNow,
    });
    vi.clearAllMocks();
  });

  afterEach(() => {
    db?.close();
    vi.clearAllMocks();
  });

  it('emits latency telemetry and completion events within expected thresholds', async () => {
    const session = await service.startSession({
      sectionId: 'sec-observability',
      documentId: 'doc-assumptions',
      templateVersion: '1.0.0',
      startedBy: 'user-observability',
      requestId: 'req-start-1',
    });

    const startLatency = extractLatencyEvent(infoSpy, 'start_session', 'req-start-1');
    expect(startLatency).toBeLessThan(50);

    const firstPrompt = session.prompts[0];
    if (!firstPrompt) {
      throw new Error('Expected first prompt to exist');
    }
    await service.respondToAssumption({
      assumptionId: firstPrompt.id,
      action: 'skip_override',
      actorId: 'user-observability',
      overrideJustification: 'Pending architecture review',
      requestId: 'req-skip-1',
    });

    await service.respondToAssumption({
      assumptionId: firstPrompt.id,
      action: 'answer',
      actorId: 'user-observability',
      answer: 'No impact',
      requestId: 'req-answer-1',
    });

    const secondPrompt = session.prompts[1];
    if (!secondPrompt) {
      throw new Error('Expected second prompt to exist');
    }
    await service.respondToAssumption({
      assumptionId: secondPrompt.id,
      action: 'answer',
      actorId: 'user-observability',
      answer: 'Introduces internal metrics agent',
      requestId: 'req-answer-2',
    });

    const proposal = await service.createProposal({
      sessionId: session.sessionId,
      source: 'manual_submit',
      actorId: 'user-observability',
      draftOverride: 'Manual draft after overrides cleared',
      requestId: 'req-proposal-1',
    });

    expect(proposal.proposalIndex).toBe(0);

    const respondLatency = extractLatencyEvent(infoSpy, 'respond_to_prompt', 'req-answer-2');
    expect(respondLatency).toBeLessThan(50);

    const proposalLatency = extractLatencyEvent(infoSpy, 'create_proposal', 'req-proposal-1');
    expect(proposalLatency).toBeLessThan(80);

    const completionEvent = findEvent(infoSpy, 'assumption_session.completed');
    expect(completionEvent).toMatchObject({
      requestId: 'req-proposal-1',
      sessionId: session.sessionId,
      overridesOpen: 0,
    });

    const overrideEvent = findEvent(infoSpy, 'assumption_override.recorded');
    expect(overrideEvent).toMatchObject({
      requestId: 'req-skip-1',
      assumptionId: firstPrompt.id,
      overridesOpen: expect.any(Number),
    });

    const draftEvent = findEvent(infoSpy, 'draft_proposal.generated');
    expect(draftEvent).toMatchObject({
      requestId: 'req-proposal-1',
      proposalId: proposal.proposalId,
      sectionId: 'sec-observability',
    });
  });
});

function extractLatencyEvent(mock: Mock, action: string, requestId: string): number {
  const payload = mock.mock.calls
    .map(call => call[0] as Record<string, unknown>)
    .find(
      candidate =>
        candidate?.event === 'assumption_session.latency_ms' &&
        candidate?.action === action &&
        candidate?.requestId === requestId
    );
  expect(payload).toBeDefined();
  expect(typeof payload?.value).toBe('number');
  return Number(payload?.value);
}

function findEvent(mock: Mock, event: string): Record<string, unknown> {
  const payload = mock.mock.calls
    .map(call => call[0] as Record<string, unknown>)
    .find(candidate => candidate?.event === event);
  expect(payload).toBeDefined();
  return payload as Record<string, unknown>;
}
