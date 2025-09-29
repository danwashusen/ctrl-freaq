import { randomUUID } from 'crypto';
import { performance } from 'node:perf_hooks';

import type { Logger } from 'pino';
import type {
  AssumptionOption,
  AssumptionSession,
  DraftProposal,
  DraftProposalCreateInput,
  DraftProposalRationale,
  SectionAssumption,
  SectionAssumptionUpdate,
} from '@ctrl-freaq/shared-data';
import { serializeAnswerValue, type CreateSessionWithPromptsInput } from '@ctrl-freaq/shared-data';

import { SectionEditorServiceError } from './section-editor.errors.js';

export interface StartAssumptionSessionInput {
  sectionId: string;
  documentId: string;
  templateVersion: string;
  startedBy: string;
  requestId?: string;
}

export interface AssumptionPromptState {
  id: string;
  heading: string;
  body: string;
  responseType: 'single_select' | 'multi_select' | 'text';
  options: AssumptionOption[];
  priority: number;
  status: 'pending' | 'answered' | 'deferred' | 'escalated' | 'override_skipped';
  answer: string | null;
  overrideJustification: string | null;
  unresolvedOverrideCount: number;
  escalation?: {
    assignedTo: string;
    status: 'pending' | 'resolved';
    notes?: string;
  };
}

export interface StartedAssumptionSession {
  sessionId: string;
  sectionId: string;
  prompts: AssumptionPromptState[];
  overridesOpen: number;
  summaryMarkdown: string | null;
  documentDecisionSnapshotId: string | null;
}

export interface RespondToAssumptionInput {
  assumptionId: string;
  action: 'answer' | 'defer' | 'escalate' | 'skip_override';
  actorId: string;
  answer?: string;
  notes?: string;
  overrideJustification?: string;
  requestId?: string;
}

export interface CreateProposalInput {
  sessionId: string;
  source: 'ai_generate' | 'manual_submit';
  actorId: string;
  draftOverride?: string;
  requestId?: string;
}

export interface CreatedProposal {
  proposalId: string;
  proposalIndex: number;
  contentMarkdown: string;
  rationale: Array<{ assumptionId: string; summary: string }>;
  overridesOpen: number;
}

export interface AssumptionPromptTemplate {
  id?: string;
  templateKey: string;
  heading: string;
  body: string;
  responseType: 'single_select' | 'multi_select' | 'text';
  options?: AssumptionOption[];
  priority?: number;
}

export interface AssumptionPromptProvider {
  getPrompts(input: {
    sectionId: string;
    documentId: string;
    templateVersion: string;
  }): Promise<AssumptionPromptTemplate[]>;
}

export interface TimeProvider {
  (): Date;
}

export interface DocumentDecision {
  id: string;
  templateKey: string;
  responseType: 'single_select' | 'multi_select' | 'text';
  allowedOptionIds?: string[];
  allowedAnswers?: string[];
  value?: string;
  status?: string;
}

export interface DocumentDecisionSnapshot {
  snapshotId: string;
  decisions: DocumentDecision[];
}

export interface DocumentDecisionProvider {
  getDecisionSnapshot(input: {
    documentId: string;
    sectionId: string;
  }): Promise<DocumentDecisionSnapshot | null>;
}

export interface AssumptionSessionRepositoryContract {
  createSessionWithPrompts(
    input: CreateSessionWithPromptsInput
  ): Promise<{ session: AssumptionSession; prompts: SectionAssumption[] }>;
  updatePrompt(
    assumptionId: string,
    updates: {
      status?: SectionAssumption['status'];
      answerValue?: string | string[] | null;
      answerNotes?: string | null;
      overrideJustification?: string | null;
      conflictDecisionId?: string | null;
      conflictResolvedAt?: Date | null;
      updatedBy: string;
    }
  ): Promise<{ prompt: SectionAssumption; session: AssumptionSession }>;
  getPromptWithSession(
    assumptionId: string
  ): Promise<{ prompt: SectionAssumption; session: AssumptionSession } | null>;
  listPrompts(sessionId: string): Promise<SectionAssumption[]>;
  getSessionWithPrompts(sessionId: string): Promise<{
    session: AssumptionSession;
    prompts: SectionAssumption[];
  }>;
  findById(sessionId: string): Promise<AssumptionSession | null>;
  updateSessionMetadata(
    sessionId: string,
    updates: {
      summaryMarkdown?: string | null;
      decisionSnapshotId?: string | null;
      updatedBy: string;
    }
  ): Promise<AssumptionSession>;
  createProposal(
    input: DraftProposalCreateInput
  ): Promise<{ proposal: DraftProposal; session: AssumptionSession }>;
  listProposals(sessionId: string): Promise<DraftProposal[]>;
}

