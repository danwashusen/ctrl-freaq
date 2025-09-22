import { describe, it } from 'vitest';

describe('contracts: Section Editor API', () => {
  it('GET /sections/{sectionId} matches SectionView schema', () => {
    throw new Error('Contract test pending implementation');
  });

  it('POST /sections/{sectionId}/drafts validates SaveDraftRequest and DraftResource', () => {
    throw new Error('Contract test pending implementation');
  });

  it('GET /sections/{sectionId}/diff returns DiffResource payload', () => {
    throw new Error('Contract test pending implementation');
  });

  it('POST /sections/{sectionId}/review requires SubmitForReviewRequest', () => {
    throw new Error('Contract test pending implementation');
  });

  it('POST /sections/{sectionId}/approve validates ApproveDraftRequest', () => {
    throw new Error('Contract test pending implementation');
  });
});
