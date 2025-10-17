import { beforeEach, describe, expect, it } from 'vitest';

import { createDocQualityTranslator } from '@/lib/i18n';
import {
  createDocumentQualityStore,
  type DocumentQualitySummary,
  type DocumentQualityStore,
} from '@/features/document-editor/quality-gates/stores/document-quality-store';

const translator = createDocQualityTranslator();

const BLOCKED_SUMMARY: DocumentQualitySummary = {
  documentId: 'demo-architecture',
  statusCounts: {
    pass: 8,
    warning: 3,
    blocker: 1,
    neutral: 2,
  },
  blockerSections: ['sec-overview'],
  warningSections: ['sec-api'],
  lastRunAt: '2025-01-17T16:45:00.000Z',
  triggeredBy: 'user-dashboard',
  requestId: 'req-queued-batch',
  publishBlocked: true,
  coverageGaps: [
    {
      requirementId: 'req-coverage-gap',
      reason: 'blocker',
      linkedSections: ['sec-overview'],
    },
  ],
};

const RESOLVED_SUMMARY: DocumentQualitySummary = {
  ...BLOCKED_SUMMARY,
  statusCounts: {
    pass: 9,
    warning: 2,
    blocker: 0,
    neutral: 2,
  },
  blockerSections: [],
  warningSections: ['sec-api'],
  publishBlocked: false,
  coverageGaps: [
    {
      requirementId: 'req-traceability-coverage',
      reason: 'no-link',
      linkedSections: [],
    },
  ],
  lastRunAt: '2025-01-17T16:50:00.000Z',
  triggeredBy: 'user-dashboard',
  requestId: 'req-complete-batch',
};

describe('document quality dashboard store', () => {
  let store: DocumentQualityStore;

  beforeEach(() => {
    store = createDocumentQualityStore({ translator });
  });

  it('hydrates summaries and surfaces publish blocking copy', () => {
    store.getState().hydrateSummary(BLOCKED_SUMMARY);

    const state = store.getState();
    expect(state.status).toBe('ready');
    expect(state.summary?.statusCounts.blocker).toBe(1);
    expect(state.isPublishBlocked).toBe(true);
    expect(state.publishCopy).toBe(
      translator.helper('blocked', { count: BLOCKED_SUMMARY.statusCounts.blocker })
    );
    expect(state.lastRunAt).toBe(BLOCKED_SUMMARY.lastRunAt);
    expect(state.requestId).toBe(BLOCKED_SUMMARY.requestId);
    expect(state.triggeredBy).toBe(BLOCKED_SUMMARY.triggeredBy);
  });

  it('warns when batch runs exceed the document SLA', () => {
    store.getState().beginBatchRun({
      documentId: BLOCKED_SUMMARY.documentId,
      requestId: 'req-dashboard-sla',
      triggeredBy: 'user-sla',
      startedAt: 1000,
    });

    expect(store.getState().status).toBe('running');
    expect(store.getState().statusMessage).toBe(translator.status('validating'));

    store.getState().tick(7000);

    expect(store.getState().statusMessage).toBe(translator.status('slow'));
    expect(store.getState().durationMs).toBe(6000);
    expect(store.getState().slaWarningCopy).toContain('Still');
  });

  it('clears publish gating when blockers resolve after completion', () => {
    store.getState().hydrateSummary(BLOCKED_SUMMARY);
    store.getState().beginBatchRun({
      documentId: BLOCKED_SUMMARY.documentId,
      requestId: BLOCKED_SUMMARY.requestId,
      triggeredBy: 'user-dashboard',
      startedAt: 5000,
    });

    store.getState().completeBatchRun(RESOLVED_SUMMARY);

    const state = store.getState();
    expect(state.status).toBe('ready');
    expect(state.isPublishBlocked).toBe(false);
    expect(state.publishCopy).toBe(translator.helper('ready'));
    expect(state.summary?.statusCounts.blocker).toBe(0);
    expect(state.lastRunAt).toBe(RESOLVED_SUMMARY.lastRunAt);
    expect(state.requestId).toBe(RESOLVED_SUMMARY.requestId);
  });
});