export interface AssumptionSessionServiceDependencies {
  repository: AssumptionSessionRepositoryContract;
  logger: Logger;
  promptProvider?: AssumptionPromptProvider;
  timeProvider?: TimeProvider;
  decisionProvider?: DocumentDecisionProvider;
}

const DEFAULT_PROMPTS: AssumptionPromptTemplate[] = [
  {
    templateKey: 'assumptions.priority.security',
    heading: 'Confirm security baseline',
    body: 'Does this section introduce security changes requiring review?',
    responseType: 'single_select',
    options: [
      {
        id: 'yes-review',
        label: 'Yes, requires review',
        description: null,
        defaultSelected: false,
      },
      { id: 'no-changes', label: 'No security impact', description: null, defaultSelected: true },
    ],
    priority: 0,
  },
  {
    templateKey: 'assumptions.priority.dependencies',
    heading: 'List new dependencies',
    body: 'Identify any third-party services or libraries introduced in this draft.',
    responseType: 'text',
    options: [],
    priority: 1,
  },
  {
    templateKey: 'assumptions.priority.performance',
    heading: 'Validate performance targets',
    body: 'Confirm the latency and throughput assumptions for this section.',
    responseType: 'text',
    options: [],
    priority: 2,
  },
];

export class StaticPromptProvider implements AssumptionPromptProvider {
  async getPrompts(): Promise<AssumptionPromptTemplate[]> {
    return DEFAULT_PROMPTS;
  }
}

const DEFAULT_TIME_PROVIDER: TimeProvider = () => new Date();
const NULL_DECISION_PROVIDER: DocumentDecisionProvider = {
  async getDecisionSnapshot() {
    return null;
  },
};

export class AssumptionSessionService {
  private readonly repository: AssumptionSessionRepositoryContract;
  private readonly logger: Logger;
  private readonly promptProvider: AssumptionPromptProvider;
  private readonly now: TimeProvider;
  private readonly decisionProvider: DocumentDecisionProvider;

  constructor(deps: AssumptionSessionServiceDependencies) {
    this.repository = deps.repository;
    this.logger = deps.logger;
    this.promptProvider = deps.promptProvider ?? new StaticPromptProvider();
    this.now = deps.timeProvider ?? DEFAULT_TIME_PROVIDER;
    this.decisionProvider = deps.decisionProvider ?? NULL_DECISION_PROVIDER;
  }

