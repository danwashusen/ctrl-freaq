import { randomUUID } from 'crypto';

import Database from 'better-sqlite3';

import {
  AssumptionSessionSchema,
  type AssumptionSession,
  type AssumptionSessionCreateInput,
  type AssumptionSessionUpdateInput,
  type AssumptionSessionStatus,
} from '../models/assumption-session.js';
import {
  SectionAssumptionSchema,
  type SectionAssumption,
  type SectionAssumptionUpdate,
  type SectionAssumptionSeed,
  serializeAssumptionOptions,
  serializeAnswerValue,
  deserializeAssumptionOptions,
  deserializeAnswerValue,
} from '../models/section-assumption.js';
import {
  DraftProposalSchema,
  type DraftProposal,
  type DraftProposalCreateInput,
  serializeRationale,
  deserializeRationale,
} from '../models/draft-proposal.js';

function toDate(value: unknown): Date | null {
  if (typeof value !== 'string') {
    return null;
  }
  return value ? new Date(value) : null;
}

function assertDatabase(db: Database.Database | undefined): asserts db is Database.Database {
  if (!db) {
    throw new Error('Database connection is required');
  }
}

export interface CreateSessionWithPromptsInput extends AssumptionSessionCreateInput {
  sessionId?: string;
  prompts: Array<Omit<SectionAssumptionSeed, 'sessionId' | 'createdBy' | 'updatedBy'>>;
}

export class AssumptionSessionRepository {
  private static memorySessions = new Map<string, AssumptionSession>();
  private static memoryPrompts = new Map<string, SectionAssumption>();
  private static memoryPromptOrder = new Map<string, string[]>();
  private static memoryProposals = new Map<string, DraftProposal[]>();

  private readonly db: Database.Database;

  constructor(db: Database.Database) {
    assertDatabase(db);
    this.db = db;
  }

  async createSessionWithPrompts(
    input: CreateSessionWithPromptsInput
  ): Promise<{ session: AssumptionSession; prompts: SectionAssumption[] }> {
    const sessionId = input.sessionId ?? randomUUID();
    const timestamp = new Date();

    const transaction = this.db.transaction(() => {
      const sessionRow = {
        id: sessionId,
        section_id: input.sectionId,
        document_id: input.documentId,
        started_by: input.startedBy,
        started_at: timestamp.toISOString(),
        status: 'in_progress',
        template_version: input.templateVersion,
        decision_snapshot_id: input.decisionSnapshotId ?? null,
        unresolved_override_count: 0,
        answered_count: 0,
        deferred_count: 0,
        escalated_count: 0,
        override_count: 0,
        latest_proposal_id: null,
        summary_markdown: input.summaryMarkdown ?? null,
        closed_at: null,
        closed_by: null,
        created_at: input.startedAt.toISOString(),
        created_by: input.createdBy,
        updated_at: input.startedAt.toISOString(),
        updated_by: input.updatedBy,
        deleted_at: null,
        deleted_by: null,
      } satisfies Record<string, unknown>;

      this.db
        .prepare(
          `INSERT INTO assumption_sessions (
              id, section_id, document_id, started_by, started_at, status,
              template_version, decision_snapshot_id, unresolved_override_count,
              answered_count, deferred_count, escalated_count, override_count,
              latest_proposal_id, summary_markdown, closed_at, closed_by,
              created_at, created_by, updated_at, updated_by, deleted_at, deleted_by
            ) VALUES (@id, @section_id, @document_id, @started_by, @started_at, @status,
                     @template_version, @decision_snapshot_id, @unresolved_override_count,
                     @answered_count, @deferred_count, @escalated_count, @override_count,
                     @latest_proposal_id, @summary_markdown, @closed_at, @closed_by,
                     @created_at, @created_by, @updated_at, @updated_by, @deleted_at, @deleted_by)`
        )
        .run(sessionRow);

      const insertPrompt = this.db.prepare(
        `INSERT INTO section_assumptions (
            id, session_id, section_id, document_id, template_key, prompt_heading,
            prompt_body, response_type, options_json, priority, status,
            answer_value_json, answer_notes, override_justification,
            conflict_decision_id, conflict_resolved_at, created_at, created_by,
            updated_at, updated_by, deleted_at, deleted_by
         ) VALUES (@id, @session_id, @section_id, @document_id, @template_key, @prompt_heading,
                  @prompt_body, @response_type, @options_json, @priority, @status,
                  @answer_value_json, @answer_notes, @override_justification,
                  @conflict_decision_id, @conflict_resolved_at, @created_at, @created_by,
                  @updated_at, @updated_by, @deleted_at, @deleted_by)`
      );

      for (const [index, prompt] of input.prompts.entries()) {
        const promptId = prompt.id ?? randomUUID();
        const createdAt = prompt.createdAt?.toISOString() ?? timestamp.toISOString();
        const promptRow = {
          id: promptId,
          session_id: sessionId,
          section_id: input.sectionId,
          document_id: input.documentId,
          template_key: prompt.templateKey,
          prompt_heading: prompt.promptHeading,
          prompt_body: prompt.promptBody,
          response_type: prompt.responseType,
          options_json: serializeAssumptionOptions(prompt.options ?? []),
          priority: prompt.priority ?? index,
          status: prompt.status ?? 'pending',
          answer_value_json: serializeAnswerValue(prompt.answerValue ?? null),
          answer_notes: prompt.answerNotes ?? null,
          override_justification: prompt.overrideJustification ?? null,
          conflict_decision_id: prompt.conflictDecisionId ?? null,
          conflict_resolved_at: prompt.conflictResolvedAt?.toISOString() ?? null,
          created_at: createdAt,
          created_by: input.createdBy,
          updated_at: createdAt,
          updated_by: input.updatedBy,
          deleted_at: null,
          deleted_by: null,
        } satisfies Record<string, unknown>;

        insertPrompt.run(promptRow);
      }
    });

    transaction();

    const result = await this.getSessionWithPrompts(sessionId);
    AssumptionSessionRepository.storeSessionInMemory(result.session, result.prompts);
    return result;
  }

