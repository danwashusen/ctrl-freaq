import { randomUUID } from 'node:crypto';
import { setTimeout as delay } from 'node:timers/promises';

import type { Response } from 'express';
import type { Logger } from 'pino';

import {
  runProposalSession,
  createVercelAIProposalProvider,
  type ProposalProvider,
  type ProposalIntent,
  type ProposalStreamEvent,
} from '@ctrl-freaq/ai/session/proposal-runner.js';
import {
  buildCoAuthorContext,
  type BuildCoAuthorContextDependencies,
  type BuildCoAuthorContextInput,
  type ProviderContextPayload,
} from './context-builder.js';
import type { CoAuthoringChangelogRepository } from '@ctrl-freaq/shared-data/repositories/changelog/changelog.repository.js';
import type { CoAuthoringAuditLogger } from '@ctrl-freaq/qa';
import type { DraftPersistenceAdapter } from './draft-persistence.js';
import { mapProposalDiff, type DiffMapperResult } from './diff-mapper.js';
import { AppError } from '../../core/errors.js';
import { AI_PROPOSAL_DEFAULT_TTL_MS } from '@ctrl-freaq/shared-data/co-authoring/ai-proposal-snapshot.js';

interface SessionEventPayload {
  event: string;
  data: unknown;
}

class SessionEventStream {
  private readonly subscribers = new Set<Response>();
  private readonly buffer: SessionEventPayload[] = [];

  constructor(private readonly sessionId: string) {}

  subscribe(res: Response): void {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-CoAuthor-Session', this.sessionId);
    res.flushHeaders?.();
    res.write(': connected\n\n');

    for (const payload of this.buffer) {
      this.write(res, payload);
    }

    this.subscribers.add(res);
    res.on('close', () => {
      this.subscribers.delete(res);
    });
  }

  emit(event: string, data: unknown): void {
    const payload: SessionEventPayload = { event, data };
    this.buffer.push(payload);
    if (this.buffer.length > 100) {
      this.buffer.shift();
    }

    for (const res of this.subscribers) {
      this.write(res, payload);
    }
  }

  private write(res: Response, payload: SessionEventPayload): void {
    res.write(`event: ${payload.event}\n`);
    res.write(`data: ${JSON.stringify(payload.data)}\n\n`);
  }

  close(): void {
    for (const res of this.subscribers) {
      try {
        res.write('event: session.closed\n');
        res.write('data: {}\n\n');
        res.end();
      } catch {
        // Ignore errors closing individual subscribers.
      }
    }
    this.subscribers.clear();
    this.buffer.length = 0;
  }
}

class SessionRegistry {
  private readonly streams = new Map<string, SessionEventStream>();

  get(sessionId: string): SessionEventStream {
    let stream = this.streams.get(sessionId);
    if (!stream) {
      stream = new SessionEventStream(sessionId);
      this.streams.set(sessionId, stream);
    }
    return stream;
  }

  close(sessionId: string): void {
    const stream = this.streams.get(sessionId);
    if (stream) {
      stream.close();
      this.streams.delete(sessionId);
    }
  }
}

interface AnalyzeRequest extends BuildCoAuthorContextInput {
  sessionId: string;
  intent: string;
  prompt: string;
}

interface ProposalRequest extends AnalyzeRequest {
  promptId: string;
  turnId: string;
  draftVersion?: number;
  baselineVersion?: string;
}

interface ApproveProposalRequest {
  documentId: string;
  sectionId: string;
  sessionId: string;
  authorId: string;
  proposalId: string;
  diffHash: string;
  draftPatch: string;
  approvalNotes?: string;
}

interface ApproveProposalResult {
  status: 'queued';
  changelog: {
    entryId: string;
    summary: string;
    proposalId: string;
    confidence: number;
    citations: string[];
  };
  queue: {
    draftVersion: number;
    diffHash: string;
  };
}

interface ContextSummary {
  completedSectionCount: number;
  knowledgeItemCount: number;
  decisionCount: number;
}

