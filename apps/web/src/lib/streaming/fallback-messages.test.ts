import { describe, expect, it } from 'vitest';

import {
  mapFallbackReasonToAnnouncement,
  resolveCoAuthorFallbackMessage,
} from './fallback-messages';

describe('resolveCoAuthorFallbackMessage', () => {
  it('returns descriptive copy for known reasons', () => {
    expect(resolveCoAuthorFallbackMessage('assistant_unavailable')).toContain(
      'Assistant became unavailable'
    );
    expect(resolveCoAuthorFallbackMessage('approval_failed')).toContain(
      'Could not apply the proposal'
    );
  });

  it('converts unknown codes into sentence case guidance', () => {
    expect(resolveCoAuthorFallbackMessage('unexpected_timeout')).toBe('Unexpected timeout.');
  });
});

describe('mapFallbackReasonToAnnouncement', () => {
  it('preserves known reasons for announcement mapping', () => {
    expect(mapFallbackReasonToAnnouncement('assistant_unavailable')).toBe('assistant_unavailable');
    expect(mapFallbackReasonToAnnouncement('proposal_needs_changes')).toBe(
      'proposal_needs_changes'
    );
  });

  it('defaults to assistant_unavailable for unknown reasons', () => {
    expect(mapFallbackReasonToAnnouncement('mystery_failure')).toBe('assistant_unavailable');
  });
});