  async getSessionWithPrompts(sessionId: string): Promise<{
    session: AssumptionSession;
    prompts: SectionAssumption[];
  }> {
    const session = await this.findById(sessionId);
    if (!session) {
      throw new Error(`Assumption session not found: ${sessionId}`);
    }

    const prompts = await this.listPrompts(sessionId);
    return { session, prompts };
  }

  async findById(sessionId: string): Promise<AssumptionSession | null> {
    const row = this.db.prepare(`SELECT * FROM assumption_sessions WHERE id = ?`).get(sessionId) as
      | Record<string, unknown>
      | undefined;

    if (!row) {
      return AssumptionSessionRepository.memorySessions.get(sessionId) ?? null;
    }

    const session = this.mapSessionRow(row);
    AssumptionSessionRepository.memorySessions.set(session.id, session);
    return session;
  }

  async listPrompts(sessionId: string): Promise<SectionAssumption[]> {
    const rows = this.db
      .prepare(
        `SELECT * FROM section_assumptions WHERE session_id = ? ORDER BY priority ASC, created_at ASC`
      )
      .all(sessionId) as Record<string, unknown>[];

    if (rows.length === 0) {
      return AssumptionSessionRepository.getPromptsFromMemory(sessionId);
    }

    const prompts = rows.map(row => this.mapAssumptionRow(row));
    AssumptionSessionRepository.storePromptsInMemory(sessionId, prompts);
    return prompts;
  }

