import { randomUUID } from 'crypto';
import { performance } from 'node:perf_hooks';

import type { Logger } from 'pino';
import type {
  AssumptionOption,
  AssumptionSession,
  DocumentRepositoryImpl,
  DraftProposal,
  DraftProposalCreateInput,
  DraftProposalRationale,
  SectionAssumption,
  SectionAssumptionUpdate,
} from '@ctrl-freaq/shared-data';
import {
  serializeAnswerValue,
  createStreamingProgressEvent,
  type CreateSessionWithPromptsInput,
  type StreamingProgressEvent,
  type StreamingDeltaType,
  type StreamingAnnouncementPriority,
} from '@ctrl-freaq/shared-data';
import {
  createSectionStreamQueue,
  type QueueCancellationReason,
  type SectionStreamQueue,
} from '@ctrl-freaq/editor-core/streaming/section-stream-queue.js';
import type { TemplateResolver } from '@ctrl-freaq/template-resolver';

import { SectionEditorServiceError } from './section-editor.errors.js';
import { DEFAULT_ARCHITECTURE_TEMPLATE_ID } from '../../../services/template/constants.js';

export interface StartAssumptionSessionInput {
  sectionId: string;
  documentId: string;
  templateVersion?: string;
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

export interface AssumptionStreamingProgressEvent {
  type: 'progress';
  sequence?: number;
  stageLabel: string;
  contentSnippet?: string | null;
  deltaType?: StreamingDeltaType;
  announcementPriority?: StreamingAnnouncementPriority;
  elapsedMs?: number;
}

export interface AssumptionStreamingStatusEvent {
  type: 'status';
  status: 'queued' | 'streaming' | 'deferred' | 'resumed' | 'completed' | 'canceled' | 'error';
  reason?: string;
}

export type AssumptionStreamingEvent =
  | AssumptionStreamingProgressEvent
  | AssumptionStreamingStatusEvent;

export interface AssumptionStreamingProvider {
  generateEvents(input: {
    sessionId: string;
    prompt: SectionAssumption;
    action: RespondToAssumptionInput['action'];
    updates: SectionAssumptionUpdate;
    getNextSequence: () => number;
    timestamp: Date;
  }): Promise<AssumptionStreamingEvent[]>;
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
  documentRepository: DocumentRepositoryImpl;
  templateResolver: TemplateResolver;
  promptProvider?: AssumptionPromptProvider;
  timeProvider?: TimeProvider;
  decisionProvider?: DocumentDecisionProvider;
  queue?: SectionStreamQueue;
  streaming?: {
    provider?: AssumptionStreamingProvider;
  };
}

interface TemplateBindingResolution {
  templateId: string;
  version: string;
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

type AssumptionStreamPayload = { type: string; data: unknown };

type QueueSessionState = {
  sectionId: string;
  status: 'active' | 'pending';
  buffered: AssumptionStreamPayload[];
  concurrencySlot?: number;
};

const isAssumptionStatus = (value: string): value is AssumptionStreamingStatusEvent['status'] => {
  return (
    value === 'queued' ||
    value === 'streaming' ||
    value === 'deferred' ||
    value === 'resumed' ||
    value === 'completed' ||
    value === 'canceled' ||
    value === 'error'
  );
};

class AssumptionStreamController implements AsyncIterable<AssumptionStreamPayload> {
  private readonly bufferedProgress = new Map<number, StreamingProgressEvent>();
  private eventQueue: AssumptionStreamPayload[] = [];
  private pendingResolvers: Array<(result: IteratorResult<AssumptionStreamPayload>) => void> = [];
  private pendingRejecters: Array<(error: unknown) => void> = [];
  private closed = false;
  private failure: unknown = null;
  private expectedSequence = 0;

  emitProgress(event: StreamingProgressEvent): void {
    if (this.closed || this.failure) {
      return;
    }

    if (event.sequence <= this.expectedSequence) {
      return;
    }

    if (event.sequence === this.expectedSequence + 1) {
      this.expectedSequence = event.sequence;
      this.push({ type: 'progress', data: event });
      this.flushBuffered();
      return;
    }

    this.bufferedProgress.set(event.sequence, event);
  }