  async startSession(input: StartAssumptionSessionInput): Promise<StartedAssumptionSession> {
    const requestId = input.requestId ?? 'unknown';
    const startTime = performance.now();
    const prompts = await this.promptProvider.getPrompts({
      sectionId: input.sectionId,
      documentId: input.documentId,
      templateVersion: input.templateVersion,
    });

    if (prompts.length === 0) {
      throw new SectionEditorServiceError('No assumption prompts available for this section', 400);
    }

    const startedAt = this.now();
    const decisionSnapshot = await this.decisionProvider.getDecisionSnapshot({
      documentId: input.documentId,
      sectionId: input.sectionId,
    });

    const createInput: CreateSessionWithPromptsInput = {
      sectionId: input.sectionId,
      documentId: input.documentId,
      templateVersion: input.templateVersion,
      startedBy: input.startedBy,
      startedAt,
      createdBy: input.startedBy,
      updatedBy: input.startedBy,
      summaryMarkdown: null,
      decisionSnapshotId: decisionSnapshot?.snapshotId ?? null,
      prompts: prompts.map((prompt, index) => ({
        id: prompt.id ?? randomUUID(),
        templateKey: prompt.templateKey,
        promptHeading: prompt.heading,
        promptBody: prompt.body,
        responseType: prompt.responseType,
        options: prompt.options ?? [],
        priority: prompt.priority ?? index,
        status: 'pending',
        answerValue: null,
        answerNotes: null,
        overrideJustification: null,
        conflictDecisionId: null,
        conflictResolvedAt: null,
        sectionId: input.sectionId,
        documentId: input.documentId,
        deletedAt: null,
        deletedBy: null,
      })),
    };

    const { session, prompts: persistedPrompts } =
      await this.repository.createSessionWithPrompts(createInput);

    const summaryMarkdown = this.buildSummaryMarkdownFromPrompts(persistedPrompts, session);

    const updatedSession = await this.repository.updateSessionMetadata(session.id, {
      summaryMarkdown,
      decisionSnapshotId:
        decisionSnapshot?.snapshotId ?? session.documentDecisionSnapshotId ?? null,
      updatedBy: input.startedBy,
    });

    this.logger.info(
      {
        requestId,
        sessionId: updatedSession.id,
        sectionId: updatedSession.sectionId,
        promptCount: persistedPrompts.length,
        action: 'session_started',
        overrideStatus: this.resolveOverrideStatus(updatedSession.unresolvedOverrideCount),
      },
      'Assumption session started'
    );

    this.logger.debug(
      {
        requestId,
        sessionId: updatedSession.id,
        promptIds: persistedPrompts.map(prompt => prompt.id),
      },
      'Assumption session prompts seeded'
    );

    const durationMs = performance.now() - startTime;
    this.recordLatencyEvent(
      'start_session',
      {
        requestId,
        sessionId: updatedSession.id,
        sectionId: updatedSession.sectionId,
        overridesOpen: updatedSession.unresolvedOverrideCount,
      },
      durationMs
    );

    return {
      sessionId: updatedSession.id,
      sectionId: updatedSession.sectionId,
      prompts: persistedPrompts.map(prompt => this.toPromptState(prompt, updatedSession)),
      overridesOpen: updatedSession.unresolvedOverrideCount,
      summaryMarkdown: updatedSession.summaryMarkdown,
      documentDecisionSnapshotId: updatedSession.documentDecisionSnapshotId ?? null,
    };
  }

  async respondToAssumption(input: RespondToAssumptionInput): Promise<AssumptionPromptState> {
    const strategy = this.resolvePromptStrategy(input);
    const requestId = input.requestId ?? 'unknown';
    const startTime = performance.now();
    const existing = await this.repository.getPromptWithSession(input.assumptionId);
    if (!existing) {
      throw new SectionEditorServiceError('Assumption prompt not found', 404);
    }

    const decisionGuard = await this.applyDecisionGuard({
      prompt: existing.prompt,
      session: existing.session,
      action: input.action,
      updates: strategy.updates,
      actorId: input.actorId,
    });

    const { prompt, session } = await this.repository.updatePrompt(input.assumptionId, {
      ...strategy.updates,
      ...decisionGuard.promptUpdates,
    });

    const prompts = await this.repository.listPrompts(session.id);
    const summaryMarkdown = this.buildSummaryMarkdownFromPrompts(prompts, session);
    const updatedSession = await this.repository.updateSessionMetadata(session.id, {
      summaryMarkdown,
      decisionSnapshotId:
        decisionGuard.decisionSnapshotId ?? session.documentDecisionSnapshotId ?? null,
      updatedBy: input.actorId,
    });

    this.logger.info(
      {
        requestId,
        sessionId: updatedSession.id,
        assumptionId: prompt.id,
        action: input.action,
        status: prompt.status,
        overridesOpen: updatedSession.unresolvedOverrideCount,
        overrideStatus: this.resolveOverrideStatus(updatedSession.unresolvedOverrideCount),
      },
      'Assumption prompt updated'
    );

    if (input.action === 'skip_override') {
      this.logger.info(
        {
          event: 'assumption_override.recorded',
          requestId,
          sessionId: updatedSession.id,
          assumptionId: prompt.id,
          overridesOpen: updatedSession.unresolvedOverrideCount,
          overrideJustification: prompt.overrideJustification,
        },
        'Assumption override recorded'
      );
    }

    const durationMs = performance.now() - startTime;
    this.recordLatencyEvent(
      'respond_to_prompt',
      {
        requestId,
        sessionId: updatedSession.id,
        sectionId: updatedSession.sectionId,
        overridesOpen: updatedSession.unresolvedOverrideCount,
      },
      durationMs
    );

    const state = this.toPromptState(prompt, updatedSession);
    if (strategy.escalation) {
      state.escalation = strategy.escalation;
    }
    return state;
  }