interface PendingProposal {
  sessionId: string;
  documentId: string;
  sectionId: string;
  authorId: string;
  proposalId: string;
  diff: DiffMapperResult['diff'];
  annotations: DiffMapperResult['annotations'];
  diffHash: string;
  snapshot: DiffMapperResult['snapshot'];
  updatedDraft: string;
  promptSummary: string;
  confidence: number;
  citations: string[];
  baselineDraftVersion?: number;
  expiresAt: number;
}

class ProposalDiffHashMismatchError extends AppError {
  readonly statusCode = 409;
  readonly errorCode = 'DIFF_HASH_MISMATCH';
  readonly isOperational = true;

  constructor(
    private readonly details: {
      documentId: string;
      sectionId: string;
      proposalId: string;
      sessionId: string;
      expectedDiffHash: string;
      receivedDiffHash: string;
    }
  ) {
    super('Proposal diff hash mismatch detected', details);
  }

  override getSafeDetails(): Record<string, unknown> {
    return {
      expectedDiffHash: this.details.expectedDiffHash,
      receivedDiffHash: this.details.receivedDiffHash,
      proposalId: this.details.proposalId,
      sessionId: this.details.sessionId,
    };
  }
}

export interface StartAnalysisResult {
  streamLocation: string;
  responseBody: {
    status: 'accepted';
    sessionId: string;
    audit: {
      documentId: string;
      sectionId: string;
      intent: string;
    };
    contextSummary: ContextSummary;
  };
}

export interface StartProposalResult {
  streamLocation: string;
  responseBody: {
    status: 'accepted';
    sessionId: string;
    audit: {
      documentId: string;
      sectionId: string;
      intent: string;
      promptId: string;
    };
    diffPreview: {
      mode: 'unified' | 'split';
      pendingProposalId: string;
    };
  };
}

export interface AIProposalServiceDependencies {
  logger: Logger;
  context: BuildCoAuthorContextDependencies;
  draftPersistence: DraftPersistenceAdapter;
  changelogRepo: CoAuthoringChangelogRepository;
  auditLogger: CoAuthoringAuditLogger;
  streamRegistry?: SessionRegistry;
  providerFactory?: () => ProposalProvider;
  now?: () => Date;
}

const defaultNow = () => new Date();
const SESSION_IDLE_TTL_MS = 5 * 60 * 1000;

const toProposalIntent = (intent: string): ProposalIntent => {
  if (intent === 'outline' || intent === 'explain' || intent === 'improve') {
    return intent;
  }
  return 'improve';
};

const UUID_PATTERN =
  /^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$/;

const ensureUuid = (value: string): string => {
  return UUID_PATTERN.test(value) ? value : randomUUID();
};

const toRenderMode = (value: unknown): 'split' | 'unified' | undefined => {
  return value === 'split' || value === 'unified' ? value : undefined;
};

const parseProposalPayload = (
  rawText: string
): {
  proposalId?: string;
  updatedDraft: string;
  confidence?: number;
  citations?: string[];
  rationale?: string;
  promptSummary?: string;
} => {
  try {
    const parsed = JSON.parse(rawText) as Record<string, unknown>;
    if (typeof parsed.updatedDraft === 'string') {
      return {
        proposalId: typeof parsed.proposalId === 'string' ? parsed.proposalId : undefined,
        updatedDraft: parsed.updatedDraft,
        confidence:
          typeof parsed.confidence === 'number' && Number.isFinite(parsed.confidence)
            ? parsed.confidence
            : undefined,
        citations: Array.isArray(parsed.citations)
          ? (parsed.citations.filter(value => typeof value === 'string') as string[])
          : undefined,
        rationale: typeof parsed.rationale === 'string' ? parsed.rationale : undefined,
        promptSummary: typeof parsed.promptSummary === 'string' ? parsed.promptSummary : undefined,
      };
    }
  } catch {
    // Swallow parse errors and fall back to raw text.
  }

  return {
    updatedDraft: rawText || 'No proposal content returned by provider.',
  };
};