  emitStatus(
    status: AssumptionStreamingStatusEvent['status'],
    metadata: Record<string, unknown> = {}
  ): void {
    if (this.closed || this.failure) {
      return;
    }

    this.push({
      type: 'status',
      data: {
        status,
        ...metadata,
      },
    });
  }

  emitTelemetry(payload: Record<string, unknown>): void {
    if (this.closed || this.failure) {
      return;
    }

    this.push({
      type: 'telemetry',
      data: payload,
    });
  }

  emitReplacement(replacedSessionId: string, timestamp: string): void {
    if (this.closed || this.failure) {
      return;
    }

    this.push({
      type: 'replacement',
      data: {
        replacedSessionId,
        timestamp,
      },
    });
  }

  complete(
    status: 'completed' | 'canceled' | 'error',
    metadata: Record<string, unknown> = {}
  ): void {
    if (this.closed) {
      return;
    }

    if (status !== 'completed') {
      this.emitStatus(status, metadata);
    }

    this.closed = true;

    for (const resolve of this.pendingResolvers.splice(0)) {
      resolve({ value: undefined, done: true });
    }

    this.pendingRejecters.splice(0);
    this.eventQueue = [];
  }

  fail(error: unknown): void {
    if (this.failure || this.closed) {
      return;
    }

    this.failure = error;

    for (const reject of this.pendingRejecters.splice(0)) {
      reject(error);
    }

    for (const resolve of this.pendingResolvers.splice(0)) {
      resolve({ value: undefined, done: true });
    }

    this.eventQueue = [];
  }

  [Symbol.asyncIterator](): AsyncIterator<AssumptionStreamPayload> {
    return {
      next: () => this.next(),
    };
  }

  private async next(): Promise<IteratorResult<AssumptionStreamPayload>> {
    if (this.failure) {
      throw this.failure;
    }

    if (this.eventQueue.length > 0) {
      const value = this.eventQueue.shift();
      if (value !== undefined) {
        return { value, done: false };
      }
    }

    if (this.closed) {
      return { value: undefined, done: true };
    }

    return await new Promise<IteratorResult<AssumptionStreamPayload>>((resolve, reject) => {
      this.pendingResolvers.push(resolve);
      this.pendingRejecters.push(reject);
    });
  }

  private push(event: AssumptionStreamPayload): void {
    if (this.failure || this.closed) {
      return;
    }

    const resolver = this.pendingResolvers.shift();
    if (resolver) {
      this.pendingRejecters.shift();
      resolver({ value: event, done: false });
      return;
    }

    this.eventQueue.push(event);
  }

  private flushBuffered(): void {
    while (this.bufferedProgress.size > 0) {
      const nextSequence = this.expectedSequence + 1;
      const nextEvent = this.bufferedProgress.get(nextSequence);
      if (!nextEvent) {
        break;
      }

      this.bufferedProgress.delete(nextSequence);
      this.expectedSequence = nextEvent.sequence;
      this.push({ type: 'progress', data: nextEvent });
    }
  }
}

class DefaultAssumptionStreamingProvider implements AssumptionStreamingProvider {
  async generateEvents(input: Parameters<AssumptionStreamingProvider['generateEvents']>[0]) {
    if (input.action === 'defer') {
      return [
        {
          type: 'status' as const,
          status: 'deferred' as const,
        },
      ];
    }

    if (input.action === 'answer') {
      const summarySequence = input.getNextSequence();
      const analysisSequence = input.getNextSequence();

      return [
        {
          type: 'status' as const,
          status: 'resumed' as const,
        },
        {
          type: 'progress' as const,
          sequence: summarySequence,
          stageLabel: 'assumptions.progress.summary',
          contentSnippet: `Summary for ${input.prompt.promptHeading}`,
          deltaType: 'text' as const,
          announcementPriority: 'polite' as const,
          elapsedMs: 60,
        },
        {
          type: 'progress' as const,
          sequence: analysisSequence,
          stageLabel: 'assumptions.progress.analysis',
          contentSnippet: `Resolved: ${input.prompt.promptHeading}`,
          deltaType: 'text' as const,
          announcementPriority: 'polite' as const,
          elapsedMs: 120,
        },
      ];
    }

    return [];
  }
}

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
  private readonly documents: DocumentRepositoryImpl;
  private readonly templateResolver: TemplateResolver;
  private readonly promptProvider: AssumptionPromptProvider;
  private readonly now: TimeProvider;
  private readonly decisionProvider: DocumentDecisionProvider;
  private readonly streamingProvider: AssumptionStreamingProvider;
  private readonly queue: SectionStreamQueue;
  private readonly streams = new Map<string, AssumptionStreamController>();
  private readonly sequenceCounters = new Map<string, number>();
  private readonly deferredSessions = new Set<string>();
  private readonly queueStates = new Map<string, QueueSessionState>();