  async createProposal(input: CreateProposalInput): Promise<CreatedProposal> {
    const requestId = input.requestId ?? 'unknown';
    const startTime = performance.now();
    const session = await this.repository.findById(input.sessionId);
    if (!session) {
      throw new SectionEditorServiceError('Assumption session not found', 404);
    }

    if (session.unresolvedOverrideCount > 0) {
      throw new SectionEditorServiceError('Resolve overrides before generating proposals', 409, {
        status: 'overrides_block_submission',
        overridesOpen: session.unresolvedOverrideCount,
      });
    }

    const prompts = await this.repository.listPrompts(input.sessionId);
    const rationale = this.buildProposalRationale(prompts);

    const contentMarkdown =
      input.source === 'ai_generate'
        ? this.generateAIDraftContent(prompts)
        : input.draftOverride || this.generateManualDraftSkeleton(prompts);

    const { proposal, session: updatedSession } = await this.repository.createProposal({
      sessionId: input.sessionId,
      sectionId: session.sectionId,
      source: input.source === 'ai_generate' ? 'ai_generated' : 'manual_revision',
      contentMarkdown,
      rationale,
      aiConfidence: input.source === 'ai_generate' ? 0.72 : null,
      failedReason: null,
      createdBy: input.actorId,
      updatedBy: input.actorId,
    });

    this.logger.info(
      {
        requestId,
        sessionId: session.id,
        proposalId: proposal.id,
        proposalIndex: proposal.proposalIndex,
        action: 'proposal_created',
        overrideStatus: this.resolveOverrideStatus(updatedSession.unresolvedOverrideCount),
      },
      'Assumption session proposal created'
    );

    this.logger.info(
      {
        event: 'draft_proposal.generated',
        requestId,
        sessionId: session.id,
        sectionId: session.sectionId,
        proposalId: proposal.id,
        source: proposal.source,
        overridesOpen: updatedSession.unresolvedOverrideCount,
      },
      'Draft proposal generated from assumption session'
    );

    this.logger.info(
      {
        event: 'assumption_session.completed',
        requestId,
        sessionId: session.id,
        sectionId: session.sectionId,
        proposalId: proposal.id,
        overridesOpen: updatedSession.unresolvedOverrideCount,
      },
      'Assumption session completed'
    );

    const durationMs = performance.now() - startTime;
    this.recordLatencyEvent(
      'create_proposal',
      {
        requestId,
        sessionId: session.id,
        sectionId: session.sectionId,
        overridesOpen: updatedSession.unresolvedOverrideCount,
      },
      durationMs
    );

    return {
      proposalId: proposal.id,
      proposalIndex: proposal.proposalIndex,
      contentMarkdown: proposal.contentMarkdown,
      rationale: proposal.rationale,
      overridesOpen: updatedSession.unresolvedOverrideCount,
    };
  }

