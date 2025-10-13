import type { FallbackInteraction } from './fallback-messages';
import { buildFallbackProgressCopy } from './fallback-messages';

export interface StreamingProgressUpdate {
  status: 'queued' | 'streaming' | 'awaiting-approval' | 'fallback' | 'error' | 'idle' | 'canceled';
  elapsedMs: number;
  reason?: string;
  cancelReason?: string;
  retryCount?: number;
  preservedTokens?: number;
}

export interface StreamingAnnouncement {
  message: string;
  polite: boolean;
}

export interface StreamingProgressTracker {
  update(update: StreamingProgressUpdate): void;
}

type ProgressTrackerOptions = {
  announce?: (announcement: StreamingAnnouncement) => void;
  interaction?: FallbackInteraction;
};

const formatElapsedSeconds = (elapsedMs: number): number => {
  return Math.max(1, Math.round(elapsedMs / 1000));
};

const buildSlowStreamingMessage = (elapsedMs: number): string => {
  const seconds = formatElapsedSeconds(elapsedMs);
  return `Assistant is still working. ${seconds} second${seconds === 1 ? '' : 's'} elapsed. You can cancel or wait for the proposal.`;
};

const buildQueuedMessage = (): string => {
  return 'Assistant request started. We will announce progress if it takes longer than expected.';
};

const buildAwaitingApprovalMessage = (): string => {
  return 'Assistant finished preparing the proposal. Review the changes when ready.';
};

const buildStreamingStartMessage = (): string => {
  return 'Assistant is preparing guidance.';
};

const buildErrorMessage = (reason?: string): string => {
  switch (reason) {
    case 'assistant_unavailable':
      return 'Assistant became unavailable. Retry shortly or continue with manual edits.';
    case 'stream_disconnected':
      return 'Assistant stream disconnected. Retry or continue manually.';
    case 'approval_failed':
      return 'Could not apply the proposal. Review the diff and retry when ready.';
    case 'proposal_needs_changes':
      return 'Proposal needs manual updates before it can be approved.';
    case 'analysis_failed':
      return 'Assistant could not finish the analysis. Retry after checking your prompt.';
    default:
      return 'Assistant request failed. Retry the request or continue with manual edits.';
  }
};

const buildCanceledMessage = (reason?: string): string => {
  switch (reason) {
    case 'author_cancelled':
      return 'Assistant request canceled. You can start a new request when ready.';
    case 'replaced_by_new_request':
      return 'Newer assistant request replaced the pending one.';
    default:
      return 'Assistant request exited before completion.';
  }
};

const buildRetryMessage = (attempt: number): string => {
  return `Assistant retrying — attempt ${attempt}.`;
};

export function createStreamingProgressTracker(
  options: ProgressTrackerOptions = {}
): StreamingProgressTracker {
  const announce = options.announce ?? (() => {});
  const interaction: FallbackInteraction = options.interaction ?? 'coauthor';

  let slowAnnounced = false;
  let errorAnnounced = false;
  let queuedAnnounced = false;
  let awaitingAnnounced = false;
  let streamingStartAnnounced = false;
  let lastRetryAnnounced: number | null = null;
  let fallbackAnnounced = false;

  return {
    update(update: StreamingProgressUpdate) {
      if (typeof update.retryCount === 'number' && update.retryCount > 0) {
        if (lastRetryAnnounced !== update.retryCount) {
          lastRetryAnnounced = update.retryCount;
          announce({ message: buildRetryMessage(update.retryCount), polite: false });
        }
      }

      switch (update.status) {
        case 'queued':
          if (!queuedAnnounced) {
            queuedAnnounced = true;
            awaitingAnnounced = false;
            slowAnnounced = false;
            errorAnnounced = false;
            streamingStartAnnounced = false;
            lastRetryAnnounced = null;
            fallbackAnnounced = false;
            announce({ message: buildQueuedMessage(), polite: true });
          }
          return;
        case 'idle':
          slowAnnounced = false;
          errorAnnounced = false;
          queuedAnnounced = false;
          awaitingAnnounced = false;
          streamingStartAnnounced = false;
          lastRetryAnnounced = null;
          fallbackAnnounced = false;
          return;
        case 'streaming': {
          if (!streamingStartAnnounced && update.elapsedMs <= 300) {
            streamingStartAnnounced = true;
            announce({ message: buildStreamingStartMessage(), polite: true });
          }
          if (update.elapsedMs >= 5_000 && !slowAnnounced) {
            slowAnnounced = true;
            errorAnnounced = false;
            announce({ message: buildSlowStreamingMessage(update.elapsedMs), polite: true });
          }
          fallbackAnnounced = false;
          return;
        }
        case 'awaiting-approval': {
          slowAnnounced = false;
          errorAnnounced = false;
          streamingStartAnnounced = false;
          fallbackAnnounced = false;
          if (!awaitingAnnounced) {
            awaitingAnnounced = true;
            announce({ message: buildAwaitingApprovalMessage(), polite: true });
          }
          return;
        }
        case 'fallback': {
          errorAnnounced = false;
          slowAnnounced = false;
          queuedAnnounced = false;
          awaitingAnnounced = false;
          streamingStartAnnounced = false;
          if (!fallbackAnnounced) {
            fallbackAnnounced = true;
            const preservedTokens = Math.max(0, update.preservedTokens ?? 0);
            announce({
              message: buildFallbackProgressCopy({
                interaction,
                elapsedMs: update.elapsedMs,
                preservedTokens,
              }),
              polite: true,
            });
          }
          return;
        }
        case 'error': {
          if (!errorAnnounced) {
            errorAnnounced = true;
            slowAnnounced = false;
            queuedAnnounced = false;
            awaitingAnnounced = false;
            streamingStartAnnounced = false;
            lastRetryAnnounced = null;
            fallbackAnnounced = false;
            announce({ message: buildErrorMessage(update.reason), polite: false });
          }
          return;
        }
        case 'canceled': {
          if (!errorAnnounced) {
            errorAnnounced = true;
            slowAnnounced = false;
            queuedAnnounced = false;
            awaitingAnnounced = false;
            streamingStartAnnounced = false;
            lastRetryAnnounced = null;
            fallbackAnnounced = false;
            announce({
              message: buildCanceledMessage(update.cancelReason ?? update.reason),
              polite: false,
            });
          }
          return;
        }
        default:
          return;
      }
    },
  };
}