export class AIProposalService {
  private readonly logger: Logger;
  private readonly contextDeps: BuildCoAuthorContextDependencies;
  private readonly draftPersistence: DraftPersistenceAdapter;
  private readonly changelogRepo: CoAuthoringChangelogRepository;
  private readonly auditLogger: CoAuthoringAuditLogger;
  private readonly streams: SessionRegistry;
  private readonly getNow: () => Date;
  private readonly providerFactory: () => ProposalProvider;
  private readonly pending = new Map<string, PendingProposal>();
  private readonly sessionProposals = new Map<string, Set<string>>();
  private readonly sessionActivity = new Map<string, number>();

  constructor(dependencies: AIProposalServiceDependencies) {
    this.logger = dependencies.logger;
    this.contextDeps = dependencies.context;
    this.draftPersistence = dependencies.draftPersistence;
    this.changelogRepo = dependencies.changelogRepo;
    this.auditLogger = dependencies.auditLogger;
    this.streams = dependencies.streamRegistry ?? new SessionRegistry();
    this.getNow = dependencies.now ?? defaultNow;
    this.providerFactory = dependencies.providerFactory ?? createVercelAIProposalProvider;
  }

  private recordSessionActivity(sessionId: string, timestamp = this.getNow().getTime()): void {
    this.sessionActivity.set(sessionId, timestamp);
  }

  private trackPendingProposal(pending: PendingProposal): void {
    const proposals = this.sessionProposals.get(pending.sessionId) ?? new Set<string>();
    proposals.add(pending.proposalId);
    this.sessionProposals.set(pending.sessionId, proposals);
    this.pending.set(pending.proposalId, pending);
  }

  private deletePendingProposal(proposalId: string): PendingProposal | null {
    const pending = this.pending.get(proposalId) ?? null;
    if (!pending) {
      return null;
    }
    this.pending.delete(proposalId);
    const proposals = this.sessionProposals.get(pending.sessionId);
    if (proposals) {
      proposals.delete(proposalId);
      if (proposals.size === 0) {
        this.sessionProposals.delete(pending.sessionId);
      }
    }
    return pending;
  }

  subscribe(sessionId: string, res: Response): void {
    this.evictExpiredSessions();
    this.recordSessionActivity(sessionId);
    this.streams.get(sessionId).subscribe(res);
  }

  async startAnalysis(request: AnalyzeRequest): Promise<StartAnalysisResult> {
    this.evictExpiredSessions();
    const context = await buildCoAuthorContext(this.contextDeps, request);
    const summary = this.summariseContext(context);
    const stream = this.streams.get(request.sessionId);
    this.recordSessionActivity(request.sessionId);

    stream.emit('progress', { status: 'queued', elapsedMs: 0 });
    void this.emitAnalysisGuidance(stream, request, context);

    this.auditLogger.logIntent({
      eventId: randomUUID(),
      documentId: request.documentId,
      sectionId: request.sectionId,
      userId: request.authorId,
      intent: request.intent,
      knowledgeItemIds: request.knowledgeItemIds,
      decisionIds: request.decisionIds,
    });

    return {
      streamLocation: this.buildStreamLocation(request.sessionId),
      responseBody: {
        status: 'accepted',
        sessionId: request.sessionId,
        audit: {
          documentId: request.documentId,
          sectionId: request.sectionId,
          intent: request.intent,
        },
        contextSummary: summary,
      },
    };
  }

