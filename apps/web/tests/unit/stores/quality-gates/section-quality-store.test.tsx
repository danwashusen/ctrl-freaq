import { describe, expect, it, beforeEach } from 'vitest';

import {
  createSectionQualityStore,
  type SectionQualityStore,
} from '@/features/document-editor/quality-gates/stores/section-quality-store';

describe('section quality store', () => {
  let store: SectionQualityStore;

  beforeEach(() => {
    store = createSectionQualityStore();
  });

  it('provides progressive status messaging and SLA timeout copy', () => {
    const startedAt = 1000;
    store.getState().beginValidation({
      requestId: 'req-section-001',
      triggeredBy: 'user-123',
      startedAt,
    });

    expect(store.getState().statusMessage).toBe('Validating section…');
    expect(store.getState().timeoutCopy).toBeNull();

    store.getState().tick(3100);

    expect(store.getState().statusMessage).toBe('Still checking—this may take another moment.');
    expect(store.getState().durationMs).toBe(2100);
  });

  it('flags submission gating when blockers are present', () => {
    store.getState().beginValidation({
      requestId: 'req-section-blocker',
      triggeredBy: 'user-blocker',
      startedAt: 1000,
    });

    store.getState().completeValidation({
      runId: 'run-section-001',
      status: 'Blocker',
      durationMs: 1450,
      rules: [
        {
          ruleId: 'qa.blocker.missing-risk',
          title: 'Add risk mitigation summary',
          severity: 'Blocker',
          guidance: ['Document mitigation steps for outages'],
        },
      ],
    });

    const state = store.getState();
    expect(state.status).toBe('completed');
    expect(state.isSubmissionBlocked).toBe(true);
    expect(state.blockerCount).toBe(1);
    expect(state.statusMessage).toBe('Validation found blockers.');
  });

  it('exposes timeout copy when validation fails with incident details', () => {
    store.getState().beginValidation({
      requestId: 'req-section-timeout',
      triggeredBy: 'user-timeout',
      startedAt: 0,
    });

    store.getState().failValidation({
      incidentId: 'incident-xyz',
      error: new Error('Runner timed out'),
    });

    const state = store.getState();
    expect(state.status).toBe('failed');
    expect(state.isSubmissionBlocked).toBe(true);
    expect(state.timeoutCopy).toContain('incident-xyz');
    expect(state.statusMessage).toBe('Validation failed—retry required.');
  });
});