  private recordLatencyEvent(
    action: 'start_session' | 'respond_to_prompt' | 'create_proposal',
    context: {
      requestId: string;
      sessionId: string;
      sectionId: string;
      overridesOpen: number;
    },
    durationMs: number
  ): void {
    this.logger.info(
      {
        event: 'assumption_session.latency_ms',
        action,
        requestId: context.requestId,
        sessionId: context.sessionId,
        sectionId: context.sectionId,
        overrideStatus: this.resolveOverrideStatus(context.overridesOpen),
        value: durationMs,
      },
      'Assumption session latency recorded'
    );
  }

  private resolveOverrideStatus(overridesOpen: number): 'overrides_open' | 'clear' {
    return overridesOpen > 0 ? 'overrides_open' : 'clear';
  }

  async listProposals(sessionId: string): Promise<CreatedProposal[]> {
    const proposals = await this.repository.listProposals(sessionId);
    return proposals.map(proposal => ({
      proposalId: proposal.id,
      proposalIndex: proposal.proposalIndex,
      contentMarkdown: proposal.contentMarkdown,
      rationale: proposal.rationale,
      overridesOpen: 0,
    }));
  }

  private toPromptState(
    prompt: SectionAssumption,
    session: AssumptionSession
  ): AssumptionPromptState {
    return {
      id: prompt.id,
      heading: prompt.promptHeading,
      body: prompt.promptBody,
      responseType: prompt.responseType,
      options: prompt.options,
      priority: prompt.priority,
      status: prompt.status,
      answer: serializeAnswerValue(prompt.answerValue ?? null),
      overrideJustification: prompt.overrideJustification,
      unresolvedOverrideCount: session.unresolvedOverrideCount,
    };
  }

  private resolvePromptStrategy(input: RespondToAssumptionInput): {
    updates: {
      status?: SectionAssumption['status'];
      answerValue?: string | string[] | null;
      answerNotes?: string | null;
      overrideJustification?: string | null;
      updatedBy: string;
    };
    escalation?: AssumptionPromptState['escalation'];
  } {
    const baseUpdates = { updatedBy: input.actorId } satisfies {
      updatedBy: string;
    };

    switch (input.action) {
      case 'answer': {
        if (!input.answer) {
          throw new SectionEditorServiceError('Answer is required when action=answer', 400);
        }
        return {
          updates: {
            ...baseUpdates,
            status: 'answered',
            answerValue: input.answer,
            answerNotes: input.notes ?? null,
            overrideJustification: null,
          },
        };
      }

      case 'defer': {
        return {
          updates: {
            ...baseUpdates,
            status: 'deferred',
            answerValue: null,
            answerNotes: input.notes ?? null,
            overrideJustification: null,
          },
        };
      }

      case 'escalate': {
        const assignedTo = `assumption-escalation-${randomUUID().slice(0, 8)}`;
        return {
          updates: {
            ...baseUpdates,
            status: 'escalated',
            answerValue: null,
            answerNotes: input.notes ?? null,
            overrideJustification: null,
          },
          escalation: {
            assignedTo,
            status: 'pending',
            notes: input.notes ?? undefined,
          },
        };
      }

      case 'skip_override': {
        if (!input.overrideJustification) {
          throw new SectionEditorServiceError('overrideJustification is required to skip', 400);
        }
        return {
          updates: {
            ...baseUpdates,
            status: 'override_skipped',
            answerValue: null,
            answerNotes: input.notes ?? null,
            overrideJustification: input.overrideJustification,
          },
        };
      }

      default: {
        throw new SectionEditorServiceError(`Unsupported action: ${input.action}`, 400);
      }
    }
  }

