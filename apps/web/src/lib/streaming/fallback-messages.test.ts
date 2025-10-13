import { describe, expect, it } from 'vitest';

import {
  buildFallbackProgressCopy,
  resolveFallbackAnnouncement,
  resolveFallbackCancelMessage,
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

describe('buildFallbackProgressCopy', () => {
  it('reports deterministic progress with elapsed seconds across interactions', () => {
    expect(
      buildFallbackProgressCopy({ interaction: 'coauthor', elapsedMs: 4200, preservedTokens: 12 })
    ).toBe('Assistant fallback in progress — 4 seconds elapsed.');
    expect(
      buildFallbackProgressCopy({
        interaction: 'document-qa',
        elapsedMs: 6800,
        preservedTokens: 0,
      })
    ).toBe('Document QA fallback in progress — 7 seconds elapsed.');
    expect(
      buildFallbackProgressCopy({
        interaction: 'assumptions',
        elapsedMs: 400,
        preservedTokens: 3,
      })
    ).toBe('Assumptions fallback in progress — 1 second elapsed.');
  });
});

describe('resolveFallbackAnnouncement', () => {
  it('emits assertive cue when fallback activates', () => {
    const announcement = resolveFallbackAnnouncement({
      interaction: 'coauthor',
      state: 'active',
      reason: 'transport_blocked',
      elapsedMs: 0,
      preservedTokens: 0,
    });

    expect(announcement.polite).toBe(false);
    expect(announcement.message).toContain('Fallback mode activated');
    expect(announcement.message).toContain('transport blocked');
  });

  it('emits polite completion message when fallback finishes', () => {
    const announcement = resolveFallbackAnnouncement({
      interaction: 'document-qa',
      state: 'completed',
      reason: 'transport_blocked',
      elapsedMs: 5800,
      preservedTokens: 5,
    });

    expect(announcement.polite).toBe(true);
    expect(announcement.message).toContain('Completed using fallback');
    expect(announcement.message).toContain('5 seconds');
    expect(announcement.message).toContain('5 preserved tokens');
  });
});

describe('resolveFallbackCancelMessage', () => {
  it('maps cancel reasons to human-readable copy', () => {
    expect(resolveFallbackCancelMessage('author_cancelled')).toBe(
      'Author canceled fallback delivery.'
    );
    expect(resolveFallbackCancelMessage('replaced_by_new_request')).toBe(
      'Newer request replaced the fallback interaction.'
    );
    expect(resolveFallbackCancelMessage('unknown_reason')).toBe(
      'Fallback response did not finish.'
    );
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
