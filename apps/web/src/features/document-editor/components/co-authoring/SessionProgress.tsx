import type { FC } from 'react';

import type { ReplacementNotice, StreamProgressState } from '../../stores/co-authoring-store';
import {
  buildFallbackProgressCopy,
  resolveCoAuthorFallbackMessage,
} from '@/lib/streaming/fallback-messages';

export interface SessionProgressProps {
  progress: StreamProgressState;
  onCancel: () => void;
  onRetry: () => void;
  replacementNotice?: ReplacementNotice | null;
}

const formatElapsed = (elapsedMs: number): string => {
  if (elapsedMs <= 0) {
    return '0.0s';
  }
  return `${(elapsedMs / 1000).toFixed(1)}s`;
};

const formatLatency = (elapsedMs?: number | null): string | null => {
  if (elapsedMs == null || Number.isNaN(elapsedMs)) {
    return null;
  }
  return `${(Math.max(0, elapsedMs) / 1000).toFixed(2)}s`;
};

const SessionProgress: FC<SessionProgressProps> = ({
  progress,
  onCancel,
  onRetry,
  replacementNotice,
}) => {
  const { status, elapsedMs, stageLabel, firstUpdateMs, cancelReason, retryCount } = progress;
  const isStreaming =
    status === 'streaming' ||
    status === 'awaiting-approval' ||
    status === 'queued' ||
    status === 'fallback';
  const showCancel = isStreaming && elapsedMs >= 5000;
  const firstUpdateText = formatLatency(firstUpdateMs);
  const showRetryCount = typeof retryCount === 'number' && retryCount > 0;

  if (status === 'canceled') {
    const reasonCopy =
      cancelReason === 'author_cancelled'
        ? 'You canceled the assistant request.'
        : cancelReason === 'replaced_by_new_request'
          ? 'A newer request replaced this one.'
          : 'Assistant request ended before completion.';

    return (
      <div
        data-testid="co-author-session-progress"
        className="co-author-progress"
        aria-live="assertive"
      >
        <p className="co-author-progress__status">{reasonCopy}</p>
        {showRetryCount ? (
          <p className="co-author-progress__meta">Retry attempts: {retryCount}</p>
        ) : null}
        <button type="button" onClick={onRetry} className="co-author-progress__action">
          Retry assistant
        </button>
      </div>
    );
  }

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

  if (status === 'fallback') {
    const reasonCopy = resolveCoAuthorFallbackMessage(progress.fallbackReason ?? '');
    const progressCopy = buildFallbackProgressCopy({
      interaction: 'coauthor',
      elapsedMs,
      preservedTokens: progress.preservedTokens ?? 0,
    });

    return (
      <div
        data-testid="co-author-session-progress"
        className="co-author-progress"
        aria-live="polite"
      >
        <p className="co-author-progress__status">{reasonCopy}</p>
        <p className="co-author-progress__meta">{progressCopy}</p>
        {showRetryCount ? (
          <p className="co-author-progress__meta">Retry attempts: {retryCount}</p>
        ) : null}
        <button type="button" onClick={onCancel} className="co-author-progress__action">
          Cancel fallback
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

  const streamingStatus = status as 'streaming' | 'awaiting-approval' | 'queued' | 'fallback';

  const readableStatus = (() => {
    switch (streamingStatus) {
      case 'awaiting-approval':
        return 'Awaiting approval';
      case 'queued':
        return 'Queued';
      case 'fallback':
        return 'Fallback delivery';
      default:
        return 'Streaming';
    }
  })();
  const stageText = stageLabel ? `${readableStatus} — ${stageLabel}` : readableStatus;

  return (
    <div data-testid="co-author-session-progress" className="co-author-progress" aria-live="polite">
      <p className="co-author-progress__status">
        {stageText} — {formatElapsed(elapsedMs)} elapsed
      </p>
      {firstUpdateText ? (
        <p className="co-author-progress__meta" data-testid="co-author-progress-first-update">
          First update in {firstUpdateText}
        </p>
      ) : null}
      {showRetryCount ? (
        <p className="co-author-progress__meta" data-testid="co-author-progress-retry-count">
          Retry attempts: {retryCount}
        </p>
      ) : null}
      {replacementNotice ? (
        <p
          className="co-author-progress__notice"
          role="status"
          data-testid="co-author-progress-replacement"
        >
          Previous session {replacementNotice.previousSessionId.slice(-6)} replaced by this request.
        </p>
      ) : null}
      {showCancel ? (
        <button type="button" onClick={onCancel} className="co-author-progress__action">
          Cancel request
        </button>
      ) : null}
    </div>
  );
};

export default SessionProgress;
