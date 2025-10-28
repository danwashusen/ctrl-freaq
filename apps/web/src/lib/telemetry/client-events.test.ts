import { beforeEach, describe, expect, it, vi } from 'vitest';

const infoMock = vi.hoisted(() => vi.fn());
const warnMock = vi.hoisted(() => vi.fn());

vi.mock('@/lib/logger', () => ({
  logger: {
    info: infoMock,
    warn: warnMock,
  },
  default: {
    info: infoMock,
    warn: warnMock,
  },
}));

const payload = {
  draftKey: 'project/doc/section/user',
  projectSlug: 'project',
  documentSlug: 'doc',
  sectionPath: 'section',
  authorId: 'user',
};

describe('client draft telemetry events', () => {
  let consoleInfoSpy: ReturnType<typeof vi.spyOn>;
  let consoleWarnSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.clearAllMocks();
    consoleInfoSpy = vi.spyOn(console, 'info').mockImplementation(() => {});
    consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleInfoSpy.mockRestore();
    consoleWarnSpy.mockRestore();
  });

  it('emits draft saved events only to the local console', async () => {
    const { emitDraftSaved } = await import('./client-events');

    emitDraftSaved(payload);

    expect(infoMock).not.toHaveBeenCalled();
    expect(consoleInfoSpy).toHaveBeenCalledWith('[draft.telemetry] draft.saved', {
      message: 'Draft saved locally',
      payload,
    });
  });

  it('emits draft pruned events only to the local console', async () => {
    const { emitDraftPruned } = await import('./client-events');

    emitDraftPruned({ ...payload, prunedKeys: ['older'] });

    expect(warnMock).not.toHaveBeenCalled();
    expect(consoleWarnSpy).toHaveBeenCalledWith('[draft.telemetry] draft.pruned', {
      message: 'Draft pruned due to storage constraints',
      payload: { ...payload, prunedKeys: ['older'] },
    });
  });

  it('emits draft conflict events only to the local console', async () => {
    const { emitDraftConflict } = await import('./client-events');

    emitDraftConflict({ ...payload, reason: 'server-version-newer' });

    expect(warnMock).not.toHaveBeenCalled();
    expect(consoleWarnSpy).toHaveBeenCalledWith('[draft.telemetry] draft.conflict', {
      message: 'Draft entered conflict state',
      payload: { ...payload, reason: 'server-version-newer' },
    });
  });

  it('emits compliance warning events only to the local console', async () => {
    const { emitComplianceWarning } = await import('./client-events');

    emitComplianceWarning({
      ...payload,
      policyId: 'retention-client-only',
      detectedAt: '2025-10-05T12:00:00.000Z',
    });

    expect(warnMock).not.toHaveBeenCalled();
    expect(consoleWarnSpy).toHaveBeenCalledWith('[draft.telemetry] compliance.warning', {
      message: 'Compliance warning captured client-side',
      payload: {
        ...payload,
        policyId: 'retention-client-only',
        detectedAt: '2025-10-05T12:00:00.000Z',
      },
    });
  });
});