  async startProposal(request: ProposalRequest): Promise<StartProposalResult> {
    this.evictExpiredSessions();
    const context = await buildCoAuthorContext(this.contextDeps, request);
    const stream = this.streams.get(request.sessionId);
    const startedAt = Date.now();
    const pendingProposalId = randomUUID();
    this.recordSessionActivity(request.sessionId);

    stream.emit('progress', { status: 'queued', elapsedMs: 0 });

    this.auditLogger.logProposal({
      eventId: pendingProposalId,
      documentId: request.documentId,
      sectionId: request.sectionId,
      sessionId: request.sessionId,
      promptId: request.promptId,
      intent: request.intent,
      status: 'queued',
      elapsedMs: 0,
    });

    const provider = this.providerFactory();
    void this.executeProposal({
      request,
      context,
      stream,
      provider,
      startedAt,
      pendingProposalId,
    }).catch(error => {
      this.logger.error(
        {
          error: error instanceof Error ? error.message : error,
          documentId: request.documentId,
          sectionId: request.sectionId,
          sessionId: request.sessionId,
        },
        'Proposal streaming failed'
      );

      stream.emit('error', {
        message: 'assistant_unavailable',
      });

      this.auditLogger.logProposal({
        eventId: pendingProposalId,
        documentId: request.documentId,
        sectionId: request.sectionId,
        sessionId: request.sessionId,
        promptId: request.promptId,
        intent: request.intent,
        status: 'error',
        elapsedMs: Date.now() - startedAt,
      });
    });

    return {
      streamLocation: this.buildStreamLocation(request.sessionId),
      responseBody: {
        status: 'accepted',
        sessionId: request.sessionId,
        audit: {
          documentId: request.documentId,
          sectionId: request.sectionId,
          intent: request.intent,
          promptId: request.promptId,
        },
        diffPreview: {
          mode: 'unified',
          pendingProposalId,
        },
      },
    };
  }

  private buildStreamLocation(sessionId: string): string {
    return `/api/v1/co-authoring/sessions/${sessionId}/events`;
  }

  private summariseContext(context: ProviderContextPayload): ContextSummary {
    return {
      completedSectionCount: context.completedSections.length,
      knowledgeItemCount: context.knowledgeItems.length,
      decisionCount: context.decisionSummaries.length,
    };
  }

  private async emitAnalysisGuidance(
    stream: SessionEventStream,
    request: AnalyzeRequest,
    context: ProviderContextPayload
  ): Promise<void> {
    stream.emit('progress', { status: 'streaming', elapsedMs: 5 });
    const intro = `Analyzing ${context.documentTitle} → ${request.prompt}`;
    stream.emit('token', { value: intro });
    await delay(15);
    stream.emit('token', {
      value: 'Consider referencing decision summaries to justify the next revision.',
    });
    await delay(10);
    stream.emit('analysis.completed', {
      sessionId: request.sessionId,
      timestamp: this.getNow().toISOString(),
    });
  }

  private async executeProposal(args: {
    request: ProposalRequest;
    context: ProviderContextPayload;
    stream: SessionEventStream;
    provider: ProposalProvider;
    startedAt: number;
    pendingProposalId: string;
  }): Promise<void> {
    const { request, context, stream, provider, startedAt, pendingProposalId } = args;

    const result = await runProposalSession({
      session: {
        sessionId: request.sessionId,
        documentId: request.documentId,
        sectionId: request.sectionId,
        authorId: request.authorId,
      },
      prompt: {
        promptId: request.promptId,
        intent: toProposalIntent(request.intent),
        text: request.prompt,
      },
      context,
      provider,
      onEvent: async (event: ProposalStreamEvent) => {
        stream.emit(event.type, { ...event.data, timestamp: this.getNow().toISOString() });
      },
    });

    const elapsedMs = Date.now() - startedAt;

    stream.emit('progress', {
      status: 'awaiting-approval',
      elapsedMs,
    });

    this.auditLogger.logProposal({
      eventId: pendingProposalId,
      documentId: request.documentId,
      sectionId: request.sectionId,
      sessionId: request.sessionId,
      promptId: request.promptId,
      intent: request.intent,
      status: 'awaiting-approval',
      elapsedMs,
    });

    const parsed = parseProposalPayload(result.rawText ?? '');
    const diff = mapProposalDiff({
      proposalId: pendingProposalId,
      sessionId: request.sessionId,
      originTurnId: request.turnId,
      promptId: request.promptId,
      rationale: parsed.rationale ?? request.prompt,
      confidence: parsed.confidence ?? result.confidence ?? 0.5,
      citations: parsed.citations ?? [],
      baselineContent: context.currentDraft,
      proposedContent: parsed.updatedDraft,
      renderMode: toRenderMode(result.diff?.mode),
    });

    const expiresAtCandidate = Date.parse(diff.snapshot.expiresAt);
    const expiresAt = Number.isFinite(expiresAtCandidate)
      ? expiresAtCandidate
      : this.getNow().getTime() + AI_PROPOSAL_DEFAULT_TTL_MS;

    const pending: PendingProposal = {
      sessionId: request.sessionId,
      documentId: request.documentId,
      sectionId: request.sectionId,
      authorId: request.authorId,
      proposalId: diff.snapshot.proposalId,
      diff: diff.diff,
      annotations: diff.annotations,
      diffHash: diff.diffHash,
      snapshot: diff.snapshot,
      updatedDraft: parsed.updatedDraft,
      promptSummary: parsed.promptSummary ?? request.prompt,
      confidence: diff.snapshot.confidence,
      citations: diff.snapshot.citations,
      expiresAt,
    };

    this.trackPendingProposal(pending);
    this.recordSessionActivity(request.sessionId);

    stream.emit('proposal.ready', {
      proposalId: diff.snapshot.proposalId,
      diff: diff.diff,
      annotations: diff.annotations,
      confidence: diff.snapshot.confidence,
      citations: diff.snapshot.citations,
      expiresAt: diff.snapshot.expiresAt,
      diffHash: diff.diffHash,
    });
  }