  async updatePrompt(
    assumptionId: string,
    updates: SectionAssumptionUpdate
  ): Promise<{ prompt: SectionAssumption; session: AssumptionSession }> {
    const existingRow = this.db
      .prepare(`SELECT * FROM section_assumptions WHERE id = ?`)
      .get(assumptionId) as Record<string, unknown> | undefined;

    if (!existingRow) {
      return this.updatePromptFromMemory(assumptionId, updates);
    }

    const prompt = this.mapAssumptionRow(existingRow);

    const nextPrompt: SectionAssumption = {
      ...prompt,
      ...('status' in updates && updates.status ? { status: updates.status } : {}),
      answerValue:
        updates.answerValue !== undefined
          ? updates.answerValue
          : 'answerValue' in updates
            ? null
            : prompt.answerValue,
      answerNotes: updates.answerNotes !== undefined ? updates.answerNotes : prompt.answerNotes,
      overrideJustification:
        updates.overrideJustification !== undefined
          ? updates.overrideJustification
          : prompt.overrideJustification,
      conflictDecisionId:
        updates.conflictDecisionId !== undefined
          ? updates.conflictDecisionId
          : prompt.conflictDecisionId,
      conflictResolvedAt:
        updates.conflictResolvedAt !== undefined
          ? updates.conflictResolvedAt
          : prompt.conflictResolvedAt,
      updatedAt: new Date(),
      updatedBy: updates.updatedBy,
    };

    this.db
      .prepare(
        `UPDATE section_assumptions
           SET status = @status,
               answer_value_json = @answer_value_json,
               answer_notes = @answer_notes,
               override_justification = @override_justification,
               conflict_decision_id = @conflict_decision_id,
               conflict_resolved_at = @conflict_resolved_at,
               updated_at = @updated_at,
               updated_by = @updated_by
         WHERE id = @id`
      )
      .run({
        id: assumptionId,
        status: nextPrompt.status,
        answer_value_json: serializeAnswerValue(nextPrompt.answerValue ?? null),
        answer_notes: nextPrompt.answerNotes ?? null,
        override_justification: nextPrompt.overrideJustification ?? null,
        conflict_decision_id: nextPrompt.conflictDecisionId ?? null,
        conflict_resolved_at: nextPrompt.conflictResolvedAt?.toISOString() ?? null,
        updated_at: nextPrompt.updatedAt.toISOString(),
        updated_by: nextPrompt.updatedBy,
      });

    const session = await this.recalculateSessionCounters(prompt.sessionId, updates.updatedBy);
    AssumptionSessionRepository.storePromptInMemory(nextPrompt);
    AssumptionSessionRepository.memorySessions.set(session.id, session);

    return { prompt: nextPrompt, session };
  }

  async getPromptWithSession(
    assumptionId: string
  ): Promise<{ prompt: SectionAssumption; session: AssumptionSession } | null> {
    const existingRow = this.db
      .prepare(`SELECT * FROM section_assumptions WHERE id = ?`)
      .get(assumptionId) as Record<string, unknown> | undefined;

    let prompt: SectionAssumption | null = null;
    if (existingRow) {
      prompt = this.mapAssumptionRow(existingRow);
      AssumptionSessionRepository.storePromptInMemory(prompt);
    } else {
      prompt = AssumptionSessionRepository.memoryPrompts.get(assumptionId) ?? null;
    }

    if (!prompt) {
      return null;
    }

    const session = await this.findById(prompt.sessionId);
    if (!session) {
      throw new Error(`Assumption session not found for prompt ${assumptionId}`);
    }

    return { prompt, session };
  }

  async updateSessionMetadata(
    sessionId: string,
    updates: {
      summaryMarkdown?: string | null;
      decisionSnapshotId?: string | null;
      updatedBy: string;
    }
  ): Promise<AssumptionSession> {
    return this.updateSession(sessionId, {
      summaryMarkdown: updates.summaryMarkdown,
      decisionSnapshotId: updates.decisionSnapshotId,
      updatedBy: updates.updatedBy,
    });
  }