describe('document QA streaming telemetry events', () => {
  let consoleInfoSpy: ReturnType<typeof vi.spyOn>;
  let consoleWarnSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.clearAllMocks();
    consoleInfoSpy = vi.spyOn(console, 'info').mockImplementation(() => {});
    consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleInfoSpy.mockRestore();
    consoleWarnSpy.mockRestore();
  });

  it('logs QA streaming metrics locally', async () => {
    const { emitQaStreamingMetric } = await import('./client-events');

    const metricPayload = {
      sessionId: 'session-qa-1',
      sectionId: 'section-qa',
      elapsedMs: 240,
      stageLabel: 'analysis',
      firstUpdateMs: 180,
      retryCount: 0,
      concurrencySlot: 2,
    };

    emitQaStreamingMetric(metricPayload);

    expect(consoleInfoSpy).toHaveBeenCalledWith('[draft.telemetry] qa.streaming.metric', {
      message: 'QA streaming metric recorded',
      payload: metricPayload,
    });
  });

  it('logs resequence telemetry when out-of-order events occur', async () => {
    const { emitQaStreamingResequence } = await import('./client-events');

    const resequencePayload = {
      sessionId: 'session-qa-1',
      sectionId: 'section-qa',
      reorderedCount: 4,
      highestSequence: 12,
    };

    emitQaStreamingResequence(resequencePayload);

    expect(consoleInfoSpy).toHaveBeenCalledWith('[draft.telemetry] qa.streaming.resequence', {
      message: 'QA stream resequenced to recover ordering',
      payload: resequencePayload,
    });
  });

  it('logs cancel telemetry with reasons', async () => {
    const { emitQaStreamingCancel } = await import('./client-events');

    const cancelPayload = {
      sessionId: 'session-qa-1',
      sectionId: 'section-qa',
      cancelReason: 'author_cancelled',
      retryCount: 2,
    };

    emitQaStreamingCancel(cancelPayload);

    expect(consoleWarnSpy).toHaveBeenCalledWith('[draft.telemetry] qa.streaming.cancelled', {
      message: 'QA streaming canceled client-side',
      payload: cancelPayload,
    });
  });

  it('logs fallback telemetry with diagnostics', async () => {
    const { emitQaStreamingFallback } = await import('./client-events');

    const fallbackPayload = {
      sessionId: 'session-qa-1',
      sectionId: 'section-qa',
      fallbackReason: 'transport_blocked',
      triggeredAt: '2025-10-10T10:00:00.000Z',
      preservedTokensCount: 6,
      retryAttempted: false,
      elapsedMs: 2200,
    };

    emitQaStreamingFallback(fallbackPayload);

    expect(consoleWarnSpy).toHaveBeenCalledWith('[draft.telemetry] qa.streaming.fallback', {
      message: 'QA streaming fallback engaged',
      payload: fallbackPayload,
    });
  });

  it('logs co-author fallback telemetry with diagnostics', async () => {
    const { emitCoAuthorStreamingFallback } = await import('./client-events');

    const payload = {
      sessionId: 'coauthor-session-1',
      sectionId: 'section-coauthor',
      fallbackReason: 'transport_blocked',
      preservedTokensCount: 8,
      retryAttempted: true,
      elapsedMs: 3100,
      cancelReason: undefined,
    };

    emitCoAuthorStreamingFallback(payload);

    expect(consoleWarnSpy).toHaveBeenCalledWith('[draft.telemetry] coauthor.streaming.fallback', {
      message: 'Co-author streaming fallback engaged',
      payload,
    });
  });
});

describe('assumption streaming telemetry events', () => {
  let consoleInfoSpy: ReturnType<typeof vi.spyOn>;
  let consoleWarnSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.clearAllMocks();
    consoleInfoSpy = vi.spyOn(console, 'info').mockImplementation(() => {});
    consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleInfoSpy.mockRestore();
    consoleWarnSpy.mockRestore();
  });

  it('logs assumption streaming metrics locally', async () => {
    const { emitAssumptionStreamingMetric } = await import('./client-events');

    const metricPayload = {
      sessionId: 'assumption-session-1',
      sectionId: 'section-assumption',
      elapsedMs: 180,
      stageLabel: 'rationale',
      status: 'streaming' as const,
    };

    emitAssumptionStreamingMetric(metricPayload);

    expect(consoleInfoSpy).toHaveBeenCalledWith('[draft.telemetry] assumptions.streaming.metric', {
      message: 'Assumption streaming metric recorded',
      payload: metricPayload,
    });
  });

  it('logs assumption streaming status transitions', async () => {
    const { emitAssumptionStreamingStatus } = await import('./client-events');

    const statusPayload = {
      sessionId: 'assumption-session-1',
      sectionId: 'section-assumption',
      status: 'canceled' as const,
      reason: 'author_cancelled',
    };

    emitAssumptionStreamingStatus(statusPayload);

    expect(consoleWarnSpy).toHaveBeenCalledWith('[draft.telemetry] assumptions.streaming.status', {
      message: 'Assumption streaming status change',
      payload: statusPayload,
    });
  });

  it('logs resequence telemetry for assumption streams', async () => {
    const { emitAssumptionStreamingResequence } = await import('./client-events');

    const resequencePayload = {
      sessionId: 'assumption-session-1',
      sectionId: 'section-assumption',
      correctedCount: 3,
      highestSequence: 9,
    };

    emitAssumptionStreamingResequence(resequencePayload);

    expect(consoleInfoSpy).toHaveBeenCalledWith(
      '[draft.telemetry] assumptions.streaming.resequence',
      {
        message: 'Assumption stream resequenced to recover ordering',
        payload: resequencePayload,
      }
    );
  });

  it('logs fallback telemetry for assumption streams', async () => {
    const { emitAssumptionStreamingFallback } = await import('./client-events');

    const fallbackPayload = {
      sessionId: 'assumption-session-1',
      sectionId: 'section-assumption',
      fallbackReason: 'transport_blocked',
      preservedTokensCount: 2,
      retryAttempted: false,
      elapsedMs: 1500,
    };

    emitAssumptionStreamingFallback(fallbackPayload);

    expect(consoleWarnSpy).toHaveBeenCalledWith(
      '[draft.telemetry] assumptions.streaming.fallback',
      {
        message: 'Assumption streaming fallback engaged',
        payload: fallbackPayload,
      }
    );
  });
});

