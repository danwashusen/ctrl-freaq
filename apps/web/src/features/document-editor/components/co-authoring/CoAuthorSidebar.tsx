import { useEffect, useMemo, useState, type FC, type FormEvent } from 'react';

import type {
  CoAuthoringIntent,
  PendingProposalSnapshot,
  ReplacementNotice,
  StreamProgressState,
} from '../../stores/co-authoring-store';
import type { CoAuthorFallbackState } from '../../hooks/useCoAuthorSession';
import SessionProgress from './SessionProgress';
import ProposalPreview from './ProposalPreview';

interface ContextOption {
  id: string;
  label: string;
}

interface DiffSegment {
  segmentId: string;
  type: 'added' | 'removed' | 'context';
  content: string;
  value?: string;
}

export interface CoAuthorSidebarProps {
  documentTitle: string;
  sectionTitle: string;
  activeIntent: CoAuthoringIntent;
  onIntentChange: (intent: CoAuthoringIntent) => void;
  selectedKnowledge: string[];
  knowledgeOptions: ContextOption[];
  onToggleKnowledge: (id: string) => void;
  selectedDecisions: string[];
  decisionOptions: ContextOption[];
  onToggleDecision: (id: string) => void;
  onRunAnalyze: (input: { intent: CoAuthoringIntent; prompt: string }) => void;
  onRunProposal: (input: { intent: CoAuthoringIntent; prompt: string }) => void;
  onApproveProposal: () => void;
  onRejectProposal: () => void;
  onRequestChanges: () => void;
  progress: StreamProgressState;
  replacementNotice: ReplacementNotice | null;
  onCancelStreaming: () => void;
  onRetry: () => void;
  pendingProposal: PendingProposalSnapshot | null;
  fallback: CoAuthorFallbackState | null;
  transcript: string[];
}

const INTENT_LABELS: Array<{ intent: CoAuthoringIntent; label: string }> = [
  { intent: 'explain', label: 'Explain intent' },
  { intent: 'outline', label: 'Outline intent' },
  { intent: 'improve', label: 'Improve intent' },
];