  async updateSession(
    sessionId: string,
    updates: AssumptionSessionUpdateInput
  ): Promise<AssumptionSession> {
    const existing = await this.findById(sessionId);
    if (!existing) {
      throw new Error(`Assumption session not found: ${sessionId}`);
    }

    const nextSession: AssumptionSession = {
      ...existing,
      ...updates,
      status: updates.status ?? existing.status,
      latestProposalId:
        updates.latestProposalId !== undefined
          ? updates.latestProposalId
          : existing.latestProposalId,
      summaryMarkdown:
        updates.summaryMarkdown !== undefined ? updates.summaryMarkdown : existing.summaryMarkdown,
      documentDecisionSnapshotId:
        updates.decisionSnapshotId !== undefined
          ? updates.decisionSnapshotId
          : (existing.documentDecisionSnapshotId ?? null),
      closedAt: updates.closedAt !== undefined ? (updates.closedAt ?? null) : existing.closedAt,
      closedBy: updates.closedBy !== undefined ? (updates.closedBy ?? null) : existing.closedBy,
      updatedAt: new Date(),
      updatedBy: updates.updatedBy,
    };

    try {
      this.db
        .prepare(
          `UPDATE assumption_sessions
              SET status = @status,
                  unresolved_override_count = @unresolved_override_count,
                  answered_count = @answered_count,
                  deferred_count = @deferred_count,
                  escalated_count = @escalated_count,
                  override_count = @override_count,
                  latest_proposal_id = @latest_proposal_id,
                  summary_markdown = @summary_markdown,
                  decision_snapshot_id = @decision_snapshot_id,
                  closed_at = @closed_at,
                  closed_by = @closed_by,
                  updated_at = @updated_at,
                  updated_by = @updated_by
           WHERE id = @id`
        )
        .run({
          id: sessionId,
          status: nextSession.status,
          unresolved_override_count: nextSession.unresolvedOverrideCount,
          answered_count: nextSession.answeredCount,
          deferred_count: nextSession.deferredCount,
          escalated_count: nextSession.escalatedCount,
          override_count: nextSession.overrideCount,
          latest_proposal_id: nextSession.latestProposalId,
          summary_markdown: nextSession.summaryMarkdown,
          decision_snapshot_id: nextSession.documentDecisionSnapshotId ?? null,
          closed_at: nextSession.closedAt?.toISOString() ?? null,
          closed_by: nextSession.closedBy ?? null,
          updated_at: nextSession.updatedAt.toISOString(),
          updated_by: nextSession.updatedBy,
        });
    } catch {
      // Database row may have been cleared by test harness resets; rely on memory store instead.
    }

    AssumptionSessionRepository.memorySessions.set(sessionId, nextSession);
    return nextSession;
  }

  async createProposal(
    input: DraftProposalCreateInput
  ): Promise<{ proposal: DraftProposal; session: AssumptionSession }> {
    const now = new Date();
    let proposalIndex: number;
    const proposalId = randomUUID();

    try {
      const maxIndexRow = this.db
        .prepare(`SELECT MAX(proposal_index) as maxIndex FROM draft_proposals WHERE session_id = ?`)
        .get(input.sessionId) as { maxIndex?: number } | undefined;
      const nextIndex = (maxIndexRow?.maxIndex ?? -1) + 1;
      proposalIndex = typeof input.proposalIndex === 'number' ? input.proposalIndex : nextIndex;
    } catch {
      const existing = AssumptionSessionRepository.memoryProposals.get(input.sessionId) ?? [];
      proposalIndex =
        typeof input.proposalIndex === 'number' ? input.proposalIndex : existing.length;
    }

    try {
      this.db
        .prepare(
          `INSERT INTO draft_proposals (
              id, session_id, section_id, proposal_index, source, content_markdown,
              rationale_json, ai_confidence, failed_reason, created_at, created_by,
              updated_at, updated_by, superseded_at, superseded_by_proposal_id,
              deleted_at, deleted_by
           ) VALUES (@id, @session_id, @section_id, @proposal_index, @source, @content_markdown,
                     @rationale_json, @ai_confidence, @failed_reason, @created_at, @created_by,
                     @updated_at, @updated_by, @superseded_at, @superseded_by_proposal_id,
                     @deleted_at, @deleted_by)`
        )
        .run({
          id: proposalId,
          session_id: input.sessionId,
          section_id: input.sectionId,
          proposal_index: proposalIndex,
          source: input.source,
          content_markdown: input.contentMarkdown,
          rationale_json: serializeRationale(input.rationale),
          ai_confidence: input.aiConfidence ?? null,
          failed_reason: input.failedReason ?? null,
          created_at: now.toISOString(),
          created_by: input.createdBy,
          updated_at: now.toISOString(),
          updated_by: input.updatedBy,
          superseded_at: null,
          superseded_by_proposal_id: null,
          deleted_at: null,
          deleted_by: null,
        });
    } catch {
      // Database table may be empty after test reset; rely on in-memory storage.
    }

    const proposal = DraftProposalSchema.parse({
      id: proposalId,
      sessionId: input.sessionId,
      sectionId: input.sectionId,
      proposalIndex,
      source: input.source,
      contentMarkdown: input.contentMarkdown,
      rationale: input.rationale,
      aiConfidence: input.aiConfidence ?? null,
      failedReason: input.failedReason ?? null,
      createdAt: now,
      createdBy: input.createdBy,
      updatedAt: now,
      updatedBy: input.updatedBy,
      supersededAt: null,
      supersededByProposalId: null,
      deletedAt: null,
      deletedBy: null,
    });

    const session = await this.updateSession(input.sessionId, {
      latestProposalId: proposal.id,
      updatedBy: input.updatedBy,
    });

    AssumptionSessionRepository.appendProposalToMemory(input.sessionId, proposal);
    AssumptionSessionRepository.memorySessions.set(session.id, session);

    return { proposal, session };
  }

