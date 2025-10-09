import { createHash } from 'node:crypto';

import {
  generateProposalDiff,
  type GenerateProposalDiffArgs,
  type ProposalDiffAnnotation,
  type ProposalDiffResult,
} from '@ctrl-freaq/editor-core/diff/section-proposal';
import {
  createAIProposalSnapshot,
  type AIProposalSnapshot,
} from '@ctrl-freaq/shared-data/co-authoring/ai-proposal-snapshot';

export interface DiffMapperInput {
  proposalId: string;
  sessionId: string;
  originTurnId: string;
  promptId: string;
  rationale: string;
  confidence: number;
  citations: string[];
  baselineContent: string;
  proposedContent: string;
  renderMode?: 'split' | 'unified';
  createdAt?: Date;
  ttlMs?: number;
}

export interface DiffMapperResult {
  diff: {
    mode: 'split' | 'unified';
    segments: Array<Record<string, unknown>>;
    metadata?: Record<string, unknown>;
  };
  annotations: ProposalDiffAnnotation[];
  diffHash: string;
  snapshot: AIProposalSnapshot;
}

const sanitizeStringList = (values: string[]): string[] => {
  const seen = new Set<string>();
  const result: string[] = [];

  for (const value of values) {
    if (typeof value !== 'string') {
      continue;
    }
    const trimmed = value.trim();
    if (!trimmed || seen.has(trimmed)) {
      continue;
    }
    seen.add(trimmed);
    result.push(trimmed);
  }

  return result;
};

const computeDiffHash = (diff: DiffMapperResult['diff']): string => {
  const hash = createHash('sha256');
  hash.update(JSON.stringify(diff.segments));
  return `sha256:${hash.digest('hex')}`;
};

const toStreamDiff = (
  result: ProposalDiffResult['diff'],
  annotations: ProposalDiffAnnotation[],
  originTurnId: string
): DiffMapperResult['diff'] => {
  let annotationIndex = 0;
  let contextCounter = 0;

  const segments = result.segments.map(segment => {
    let segmentId: string;

    if (segment.type === 'added' || segment.type === 'removed') {
      const annotation = annotations.at(annotationIndex) ?? null;
      if (annotation && annotation.segmentType === segment.type) {
        segmentId = annotation.segmentId;
        annotationIndex += 1;
      } else if (annotation) {
        segmentId = annotation.segmentId;
        annotationIndex += 1;
      } else {
        segmentId = `${originTurnId}::${segment.type}::${annotationIndex}`;
        annotationIndex += 1;
      }
    } else {
      segmentId = `${originTurnId}::context::${contextCounter}`;
      contextCounter += 1;
    }

    const { metadata, ...rest } = segment;
    const normalized: Record<string, unknown> = {
      ...rest,
      segmentId,
      value: segment.content,
    };

    if (metadata) {
      normalized.metadata = { ...metadata };
    }

    return normalized;
  });

  return {
    mode: result.mode,
    segments,
    ...(result.metadata ? { metadata: { ...result.metadata } } : {}),
  } satisfies DiffMapperResult['diff'];
};

export function mapProposalDiff(input: DiffMapperInput): DiffMapperResult {
  const citations = sanitizeStringList(input.citations);

  const proposalDiffArgs: GenerateProposalDiffArgs = {
    baselineContent: input.baselineContent,
    proposedContent: input.proposedContent,
    prompt: {
      turnId: input.originTurnId,
      promptId: input.promptId,
      rationale: input.rationale,
      confidence: input.confidence,
    },
    citations,
  };

  const { diff, annotations } = generateProposalDiff(proposalDiffArgs);
  const diffForStream = toStreamDiff(diff, annotations, input.originTurnId);

  const snapshot = createAIProposalSnapshot({
    proposalId: input.proposalId,
    sessionId: input.sessionId,
    originTurnId: input.originTurnId,
    diff: diffForStream,
    renderMode: input.renderMode ?? diffForStream.mode,
    confidence: input.confidence,
    citations,
    annotations,
    createdAt: input.createdAt,
    ttlMs: input.ttlMs,
  });

  return {
    diff: diffForStream,
    annotations,
    diffHash: computeDiffHash(diffForStream),
    snapshot,
  };
}