  private async applyDecisionGuard(params: {
    prompt: SectionAssumption;
    session: AssumptionSession;
    action: RespondToAssumptionInput['action'];
    updates: SectionAssumptionUpdate;
    actorId: string;
  }): Promise<{
    promptUpdates: Pick<SectionAssumptionUpdate, 'conflictDecisionId' | 'conflictResolvedAt'>;
    decisionSnapshotId: string | null;
  }> {
    const { prompt, session, action, updates, actorId } = params;
    const promptUpdates: Pick<
      SectionAssumptionUpdate,
      'conflictDecisionId' | 'conflictResolvedAt'
    > = {};

    let decisionSnapshot: DocumentDecisionSnapshot | null = null;
    try {
      decisionSnapshot = await this.decisionProvider.getDecisionSnapshot({
        documentId: session.documentId,
        sectionId: session.sectionId,
      });
    } catch (error) {
      this.logger.warn(
        {
          sessionId: session.id,
          assumptionId: prompt.id,
          error: error instanceof Error ? error.message : error,
        },
        'Failed to load document decision snapshot; continuing without enforcement'
      );
    }

    const decision = decisionSnapshot?.decisions.find(
      candidate => candidate.templateKey === prompt.templateKey
    );
    const decisionSnapshotId =
      decisionSnapshot?.snapshotId ?? session.documentDecisionSnapshotId ?? null;

    if (!decision) {
      if (action === 'answer') {
        promptUpdates.conflictDecisionId = null;
        promptUpdates.conflictResolvedAt = new Date();
      }
      return { promptUpdates, decisionSnapshotId };
    }

    switch (action) {
      case 'answer': {
        const answers = this.normaliseAnswerForDecision(updates, prompt);
        if (!this.isDecisionAligned(answers, prompt, decision)) {
          const detail = decision.value
            ? `Expected alignment with "${decision.value}"`
            : 'Answer must align with documented decision';
          throw new SectionEditorServiceError(
            `Response conflicts with document decision ${decision.id}`,
            409,
            {
              status: 'decision_conflict',
              decisionId: decision.id,
              message: detail,
            }
          );
        }

        promptUpdates.conflictDecisionId = null;
        promptUpdates.conflictResolvedAt = new Date();
        break;
      }

      case 'skip_override': {
        const detail =
          decision.value && decision.status
            ? `Cannot override decision ${decision.id} (${decision.status}): ${decision.value}`
            : `Cannot override documented decision ${decision.id}`;
        throw new SectionEditorServiceError(
          'Document decision prevents skipping this assumption',
          409,
          {
            status: 'decision_conflict',
            decisionId: decision.id,
            message: detail,
          }
        );
      }

      case 'escalate': {
        promptUpdates.conflictDecisionId = decision.id;
        promptUpdates.conflictResolvedAt = null;
        break;
      }

      case 'defer': {
        promptUpdates.conflictDecisionId = decision.id;
        promptUpdates.conflictResolvedAt = null;
        break;
      }

      default: {
        promptUpdates.conflictDecisionId = decision.id;
        promptUpdates.conflictResolvedAt = null;
      }
    }

    this.logger.debug(
      {
        sessionId: session.id,
        assumptionId: prompt.id,
        action,
        decisionId: decision.id,
        updatedBy: actorId,
      },
      'Document decision enforcement applied to assumption response'
    );

    return { promptUpdates, decisionSnapshotId };
  }

  private resolvePromptAnswerText(prompt: SectionAssumption): string | null {
    const options = prompt.options ?? [];
    const { answerValue } = prompt;

    if (Array.isArray(answerValue)) {
      const labels = answerValue
        .map(value => {
          const optionLabel = options.find(option => option.id === value)?.label;
          const fallback = typeof value === 'string' ? value.trim() : '';
          return optionLabel?.trim() || fallback;
        })
        .filter(label => Boolean(label));
      return labels.length > 0 ? labels.join(', ') : null;
    }

    if (typeof answerValue === 'string') {
      const trimmed = answerValue.trim();
      if (!trimmed) {
        return null;
      }

      const matchedOption = options.find(
        option => option.id === trimmed || option.label === trimmed
      );
      return matchedOption ? matchedOption.label : trimmed;
    }

    return null;
  }

