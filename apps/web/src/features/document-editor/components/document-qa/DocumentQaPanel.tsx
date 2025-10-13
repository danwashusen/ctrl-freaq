import type { FC } from 'react';

import SessionProgress from '../co-authoring/SessionProgress';
import type { ReplacementNotice, StreamProgressState } from '../../stores/co-authoring-store';

export interface DocumentQaPanelProps {
  documentTitle: string;
  sectionTitle: string;
  progress: StreamProgressState;
  transcript: string[];
  replacementNotice: ReplacementNotice | null;
  onCancel: () => void;
  onRetry: () => void;
}

const DocumentQaPanel: FC<DocumentQaPanelProps> = props => {
  const {
    documentTitle,
    sectionTitle,
    progress,
    transcript,
    replacementNotice,
    onCancel,
    onRetry,
  } = props;

  const transcriptText = transcript.join('');

  return (
    <section
      data-testid="document-qa-panel"
      className="document-qa-panel"
      aria-label="Document QA streaming review"
    >
      <header className="document-qa-panel__header">
        <h2 className="document-qa-panel__title">Document QA review</h2>
        <p className="document-qa-panel__context">
          <strong>{documentTitle}</strong> — {sectionTitle}
        </p>
      </header>

      <SessionProgress
        progress={progress}
        replacementNotice={replacementNotice}
        onCancel={onCancel}
        onRetry={onRetry}
      />

      {transcriptText ? (
        <div
          className="document-qa-panel__transcript"
          aria-live="polite"
          data-testid="document-qa-transcript"
        >
          <p>{transcriptText}</p>
        </div>
      ) : null}
    </section>
  );
};

export default DocumentQaPanel;