const CoAuthorSidebar: FC<CoAuthorSidebarProps> = props => {
  const {
    documentTitle,
    sectionTitle,
    activeIntent,
    onIntentChange,
    selectedKnowledge,
    knowledgeOptions,
    onToggleKnowledge,
    selectedDecisions,
    decisionOptions,
    onToggleDecision,
    onRunAnalyze,
    onRunProposal,
    onApproveProposal,
    onRejectProposal,
    onRequestChanges,
    progress,
    replacementNotice,
    onCancelStreaming,
    onRetry,
    pendingProposal,
    fallback,
    transcript,
  } = props;

  const [prompt, setPrompt] = useState('');

  useEffect(() => {
    if (progress.status === 'idle') {
      setPrompt(prev => prev);
    }
  }, [progress.status]);

  const transcriptText = useMemo(() => transcript.join(''), [transcript]);

  const proposalSnapshot = useMemo(() => {
    if (!pendingProposal) {
      return null;
    }

    const rawDiff = pendingProposal.diff as unknown;
    let mode: 'unified' | 'split' = 'unified';
    const segments: DiffSegment[] = [];

    if (rawDiff && typeof rawDiff === 'object') {
      const diffRecord = rawDiff as Record<string, unknown>;
      if (diffRecord.mode === 'split') {
        mode = 'split';
      }
      if (Array.isArray(diffRecord.segments)) {
        diffRecord.segments.forEach(segment => {
          const record = segment as Record<string, unknown>;
          const segmentId = typeof record.segmentId === 'string' ? record.segmentId : '';
          if (!segmentId) {
            return;
          }
          const segmentText =
            typeof record.content === 'string'
              ? record.content
              : typeof record.value === 'string'
                ? record.value
                : '';
          const type =
            record.type === 'added' || record.type === 'removed' || record.type === 'context'
              ? record.type
              : 'context';

          segments.push({
            segmentId,
            content: segmentText,
            value: segmentText,
            type,
          });
        });
      }
    }

    return {
      ...pendingProposal,
      diff: {
        mode,
        segments,
      },
    };
  }, [pendingProposal]);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!prompt.trim()) {
      return;
    }
    onRunAnalyze({ intent: activeIntent, prompt: prompt.trim() });
  };

  const handleProposal = () => {
    if (!prompt.trim()) {
      return;
    }
    onRunProposal({ intent: activeIntent, prompt: prompt.trim() });
  };

  return (
    <aside
      data-testid="co-author-sidebar"
      className="co-author-sidebar"
      aria-label="Co-author assistant"
    >
      <header className="co-author-sidebar__header">
        <h1 className="co-author-sidebar__title">Co-author assistant</h1>
        <p className="co-author-sidebar__scope">
          <strong>{documentTitle}</strong> — {sectionTitle}
        </p>
        <div className="co-author-sidebar__intent-group" role="group" aria-label="Assistant intent">
          {INTENT_LABELS.map(({ intent, label }) => (
            <button
              key={intent}
              type="button"
              className={`co-author-sidebar__intent ${intent === activeIntent ? 'is-active' : ''}`}
              onClick={() => onIntentChange(intent)}
            >
              {label}
            </button>
          ))}
        </div>
      </header>

      <section className="co-author-sidebar__context" aria-label="Assistant context controls">
        <h2 className="co-author-sidebar__section-title">Knowledge sources</h2>
        <ul className="co-author-sidebar__option-list">
          {knowledgeOptions.map(option => (
            <li key={option.id}>
              <label className="co-author-sidebar__option">
                <input
                  type="checkbox"
                  checked={selectedKnowledge.includes(option.id)}
                  onChange={() => onToggleKnowledge(option.id)}
                />
                {option.label}
              </label>
            </li>
          ))}
        </ul>

        <h2 className="co-author-sidebar__section-title">Decision log references</h2>
        <ul className="co-author-sidebar__option-list">
          {decisionOptions.map(option => (
            <li key={option.id}>
              <label className="co-author-sidebar__option">
                <input
                  type="checkbox"
                  checked={selectedDecisions.includes(option.id)}
                  onChange={() => onToggleDecision(option.id)}
                />
                {option.label}
              </label>
            </li>
          ))}
        </ul>
      </section>

      <form className="co-author-sidebar__form" onSubmit={handleSubmit}>
        <label htmlFor="co-author-prompt" className="co-author-sidebar__section-title">
          Ask the assistant
        </label>
        <textarea
          id="co-author-prompt"
          aria-label="Ask the assistant"
          value={prompt}
          onChange={event => setPrompt(event.target.value)}
          className="co-author-sidebar__textarea"
          rows={4}
        />
        <div className="co-author-sidebar__actions">
          <button type="submit" className="co-author-sidebar__primary">
            Ask Assistant
          </button>
          <button type="button" onClick={handleProposal} className="co-author-sidebar__secondary">
            Generate proposal
          </button>
        </div>
      </form>

      <SessionProgress
        progress={progress}
        replacementNotice={replacementNotice}
        onCancel={onCancelStreaming}
        onRetry={onRetry}
      />

      {transcriptText ? (
        <section className="co-author-sidebar__transcript" aria-label="Streaming response">
          <p>{transcriptText}</p>
        </section>
      ) : null}

      {proposalSnapshot ? (
        <ProposalPreview
          proposal={proposalSnapshot}
          onApprove={onApproveProposal}
          onReject={onRejectProposal}
          onRequestChanges={onRequestChanges}
        />
      ) : null}

      <div
        data-testid="co-author-fallback"
        className={`co-author-sidebar__fallback ${fallback ? '' : 'hidden'}`}
        role="status"
        aria-live="polite"
      >
        {fallback ? (
          <p>
            {fallback.message}
            <br />
            <span className="co-author-sidebar__fallback-progress">{fallback.progressCopy}</span>
            {fallback.retryable ? ' Try again when ready.' : ''}
          </p>
        ) : null}
      </div>
    </aside>
  );
};

export default CoAuthorSidebar;
