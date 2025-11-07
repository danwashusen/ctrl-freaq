const FALLBACK_MESSAGES: Record<string, string> = {
  assistant_unavailable:
    'Assistant became unavailable. Retry shortly or continue with manual edits.',
  approval_failed: 'Could not apply the proposal. Review the diff and retry.',
  proposal_needs_changes: 'Proposal needs manual updates before approval can continue.',
  rate_limited: 'Assistant rate limit reached. Pause for a moment and retry your request.',
  analysis_failed: 'Assistant could not finish the analysis. Adjust the prompt and try again.',
  stream_disconnected: 'Assistant stream disconnected. Reopen the co-author session and retry.',
};

const toSentenceCase = (value: string): string => {
  if (!value) {
    return 'Assistant fallback triggered. Retry when ready.';
  }
  const normalized = value.replace(/[\s_-]+/g, ' ').trim();
  if (!normalized) {
    return 'Assistant fallback triggered. Retry when ready.';
  }
  return normalized.charAt(0).toUpperCase() + normalized.slice(1);
};

const formatElapsedSeconds = (elapsedMs: number): number => {
  const seconds = Math.round(elapsedMs / 1000);
  return Math.max(1, seconds);
};

const INTERACTION_LABELS: Record<FallbackInteraction, string> = {
  coauthor: 'Assistant',
  'document-qa': 'Document QA',
  assumptions: 'Assumptions',
};

const normaliseReason = (reason: string): string => {
  const trimmed = reason?.trim();
  if (!trimmed) {
    return 'unknown reason';
  }
  return trimmed.replace(/[_-]+/g, ' ');
};

export type FallbackInteraction = 'coauthor' | 'document-qa' | 'assumptions';

export interface FallbackProgressOptions {
  interaction: FallbackInteraction;
  elapsedMs: number;
  preservedTokens: number;
}

export interface FallbackAnnouncementInput {
  interaction: FallbackInteraction;
  state: 'active' | 'completed' | 'canceled';
  reason: string;
  elapsedMs: number;
  preservedTokens: number;
  retryAttempted?: boolean;
}

export const resolveCoAuthorFallbackMessage = (reason: string): string => {
  const key = (reason ?? '').toLowerCase();
  if (key === 'transport_blocked' || key === 'stream_timeout') {
    return (
      FALLBACK_MESSAGES.assistant_unavailable ??
      'Assistant became unavailable. Retry shortly or continue with manual edits.'
    );
  }
  if (key in FALLBACK_MESSAGES) {
    const knownMessage = FALLBACK_MESSAGES[key as keyof typeof FALLBACK_MESSAGES];
    if (typeof knownMessage === 'string') {
      return knownMessage;
    }
  }
  return `${toSentenceCase(key || 'assistant fallback')}.`;
};

export const mapFallbackReasonToAnnouncement = (reason: string): string => {
  const key = (reason ?? '').toLowerCase();
  if (key === 'proposal_needs_changes') {
    return 'proposal_needs_changes';
  }
  if (key && key in FALLBACK_MESSAGES) {
    return key;
  }
  if (key === 'transport_blocked') {
    return 'assistant_unavailable';
  }
  if (key === 'stream_timeout') {
    return 'assistant_unavailable';
  }
  return 'assistant_unavailable';
};

export const buildFallbackProgressCopy = (options: FallbackProgressOptions): string => {
  const seconds = formatElapsedSeconds(options.elapsedMs);
  const label = INTERACTION_LABELS[options.interaction] ?? 'Assistant';
  return `${label} fallback in progress — ${seconds} second${seconds === 1 ? '' : 's'} elapsed.`;
};

export const resolveFallbackAnnouncement = (
  input: FallbackAnnouncementInput
): { message: string; polite: boolean } => {
  const label = INTERACTION_LABELS[input.interaction] ?? 'Assistant';
  const reasonCopy = normaliseReason(input.reason);
  const tokens = Math.max(0, Math.round(input.preservedTokens));

  switch (input.state) {
    case 'active':
      return {
        message: `Fallback mode activated — ${label} reported ${reasonCopy}.`,
        polite: false,
      };
    case 'completed': {
      const completedSeconds = Math.max(
        1,
        Number.isFinite(input.elapsedMs) ? Math.floor(input.elapsedMs / 1000) : 0
      );
      const tokenCopy =
        tokens > 0 ? `${tokens} preserved token${tokens === 1 ? '' : 's'}` : 'no preserved tokens';
      return {
        message: `Completed using fallback after ${completedSeconds} second${
          completedSeconds === 1 ? '' : 's'
        } with ${tokenCopy}. ${label} guidance ready.`,
        polite: true,
      };
    }
    case 'canceled': {
      const retrySuffix = input.retryAttempted ? ' Retry will start shortly.' : '';
      return {
        message: `${label} fallback canceled (${reasonCopy}).${retrySuffix}`,
        polite: false,
      };
    }
    default:
      return {
        message: `${label} fallback updated.`,
        polite: true,
      };
  }
};

export const resolveFallbackCancelMessage = (reason: string): string => {
  const key = (reason ?? '').toLowerCase();
  switch (key) {
    case 'author_cancelled':
      return 'Author canceled fallback delivery.';
    case 'replaced_by_new_request':
      return 'Newer request replaced the fallback interaction.';
    case 'transport_failure':
      return 'Assistant transport failed during fallback.';
    case 'deferred':
      return 'Fallback paused and deferred for later delivery.';
    default:
      return 'Fallback response did not finish.';
  }
};