  private assertDiffHashMatch(params: {
    expected: string;
    received: string;
    documentId: string;
    sectionId: string;
    proposalId: string;
    sessionId: string;
  }): void {
    const { expected, received, documentId, sectionId, proposalId, sessionId } = params;

    if (expected === received) {
      return;
    }

    this.logger.warn(
      {
        documentId,
        sectionId,
        proposalId,
        sessionId,
        expectedDiffHash: expected,
        receivedDiffHash: received,
      },
      'Co-authoring proposal approval diff hash mismatch'
    );

    throw new ProposalDiffHashMismatchError({
      documentId,
      sectionId,
      proposalId,
      sessionId,
      expectedDiffHash: expected,
      receivedDiffHash: received,
    });
  }

  async approveProposal(request: ApproveProposalRequest): Promise<ApproveProposalResult | null> {
    this.evictExpiredSessions();

    const pendingFromCache = this.pending.get(request.proposalId) ?? null;
    let pending = pendingFromCache;

    if (!pending) {
      pending = await this.buildFallbackPending(request);
    }

    this.assertDiffHashMatch({
      expected: pending.diffHash,
      received: request.diffHash,
      documentId: pending.documentId,
      sectionId: pending.sectionId,
      proposalId: pending.proposalId,
      sessionId: pending.sessionId,
    });

    if (pendingFromCache) {
      pending = this.deletePendingProposal(request.proposalId) ?? pendingFromCache;
    }

    const canonicalDiffHash = pending.diffHash;

    const queueResult = await this.draftPersistence.queueProposal({
      documentId: pending.documentId,
      sectionId: pending.sectionId,
      authorId: pending.authorId,
      proposalId: pending.proposalId,
      diffHash: canonicalDiffHash,
      draftPatch: request.draftPatch,
      updatedDraft: pending.updatedDraft,
      promptSummary: pending.promptSummary,
    });

    const entryId = randomUUID();
    const approvedAt = this.getNow();

    this.logger.debug(
      {
        pendingProposalId: pending.proposalId,
        baselineDraftVersion: pending.baselineDraftVersion,
        queuedDraftVersion: queueResult.draftVersion,
      },
      'Co-authoring proposal approval persistence snapshot'
    );

    await this.changelogRepo.recordProposalApproval({
      entryId,
      documentId: pending.documentId,
      sectionId: pending.sectionId,
      approvedBy: pending.authorId,
      approvedAt,
      diffHash: request.diffHash,
      proposal: {
        proposalId: pending.proposalId,
        promptSummary: pending.promptSummary,
        citations: pending.citations,
        confidence: pending.confidence,
      },
    });

    this.auditLogger.logApproval({
      eventId: queueResult.requestId,
      documentId: pending.documentId,
      sectionId: pending.sectionId,
      authorId: pending.authorId,
      proposalId: pending.proposalId,
      diffHash: canonicalDiffHash,
      confidence: pending.confidence,
      citations: pending.citations,
      approvalNotes: request.approvalNotes,
    });

    this.recordSessionActivity(pending.sessionId);

    let fallbackVersion = pending.baselineDraftVersion;

    if (typeof fallbackVersion !== 'number' || !Number.isFinite(fallbackVersion)) {
      if (
        typeof queueResult.previousDraftVersion === 'number' &&
        Number.isFinite(queueResult.previousDraftVersion)
      ) {
        fallbackVersion = queueResult.previousDraftVersion;
      } else {
        const approvedBaseVersion = await this.draftPersistence.getSectionApprovedVersion(
          pending.documentId,
          pending.sectionId
        );

        fallbackVersion =
          typeof approvedBaseVersion === 'number' && Number.isFinite(approvedBaseVersion)
            ? approvedBaseVersion + 1
            : undefined;
      }
    }

    this.logger.debug(
      {
        pendingProposalId: pending.proposalId,
        resolvedDraftVersion: fallbackVersion,
        previousDraftVersion: queueResult.previousDraftVersion,
        queuedDraftVersion: queueResult.draftVersion,
      },
      'Co-authoring proposal approval draft version normalization'
    );

    return {
      status: 'queued',
      changelog: {
        entryId,
        summary: this.buildApprovalSummary(
          pending.promptSummary,
          request.approvalNotes,
          pending.authorId
        ),
        proposalId: pending.proposalId,
        confidence: pending.confidence,
        citations: pending.citations,
      },
      queue: {
        draftVersion: this.normalizeDraftVersion(
          pending.baselineDraftVersion,
          queueResult.previousDraftVersion,
          fallbackVersion,
          queueResult.draftVersion
        ),
        diffHash: canonicalDiffHash,
      },
    } satisfies ApproveProposalResult;
  }