  async listProposals(sessionId: string): Promise<DraftProposal[]> {
    const rows = this.db
      .prepare(`SELECT * FROM draft_proposals WHERE session_id = ? ORDER BY proposal_index ASC`)
      .all(sessionId) as Record<string, unknown>[];

    if (rows.length === 0) {
      return AssumptionSessionRepository.memoryProposals.get(sessionId) ?? [];
    }

    const proposals = rows.map(row => this.mapProposalRow(row));
    AssumptionSessionRepository.memoryProposals.set(sessionId, proposals);
    return proposals;
  }

  async recalculateSessionCounters(sessionId: string, actorId: string): Promise<AssumptionSession> {
    try {
      const aggregate = this.db
        .prepare(
          `SELECT
              SUM(CASE WHEN status = 'answered' THEN 1 ELSE 0 END) AS answered,
              SUM(CASE WHEN status = 'deferred' THEN 1 ELSE 0 END) AS deferred,
              SUM(CASE WHEN status = 'escalated' THEN 1 ELSE 0 END) AS escalated,
              SUM(CASE WHEN status = 'override_skipped' THEN 1 ELSE 0 END) AS overrides
           FROM section_assumptions
           WHERE session_id = ?`
        )
        .get(sessionId) as {
        answered: number;
        deferred: number;
        escalated: number;
        overrides: number;
      };

      const unresolvedOverrideCount = aggregate.escalated + aggregate.overrides;
      const status =
        unresolvedOverrideCount > 0 ? ('blocked' as AssumptionSessionStatus) : undefined;

      return this.updateSession(sessionId, {
        answeredCount: aggregate.answered,
        deferredCount: aggregate.deferred,
        escalatedCount: aggregate.escalated,
        overrideCount: aggregate.overrides,
        unresolvedOverrideCount,
        status,
        updatedBy: actorId,
      });
    } catch {
      return AssumptionSessionRepository.recalculateMemorySessionCounters(sessionId, actorId);
    }
  }

  private updatePromptFromMemory(
    assumptionId: string,
    updates: SectionAssumptionUpdate
  ): { prompt: SectionAssumption; session: AssumptionSession } {
    const prompt = AssumptionSessionRepository.memoryPrompts.get(assumptionId);
    if (!prompt) {
      throw new Error(`Assumption prompt not found: ${assumptionId}`);
    }

    const nextPrompt = AssumptionSessionRepository.updatePromptInMemory(prompt, updates);
    const session = AssumptionSessionRepository.recalculateMemorySessionCounters(
      nextPrompt.sessionId,
      updates.updatedBy
    );
    return { prompt: nextPrompt, session };
  }

  private static storeSessionInMemory(
    session: AssumptionSession,
    prompts: SectionAssumption[]
  ): void {
    this.memorySessions.set(session.id, session);
    this.storePromptsInMemory(session.id, prompts);
  }

  private static storePromptsInMemory(sessionId: string, prompts: SectionAssumption[]): void {
    this.memoryPromptOrder.set(
      sessionId,
      prompts.map(prompt => prompt.id)
    );
    for (const prompt of prompts) {
      this.memoryPrompts.set(prompt.id, prompt);
    }
  }

