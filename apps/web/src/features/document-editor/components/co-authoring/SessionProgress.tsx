import type { FC } from 'react';

export interface SessionProgressProps {
  status: 'idle' | 'queued' | 'streaming' | 'awaiting-approval' | 'error';
  elapsedMs: number;
  onCancel: () => void;
  onRetry: () => void;
}

const formatElapsed = (elapsedMs: number): string => {
  if (elapsedMs <= 0) {
    return '0.0s';
  }
  return `${(elapsedMs / 1000).toFixed(1)}s`;
};

const SessionProgress: FC<SessionProgressProps> = ({ status, elapsedMs, onCancel, onRetry }) => {
  const isStreaming =
    status === 'streaming' || status === 'awaiting-approval' || status === 'queued';
  const showCancel = isStreaming && elapsedMs >= 5000;

  if (status === 'error') {
    return (
      <div
        data-testid="co-author-session-progress"
        className="co-author-progress"
        aria-live="polite"
      >
        <p className="co-author-progress__status">
          Assistant paused — please review the conversation.
        </p>
        <button type="button" onClick={onRetry} className="co-author-progress__action">
          Retry assistant
        </button>
      </div>
    );
  }

  if (!isStreaming) {
    return (
      <div
        data-testid="co-author-session-progress"
        className="co-author-progress"
        aria-live="polite"
      >
        <p className="co-author-progress__status">Assistant idle</p>
      </div>
    );
  }

  const readableStatus = status === 'awaiting-approval' ? 'Awaiting approval' : 'Streaming';

  return (
    <div data-testid="co-author-session-progress" className="co-author-progress" aria-live="polite">
      <p className="co-author-progress__status">
        {readableStatus} — {formatElapsed(elapsedMs)} elapsed
      </p>
      {showCancel ? (
        <button type="button" onClick={onCancel} className="co-author-progress__action">
          Cancel request
        </button>
      ) : null}
    </div>
  );
};

export default SessionProgress;