  consumePendingProposal(proposalId: string): PendingProposal | null {
    return this.deletePendingProposal(proposalId);
  }

  teardownSession(input: {
    sessionId: string;
    reason: 'section-change' | 'navigation' | 'logout' | 'manual' | 'expired';
  }): void {
    const { sessionId, reason } = input;

    const proposals = this.sessionProposals.get(sessionId);
    if (proposals) {
      for (const proposalId of proposals) {
        this.deletePendingProposal(proposalId);
      }
    }

    this.sessionProposals.delete(sessionId);
    this.sessionActivity.delete(sessionId);
    this.streams.close(sessionId);

    this.logger.debug({ sessionId, reason }, 'Co-authoring session teardown complete');
  }

  rejectProposal(input: { sessionId: string; proposalId: string }): boolean {
    const pending = this.pending.get(input.proposalId);
    if (!pending) {
      return false;
    }

    if (pending.sessionId !== input.sessionId) {
      this.deletePendingProposal(input.proposalId);
      return false;
    }

    this.deletePendingProposal(input.proposalId);
    this.recordSessionActivity(input.sessionId);
    this.logger.debug(
      {
        sessionId: input.sessionId,
        proposalId: input.proposalId,
      },
      'Co-authoring pending proposal rejected'
    );
    return true;
  }

  evictExpiredSessions(now = this.getNow().getTime()): void {
    for (const [proposalId, pending] of [...this.pending.entries()]) {
      if (pending.expiresAt <= now) {
        this.logger.debug(
          {
            proposalId,
            sessionId: pending.sessionId,
            expiresAt: pending.expiresAt,
          },
          'Evicting expired pending proposal'
        );
        this.deletePendingProposal(proposalId);
      }
    }

    for (const [sessionId, lastActivity] of [...this.sessionActivity.entries()]) {
      if (lastActivity + SESSION_IDLE_TTL_MS <= now) {
        this.logger.debug(
          {
            sessionId,
            lastActivity,
            now,
          },
          'Evicting idle co-authoring session'
        );
        this.teardownSession({ sessionId, reason: 'expired' });
      }
    }
  }

