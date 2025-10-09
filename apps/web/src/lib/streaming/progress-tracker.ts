export interface StreamingProgressUpdate {
  status: 'queued' | 'streaming' | 'awaiting-approval' | 'error' | 'idle';
  elapsedMs: number;
  reason?: string;
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

export function createStreamingProgressTracker(
  options: ProgressTrackerOptions = {}
): StreamingProgressTracker {
  const announce = options.announce ?? (() => {});

  let slowAnnounced = false;
  let errorAnnounced = false;
  let queuedAnnounced = false;
  let awaitingAnnounced = false;

  return {
    update(update: StreamingProgressUpdate) {
      switch (update.status) {
        case 'queued':
          if (!queuedAnnounced) {
            queuedAnnounced = true;
            awaitingAnnounced = false;
            slowAnnounced = false;
            errorAnnounced = false;
            announce({ message: buildQueuedMessage(), polite: true });
          }
          return;
        case 'idle':
          slowAnnounced = false;
          errorAnnounced = false;
          queuedAnnounced = false;
          awaitingAnnounced = false;
          return;
        case 'streaming': {
          if (update.elapsedMs >= 5_000 && !slowAnnounced) {
            slowAnnounced = true;
            errorAnnounced = false;
            announce({ message: buildSlowStreamingMessage(update.elapsedMs), polite: true });
          }
          return;
        }
        case 'awaiting-approval': {
          slowAnnounced = false;
          errorAnnounced = false;
          if (!awaitingAnnounced) {
            awaitingAnnounced = true;
            announce({ message: buildAwaitingApprovalMessage(), polite: true });
          }
          return;
        }
        case 'error': {
          if (!errorAnnounced) {
            errorAnnounced = true;
            slowAnnounced = false;
            queuedAnnounced = false;
            awaitingAnnounced = false;
            announce({ message: buildErrorMessage(update.reason), polite: false });
          }
          return;
        }
        default:
          return;
      }
    },
  };
}
