import { readFileSync } from 'fs';
import { join } from 'path';
import { fileURLToPath } from 'url';

import Database from 'better-sqlite3';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Logger } from 'pino';

import { AssumptionSessionRepository } from '@ctrl-freaq/shared-data';
import type { SectionStreamQueue } from '@ctrl-freaq/editor-core/streaming/section-stream-queue.js';
import { mockAsyncFn, type MockedAsyncFn } from '@ctrl-freaq/test-support';

import {
  AssumptionSessionService,
  type AssumptionPromptTemplate,
  type AssumptionStreamingProvider,
  type DocumentDecisionProvider,
} from './assumption-session.service';

describe('AssumptionSessionService', () => {
  let db: Database.Database;
  let service: AssumptionSessionService;
  let repository: AssumptionSessionRepository;
  let decisionProvider: {
    getDecisionSnapshot: MockedAsyncFn<DocumentDecisionProvider['getDecisionSnapshot']>;
  };
  const fixedNow = new Date('2025-09-29T05:00:00.000Z');
  const logger = {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  } as unknown as Logger;

  const promptTemplates: AssumptionPromptTemplate[] = [
    {
      id: 'assume-security',
      templateKey: 'assumptions.priority.security',
      heading: 'Confirm security baseline',
      body: 'Does this change affect security posture?',
      responseType: 'single_select',
      options: [
        { id: 'secure', label: 'No impact', description: null, defaultSelected: true },
        { id: 'risk', label: 'Requires review', description: null, defaultSelected: false },
      ],
      priority: 1,
    },
    {
      id: 'assume-performance',
      templateKey: 'assumptions.priority.performance',
      heading: 'Performance guardrail',
      body: 'State the latency target for this draft.',
      responseType: 'text',
      options: [],
      priority: 0,
    },
    {
      id: 'assume-integrations',
      templateKey: 'assumptions.priority.integrations',
      heading: 'Integration dependencies',
      body: 'Select the integrations that need updates.',
      responseType: 'multi_select',
      options: [
        { id: 'ai-service', label: 'AI Service', description: null, defaultSelected: false },
        {
          id: 'persistence-layer',
          label: 'Persistence layer',
          description: null,
          defaultSelected: true,
        },
        { id: 'telemetry', label: 'Telemetry', description: null, defaultSelected: false },
      ],
      priority: 2,
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
    database.prepare('INSERT INTO users(id) VALUES (?)').run('user-assumption-author');
    database.prepare('INSERT INTO documents(id) VALUES (?)').run('doc-new-content-flow');
    database
      .prepare(
        `INSERT INTO section_records (id, document_id, template_key, order_index, created_at, created_by, updated_at, updated_by)
           VALUES (?, ?, 'section.template', 0, ?, ?, ?, ?)`
      )
      .run(
        'sec-new-content-flow',
        'doc-new-content-flow',
        timestamp,
        'user-assumption-author',
        timestamp,
        'user-assumption-author'
      );

    const __dirname = fileURLToPath(new URL('.', import.meta.url));
    const migrationPath = join(
      __dirname,
      '../../../../../../packages/shared-data/migrations/012_assumption_sessions.sql'
    );
    const migrationSql = readFileSync(migrationPath, 'utf-8');
    database.exec(migrationSql);

    return database;
  };

  beforeEach(() => {
    db = bootstrapDatabase();
    repository = new AssumptionSessionRepository(db);
    decisionProvider = {
      getDecisionSnapshot: mockAsyncFn<DocumentDecisionProvider['getDecisionSnapshot']>(),
    };
    decisionProvider.getDecisionSnapshot.mockResolvedValue(null);
    service = new AssumptionSessionService({
      repository,
      logger,
      promptProvider: {
        async getPrompts() {
          return promptTemplates;
        },
      },
      timeProvider: () => fixedNow,
      decisionProvider,
    });
  });

  afterEach(() => {
    if (db) {
      db.close();
    }
    vi.clearAllMocks();
  });

  it('prioritises prompts when starting a session and returns summary skeleton', async () => {
    const session = await service.startSession({
      sectionId: 'sec-new-content-flow',
      documentId: 'doc-new-content-flow',
      templateVersion: '1.0.0',
      startedBy: 'user-assumption-author',
    });

    expect(session).toMatchObject({
      sessionId: expect.any(String),
      sectionId: 'sec-new-content-flow',
      overridesOpen: 0,
      documentDecisionSnapshotId: null,
    });
    expect(session.prompts).toHaveLength(3);
    expect(session.prompts[0]?.heading).toBe('Performance guardrail');
    expect(session.summaryMarkdown).toContain('Assumption Summary');
  });

  it('blocks conflicting answers based on document decisions', async () => {
    decisionProvider.getDecisionSnapshot.mockResolvedValue({
      snapshotId: 'snapshot-security',
      decisions: [
        {
          id: 'doc-security-baseline',
          templateKey: 'assumptions.priority.security',
          responseType: 'single_select',
          allowedOptionIds: ['no-changes'],
          allowedAnswers: ['No significant change'],
          value: 'No significant change',
          status: 'approved',
        },
      ],
    });

    const session = await service.startSession({
      sectionId: 'sec-new-content-flow',
      documentId: 'doc-new-content-flow',
      templateVersion: '1.0.0',
      startedBy: 'user-assumption-author',
    });

    const conflictingPrompt = session.prompts.find(
      prompt => prompt.responseType === 'single_select'
    );
    expect(conflictingPrompt).toBeDefined();

    await expect(
      service.respondToAssumption({
        assumptionId: conflictingPrompt!.id,
        actorId: 'user-assumption-author',
        action: 'answer',
        answer: 'risk',
      })
    ).rejects.toMatchObject({
      statusCode: 409,
      details: expect.objectContaining({
        status: 'decision_conflict',
        decisionId: 'doc-security-baseline',
      }),
    });
  });

  describe('streaming progress events', () => {
    const createStreamingProvider = (
      overrides: Partial<Parameters<AssumptionStreamingProvider['generateEvents']>[0]> = {}
    ): AssumptionStreamingProvider => {
      return {
        async generateEvents(input) {
          const base = {
            ...input,
            ...overrides,
          };

          const firstSequence = base.getNextSequence();
          const secondSequence = base.getNextSequence();

          return [
            {
              type: 'progress' as const,
              sequence: secondSequence,
              stageLabel: 'assumptions.progress.analysis',
              contentSnippet: `Resolved: ${base.prompt.promptHeading}`,
              deltaType: 'text' as const,
              announcementPriority: 'polite' as const,
              elapsedMs: 120,
            },
            {
              type: 'progress' as const,
              sequence: firstSequence,
              stageLabel: 'assumptions.progress.summary',
              contentSnippet: `Summary for ${base.prompt.promptHeading}`,
              deltaType: 'text' as const,
              announcementPriority: 'polite' as const,
              elapsedMs: 40,
            },
          ];
        },
      };
    };

    const createPendingQueueStub = (): SectionStreamQueue => {
      const pendingBySection = new Map<
        string,
        { sessionId: string; sectionId: string; enqueuedAt: number }
      >();

      return {
        enqueue: vi.fn(request => {
          pendingBySection.set(request.sectionId, {
            sessionId: request.sessionId,
            sectionId: request.sectionId,
            enqueuedAt: request.enqueuedAt,
          });
          return {
            disposition: 'pending' as const,
            sessionId: request.sessionId,
            sectionId: request.sectionId,
            replacedSessionId: null,
          };
        }),
        complete: vi.fn(() => null),
        cancel: vi.fn((_sessionId, reason) => ({
          released: true,
          reason,
          promoted: null,
        })),
        snapshot: vi.fn(() => ({
          active: new Map<string, any>(),
          pending: new Map(pendingBySection),
        })),
      };
    };

    const collectEvents = async (
      stream: AsyncIterable<{ type: string; data: any }>,
      count: number,
      filter: (event: { type: string; data: any }) => boolean = () => true
    ) => {
      const events: Array<{ type: string; data: any }> = [];
      for await (const event of stream) {
        if (!filter(event)) {
          continue;
        }
        events.push(event);
        if (events.length >= count) {
          break;
        }
      }
      return events;
    };

    it('buffers out-of-order progress events and emits them sequentially', async () => {
      service = new AssumptionSessionService({
        repository,
        logger,
        promptProvider: {
          async getPrompts() {
            return promptTemplates;
          },
        },
        timeProvider: () => fixedNow,
        decisionProvider,
        streaming: {
          provider: createStreamingProvider(),
        },
      });

      const session = await service.startSession({
        sectionId: 'sec-new-content-flow',
        documentId: 'doc-new-content-flow',
        templateVersion: '1.0.0',
        startedBy: 'user-assumption-author',
      });

      const streamRegistration = await service.openStreamingSession({
        sessionId: session.sessionId,
        sectionId: session.sectionId,
        requestId: 'req-stream-order',
        actorId: 'user-assumption-author',
      });

      expect(streamRegistration.disposition).toBe('started');

      const prompt = session.prompts[0]!;
      await service.respondToAssumption({
        assumptionId: prompt.id,
        actorId: 'user-assumption-author',
        action: 'answer',
        answer: 'Risk accepted',
      });

      const events = await collectEvents(
        streamRegistration.stream,
        2,
        event => event.type === 'progress'
      );
      expect(events).toHaveLength(2);
      expect(events[0]).toMatchObject({
        type: 'progress',
        data: {
          sequence: 1,
          stageLabel: 'assumptions.progress.summary',
          contentSnippet: 'Summary for Performance guardrail',
        },
      });
      expect(events[1]).toMatchObject({
        type: 'progress',
        data: {
          sequence: 2,
          stageLabel: 'assumptions.progress.analysis',
        },
      });

      await service.completeStreamingSession({
        sessionId: session.sessionId,
        sectionId: session.sectionId,
        reason: 'client_close',
      });
    });

    it('queues streaming output when pending and flushes after promotion', async () => {
      const queueStub = createPendingQueueStub();

      service = new AssumptionSessionService({
        repository,
        logger,
        promptProvider: {
          async getPrompts() {
            return promptTemplates;
          },
        },
        timeProvider: () => fixedNow,
        decisionProvider,
        streaming: {
          provider: createStreamingProvider(),
        },
        queue: queueStub,
      });

      const session = await service.startSession({
        sectionId: 'sec-new-content-flow',
        documentId: 'doc-new-content-flow',
        templateVersion: '1.0.0',
        startedBy: 'user-assumption-author',
      });

      const streamRegistration = await service.openStreamingSession({
        sessionId: session.sessionId,
        sectionId: session.sectionId,
        requestId: 'req-stream-pending',
        actorId: 'user-assumption-author',
      });

      expect(streamRegistration.disposition).toBe('pending');

      const progressEventsPromise = collectEvents(
        streamRegistration.stream,
        2,
        event => event.type === 'progress'
      );

      const prompt = session.prompts[0]!;
      await service.respondToAssumption({
        assumptionId: prompt.id,
        actorId: 'user-assumption-author',
        action: 'answer',
        answer: 'Concurrency guard verified',
      });

      service.handleQueuePromotion({
        sessionId: session.sessionId,
        sectionId: session.sectionId,
        concurrencySlot: 1,
      });

      const progressEvents = await progressEventsPromise;
      expect(progressEvents).toHaveLength(2);
      expect(progressEvents[0]?.data).toMatchObject({ sequence: 1 });
      expect(progressEvents[1]?.data).toMatchObject({ sequence: 2 });

      await service.completeStreamingSession({
        sessionId: session.sessionId,
        sectionId: session.sectionId,
        reason: 'client_close',
      });
    });

    it('emits deferred and resumed status updates around prompt actions', async () => {
      service = new AssumptionSessionService({
        repository,
        logger,
        promptProvider: {
          async getPrompts() {
            return promptTemplates;
          },
        },
        timeProvider: () => fixedNow,
        decisionProvider,
        streaming: {
          provider: createStreamingProvider(),
        },
      });

      const session = await service.startSession({
        sectionId: 'sec-new-content-flow',
        documentId: 'doc-new-content-flow',
        templateVersion: '1.0.0',
        startedBy: 'user-assumption-author',
      });

      const { stream } = await service.openStreamingSession({
        sessionId: session.sessionId,
        sectionId: session.sectionId,
        requestId: 'req-stream-defer',
        actorId: 'user-assumption-author',
      });

      const prompt = session.prompts[0]!;
      await service.respondToAssumption({
        assumptionId: prompt.id,
        actorId: 'user-assumption-author',
        action: 'defer',
      });

      const [firstEvent] = await collectEvents(
        stream,
        1,
        event => !(event.type === 'status' && event.data?.status === 'streaming')
      );
      expect(firstEvent).toMatchObject({
        type: 'status',
        data: {
          status: 'deferred',
        },
      });

      await service.respondToAssumption({
        assumptionId: prompt.id,
        actorId: 'user-assumption-author',
        action: 'answer',
        answer: 'Proceed later',
      });

      const [second] = await collectEvents(
        stream,
        1,
        event => !(event.type === 'status' && event.data?.status === 'streaming')
      );
      expect(second).toMatchObject({
        type: 'status',
        data: {
          status: 'resumed',
        },
      });

      const [third] = await collectEvents(
        stream,
        1,
        event => event.type !== 'status' || event.data?.status !== 'streaming'
      );
      expect(third).toMatchObject({
        type: 'progress',
      });

      await service.completeStreamingSession({
        sessionId: session.sessionId,
        sectionId: session.sectionId,
        reason: 'client_close',
      });
    });

    it('emits cancellation telemetry when queue cancels a session', async () => {
      const queueStub = createPendingQueueStub();
      service = new AssumptionSessionService({
        repository,
        logger,
        promptProvider: {
          async getPrompts() {
            return promptTemplates;
          },
        },
        timeProvider: () => fixedNow,
        decisionProvider,
        streaming: {
          provider: createStreamingProvider(),
        },
        queue: queueStub,
      });

      const session = await service.startSession({
        sectionId: 'sec-new-content-flow',
        documentId: 'doc-new-content-flow',
        templateVersion: '1.0.0',
        startedBy: 'user-assumption-author',
      });

      const streamRegistration = await service.openStreamingSession({
        sessionId: session.sessionId,
        sectionId: session.sectionId,
        requestId: 'req-stream-cancel',
        actorId: 'user-assumption-author',
      });

      expect(streamRegistration.disposition).toBe('pending');

      const captured: Array<{ type: string; data: any }> = [];
      const consumeStream = (async () => {
        for await (const event of streamRegistration.stream) {
          captured.push(event);
        }
      })();

      service.handleQueueCancellation({
        sessionId: session.sessionId,
        sectionId: session.sectionId,
        reason: 'replaced_by_new_request',
        state: 'pending',
      });

      await consumeStream;

      expect(captured.some(event => event.type === 'replacement')).toBe(true);

      const internals = service as unknown as {
        streams: Map<string, unknown>;
        queueStates: Map<string, unknown>;
      };

      expect(internals.streams.has(session.sessionId)).toBe(false);
      expect(internals.queueStates.has(session.sessionId)).toBe(false);
    });

    it('records telemetry for streaming progress events', async () => {
      const telemetryLogger = {
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        debug: vi.fn(),
      } as unknown as Logger;

      service = new AssumptionSessionService({
        repository,
        logger: telemetryLogger,
        promptProvider: {
          async getPrompts() {
            return promptTemplates;
          },
        },
        timeProvider: () => fixedNow,
        decisionProvider,
        streaming: {
          provider: createStreamingProvider(),
        },
      });

      const session = await service.startSession({
        sectionId: 'sec-new-content-flow',
        documentId: 'doc-new-content-flow',
        templateVersion: '1.0.0',
        startedBy: 'user-assumption-author',
      });

      const { stream } = await service.openStreamingSession({
        sessionId: session.sessionId,
        sectionId: session.sectionId,
        requestId: 'req-stream-telemetry',
        actorId: 'user-assumption-author',
      });

      const prompt = session.prompts[0]!;
      await service.respondToAssumption({
        assumptionId: prompt.id,
        actorId: 'user-assumption-author',
        action: 'answer',
        answer: 'Telemetry please',
      });

      await collectEvents(stream, 2);

      expect(telemetryLogger.info).toHaveBeenCalledWith(
        expect.objectContaining({
          event: 'assumptions.streaming.progress',
          sessionId: session.sessionId,
        }),
        'Assumption streaming progress event'
      );
    });
  });

  it('updates summary with answers, overrides, and escalations', async () => {
    decisionProvider.getDecisionSnapshot.mockResolvedValue({
      snapshotId: 'snapshot-full',
      decisions: [
        {
          id: 'doc-security-baseline',
          templateKey: 'assumptions.priority.security',
          responseType: 'single_select',
          allowedOptionIds: ['secure', 'risk'],
          allowedAnswers: ['Requires review', 'No impact'],
          value: 'No impact',
          status: 'approved',
        },
      ],
    });

    const session = await service.startSession({
      sectionId: 'sec-new-content-flow',
      documentId: 'doc-new-content-flow',
      templateVersion: '1.0.0',
      startedBy: 'user-assumption-author',
    });

    const singlePrompt = session.prompts.find(prompt => prompt.responseType === 'single_select');
    expect(singlePrompt).toBeDefined();

    await service.respondToAssumption({
      assumptionId: singlePrompt!.id,
      actorId: 'user-assumption-author',
      action: 'answer',
      answer: 'secure',
      notes: 'Security review pending sign-off',
    });

    const textPrompt = session.prompts.find(prompt => prompt.responseType === 'text');
    if (textPrompt) {
      await service.respondToAssumption({
        assumptionId: textPrompt.id,
        actorId: 'user-assumption-author',
        action: 'escalate',
        notes: 'Need updated latency benchmarks',
      });
    }

    const persistedSession = await repository.findById(session.sessionId);
    expect(persistedSession?.summaryMarkdown).toContain('Status: Answered');
    expect(persistedSession?.summaryMarkdown).toContain('Answer: No impact');
    expect(persistedSession?.summaryMarkdown).toContain(
      'Escalation: awaiting stakeholder response'
    );
  });

  it('tracks override counts when responding to a prompt', async () => {
    const started = await service.startSession({
      sectionId: 'sec-new-content-flow',
      documentId: 'doc-new-content-flow',
      templateVersion: '1.0.0',
      startedBy: 'user-assumption-author',
    });

    const state = await service.respondToAssumption({
      assumptionId: started.prompts[0]!.id,
      actorId: 'user-assumption-author',
      action: 'skip_override',
      overrideJustification: 'Pending security review',
    });

    expect(state.status).toBe('override_skipped');
    expect(state.overrideJustification).toBe('Pending security review');
    expect(state.unresolvedOverrideCount).toBeGreaterThan(0);
  });

  it('creates draft proposals with rationale and override counts', async () => {
    const started = await service.startSession({
      sectionId: 'sec-new-content-flow',
      documentId: 'doc-new-content-flow',
      templateVersion: '1.0.0',
      startedBy: 'user-assumption-author',
    });

    // Provide answers for prompts to clear overrides
    await service.respondToAssumption({
      assumptionId: started.prompts[0]!.id,
      actorId: 'user-assumption-author',
      action: 'answer',
      answer: 'No impact',
    });
    await service.respondToAssumption({
      assumptionId: started.prompts[1]!.id,
      actorId: 'user-assumption-author',
      action: 'answer',
      answer: 'Latency target 300ms',
    });

    const proposal = await service.createProposal({
      sessionId: started.sessionId,
      actorId: 'user-assumption-author',
      source: 'ai_generate',
    });

    expect(proposal).toMatchObject({
      proposalId: expect.any(String),
      proposalIndex: 0,
      contentMarkdown: expect.stringContaining('AI Draft Proposal'),
    });
    expect(proposal.rationale).toHaveLength(promptTemplates.length);

    const history = await service.listProposals(started.sessionId);
    expect(history).toHaveLength(1);
    expect(history[0]).toBeDefined();
    expect(history[0]!.proposalIndex).toBe(0);
  });

  it('round-trips multi-select answers as canonical JSON strings for resume flows', async () => {
    const started = await service.startSession({
      sectionId: 'sec-new-content-flow',
      documentId: 'doc-new-content-flow',
      templateVersion: '1.0.0',
      startedBy: 'user-assumption-author',
    });

    const multiPrompt = started.prompts.find(prompt => prompt.responseType === 'multi_select');
    expect(multiPrompt).toBeDefined();

    const selections = ['ai-service', 'telemetry'];
    const responseState = await service.respondToAssumption({
      assumptionId: multiPrompt!.id,
      actorId: 'user-assumption-author',
      action: 'answer',
      answer: JSON.stringify(selections),
    });

    expect(responseState.status).toBe('answered');
    expect(responseState.answer).toBe(JSON.stringify(selections));

    const parsedAnswer = responseState.answer ? JSON.parse(responseState.answer) : null;
    expect(parsedAnswer).toEqual(selections);
  });

  it('includes option labels for single and multi-select answers in generated proposals', async () => {
    const started = await service.startSession({
      sectionId: 'sec-new-content-flow',
      documentId: 'doc-new-content-flow',
      templateVersion: '1.0.0',
      startedBy: 'user-assumption-author',
    });

    const singlePrompt = started.prompts.find(prompt => prompt.responseType === 'single_select');
    const textPrompt = started.prompts.find(prompt => prompt.responseType === 'text');
    const multiPrompt = started.prompts.find(prompt => prompt.responseType === 'multi_select');

    expect(singlePrompt).toBeDefined();
    expect(textPrompt).toBeDefined();
    expect(multiPrompt).toBeDefined();

    await service.respondToAssumption({
      assumptionId: singlePrompt!.id,
      actorId: 'user-assumption-author',
      action: 'answer',
      answer: 'risk',
    });

    await service.respondToAssumption({
      assumptionId: textPrompt!.id,
      actorId: 'user-assumption-author',
      action: 'answer',
      answer: 'Latency target 250ms',
    });

    const selectedOptions = ['ai-service', 'telemetry'];
    await service.respondToAssumption({
      assumptionId: multiPrompt!.id,
      actorId: 'user-assumption-author',
      action: 'answer',
      answer: JSON.stringify(selectedOptions),
    });

    const proposal = await service.createProposal({
      sessionId: started.sessionId,
      actorId: 'user-assumption-author',
      source: 'ai_generate',
    });

    const singleSummary = proposal.rationale.find(entry => entry.assumptionId === singlePrompt!.id);
    expect(singleSummary?.summary).toContain('Requires review');

    const multiSummary = proposal.rationale.find(entry => entry.assumptionId === multiPrompt!.id);
    expect(multiSummary?.summary).toContain('AI Service, Telemetry');

    expect(proposal.contentMarkdown).toContain('**Confirm security baseline**: Requires review');
    expect(proposal.contentMarkdown).toContain(
      '**Integration dependencies**: AI Service, Telemetry'
    );
  });

  it('lists proposals in chronological order for auditing', async () => {
    const started = await service.startSession({
      sectionId: 'sec-new-content-flow',
      documentId: 'doc-new-content-flow',
      templateVersion: '1.0.0',
      startedBy: 'user-assumption-author',
    });

    await service.respondToAssumption({
      assumptionId: started.prompts[0]!.id,
      actorId: 'user-assumption-author',
      action: 'answer',
      answer: 'No impact',
    });
    await service.respondToAssumption({
      assumptionId: started.prompts[1]!.id,
      actorId: 'user-assumption-author',
      action: 'answer',
      answer: 'Latency target 300ms',
    });

    await service.createProposal({
      sessionId: started.sessionId,
      source: 'ai_generate',
      actorId: 'user-assumption-author',
    });
    await service.createProposal({
      sessionId: started.sessionId,
      source: 'manual_submit',
      actorId: 'user-assumption-author',
      draftOverride: 'Manual adjustments recorded',
    });

    const proposals = await service.listProposals(started.sessionId);
    expect(proposals).toHaveLength(2);
    expect(proposals[0]).toBeDefined();
    expect(proposals[1]).toBeDefined();
    expect(proposals[0]!.proposalIndex).toBeLessThan(proposals[1]!.proposalIndex);
  });
});
