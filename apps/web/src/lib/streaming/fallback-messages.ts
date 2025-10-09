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

export const resolveCoAuthorFallbackMessage = (reason: string): string => {
  const key = (reason ?? '').toLowerCase();
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
  return 'assistant_unavailable';
};