  private normaliseAnswerForDecision(
    updates: SectionAssumptionUpdate,
    prompt: SectionAssumption
  ): Array<{ raw: string; canonical: string }> {
    const value =
      updates.answerValue !== undefined ? updates.answerValue : (prompt.answerValue ?? null);

    if (value === null || value === undefined) {
      return [];
    }

    const extractStrings = (candidate: unknown): string[] => {
      if (Array.isArray(candidate)) {
        return candidate
          .map(item => (typeof item === 'string' ? item : String(item ?? '')).trim())
          .filter(Boolean);
      }

      if (typeof candidate === 'string') {
        const trimmed = candidate.trim();
        if (!trimmed) {
          return [];
        }

        if (trimmed.startsWith('[')) {
          try {
            const parsed = JSON.parse(trimmed) as unknown;
            return extractStrings(parsed);
          } catch {
            return [trimmed];
          }
        }

        if (prompt.responseType === 'multi_select') {
          try {
            const parsed = JSON.parse(trimmed) as unknown;
            return extractStrings(parsed);
          } catch {
            // Fall back to treating the raw string as a single selection
          }
        }

        return [trimmed];
      }

      return [String(candidate ?? '').trim()].filter(Boolean);
    };

    const values = extractStrings(value);

    return values.map(item => ({ raw: item, canonical: item.toLowerCase() }));
  }

  private isDecisionAligned(
    answers: Array<{ raw: string; canonical: string }>,
    prompt: SectionAssumption,
    decision: DocumentDecision
  ): boolean {
    if (answers.length === 0) {
      return false;
    }

    const allowedOptionIds = new Set(
      (decision.allowedOptionIds ?? []).map(candidate => candidate.trim().toLowerCase())
    );
    const allowedAnswers = new Set(
      [...(decision.allowedAnswers ?? []), decision.value ?? '']
        .filter(Boolean)
        .map(candidate => candidate.trim().toLowerCase())
    );

    if (allowedOptionIds.size === 0 && allowedAnswers.size === 0) {
      // No enforcement data available; treat as aligned
      return true;
    }

    const optionIdLookup = new Map<string, { id: string; label: string }>();
    for (const option of prompt.options ?? []) {
      const idKey = option.id.trim().toLowerCase();
      optionIdLookup.set(idKey, { id: option.id, label: option.label.trim().toLowerCase() });
      optionIdLookup.set(option.label.trim().toLowerCase(), {
        id: option.id.trim().toLowerCase(),
        label: option.label.trim().toLowerCase(),
      });
    }

    const mapAnswerToOption = (answer: { canonical: string; raw: string }) => {
      const matched = optionIdLookup.get(answer.canonical);
      if (matched) {
        return {
          optionId: matched.id.trim().toLowerCase(),
          label: matched.label,
        };
      }
      return {
        optionId: answer.canonical,
        label: answer.canonical,
      };
    };

    if (prompt.responseType === 'multi_select') {
      return answers.every(answer => {
        const mapped = mapAnswerToOption(answer);
        if (allowedOptionIds.size > 0 && allowedOptionIds.has(mapped.optionId)) {
          return true;
        }
        if (allowedAnswers.size > 0 && allowedAnswers.has(mapped.label)) {
          return true;
        }
        if (allowedAnswers.size > 0 && allowedAnswers.has(answer.canonical)) {
          return true;
        }
        return false;
      });
    }

    if (answers.length !== 1) {
      return false;
    }

    const [answer] = answers;
    if (!answer) {
      return false;
    }
    const mapped = mapAnswerToOption(answer);

    if (prompt.responseType === 'single_select') {
      if (allowedOptionIds.size === 0 && allowedAnswers.size === 0) {
        return true;
      }

      if (allowedOptionIds.has(mapped.optionId)) {
        return true;
      }

      if (allowedAnswers.has(mapped.label) || allowedAnswers.has(answer.canonical)) {
        return true;
      }

      return false;
    }

    // Text prompts
    if (allowedAnswers.size === 0) {
      return true;
    }

    return allowedAnswers.has(mapped.label) || allowedAnswers.has(answer.canonical);
  }

