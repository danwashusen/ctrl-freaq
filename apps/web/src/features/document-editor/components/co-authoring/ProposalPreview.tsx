import type { FC } from 'react';

import type { PendingProposalSnapshot } from '../../stores/co-authoring-store';

interface DiffSegment {
  segmentId: string;
  type: 'added' | 'removed' | 'context';
  content?: string;
  value?: string;
}

interface ProposalDiff {
  mode: 'unified' | 'split';
  segments: DiffSegment[];
}

interface ProposalAnnotation {
  segmentId: string;
  originTurnId?: string;
  promptId?: string;
  rationale?: string;
  confidence?: number;
  citations?: string[];
}

export interface ProposalPreviewProps {
  proposal: PendingProposalSnapshot & {
    diff: ProposalDiff;
  };
  onApprove: () => void;
  onReject: () => void;
  onRequestChanges: () => void;
}

const formatConfidence = (confidence: number): string => `${Math.round(confidence * 100)}%`;

const ProposalPreview: FC<ProposalPreviewProps> = ({
  proposal,
  onApprove,
  onReject,
  onRequestChanges,
}) => {
  const annotations = proposal.annotations
    .map(annotation => {
      const raw = annotation as Record<string, unknown>;
      const segmentId = typeof raw.segmentId === 'string' ? raw.segmentId : null;
      if (!segmentId) {
        return null;
      }

      const normalized: ProposalAnnotation = {
        segmentId,
        originTurnId: typeof raw.originTurnId === 'string' ? raw.originTurnId : undefined,
        promptId: typeof raw.promptId === 'string' ? raw.promptId : undefined,
        rationale: typeof raw.rationale === 'string' ? raw.rationale : undefined,
        confidence: typeof raw.confidence === 'number' ? raw.confidence : undefined,
        citations: Array.isArray(raw.citations)
          ? (raw.citations.filter(value => typeof value === 'string') as string[])
          : undefined,
      };

      return normalized;
    })
    .filter((annotation): annotation is ProposalAnnotation => annotation !== null);

  const annotationBySegmentId = new Map(
    annotations.map(annotation => [annotation.segmentId, annotation])
  );

  const primaryAnnotation = annotations[0];

  return (
    <section aria-labelledby="co-author-proposal-heading" className="co-author-proposal">
      <header className="co-author-proposal__header">
        <h2 id="co-author-proposal-heading">AI proposal preview</h2>
        {primaryAnnotation ? (
          <div className="co-author-proposal__badges">
            <span data-testid="prompt-badge" className="co-author-proposal__badge">
              Prompt: {primaryAnnotation.promptId ?? primaryAnnotation.originTurnId ?? 'assistant'}
            </span>
            <span className="co-author-proposal__badge">
              Confidence: {formatConfidence(proposal.confidence)}
            </span>
          </div>
        ) : null}
      </header>

      <div
        data-testid="proposal-diff-preview"
        role="region"
        aria-label="Diff preview"
        className="co-author-proposal__diff"
      >
        {proposal.diff.segments.map(segment => {
          const annotation = annotationBySegmentId.get(segment.segmentId);
          const segmentText =
            typeof segment.content === 'string'
              ? segment.content
              : typeof segment.value === 'string'
                ? segment.value
                : '';
          const prefix = segment.type === 'added' ? '+' : segment.type === 'removed' ? '-' : ' ';

          return (
            <pre
              key={segment.segmentId}
              data-segment-id={segment.segmentId}
              data-origin-turn={annotation?.originTurnId}
              className={`co-author-proposal__segment co-author-proposal__segment--${segment.type}`}
            >
              <span aria-hidden="true" className="co-author-proposal__segment-prefix">
                {prefix}
              </span>
              <span
                className="co-author-proposal__segment-text"
                data-segment-id={segment.segmentId}
                data-origin-turn={annotation?.originTurnId}
              >
                {segmentText}
              </span>
              {annotation ? (
                <small className="co-author-proposal__annotation">
                  {annotation.originTurnId ? (
                    <span data-origin-turn={annotation.originTurnId}>
                      {annotation.originTurnId}
                    </span>
                  ) : null}
                  <span>{annotation.rationale ?? 'Assistant justification provided.'}</span>
                </small>
              ) : null}
            </pre>
          );
        })}
      </div>

      <footer className="co-author-proposal__actions">
        <button type="button" onClick={onApprove} className="co-author-proposal__action">
          Approve proposal
        </button>
        <button type="button" onClick={onReject} className="co-author-proposal__action">
          Reject
        </button>
        <button type="button" onClick={onRequestChanges} className="co-author-proposal__action">
          Request changes
        </button>
      </footer>
    </section>
  );
};

export default ProposalPreview;