  private buildApprovalSummary(
    promptSummary: string,
    approvalNotes: string | undefined,
    authorId: string
  ): string {
    const trimmedNotes = approvalNotes?.trim();
    if (trimmedNotes) {
      return trimmedNotes;
    }
    const trimmedPrompt = promptSummary.trim();
    if (trimmedPrompt) {
      return trimmedPrompt;
    }
    return `AI proposal approved by ${authorId}`;
  }

  private async buildFallbackPending(request: ApproveProposalRequest): Promise<PendingProposal> {
    const draftSnapshot = await this.draftPersistence.getLatestDraftSnapshot(
      request.documentId,
      request.sectionId
    );
    const activeDraft = await this.contextDeps.fetchActiveSectionDraft({
      documentId: request.documentId,
      sectionId: request.sectionId,
    });
    const baselineContent = draftSnapshot?.content ?? activeDraft?.content ?? '';
    const inferredBaselineVersion =
      draftSnapshot?.draftVersion ??
      activeDraft?.draftVersion ??
      (activeDraft?.baselineVersion
        ? Number.parseInt(activeDraft.baselineVersion.replace(/[^0-9]/g, ''), 10) + 1
        : undefined);
    const approvedBaseVersion = await this.draftPersistence.getSectionApprovedVersion(
      request.documentId,
      request.sectionId
    );
    const fallbackVersion =
      inferredBaselineVersion ??
      (approvedBaseVersion != null ? approvedBaseVersion + 1 : undefined);

    this.logger.debug(
      {
        documentId: request.documentId,
        sectionId: request.sectionId,
        approvedBaseVersion,
        inferredBaselineVersion,
        fallbackVersion,
      },
      'Co-authoring fallback draft version resolution'
    );
    const snapshotProposalId = ensureUuid(request.proposalId);
    const snapshotSessionId = ensureUuid(request.sessionId);

    this.logger.debug(
      {
        originalProposalId: request.proposalId,
        snapshotProposalId,
        originalSessionId: request.sessionId,
        snapshotSessionId,
        baselineDraftVersion: fallbackVersion,
      },
      'Co-authoring fallback pending identifiers'
    );

    const diff = mapProposalDiff({
      proposalId: snapshotProposalId,
      sessionId: snapshotSessionId,
      originTurnId: snapshotProposalId,
      promptId: snapshotProposalId,
      rationale: request.approvalNotes ?? `AI proposal ${request.proposalId}`,
      confidence: 0.5,
      citations: [],
      baselineContent,
      proposedContent: baselineContent,
      renderMode: 'unified',
    });

    const expiresAtCandidate = Date.parse(diff.snapshot.expiresAt);
    const expiresAt = Number.isFinite(expiresAtCandidate)
      ? expiresAtCandidate
      : this.getNow().getTime() + AI_PROPOSAL_DEFAULT_TTL_MS;

    return {
      sessionId: request.sessionId,
      documentId: request.documentId,
      sectionId: request.sectionId,
      authorId: request.authorId,
      proposalId: request.proposalId,
      diff: diff.diff,
      annotations: diff.annotations,
      diffHash: diff.diffHash,
      snapshot: {
        ...diff.snapshot,
        proposalId: snapshotProposalId,
        sessionId: snapshotSessionId,
      },
      updatedDraft: baselineContent,
      promptSummary:
        request.approvalNotes?.trim() ||
        diff.snapshot.annotations[0]?.rationale ||
        `AI proposal ${request.proposalId}`,
      confidence: diff.snapshot.confidence,
      citations: diff.snapshot.citations,
      baselineDraftVersion: fallbackVersion,
      expiresAt,
    };
  }

  private normalizeDraftVersion(
    baselineDraftVersion: number | undefined,
    previousDraftVersion: number | null,
    fallbackVersion: number | undefined,
    queuedVersion: number
  ): number {
    const candidates = [
      baselineDraftVersion,
      previousDraftVersion ?? undefined,
      fallbackVersion,
    ].filter((value): value is number => typeof value === 'number' && Number.isFinite(value));

    if (candidates.length > 0) {
      return candidates[0] as number;
    }

    return queuedVersion;
  }
}