  private buildSummaryMarkdownFromPrompts(
    prompts: SectionAssumption[],
    session: AssumptionSession
  ): string {
    const sortedPrompts = [...prompts].sort((a, b) => a.priority - b.priority);
    const lines: string[] = ['## Assumption Summary'];

    lines.push('');
    lines.push(`- Session status: ${session.status}`);
    lines.push(`- Overrides open: ${session.unresolvedOverrideCount}`);
    lines.push(`- Escalations: ${session.escalatedCount}`);
    lines.push(`- Deferred prompts: ${session.deferredCount}`);
    lines.push(`- Answered prompts: ${session.answeredCount}`);

    const outstanding: string[] = [];
    if (session.unresolvedOverrideCount > 0) {
      outstanding.push(`- Resolve ${session.unresolvedOverrideCount} override(s) before drafting`);
    }
    if (session.escalatedCount > 0) {
      outstanding.push(`- ${session.escalatedCount} escalation(s) awaiting response`);
    }
    if (session.deferredCount > 0) {
      outstanding.push(`- ${session.deferredCount} deferred prompt(s) pending follow-up`);
    }

    lines.push('');
    lines.push('### Outstanding Items');
    if (outstanding.length === 0) {
      lines.push('- All prompts reconciled.');
    } else {
      lines.push(...outstanding);
    }

    lines.push('');
    lines.push('### Prompts');
    for (const prompt of sortedPrompts) {
      const answerText = this.resolvePromptAnswerText(prompt);
      lines.push(`- **${prompt.promptHeading}**`);
      lines.push(`  - Status: ${this.formatPromptStatus(prompt.status)}`);
      lines.push(`  - Answer: ${answerText ?? 'Not provided'}`);

      if (prompt.answerNotes) {
        lines.push(`  - Notes: ${prompt.answerNotes}`);
      }

      if (prompt.overrideJustification) {
        lines.push(`  - Override: ${prompt.overrideJustification}`);
      } else if (prompt.status === 'override_skipped') {
        lines.push('  - Override: recorded without justification');
      }

      if (prompt.status === 'escalated') {
        lines.push('  - Escalation: awaiting stakeholder response');
      }

      if (prompt.status === 'deferred') {
        lines.push('  - Deferred: revisit before generating drafts');
      }

      if (prompt.conflictDecisionId) {
        lines.push(`  - Conflict: linked decision ${prompt.conflictDecisionId}`);
      }
    }

    return lines.join('\n');
  }

  private formatPromptStatus(status: SectionAssumption['status']): string {
    switch (status) {
      case 'answered':
        return 'Answered';
      case 'deferred':
        return 'Deferred';
      case 'escalated':
        return 'Escalated';
      case 'override_skipped':
        return 'Override recorded';
      default:
        return 'Pending';
    }
  }

  private buildProposalRationale(prompts: SectionAssumption[]): DraftProposalRationale[] {
    return prompts.map(prompt => {
      const answerText = this.resolvePromptAnswerText(prompt);
      const summaryDetail =
        answerText ??
        (prompt.overrideJustification
          ? `Override noted: ${prompt.overrideJustification}`
          : prompt.status === 'override_skipped'
            ? 'Override recorded'
            : prompt.status);

      return {
        assumptionId: prompt.id,
        summary: `${prompt.promptHeading}: ${summaryDetail}`,
      } satisfies DraftProposalRationale;
    });
  }

  private generateAIDraftContent(prompts: SectionAssumption[]): string {
    const lines = prompts.map(prompt => {
      const answerText = this.resolvePromptAnswerText(prompt);
      let response = answerText;

      if (!response) {
        response = prompt.overrideJustification
          ? `Override noted: ${prompt.overrideJustification}`
          : prompt.status === 'override_skipped'
            ? 'Override recorded'
            : 'Pending resolution';
      }

      return `- **${prompt.promptHeading}**: ${response}`;
    });

    return ['## AI Draft Proposal', ...lines].join('\n');
  }

  private generateManualDraftSkeleton(prompts: SectionAssumption[]): string {
    const bullets = prompts.map(prompt => `- ${prompt.promptHeading}`);
    return ['## Manual Draft Notes', ...bullets].join('\n');
  }
}
