import { generateSectionDiff } from './section-diff';
import type { SectionDiffResult, SectionDiffSegment } from './section-diff';

export interface ProposalDiffAnnotation {
  segmentId: string;
  segmentType: 'added' | 'removed' | 'context';
  originTurnId: string;
  promptId: string;
  rationale: string;
  confidence: number;
  citations: string[];
}

export interface GenerateProposalDiffArgs {
  baselineContent: string;
  proposedContent: string;
  prompt: {
    turnId: string;
    promptId: string;
    rationale: string;
    confidence: number;
  };
  citations?: string[];
}

export interface ProposalDiffResult {
  diff: SectionDiffResult;
  annotations: ProposalDiffAnnotation[];
}

const normalizeSegment = (segment: SectionDiffSegment): SectionDiffSegment => {
  if (segment.type === 'unchanged') {
    return {
      ...segment,
      type: 'context',
    };
  }

  return segment;
};

const sanitizeCitations = (citations: string[] | undefined): string[] => {
  if (!citations) {
    return [];
  }

  const seen = new Set<string>();
  const result: string[] = [];

  for (const citation of citations) {
    if (typeof citation !== 'string') {
      continue;
    }
    const trimmed = citation.trim();
    if (!trimmed || seen.has(trimmed)) {
      continue;
    }
    seen.add(trimmed);
    result.push(trimmed);
  }

  return result;
};

export function generateProposalDiff(args: GenerateProposalDiffArgs): ProposalDiffResult {
  const { baselineContent, proposedContent, prompt } = args;
  const citations = sanitizeCitations(args.citations);

  const diff = generateSectionDiff(baselineContent, proposedContent, { mode: 'unified' });
  const normalizedSegments = diff.segments.map(segment => normalizeSegment(segment));

  const annotations: ProposalDiffAnnotation[] = [];
  for (const segment of normalizedSegments) {
    if (segment.type !== 'added' && segment.type !== 'removed') {
      continue;
    }

    const segmentIndex = annotations.length;
    annotations.push({
      segmentId: `${prompt.turnId}::${segment.type}::${segmentIndex}`,
      segmentType: segment.type,
      originTurnId: prompt.turnId,
      promptId: prompt.promptId,
      rationale: prompt.rationale.trim(),
      confidence: prompt.confidence,
      citations,
    });
  }

  const normalizedDiff: SectionDiffResult = {
    ...diff,
    segments: normalizedSegments,
  };

  return {
    diff: normalizedDiff,
    annotations,
  };
}