  constructor(deps: AssumptionSessionServiceDependencies) {
    this.repository = deps.repository;
    this.logger = deps.logger;
    this.documents = deps.documentRepository;
    this.templateResolver = deps.templateResolver;
    this.promptProvider = deps.promptProvider ?? new StaticPromptProvider();
    this.now = deps.timeProvider ?? DEFAULT_TIME_PROVIDER;
    this.decisionProvider = deps.decisionProvider ?? NULL_DECISION_PROVIDER;
    this.streamingProvider = deps.streaming?.provider ?? new DefaultAssumptionStreamingProvider();
    this.queue = deps.queue ?? createSectionStreamQueue();
  }

  private bumpSequence(sessionId: string): number {
    const next = (this.sequenceCounters.get(sessionId) ?? 0) + 1;
    this.sequenceCounters.set(sessionId, next);
    return next;
  }

  async startSession(input: StartAssumptionSessionInput): Promise<StartedAssumptionSession> {
    const requestId = input.requestId ?? 'unknown';
    const startTime = performance.now();
    const templateBinding = await this.resolveTemplateBinding({
      documentId: input.documentId,
      requestedVersion: input.templateVersion,
      requestId,
    });
    const prompts = await this.promptProvider.getPrompts({
      sectionId: input.sectionId,
      documentId: input.documentId,
      templateVersion: templateBinding.version,
    });

    if (prompts.length === 0) {
      throw new SectionEditorServiceError('No assumption prompts available for this section', 400);
    }

    const startedAt = this.now();
    const decisionSnapshot = await this.decisionProvider.getDecisionSnapshot({
      documentId: input.documentId,
      sectionId: input.sectionId,
    });

    const sessionId = `${input.sectionId}-assumption-session-${randomUUID()}`;

    const createInput: CreateSessionWithPromptsInput = {
      sessionId,
      sectionId: input.sectionId,
      documentId: input.documentId,
      templateVersion: templateBinding.version,
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
        templateId: templateBinding.templateId,
        templateVersion: templateBinding.version,
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

    await this.dispatchStreamingEvents({
      session: updatedSession,
      prompt,
      action: input.action,
      updates: strategy.updates,
      requestId,
    });

    const state = this.toPromptState(prompt, updatedSession);
    if (strategy.escalation) {
      state.escalation = strategy.escalation;
    }
    return state;
  }

  async openStreamingSession(input: {
    sessionId: string;
    sectionId: string;
    requestId: string;
    actorId: string;
  }): Promise<{
    disposition: 'started' | 'pending';
    replacedSessionId: string | null;
    stream: AsyncIterable<{ type: string; data: unknown }>;
  }> {
    let stream = this.streams.get(input.sessionId);
    if (!stream) {
      stream = new AssumptionStreamController();
      this.streams.set(input.sessionId, stream);
      if (!this.sequenceCounters.has(input.sessionId)) {
        this.sequenceCounters.set(input.sessionId, 0);
      }
    }

    const enqueuedAt = this.now().getTime();
    const queueResult = this.queue.enqueue({
      sessionId: input.sessionId,
      sectionId: input.sectionId,
      enqueuedAt,
    });

    const queueState: QueueSessionState = {
      sectionId: input.sectionId,
      status: queueResult.disposition === 'started' ? 'active' : 'pending',
      buffered: [],
      concurrencySlot:
        queueResult.disposition === 'started' ? queueResult.concurrencySlot : undefined,
    };

    this.queueStates.set(input.sessionId, queueState);

    this.logger.info(
      {
        requestId: input.requestId,
        sessionId: input.sessionId,
        sectionId: input.sectionId,
        actorId: input.actorId,
        queueDisposition: queueResult.disposition,
        concurrencySlot: queueState.concurrencySlot,
        replacedSessionId:
          queueResult.disposition === 'pending' ? (queueResult.replacedSessionId ?? null) : null,
      },
      'Assumption streaming session opened'
    );

    if (queueResult.disposition === 'started') {
      stream.emitStatus('streaming', {
        timestamp: this.now().toISOString(),
        concurrencySlot: queueState.concurrencySlot ?? null,
      });
    }

    return {
      disposition: queueResult.disposition,
      replacedSessionId:
        queueResult.disposition === 'pending' ? (queueResult.replacedSessionId ?? null) : null,
      stream,
    };
  }

  async completeStreamingSession(input: {
    sessionId: string;
    sectionId: string;
    reason: 'client_close' | 'canceled' | 'error';
  }): Promise<void> {
    const stream = this.streams.get(input.sessionId);
    const timestamp = this.now().toISOString();

    if (stream) {
      const status = input.reason === 'client_close' ? 'completed' : input.reason;
      stream.complete(status, { timestamp });
    }

    this.streams.delete(input.sessionId);
    this.sequenceCounters.delete(input.sessionId);
    this.deferredSessions.delete(input.sessionId);

    const state = this.queueStates.get(input.sessionId);
    this.queueStates.delete(input.sessionId);

    if (input.reason === 'client_close') {
      const completion = this.queue.complete(input.sessionId);
      if (completion?.activated) {
        this.activateQueuePromotion(completion.activated);
      }
    } else {
      const cancelResult = this.queue.cancel(
        input.sessionId,
        this.mapQueueCancellationReason(input.reason)
      );
      if (cancelResult.promoted) {
        this.activateQueuePromotion(cancelResult.promoted);
      }
    }

    this.logger.info(
      {
        sessionId: input.sessionId,
        sectionId: input.sectionId,
        reason: input.reason,
        timestamp,
        queueState: state?.status ?? 'unknown',
      },
      'Assumption streaming session closed'
    );
  }

  private async dispatchStreamingEvents(params: {
    session: AssumptionSession;
    prompt: SectionAssumption;
    action: RespondToAssumptionInput['action'];
    updates: SectionAssumptionUpdate;
    requestId: string;
  }): Promise<void> {
    const timestamp = this.now();
    const isoTimestamp = timestamp.toISOString();
    const sessionId = params.session.id;

    if (params.action === 'defer') {
      this.publishOrBuffer(sessionId, {
        type: 'status',
        data: { status: 'deferred', timestamp: isoTimestamp },
      });
      this.deferredSessions.add(sessionId);
      this.logger.info(
        {
          event: 'assumptions.streaming.status',
          sessionId,
          sectionId: params.session.sectionId,
          assumptionId: params.prompt.id,
          status: 'deferred',
          requestId: params.requestId,
        },
        'Assumption streaming deferred'
      );
      return;
    }

    const events = await this.streamingProvider.generateEvents({
      sessionId: params.session.id,
      prompt: params.prompt,
      action: params.action,
      updates: params.updates,
      timestamp,
      getNextSequence: () => this.bumpSequence(params.session.id),
    });

    if (params.action === 'answer' && this.deferredSessions.has(sessionId)) {
      const hasResumed = events.some(
        event => event.type === 'status' && event.status === 'resumed'
      );
      if (!hasResumed) {
        this.publishOrBuffer(sessionId, {
          type: 'status',
          data: { status: 'resumed', timestamp: isoTimestamp },
        });
      }
      this.deferredSessions.delete(sessionId);
    }

    for (const event of events) {
      if (event.type === 'status') {
        this.publishOrBuffer(sessionId, {
          type: 'status',
          data: { status: event.status, timestamp: isoTimestamp },
        });
        continue;
      }

      const sequence = event.sequence ?? this.bumpSequence(sessionId);
      const progress = createStreamingProgressEvent({
        sessionId,
        sequence,
        stageLabel: event.stageLabel,
        timestamp,
        contentSnippet: event.contentSnippet ?? null,
        deltaType: event.deltaType ?? 'text',
        announcementPriority: event.announcementPriority ?? 'polite',
        deliveryChannel: 'streaming',
        elapsedMs: event.elapsedMs ?? 0,
      });

      this.publishOrBuffer(sessionId, {
        type: 'progress',
        data: progress,
      });

      this.logger.info(
        {
          event: 'assumptions.streaming.progress',
          sessionId,
          sectionId: params.session.sectionId,
          assumptionId: params.prompt.id,
          sequence: progress.sequence,
          stageLabel: progress.stageLabel,
          requestId: params.requestId,
        },
        'Assumption streaming progress event'
      );
    }
  }

  private async resolveTemplateBinding(input: {
    documentId: string;
    requestedVersion?: string | null;
    requestId: string;
  }): Promise<TemplateBindingResolution> {
    const document = await this.documents.findById(input.documentId);
    if (!document) {
      throw new SectionEditorServiceError('Document not found for assumption session', 404, {
        documentId: input.documentId,
      });
    }

    const documentTemplateId = this.normalizeIdentifier(document.templateId);
    const requestedVersion = this.normalizeIdentifier(input.requestedVersion);
    const documentVersion = this.normalizeIdentifier(document.templateVersion);
    const templateId = documentTemplateId ?? DEFAULT_ARCHITECTURE_TEMPLATE_ID;
    const hasDocumentTemplate = Boolean(documentTemplateId);

    const candidates: Array<{ version: string; source: 'request' | 'document' }> = [];
    if (requestedVersion) {
      candidates.push({ version: requestedVersion, source: 'request' });
    }
    if (documentVersion && documentVersion !== requestedVersion) {
      candidates.push({ version: documentVersion, source: 'document' });
    }

    for (const candidate of candidates) {
      const resolved = await this.templateResolver.resolve({
        templateId,
        version: candidate.version,
      });
      if (resolved) {
        if (candidate.source === 'request') {
          this.logger.debug(
            {
              requestId: input.requestId,
              documentId: document.id,
              templateId,
              version: candidate.version,
            },
            'Assumption session using template version from request payload'
          );
        }
        return {
          templateId: resolved.template.templateId,
          version: resolved.template.version,
        };
      }

      this.logger.warn(
        {
          requestId: input.requestId,
          documentId: document.id,
          templateId,
          version: candidate.version,
          source: candidate.source,
        },
        'Template version unavailable during assumption session bootstrap'
      );
    }

    const activeVersion = await this.templateResolver.resolveActiveVersion(templateId);
    if (activeVersion) {
      const reason = hasDocumentTemplate
        ? 'fallback_active_template_version'
        : 'fallback_default_template';
      this.logger.info(
        {
          requestId: input.requestId,
          documentId: document.id,
          templateId: activeVersion.template.templateId,
          reason,
        },
        hasDocumentTemplate
          ? 'Falling back to active template version for assumption session'
          : 'Document missing template binding; using default template for assumption session'
      );

      return {
        templateId: activeVersion.template.templateId,
        version: activeVersion.template.version,
      };
    }

    throw new SectionEditorServiceError(
      hasDocumentTemplate
        ? 'Template version unavailable for this document'
        : 'Default template is not available for assumption sessions',
      409,
      {
        code: 'TEMPLATE_VERSION_MISSING',
        templateId,
        version: requestedVersion ?? documentVersion ?? null,
        documentId: document.id,
      }
    );
  }

  private normalizeIdentifier(value?: string | null): string | null {
    if (typeof value !== 'string') {
      return null;
    }
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  }

  private publishOrBuffer(sessionId: string, payload: AssumptionStreamPayload): void {
    const stream = this.streams.get(sessionId);
    if (!stream) {
      return;
    }

    const state = this.queueStates.get(sessionId);
    if (state && state.status === 'pending') {
      state.buffered.push(payload);
      return;
    }

    this.dispatchToStream(stream, payload);
  }

  private dispatchToStream(
    stream: AssumptionStreamController,
    payload: AssumptionStreamPayload
  ): void {
    if (payload.type === 'progress') {
      stream.emitProgress(payload.data as StreamingProgressEvent);
      return;
    }

    if (payload.type === 'status') {
      const data = payload.data as { status?: string } & Record<string, unknown>;
      if (typeof data.status === 'string' && isAssumptionStatus(data.status)) {
        const { status, ...rest } = data;
        stream.emitStatus(status, rest);
      }
      return;
    }

    if (payload.type === 'telemetry') {
      stream.emitTelemetry(payload.data as Record<string, unknown>);
    }
  }

  private flushBufferedEvents(
    sessionId: string,
    stream: AssumptionStreamController,
    state: QueueSessionState
  ): void {
    if (state.buffered.length === 0) {
      return;
    }

    const buffered = state.buffered.splice(0);
    for (const payload of buffered) {
      this.dispatchToStream(stream, payload);
    }

    this.logger.debug(
      {
        sessionId,
        bufferedCount: buffered.length,
      },
      'Flushed buffered assumption streaming events after activation'
    );
  }

  private activateQueuePromotion(promotion: {
    sessionId: string;
    sectionId: string;
    concurrencySlot: number;
  }): void {
    const state = this.queueStates.get(promotion.sessionId);
    const nowIso = this.now().toISOString();

    if (!state) {
      this.queueStates.set(promotion.sessionId, {
        sectionId: promotion.sectionId,
        status: 'active',
        buffered: [],
        concurrencySlot: promotion.concurrencySlot,
      });
    } else {
      state.status = 'active';
      state.concurrencySlot = promotion.concurrencySlot;
    }

    const stream = this.streams.get(promotion.sessionId);
    if (!stream) {
      return;
    }

    stream.emitStatus('streaming', {
      timestamp: nowIso,
      concurrencySlot: promotion.concurrencySlot,
    });

    const currentState = this.queueStates.get(promotion.sessionId);
    if (currentState) {
      this.flushBufferedEvents(promotion.sessionId, stream, currentState);
    }
  }

  private mapQueueCancellationReason(
    reason: 'client_close' | 'canceled' | 'error'
  ): QueueCancellationReason {
    if (reason === 'canceled') {
      return 'author_cancelled';
    }
    if (reason === 'error') {
      return 'transport_failure';
    }
    return 'deferred';
  }

  handleQueuePromotion(promotion: {
    sessionId: string;
    sectionId: string;
    concurrencySlot: number;
  }): void {
    this.activateQueuePromotion(promotion);
  }

  handleQueueCancellation(details: {
    sessionId: string;
    sectionId: string;
    reason: QueueCancellationReason;
    state: 'active' | 'pending';
  }): void {
    const stream = this.streams.get(details.sessionId);
    const timestamp = this.now().toISOString();

    if (stream) {
      if (details.reason === 'replaced_by_new_request') {
        stream.emitReplacement(details.sessionId, timestamp);
      }

      stream.emitStatus('canceled', {
        timestamp,
        reason: details.reason,
        state: details.state,
      });
      stream.complete('completed', {
        timestamp,
      });
    }

    this.streams.delete(details.sessionId);
    this.sequenceCounters.delete(details.sessionId);
    this.deferredSessions.delete(details.sessionId);
    this.queueStates.delete(details.sessionId);

    this.logger.info(
      {
        sessionId: details.sessionId,
        sectionId: details.sectionId,
        reason: details.reason,
        state: details.state,
        timestamp,
      },
      'Assumption streaming session canceled via shared queue'
    );
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
