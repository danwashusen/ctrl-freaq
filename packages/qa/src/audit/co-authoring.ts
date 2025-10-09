export interface CoAuthoringAuditLogger {
  logIntent(input: CoAuthoringIntentEvent): void;
  logProposal(input: CoAuthoringProposalEvent): void;
  logApproval(input: CoAuthoringApprovalEvent): void;
}

export interface CoAuthoringIntentEvent {
  eventId: string;
  documentId: string;
  sectionId: string;
  userId: string | null;
  intent: string;
  knowledgeItemIds?: string[];
  decisionIds?: string[];
}

export interface CoAuthoringProposalEvent {
  eventId: string;
  documentId: string;
  sectionId: string;
  sessionId: string;
  promptId: string;
  intent: string;
  status: 'queued' | 'streaming' | 'awaiting-approval' | 'error';
  elapsedMs: number;
}

export interface CoAuthoringApprovalEvent {
  eventId: string;
  documentId: string;
  sectionId: string;
  authorId: string;
  proposalId: string;
  diffHash: string;
  confidence: number;
  citations: string[];
  approvalNotes?: string;
  transcriptExcerpt?: string | null;
}

interface LoggerLike {
  info(payload: Record<string, unknown>, message?: string): void;
  warn(payload: Record<string, unknown>, message?: string): void;
  error(payload: Record<string, unknown>, message?: string): void;
}

const LATENCY_BUCKETS: Array<{ max: number; label: string }> = [
  { max: 1_000, label: '<1000ms' },
  { max: 3_000, label: '1000-3000ms' },
  { max: 5_000, label: '3000-5000ms' },
  { max: 10_000, label: '5000-10000ms' },
];

const normaliseArray = (values: unknown[]): string[] => {
  const output: string[] = [];
  for (const value of values) {
    if (typeof value !== 'string') {
      continue;
    }
    const trimmed = value.trim();
    if (!trimmed || output.includes(trimmed)) {
      continue;
    }
    output.push(trimmed);
  }
  return output;
};

const normaliseIntent = (intent: string): string => {
  const lower = intent.toLowerCase();
  if (lower === 'explain' || lower === 'outline' || lower === 'improve') {
    return lower;
  }
  return 'improve';
};

const toLatencyBucket = (elapsedMs: number): string => {
  for (const bucket of LATENCY_BUCKETS) {
    if (elapsedMs < bucket.max) {
      return bucket.label;
    }
  }
  return '10000ms+';
};

const sanitizeConfidence = (confidence: number): number => {
  if (!Number.isFinite(confidence)) {
    return 0;
  }
  return Math.min(Math.max(confidence, 0), 1);
};

export function createCoAuthoringAuditLogger(logger: LoggerLike): CoAuthoringAuditLogger {
  return {
    logIntent(input) {
      const payload = {
        event: 'coauthor.intent',
        eventId: input.eventId,
        documentId: input.documentId,
        sectionId: input.sectionId,
        userId: input.userId,
        intent: normaliseIntent(input.intent),
        knowledgeSourceCount: normaliseArray(input.knowledgeItemIds ?? []).length,
        decisionCount: normaliseArray(input.decisionIds ?? []).length,
      } satisfies Record<string, unknown>;

      logger.info(payload, 'Co-authoring intent recorded');
    },

    logProposal(input) {
      const payload = {
        event: 'coauthor.proposal',
        eventId: input.eventId,
        documentId: input.documentId,
        sectionId: input.sectionId,
        sessionId: input.sessionId,
        promptId: input.promptId,
        intent: normaliseIntent(input.intent),
        status: input.status,
        elapsedMs: Math.max(0, Math.round(input.elapsedMs)),
        latencyBucket: toLatencyBucket(Math.max(0, Math.round(input.elapsedMs))),
      } satisfies Record<string, unknown>;

      logger.info(payload, 'Co-authoring proposal streaming');
    },

    logApproval(input) {
      const payload = {
        event: 'coauthor.approved',
        eventId: input.eventId,
        documentId: input.documentId,
        sectionId: input.sectionId,
        authorId: input.authorId,
        proposalId: input.proposalId,
        diffHash: input.diffHash,
        confidence: sanitizeConfidence(input.confidence),
        citations: normaliseArray(input.citations ?? []),
        approvalNotes: input.approvalNotes?.trim() || undefined,
      } satisfies Record<string, unknown>;

      logger.info(payload, 'Co-authoring proposal approved');
    },
  };
}