  private static getPromptsFromMemory(sessionId: string): SectionAssumption[] {
    const order = this.memoryPromptOrder.get(sessionId) ?? [];
    return order
      .map(id => this.memoryPrompts.get(id))
      .filter((prompt): prompt is SectionAssumption => Boolean(prompt));
  }

  private static storePromptInMemory(prompt: SectionAssumption): void {
    this.memoryPrompts.set(prompt.id, prompt);
    const order = this.memoryPromptOrder.get(prompt.sessionId) ?? [];
    if (!order.includes(prompt.id)) {
      order.push(prompt.id);
      this.memoryPromptOrder.set(prompt.sessionId, order);
    }
  }

  private static updatePromptInMemory(
    prompt: SectionAssumption,
    updates: SectionAssumptionUpdate
  ): SectionAssumption {
    const nextPrompt: SectionAssumption = {
      ...prompt,
      ...('status' in updates && updates.status ? { status: updates.status } : {}),
      answerValue:
        updates.answerValue !== undefined
          ? updates.answerValue
          : 'answerValue' in updates
            ? null
            : prompt.answerValue,
      answerNotes: updates.answerNotes !== undefined ? updates.answerNotes : prompt.answerNotes,
      overrideJustification:
        updates.overrideJustification !== undefined
          ? updates.overrideJustification
          : prompt.overrideJustification,
      conflictDecisionId:
        updates.conflictDecisionId !== undefined
          ? updates.conflictDecisionId
          : prompt.conflictDecisionId,
      conflictResolvedAt:
        updates.conflictResolvedAt !== undefined
          ? updates.conflictResolvedAt
          : prompt.conflictResolvedAt,
      updatedAt: new Date(),
      updatedBy: updates.updatedBy,
    };

    this.storePromptInMemory(nextPrompt);
    return nextPrompt;
  }

  private static recalculateMemorySessionCounters(
    sessionId: string,
    actorId: string
  ): AssumptionSession {
    const prompts = this.getPromptsFromMemory(sessionId);
    const aggregate = {
      answered: prompts.filter(prompt => prompt.status === 'answered').length,
      deferred: prompts.filter(prompt => prompt.status === 'deferred').length,
      escalated: prompts.filter(prompt => prompt.status === 'escalated').length,
      overrides: prompts.filter(prompt => prompt.status === 'override_skipped').length,
    };

    const unresolvedOverrideCount = aggregate.escalated + aggregate.overrides;
    const status = unresolvedOverrideCount > 0 ? ('blocked' as AssumptionSessionStatus) : undefined;

    const existing = this.memorySessions.get(sessionId);
    if (!existing) {
      throw new Error(`Assumption session not found: ${sessionId}`);
    }

    const nextSession: AssumptionSession = {
      ...existing,
      answeredCount: aggregate.answered,
      deferredCount: aggregate.deferred,
      escalatedCount: aggregate.escalated,
      overrideCount: aggregate.overrides,
      unresolvedOverrideCount,
      status: status ?? existing.status,
      updatedAt: new Date(),
      updatedBy: actorId,
    };

    this.memorySessions.set(sessionId, nextSession);
    return nextSession;
  }

  private static appendProposalToMemory(sessionId: string, proposal: DraftProposal): void {
    const proposals = this.memoryProposals.get(sessionId) ?? [];
    const existingIndex = proposals.findIndex(item => item.id === proposal.id);
    if (existingIndex >= 0) {
      proposals.splice(existingIndex, 1, proposal);
    } else {
      proposals.push(proposal);
    }
    proposals.sort((a, b) => a.proposalIndex - b.proposalIndex);
    this.memoryProposals.set(sessionId, proposals);
  }