describe('project lifecycle telemetry events', () => {
  let consoleInfoSpy: ReturnType<typeof vi.spyOn>;
  let consoleWarnSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.clearAllMocks();
    consoleInfoSpy = vi.spyOn(console, 'info').mockImplementation(() => {});
    consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleInfoSpy.mockRestore();
    consoleWarnSpy.mockRestore();
  });

  it('logs project create success metrics with normalized duration', async () => {
    const { emitProjectCreateMetric } = await import('./client-events');

    emitProjectCreateMetric({
      durationMs: 1543.8,
      projectId: 'project-alpha',
      visibility: 'workspace',
      result: 'success',
      triggeredAt: '2025-10-26T11:00:00.000Z',
      requestId: 'req-123',
    });

    expect(consoleInfoSpy).toHaveBeenCalledWith('[projects.telemetry] projects.lifecycle.create', {
      message: 'Project lifecycle create metric recorded',
      payload: {
        durationMs: 1544,
        projectId: 'project-alpha',
        visibility: 'workspace',
        result: 'success',
        triggeredAt: '2025-10-26T11:00:00.000Z',
        requestId: 'req-123',
      },
    });
    expect(consoleWarnSpy).not.toHaveBeenCalled();
    expect(infoMock).not.toHaveBeenCalled();
    expect(warnMock).not.toHaveBeenCalled();
  });

  it('logs project create failures as warnings', async () => {
    const { emitProjectCreateMetric } = await import('./client-events');

    emitProjectCreateMetric({
      durationMs: -20,
      visibility: 'private',
      result: 'error',
      triggeredAt: '2025-10-26T11:05:00.000Z',
      errorMessage: 'CONFLICT',
    });

    expect(consoleWarnSpy).toHaveBeenCalledWith('[projects.telemetry] projects.lifecycle.create', {
      message: 'Project lifecycle create metric recorded',
      payload: {
        durationMs: 0,
        projectId: undefined,
        visibility: 'private',
        result: 'error',
        triggeredAt: '2025-10-26T11:05:00.000Z',
        errorMessage: 'CONFLICT',
      },
    });
  });

  it('logs dashboard hydration timings', async () => {
    const { emitProjectDashboardHydrationMetric } = await import('./client-events');

    emitProjectDashboardHydrationMetric({
      durationMs: 812.2,
      projectCount: 12,
      includeArchived: false,
      search: 'alpha rollout',
      triggeredAt: '2025-10-26T11:10:00.000Z',
      requestId: 'req-321',
      fromCache: false,
    });

    expect(consoleInfoSpy).toHaveBeenCalledWith(
      '[projects.telemetry] projects.dashboard.hydration',
      {
        message: 'Project dashboard hydration metric recorded',
        payload: {
          durationMs: 812,
          projectCount: 12,
          includeArchived: false,
          search: 'alpha rollout',
          triggeredAt: '2025-10-26T11:10:00.000Z',
          requestId: 'req-321',
          fromCache: false,
        },
      }
    );
  });
});