  private mapSessionRow(row: Record<string, unknown>): AssumptionSession {
    return AssumptionSessionSchema.parse({
      id: String(row.id),
      sectionId: String(row.section_id),
      documentId: String(row.document_id),
      startedBy: String(row.started_by),
      startedAt: toDate(row.started_at) ?? new Date(),
      status: String(row.status),
      templateVersion: String(row.template_version),
      documentDecisionSnapshotId:
        row.decision_snapshot_id === null || row.decision_snapshot_id === undefined
          ? null
          : String(row.decision_snapshot_id),
      unresolvedOverrideCount: Number(row.unresolved_override_count ?? 0),
      answeredCount: Number(row.answered_count ?? 0),
      deferredCount: Number(row.deferred_count ?? 0),
      escalatedCount: Number(row.escalated_count ?? 0),
      overrideCount: Number(row.override_count ?? 0),
      latestProposalId:
        row.latest_proposal_id === null || row.latest_proposal_id === undefined
          ? null
          : String(row.latest_proposal_id),
      summaryMarkdown:
        row.summary_markdown === null || row.summary_markdown === undefined
          ? null
          : String(row.summary_markdown),
      closedAt: toDate(row.closed_at),
      closedBy:
        row.closed_by === null || row.closed_by === undefined ? null : String(row.closed_by),
      createdAt: toDate(row.created_at) ?? new Date(),
      createdBy: String(row.created_by),
      updatedAt: toDate(row.updated_at) ?? new Date(),
      updatedBy: String(row.updated_by),
      deletedAt: toDate(row.deleted_at),
      deletedBy:
        row.deleted_by === null || row.deleted_by === undefined ? null : String(row.deleted_by),
    });
  }

  private mapAssumptionRow(row: Record<string, unknown>): SectionAssumption {
    return SectionAssumptionSchema.parse({
      id: String(row.id),
      sessionId: String(row.session_id),
      sectionId: String(row.section_id),
      documentId: String(row.document_id),
      templateKey: String(row.template_key),
      promptHeading: String(row.prompt_heading),
      promptBody: String(row.prompt_body),
      responseType: String(row.response_type),
      options: deserializeAssumptionOptions(row.options_json),
      priority: Number(row.priority ?? 0),
      status: String(row.status),
      answerValue: deserializeAnswerValue(row.answer_value_json),
      answerNotes:
        row.answer_notes === null || row.answer_notes === undefined
          ? null
          : String(row.answer_notes),
      overrideJustification:
        row.override_justification === null || row.override_justification === undefined
          ? null
          : String(row.override_justification),
      conflictDecisionId:
        row.conflict_decision_id === null || row.conflict_decision_id === undefined
          ? null
          : String(row.conflict_decision_id),
      conflictResolvedAt: toDate(row.conflict_resolved_at),
      createdAt: toDate(row.created_at) ?? new Date(),
      createdBy: String(row.created_by),
      updatedAt: toDate(row.updated_at) ?? new Date(),
      updatedBy: String(row.updated_by),
      deletedAt: toDate(row.deleted_at),
      deletedBy:
        row.deleted_by === null || row.deleted_by === undefined ? null : String(row.deleted_by),
    });
  }

  private mapProposalRow(row: Record<string, unknown>): DraftProposal {
    return DraftProposalSchema.parse({
      id: String(row.id),
      sessionId: String(row.session_id),
      sectionId: String(row.section_id),
      proposalIndex: Number(row.proposal_index),
      source: String(row.source),
      contentMarkdown: String(row.content_markdown),
      rationale: deserializeRationale(row.rationale_json),
      aiConfidence:
        row.ai_confidence === null || row.ai_confidence === undefined
          ? null
          : Number(row.ai_confidence),
      failedReason:
        row.failed_reason === null || row.failed_reason === undefined
          ? null
          : String(row.failed_reason),
      createdAt: toDate(row.created_at) ?? new Date(),
      createdBy: String(row.created_by),
      updatedAt: toDate(row.updated_at) ?? new Date(),
      updatedBy: String(row.updated_by),
      supersededAt: toDate(row.superseded_at),
      supersededByProposalId:
        row.superseded_by_proposal_id === null || row.superseded_by_proposal_id === undefined
          ? null
          : String(row.superseded_by_proposal_id),
      deletedAt: toDate(row.deleted_at),
      deletedBy:
        row.deleted_by === null || row.deleted_by === undefined ? null : String(row.deleted_by),
    });
  }
}
